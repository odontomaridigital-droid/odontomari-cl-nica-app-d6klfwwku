export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'recepcao'
  avatar?: string
  created: string
  updated: string
}

export interface TipoAtendimento {
  id: string
  nome: string
  duracao_minutos: number
  valor_padrao?: number
  descricao?: string
  ativo?: boolean
  created?: string
  updated?: string
}

export interface Paciente {
  id: string
  nome: string
  telefone: string
  email?: string
  data_nascimento?: string
  cpf?: string
  endereco?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  observacoes?: string
  /** Preferência de horário de atendimento */
  preferencia_horario_tipo?: PreferenciaHorarioTipo | ''
  preferencia_horario_de?: string
  preferencia_horario_ate?: string
  preferencia_horario_obs?: string
  /** Como o paciente chegou à clínica (marketing futuro) */
  origem?: string
  origem_complemento?: string
  /** Foto do paciente (arquivo no PocketBase) */
  foto?: string
  created?: string
  updated?: string
}

export type PreferenciaHorarioTipo =
  | 'manha'
  | 'tarde'
  | 'apos17'
  | 'manha_e_tarde'
  | 'faixa'
  | 'livre'

export type ConsultaStatus = 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'faltou'

export interface Consulta {
  id: string
  paciente: string
  tipo_atendimento: string
  data: string // ISO date string or YYYY-MM-DD
  hora_inicio: string // HH:MM
  duracao_minutos: number
  hora_fim: string // HH:MM
  status: ConsultaStatus
  observacoes?: string
  lembrete_enviado?: boolean
  lembrete_data_envio?: string
  lembrete_enviado_por?: string
  created?: string
  updated?: string
  // expanded fields
  expand?: {
    paciente?: Paciente
    tipo_atendimento?: TipoAtendimento
  }
}

export interface Prontuario {
  id: string
  paciente: string
  consulta?: string
  data: string
  procedimentos: string
  anotacoes?: string
  dente_regiao?: string
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    consulta?: Consulta
  }
}

export interface ItemOrcamento {
  procedimento: string
  valor: number
  dente?: string
}

export type OrcamentoStatus = 'aberto' | 'aceito' | 'recusado'

export interface Orcamento {
  id: string
  paciente: string
  data: string
  status: OrcamentoStatus
  itens: ItemOrcamento[]
  valor_total: number
  observacoes?: string
  validade_dias?: number
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
  }
}

export interface BloqueioAgenda {
  id: string
  data: string
  dia_inteiro?: boolean
  hora_inicio?: string
  hora_fim?: string
  motivo?: string
  tipo?: 'bloqueio' | 'desbloqueio_fds'
  created?: string
  updated?: string
}

export interface ClinicaConfig {
  horario_inicio: string
  horario_fim: string
  intervalo_minutos: number
  bloquear_fins_de_semana: boolean
  nome_clinica: string
  telefone_clinica: string
  mensagem_lembrete_padrao: string
  /** Dados do dentista para assinatura de receitas */
  dentista_nome?: string
  dentista_cro?: string
}

import type { RespostasAnamnese } from '@/lib/anamneseModelo'

export interface Anamnese {
  id: string
  paciente: string
  autor?: string
  modelo?: string
  respostas: RespostasAnamnese
  data: string
  created?: string
  updated?: string
  expand?: {
    autor?: User
  }
}

/** Item de medicamento dentro de uma receita emitida */
export interface ItemReceita {
  /** id do medicamento do catálogo, quando escolhido de lá; ausente quando digitado livremente */
  medicamento_id?: string
  nome: string
  apresentacao?: string
  posologia: string
}

export interface Medicamento {
  id: string
  nome: string
  apresentacao?: string
  posologia_padrao?: string
  ativo?: boolean
  created?: string
  updated?: string
}

export type ReceitaOrigem = 'manual' | 'birdid'

export interface Receita {
  id: string
  paciente: string
  autor?: string
  itens: ItemReceita[]
  orientacoes?: string
  origem: ReceitaOrigem
  data: string
  created?: string
  updated?: string
  expand?: {
    autor?: User
  }
}
