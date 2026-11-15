export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'recepcao'
  avatar?: string
  created: string
  updated: string
}

/**
 * Tipo de atendimento = como a agenda abre o horário (avaliação, retorno,
 * urgência). Tem duração, não tem preço: o valor vem do procedimento feito.
 */
export interface TipoAtendimento {
  id: string
  nome: string
  duracao_minutos: number
  descricao?: string
  /** Retorno sugerido em dias ao usar este tipo */
  retorno_dias_padrao?: number
  ativo?: boolean
  created?: string
  updated?: string
}

export type ProcedimentoCategoria =
  | 'diagnostico'
  | 'preventivo'
  | 'restaurador'
  | 'endodontia'
  | 'periodontia'
  | 'cirurgia'
  | 'implante'
  | 'protese'
  | 'estetica'
  | 'harmonizacao'
  | 'outro'

/**
 * Procedimento clínico = o que se faz e se cobra (coroa, implante,
 * endodontia). Vive no orçamento e no prontuário, e é o que tem valor.
 */
export interface Procedimento {
  id: string
  nome: string
  categoria: ProcedimentoCategoria
  valor?: number
  codigo?: string
  observacoes?: string
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
  /** Colunas de planilha importada sem campo próprio no banco (nada é descartado) */
  extras?: Record<string, unknown> | null
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
  /** Prazo clínico de retorno em dias, definido no atendimento */
  retorno_dias?: number
  /** Data calculada de retorno (data + retorno_dias) */
  retorno_data?: string
  /** Marca que o paciente já retornou (sai da lista de vencidos) */
  retorno_cumprido?: boolean
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    consulta?: Consulta
  }
}

/**
 * Estado de um dente no odontograma de UM planejamento de tratamento.
 * O mesmo paciente pode ter vários planejamentos, cada um com seu mapa.
 */
export interface OdontogramaRegistro {
  id: string
  /** Planejamento dono deste mapa */
  orcamento: string
  /** Mantido para consulta e histórico */
  paciente?: string
  dente: number
  condicao: string
  faces?: string[]
  observacao?: string
  registrado_por?: string
  data: string
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    registrado_por?: User
  }
}

/** Modelo de receita pronto (pós-cirúrgico, antibiótico, analgésico...) */
export interface ReceitaModelo {
  id: string
  nome: string
  categoria: string
  descricao?: string
  itens: ItemReceita[]
  orientacoes?: string
  ativo?: boolean
  created?: string
  updated?: string
}

/** Campanha de marketing da clínica */
export interface Campanha {
  id: string
  nome: string
  canal: string
  status: string
  inicio?: string
  fim?: string
  investimento?: number
  objetivo?: string
  publico?: string
  observacoes?: string
  utm?: string
  responsavel?: string
  created?: string
  updated?: string
}

/** Item da pauta de conteúdo combinada com o produtor */
export interface Conteudo {
  id: string
  titulo: string
  formato: string
  canal: string
  status: string
  tema?: string
  publico_alvo?: string
  data_publicacao?: string
  link?: string
  observacoes?: string
  campanha?: string
  responsavel?: string
  created?: string
  updated?: string
  expand?: {
    campanha?: Campanha
  }
}

/** Modelo de anamnese editável pela dentista */
export interface AnamneseModelo {
  id: string
  nome: string
  descricao?: string
  /** Array de seções com questões (mesma forma de ANAMNESE_SECOES) */
  secoes: unknown
  ativo?: boolean
  padrao?: boolean
  created?: string
  updated?: string
}

/** Modelo de documento (cuidados pós-cirúrgicos, orientações, atestado...) */
export interface DocumentoModelo {
  id: string
  titulo: string
  categoria: string
  /** Corpo com placeholders: {paciente}, {primeiro_nome}, {data}, {clinica}, {dentista}, {cro}, {procedimento} */
  corpo: string
  ativo?: boolean
  created?: string
  updated?: string
}

