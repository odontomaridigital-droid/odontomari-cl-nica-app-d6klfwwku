import pb from '@/lib/pocketbase/client'
import {
  Paciente,
  TipoAtendimento,
  Consulta,
  Prontuario,
  Orcamento,
  BloqueioAgenda,
  ClinicaConfig,
  Anamnese,
  Medicamento,
  Receita,
  ItemReceita,
  OdontogramaRegistro,
  DocumentoModelo,
  DocumentoEmitido,
  AnamneseModelo,
  Campanha,
  Conteudo,
  Procedimento,
  ProcedimentoCategoria,
  ReceitaModelo,
  Maquina,
  CondicaoPagamento,
  ContaReceber,
  MensagemAutomatica,
  EnvioMensagem,
} from '@/types'
import { montarPlanoRecebimento } from '@/lib/recebimento'
import { somenteData } from '@/lib/datas'
import type { RespostasAnamnese } from '@/lib/anamneseModelo'
import type { CondicaoDente, FaceDente } from '@/lib/odontograma'
import { registrarLog } from '@/services/logsAuditoria'

// =================== Helpers de formatação para o log ===================

const formatarDataCurta = (iso?: string): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

const nomePaciente = (p?: Paciente | null): string => p?.nome || 'paciente'

// =================== PACIENTES ===================
export const pacientesService = {
  async getAll(): Promise<Paciente[]> {
    return await pb.collection('pacientes').getFullList<Paciente>({
      sort: 'nome',
    })
  },

  async search(query: string): Promise<Paciente[]> {
    const q = query.trim()
    if (!q) return this.getAll()
    return await pb.collection('pacientes').getFullList<Paciente>({
      filter: `nome ~ "${q}" || telefone ~ "${q}" || cpf ~ "${q}"`,
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<Paciente> {
    return await pb.collection('pacientes').getOne<Paciente>(id)
  },

  async create(
    data: Omit<Paciente, 'id' | 'created' | 'updated'>,
    fotoFile?: File,
  ): Promise<Paciente> {
    const body = fotoFile ? { ...data, foto: fotoFile } : data
    const created = await pb.collection('pacientes').create<Paciente>(body)
    registrarLog('criou', 'paciente', `Criou paciente ${created.nome || 'paciente'}`, created.id)
    return created
  },

  async update(id: string, data: Partial<Paciente>, fotoFile?: File): Promise<Paciente> {
    const body = fotoFile ? { ...data, foto: fotoFile } : data
    const updated = await pb.collection('pacientes').update<Paciente>(id, body)
    registrarLog('editou', 'paciente', `Editou paciente ${updated.nome || 'paciente'}`, updated.id)
    return updated
  },

  async delete(id: string, motivo?: string): Promise<boolean> {
    const ok = await pb.collection('pacientes').delete(id)
    registrarLog(
      'excluiu',
      'paciente',
      `Excluiu paciente (id ${id})${motivo ? ` - motivo: ${motivo}` : ''}`,
      id,
    )
    return ok
  },
}

// =================== TIPOS DE ATENDIMENTO ===================
export const tiposAtendimentoService = {
  async getAll(onlyActive = true): Promise<TipoAtendimento[]> {
    const filter = onlyActive ? 'ativo = true' : ''
    return await pb.collection('tipos_atendimento').getFullList<TipoAtendimento>({
      filter,
      sort: 'nome',
    })
  },

  async getById(id: string): Promise<TipoAtendimento> {
    return await pb.collection('tipos_atendimento').getOne<TipoAtendimento>(id)
  },

  async create(
    data: Omit<TipoAtendimento, 'id' | 'created' | 'updated'>,
  ): Promise<TipoAtendimento> {
    const created = await pb.collection('tipos_atendimento').create<TipoAtendimento>(data)
    registrarLog(
      'criou',
      'tipo_atendimento',
      `Criou tipo de atendimento ${created.nome || ''}`,
      created.id,
    )
    return created
  },

  async update(id: string, data: Partial<TipoAtendimento>): Promise<TipoAtendimento> {
    const updated = await pb.collection('tipos_atendimento').update<TipoAtendimento>(id, data)
    registrarLog(
      'editou',
      'tipo_atendimento',
      `Editou tipo de atendimento ${updated.nome || ''}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('tipos_atendimento').delete(id)
    registrarLog('excluiu', 'tipo_atendimento', `Excluiu tipo de atendimento ${nome || ''}`, id)
    return ok
  },
}

// =================== PROCEDIMENTOS (catálogo clínico) ===================
// Procedimento é o que se faz e se cobra; tipo de atendimento é como a agenda
// abre o horário. São catálogos diferentes de propósito.
export const procedimentosService = {
  async getAll(onlyActive = false): Promise<Procedimento[]> {
    return await pb.collection('procedimentos').getFullList<Procedimento>({
      filter: onlyActive ? 'ativo = true' : '',
      sort: 'categoria,nome',
    })
  },

  async getById(id: string): Promise<Procedimento> {
    return await pb.collection('procedimentos').getOne<Procedimento>(id)
  },

  async create(data: Omit<Procedimento, 'id' | 'created' | 'updated'>): Promise<Procedimento> {
    const created = await pb.collection('procedimentos').create<Procedimento>(data)
    registrarLog('criou', 'procedimento', `Criou procedimento ${created.nome}`, created.id)
    return created
  },

  async update(id: string, data: Partial<Procedimento>): Promise<Procedimento> {
    const updated = await pb.collection('procedimentos').update<Procedimento>(id, data)
    registrarLog('editou', 'procedimento', `Editou procedimento ${updated.nome}`, updated.id)
    return updated
  },

  async delete(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('procedimentos').delete(id)
    registrarLog('excluiu', 'procedimento', `Excluiu procedimento ${nome || ''}`, id)
    return ok
  },
}

/** Nome legível de cada categoria do catálogo de procedimentos. */
export const NOMES_CATEGORIA_PROCEDIMENTO: Record<ProcedimentoCategoria, string> = {
  diagnostico: 'Diagnóstico',
  preventivo: 'Preventivo',
  restaurador: 'Restaurador',
  endodontia: 'Endodontia',
  periodontia: 'Periodontia',
  cirurgia: 'Cirurgia',
  implante: 'Implante',
  protese: 'Prótese',
  estetica: 'Estética',
  harmonizacao: 'Harmonização',
  outro: 'Outros',
}

// =================== CONSULTAS ===================
export const consultasService = {
  async getAll(): Promise<Consulta[]> {
    return await pb.collection('consultas').getFullList<Consulta>({
      expand: 'paciente,tipo_atendimento',
      sort: 'data,hora_inicio',
    })
  },

  async getByDate(dateStr: string): Promise<Consulta[]> {
    // dateStr format: YYYY-MM-DD
    const startOfDay = `${dateStr} 00:00:00.000Z`
    const endOfDay = `${dateStr} 23:59:59.999Z`

    return await pb.collection('consultas').getFullList<Consulta>({
      filter: `data >= "${startOfDay}" && data <= "${endOfDay}"`,
      expand: 'paciente,tipo_atendimento',
      sort: 'hora_inicio',
    })
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Consulta[]> {
    const start = `${startDate} 00:00:00.000Z`
    const end = `${endDate} 23:59:59.999Z`

    return await pb.collection('consultas').getFullList<Consulta>({
      filter: `data >= "${start}" && data <= "${end}"`,
      expand: 'paciente,tipo_atendimento',
      sort: 'data,hora_inicio',
    })
  },

  async getByPaciente(pacienteId: string): Promise<Consulta[]> {
    return await pb.collection('consultas').getFullList<Consulta>({
      filter: `paciente = "${pacienteId}"`,
      expand: 'tipo_atendimento',
      sort: '-data,-hora_inicio',
    })
  },

  async create(data: {
    paciente: string
    tipo_atendimento: string
    data: string
    hora_inicio: string
    duracao_minutos: number
    hora_fim: string
    status: Consulta['status']
    observacoes?: string
  }): Promise<Consulta> {
    // Normalise data to ISO string if needed
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('consultas').create<Consulta>(
      {
        ...data,
        data: isoDate,
        lembrete_enviado: false,
      },
      {
        expand: 'paciente,tipo_atendimento',
      },
    )
    registrarLog(
      'criou',
      'consulta',
      `Criou consulta de ${formatarDataCurta(created.data)} ${created.hora_inicio} - ${nomePaciente(created.expand?.paciente)}`,
      created.id,
    )
    return created
  },

  async update(id: string, data: Partial<Consulta>): Promise<Consulta> {
    const updated = await pb.collection('consultas').update<Consulta>(id, data, {
      expand: 'paciente,tipo_atendimento',
    })
    registrarLog(
      'editou',
      'consulta',
      `Editou consulta de ${formatarDataCurta(updated.data)} ${updated.hora_inicio} - ${nomePaciente(updated.expand?.paciente)}`,
      updated.id,
    )
    return updated
  },

  async updateStatus(id: string, status: Consulta['status']): Promise<Consulta> {
    const updated = await pb.collection('consultas').update<Consulta>(
      id,
      { status },
      {
        expand: 'paciente,tipo_atendimento',
      },
    )
    registrarLog(
      'editou',
      'consulta',
      `Alterou status da consulta de ${formatarDataCurta(updated.data)} ${updated.hora_inicio} - ${nomePaciente(updated.expand?.paciente)} para ${status}`,
      updated.id,
    )
    return updated
  },

  async markLembreteEnviado(id: string, enviadoPor: string): Promise<Consulta> {
    const updated = await pb.collection('consultas').update<Consulta>(
      id,
      {
        lembrete_enviado: true,
        lembrete_data_envio: new Date().toISOString(),
        lembrete_enviado_por: enviadoPor,
      },
      {
        expand: 'paciente,tipo_atendimento',
      },
    )
    registrarLog(
      'editou',
      'consulta',
      `Marca lembrete enviado da consulta de ${formatarDataCurta(updated.data)} ${updated.hora_inicio} - ${nomePaciente(updated.expand?.paciente)}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string, info?: string): Promise<boolean> {
    const ok = await pb.collection('consultas').delete(id)
    registrarLog(
      'excluiu',
      'consulta',
      `Excluiu consulta${info ? ` - ${info}` : ` (id ${id})`}`,
      id,
    )
    return ok
  },
}

// =================== PRONTUÁRIOS ===================
export const prontuariosService = {
  async getAll(): Promise<Prontuario[]> {
    return await pb.collection('prontuarios').getFullList<Prontuario>({
      sort: '-data',
    })
  },

  async getByPaciente(pacienteId: string): Promise<Prontuario[]> {
    return await pb.collection('prontuarios').getFullList<Prontuario>({
      filter: `paciente = "${pacienteId}"`,
      expand: 'consulta',
      sort: '-data,-created',
    })
  },

  async create(data: {
    paciente: string
    consulta?: string
    data: string
    procedimentos: string
    anotacoes?: string
    dente_regiao?: string
    retorno_dias?: number
    retorno_data?: string
  }): Promise<Prontuario> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('prontuarios').create<Prontuario>(
      {
        ...data,
        data: isoDate,
        ...(data.retorno_data && !data.retorno_data.includes('T')
          ? { retorno_data: `${data.retorno_data} 00:00:00.000Z` }
          : {}),
      },
      {
        expand: 'consulta',
      },
    )
    registrarLog(
      'criou',
      'consulta',
      `Criou prontuário de ${formatarDataCurta(created.data)} - ${created.procedimentos?.slice(0, 60) || 'atendimento'}`,
      created.id,
    )
    return created
  },

  async update(id: string, data: Partial<Prontuario>): Promise<Prontuario> {
    const updated = await pb.collection('prontuarios').update<Prontuario>(id, data, {
      expand: 'consulta',
    })
    registrarLog(
      'editou',
      'consulta',
      `Editou prontuário de ${formatarDataCurta(updated.data)} - ${updated.procedimentos?.slice(0, 60) || 'atendimento'}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('prontuarios').delete(id)
    registrarLog('excluiu', 'consulta', `Excluiu prontuário (id ${id})`, id)
    return ok
  },
}

// =================== ORÇAMENTOS ===================
export const orcamentosService = {
  async getAll(): Promise<Orcamento[]> {
    return await pb.collection('orcamentos').getFullList<Orcamento>({
      expand: 'paciente',
      sort: '-data,-created',
    })
  },

  async getByPaciente(pacienteId: string): Promise<Orcamento[]> {
    return await pb.collection('orcamentos').getFullList<Orcamento>({
      filter: `paciente = "${pacienteId}"`,
      sort: '-data,-created',
    })
  },

  async create(data: {
    paciente: string
    data: string
    status: Orcamento['status']
    itens: Orcamento['itens']
    valor_total: number
    observacoes?: string
    validade_dias?: number
  }): Promise<Orcamento> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('orcamentos').create<Orcamento>(
      {
        ...data,
        data: isoDate,
      },
      {
        expand: 'paciente',
      },
    )
    registrarLog(
      'criou',
      'planejamento',
      `Criou Planejamento de Tratamento de ${formatarDataCurta(created.data)} - ${nomePaciente(created.expand?.paciente)} (${created.itens?.length || 0} itens)`,
      created.id,
    )
    return created
  },

  async update(id: string, data: Partial<Orcamento>): Promise<Orcamento> {
    const updated = await pb.collection('orcamentos').update<Orcamento>(id, data, {
      expand: 'paciente',
    })
    registrarLog(
      'editou',
      'planejamento',
      `Editou Planejamento de Tratamento de ${formatarDataCurta(updated.data)} - ${nomePaciente(updated.expand?.paciente)}`,
      updated.id,
    )
    return updated
  },

  /**
   * Muda a situação do planejamento e guarda a data (e quem fez, no aceite).
   * Aberto → Aceito → Concluído. Recusado continua existindo.
   */
  async updateStatus(
    id: string,
    status: Orcamento['status'],
    usuarioId?: string,
  ): Promise<Orcamento> {
    const agora = new Date().toISOString()
    const corpo: Record<string, unknown> = { status }

    if (status === 'aceito') {
      corpo.aceito_em = agora
      if (usuarioId) corpo.aceito_por = usuarioId
    }
    if (status === 'concluido') {
      corpo.concluido_em = agora
    }
    // Voltou para aberto: limpa o aceite, senão fica data de aceite num
    // planejamento que não está mais aceito.
    if (status === 'aberto') {
      corpo.aceito_em = ''
      corpo.aceito_por = ''
      corpo.concluido_em = ''
    }

    const updated = await pb.collection('orcamentos').update<Orcamento>(id, corpo, {
      expand: 'paciente,aceito_por',
    })
    registrarLog(
      'editou',
      'planejamento',
      `Alterou status do Planejamento de Tratamento de ${nomePaciente(updated.expand?.paciente)} para ${status}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string, info?: string): Promise<boolean> {
    const ok = await pb.collection('orcamentos').delete(id)
    registrarLog(
      'excluiu',
      'planejamento',
      `Excluiu Planejamento de Tratamento${info ? ` - ${info}` : ` (id ${id})`}`,
      id,
    )
    return ok
  },
}

// =================== ANAMNESES ===================
export const anamnesesService = {
  async getByPaciente(pacienteId: string): Promise<Anamnese[]> {
    return await pb.collection('anamneses').getFullList<Anamnese>({
      filter: `paciente = "${pacienteId}"`,
      expand: 'autor',
      sort: '-data,-created',
    })
  },

  async create(data: {
    paciente: string
    autor?: string
    modelo?: string
    respostas: RespostasAnamnese
    data: string
  }): Promise<Anamnese> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('anamneses').create<Anamnese>(
      {
        ...data,
        data: isoDate,
      },
      {
        expand: 'autor',
      },
    )
    registrarLog(
      'criou',
      'anamnese',
      `Criou anamnese de ${formatarDataCurta(created.data)}`,
      created.id,
    )
    return created
  },

  async update(
    id: string,
    data: {
      respostas?: RespostasAnamnese
      data?: string
      autor?: string
    },
  ): Promise<Anamnese> {
    const updated = await pb.collection('anamneses').update<Anamnese>(
      id,
      {
        ...data,
        ...(data.data && !data.data.includes('T') ? { data: `${data.data} 00:00:00.000Z` } : {}),
      },
      {
        expand: 'autor',
      },
    )
    registrarLog(
      'editou',
      'anamnese',
      `Editou anamnese de ${formatarDataCurta(updated.data)}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('anamneses').delete(id)
    registrarLog('excluiu', 'anamnese', `Excluiu anamnese (id ${id})`, id)
    return ok
  },
}

// =================== MODELOS DE RECEITA ===================
export const receitaModelosService = {
  async getAll(somenteAtivos = true): Promise<ReceitaModelo[]> {
    const filter = somenteAtivos ? 'ativo = true' : ''
    return await pb.collection('receita_modelos').getFullList<ReceitaModelo>({
      filter,
      sort: 'categoria,nome',
    })
  },

  async create(data: {
    nome: string
    categoria: string
    descricao?: string
    itens: ItemReceita[]
    orientacoes?: string
    ativo?: boolean
  }): Promise<ReceitaModelo> {
    const criado = await pb.collection('receita_modelos').create<ReceitaModelo>({
      ...data,
      ativo: data.ativo ?? true,
    })
    registrarLog('criou', 'configuracoes', `Criou modelo de receita: ${criado.nome}`, criado.id)
    return criado
  },

  async update(id: string, data: Partial<ReceitaModelo>): Promise<ReceitaModelo> {
    const atualizado = await pb.collection('receita_modelos').update<ReceitaModelo>(id, data)
    registrarLog(
      'editou',
      'configuracoes',
      `Editou modelo de receita: ${atualizado.nome}`,
      atualizado.id,
    )
    return atualizado
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('receita_modelos').delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu modelo de receita (id ${id})`, id)
    return ok
  },
}

// =================== MARKETING: CAMPANHAS ===================
export const campanhasService = {
  async getAll(): Promise<Campanha[]> {
    return await pb.collection('campanhas').getFullList<Campanha>({
      sort: '-created',
    })
  },

  async create(data: {
    nome: string
    canal: string
    status?: string
    inicio?: string
    fim?: string
    investimento?: number
    objetivo?: string
    publico?: string
    observacoes?: string
    utm?: string
    responsavel?: string
  }): Promise<Campanha> {
    const criada = await pb.collection('campanhas').create<Campanha>({
      ...data,
      status: data.status || 'planejada',
    })
    registrarLog('criou', 'configuracoes', `Criou campanha: ${criada.nome}`, criada.id)
    return criada
  },

  async update(id: string, data: Partial<Campanha>): Promise<Campanha> {
    const atualizada = await pb.collection('campanhas').update<Campanha>(id, data)
    registrarLog('editou', 'configuracoes', `Editou campanha: ${atualizada.nome}`, atualizada.id)
    return atualizada
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('campanhas').delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu campanha (id ${id})`, id)
    return ok
  },
}

// =================== MARKETING: CONTEÚDOS ===================
export const conteudosService = {
  async getAll(): Promise<Conteudo[]> {
    return await pb.collection('conteudos').getFullList<Conteudo>({
      expand: 'campanha',
      sort: '-created',
    })
  },

  async create(data: {
    titulo: string
    formato: string
    canal: string
    status?: string
    tema?: string
    publico_alvo?: string
    data_publicacao?: string
    link?: string
    observacoes?: string
    campanha?: string
    responsavel?: string
  }): Promise<Conteudo> {
    const criado = await pb.collection('conteudos').create<Conteudo>(
      {
        ...data,
        status: data.status || 'ideia',
        ...(data.data_publicacao && !data.data_publicacao.includes('T')
          ? { data_publicacao: `${data.data_publicacao} 00:00:00.000Z` }
          : {}),
      },
      { expand: 'campanha' },
    )
    registrarLog('criou', 'configuracoes', `Criou conteúdo: ${criado.titulo}`, criado.id)
    return criado
  },

  async update(id: string, data: Partial<Conteudo>): Promise<Conteudo> {
    const atualizado = await pb.collection('conteudos').update<Conteudo>(
      id,
      {
        ...data,
        ...(data.data_publicacao && !data.data_publicacao.includes('T')
          ? { data_publicacao: `${data.data_publicacao} 00:00:00.000Z` }
          : {}),
      },
      { expand: 'campanha' },
    )
    registrarLog('editou', 'configuracoes', `Editou conteúdo: ${atualizado.titulo}`, atualizado.id)
    return atualizado
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('conteudos').delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu conteúdo (id ${id})`, id)
    return ok
  },
}

// =================== MODELOS DE ANAMNESE (EDITÁVEIS) ===================
export const anamneseModelosService = {
  async getAll(somenteAtivos = true): Promise<AnamneseModelo[]> {
    const filter = somenteAtivos ? 'ativo = true' : ''
    return await pb.collection('anamnese_modelos').getFullList<AnamneseModelo>({
      filter,
      sort: '-padrao,nome',
    })
  },

  /** Modelo marcado como padrão; se não houver, o primeiro ativo. */
  async getPadrao(): Promise<AnamneseModelo | null> {
    try {
      const lista = await pb.collection('anamnese_modelos').getFullList<AnamneseModelo>({
        filter: 'ativo = true',
        sort: '-padrao',
      })
      return lista[0] || null
    } catch {
      return null
    }
  },

  async create(data: {
    nome: string
    descricao?: string
    secoes: unknown
    ativo?: boolean
    padrao?: boolean
  }): Promise<AnamneseModelo> {
    const criado = await pb.collection('anamnese_modelos').create<AnamneseModelo>({
      ...data,
      ativo: data.ativo ?? true,
    })
    registrarLog('criou', 'configuracoes', `Criou modelo de anamnese: ${criado.nome}`, criado.id)
    return criado
  },

  async update(id: string, data: Partial<AnamneseModelo>): Promise<AnamneseModelo> {
    const atualizado = await pb.collection('anamnese_modelos').update<AnamneseModelo>(id, data)
    registrarLog(
      'editou',
      'configuracoes',
      `Editou modelo de anamnese: ${atualizado.nome}`,
      atualizado.id,
    )
    return atualizado
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('anamnese_modelos').delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu modelo de anamnese (id ${id})`, id)
    return ok
  },
}

// =================== ODONTOGRAMA ===================
export const odontogramaService = {
  /**
   * Odontograma de UM planejamento. Cada planejamento tem o seu: um paciente
   * que volta depois de um ano recebe um planejamento novo, com mapa novo.
   */
  async getByOrcamento(orcamentoId: string): Promise<OdontogramaRegistro[]> {
    return await pb.collection('odontograma').getFullList<OdontogramaRegistro>({
      filter: `orcamento = "${orcamentoId}"`,
      sort: 'dente',
    })
  },

  /** Todos os registros do paciente, para o histórico. */
  async getByPaciente(pacienteId: string): Promise<OdontogramaRegistro[]> {
    return await pb.collection('odontograma').getFullList<OdontogramaRegistro>({
      filter: `paciente = "${pacienteId}"`,
      sort: 'dente',
    })
  },

  /** Cria ou atualiza o estado de um dente dentro de um planejamento. */
  async salvar(data: {
    orcamento: string
    paciente?: string
    dente: number
    condicao: CondicaoDente
    faces?: FaceDente[]
    observacao?: string
    registrado_por?: string
    data?: string
  }): Promise<OdontogramaRegistro> {
    const corpo: any = {
      orcamento: data.orcamento,
      paciente: data.paciente || undefined,
      dente: data.dente,
      condicao: data.condicao,
      faces: data.faces || [],
      observacao: data.observacao || '',
      registrado_por: data.registrado_por || undefined,
      data:
        data.data && data.data.includes('T')
          ? data.data
          : `${data.data || new Date().toISOString().split('T')[0]} 00:00:00.000Z`,
    }

    let existente: OdontogramaRegistro | null = null
    try {
      existente = await pb
        .collection('odontograma')
        .getFirstListItem<OdontogramaRegistro>(
          `orcamento = "${data.orcamento}" && dente = ${data.dente}`,
        )
    } catch {
      existente = null
    }

    const salvo = existente
      ? await pb.collection('odontograma').update<OdontogramaRegistro>(existente.id, corpo)
      : await pb.collection('odontograma').create<OdontogramaRegistro>(corpo)

    registrarLog(
      existente ? 'editou' : 'criou',
      'consulta',
      `Odontograma: dente ${data.dente} marcado como ${data.condicao}`,
      salvo.id,
    )
    return salvo
  },

  async remover(registroId: string, dente?: number): Promise<boolean> {
    const ok = await pb.collection('odontograma').delete(registroId)
    registrarLog(
      'excluiu',
      'consulta',
      `Odontograma: estado do dente ${dente ?? ''} removido`,
      registroId,
    )
    return ok
  },
}

// =================== DOCUMENTOS (MODELOS E EMITIDOS) ===================
export const documentosModelosService = {
  async getAll(somenteAtivos = true): Promise<DocumentoModelo[]> {
    const filter = somenteAtivos ? 'ativo = true' : ''
    return await pb.collection('documentos_modelos').getFullList<DocumentoModelo>({
      filter,
      sort: 'categoria,titulo',
    })
  },

  async create(data: {
    titulo: string
    categoria: string
    corpo: string
    ativo?: boolean
  }): Promise<DocumentoModelo> {
    const criado = await pb.collection('documentos_modelos').create<DocumentoModelo>({
      ...data,
      ativo: data.ativo ?? true,
    })
    registrarLog('criou', 'configuracoes', `Criou modelo de documento: ${criado.titulo}`, criado.id)
    return criado
  },

  async update(id: string, data: Partial<DocumentoModelo>): Promise<DocumentoModelo> {
    const atualizado = await pb.collection('documentos_modelos').update<DocumentoModelo>(id, data)
    registrarLog(
      'editou',
      'configuracoes',
      `Editou modelo de documento: ${atualizado.titulo}`,
      atualizado.id,
    )
    return atualizado
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('documentos_modelos').delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu modelo de documento (id ${id})`, id)
    return ok
  },
}

export const documentosEmitidosService = {
  async getByPaciente(pacienteId: string): Promise<DocumentoEmitido[]> {
    return await pb.collection('documentos_emitidos').getFullList<DocumentoEmitido>({
      filter: `paciente = "${pacienteId}"`,
      sort: '-data,-created',
    })
  },

  async getAll(): Promise<DocumentoEmitido[]> {
    return await pb.collection('documentos_emitidos').getFullList<DocumentoEmitido>({
      expand: 'paciente',
      sort: '-data,-created',
    })
  },

  async create(data: {
    paciente: string
    modelo?: string
    titulo: string
    categoria: string
    corpo: string
    autor?: string
    data?: string
  }): Promise<DocumentoEmitido> {
    const criado = await pb.collection('documentos_emitidos').create<DocumentoEmitido>({
      ...data,
      data:
        data.data && data.data.includes('T')
          ? data.data
          : `${data.data || new Date().toISOString().split('T')[0]} 00:00:00.000Z`,
    })
    registrarLog('criou', 'paciente', `Emitiu documento: ${criado.titulo}`, criado.id)
    return criado
  },

  async marcarEnviado(id: string, canal: string): Promise<DocumentoEmitido> {
    const atualizado = await pb.collection('documentos_emitidos').update<DocumentoEmitido>(id, {
      enviado_em: new Date().toISOString(),
      enviado_canal: canal,
    })
    registrarLog('editou', 'paciente', `Documento enviado por ${canal}`, atualizado.id)
    return atualizado
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('documentos_emitidos').delete(id)
    registrarLog('excluiu', 'paciente', `Excluiu documento emitido (id ${id})`, id)
    return ok
  },
}

// =================== MEDICAMENTOS (CATÁLOGO) ===================
export const medicamentosService = {
  async getAll(somenteAtivos = true): Promise<Medicamento[]> {
    const filter = somenteAtivos ? 'ativo = true' : ''
    return await pb.collection('medicamentos').getFullList<Medicamento>({
      filter,
      sort: 'nome',
    })
  },

  async search(query: string): Promise<Medicamento[]> {
    const q = query.trim()
    if (!q) return this.getAll()
    return await pb.collection('medicamentos').getFullList<Medicamento>({
      filter: `ativo = true && (nome ~ "${q}" || apresentacao ~ "${q}")`,
      sort: 'nome',
    })
  },

  async create(data: Omit<Medicamento, 'id' | 'created' | 'updated'>): Promise<Medicamento> {
    const created = await pb.collection('medicamentos').create<Medicamento>(data)
    registrarLog('criou', 'medicamento', `Criou medicamento ${created.nome || ''}`, created.id)
    return created
  },

  async update(id: string, data: Partial<Medicamento>): Promise<Medicamento> {
    const updated = await pb.collection('medicamentos').update<Medicamento>(id, data)
    registrarLog('editou', 'medicamento', `Editou medicamento ${updated.nome || ''}`, updated.id)
    return updated
  },

  async delete(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('medicamentos').delete(id)
    registrarLog('excluiu', 'medicamento', `Excluiu medicamento ${nome || ''}`, id)
    return ok
  },
}

// =================== RECEITAS ===================
export const receitasService = {
  async getByPaciente(pacienteId: string): Promise<Receita[]> {
    return await pb.collection('receitas').getFullList<Receita>({
      filter: `paciente = "${pacienteId}"`,
      expand: 'autor',
      sort: '-data,-created',
    })
  },

  async create(data: {
    paciente: string
    autor?: string
    itens: ItemReceita[]
    orientacoes?: string
    data: string
    origem?: Receita['origem']
  }): Promise<Receita> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('receitas').create<Receita>(
      {
        ...data,
        data: isoDate,
        origem: data.origem || 'manual',
      },
      {
        expand: 'autor',
      },
    )
    registrarLog(
      'criou',
      'receita',
      `Criou receita de ${formatarDataCurta(created.data)} (${created.itens?.length || 0} itens)`,
      created.id,
    )
    return created
  },

  async update(
    id: string,
    data: {
      itens?: ItemReceita[]
      orientacoes?: string
      data?: string
      autor?: string
    },
  ): Promise<Receita> {
    const updated = await pb.collection('receitas').update<Receita>(
      id,
      {
        ...data,
        ...(data.data && !data.data.includes('T') ? { data: `${data.data} 00:00:00.000Z` } : {}),
      },
      {
        expand: 'autor',
      },
    )
    registrarLog(
      'editou',
      'receita',
      `Editou receita de ${formatarDataCurta(updated.data)}`,
      updated.id,
    )
    return updated
  },

  async delete(id: string): Promise<boolean> {
    const ok = await pb.collection('receitas').delete(id)
    registrarLog('excluiu', 'receita', `Excluiu receita (id ${id})`, id)
    return ok
  },
}

