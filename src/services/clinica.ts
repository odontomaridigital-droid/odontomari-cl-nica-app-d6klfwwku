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
} from '@/types'
import type { RespostasAnamnese } from '@/lib/anamneseModelo'

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

  async create(data: Omit<Paciente, 'id' | 'created' | 'updated'>): Promise<Paciente> {
    return await pb.collection('pacientes').create<Paciente>(data)
  },

  async update(id: string, data: Partial<Paciente>): Promise<Paciente> {
    return await pb.collection('pacientes').update<Paciente>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('pacientes').delete(id)
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
    return await pb.collection('tipos_atendimento').create<TipoAtendimento>(data)
  },

  async update(id: string, data: Partial<TipoAtendimento>): Promise<TipoAtendimento> {
    return await pb.collection('tipos_atendimento').update<TipoAtendimento>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('tipos_atendimento').delete(id)
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
    return await pb.collection('consultas').create<Consulta>(
      {
        ...data,
        data: isoDate,
        lembrete_enviado: false,
      },
      {
        expand: 'paciente,tipo_atendimento',
      },
    )
  },

  async update(id: string, data: Partial<Consulta>): Promise<Consulta> {
    return await pb.collection('consultas').update<Consulta>(id, data, {
      expand: 'paciente,tipo_atendimento',
    })
  },

  async updateStatus(id: string, status: Consulta['status']): Promise<Consulta> {
    return await pb.collection('consultas').update<Consulta>(
      id,
      { status },
      {
        expand: 'paciente,tipo_atendimento',
      },
    )
  },

  async markLembreteEnviado(id: string, enviadoPor: string): Promise<Consulta> {
    return await pb.collection('consultas').update<Consulta>(
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
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('consultas').delete(id)
  },
}

// =================== PRONTUÁRIOS ===================
export const prontuariosService = {
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
  }): Promise<Prontuario> {
    const isoDate = data.data.includes('T') ? data.data : `${data.data} 00:00:00.000Z`
    return await pb.collection('prontuarios').create<Prontuario>(
      {
        ...data,
        data: isoDate,
      },
      {
        expand: 'consulta',
      },
    )
  },

  async update(id: string, data: Partial<Prontuario>): Promise<Prontuario> {
    return await pb.collection('prontuarios').update<Prontuario>(id, data, {
      expand: 'consulta',
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('prontuarios').delete(id)
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
    return await pb.collection('orcamentos').create<Orcamento>(
      {
        ...data,
        data: isoDate,
      },
      {
        expand: 'paciente',
      },
    )
  },

  async update(id: string, data: Partial<Orcamento>): Promise<Orcamento> {
    return await pb.collection('orcamentos').update<Orcamento>(id, data, {
      expand: 'paciente',
    })
  },

  async updateStatus(id: string, status: Orcamento['status']): Promise<Orcamento> {
    return await pb.collection('orcamentos').update<Orcamento>(
      id,
      { status },
      {
        expand: 'paciente',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('orcamentos').delete(id)
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
    return await pb.collection('anamneses').create<Anamnese>(
      {
        ...data,
        data: isoDate,
      },
      {
        expand: 'autor',
      },
    )
  },

  async update(
    id: string,
    data: {
      respostas?: RespostasAnamnese
      data?: string
      autor?: string
    },
  ): Promise<Anamnese> {
    return await pb.collection('anamneses').update<Anamnese>(
      id,
      {
        ...data,
        ...(data.data && !data.data.includes('T') ? { data: `${data.data} 00:00:00.000Z` } : {}),
      },
      {
        expand: 'autor',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('anamneses').delete(id)
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
    return await pb.collection('medicamentos').create<Medicamento>(data)
  },

  async update(id: string, data: Partial<Medicamento>): Promise<Medicamento> {
    return await pb.collection('medicamentos').update<Medicamento>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('medicamentos').delete(id)
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
    return await pb.collection('receitas').create<Receita>(
      {
        ...data,
        data: isoDate,
        origem: data.origem || 'manual',
      },
      {
        expand: 'autor',
      },
    )
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
    return await pb.collection('receitas').update<Receita>(
      id,
      {
        ...data,
        ...(data.data && !data.data.includes('T') ? { data: `${data.data} 00:00:00.000Z` } : {}),
      },
      {
        expand: 'autor',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('receitas').delete(id)
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
    return await pb.collection('bloqueios_agenda').create<BloqueioAgenda>({
      ...data,
      data: isoDate,
      tipo: data.tipo || 'bloqueio',
      dia_inteiro: data.dia_inteiro ?? true,
    })
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('bloqueios_agenda').delete(id)
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
    try {
      const existing = await pb.collection('configuracoes').getFirstListItem(`chave = "${chave}"`)
      await pb.collection('configuracoes').update(existing.id, {
        valor: JSON.stringify(valor),
      })
    } catch {
      await pb.collection('configuracoes').create({
        chave,
        valor: JSON.stringify(valor),
      })
    }
  },

  async saveAllConfigs(configs: Partial<ClinicaConfig>): Promise<void> {
    for (const [key, value] of Object.entries(configs)) {
      if (value !== undefined) {
        await this.saveConfig(key as keyof ClinicaConfig, value)
      }
    }
  },
}
