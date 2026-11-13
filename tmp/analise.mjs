// TEMPORÁRIO (tmp/) — análise das planilhas do "Dentista Organizado".
// Roda via `npm test` durante o run_qa e grava o relatório em tmp/analise-out.md.
// NÃO grava nada no banco, NÃO embute dados no projeto, NÃO fica em src/.
// A usuária pediu: usar as linhas só para análise, exemplos mascarados.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(__dirname, '..', 'src', 'assets')
const OUT = path.join(__dirname, 'analise-out.md')

const ARQ_BACKUP = 'backup-18540-9cjvqthh-23ebe.xlsx'
const ARQ_PACIENTES = 'pacientes276111794536305395-d2894.xlsx'

const out = []
const say = (s) => out.push(s)

// ---------- ZIP mínimo (central directory + inflateRaw) ----------
function readZip(buf) {
  // EOCD
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 70000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0)
    throw new Error(
      'Não é um arquivo ZIP válido (sem EOCD) — provavelmente corrompido ou não é .xlsx',
    )
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50)
      throw new Error('Assinatura do diretório central inválida em ' + off)
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const fnLen = buf.readUInt16LE(off + 28)
    const exLen = buf.readUInt16LE(off + 30)
    const cmLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + fnLen)
    if (!name.endsWith('/')) files.set(name, { method, compSize, localOff })
    off += 46 + fnLen + exLen + cmLen
  }
  const get = (name) => {
    const f = files.get(name)
    if (!f) return null
    const lnLen = buf.readUInt16LE(f.localOff + 26)
    const leLen = buf.readUInt16LE(f.localOff + 28)
    const start = f.localOff + 30 + lnLen + leLen
    const data = buf.subarray(start, start + f.compSize)
    return f.method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data)
  }
  return { get, names: [...files.keys()] }
}

// ---------- XML helpers ----------
const unesc = (s) =>
  s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (_, e) => {
    if (e === 'amp') return '&'
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return String.fromCodePoint(n)
    }
    return _
  })
const tag = (s, name) => {
  const m = s.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'))
  return m ? unesc(m[1]) : ''
}

function colIndexFromRef(ref) {
  const m = ref.match(/^([A-Z]+)/)
  if (!m) return null
  let i = 0
  for (const ch of m[1]) i = i * 26 + (ch.charCodeAt(0) - 64)
  return i - 1
}

function readXlsx(buf) {
  const zip = readZip(buf)
  const wb = zip.get('xl/workbook.xml')
  if (!wb) throw new Error('workbook.xml ausente — arquivo não parece ser .xlsx')
  const relsXml = zip.get('xl/_rels/workbook.xml.rels')
  const rels = new Map()
  if (relsXml) {
    for (const rel of relsXml.matchAll(/<Relationship[^>]*>/g)) {
      const id = tag(rel[0], 'Id').replace(/Id="|"/g, '')
      const m = rel[0].match(/Id="([^"]+)"/)
      const t = rel[0].match(/Target="([^"]+)"/)
      if (m && t) rels.set(m[1], t[1])
    }
  }
  const shared = []
  const ssXml = zip.get('xl/sharedStrings.xml')
  if (ssXml) {
    for (const si of ssXml.toString('utf8').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) {
      const parts = [...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => unesc(t[1]))
      shared.push(parts.join(''))
    }
  }
  const sheets = []
  for (const sh of wb.toString('utf8').matchAll(/<sheet\s[^>]*>/g)) {
    const nome = (sh[0].match(/name="([^"]*)"/) || [])[1] || '(sem nome)'
    const rid = (sh[0].match(/r:id="([^"]*)"/) || [])[1]
    let target = rels.get(rid) || ''
    if (target.startsWith('/')) target = target.slice(1)
    else if (!target.startsWith('xl/')) target = 'xl/' + target
    sheets.push({ nome, target })
  }
  const parsed = sheets.map(({ nome, target }) => {
    const xml = zip.get(target)
    if (!xml)
      return { nome, header: [], rows: [], erro: 'aba não encontrada no zip (' + target + ')' }
    const rows = []
    for (const rm of xml.toString('utf8').matchAll(/<row\s[^>]*?>([\s\S]*?)<\/row>/g)) {
      const cells = []
      let seq = 0
      for (const cm of rm[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1]
        const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1]
        const t = (attrs.match(/t="([^"]+)"/) || [])[1]
        const body = cm[2] || ''
        let val = null
        const vm = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)
        if (t === 'inlineStr') {
          val = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
            .map((x) => unesc(x[1]))
            .join('')
        } else if (vm) {
          val = unesc(vm[1])
          if (t === 's') val = shared[parseInt(val, 10)] ?? ''
        } else if (t === 'inlineStr') {
          val = ''
        }
        let idx = ref ? colIndexFromRef(ref) : seq
        if (idx == null) idx = seq
        cells[idx] = val
        seq = idx + 1
      }
      rows.push(cells)
    }
    const header = (rows.shift() || []).map((h, i) =>
      h == null || h === '' ? 'col' + (i + 1) : String(h).trim(),
    )
    return { nome, header, rows }
  })
  return { nomeArquivo: '', abas: parsed }
}

