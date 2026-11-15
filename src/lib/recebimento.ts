import { Maquina, CondicaoPagamento, ContaReceber, FormaLancamento } from '@/types'
import { addDays, hojeIso } from '@/lib/datas'

/**
 * Regras do contas a receber — decididas pelo dono em 2026-11-15:
 *
 * · Cartão (crédito/débito): NÃO gera uma conta por parcela. O dinheiro cai
 *   tudo de uma vez na data de repasse da máquina, então é UM lançamento, no
 *   valor líquido (venda menos taxa). A quantidade de parcelas fica guardada
 *   no planejamento, como informação.
 *
 * · PIX e dinheiro: um lançamento único, no dia.
 *
 * · Cheque: um lançamento por cheque, na data de compensação informada.
 *
 * · Boleto e outros parcelados: uma conta por parcela, cada uma no seu
 *   vencimento — é o que o dono pediu ("cada um no seu vencimento por parcela").
 */
export interface PlanoRecebimento {
  descricao: string
  valor: number
  valor_liquido: number
  taxa_percentual: number
  parcela: number
  total_parcelas: number
  vencimento: string
}

interface Entrada {
  valorTotal: number
  condicao: CondicaoPagamento
  maquina?: Maquina
  /** Data do aceite/fechamento, base para os cálculos */
  dataBase: string
  /** Número de parcelas escolhido (cartão, boleto, cheque) */
  numParcelas?: number
  /** Datas de compensação quando é cheque (uma por cheque) */
  datasCompensacao?: string[]
}

/** Escolhe o prazo de repasse da máquina conforme a modalidade. */
export function diasDeRepasse(maquina: Maquina, tipo: string): number {
  switch (tipo) {
    case 'cartao_debito':
      return maquina.dias_debito ?? 1
    case 'cartao_credito':
      return maquina.dias_credito_parcelado ?? maquina.dias_credito_vista ?? 30
    case 'pix':
      return maquina.dias_pix ?? 0
    default:
      return 0
  }
}

/** Escolhe a taxa da máquina conforme a modalidade. Ausente = sem taxa. */
export function taxaDaModalidade(maquina: Maquina, tipo: string, parcelado: boolean): number {
  if (tipo === 'cartao_debito') return maquina.taxa_debito ?? 0
  if (tipo === 'cartao_credito') {
    return parcelado
      ? (maquina.taxa_credito_parcelado ?? maquina.taxa_credito_vista ?? 0)
      : (maquina.taxa_credito_vista ?? 0)
  }
  if (tipo === 'pix') return maquina.taxa_pix ?? 0
  return 0
}

/**
 * Monta a lista de contas a receber de um planejamento.
 * Devolve o que deve ser criado, sem gravar — quem grava é o serviço.
 */
export function montarPlanoRecebimento(entrada: Entrada): PlanoRecebimento[] {
  const { valorTotal, condicao, maquina, dataBase } = entrada
  const tipo = condicao.tipo
  const parcelas = Math.max(1, Number(entrada.numParcelas) || 1)
  const forma: FormaLancamento = condicao.forma_lancamento

  // ---------- CARTÃO e PIX/dinheiro: um lançamento só ----------
  if (
    tipo === 'cartao_credito' ||
    tipo === 'cartao_debito' ||
    tipo === 'pix' ||
    tipo === 'dinheiro'
  ) {
    const dias = maquina ? diasDeRepasse(maquina, tipo) : 0
    const parcelado = tipo === 'cartao_credito' && parcelas > 1
    const taxaPct = maquina ? taxaDaModalidade(maquina, tipo, parcelado) : 0
    const liquido = Math.round(valorTotal * (1 - taxaPct / 100) * 100) / 100

    const rotulo =
      tipo === 'cartao_credito'
        ? `Cartão de crédito${parcelado ? ` ${parcelas}x` : ' à vista'}`
        : tipo === 'cartao_debito'
          ? 'Cartão de débito'
          : tipo === 'pix'
            ? 'PIX'
            : 'Dinheiro'

    return [
      {
        descricao: `${rotulo}${maquina ? ` — ${maquina.nome}` : ''}`,
        valor: valorTotal,
        valor_liquido: liquido,
        taxa_percentual: taxaPct,
        parcela: 1,
        total_parcelas: 1,
        vencimento: addDays(dataBase, dias),
      },
    ]
  }

  // ---------- CHEQUE: um por cheque, na compensação ----------
  if (tipo === 'cheque') {
    const datas = entrada.datasCompensacao || []
    const quantidade = Math.max(parcelas, datas.length || 1)
    const valorCada = Math.round((valorTotal / quantidade) * 100) / 100
    return Array.from({ length: quantidade }).map((_, i) => ({
      descricao: `Cheque ${i + 1}/${quantidade}`,
      valor: valorCada,
      valor_liquido: valorCada,
      taxa_percentual: 0,
      parcela: i + 1,
      total_parcelas: quantidade,
      // Sem data informada, cai mês a mês a partir da base.
      vencimento: datas[i] || addDays(dataBase, 30 * (i + 1)),
    }))
  }

  // ---------- BOLETO e demais: uma por parcela ----------
  if (forma === 'por_parcela' && parcelas > 1) {
    const valorCada = Math.round((valorTotal / parcelas) * 100) / 100
    const ultima = Math.round((valorTotal - valorCada * (parcelas - 1)) * 100) / 100
    return Array.from({ length: parcelas }).map((_, i) => ({
      descricao: `${condicao.nome} ${i + 1}/${parcelas}`,
      valor: i === parcelas - 1 ? ultima : valorCada,
      valor_liquido: i === parcelas - 1 ? ultima : valorCada,
      taxa_percentual: 0,
      parcela: i + 1,
      total_parcelas: parcelas,
      vencimento: addDays(dataBase, 30 * (i + 1)),
    }))
  }

  // ---------- À vista, sem máquina ----------
  return [
    {
      descricao: condicao.nome,
      valor: valorTotal,
      valor_liquido: valorTotal,
      taxa_percentual: 0,
      parcela: 1,
      total_parcelas: 1,
      vencimento: dataBase || hojeIso(),
    },
  ]
}