// =================== BLOQUEIOS DE AGENDA ===================
export const bloqueiosService = {
  async getByDate(dateStr: string): Promise<BloqueioAgenda[]> {
    const startOfDay = `${dateStr} 00:00:00.000Z`
    const endOfDay = `${dateStr} 23:59:59.999Z`

    return await pb.collection('bloqueios_agenda').getFullList<BloqueioAgenda>({
      filter: `data >= "${startOfDay}" && data <= "${endOfDay}"`,
      sort: 'hora_inicio',
    })
  },

  async getByDateRange(startDate: string, endDate: string): Promise<BloqueioAgenda[]> {
    const start = `${startDate} 00:00:00.000Z`
    const end = `${endDate} 23:59:59.999Z`

    return await pb.collection('bloqueios_agenda').getFullList<BloqueioAgenda>({
      filter: `data >= "${start}" && data <= "${end}"`,
      sort: 'data,hora_inicio',
    })
  },

  async create(data: {
    data: string
    dia_inteiro?: boolean
    hora_inicio?: string
    hora_fim?: string
    motivo?: string
    tipo?: 'bloqueio' | 'desbloqueio_fds'
  }): Promise<BloqueioAgenda> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    const created = await pb.collection('bloqueios_agenda').create<BloqueioAgenda>({
      ...data,
      data: isoDate,
      tipo: data.tipo || 'bloqueio',
      dia_inteiro: data.dia_inteiro ?? true,
    })
    registrarLog(
      'criou',
      'bloqueio',
      `Criou bloqueio de agenda em ${formatarDataCurta(created.data)}${created.hora_inicio ? ` ${created.hora_inicio}` : ' (dia inteiro)'}${created.motivo ? ` - ${created.motivo}` : ''}`,
      created.id,
    )
    return created
  },

  async delete(id: string, info?: string): Promise<boolean> {
    const ok = await pb.collection('bloqueios_agenda').delete(id)
    registrarLog('excluiu', 'bloqueio', `Excluiu bloqueio de agenda (id ${id})`, id)
    return ok
  },
}

