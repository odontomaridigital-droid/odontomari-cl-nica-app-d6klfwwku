import React, { useState, useEffect, useCallback } from 'react'
import { logsService, LogAuditoria, AcaoLog } from '@/services/logsAuditoria'
import { useAuth } from '@/contexts/AuthContext'
import { formatDateBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck,
  Search,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  User,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const OPCOES_ACAO: { valor: AcaoLog | 'todas'; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas as ações' },
  { valor: 'criou', rotulo: 'Criou' },
  { valor: 'editou', rotulo: 'Editou' },
  { valor: 'excluiu', rotulo: 'Excluiu' },
  { valor: 'login', rotulo: 'Login' },
]

const ROTULO_ENTIDADE: Record<string, string> = {
  paciente: 'Paciente',
  consulta: 'Consulta / Prontuário',
  planejamento: 'Planejamento de Tratamento',
  receita: 'Receita',
  anamnese: 'Anamnese',
  medicamento: 'Medicamento',
  tipo_atendimento: 'Tipo de Atendimento',
  configuracoes: 'Configurações',
  bloqueio: 'Bloqueio de Agenda',
}

const COR_ACAO: Record<string, string> = {
  criou: 'bg-blue-50 text-blue-700 border-blue-200',
  editou: 'bg-amber-50 text-amber-700 border-amber-200',
  excluiu: 'bg-red-50 text-red-700 border-red-200',
  login: 'bg-slate-100 text-slate-600 border-slate-200',
}

const formatarDataHora = (iso?: string): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return `${formatDateBr(iso)} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return iso
  }
}

const PER_PAGE = 30

export const LogsPage: React.FC = () => {
  const { isAdmin } = useAuth()

  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState<AcaoLog | 'todas'>('todas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const result = await logsService.listar({
        busca,
        acao,
        dataInicio,
        dataFim,
        page,
        perPage: PER_PAGE,
      })
      setLogs(result.itens)
      setTotalPages(result.totalPages)
      setTotal(result.total)
    } catch {
      setLogs([])
      setTotalPages(1)
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [busca, acao, dataInicio, dataFim, page])

  useEffect(() => {
    if (isAdmin) carregar()
  }, [carregar, isAdmin])

  const aplicarBusca = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setBusca(buscaInput)
  }

  const mudarFiltro = (aplicar: () => void) => {
    aplicar()
    setPage(1)
  }

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-xs text-slate-500 mt-1">
          Apenas o perfil Administrador pode consultar o log de auditoria.
        </p>
      </Card>
    )
  }

  const limparFiltros = () => {
    mudarFiltro(() => {
      setBuscaInput('')
      setBusca('')
      setAcao('todas')
      setDataInicio('')
      setDataFim('')
    })
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-marca-vermelho" />
            Logs de Auditoria
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Registro de tudo que é feito no aplicativo: quem fez, o que fez e quando
          </p>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 w-fit">
          {total} {total === 1 ? 'registro' : 'registros'}
        </Badge>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-3 space-y-3">
          <form onSubmit={aplicarBusca} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input
                placeholder="Buscar por usuário ou descrição..."
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
            <Button type="submit" variant="secondary" className="text-xs sm:text-sm">
              Buscar
            </Button>
            {busca && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  mudarFiltro(() => {
                    setBuscaInput('')
                    setBusca('')
                  })
                }
                className="text-xs sm:text-sm"
              >
                Limpar
              </Button>
            )}
          </form>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 sm:max-w-[180px]">
              <Label className="text-[11px] text-slate-500">Tipo de ação</Label>
              <Select
                value={acao}
                onValueChange={(v) => mudarFiltro(() => setAcao(v as AcaoLog | 'todas'))}
              >
                <SelectTrigger className="mt-1 h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_ACAO.map((op) => (
                    <SelectItem key={op.valor} value={op.valor}>
                      {op.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] text-slate-500">Data inicial</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => mudarFiltro(() => setDataInicio(e.target.value))}
                className="mt-1 h-9 text-xs sm:text-sm"
              />
            </div>

            <div>
              <Label className="text-[11px] text-slate-500">Data final</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => mudarFiltro(() => setDataFim(e.target.value))}
                className="mt-1 h-9 text-xs sm:text-sm"
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={limparFiltros}
              className="text-xs sm:text-sm h-9"
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <Loader2 className="w-8 h-8 text-marca-vermelho animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
            <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-medium text-slate-700 text-sm">Nenhum registro encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {busca || acao !== 'todas' || dataInicio || dataFim
                ? 'Nenhum resultado para os filtros aplicados.'
                : 'As ações realizadas no aplicativo aparecerão aqui automaticamente.'}
            </p>
          </Card>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              {/* Quando */}
              <div className="sm:w-36 shrink-0 text-xs text-slate-500 font-medium">
                {formatarDataHora(log.created)}
              </div>

              {/* Quem */}
              <div className="sm:w-48 shrink-0 flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-marca-vermelho flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                  {(log.usuario_nome || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {log.usuario_nome}
                  </p>
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      log.papel === 'admin' ? 'text-marca-vermelho' : 'text-slate-400',
                    )}
                  >
                    {log.papel === 'admin' ? 'Administrador' : 'Recepção'}
                  </span>
                </div>
              </div>

              {/* Ação + entidade */}
              <div className="sm:w-56 shrink-0 flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 capitalize', COR_ACAO[log.acao] || '')}
                >
                  {log.acao}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  {ROTULO_ENTIDADE[log.entidade] || log.entidade}
                </span>
              </div>

              {/* Descrição */}
              <p className="text-xs text-slate-700 flex-1 min-w-0 break-words">{log.descricao}</p>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          <span className="text-xs text-slate-500 font-medium">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
