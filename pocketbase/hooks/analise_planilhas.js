// TEMPORÁRIO — hook de análise das planilhas do "Dentista Organizado".
// Lê os .xlsx em src/assets (fornecidos no deploy) e devolve um relatório
// MASCARADO no corpo da resposta (e no console.log / list_logs).
// NÃO grava nada no banco.
//
// Notas de runtime do JSVM (goja): o PocketBase executa cada callback num pool
// separado, então NADA de topo (const, function) é visível dentro do roteador —
// por isso todo o código vive dentro do callback, inclusive o script Python.
// Não existe inflateRaw no JSVM: o trabalho pesado (ler o xlsx) é feito por
// python3 via $os.exec, e o resultado volta pronto no stdout.
routerAdd(
  'POST',
  '/backend/v1/analise-planilhas',
  (e) => {
    const ARQ_BACKUP = 'backup-18540-9cjvqthh-23ebe.xlsx'
    const ARQ_PACIENTES = 'pacientes276111794536305395-d2894.xlsx'
    const DIR = 'src/assets/'

    const PY_SCRIPT = `
import json, sys, re, struct, zlib, zipfile, io, os

ARQ_BACKUP = ${JSON.stringify(ARQ_BACKUP)}
ARQ_PACIENTES = ${JSON.stringify(ARQ_PACIENTES)}
DIR = ${JSON.stringify(DIR)}

out = []
erros = []

def say(t):
    out.append(str(t))

def abrir(caminho):
    try:
        return zipfile.ZipFile(caminho)
    except Exception as exc:
        erros.append(caminho + ": " + str(exc))
        return None

def celulas(z, nome):
    """Devolve lista de listas de texto da aba (por sharedStrings + inline)."""
    try:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            s = z.read('xl/sharedStrings.xml').decode('utf-8', 'ignore')
            for m in re.finditer(r'<si>(.*?)</si>', s, re.S):
                txt = ''.join(re.findall(r'<t[^>]*>(.*?)</t>', m.group(1), re.S))
                shared.append(txt)
        xml = z.read(nome).decode('utf-8', 'ignore')
        linhas = []
        for rm in re.finditer(r'<row[^>]*>(.*?)</row>', xml, re.S):
            linha = []
            for cm in re.finditer(r'<c([^>]*)>(.*?)</c>', rm.group(1), re.S):
                attrs, corpo = cm.group(1), cm.group(2)
                t = re.search(r't="([^"]+)"', attrs)
                tipo = t.group(1) if t else 'n'
                if tipo == 'inlineStr':
                    txt = ''.join(re.findall(r'<t[^>]*>(.*?)</t>', corpo, re.S))
                else:
                    v = re.search(r'<v>(.*?)</v>', corpo, re.S)
                    val = v.group(1) if v else ''
                    if tipo == 's' and val.isdigit() and int(val) < len(shared):
                        txt = shared[int(val)]
                    else:
                        txt = val
                linha.append(txt)
            linhas.append(linha)
        return linhas
    except Exception as exc:
        erros.append(nome + ": " + str(exc))
        return []

def mascarar(v):
    s = str(v or '').strip()
    if not s:
        return ''
    if re.fullmatch(r'[\d\s\-\(\)\.]{8,}', s):
        return '***' + s[-2:]
    if '@' in s:
        return s.split('@')[0][:2] + '***@' + s.split('@')[1]
    if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}.*', s):
        return s
    if len(s) <= 3:
        return s
    return s[:2] + '***'

for rotulo, arquivo in [("backup completo", ARQ_BACKUP), ("export pacientes", ARQ_PACIENTES)]:
    caminho = os.path.join(DIR, arquivo)
    say("")
    say("### " + rotulo + " — " + arquivo)
    if not os.path.exists(caminho):
        say("arquivo não encontrado: " + caminho)
        continue
    say("tamanho: " + str(os.path.getsize(caminho)) + " bytes")
    z = abrir(caminho)
    if z is None:
        continue
    abas = [n for n in z.namelist() if n.startswith('xl/worksheets/sheet')]
    say("abas: " + str(len(abas)))
    for aba in sorted(abas):
        linhas = celulas(z, aba)
        say("")
        say("  " + aba + ": " + str(len(linhas)) + " linhas")
        if not linhas:
            continue
        say("    cabecalho: " + " | ".join([mascarar(c) for c in linhas[0][:20]]))
        for i, linha in enumerate(linhas[1:3], 1):
            say("    ex" + str(i) + ": " + " | ".join([mascarar(c) for c in linha[:20]]))

say("")
say("erros: " + ("; ".join(erros) if erros else "nenhum"))
print("ANALISE PLANILHAS: " + str(len(out)) + " linhas de relatorio")
print("ANALISE PLANILHAS INICIO:\\n" + "\\n".join(out)[:6000])
`

    let saida
    try {
      const cmd = $os.exec('python3', ['-c', PY_SCRIPT])
      const bruto = cmd.output()
      saida = typeof bruto === 'string' ? bruto : String(bruto)
    } catch (err) {
      console.log('ANALISE PLANILHAS FALHOU: ' + String(err && err.message ? err.message : err))
      return e.json(500, { ok: false, erro: String(err && err.message ? err.message : err) })
    }
    console.log(saida)
    return e.json(200, { ok: true, chars: saida.length, preview: saida.slice(0, 6000) })
  },
  $apis.requireSuperuserAuth(),
)
