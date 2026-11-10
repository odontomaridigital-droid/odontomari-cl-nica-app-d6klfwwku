import { Paciente, Consulta, Orcamento } from '@/types'
import { formatDateBr } from '@/lib/formatters'

// =================== OPORTUNIDADES ===================
// Painel de listas de trabalho da recepção, calculadas a partir do histórico
// de consultas e dos planejamentos de tratamento em aberto.

export type TipoOportunidade =
  | 'planejamento_aberto'
  | 'faltou'
  | 'cancelou'
  | 'sem_voltar_6m'
  | 'sem_telefone'

export interface Oportunidade {
  tipo: TipoOportunidade
  pacienteId: string
  pacienteNome: string
  telefone: string
  /** Data de referência do evento (criação do planejamento ou última consulta) */
  dataReferencia: string | undefined
  /** Há quantos dias, arredondado para baixo */
  dias: number
  /** Valor total do planejamento, quando aplicável */
  valorTotal?: number
  /** Rótulo curto exibido na lista, ex.: "Faltou e não retornou" */
  titulo: string
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Converte datas como "2025-03-10 10:00:00.000Z" ou "2025-03-10" em Date (UTC-safe) */
function parseData(valor?: string): Date | null {
  if (!valor) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  }
  const d = new Date(valor.replace(' ', 'T') + (valor.includes('Z') ? '' : 'Z'))
  return isNaN(d.getTime()) ? null : d
}

export function diasDesde(valor?: string): number | null {
  const d = parseData(valor)
  if (!d) return null
  const hoje = new Date()
  const diff = hoje.getTime() - d.getTime()
  return Math.max(0, Math.floor(diff / UM_DIA_MS))
}

