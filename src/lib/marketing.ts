import { Paciente, Consulta, Orcamento, Campanha, Conteudo } from '@/types'

// =================== MARKETING & VENDAS ===================
// Cálculos usados pela área de marketing do app. Tudo é derivado dos dados que a
// clínica já registra: origem do paciente, consultas, planejamentos e campanhas.

export interface OrigemResumo {
  origem: string
  pacientes: number
  /** % sobre o total de pacientes com origem preenchida */
  percentual: number
  /** Pacientes dessa origem que fecharam ao menos um planejamento aprovado */
  converteram: number
  /** Valor total dos planejamentos aprovados dessa origem */
  receita: number
}

export interface MesNovosPacientes {
  /** YYYY-MM */
  mes: string
  rotulo: string
  total: number
}

export interface CampanhaResumo extends Campanha {
  pacientes: number
  consultas: number
  planejamentos: number
  aprovados: number
  receita: number
  /** Investimento / pacientes captados (null quando não há paciente) */
  custoPorPaciente: number | null
  /** Investimento / receita aprovada (ROI invertido); null sem receita */
  custoPorReal: number | null
  /** (receita - investimento) / investimento em % */
  roi: number | null
}

export interface FunilItem {
  etapa: string
  total: number
  /** % em relação à primeira etapa */
  percentual: number
}

export interface MetricasMarketing {
  totalPacientes: number
  pacientesComOrigem: number
  origens: OrigemResumo[]
  novosPorMes: MesNovosPacientes[]
  campanhas: CampanhaResumo[]
  funil: FunilItem[]
  investimentoTotal: number
  receitaAtribuida: number
  pacientesAtribuidos: number
  custoMedioPorPaciente: number | null
  conteudosPorStatus: Record<string, number>
  /** Sugestões geradas a partir dos próprios números */
  insights: string[]
}

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

/** Normaliza texto para comparar origem de paciente com nome/canal de campanha. */
function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Data no formato da clínica -> Date (UTC-safe) */
function paraData(valor?: string): Date | null {
  if (!valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 12))
  }
  const d = new Date(valor.replace(' ', 'T') + (valor.includes('Z') ? '' : 'Z'))
  return isNaN(d.getTime()) ? null : d
}

function chaveMes(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  return `${MESES_CURTOS[Number(mes) - 1]}/${ano.slice(2)}`
}

/**
 * Calcula todas as métricas da área de marketing.
 * `meses` controla quantos meses de histórico aparecem no gráfico de novos pacientes.
 */