// =================== MENSAGENS AUTOMÁTICAS ===================
/**
 * Variáveis fixas que podem ser usadas no texto da mensagem.
 * Qualquer outra coisa entre chaves é erro de digitação.
 */
export const VARIAVEIS_MENSAGEM: { tag: string; descricao: string }[] = [
  { tag: '{primeiro_nome}', descricao: 'Primeiro nome do paciente' },
  { tag: '{paciente}', descricao: 'Nome completo do paciente' },
  { tag: '{idade}', descricao: 'Idade que ele está completando' },
  { tag: '{clinica}', descricao: 'Nome da clínica' },
  { tag: '{dentista}', descricao: 'Nome da dentista' },
  { tag: '{telefone}', descricao: 'Telefone da clínica' },
]

/** Troca as variáveis pelos dados reais do paciente. */
export function preencherMensagem(
  texto: string,
  dados: {
    pacienteNome: string
    idade?: number | null
    clinica?: string
    dentista?: string
    telefone?: string
  },
): string {
  const primeiro = (dados.pacienteNome || '').trim().split(/\s+/)[0] || ''
  return String(texto || '')
    .replace(/\{primeiro_nome\}/g, primeiro)
    .replace(/\{paciente\}/g, dados.pacienteNome || '')
    .replace(/\{idade\}/g, dados.idade != null ? String(dados.idade) : '')
    .replace(/\{clinica\}/g, dados.clinica || 'Clínica Odontomari')
    .replace(/\{dentista\}/g, dados.dentista || '')
    .replace(/\{telefone\}/g, dados.telefone || '')
}

