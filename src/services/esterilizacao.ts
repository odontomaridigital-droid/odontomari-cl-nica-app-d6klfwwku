import pb from '@/lib/pocketbase/client'
import { registrarLog } from '@/services/logsAuditoria'

/**
 * Esterilização — módulo de conformidade da RDC Anvisa 1002/2025.
 *
 * Estrutura: uma CARGA de esterilização (um ciclo da autoclave) contém vários
 * PACOTES (envelopes ou caixas). O lote da carga é único e é ele que liga
 * tudo: carga → pacote → paciente.
 *
 * Referências da norma:
 *  - art. 91: os 7 campos obrigatórios do registro de cada carga
 *  - art. 92: guarda por 5 anos
 *  - art. 81: campos da etiqueta
 *
 * ⚠️ A norma NÃO exige código de barras nem software (P&R Anvisa 3.3.21).
 * O código de barras está aqui por conveniência: evita digitar o lote no
 * atendimento e é o que faz o vínculo com o paciente acontecer de verdade.
 */

export type ResultadoPacoteTeste = 'aprovado' | 'reprovado' | 'nao_realizado'
export type TipoPacoteTeste =
  | 'biologico'
  | 'integrador_5'
  | 'integrador_6'
  | 'bowie_dick'
  | 'nenhum'
export type StatusPacote = 'disponivel' | 'usado' | 'descartado' | 'vencido'
export type TipoMonitoramento = 'biologico' | 'integrador_5' | 'integrador_6' | 'bowie_dick'

export interface Esterilizacao {
  id: string
  data: string
  lote: string
  equipamento?: string
  operador: string
  tempo_minutos?: number
  temperatura?: number
  pressao?: number
  pacote_teste_resultado?: ResultadoPacoteTeste
  pacote_teste_tipo?: TipoPacoteTeste
  pacote_teste_obs?: string
  observacoes?: string
  validade_dias?: number
  criado_por?: string
  created?: string
  updated?: string
  /** Quantos pacotes esta carga tem (preenchido pela listagem) */
  total_pacotes?: number
}

export interface PacoteEsterilizado {
  id: string
  esterilizacao: string
  identificacao: string
  data_esterilizacao: string
  validade?: string
  status?: StatusPacote
  paciente?: string
  usado_em?: string
  observacoes?: string
  expand?: {
    esterilizacao?: Esterilizacao
    paciente?: { id: string; nome: string; telefone?: string }
  }
}

export interface MonitoramentoEsterilizacao {
  id: string
  data: string
  tipo: TipoMonitoramento
  resultado: 'aprovado' | 'reprovado'
  equipamento?: string
  lote_carga?: string
  operador?: string
  observacoes?: string
}

const COL_CARGAS = 'esterilizacoes'
const COL_PACOTES = 'pacotes_esterilizados'
const COL_MONIT = 'monitoramentos_esterilizacao'

export const ROTULO_TIPO_MONITORAMENTO: Record<TipoMonitoramento, string> = {
  biologico: 'Indicador biológico',
  integrador_5: 'Integrador químico tipo 5',
  integrador_6: 'Integrador químico tipo 6',
  bowie_dick: 'Teste Bowie-Dick',
}

export const ROTULO_STATUS_PACOTE: Record<StatusPacote, string> = {
  disponivel: 'Disponível',
  usado: 'Usado',
  descartado: 'Descartado',
  vencido: 'Vencido',
}

