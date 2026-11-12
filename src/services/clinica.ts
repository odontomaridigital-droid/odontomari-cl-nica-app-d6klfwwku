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
} from '@/types'
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

  async updateStatus(id: string, status: Orcamento['status']): Promise<Orcamento> {
    const updated = await pb.collection('orcamentos').update<Orcamento>(
      id,
      { status },
      {
        expand: 'paciente',
      },
    )
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

// =================== ODONTOGRAMA ===================
export const odontogramaService = {
  async getByPaciente(pacienteId: string): Promise<OdontogramaRegistro[]> {
    return await pb.collection('odontograma').getFullList<OdontogramaRegistro>({
      filter: `paciente = "${pacienteId}"`,
      sort: 'dente',
    })
  },

  /** Cria ou atualiza o estado de um dente (um registro por paciente+dente). */
  async salvar(data: {
    paciente: string
    dente: number
    condicao: CondicaoDente
    faces?: FaceDente[]
    observacao?: string
    registrado_por?: string
    data?: string
  }): Promise<OdontogramaRegistro> {
    const corpo: any = {
      paciente: data.paciente,
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
          `paciente = "${data.paciente}" && dente = ${data.dente}`,
        )
    } catch {
      existente = null
    }

    const salvo = existente
      ? await pb.collection('odontograma').update<OdontogramaRegistro>(existente.id, corpo)
      : await pb.collection('odontograma').create<OdontogramaRegistro>(corpo)

    registrarLog(
      existente ? 'editou' : 'criou',
      'prontuario',
      `Odontograma: dente ${data.dente} marcado como ${data.condicao}`,
      salvo.id,
    )
    return salvo
  },

  async remover(registroId: string, dente?: number): Promise<boolean> {
    const ok = await pb.collection('odontograma').delete(registroId)
    registrarLog(
      'excluiu',
      'prontuario',
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