// ---------- classificação de valores ----------
const RE_DATA_BR = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
const RE_ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/
const RE_MOEDA = /^R?\$\s?[\d.]{1,12},\d{2}$/
const RE_NUM = /^[+-]?\d+([.,]\d+)?$/
const RE_SIMNAO = /^(s|n|sim|n[ãa]o|true|false|1|0)$/i

function serialToIso(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000)
  return d.toISOString().slice(0, 10)
}
function parseDataBr(s) {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let y = parseInt(m[3], 10)
  if (y < 100) y += 2000
  const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime()) || d.getUTCMonth() + 1 !== parseInt(m[2], 10)) return null
  return iso
}

function classificar(v, headerLower) {
  if (v == null || String(v).trim() === '') return 'vazio'
  const s = String(v).trim()
  if (RE_ISO.test(s)) return s.length > 10 ? 'datahora-texto' : 'data-texto-iso'
  if (RE_DATA_BR.test(s)) return parseDataBr(s) ? 'data-br' : 'data-br-invalida'
  if (RE_MOEDA.test(s)) return 'moeda-texto'
  if (RE_NUM.test(s)) {
    const n = parseFloat(s.replace(',', '.'))
    if (/data|nasc|cadastro|nascimento|criad|atualiz/.test(headerLower) && n > 20000 && n < 60000)
      return 'numero-serial-data'
    return 'numero'
  }
  if (/tel|cel|fone|whats/.test(headerLower)) {
    const d = s.replace(/\D/g, '')
    return d.length >= 10 && d.length <= 13 ? 'telefone-ok' : 'telefone-invalido'
  }
  if (/@/.test(s)) return 'email'
  if (RE_SIMNAO.test(s)) return 'sim-nao'
  return 'texto'
}

// ---------- mascaramento ----------
const maskNome = (s) => {
  const p = String(s).trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '(vazio)'
  if (p.length === 1) return p[0].slice(0, 2) + '***'
  return p[0].slice(0, 12) + ' ' + p[p.length - 1][0] + '.'
}
const maskFone = (s) => {
  const d = String(s).replace(/\D/g, '')
  if (d.length < 8) return '(curto)'
  return `(**) ${d.length > 10 ? '9' : ''}****-**${d.slice(-2)}`
}
const maskCpf = (s) => (String(s).replace(/\D/g, '').length === 11 ? '***.***.***-**' : '***')
const maskEmail = (s) => {
  const m = String(s).match(/^([^@])[^@]*@(.)(.*)$/)
  return m ? `${m[1]}***@${m[2]}***` : '***'
}
const maskGenerico = (s) => {
  let t = String(s).slice(0, 60)
  t = t.replace(/\d{4,}/g, '****')
  return t
}
function maskarValor(headerLower, v) {
  if (v == null) return ''
  if (/nome|paciente|pac\./.test(headerLower)) return maskNome(v)
  if (/tel|cel|fone|whats/.test(headerLower)) return maskFone(v)
  if (/cpf|cnpj/.test(headerLower)) return maskCpf(v)
  if (/mail/.test(headerLower)) return maskEmail(v)
  if (/nasc|nascimento|dtnasc/.test(headerLower)) return maskGenerico(v)
  if (/evolu|anotac|observ|historia|descr|obs\b|queixa|condut/i.test(headerLower))
    return '(texto clínico — não exibido, ' + String(v).length + ' caracteres)'
  return maskGenerico(v)
}