export const mensagensAutomaticasService = {
  async getAll(finalidade?: MensagemAutomatica['finalidade']): Promise<MensagemAutomatica[]> {
    return await pb.collection('mensagens_automaticas').getFullList<MensagemAutomatica>({
      sort: 'finalidade,nome',
      ...(finalidade ? { filter: `finalidade = "${finalidade}"` } : {}),
    })
  },

  /** A mensagem marcada como ativa de uma finalidade (a que será usada). */
  async getAtiva(finalidade: MensagemAutomatica['finalidade']): Promise<MensagemAutomatica | null> {
    try {
      return await pb
        .collection('mensagens_automaticas')
        .getFirstListItem<MensagemAutomatica>(`finalidade = "${finalidade}" && ativo = true`)
    } catch {
      return null
    }
  },

  /** Só uma ativa por finalidade: ativar uma desativa as outras. */
  async ativar(id: string, finalidade: MensagemAutomatica['finalidade']): Promise<void> {
    const todas = await this.getAll(finalidade)
    for (const m of todas) {
      const deve = m.id === id
      if ((m.ativo ?? false) !== deve) {
        await pb.collection('mensagens_automaticas').update(m.id, { ativo: deve })
      }
    }
    registrarLog('editou', 'mensagem', 'Definiu a mensagem automática em uso', id)
  },

  async create(data: Partial<MensagemAutomatica>): Promise<MensagemAutomatica> {
    const criada = await pb.collection('mensagens_automaticas').create<MensagemAutomatica>(data)
    registrarLog('criou', 'mensagem', `Criou mensagem ${criada.nome}`, criada.id)
    return criada
  },

  async update(id: string, data: Partial<MensagemAutomatica>): Promise<MensagemAutomatica> {
    const atualizada = await pb
      .collection('mensagens_automaticas')
      .update<MensagemAutomatica>(id, data)
    registrarLog('editou', 'mensagem', `Editou mensagem ${atualizada.nome}`, atualizada.id)
    return atualizada
  },

  async remove(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('mensagens_automaticas').delete(id)
    registrarLog('excluiu', 'mensagem', `Excluiu mensagem ${nome || ''}`, id)
    return ok
  },
}

