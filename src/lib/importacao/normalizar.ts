/**
 * Correção de texto corrompido na exportação de planilhas antigas.
 *
 * Alguns sistemas (o Dentista Organizado é um deles) exportam o .xlsx com os
 * acentos quebrados: o caractere acentuado virou "A" seguido do símbolo que
 * restou na conversão. Ex.: "JosA©" é "José", "GonA§alves" é "Gonçalves".
 *
 * A tabela abaixo cobre os casos observados nas 570 linhas do backup real.
 * A correção é conservadora: só troca quando a sequência "A + símbolo" aparece,
 * que não ocorre em texto legítimo em português.
 */
const CORRECOES: Record<string, string> = {
  'A©': 'é',
  'A§': 'ç',
  'A£': 'ã',
  'A¡': 'á',
  'A´': 'ó',
  'A¢': 'â',
  'A‰': 'É',
  '\u00ad': 'í', // soft hyphen usado no lugar do acento
  'A\u00a8': 'ê',
  Aª: 'ê',
  Aµ: 'õ',
}

/** Indica se um texto tem sinal de corrupção de acento. */
export function temAcentoCorrompido(valor: string): boolean {
  if (!valor) return false
  return /A[©§£¡´¢‰\u00a8ªµ]|\u00ad/.test(valor)
}

/**
 * Conserta acentos quebrados de exportação. Texto sem sinal de corrupção
 * volta exatamente como veio.
 */
export function corrigirAcentos(valor: string): string {
  let texto = String(valor ?? '')
  if (!texto || !temAcentoCorrompido(texto)) return texto
  for (const [errado, certo] of Object.entries(CORRECOES)) {
    texto = texto.split(errado).join(certo)
  }
  return texto
}

/**
 * Normaliza o nome de uma cidade para comparação e relatório.
 * Corrige acentos quebrados, padroniza a caixa e resolve abreviações comuns
 * de exportação (ex.: "America" e "Americana" são a mesma cidade).
 */
export function normalizarCidade(valor: string): string {
  let c = corrigirAcentos(String(valor ?? '')).trim()
  if (!c) return ''
  // Caixa alta em cada palavra, preservando preposições
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  c = c
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')

  // Abreviações conhecidas na região da clínica
  const equivalentes: Record<string, string> = {
    America: 'Americana',
    'Santa Barbara Doeste': "Santa Bárbara d'Oeste",
    'Santa Barbara DOeste': "Santa Bárbara d'Oeste",
    'Santa Barbara': "Santa Bárbara d'Oeste",
  }
  return equivalentes[c] || c
}

/**
 * Normaliza UF: aceita "SP", "São Paulo", "Sao Paulo".
 */
export function normalizarUf(valor: string): string {
  const v = corrigirAcentos(String(valor ?? '')).trim()
  if (!v) return ''
  if (v.length === 2) return v.toUpperCase()
  const mapa: Record<string, string> = {
    'Sao Paulo': 'SP',
    'Rio De Janeiro': 'RJ',
    'Minas Gerais': 'MG',
    Parana: 'PR',
    'Santa Catarina': 'SC',
    'Rio Grande Do Sul': 'RS',
    Bahia: 'BA',
    Goias: 'GO',
  }
  const chave = v
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) =>
      i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ')
  return mapa[chave] || v.toUpperCase()
}

/**
 * Normaliza telefone brasileiro para só dígitos, no formato com DDD.
 *
 * Trata os casos reais do backup:
 * - "19 9 9225-2914"  -> 11 dígitos (espaço no meio do número)
 * - "19 9 99115-2384" -> 12 dígitos, com um 9 a mais por digitação
 * - "19  98996-7754"  -> 11 dígitos (espaço duplo)
 * - "995641901"       -> 9 dígitos, faltando o DDD
 * - "19"              -> inválido (só o DDD)
 *
 * Devolve { telefone, aviso } — telefone vazio quando não dá para recuperar.
 */
export function normalizarTelefone(bruto: string): { telefone: string; aviso?: string } {
  const original = String(bruto ?? '').trim()
  let d = original.replace(/\D/g, '')
  if (!d) return { telefone: '' }

  // Só o DDD ou dígitos insuficientes: não é telefone útil
  if (d.length <= 2) return { telefone: '', aviso: 'Telefone incompleto (só DDD)' }

  // 9 dígitos: celular sem DDD. Assume DDD 19 (região da clínica).
  if (d.length === 9) {
    return { telefone: `19${d}`, aviso: 'Sem DDD — assumido 19' }
  }

  // 12 dígitos: DDD + 9 + 9 dígitos (o 9 duplicado é erro de digitação comum)
  if (d.length === 12) {
    // 19 9 99115-2384 -> 19 + 9991152384 (10) = 12. Remove o 9 extra após o DDD.
    const ddd = d.slice(0, 2)
    const resto = d.slice(2)
    // Celular válido tem 9 dígitos e começa com 9
    if (resto.length === 10 && resto.startsWith('9')) {
      // tira o primeiro dígito (o 9 duplicado) mantendo o segundo bloco
      const semDuplicado = resto.slice(1)
      if (semDuplicado.startsWith('9')) {
        return { telefone: `${ddd}${semDuplicado}`, aviso: 'Dígito 9 duplicado removido' }
      }
    }
    return { telefone: d, aviso: 'Telefone com 12 dígitos' }
  }

  if (d.length === 10 || d.length === 11) {
    return { telefone: d }
  }

  if (d.length > 12) {
    // Provável prefixo de operadora ou DDI: tenta os últimos 11
    const ultimos = d.slice(-11)
    if (ultimos.length === 11) {
      return { telefone: ultimos, aviso: 'Prefixo extra removido' }
    }
    return { telefone: d, aviso: 'Telefone com muitos dígitos' }
  }

  return { telefone: d, aviso: 'Telefone fora do padrão' }
}

/**
 * Normaliza o nome de uma coluna para comparação (sem acento, minúsculo).
 * Mantido com o nome original porque o wizard de importação já o utiliza.
 */
export function normalizarNome(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Normaliza CPF: só dígitos; devolve vazio se não tiver 11. */
export function normalizarCpf(bruto: string): { cpf: string; aviso?: string } {
  const d = String(bruto ?? '').replace(/\D/g, '')
  if (!d) return { cpf: '' }
  if (d.length !== 11) return { cpf: d, aviso: 'CPF não tem 11 dígitos' }
  return { cpf: d }
}

/** Normaliza CEP: 8 dígitos com hífen, como a clínica usa. */
export function normalizarCep(bruto: string): string {
  const d = String(bruto ?? '').replace(/\D/g, '')
  if (d.length !== 8) return String(bruto ?? '').trim()
  return `${d.slice(0, 5)}-${d.slice(5)}`
}