// ---------- análise por aba ----------
function analisarAba(aba, rotuloArquivo) {
  const { header, rows } = aba
  const nCols = header.length
  const nRows = rows.length
  say(`\n### Aba "${aba.nome}" — ${rotuloArquivo}`)
  say(`Linhas de dados: **${nRows}** · Colunas: **${nCols}**`)
  if (aba.erro) {
    say(`ERRO: ${aba.erro}`)
    return
  }
  if (nRows === 0) {
    say('Aba sem linhas de dados (só cabeçalho ou vazia).')
    return
  }

  // estatísticas por coluna
  const stats = header.map((h, ci) => {
    const hl = h.toLowerCase()
    const contagem = {}
    const valores = new Map() // p/ categóricos e datas
    let vazios = 0
    let somaNum = 0,
      nNum = 0,
      minNum = Infinity,
      maxNum = -Infinity
    for (const row of rows) {
      const v = row[ci]
      const c = classificar(v, hl)
      contagem[c] = (contagem[c] || 0) + 1
      if (c === 'vazio') {
        vazios++
      } else {
        const s = String(v).trim()
        if (!valores.has(s)) valores.set(s, 0)
        valores.set(s, valores.get(s) + 1)
        if (c === 'numero' || c === 'numero-serial-data' || c === 'moeda-texto') {
          const n = parseFloat(
            s
              .replace(/[^\d,.-]/g, '')
              .replace(/\./g, '')
              .replace(',', '.'),
          )
          if (!isNaN(n)) {
            somaNum += n
            nNum++
            if (n < minNum) minNum = n
            if (n > maxNum) maxNum = n
          }
        }
      }
    }
    const tipos = Object.entries(contagem)
      .filter(([k]) => k !== 'vazio')
      .sort((a, b) => b[1] - a[1])
    const tipo = tipos.length ? tipos[0][0] : 'vazio'
    return { h, hl, vazios, contagem, tipo, valores, somaNum, nNum, minNum, maxNum, nRows }
  })

  // tabela de colunas
  say('\n| Coluna | Tipo inferido | Vazios | Observação |')
  say('|---|---|---|---|')
  for (const s of stats) {
    const dist = Object.entries(s.contagem)
      .filter(([k]) => k !== 'vazio')
      .map(([k, c]) => `${k}:${c}`)
      .join(', ')
    let obs = dist
    if (s.tipo === 'numero' && s.nNum > 0)
      obs = `soma=${Math.round(s.somaNum * 100) / 100}, min=${s.minNum}, max=${s.maxNum} · ` + obs
    if (s.tipo === 'moeda-texto' && s.nNum > 0)
      obs = `soma≈R$ ${Math.round(s.somaNum * 100) / 100} · ` + obs
    if (
      s.tipo === 'data-br' ||
      s.tipo === 'data-texto-iso' ||
      s.tipo === 'datahora-texto' ||
      s.tipo === 'numero-serial-data'
    ) {
      const isos = [...s.valores.keys()]
        .map((v) => {
          if (s.tipo === 'numero-serial-data') {
            const n = parseFloat(v)
            return isNaN(n) ? null : serialToIso(n)
          }
          if (s.tipo === 'data-br') return parseDataBr(v)
          return v.slice(0, 10)
        })
        .filter(Boolean)
        .sort()
      const range = isos.length
        ? `faixa ${isos[0].slice(0, 7)}…${isos[isos.length - 1].slice(0, 7)} (mes/ano)`
        : ''
      obs = [range, dist].filter(Boolean).join(' · ')
    }
    say(`| ${s.h} | ${s.tipo} | ${s.vazios} | ${obs} |`)
  }

  // categóricos (até 40 valores distintos)
  say('\nValores distintos (categóricos, quando ≤40 distintos):')
  for (const s of stats) {
    const distintos = s.valores.size
    if (distintos === 0 || distintos > 40) continue
    if (s.tipo.startsWith('data') || s.tipo === 'numero-serial-data') continue
    if (/id|codigo|c[óo]digo/.test(s.hl) && distintos > 20) continue
    const ordenado = [...s.valores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
    say(
      `- **${s.h}** (${distintos} distintos): ${ordenado.map(([v, c]) => `${maskarValor(s.hl, v)} ×${c}`).join(' · ')}`,
    )
  }

  // amostras mascaradas (3 primeiras linhas)
  say('\nAmostras mascaradas (3 primeiras linhas):')
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const row = rows[i]
    const pares = header
      .map((h, ci) => `${h}=${maskarValor(h.toLowerCase(), row[ci])}`)
      .filter((p) => !p.endsWith('='))
    say('- ' + pares.join(' · ').slice(0, 700))
  }
  return stats
}

