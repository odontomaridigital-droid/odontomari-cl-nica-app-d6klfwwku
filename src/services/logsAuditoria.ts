import pb from '@/lib/pocketbase/client'

export type AcaoLog = 'criou' | 'editou' | 'excluiu' | 'login'

export type EntidadeLog =
  | 'paciente'
  | 'consulta'
  | 'planejamento'
  | 'receita'
  | 'anamnese'
  | 'medicamento'
  | 'tipo_atendimento'
  | 'configuracoes'
  | 'bloqueio'

export interface LogAuditoria {
  id: string
  usuario_id: string
  usuario_nome: string
  papel: 'admin' | 'recepcao'
  acao: AcaoLog
  entidade: EntidadeLog
  registro_id?: string
  descricao: string
  created: string
}

/**
 * Registra uma entrada no log de auditoria (best-effort).
 * Nunca propaga erro: se o log falhar, a ação principal já foi persistida
 * e não deve ser desfeita nem bloqueada por causa do log.
 */
export async function registrarLog(
  acao: AcaoLog,
  entidade: EntidadeLog,
  descricao: string,
  registroId?: string,
): Promise<void> {
  try {
    const auth = pb.authStore.record
    if (!auth) return

    await pb.collection('logs_auditoria').create({
      usuario_id: auth.id,
      usuario_nome: auth.name || auth.email || 'Usuário',
      papel: (auth.role as 'admin' | 'recepcao') || 'recepcao',
      acao,
      entidade,
      registro_id: registroId || '',
      descricao,
    })
  } catch {
    // Log é best-effort: falha silenciosa para não quebrar a ação principal
  }
}

// =================== Leitura (tela Logs, só admin) ===================

export interface LogsFiltros {
  busca?: string
  acao?: AcaoLog | 'todas'
  dataInicio?: string // YYYY-MM-DD (inclusivo)
  dataFim?: string // YYYY-MM-DD (inclusivo)
  page?: number
  perPage?: number
}

function montarFiltro(f: LogsFiltros): string {
  const partes: string[] = []
  if (f.busca?.trim()) {
    const q = f.busca.trim().replace(/"/g, '')
    partes.push(`(usuario_nome ~ "${q}" || descricao ~ "${q}")`)
  }
  if (f.acao && f.acao !== 'todas') partes.push(`acao = "${f.acao}"`)
  if (f.dataInicio) partes.push(`created >= "${f.dataInicio} 00:00:00.000Z"`)
  if (f.dataFim) partes.push(`created <= "${f.dataFim} 23:59:59.999Z"`)
  return partes.join(' && ')
}

export const logsService = {
  async listar(f: LogsFiltros): Promise<{
    itens: LogAuditoria[]
    total: number
    totalPages: number
    page: number
  }> {
    const page = Math.max(1, f.page || 1)
    const perPage = f.perPage || 30
    const result = await pb.collection('logs_auditoria').getList<LogAuditoria>(page, perPage, {
      filter: montarFiltro(f),
      sort: '-created',
    })
    return {
      itens: result.items,
      total: result.totalItems,
      totalPages: result.totalPages,
      page: result.page,
    }
  },
}