export const enviosMensagemService = {
  /** Envios de uma finalidade no ano corrente — para saber quem já recebeu. */
  async getDoAno(
    finalidade: EnvioMensagem['finalidade'],
    ano = new Date().getFullYear(),
  ): Promise<EnvioMensagem[]> {
    return await pb.collection('envios_mensagem').getFullList<EnvioMensagem>({
      filter: `finalidade = "${finalidade}" && ano_referencia = ${ano}`,
      expand: 'paciente,mensagem,enviado_por',
    })
  },

  /** Registra que a mensagem foi enviada. Reenviar atualiza em vez de duplicar. */
  async registrar(data: {
    pacienteId: string
    mensagemId?: string
    finalidade: EnvioMensagem['finalidade']
    canal: EnvioMensagem['canal']
    ano?: number
    usuarioId?: string
    observacoes?: string
  }): Promise<EnvioMensagem> {
    const ano = data.ano || new Date().getFullYear()
    const corpo = {
      paciente: data.pacienteId,
      mensagem: data.mensagemId || undefined,
      finalidade: data.finalidade,
      ano_referencia: ano,
      canal: data.canal,
      status: 'enviado' as const,
      enviado_em: new Date().toISOString(),
      enviado_por: data.usuarioId || undefined,
      observacoes: data.observacoes || '',
    }

    let existente: EnvioMensagem | null = null
    try {
      existente = await pb
        .collection('envios_mensagem')
        .getFirstListItem<EnvioMensagem>(
          `paciente = "${data.pacienteId}" && finalidade = "${data.finalidade}" && ano_referencia = ${ano}`,
        )
    } catch {
      existente = null
    }

    const salvo = existente
      ? await pb.collection('envios_mensagem').update<EnvioMensagem>(existente.id, corpo)
      : await pb.collection('envios_mensagem').create<EnvioMensagem>(corpo)

    registrarLog(
      'criou',
      'mensagem',
      `Registrou envio de ${data.finalidade} para paciente`,
      salvo.id,
    )
    return salvo
  },

  /** Desfaz o registro (marcou por engano). */
  async desfazer(pacienteId: string, finalidade: EnvioMensagem['finalidade'], ano?: number) {
    const anoRef = ano || new Date().getFullYear()
    try {
      const existente = await pb
        .collection('envios_mensagem')
        .getFirstListItem<EnvioMensagem>(
          `paciente = "${pacienteId}" && finalidade = "${finalidade}" && ano_referencia = ${anoRef}`,
        )
      await pb.collection('envios_mensagem').delete(existente.id)
      registrarLog('excluiu', 'mensagem', 'Desfez registro de envio', existente.id)
    } catch {
      // nada a desfazer
    }
  },
}

