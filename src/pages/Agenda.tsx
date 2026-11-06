import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { consultasService, bloqueiosService, configuracoesService } from '@/services/clinica'
import { Consulta, BloqueioAgenda, ClinicaConfig } from '@/types'
import {
  getTodayDateString,
  formatDateBr,
  getDayOfWeekName,
  isWeekend,
  generateTimeSlots,
  createWhatsAppUrl,
} from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  User,
  Phone,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  FileEdit,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const AgendaPage: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString())
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Dialogs
  const [blockDayDialogOpen, setBlockDayDialogOpen] = useState<boolean>(false)
  const [blockReason, setBlockReason] = useState<string>('Compromisso da clínica / Feriado')
  const [blockLoading, setBlockLoading] = useState<boolean>(false)

  // Status Change Dialog
  const [selectedConsulta, setSelectedConsulta] = useState<Consulta | null>(null)
  const [statusDialogOpen, setStatusDialogOpen] = useState<boolean>(false)

  const loadData = async (dateStr: string) => {
    setLoading(true)
    try {
      const [conf, cons, bloq] = await Promise.all([
        configuracoesService.getConfigs(),
        consultasService.getByDate(dateStr),
        bloqueiosService.getByDate(dateStr),
      ])
      setConfig(conf)
      setConsultas(cons)
      setBloqueios(bloq)
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

  useEffect(() => {
    loadData(currentDate)
  }, [currentDate])

  const handlePrevDay = () => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const handleToday = () => {
    setCurrentDate(getTodayDateString())
  }

  // Check if whole day is blocked
  const isWeekendDay = isWeekend(currentDate)
  const weekendDefaultBlocked = config?.bloquear_fins_de_semana ?? true

  // Explicit block or unblock
  const dayBlockRecord = bloqueios.find((b) => b.dia_inteiro && b.tipo !== 'desbloqueio_fds')
  const weekendUnlocked = bloqueios.find((b) => b.tipo === 'desbloqueio_fds')

  const isDayFullyBlocked = Boolean(
    dayBlockRecord || (isWeekendDay && weekendDefaultBlocked && !weekendUnlocked),
  )

  const handleToggleBlockDay = async () => {
    setBlockLoading(true)
    try {
      if (dayBlockRecord) {
        // Unblock normal day
        await bloqueiosService.delete(dayBlockRecord.id)
        toast({ title: 'Dia desbloqueado com sucesso!' })
      } else if (isWeekendDay && weekendUnlocked) {
        // Re-lock weekend
        await bloqueiosService.delete(weekendUnlocked.id)
        toast({ title: 'Fim de semana bloqueado novamente!' })
      } else if (isWeekendDay) {
        // Unlock weekend
        await bloqueiosService.create({
          data: currentDate,
          dia_inteiro: true,
          tipo: 'desbloqueio_fds',
          motivo: 'Atendimento especial de fim de semana',
        })
        toast({ title: 'Fim de semana liberado para agendamentos!' })
      } else {
        // Block normal day
        await bloqueiosService.create({
          data: currentDate,
          dia_inteiro: true,
          tipo: 'bloqueio',
          motivo: blockReason,
        })
        toast({ title: 'Dia inteiro bloqueado com sucesso!' })
      }
      setBlockDayDialogOpen(false)
      loadData(currentDate)
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

  const handleUpdateStatus = async (newStatus: Consulta['status']) => {
    if (!selectedConsulta) return
    try {
      await consultasService.updateStatus(selectedConsulta.id, newStatus)
      toast({ title: `Consulta marcada como: ${newStatus}` })
      setStatusDialogOpen(false)
      setSelectedConsulta(null)
      loadData(currentDate)
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

  // Status colors & labels
  const getStatusBadge = (status: Consulta['status']) => {
    switch (status) {
      case 'confirmada':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirmada</Badge>
      case 'realizada':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Realizada</Badge>
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>
      case 'faltou':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">Faltou</Badge>
      default:
        return (
          <Badge variant="secondary" className="bg-slate-200 text-slate-800">
            Agendada
          </Badge>
        )
    }
  }

  // Timeline slots
  const timeSlots = generateTimeSlots(
    config?.horario_inicio || '08:00',
    config?.horario_fim || '18:00',
    config?.intervalo_minutos || 30,
  )

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-teal-600" />
            Agenda do Dia
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {getDayOfWeekName(currentDate)}, {formatDateBr(currentDate)}
          </p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevDay}
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-medium px-2 py-1 outline-none text-slate-700 cursor-pointer"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextDay}
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleToday} className="text-xs h-9">
            Hoje
          </Button>

          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white h-9 text-xs"
            onClick={() => navigate(`/novo-agendamento?data=${currentDate}`)}
            disabled={isDayFullyBlocked}
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Agendamento
          </Button>

          {/* Block / Unblock Day button */}
          <Button
            variant={isDayFullyBlocked ? 'outline' : 'secondary'}
            size="sm"
            className="h-9 text-xs"
            onClick={() => setBlockDayDialogOpen(true)}
          >
            {isDayFullyBlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Desbloquear Dia
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                Bloquear Dia
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Block Alert Banner if Day is Blocked */}
      {isDayFullyBlocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm">
              {isWeekendDay && !dayBlockRecord
                ? 'Fim de semana bloqueado por padrão'
                : 'Dia inteiro bloqueado para atendimentos'}
            </h4>
            <p className="text-xs text-amber-700 mt-0.5">
              {dayBlockRecord?.motivo ||
                'Os fins de semana são bloqueados nas configurações. Para atender hoje, use a opção de desbloquear dia.'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100 text-xs shrink-0"
            onClick={() => setBlockDayDialogOpen(true)}
          >
            Liberar Horários
          </Button>
        </div>
      )}

      {/* Main Agenda Grid / Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Day Consultations List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Atendimentos Marcados ({consultas.length})
            </h2>
            <span className="text-xs text-slate-500">
              Horário da clínica: {config?.horario_inicio || '08:00'} às{' '}
              {config?.horario_fim || '18:00'}
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Carregando consultas...</p>
            </div>
          ) : consultas.length === 0 ? (
            <Card className="bg-white border-dashed border-2 border-slate-200 shadow-none text-center p-8">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-medium text-slate-700 text-sm">Nenhuma consulta para este dia</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isDayFullyBlocked
                  ? 'Este dia está bloqueado. Nenhuma nova consulta agendada.'
                  : 'Os horários deste dia estão livres para novos agendamentos.'}
              </p>
              {!isDayFullyBlocked && (
                <Button
                  size="sm"
                  className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                  onClick={() => navigate(`/novo-agendamento?data=${currentDate}`)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Agendar Primeira Consulta
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {consultas.map((c) => {
                const pac = c.expand?.paciente
                const tipo = c.expand?.tipo_atendimento
                return (
                  <Card
                    key={c.id}
                    className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white"
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Time and Paciente Info */}
                      <div className="flex items-start gap-4">
                        <div className="bg-teal-50 border border-teal-100 rounded-xl p-2.5 text-center min-w-[75px] shrink-0">
                          <span className="block text-sm font-bold text-teal-800">
                            {c.hora_inicio}
                          </span>
                          <span className="block text-[11px] text-teal-600">às {c.hora_fim}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {c.duracao_minutos} min
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm sm:text-base">
                              {pac?.nome || 'Paciente não identificado'}
                            </span>
                            {getStatusBadge(c.status)}
                          </div>

                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            {tipo?.nome || 'Procedimento odontológico'}
                          </p>

                          {pac?.telefone && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {pac.telefone}
                            </p>
                          )}

                          {c.observacoes && (
                            <p className="text-xs text-slate-600 italic mt-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                              Obs: {c.observacoes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        {/* WhatsApp reminder button */}
                        {pac?.telefone && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => handleOpenWhatsApp(c)}
                            title="Conversar / Enviar lembrete no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1" />
                            WhatsApp
                          </Button>
                        )}

                        {/* Status Change Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => {
                            setSelectedConsulta(c)
                            setStatusDialogOpen(true)
                          }}
                        >
                          Status
                        </Button>

                        {/* View Prontuário */}
                        {pac?.id && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 px-2.5 text-xs bg-slate-100 hover:bg-slate-200"
                            onClick={() => navigate(`/pacientes/${pac.id}/prontuario`)}
                            title="Ver histórico e prontuário"
                          >
                            <FileEdit className="w-3.5 h-3.5 mr-1 text-slate-600" />
                            Prontuário
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Quick Free Slots & Day Summary */}
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                Mapa de Horários do Dia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-slate-500 pb-2 border-b border-slate-100">
                Clique em um horário livre para agendar diretamente.
              </div>

              <div className="grid grid-cols-3 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
                {timeSlots.map((slot) => {
                  const occupied = consultas.find(
                    (c) => c.status !== 'cancelada' && slot >= c.hora_inicio && slot < c.hora_fim,
                  )

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isDayFullyBlocked || !!occupied}
                      onClick={() => navigate(`/novo-agendamento?data=${currentDate}&hora=${slot}`)}
                      className={`text-xs py-1.5 px-2 rounded font-mono transition-colors border text-center ${
                        isDayFullyBlocked
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : occupied
                            ? 'bg-teal-100/70 text-teal-900 border-teal-200 font-semibold cursor-not-allowed'
                            : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                      }`}
                    >
                      {slot}
                      {occupied && (
                        <span className="block text-[9px] font-sans truncate text-teal-700">
                          Ocupado
                        </span>
                      )}
                      {!occupied && !isDayFullyBlocked && (
                        <span className="block text-[9px] font-sans text-emerald-600">Livre</span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Livre
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                  Ocupado
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                  Bloqueado
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block Day Dialog */}
      <Dialog open={blockDayDialogOpen} onOpenChange={setBlockDayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isDayFullyBlocked ? 'Desbloquear Dia' : 'Bloquear Dia Inteiro'}
            </DialogTitle>
            <DialogDescription>
              {isDayFullyBlocked
                ? `Deseja liberar o dia ${formatDateBr(currentDate)} para novos agendamentos de consultas?`
                : `Ao bloquear o dia ${formatDateBr(currentDate)}, novos agendamentos serão restritos.`}
            </DialogDescription>
          </DialogHeader>

          {!isDayFullyBlocked && (
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
            <Button
              variant="outline"
              onClick={() => setBlockDayDialogOpen(false)}
              disabled={blockLoading}
            >
              Cancelar
            </Button>
            <Button
              className={
                isDayFullyBlocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
              onClick={handleToggleBlockDay}
              disabled={blockLoading}
            >
              {blockLoading
                ? 'Processando...'
                : isDayFullyBlocked
                  ? 'Confirmar Desbloqueio'
                  : 'Confirmar Bloqueio do Dia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Status da Consulta</DialogTitle>
            <DialogDescription>
              Paciente: {selectedConsulta?.expand?.paciente?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 py-2">
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
    </div>
  )
}
