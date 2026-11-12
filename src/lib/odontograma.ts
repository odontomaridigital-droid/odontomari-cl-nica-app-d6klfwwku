// Modelo do odontograma: nomenclatura FDI (ISO 3950) e catálogo de condições.
// Dentes permanentes: 11-18, 21-28, 31-38, 41-48.
// Numeração exibida ao paciente: 1º ao 8º dente de cada quadrante.

export type CondicaoDente =
  | 'higido'
  | 'carie'
  | 'restaurado'
  | 'tratamento_endodontico'
  | 'coroa'
  | 'implante'
  | 'protese'
  | 'fratura'
  | 'ausente'
  | 'extrair'
  | 'selante'
  | 'em_tratamento'

export type FaceDente = 'oclusal' | 'mesial' | 'distal' | 'vestibular' | 'lingual'

export interface CondicaoInfo {
  id: CondicaoDente
  label: string
  /** Cor do preenchimento no mapa */
  cor: string
  /** Cor do texto sobre a cor */
  texto: string
  /** Abreviação usada dentro do dente (quando couber) */
  sigla: string
}

export const CONDICOES: CondicaoInfo[] = [
  { id: 'higido', label: 'Hígido (saudável)', cor: '#fffdf7', texto: '#334155', sigla: '' },
  { id: 'carie', label: 'Cárie', cor: '#dc2626', texto: '#ffffff', sigla: 'C' },
  { id: 'restaurado', label: 'Restaurado', cor: '#2563eb', texto: '#ffffff', sigla: 'R' },
  {
    id: 'tratamento_endodontico',
    label: 'Tratamento de canal',
    cor: '#7c3aed',
    texto: '#ffffff',
    sigla: 'TC',
  },
  { id: 'coroa', label: 'Coroa', cor: '#d97706', texto: '#ffffff', sigla: 'CO' },
  { id: 'implante', label: 'Implante', cor: '#059669', texto: '#ffffff', sigla: 'IM' },
  { id: 'protese', label: 'Prótese', cor: '#0891b2', texto: '#ffffff', sigla: 'PR' },
  { id: 'fratura', label: 'Fratura', cor: '#ea580c', texto: '#ffffff', sigla: 'F' },
  { id: 'ausente', label: 'Ausente / extraído', cor: '#94a3b8', texto: '#ffffff', sigla: 'X' },
  { id: 'extrair', label: 'Indicado para extração', cor: '#b91c1c', texto: '#ffffff', sigla: 'EX' },
  { id: 'selante', label: 'Selante', cor: '#0d9488', texto: '#ffffff', sigla: 'S' },
  { id: 'em_tratamento', label: 'Em tratamento', cor: '#eab308', texto: '#1f2937', sigla: 'ET' },
]

export const CONDICAO_POR_ID: Record<CondicaoDente, CondicaoInfo> = CONDICOES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<CondicaoDente, CondicaoInfo>,
)

export const FACES: { id: FaceDente; label: string }[] = [
  { id: 'oclusal', label: 'Oclusal / incisal' },
  { id: 'mesial', label: 'Mesial' },
  { id: 'distal', label: 'Distal' },
  { id: 'vestibular', label: 'Vestibular' },
  { id: 'lingual', label: 'Lingual / palatina' },
]

/** Quadrantes do arco superior (1 e 2) e inferior (3 e 4), ordem de exibição na tela. */
export const QUADRANTES_SUPERIOR = [
  { id: 1, dentes: [18, 17, 16, 15, 14, 13, 12, 11] },
  { id: 2, dentes: [21, 22, 23, 24, 25, 26, 27, 28] },
]

export const QUADRANTES_INFERIOR = [
  { id: 4, dentes: [48, 47, 46, 45, 44, 43, 42, 41] },
  { id: 3, dentes: [31, 32, 33, 34, 35, 36, 37, 38] },
]

export const TODOS_OS_DENTES: number[] = [
  ...QUADRANTES_SUPERIOR.flatMap((q) => q.dentes),
  ...QUADRANTES_INFERIOR.flatMap((q) => q.dentes),
]

/** Nome do dente para leitura humana, ex.: 18 -> "18 - 3º molar superior direito" */
const NOMES_DENTE: Record<number, string> = {
  11: 'Incisivo central superior direito',
  12: 'Incisivo lateral superior direito',
  13: 'Canino superior direito',
  14: '1º pré-molar superior direito',
  15: '2º pré-molar superior direito',
  16: '1º molar superior direito',
  17: '2º molar superior direito',
  18: '3º molar (siso) superior direito',
  21: 'Incisivo central superior esquerdo',
  22: 'Incisivo lateral superior esquerdo',
  23: 'Canino superior esquerdo',
  24: '1º pré-molar superior esquerdo',
  25: '2º pré-molar superior esquerdo',
  26: '1º molar superior esquerdo',
  27: '2º molar superior esquerdo',
  28: '3º molar (siso) superior esquerdo',
  31: 'Incisivo central inferior esquerdo',
  32: 'Incisivo lateral inferior esquerdo',
  33: 'Canino inferior esquerdo',
  34: '1º pré-molar inferior esquerdo',
  35: '2º pré-molar inferior esquerdo',
  36: '1º molar inferior esquerdo',
  37: '2º molar inferior esquerdo',
  38: '3º molar (siso) inferior esquerdo',
  41: 'Incisivo central inferior direito',
  42: 'Incisivo lateral inferior direito',
  43: 'Canino inferior direito',
  44: '1º pré-molar inferior direito',
  45: '2º pré-molar inferior direito',
  46: '1º molar inferior direito',
  47: '2º molar inferior direito',
  48: '3º molar (siso) inferior direito',
}

export function nomeDente(dente: number): string {
  return NOMES_DENTE[dente] || `Dente ${dente}`
}

/** Resumo textual de uma condição para o histórico e o PDF. */
export function resumoCondicao(
  dente: number,
  condicao: CondicaoDente,
  faces?: FaceDente[],
): string {
  const info = CONDICAO_POR_ID[condicao]
  const listaFaces = (faces || []).map((f) => FACES.find((x) => x.id === f)?.label || f).join(', ')
  return `${dente} — ${info?.label || condicao}${listaFaces ? ` (${listaFaces})` : ''}`
}

/** Contagem por condição, usada no resumo do topo do odontograma. */
export function contarPorCondicao(
  estados: { dente: number; condicao: CondicaoDente }[],
): Record<string, number> {
  const contagem: Record<string, number> = {}
  for (const e of estados) {
    contagem[e.condicao] = (contagem[e.condicao] || 0) + 1
  }
  return contagem
}