// =================== MÁQUINAS, CONDIÇÕES E CONTAS A RECEBER ===================
export const maquinasService = {
  async getAll(somenteAtivas = false): Promise<Maquina[]> {
    return await pb.collection('maquinas').getFullList<Maquina>({
      sort: 'nome',
      ...(somenteAtivas ? { filter: 'ativo = true' } : {}),
    })
  },

  async create(data: Partial<Maquina>): Promise<Maquina> {
    const created = await pb.collection('maquinas').create<Maquina>(data)
    registrarLog('criou', 'maquina', `Criou máquina ${created.nome}`, created.id)
    return created
  },

  async update(id: string, data: Partial<Maquina>): Promise<Maquina> {
    const updated = await pb.collection('maquinas').update<Maquina>(id, data)
    registrarLog('editou', 'maquina', `Editou máquina ${updated.nome}`, updated.id)
    return updated
  },

  async remove(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('maquinas').delete(id)
    registrarLog('excluiu', 'maquina', `Excluiu máquina ${nome || ''}`, id)
    return ok
  },
}

export const condicoesPagamentoService = {
  async getAll(somenteAtivas = false): Promise<CondicaoPagamento[]> {
    return await pb.collection('condicoes_pagamento').getFullList<CondicaoPagamento>({
      sort: 'nome',
      expand: 'maquina',
      ...(somenteAtivas ? { filter: 'ativo = true' } : {}),
    })
  },

  async create(data: Partial<CondicaoPagamento>): Promise<CondicaoPagamento> {
    const created = await pb.collection('condicoes_pagamento').create<CondicaoPagamento>(data)
    registrarLog('criou', 'condicao', `Criou condição ${created.nome}`, created.id)
    return created
  },

  async update(id: string, data: Partial<CondicaoPagamento>): Promise<CondicaoPagamento> {
    const updated = await pb.collection('condicoes_pagamento').update<CondicaoPagamento>(id, data)
    registrarLog('editou', 'condicao', `Editou condição ${updated.nome}`, updated.id)
    return updated
  },

  async remove(id: string, nome?: string): Promise<boolean> {
    const ok = await pb.collection('condicoes_pagamento').delete(id)
    registrarLog('excluiu', 'condicao', `Excluiu condição ${nome || ''}`, id)
    return ok
  },
}