export function calcularMetricasMarketing(
  pacientes: Paciente[],
  consultas: Consulta[],
  orcamentos: Orcamento[],
  campanhas: Campanha[],
  conteudos: Conteudo[],
  meses = 12,
): MetricasMarketing {
  // ---------- Origem dos pacientes ----------
  const porOrigem = new Map<string, Paciente[]>()
  for (const p of pacientes) {
    const chave = (p.origem || 'Não informado').trim() || 'Não informado'
    porOrigem.set(chave, [...(porOrigem.get(chave) || []), p])
  }

  // Planejamentos aprovados por paciente
  const aprovadoPorPaciente = new Map<string, number>()
  for (const orc of orcamentos) {
    if (orc.status !== 'aceito') continue
    const valor = Array.isArray(orc.itens)
      ? orc.itens.reduce((s, it) => s + (Number(it?.valor) || 0), 0)
      : Number(orc.valor_total) || 0
    aprovadoPorPaciente.set(orc.paciente, (aprovadoPorPaciente.get(orc.paciente) || 0) + valor)
  }

  const pacientesComOrigem = pacientes.filter(
    (p) => (p.origem || '').trim() && p.origem !== 'Não informado',
  ).length

  const origens: OrigemResumo[] = [...porOrigem.entries()]
    .map(([origem, lista]) => {
      const converteram = lista.filter((p) => (aprovadoPorPaciente.get(p.id) || 0) > 0).length
      const receita = lista.reduce((s, p) => s + (aprovadoPorPaciente.get(p.id) || 0), 0)
      return {
        origem,
        pacientes: lista.length,
        percentual: pacientes.length ? Math.round((lista.length / pacientes.length) * 100) : 0,
        converteram,
        receita,
      }
    })
    .sort((a, b) => b.pacientes - a.pacientes)

  // ---------- Novos pacientes por mês ----------
  const contagemMes = new Map<string, number>()
  for (const p of pacientes) {
    const d = paraData(p.created)
    if (!d) continue
    const k = chaveMes(d)
    contagemMes.set(k, (contagemMes.get(k) || 0) + 1)
  }
  const chavesOrdenadas = [...contagemMes.keys()].sort()
  const janela = chavesOrdenadas.slice(-meses)
  const novosPorMes: MesNovosPacientes[] = janela.map((mes) => ({
    mes,
    rotulo: rotuloMes(mes),
    total: contagemMes.get(mes) || 0,
  }))

  // ---------- Consultas e planejamentos por paciente ----------
  const consultasPorPaciente = new Map<string, number>()
  for (const c of consultas) {
    consultasPorPaciente.set(c.paciente, (consultasPorPaciente.get(c.paciente) || 0) + 1)
  }
  const planejamentosPorPaciente = new Map<string, number>()
  for (const o of orcamentos) {
    planejamentosPorPaciente.set(o.paciente, (planejamentosPorPaciente.get(o.paciente) || 0) + 1)
  }

  // ---------- Campanhas ----------
  const campanhasResumo: CampanhaResumo[] = campanhas
    .map((camp) => {
      const chaveNome = normalizar(camp.nome)
      const chaveCanal = normalizar(camp.canal)
      const chaveUtm = normalizar(camp.utm || '')

      // Paciente é atribuído quando a origem_complemento cita a campanha,
      // ou quando a origem é exatamente o canal (caso simples).
      const atribuidos = pacientes.filter((p) => {
        const compl = normalizar(p.origem_complemento || '')
        const org = normalizar(p.origem || '')
        if (chaveUtm && compl.includes(chaveUtm)) return true
        if (chaveNome && compl.includes(chaveNome)) return true
        return chaveCanal && org === chaveCanal
      })

      const ids = new Set(atribuidos.map((p) => p.id))
      const consultasAtrib = consultas.filter((c) => ids.has(c.paciente)).length
      const planejamentosAtrib = orcamentos.filter((o) => ids.has(o.paciente)).length
      const receita = atribuidos.reduce((s, p) => s + (aprovadoPorPaciente.get(p.id) || 0), 0)
      const aprovados = atribuidos.filter((p) => (aprovadoPorPaciente.get(p.id) || 0) > 0).length
      const investimento = Number(camp.investimento) || 0

      return {
        ...camp,
        pacientes: atribuidos.length,
        consultas: consultasAtrib,
        planejamentos: planejamentosAtrib,
        aprovados,
        receita,
        custoPorPaciente: atribuidos.length > 0 ? investimento / atribuidos.length : null,
        custoPorReal: receita > 0 ? investimento / receita : null,
        roi: investimento > 0 ? ((receita - investimento) / investimento) * 100 : null,
      }
    })
    .sort((a, b) => b.pacientes - a.pacientes)

  // ---------- Funil ----------
  const pacientesComConsulta = new Set(consultas.map((c) => c.paciente)).size
  const pacientesComPlanejamento = new Set(orcamentos.map((o) => o.paciente)).size
  const pacientesAprovados = new Set(
    orcamentos.filter((o) => o.status === 'aceito').map((o) => o.paciente),
  ).size

  const base = pacientes.length || 1
  const funil: FunilItem[] = [
    { etapa: 'Pacientes cadastrados', total: pacientes.length, percentual: 100 },
    {
      etapa: 'Compareceram à consulta',
      total: pacientesComConsulta,
      percentual: Math.round((pacientesComConsulta / base) * 100),
    },
    {
      etapa: 'Receberam planejamento',
      total: pacientesComPlanejamento,
      percentual: Math.round((pacientesComPlanejamento / base) * 100),
    },
    {
      etapa: 'Aprovaram o tratamento',
      total: pacientesAprovados,
      percentual: Math.round((pacientesAprovados / base) * 100),
    },
  ]

  // ---------- Totais ----------
  const investimentoTotal = campanhas.reduce((s, c) => s + (Number(c.investimento) || 0), 0)
  const receitaAtribuida = campanhasResumo.reduce((s, c) => s + c.receita, 0)
  const pacientesAtribuidos = campanhasResumo.reduce((s, c) => s + c.pacientes, 0)

  const conteudosPorStatus: Record<string, number> = {}
  for (const c of conteudos) {
    conteudosPorStatus[c.status] = (conteudosPorStatus[c.status] || 0) + 1
  }

  // ---------- Insights automáticos ----------
  const insights: string[] = []
  const melhorOrigem = origens.filter((o) => o.pacientes >= 3)[0]
  if (melhorOrigem) {
    insights.push(
      `A origem que mais traz pacientes é "${melhorOrigem.origem}" com ${melhorOrigem.pacientes} pacientes (${melhorOrigem.percentual}% do total).`,
    )
  }
  const semOrigem = porOrigem.get('Não informado')?.length || 0
  if (semOrigem > 0) {
    insights.push(
      `${semOrigem} paciente${semOrigem > 1 ? 's' : ''} sem origem registrada — preencher esse campo é o que permite medir o marketing.`,
    )
  }
  const comInvestimento = campanhasResumo.filter((c) => (Number(c.investimento) || 0) > 0)
  const melhorRoi = comInvestimento
    .filter((c) => c.roi !== null)
    .sort((a, b) => (b.roi || 0) - (a.roi || 0))[0]
  if (melhorRoi && (melhorRoi.roi || 0) > 0) {
    insights.push(
      `A campanha com melhor retorno é "${melhorRoi.nome}": R$ ${melhorRoi.receita.toFixed(0)} em tratamentos aprovados para R$ ${(Number(melhorRoi.investimento) || 0).toFixed(0)} investidos.`,
    )
  }
  if (funil[1].percentual < 70 && pacientes.length >= 5) {
    insights.push(
      `Só ${funil[1].percentual}% dos pacientes cadastrados chegaram a uma consulta — vale revisar o contato inicial.`,
    )
  }
  if (funil[3].percentual > 0) {
    const taxaAprovacao = funil[2].total ? Math.round((funil[3].total / funil[2].total) * 100) : 0
    insights.push(
      `Taxa de aprovação dos planejamentos: ${taxaAprovacao}% de quem recebeu proposta fechou o tratamento.`,
    )
  }
  const publicados = conteudosPorStatus['publicado'] || 0
  const emProducao = conteudos.filter((c) =>
    ['ideia', 'roteiro', 'gravacao', 'edicao', 'aprovacao'].includes(c.status),
  ).length
  if (publicados || emProducao) {
    insights.push(
      `Conteúdo: ${publicados} publicado${publicados === 1 ? '' : 's'} e ${emProducao} em produção.`,
    )
  }

  return {
    totalPacientes: pacientes.length,
    pacientesComOrigem,
    origens,
    novosPorMes,
    campanhas: campanhasResumo,
    funil,
    investimentoTotal,
    receitaAtribuida,
    pacientesAtribuidos,
    custoMedioPorPaciente: pacientesAtribuidos > 0 ? investimentoTotal / pacientesAtribuidos : null,
    conteudosPorStatus,
    insights,
  }
}

export const ROTULOS_STATUS_CONTEUDO: Record<string, string> = {
  ideia: 'Ideia',
  roteiro: 'Roteiro',
  gravacao: 'Gravação',
  edicao: 'Edição',
  aprovacao: 'Aprovação',
  agendado: 'Agendado',
  publicado: 'Publicado',
}

export const ROTULOS_CANAL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  google: 'Google',
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  panfleto: 'Panfleto',
  radio: 'Rádio',
  evento: 'Evento',
  site: 'Site',
  outro: 'Outro',
}

export const ROTULOS_STATUS_CAMPANHA: Record<string, string> = {
  planejada: 'Planejada',
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
}

export const ROTULOS_FORMATO: Record<string, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  post: 'Post',
  story: 'Story',
  video: 'Vídeo',
  blog: 'Blog',
  email: 'E-mail',
  outro: 'Outro',
}