/** Documento já emitido para um paciente, com o texto final congelado */
export interface DocumentoEmitido {
  id: string
  paciente: string
  modelo?: string
  titulo: string
  categoria: string
  corpo: string
  autor?: string
  data: string
  enviado_em?: string
  enviado_canal?: string
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    autor?: User
  }
}

export interface ItemOrcamento {
  procedimento: string
  valor: number
  dente?: string
  /** id do procedimento do catálogo, quando escolhido de lá */
  procedimento_id?: string
}

/**
 * Situação do planejamento:
 * aberto     → criado, aguardando o paciente decidir
 * aceito     → paciente aprovou (recepção ou dentista registra)
 * concluido  → tratamento executado
 * recusado   → paciente não aceitou (mantido porque a informação existe)
 */
export type OrcamentoStatus = 'aberto' | 'aceito' | 'concluido' | 'recusado'

export interface Orcamento {
  id: string
  paciente: string
  data: string
  status: OrcamentoStatus
  itens: ItemOrcamento[]
  valor_total: number
  observacoes?: string
  validade_dias?: number
  /** Data em que o paciente aceitou */
  aceito_em?: string
  /** Quem registrou o aceite */
  aceito_por?: string
  /** Data em que o tratamento foi concluído */
  concluido_em?: string
  /** Como o paciente paga (dinheiro, PIX, cartão, cheque...) */
  condicao_pagamento?: string
  /** Máquina usada, quando for cartão */
  maquina?: string
  /** Em quantas parcelas */
  num_parcelas?: number
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    aceito_por?: User
    condicao_pagamento?: CondicaoPagamento
    maquina?: Maquina
  }
}

/** Máquina de cartão (adquirente), com prazo de repasse e taxa por modalidade */
export interface Maquina {
  id: string
  nome: string
  ativo?: boolean
  /** Dias até o dinheiro cair. 0 = mesmo dia */
  dias_debito?: number
  dias_credito_vista?: number
  dias_credito_parcelado?: number
  dias_pix?: number
  /** Taxa em % descontada pela máquina */
  taxa_debito?: number
  taxa_credito_vista?: number
  taxa_credito_parcelado?: number
  taxa_pix?: number
  observacoes?: string
  created?: string
  updated?: string
}

export type CondicaoTipo =
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'cheque'
  | 'boleto'

/**
 * Como o dinheiro entra no contas a receber:
 * um_lancamento  → cartão: cai tudo de uma vez na data do repasse
 * por_parcela    → uma conta por parcela, cada uma no seu vencimento
 * na_compensacao → cheque
 */
export type FormaLancamento = 'um_lancamento' | 'por_parcela' | 'na_compensacao'

/** Condição = como o paciente paga. A forma (parcelamento) fica dentro dela. */
export interface CondicaoPagamento {
  id: string
  nome: string
  tipo: CondicaoTipo
  maquina?: string
  permite_parcelamento?: boolean
  /** 0 = sem limite (a máquina limita) */
  max_parcelas?: number
  forma_lancamento: FormaLancamento
  ativo?: boolean
  created?: string
  updated?: string
  expand?: {
    maquina?: Maquina
  }
}

export type ContaReceberStatus = 'previsto' | 'recebido' | 'cancelado'

/** Uma conta a receber. Cartão = uma só no repasse; os outros, uma por parcela. */
export interface ContaReceber {
  id: string
  paciente?: string
  orcamento?: string
  condicao?: string
  maquina?: string
  descricao?: string
  /** Valor que o paciente deve */
  valor: number
  /** Valor que efetivamente cai (valor menos a taxa) */
  valor_liquido?: number
  taxa_percentual?: number
  parcela?: number
  total_parcelas?: number
  /** Data em que o dinheiro deve entrar */
  vencimento: string
  status: ContaReceberStatus
  recebido_em?: string
  observacoes?: string
  created?: string
  updated?: string
  expand?: {
    paciente?: Paciente
    orcamento?: Orcamento
    condicao?: CondicaoPagamento
    maquina?: Maquina
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