export const contasReceberService = {
  async getAll(): Promise<ContaReceber[]> {
    return await pb.collection('contas_receber').getFullList<ContaReceber>({
      sort: 'vencimento',
      expand: 'paciente,condicao,maquina,orcamento',
    })
  },

  async getByPaciente(pacienteId: string): Promise<ContaReceber[]> {
    return await pb.collection('contas_receber').getFullList<ContaReceber>({
      filter: `paciente = "${pacienteId}"`,
      sort: 'vencimento',
      expand: 'condicao,maquina',
    })
  },

  async getByOrcamento(orcamentoId: string): Promise<ContaReceber[]> {
    return await pb.collection('contas_receber').getFullList<ContaReceber>({
      filter: `orcamento = "${orcamentoId}"`,
      sort: 'parcela',
    })
  },

  /**
   * Gera as contas a receber de um planejamento conforme a condição escolhida.
   * Apaga as contas antigas do mesmo planejamento antes — refazer não duplica.
   */
  async gerarParaOrcamento(
    orcamentoId: string,
    dados: {
      valorTotal: number
      condicao: CondicaoPagamento
      maquina?: Maquina
      dataBase: string
      numParcelas?: number
      datasCompensacao?: string[]
      pacienteId?: string
    },
  ): Promise<ContaReceber[]> {
    const antigas = await this.getByOrcamento(orcamentoId)
    for (const conta of antigas) {
      await pb.collection('contas_receber').delete(conta.id)
    }

    const plano = montarPlanoRecebimento({
      valorTotal: dados.valorTotal,
      condicao: dados.condicao,
      maquina: dados.maquina,
      dataBase: somenteData(dados.dataBase),
      numParcelas: dados.numParcelas,
      datasCompensacao: dados.datasCompensacao,
    })

    const criadas: ContaReceber[] = []
    for (const item of plano) {
      const criada = await pb.collection('contas_receber').create<ContaReceber>({
        paciente: dados.pacienteId || undefined,
        orcamento: orcamentoId,
        condicao: dados.condicao.id,
        maquina: dados.maquina?.id || undefined,
        descricao: item.descricao,
        valor: item.valor,
        valor_liquido: item.valor_liquido,
        taxa_percentual: item.taxa_percentual,
        parcela: item.parcela,
        total_parcelas: item.total_parcelas,
        vencimento: `${item.vencimento} 00:00:00.000Z`,
        status: 'previsto',
      })
      criadas.push(criada)
    }

    registrarLog(
      'criou',
      'financeiro',
      `Gerou ${criadas.length} conta(s) a receber do planejamento`,
      orcamentoId,
    )
    return criadas
  },

  async marcarRecebido(id: string, data?: string): Promise<ContaReceber> {
    const updated = await pb.collection('contas_receber').update<ContaReceber>(id, {
      status: 'recebido',
      recebido_em: data ? `${somenteData(data)} 00:00:00.000Z` : new Date().toISOString(),
    })
    registrarLog('editou', 'financeiro', 'Marcou conta a receber como recebida', id)
    return updated
  },

  async cancelar(id: string): Promise<ContaReceber> {
    const updated = await pb.collection('contas_receber').update<ContaReceber>(id, {
      status: 'cancelado',
    })
    registrarLog('editou', 'financeiro', 'Cancelou conta a receber', id)
    return updated
  },
}

