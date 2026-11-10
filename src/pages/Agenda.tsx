import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  consultasService,
  bloqueiosService,
  configuracoesService,
  pacientesService,
} from '@/services/clinica'
import { Consulta, BloqueioAgenda, ClinicaConfig, Paciente } from '@/types'
import { getTodayDateString, formatDateBr, isWeekend, createWhatsAppUrl } from '@/lib/formatters'
import { getWeekStart, getWeekDays, addDaysToDate, dateKeyOf } from '@/lib/semana'
import { AgendaGrade, AgendaDiaInfo, StatusConsultaBadge } from '@/components/agenda/AgendaGrade'
import { aniversarioDePaciente, textoAniversario } from '@/lib/aniversario'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { Cake, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileEdit,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const AgendaPage: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isAdmin } = useAuth()
  const hoje = getTodayDateString()

  const [weekStart, setWeekStart] = useState<string>(getWeekStart(hoje))
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekEnd = weekDays[6]

  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Bloqueio de dia: guarda a data que está sendo bloqueada/desbloqueada
  const [blockTarget, setBlockTarget] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState<string>('Compromisso da clínica / Feriado')
  const [blockLoading, setBlockLoading] = useState<boolean>(false)

  // Detalhes / status da consulta
  const [selectedConsulta, setSelectedConsulta] = useState<Consulta | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState<boolean>(false)

  const loadData = async (inicio: string, fim: string) => {
    setLoading(true)
    try {
      const [conf, cons, bloq, pacs] = await Promise.all([
        configuracoesService.getConfigs(),
        consultasService.getByDateRange(inicio, fim),
        bloqueiosService.getByDateRange(inicio, fim),
        pacientesService.getAll(),
      ])
      setConfig(conf)
      setConsultas(cons)
      setBloqueios(bloq)
      setPacientes(pacs)
    } catch (err) {
      console.error('Erro ao carregar agenda:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados da agenda.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const recarregar = () => loadData(weekStart, weekEnd)

  useEffect(() => {
    loadData(weekStart, weekEnd)
  }, [weekStart])

  const consultasPorDia = useMemo(() => {
    const mapa: Record<string, Consulta[]> = {}
    for (const c of consultas) {
      const k = dateKeyOf(c.data)
      if (!mapa[k]) mapa[k] = []
      mapa[k].push(c)
    }
    for (const k of Object.keys(mapa)) {
      mapa[k].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    }
    return mapa
  }, [consultas])

  const bloqueiosPorDia = useMemo(() => {
    const mapa: Record<string, BloqueioAgenda[]> = {}
    for (const b of bloqueios) {
      const k = dateKeyOf(b.data)
      if (!mapa[k]) mapa[k] = []
      mapa[k].push(b)
    }
    return mapa
  }, [bloqueios])

  const weekendDefaultBlocked = config?.bloquear_fins_de_semana ?? true

  // Status de bloqueio de um dia específico
  const getDiaStatus = (date: string) => {
    const bloqs = bloqueiosPorDia[date] || []
    const isFds = isWeekend(date)
    const dayBlockRecord = bloqs.find((b) => b.dia_inteiro && b.tipo !== 'desbloqueio_fds')
    const weekendUnlocked = bloqs.find((b) => b.tipo === 'desbloqueio_fds')
    const bloqueado = Boolean(
      dayBlockRecord || (isFds && weekendDefaultBlocked && !weekendUnlocked),
    )
    return { isFds, dayBlockRecord, weekendUnlocked, bloqueado }
  }

  const alvoStatus = blockTarget ? getDiaStatus(blockTarget) : null

  const handleToggleBlockDay = async () => {
    if (!blockTarget || !alvoStatus) return
    const date = blockTarget
    setBlockLoading(true)
    try {
      if (alvoStatus.dayBlockRecord) {
        await bloqueiosService.delete(alvoStatus.dayBlockRecord.id)
        toast({ title: 'Dia desbloqueado com sucesso!' })
      } else if (alvoStatus.isFds && alvoStatus.weekendUnlocked) {
        await bloqueiosService.delete(alvoStatus.weekendUnlocked.id)
        toast({ title: 'Fim de semana bloqueado novamente!' })
      } else if (alvoStatus.isFds) {
        await bloqueiosService.create({
          data: date,
          dia_inteiro: true,
          tipo: 'desbloqueio_fds',
          motivo: 'Atendimento especial de fim de semana',
        })
        toast({ title: 'Fim de semana liberado para agendamentos!' })
      } else {
        await bloqueiosService.create({
          data: date,
          dia_inteiro: true,
          tipo: 'bloqueio',
          motivo: blockReason,
        })
        toast({ title: 'Dia inteiro bloqueado com sucesso!' })
      }
      setBlockTarget(null)
      recarregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar bloqueio',
        description: err.message || 'Falha na operação.',
        variant: 'destructive',
      })
    } finally {
      setBlockLoading(false)
    }
  }

  const [posRealizada, setPosRealizada] = useState<{ navigateTo: string } | null>(null)

  const handleUpdateStatus = async (newStatus: Consulta['status']) => {
    if (!selectedConsulta) return
    try {
      await consultasService.updateStatus(selectedConsulta.id, newStatus)
      toast({ title: `Consulta marcada como: ${newStatus}` })
      setStatusDialogOpen(false)
      const pacId = selectedConsulta.expand?.paciente?.id
      setSelectedConsulta(null)
      if (newStatus === 'realizada' && isAdmin && pacId) {
        setPosRealizada({ navigateTo: `/pacientes/${pacId}/prontuario` })
      }
      recarregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleOpenWhatsApp = (c: Consulta) => {
    const pacNome = c.expand?.paciente?.nome || 'Paciente'
    const fone = c.expand?.paciente?.telefone || ''
    if (!fone) {
      toast({
        title: 'Sem telefone',
        description: 'Paciente não possui número de WhatsApp cadastrado.',
        variant: 'destructive',
      })
      return
    }
    const msg = `Olá ${pacNome}, confirmamos sua consulta odontológica na Odontomari no dia ${formatDateBr(c.data)} às ${c.hora_inicio}. Podemos confirmar sua presença?`
    window.open(createWhatsAppUrl(fone, msg), '_blank')
  }

  const handleNovoAgendamento = (data: string, hora?: string) => {
    navigate(`/novo-agendamento?data=${data}${hora ? `&hora=${hora}` : ''}`)
  }

  // Botão "Novo Agendamento" do topo: hoje se estiver na semana exibida, senão a segunda
  const dataNovoAgendamento = weekDays.includes(hoje) ? hoje : weekStart

  // Informação de cada dia para a grade
  const diasGrade: AgendaDiaInfo[] = useMemo(
    () =>
      weekDays.map((dia) => {
        const st = getDiaStatus(dia)
        return {
          data: dia,
          isHoje: dia === hoje,
          consultas: consultasPorDia[dia] || [],
          bloqueado: st.bloqueado,
          isFds: st.isFds,
          desbloqueadoFds: Boolean(st.weekendUnlocked),
          motivoBloqueio: st.dayBlockRecord?.motivo,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekDays, consultasPorDia, bloqueiosPorDia, weekendDefaultBlocked, hoje],
  )

  const selectedPac = selectedConsulta?.expand?.paciente

  // Pacientes que fazem aniversário hoje (banner do topo)
  const aniversariantesHoje = useMemo(
    () =>
      pacientes
        .map((p) => ({ p, aniv: aniversarioDePaciente(p.data_nascimento) }))
        .filter((x) => x.aniv?.ehHoje),
    [pacientes],
  )

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-marca-vermelho" />
            Agenda da Semana
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {formatDateBr(weekStart)} a {formatDateBr(weekEnd)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekStart(addDaysToDate(weekStart, -7))}
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => {
                if (e.target.value) setWeekStart(getWeekStart(e.target.value))
              }}
              title="Ir para a semana da data"
              className="bg-transparent text-xs sm:text-sm font-medium px-2 py-1 outline-none text-slate-700 cursor-pointer"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekStart(addDaysToDate(weekStart, 7))}
              title="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(getWeekStart(hoje))}
            className="text-xs h-9"
          >
            Semana atual
          </Button>

          <Button
            size="sm"
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white h-9 text-xs"
            onClick={() => handleNovoAgendamento(dataNovoAgendamento)}
            disabled={getDiaStatus(dataNovoAgendamento).bloqueado}
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Banner de aniversariantes do dia */}
      {aniversariantesHoje.length > 0 && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
            <Cake className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-pink-900">
              {aniversariantesHoje.length === 1
                ? 'Aniversariante do dia!'
                : `${aniversariantesHoje.length} aniversariantes hoje!`}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {aniversariantesHoje.map(({ p, aniv }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/pacientes/${p.id}/prontuario`)}
                  className="flex items-center gap-2 rounded-full bg-white border border-pink-200 pl-1 pr-3 py-1 hover:border-pink-400 transition-colors"
                  title={`Abrir prontuário de ${p.nome}`}
                >
                  <PacienteAvatar paciente={p} className="w-6 h-6" textClassName="text-[9px]" />
                  <span className="text-xs font-semibold text-pink-900">{p.nome}</span>
                  <span className="text-[10px] text-pink-600">
                    {textoAniversario(0, p.data_nascimento)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grade semanal de horários (estilo calendário) */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-3 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando agenda...</p>
        </div>
      ) : (
        <AgendaGrade
          dias={diasGrade}
          horarioInicio={config?.horario_inicio || '08:00'}
          horarioFim={config?.horario_fim || '18:00'}
          intervaloMinutos={config?.intervalo_minutos || 30}
          onOpenConsulta={(c) => {
            setSelectedConsulta(c)
            setStatusDialogOpen(true)
          }}
          onNovoAgendamento={handleNovoAgendamento}
          onToggleBloqueio={setBlockTarget}
        />
      )}

      {/* Legenda */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-marca-vermelho" />
          Horário da clínica: {config?.horario_inicio || '08:00'} às{' '}
          {config?.horario_fim || '18:00'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-marca-vermelho inline-block" />
          Consulta agendada
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Confirmada
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Realizada
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          Faltou / Bloqueado
        </span>
      </div>

      {/* Block Day Dialog */}
      <Dialog open={blockTarget !== null} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alvoStatus?.bloqueado ? 'Desbloquear Dia' : 'Bloquear Dia Inteiro'}
            </DialogTitle>
            <DialogDescription>
              {alvoStatus?.bloqueado
                ? `Deseja liberar o dia ${formatDateBr(blockTarget || '')} para novos agendamentos de consultas?`
                : `Ao bloquear o dia ${formatDateBr(blockTarget || '')}, novos agendamentos serão restritos.`}
            </DialogDescription>
          </DialogHeader>

          {!alvoStatus?.bloqueado && (
            <div className="space-y-3 py-2">
              <label className="text-xs font-medium text-slate-700">Motivo do Bloqueio:</label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex.: Feriado municipal, curso do dentista, folga"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBlockTarget(null)} disabled={blockLoading}>
              Cancelar
            </Button>
            <Button
              className={
                alvoStatus?.bloqueado
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
              onClick={handleToggleBlockDay}
              disabled={blockLoading}
            >
              {blockLoading
                ? 'Processando...'
                : alvoStatus?.bloqueado
                  ? 'Confirmar Desbloqueio'
                  : 'Confirmar Bloqueio do Dia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consulta details / status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Consulta</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1">
                <p className="font-medium text-slate-900">
                  {selectedPac?.nome || 'Paciente não identificado'}
                </p>
                {selectedConsulta && (
                  <p className="text-xs text-slate-500">
                    {formatDateBr(selectedConsulta.data)} · {selectedConsulta.hora_inicio} às{' '}
                    {selectedConsulta.hora_fim} ·{' '}
                    {selectedConsulta.expand?.tipo_atendimento?.nome || 'Procedimento odontológico'}
                  </p>
                )}
                {selectedConsulta && <StatusConsultaBadge status={selectedConsulta.status} />}
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedConsulta && (selectedPac?.telefone || selectedPac?.id) && (
            <div className="flex flex-wrap gap-2">
              {selectedPac?.telefone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => handleOpenWhatsApp(selectedConsulta)}
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                  WhatsApp
                </Button>
              )}
              {selectedPac?.telefone && (
                <span className="text-xs text-slate-500 flex items-center gap-1 self-center">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {selectedPac.telefone}
                </span>
              )}
              {selectedPac?.id && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs bg-slate-100 hover:bg-slate-200"
                  onClick={() => navigate(`/pacientes/${selectedPac.id}/prontuario`)}
                >
                  <FileEdit className="w-3.5 h-3.5 mr-1 text-slate-600" />
                  Prontuário
                </Button>
              )}
            </div>
          )}

          <p className="text-xs font-medium text-slate-600">Alterar status</p>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              className="justify-start border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              onClick={() => handleUpdateStatus('confirmada')}
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
              Confirmada
            </Button>
            <Button
              variant="outline"
              className="justify-start border-blue-200 text-blue-800 hover:bg-blue-50"
              onClick={() => handleUpdateStatus('realizada')}
            >
              <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
              Realizada (Concluída)
            </Button>
            <Button
              variant="outline"
              className="justify-start border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => handleUpdateStatus('agendada')}
            >
              <Clock className="w-4 h-4 mr-2 text-slate-500" />
              Agendada (Pendente)
            </Button>
            <Button
              variant="outline"
              className="justify-start border-amber-200 text-amber-800 hover:bg-amber-50"
              onClick={() => handleUpdateStatus('faltou')}
            >
              <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" />
              Paciente Faltou
            </Button>
            <Button
              variant="outline"
              className="justify-start border-red-200 text-red-800 hover:bg-red-50"
              onClick={() => handleUpdateStatus('cancelada')}
            >
              <XCircle className="w-4 h-4 mr-2 text-red-600" />
              Cancelada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pós-realização: abrir prontuário ou deixar para depois (só dentista/admin) */}
      <Dialog
        open={posRealizada !== null}
        onOpenChange={(o) => {
          if (!o) setPosRealizada(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-marca-vermelho" />
              Registrar atendimento
            </DialogTitle>
            <DialogDescription>
              Consulta marcada como realizada. Quer registrar agora a evolução/procedimentos no
              prontuário do paciente?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPosRealizada(null)}>
              Depois
            </Button>
            <Button
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={() => {
                const destino = posRealizada?.navigateTo
                setPosRealizada(null)
                if (destino) navigate(destino)
              }}
            >
              <FileEdit className="w-4 h-4 mr-1" />
              Abrir prontuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
