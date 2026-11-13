import {
  normalizarNome,
  normalizarCidade,
  normalizarUf,
  normalizarTelefone,
  normalizarCpf,
  normalizarCep,
  corrigirAcentos,
} from './normalizar'
import { DestinoCampo, DestinoColecao, destinoDoMolde } from './destinos'

/** Destino escolhido para uma coluna da planilha */
export type MapeamentoColuna =
  | { tipo: 'campo'; campo: string }
  | { tipo: 'extras' }
  | { tipo: 'ignorar' }

export interface ColunaMapeada {
  /** Índice da coluna na planilha */
  indice: number
  /** Nome original da coluna no cabeçalho */
  nome: string
  mapeamento: MapeamentoColuna
}

/**
 * Sugere automaticamente o destino de cada coluna comparando o nome
 * normalizado do cabeçalho com os rótulos/campos de destino.
 * Colunas sem equivalente vão para "extras" (nunca descartadas silenciosamente).
 */
export function sugerirMapeamento(colunas: string[], destino: DestinoColecao): ColunaMapeada[] {
  // Molde conhecido (Dentista Organizado) tem prioridade sobre a heurística:
  // é o mapeamento validado contra o arquivo real, sem adivinhação.
  if (destino.colecao === 'pacientes') {
    const peloMolde = colunas.map((nome, indice) => {
      const m = destinoDoMolde(nome)
      if (!m) return null
      if (m.campo) return { indice, nome, mapeamento: { tipo: 'campo' as const, campo: m.campo } }
      return { indice, nome, mapeamento: { tipo: 'extras' as const } }
    })
    // Só usa o molde se reconhecer a maioria das colunas — senão é outra planilha.
    const reconhecidas = peloMolde.filter(Boolean).length
    if (reconhecidas >= Math.ceil(colunas.length * 0.6)) {
      return peloMolde.map(
        (c, i) => c || { indice: i, nome: colunas[i], mapeamento: { tipo: 'extras' as const } },
      )
    }
  }

  const camposPorNome = new Map<string, DestinoCampo>()
  for (const c of destino.campos) {
    camposPorNome.set(normalizarNome(c.campo), c)
    camposPorNome.set(normalizarNome(c.rotulo), c)
    // Palavras-chave extras por campo (sinônimos comuns de sistemas odontológicos)
    const sinonimos: Record<string, string[]> = {
      nome: ['paciente', 'nome do paciente', 'nome completo', 'cliente', 'nome cliente'],
      telefone: [
        'celular',
        'whatsapp',
        'tel',
        'fone',
        'telefone 1',
        'telefone celular',
        'movel',
        'fone celular',
        'celular 1',
        'contato',
      ],
      email: ['e mail', 'correio', 'mail', 'email principal'],
      data_nascimento: [
        'nascimento',
        'dt nascimento',
        'data nasc',
        'nasc',
        'aniversario',
        'data aniversario',
        'data de nascimento',
      ],
      cpf: ['cpf cliente', 'documento', 'cnpj', 'cpf cnpj'],
      cep: ['codigo postal', 'cep residencial'],
      cidade: ['municipio', 'cidade paciente'],
      uf: ['estado', 'estado uf', 'uf estado'],
      observacoes: [
        'obs',
        'observacao',
        'observacoes',
        'anotacoes',
        'complemento dados',
        'notas',
        'informacoes',
      ],
      endereco: ['rua', 'avenida', 'enderoco', 'logradouro completo', 'endereco completo'],
      origem: ['referencia', 'como chegou', 'como nos conheceu', 'indicacao', 'fonte'],
      numero: ['numero endereco', 'num', 'n'],
    }
    for (const sin of sinonimos[c.campo] || []) camposPorNome.set(normalizarNome(sin), c)
  }

  const usados = new Set<string>()
  return colunas.map((nome, indice) => {
    const chave = normalizarNome(nome)
    let destinoCampo: DestinoCampo | undefined = camposPorNome.get(chave)

    // Correspondência parcial: nome da coluna contém (ou é contido por) um campo
    if (!destinoCampo) {
      for (const [chaveCampo, campo] of camposPorNome) {
        if (!chaveCampo || usados.has(campo.campo)) continue
        if (chave.includes(chaveCampo) || chaveCampo.includes(chave)) {
          destinoCampo = campo
          break
        }
      }
    }

    if (destinoCampo && !usados.has(destinoCampo.campo)) {
      usados.add(destinoCampo.campo)
      return { indice, nome, mapeamento: { tipo: 'campo', campo: destinoCampo.campo } }
    }
    // Sem campo equivalente: guardar em extras (nada descartado)
    return { indice, nome, mapeamento: { tipo: 'extras' } }
  })
}