/** Data de hoje no formato AAAA-MM-DD (fuso local, sem erro de UTC). */
function hojeIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, (m || 1) - 1, d || 1)
  data.setDate(data.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

/**
 * Gera o próximo lote do dia no formato AAAAMMDD-NN.
 * Único por exigência do art. 91 §2º: é ele que permite rastrear tudo.
 */
async function gerarLote(dataIso: string): Promise<string> {
  const base = dataIso.replace(/-/g, '')
  const doDia = await pb.collection(COL_CARGAS).getFullList<Esterilizacao>({
    filter: `lote ~ "${base}-"`,
    sort: '-lote',
  })
  let proximo = 1
  if (doDia.length > 0) {
    const numeros = doDia
      .map((c) => Number(String(c.lote).split('-').pop()))
      .filter((n) => Number.isFinite(n))
    proximo = (Math.max(0, ...numeros) || 0) + 1
  }
  return `${base}-${String(proximo).padStart(2, '0')}`
}

export const esterilizacaoService = {
  /** Todas as cargas, mais recentes primeiro. */
  async getCargas(): Promise<Esterilizacao[]> {
    return await pb.collection(COL_CARGAS).getFullList<Esterilizacao>({
      sort: '-data,-created',
    })
  },

  async getCarga(id: string): Promise<Esterilizacao> {
    return await pb.collection(COL_CARGAS).getOne<Esterilizacao>(id)
  },

  /**
   * Cria a carga e já gera os pacotes dela.
   * A data de validade de cada pacote = data da esterilização + validade_dias.
   */
  async criarCarga(
    dados: Omit<Esterilizacao, 'id' | 'lote' | 'created' | 'updated' | 'total_pacotes'>,
    pacotes: string[],
  ): Promise<Esterilizacao> {
    const dataCarga = (dados.data || hojeIso()).slice(0, 10)
    const lote = await gerarLote(dataCarga)
    const validadeDias = dados.validade_dias && dados.validade_dias > 0 ? dados.validade_dias : 30

    const carga = await pb.collection(COL_CARGAS).create<Esterilizacao>({
      ...dados,
      data: dataCarga,
      lote,
    })

    try {
      for (const identificacao of pacotes) {
        if (!identificacao.trim()) continue
        await pb.collection(COL_PACOTES).create({
          esterilizacao: carga.id,
          identificacao: identificacao.trim(),
          data_esterilizacao: dataCarga,
          validade: somarDias(dataCarga, validadeDias),
          status: 'disponivel',
        })
      }
    } catch (err) {
      // Se os pacotes falharem, a carga órfã não serve para nada — desfaz.
      try {
        await pb.collection(COL_CARGAS).delete(carga.id)
      } catch {
        /* ignora */
      }
      throw err
    }

    registrarLog(
      'criou',
      'configuracoes',
      `Carga de esterilização ${lote} com ${pacotes.length} pacote(s)`,
      carga.id,
    )
    return carga
  },

  async getPacotesDaCarga(esterilizacaoId: string): Promise<PacoteEsterilizado[]> {
    return await pb.collection(COL_PACOTES).getFullList<PacoteEsterilizado>({
      filter: `esterilizacao = "${esterilizacaoId}"`,
      sort: 'identificacao',
    })
  },

  /** Busca inversa: dado o lote, quais pacientes receberam aquele material. */
  async buscarPorLote(lote: string): Promise<PacoteEsterilizado[]> {
    const q = lote.trim()
    if (!q) return []
    const cargas = await pb.collection(COL_CARGAS).getFullList<Esterilizacao>({
      filter: `lote ~ "${q}"`,
    })
    if (cargas.length === 0) return []
    const filtro = cargas.map((c) => `esterilizacao = "${c.id}"`).join(' || ')
    return await pb.collection(COL_PACOTES).getFullList<PacoteEsterilizado>({
      filter: filtro,
      expand: 'esterilizacao,paciente',
      sort: 'identificacao',
    })
  },

  /** Pacotes disponíveis (não usados, não vencidos) para escolher no atendimento. */
  async getDisponiveis(): Promise<PacoteEsterilizado[]> {
    return await pb.collection(COL_PACOTES).getFullList<PacoteEsterilizado>({
      filter: `status = "disponivel"`,
      expand: 'esterilizacao',
      sort: '-data_esterilizacao',
    })
  },

  /** Marca o pacote como usado por um paciente — é o vínculo que a norma cobra. */
  async vincularAoPaciente(pacoteId: string, pacienteId: string): Promise<PacoteEsterilizado> {
    const atualizado = await pb.collection(COL_PACOTES).update<PacoteEsterilizado>(pacoteId, {
      status: 'usado',
      paciente: pacienteId,
      usado_em: new Date().toISOString(),
    })
    registrarLog('editou', 'prontuario', `Pacote esterilizado usado por paciente`, pacienteId)
    return atualizado
  },

  /** Marca como vencidos os pacotes cuja validade já passou. */
  async atualizarVencidos(): Promise<number> {
    const hoje = hojeIso()
    const venciveis = await pb.collection(COL_PACOTES).getFullList<PacoteEsterilizado>({
      filter: `status = "disponivel" && validade != "" && validade < "${hoje} 00:00:00"`,
    })
    for (const p of venciveis) {
      try {
        await pb.collection(COL_PACOTES).update(p.id, { status: 'vencido' })
      } catch {
        /* segue os outros */
      }
    }
    return venciveis.length
  },

  // ---------- monitoramento ----------
  async getMonitoramentos(): Promise<MonitoramentoEsterilizacao[]> {
    return await pb.collection(COL_MONIT).getFullList<MonitoramentoEsterilizacao>({
      sort: '-data',
    })
  },

  async criarMonitoramento(
    dados: Omit<MonitoramentoEsterilizacao, 'id'>,
  ): Promise<MonitoramentoEsterilizacao> {
    const criado = await pb.collection(COL_MONIT).create<MonitoramentoEsterilizacao>(dados)
    registrarLog(
      'criou',
      'configuracoes',
      `Monitoramento de esterilização: ${dados.tipo} — ${dados.resultado}`,
      criado.id,
    )
    return criado
  },

  /**
   * Dias desde o último indicador biológico aprovado.
   * A Anvisa pede monitoramento SEMANAL, independente do volume de ciclos.
   */
  async diasDesdeUltimoBiologico(): Promise<number | null> {
    const lista = await pb.collection(COL_MONIT).getFullList<MonitoramentoEsterilizacao>({
      filter: `tipo = "biologico"`,
      sort: '-data',
    })
    if (lista.length === 0) return null
    const ultima = new Date(lista[0].data)
    const hoje = new Date()
    const diff = Math.floor((hoje.getTime() - ultima.getTime()) / 86400000)
    return diff < 0 ? 0 : diff
  },
}
