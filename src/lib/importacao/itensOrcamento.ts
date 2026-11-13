import { LinhaConvertida } from './mapeamento'
import { corrigirAcentos } from './normalizar'

/**
 * Importação da aba "Itens do Orcamento" do Dentista Organizado.
 *
 * Esta aba tem três colunas chamadas "nome" (paciente, procedimento) e o
 * vínculo com o orçamento pelo campo `orcamento_id`. Ela é lida por POSIÇÃO.
 *
 * Estratégia: os itens de cada orçamento são agrupados por `orcamento_id` e
 * gravados juntos no campo JSON `itens` do orçamento correspondente. O orçamento
 * é localizado pelo número antigo, que fica guardado em `extras.orcamento_antigo`.
 */

/** Colunas fixas da aba "Itens do Orcamento". */
export const COLUNAS_ITENS = {
  orcamentoId: 0,
  titulo: 1,
  dataCriacao: 2,
  dataAprovacao: 3,
  status: 4,
  valorTotal: 5,
  paciente: 6,
  dente: 7,
  face: 8,
  valor: 9,
  procedimento: 10,
} as const

export interface ItemOrcamentoAntigo {
  procedimento: string
  valor: number
  dente: string
  face: string
}

export interface GrupoItensOrcamento {
  /** Número do orçamento no sistema antigo */
  orcamentoAntigo: string
  /** Nome do paciente como está na aba (para conferência) */
  paciente: string
  /** Título do planejamento */
  titulo: string
  itens: ItemOrcamentoAntigo[]
  /** Soma dos valores dos itens */
  total: number
}

/** Reconhece a aba de itens pelos cabeçalhos (tolerante a acento e caixa). */
export function reconheceAbaItens(colunas: string[]): boolean {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]+/g, ' ')
      .trim()
  const alvo = colunas.map(norm)
  return (
    alvo.includes('orcamento id') &&
    alvo.includes('dente') &&
    alvo.includes('face') &&
    alvo.includes('valor total')
  )
}

/** Converte um valor monetário em texto ("1.750,00" ou "1750") para número. */
function paraNumero(bruto: unknown): number {
  const s = String(bruto ?? '').trim()
  if (!s) return 0
  const limpo = s.replace(/\s/g, '')
  if (limpo.includes(',')) {
    return Number(limpo.replace(/\./g, '').replace(',', '.')) || 0
  }
  return Number(limpo) || 0
}

/**
 * Agrupa as linhas da aba de itens por orçamento.
 * Linhas sem `orcamento_id` ou sem procedimento são descartadas e contadas.
 */
export function agruparItensPorOrcamento(linhas: string[][]): {
  grupos: GrupoItensOrcamento[]
  descartes: Record<string, number>
} {
  const c = COLUNAS_ITENS
  const mapa = new Map<string, GrupoItensOrcamento>()
  const descartes: Record<string, number> = {}
  const descartar = (motivo: string) => {
    descartes[motivo] = (descartes[motivo] || 0) + 1
  }

  for (const linha of linhas) {
    const orcamentoAntigo = String(linha[c.orcamentoId] ?? '').trim()
    const procedimento = corrigirAcentos(String(linha[c.procedimento] ?? '').trim())

    if (!orcamentoAntigo) {
      descartar('sem número de orçamento')
      continue
    }
    if (!procedimento) {
      descartar('sem procedimento')
      continue
    }

    const paciente = corrigirAcentos(String(linha[c.paciente] ?? '').trim())
    const titulo = corrigirAcentos(String(linha[c.titulo] ?? '').trim())
    const dente = String(linha[c.dente] ?? '').trim()
    const face = String(linha[c.face] ?? '')
      .trim()
      .toUpperCase()
    const valor = paraNumero(linha[c.valor])

    let grupo = mapa.get(orcamentoAntigo)
    if (!grupo) {
      grupo = { orcamentoAntigo, paciente, titulo, itens: [], total: 0 }
      mapa.set(orcamentoAntigo, grupo)
    }
    grupo.itens.push({ procedimento, valor, dente, face })
    grupo.total += valor
  }

  // Ordena os itens de cada grupo por procedimento, para leitura estável
  for (const g of mapa.values()) {
    g.itens.sort((a, b) => a.procedimento.localeCompare(b.procedimento, 'pt-BR'))
    g.total = Math.round(g.total * 100) / 100
  }

  return { grupos: [...mapa.values()], descartes }
}

/**
 * Converte os grupos em linhas prontas para a gravação de orçamentos.
 * Cada grupo vira UMA linha: o orçamento com a lista completa de itens.
 *
 * O campo `paciente` leva o nome (a gravação resolve para o id) e
 * `orcamento_antigo` permite casar com um orçamento já importado.
 */
export function converterOrcamentosComItens(grupos: GrupoItensOrcamento[]): LinhaConvertida[] {
  return grupos.map((g, i) => {
    const campos: Record<string, unknown> = {
      paciente: g.paciente,
      status: 'aberto',
      valor_total: g.total,
      itens: g.itens,
    }
    // O título vira observação quando é informativo (nem todo é genérico)
    if (g.titulo) campos.observacoes = g.titulo

    return {
      indiceLinha: i,
      campos,
      extras: { orcamento_antigo: g.orcamentoAntigo },
      problemas: g.paciente ? [] : [{ coluna: 'Paciente', mensagem: 'Sem nome de paciente' }],
    }
  })
}