/** Converte um valor bruto da planilha para o formato que o PocketBase espera. */
export function converterValor(
  bruto: string,
  tipo: DestinoCampo['tipo'],
): { valor: unknown; aviso?: string } {
  const v = String(bruto ?? '').trim()
  if (!v) return { valor: null }

  switch (tipo) {
    case 'telefone': {
      const { telefone, aviso } = normalizarTelefone(v)
      if (!telefone) return { valor: null, aviso: aviso || 'Telefone inválido' }
      return { valor: telefone, aviso }
    }
    case 'cpf': {
      const { cpf, aviso } = normalizarCpf(v)
      if (!cpf) return { valor: null }
      return { valor: cpf, aviso }
    }
    case 'email': {
      const limpo = v.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo))
        return { valor: limpo, aviso: 'E-mail malformatado' }
      return { valor: limpo }
    }
    case 'data':
      return converterData(v)
    case 'cidade':
      return { valor: normalizarCidade(v) || null }
    case 'uf':
      return { valor: normalizarUf(v) || null }
    case 'cep':
      return { valor: normalizarCep(v) || null }
    case 'texto':
      // Corrige acentos quebrados de exportação em qualquer campo de texto
      return { valor: corrigirAcentos(v) }
    case 'numero': {
      // Aceita "1.234,56" e "1234.56"
      const limpo = v.replace(/\s/g, '')
      let num: number
      if (limpo.includes(',')) {
        num = Number(limpo.replace(/\./g, '').replace(',', '.'))
      } else {
        num = Number(limpo)
      }
      if (isNaN(num)) return { valor: null, aviso: 'Número inválido' }
      return { valor: num }
    }
    default:
      return { valor: corrigirAcentos(v) }
  }
}

/** Converte datas em formatos comuns de planilha para "YYYY-MM-DD 00:00:00.000Z". */
export function converterData(bruto: string): { valor: string | null; aviso?: string } {
  const v = String(bruto ?? '').trim()
  if (!v) return { valor: null }

  // Já em ISO (SheetJS com raw=false pode devolver "2020-05-12 00:00:00")
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return { valor: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')} 00:00:00.000Z` }

  // Brasil: DD/MM/YYYY ou DD/MM/YY
  m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    let ano = Number(m[3])
    if (ano < 100) ano += ano > 30 ? 1900 : 2000
    const mes = Number(m[2])
    const dia = Number(m[1])
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { valor: null, aviso: 'Data inválida' }
    return {
      valor: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')} 00:00:00.000Z`,
    }
  }

  // Serial do Excel (número de dias desde 1899-12-30)
  const serial = Number(v)
  if (!isNaN(serial) && serial > 20000 && serial < 60000) {
    const ms = Math.round((serial - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return {
      valor: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')} 00:00:00.000Z`,
    }
  }

  return { valor: null, aviso: 'Data não reconhecida' }
}

export type ProblemaLinha = { coluna: string; mensagem: string }

export interface LinhaConvertida {
  indiceLinha: number
  campos: Record<string, unknown>
  extras: Record<string, string>
  problemas: ProblemaLinha[]
}

/**
 * Converte uma linha (array de strings) usando o mapeamento escolhido.
 * Valida obrigatoriedade e formato, e junta o que sobrou em "extras".
 */
export function converterLinha(
  linha: string[],
  colunas: string[],
  mapeamento: ColunaMapeada[],
  destino: DestinoColecao,
): LinhaConvertida {
  const campos: Record<string, unknown> = {}
  const extras: Record<string, string> = {}
  const problemas: ProblemaLinha[] = []
  const campoPorNome = new Map(destino.campos.map((c) => [c.campo, c]))

  for (const col of mapeamento) {
    const bruto = linha[col.indice] ?? ''
    if (col.mapeamento.tipo === 'ignorar') continue
    if (col.mapeamento.tipo === 'extras') {
      if (String(bruto).trim()) extras[col.nome] = String(bruto).trim()
      continue
    }
    const def = campoPorNome.get(col.mapeamento.campo)
    if (!def) continue
    const { valor, aviso } = converterValor(bruto, def.tipo)
    campos[def.campo] = valor
    if (aviso) problemas.push({ coluna: col.nome, mensagem: aviso })
  }

  for (const def of destino.campos) {
    if (def.obrigatorio && !campos[def.campo]) {
      problemas.push({ coluna: def.rotulo, mensagem: 'Valor obrigatório vazio' })
    }
  }

  return { indiceLinha: -1, campos, extras, problemas }
}