// ---------- qualidade ----------
const normNome = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const normFone = (s) => {
  let d = String(s || '').replace(/\D/g, '')
  if (d.length === 13 || d.length === 12) d = d.slice(2) // 55DD9XXXXXXXX
  if (d.length === 11 && !d.startsWith('9')) d = '9' + d.slice(2) // normaliza p/ celular
  return d.length >= 10 ? d.slice(-11) : d
}

function colunaDe(header, regexes) {
  for (const r of regexes) {
    const i = header.findIndex((h) => r.test(h.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

function analisarQualidade(tudo) {
  say('\n## Qualidade dos dados\n')
  const masterNomeIdx = {}
  const masterNomes = new Set()
  const masterFones = new Map()

  for (const [chave, plan] of Object.entries(tudo)) {
    const abaPac =
      plan.abas.find((a) => a.nome && /paciente/i.test(a.nome)) ||
      plan.abas.find((a) => colunaDe(a.header, [/^nome/]) >= 0 && a.header.length > 5)
    if (!abaPac) continue
    const ciNome = colunaDe(abaPac.header, [/^nome\b/, /nome.*paciente/, /^paciente/])
    if (ciNome < 0) continue
    const ciFone = colunaDe(abaPac.header, [/cel/, /tel/, /fone/])
    const dupNome = new Map(),
      dupFone = new Map()
    let semNome = 0,
      foneVazio = 0,
      foneMal = 0,
      total = abaPac.rows.length
    for (const row of abaPac.rows) {
      const nome = row[ciNome]
      if (!nome || !String(nome).trim()) {
        semNome++
        continue
      }
      const nn = normNome(nome)
      if (nn.length > 3) {
        if (!dupNome.has(nn)) dupNome.set(nn, [])
        dupNome.get(nn).push(nome)
      }
      if (ciFone >= 0) {
        const f = row[ciFone]
        const nf = normFone(f)
        if (!f || !String(f).trim()) foneVazio++
        else if (String(f).replace(/\D/g, '').length < 10) foneMal++
        if (nf) {
          if (!masterFones.has(nf)) masterFones.set(nf, maskNome(nome))
          if (!dupFone.has(nf)) dupFone.set(nf, [])
          dupFone.get(nf).push(nome)
        }
      }
      masterNomes.add(nn)
    }
    const nomesDup = [...dupNome.entries()].filter(([, v]) => v.length > 1)
    const fonesDup = [...dupFone.entries()].filter(([, v]) => v.length > 1)
    say(`### Pacientes — ${chave}`)
    say(
      `- Linhas: ${total} · sem nome: ${semNome} · telefone vazio: ${foneVazio} · telefone malformado (<10 dígitos): ${foneMal}`,
    )
    say(
      `- Nomes duplicados: **${nomesDup.length}** grupos (${nomesDup.reduce((a, [, v]) => a + v.length - 1, 0)} linhas extras) — exemplos: ${
        nomesDup
          .slice(0, 8)
          .map(([, v]) => v.map(maskNome).join(' = '))
          .join('; ') || '—'
      }`,
    )
    say(
      `- Telefones duplicados (mesmo número em >1 linha): **${fonesDup.length}** — exemplos: ${
        fonesDup
          .slice(0, 8)
          .map(([k, v]) => `${maskFone(k)} (${v.map(maskNome).join(' = ')})`)
          .join('; ') || '—'
      }`,
    )
    masterNomeIdx[chave] = { ciNome }
  }

  // referências a pacientes ausentes do master
  say('\n### Referências entre abas')
  for (const [chave, plan] of Object.entries(tudo)) {
    for (const aba of plan.abas) {
      if (/paciente/i.test(aba.nome)) continue
      const ci = colunaDe(aba.header, [/^paciente\b/, /nome.*paciente/, /^paciente\./])
      if (ci < 0) continue
      let total = 0,
        fora = 0,
        vazio = 0
      const exemplos = new Map()
      for (const row of aba.rows) {
        const v = row[ci]
        if (!v || !String(v).trim()) {
          vazio++
          continue
        }
        total++
        const nn = normNome(v)
        if (nn && !masterNomes.has(nn)) {
          fora++
          if (!exemplos.has(nn)) exemplos.set(nn, v)
        }
      }
      say(
        `- **${aba.nome}** (${chave}): ${total} linhas com paciente · **${fora}** citam paciente que NÃO está na aba de pacientes · vazios: ${vazio}. Exemplos fora: ${[...exemplos.values()].slice(0, 8).map(maskNome).join('; ') || '—'}`,
      )
    }
  }

  // datas estranhas em todas as abas
  say('\n### Datas e formatos suspeitos (todas as abas)')
  for (const [chave, plan] of Object.entries(tudo)) {
    for (const aba of plan.abas) {
      header.forEach((h, ci) => {
        const hl = h.toLowerCase()
        if (!/data|nasc|cadastro|retorno|criad|atualiz|validade/.test(hl)) return
        let brInvalida = 0,
          isoParcial = 0,
          textoLivre = 0,
          ok = 0,
          vazios = 0
        const exemplos = []
        for (const row of aba.rows) {
          const v = row[ci]
          const s = v == null ? '' : String(v).trim()
          if (!s) {
            vazios++
            continue
          }
          if (RE_DATA_BR.test(s)) {
            parseDataBr(s) ? ok++ : brInvalida++
          } else if (RE_ISO.test(s)) ok++
          else if (/^\d{5}(\.\d+)?$/.test(s)) ok++
          else {
            textoLivre++
            if (exemplos.length < 5) exemplos.push(maskGenerico(s))
          }
        }
        if (brInvalida || textoLivre) {
          say(
            `- ${aba.nome} (${chave}) · coluna "${h}": ok/serial=${ok}, datas BR inválidas=${brInvalida}, outros formatos=${textoLivre}, vazios=${vazios}${exemplos.length ? ' · ex.: ' + exemplos.join(' | ') : ''}`,
          )
        }
      })
    }
  }
}

// ---------- principal ----------
const tudo = {}
const erros = []
say('# Análise automática — Dentista Organizado (temporária, gerada em tmp/)')
say(
  'Relatório gerado por script temporário a partir dos .xlsx anexados. Exemplos SEMPRE mascarados.',
)

for (const [chave, arquivo] of [
  ['backup completo', ARQ_BACKUP],
  ['export pacientes', ARQ_PACIENTES],
]) {
  const p = path.join(ASSETS, arquivo)
  say(`\n## Arquivo: ${arquivo}`)
  if (!fs.existsSync(p)) {
    say('ARQUIVO NÃO ENCONTRADO EM src/assets/ — ' + p)
    erros.push(arquivo + ': não encontrado')
    continue
  }
  const buf = fs.readFileSync(p)
  say(`Bytes em disco: ${buf.length}`)
  const magic = buf.subarray(0, 4).toString('ascii')
  say(
    `Assinatura: ${JSON.stringify(magic)} ${magic === 'PK\u0003\u0004' ? '(zip/xlsx ok)' : '(NÃO é zip — provavelmente corrompido ou renomeado)'}`,
  )
  try {
    const plan = readXlsx(buf)
    plan.nomeArquivo = arquivo
    tudo[chave] = plan
    say(`Abas: ${plan.abas.map((a) => `"${a.nome}" (${a.rows.length} linhas)`).join(', ')}`)
    for (const aba of plan.abas) analisarAba(aba, chave)
  } catch (err) {
    say(`**FALHA ao abrir: ${err.message}**`)
    erros.push(arquivo + ': ' + err.message)
  }
}

if (erros.length) say('\n## Erros de leitura\n- ' + erros.join('\n- '))
try {
  analisarQualidade(tudo)
} catch (err) {
  say('\nERRO na análise de qualidade: ' + err.message + '\n' + (err.stack || ''))
}

fs.mkdirSync(__dirname, { recursive: true })
fs.writeFileSync(OUT, out.join('\n'), 'utf8')
console.log(
  'ANALISE OK — relatório em tmp/analise-out.md (' +
    out.join('\n').length +
    ' chars). Erros: ' +
    (erros.join('; ') || 'nenhum'),
)
process.exit(0)
