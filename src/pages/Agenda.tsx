import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  consultasService,
  bloqueiosService,
  configuracoesService,
  pacientesService,
  mensagensAutomaticasService,
  enviosMensagemService,
  preencherMensagem,
} from '@/services/clinica'
import {
  Consulta,
  BloqueioAgenda,
  ClinicaConfig,
  Paciente,
  MensagemAutomatica,
  EnvioMensagem,
} from '@/types'
import { getTodayDateString, formatDateBr, isWeekend, createWhatsAppUrl } from '@/lib/formatters'
import {
  getWeekStart,
  getWeekDays,
  addDaysToDate,
  dateKeyOf,
  dataDeChave,
  chaveDeData,
} from '@/lib/semana'
import { AgendaGrade, AgendaDiaInfo, StatusConsultaBadge } from '@/components/agenda/AgendaGrade'
import { FaixaAniversario } from '@/components/agenda/AniversariantesFaixa'
import { aniversarioNaJanela } from '@/lib/aniversario'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { Cake, ClipboardList, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ptBR } from 'date-fns/locale'
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
  const { isAdmin, user } = useAuth()
  const hoje = getTodayDateString()

  const [weekStart, setWeekStart] = useState<string>(getWeekStart(hoje))
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekEnd = weekDays[6]

  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  // Mensagem de aniversário em uso e quem já recebeu neste ano.
  const [mensagemAniversario, setMensagemAniversario] = useState<MensagemAutomatica | null>(null)
  const [enviosAniversario, setEnviosAniversario] = useState<EnvioMensagem[]>([])

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

      // Mensagem ativa e envios do ano — para marcar quem já recebeu.
      const [msg, envios] = await Promise.all([
        mensagensAutomaticasService.getAtiva('aniversario'),
        enviosMensagemService.getDoAno('aniversario'),
      ])
      setMensagemAniversario(msg)
      setEnviosAniversario(envios)
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

  const idsEnviadosAniversario = new Set(
    enviosAniversario.filter((e) => e.status === 'enviado').map((e) => e.paciente),
  )

  /**
   * Abre o WhatsApp com a mensagem já escrita (variáveis preenchidas) e registra
   * o envio, para a recepção não parabenizar o mesmo paciente duas vezes.
   */
  const enviarParabens = async (item: { p: Paciente; janela: { idade: number | null } }) => {
    const texto = preencherMensagem(mensagemAniversario?.texto || '', {
      pacienteNome: item.p.nome,
      idade: item.janela.idade,
      clinica: config?.nome_clinica,
      dentista: config?.dentista_nome,
      telefone: config?.telefone_clinica,
    })

    if (item.p.telefone) {
      window.open(createWhatsAppUrl(item.p.telefone, texto), '_blank')
    } else {
      toast({
        title: 'Paciente sem telefone',
        description: `${item.p.nome} não tem telefone cadastrado. A mensagem foi copiada.`,
      })
      try {
        await navigator.clipboard.writeText(texto)
      } catch {
        // sem clipboard, segue
      }
    }

    try {
      await enviosMensagemService.registrar({
        pacienteId: item.p.id,
        mensagemId: mensagemAniversario?.id,
        finalidade: 'aniversario',
        canal: 'whatsapp_manual',
        usuarioId: user?.id,
      })
      setEnviosAniversario(await enviosMensagemService.getDoAno('aniversario'))
    } catch (err: any) {
      toast({
        title: 'Enviou, mas não registrou',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  /** Desfaz o registro de envio (marcou por engano). */
  const desfazerParabens = async (item: { p: Paciente }) => {
    try {
      await enviosMensagemService.desfazer(item.p.id, 'aniversario')
      setEnviosAniversario(await enviosMensagemService.getDoAno('aniversario'))
      toast({ title: 'Registro de envio desfeito' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

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
  const [statusLoading, setStatusLoading] = useState<boolean>(false)

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

  /**
   * Um clique só: o paciente chegou. Marca a consulta como realizada e já
   * abre o prontuário para o dentista registrar odontograma, evolução e receita.
   * Sem tela intermediária — o atendimento começa imediatamente.
   */
  const handleClienteVeio = async (consulta: Consulta | null) => {
    if (!consulta) return
    const pacienteId = consulta.expand?.paciente?.id
    if (!pacienteId) {
      toast({
        title: 'Paciente não identificado',
        description: 'Não foi possível abrir o prontuário desta consulta.',
        variant: 'destructive',
      })
      return
    }

    setStatusLoading(true)
    try {
      await consultasService.updateStatus(consulta.id, 'realizada')
      setStatusDialogOpen(false)
      setSelectedConsulta(null)
      toast({
        title: 'Atendimento iniciado',
        description: 'Consulta marcada como realizada. Registre no prontuário.',
      })
      navigate(`/pacientes/${pacienteId}/prontuario`)
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar chegada',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setStatusLoading(false)
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

  /**
   * Aniversariantes numa janela de 5 dias para trás e 5 para frente.
   * Quem fez aniversário ontem ainda dá tempo de parabenizar; quem faz na
   * semana que vem dá tempo de preparar. Ficam separados em três faixas.
   */
  const aniversariantes = useMemo(() => {
    const itens = pacientes
      .map((p) => ({ p, janela: aniversarioNaJanela(p.data_nascimento, new Date(), 5, 5) }))
      .filter((x): x is { p: Paciente; janela: NonNullable<typeof x.janela> } => x.janela !== null)
      .sort((a, b) => a.janela.offset - b.janela.offset)

    return {
      recentes: itens.filter((x) => x.janela.offset < 0),
      hoje: itens.filter((x) => x.janela.offset === 0),
      proximos: itens.filter((x) => x.janela.offset > 0),
      total: itens.length,
    }
  }, [pacientes])

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
            {/* Calendário em português: o campo nativo do navegador insiste
                no formato americano (mm/dd), então a data é escolhida aqui. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap"
                  title="Escolher a semana pelo calendário"
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-marca-vermelho" />
                  {formatDateBr(weekStart)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  selected={dataDeChave(weekStart)}
                  defaultMonth={dataDeChave(weekStart)}
                  onSelect={(d) => {
                    if (d) setWeekStart(getWeekStart(chaveDeData(d)))
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
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

      {/* Painel de aniversariantes: últimos 5 dias, hoje e próximos 5 dias */}
      {aniversariantes.total > 0 && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
              <Cake className="w-4 h-4" />
            </div>
            <p className="text-sm font-bold text-pink-900">Aniversariantes</p>
            <span className="text-[11px] text-pink-600">
              de {formatDateBr(addDaysToDate(hoje, -5))} a {formatDateBr(addDaysToDate(hoje, 5))}
            </span>
          </div>

          <div className="mt-2.5 space-y-2">
            <FaixaAniversario
              titulo="Já passaram (últimos 5 dias)"
              cor="text-slate-600"
              itens={aniversariantes.recentes}
              onAbrir={(id) => navigate(`/pacientes/${id}/prontuario`)}
              enviados={idsEnviadosAniversario}
              onEnviar={enviarParabens}
              onDesfazerEnvio={desfazerParabens}
            />
            <FaixaAniversario
              titulo="Hoje"
              destaque
              cor="text-pink-700"
              itens={aniversariantes.hoje}
              onAbrir={(id) => navigate(`/pacientes/${id}/prontuario`)}
              enviados={idsEnviadosAniversario}
              onEnviar={enviarParabens}
              onDesfazerEnvio={desfazerParabens}
            />
            <FaixaAniversario
              titulo="Próximos 5 dias"
              cor="text-pink-700"
              itens={aniversariantes.proximos}
              onAbrir={(id) => navigate(`/pacientes/${id}/prontuario`)}
              enviados={idsEnviadosAniversario}
              onEnviar={enviarParabens}
              onDesfazerEnvio={desfazerParabens}
            />
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

          {/* Ação principal: o paciente chegou. Marca como realizada e já abre
              o prontuário para registrar odontograma, evolução e receita. */}
          <Button
            className="w-full justify-start bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white h-11"
            disabled={statusLoading}
            onClick={() => handleClienteVeio(selectedConsulta)}
          >
            <UserCheck className="w-4 h-4 mr-2" />
            <span className="text-left leading-tight">
              Paciente veio — abrir prontuário
              <span className="block text-[10px] font-normal opacity-80">
                Marca como realizada e vai direto para o atendimento
              </span>
            </span>
          </Button>

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