export function textoTempoDesde(valor?: string): string {
  const dias = diasDesde(valor)
  if (dias === null) return ''
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  if (meses === 1) return 'há 1 mês'
  if (meses < 12) return `há ${meses} meses`
  const anos = Math.floor(dias / 365)
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`
}

export function tituloLista(tipo: TipoOportunidade): string {
  switch (tipo) {
    case 'planejamento_aberto':
      return 'Planejamentos em aberto'
    case 'faltou':
      return 'Faltaram e não retornaram'
    case 'cancelou':
      return 'Cancelaram e não remarcaram'
    case 'sem_voltar_6m':
      return 'Sem voltar há 6+ meses'
    case 'sem_telefone':
      return 'Sem telefone cadastrado'
  }
}

export function descricaoLista(tipo: TipoOportunidade): string {
  switch (tipo) {
    case 'planejamento_aberto':
      return 'Planejamentos de Tratamento aguardando decisão do paciente'
    case 'faltou':
      return 'Última consulta com falta e nenhuma consulta depois dela'
    case 'cancelou':
      return 'Última consulta cancelada e nenhuma remarcada depois'
    case 'sem_voltar_6m':
      return 'Último atendimento realizado há 6 meses ou mais'
    case 'sem_telefone':
      return 'Cadastre um telefone ou WhatsApp para conseguir contactar'
  }
}

/** Mensagem de WhatsApp pronta, contextual por tipo de oportunidade */
export function mensagemWhatsApp(tipo: TipoOportunidade, nomePaciente: string): string {
  const primeiroNome = nomePaciente.split(' ')[0] || nomePaciente
  switch (tipo) {
    case 'planejamento_aberto':
      return `Olá ${primeiroNome}! Passando para lembrar que o seu Planejamento de Tratamento da Clínica Odontomari está esperando por você. 😊 Queremos cuidar do seu sorriso — posso ajudar a agendar o início do tratamento?`
    case 'faltou':
      return `Olá ${primeiroNome}! Sentimos sua falta na Clínica Odontomari. 💙 Queremos remarcar sua consulta em um horário que fique melhor para você. Posso te ajudar a escolher um novo dia e horário?`
    case 'cancelou':
      return `Olá ${primeiroNome}! Notamos que sua consulta na Clínica Odontomari foi cancelada. Queremos ajudar a remarcá-la em um momento melhor para você. Posso te passar os horários disponíveis?`
    case 'sem_voltar_6m':
      return `Olá ${primeiroNome}! Já faz um tempinho desde sua última visita à Clínica Odontomari. 🦷 Que tal agendar um retorno para cuidar do seu sorriso? Posso verificar os horários disponíveis para você!`
    case 'sem_telefone':
      return `Olá ${primeiroNome}! Estamos atualizando nosso cadastro na Clínica Odontomari. 🦷 Pode me confirmar o seu número de WhatsApp, por favor? Assim conseguimos te avisar de lembretes e novidades.`
  }
}

interface Agrupado {
  pacienteId: string
  maisAntiga: Oportunidade
}

/** Agrupa oportunidades do mesmo tipo/paciente, mantendo a mais antiga (mais urgente) */
function agruparPorPaciente(lista: Oportunidade[]): Oportunidade[] {
  const mapa = new Map<string, Agrupado>()
  for (const op of lista) {
    const key = `${op.tipo}:${op.pacienteId}`
    const existente = mapa.get(key)
    if (!existente || op.dias > existente.maisAntiga.dias) {
      mapa.set(key, { pacienteId: op.pacienteId, maisAntiga: op })
    }
  }
  return [...mapa.values()].map((g) => g.maisAntiga)
}

function ordenarMaisAntigoPrimeiro(lista: Oportunidade[]): Oportunidade[] {
  return [...lista].sort((a, b) => {
    if (b.dias !== a.dias) return b.dias - a.dias
    return a.pacienteNome.localeCompare(b.pacienteNome, 'pt-BR')
  })
}

/**
 * Calcula as listas de oportunidades a partir do histórico de consultas e dos
 * planejamentos em aberto. Um paciente pode aparecer em mais de uma lista.
 */
export function calcularOportunidades(
  pacientes: Paciente[],
  consultas: Consulta[],
  orcamentos: Orcamento[],
): Record<TipoOportunidade, Oportunidade[]> {
  // -------- Consultas por paciente, ordenadas da mais antiga para a mais recente
  const consultasPorPaciente = new Map<string, Consulta[]>()
  for (const c of consultas) {
    const arr = consultasPorPaciente.get(c.paciente) || []
    arr.push(c)
    consultasPorPaciente.set(c.paciente, arr)
  }
  for (const arr of consultasPorPaciente.values()) {
    arr.sort((a, b) => {
      const da = parseData(a.data)?.getTime() ?? 0
      const db = parseData(b.data)?.getTime() ?? 0
      if (da !== db) return da - db
      return (a.hora_inicio || '').localeCompare(b.hora_inicio || '')
    })
  }

  const resultado: Record<TipoOportunidade, Oportunidade[]> = {
    planejamento_aberto: [],
    faltou: [],
    cancelou: [],
    sem_voltar_6m: [],
    sem_telefone: [],
  }

  const nomeDe = (id: string) => pacientes.find((p) => p.id === id)?.nome || ''
  const telefoneDe = (id: string) => pacientes.find((p) => p.id === id)?.telefone || ''

  const adicionar = (
    tipo: TipoOportunidade,
    pacienteId: string,
    dataReferencia: string | undefined,
    valorTotal?: number,
  ) => {
    const nome = nomeDe(pacienteId) || 'Paciente'
    resultado[tipo].push({
      tipo,
      pacienteId,
      pacienteNome: nome,
      telefone: telefoneDe(pacienteId),
      dataReferencia,
      dias: diasDesde(dataReferencia) ?? 0,
      valorTotal,
      titulo: tituloLista(tipo),
    })
  }

  // -------- Funil de venda: planejamentos em aberto
  for (const orc of orcamentos) {
    if (orc.status !== 'aberto') continue
    const valorCalculado = Array.isArray(orc.itens)
      ? orc.itens.reduce((soma, it) => soma + (Number(it?.valor) || 0), 0)
      : 0
    adicionar(
      'planejamento_aberto',
      orc.paciente,
      orc.data || orc.created,
      valorCalculado > 0 ? valorCalculado : orc.valor_total || 0,
    )
  }

  // -------- Funil de agendamento: histórico de consultas
  const hoje = new Date()
  for (const [pacienteId, lista] of consultasPorPaciente) {
    if (lista.length === 0) continue

    const ultima = lista[lista.length - 1]
    const dataUltima = ultima.data || ultima.created
    const ultimaRealizada = [...lista].reverse().find((c) => c.status === 'realizada')

    // Faltou e não retornou: última consulta com status "faltou" e nenhuma depois dela.
    if (ultima.status === 'faltou') {
      adicionar('faltou', pacienteId, dataUltima)
    }

    // Cancelou e não remarcou: última consulta com status "cancelada" e nenhuma depois.
    if (ultima.status === 'cancelada') {
      adicionar('cancelou', pacienteId, dataUltima)
    }

    // Sem voltar há 6+ meses: último atendimento realizado há 6 meses ou mais.
    if (ultimaRealizada) {
      const d = parseData(ultimaRealizada.data || ultimaRealizada.created)
      if (d) {
        const limite = new Date(hoje)
        limite.setMonth(limite.getMonth() - 6)
        if (d.getTime() <= limite.getTime()) {
          adicionar('sem_voltar_6m', pacienteId, ultimaRealizada.data || ultimaRealizada.created)
        }
        // Obs.: "retorno vencido" não tem campo de retorno indicado no modelo de
        // consultas, então essa lista não é calculada (regra da task).
      }
    }
  }

  // -------- Pacientes sem telefone cadastrado
  for (const p of pacientes) {
    if (!(p.telefone || '').trim()) {
      adicionar('sem_telefone', p.id, undefined)
    }
  }

  return {
    planejamento_aberto: ordenarMaisAntigoPrimeiro(resultado.planejamento_aberto),
    faltou: ordenarMaisAntigoPrimeiro(agruparPorPaciente(resultado.faltou)),
    cancelou: ordenarMaisAntigoPrimeiro(agruparPorPaciente(resultado.cancelou)),
    sem_voltar_6m: ordenarMaisAntigoPrimeiro(agruparPorPaciente(resultado.sem_voltar_6m)),
    sem_telefone: ordenarMaisAntigoPrimeiro(resultado.sem_telefone),
  }
}

/** Total de oportunidades — usado no resumo do topo */
export function totalOportunidades(funis: Record<TipoOportunidade, Oportunidade[]>): number {
  return (
    funis.planejamento_aberto.length +
    funis.faltou.length +
    funis.cancelou.length +
    funis.sem_voltar_6m.length +
    funis.sem_telefone.length
  )
}

/** Resumo textual curto para exibir junto ao nome, ex.: "12/03/2025 · há 8 dias" */
export function resumoReferencia(op: Oportunidade): string {
  const data = op.dataReferencia ? formatDateBr(op.dataReferencia) : ''
  const tempo = textoTempoDesde(op.dataReferencia)
  if (data && tempo) return `${data} · ${tempo}`
  return data || tempo || '—'
}