// =================== CONFIGURAÇÕES ===================
export const DEFAULT_CONFIGS: ClinicaConfig = {
  horario_inicio: '08:00',
  horario_fim: '18:00',
  intervalo_minutos: 30,
  bloquear_fins_de_semana: true,
  nome_clinica: 'Clínica Odontomari',
  telefone_clinica: '(11) 98765-4321',
  mensagem_lembrete_padrao:
    'Olá {paciente}, confirmamos sua consulta odontológica na Clínica Odontomari no dia {data} às {hora}. Para confirmar ou remarcar, por favor responda esta mensagem.',
  dentista_nome: '',
  dentista_cro: '',
}

const ROTULOS_CONFIG: Partial<Record<keyof ClinicaConfig, string>> = {
  horario_inicio: 'horário de início',
  horario_fim: 'horário de fim',
  intervalo_minutos: 'intervalo da agenda',
  bloquear_fins_de_semana: 'bloqueio de fins de semana',
  nome_clinica: 'nome da clínica',
  telefone_clinica: 'telefone da clínica',
  mensagem_lembrete_padrao: 'mensagem padrão de lembrete',
  dentista_nome: 'nome do dentista',
  dentista_cro: 'CRO do dentista',
}

export const configuracoesService = {
  async getConfigs(): Promise<ClinicaConfig> {
    try {
      const records = await pb.collection('configuracoes').getFullList()
      const config: any = { ...DEFAULT_CONFIGS }

      for (const rec of records) {
        if (rec.chave in config) {
          try {
            // pocketbase returns json fields either as parsed or raw
            const val = typeof rec.valor === 'string' ? JSON.parse(rec.valor) : rec.valor
            config[rec.chave] = val
          } catch {
            config[rec.chave] = rec.valor
          }
        }
      }
      return config
    } catch {
      return DEFAULT_CONFIGS
    }
  },

  async saveConfig<K extends keyof ClinicaConfig>(
    chave: K,
    valor: ClinicaConfig[K],
  ): Promise<void> {
    let foiEdicao = false
    try {
      const existing = await pb.collection('configuracoes').getFirstListItem(`chave = "${chave}"`)
      foiEdicao = true
      await pb.collection('configuracoes').update(existing.id, {
        valor: JSON.stringify(valor),
      })
    } catch {
      await pb.collection('configuracoes').create({
        chave,
        valor: JSON.stringify(valor),
      })
    }
    registrarLog(
      foiEdicao ? 'editou' : 'criou',
      'configuracoes',
      `Alterou configuração: ${ROTULOS_CONFIG[chave] || chave}`,
    )
  },

  async saveAllConfigs(configs: Partial<ClinicaConfig>): Promise<void> {
    for (const [key, value] of Object.entries(configs)) {
      if (value !== undefined) {
        await this.saveConfig(key as keyof ClinicaConfig, value)
      }
    }
  },
}
