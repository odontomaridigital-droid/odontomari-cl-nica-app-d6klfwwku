import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  pacientesService,
  tiposAtendimentoService,
  consultasService,
  bloqueiosService,
  configuracoesService,
} from '@/services/clinica'
import { Paciente, TipoAtendimento, ClinicaConfig } from '@/types'
import { BuscaComLista, ItemBusca } from '@/components/busca/BuscaComLista'
import {
  getTodayDateString,
  addMinutesToTime,
  formatCurrency,
  isWeekend,
  generateTimeSlots,
} from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar as CalendarioUI } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ptBR } from 'date-fns/locale'
import { formatDateBr } from '@/lib/formatters'
import { dataDeChave, chaveDeData } from '@/lib/semana'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar, Clock, User, Plus, AlertCircle, Search, Check, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { textoPreferenciaHorario } from '@/lib/pacienteCampos'
import { PacienteAvatar } from '@/components/PacienteAvatar'

export const NovoAgendamentoPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const initialDate = searchParams.get('data') || getTodayDateString()
  const initialHora = searchParams.get('hora') || '09:00'
  const initialPacienteId = searchParams.get('pacienteId') || ''

  const [date, setDate] = useState<string>(initialDate)
  const [horaInicio, setHoraInicio] = useState<string>(initialHora)
  const [duracaoMinutos, setDuracaoMinutos] = useState<number>(30)
  const [horaFim, setHoraFim] = useState<string>('09:30')
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>(initialPacienteId)
  /** Marca visualmente os campos obrigatórios que faltam depois de tentar salvar */
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [selectedTipoId, setSelectedTipoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [config, setConfig] = useState<ClinicaConfig | null>(null)

  const [pacienteSearch, setPacienteSearch] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Quick new patient inline form
  const [showNewPatientModal, setShowNewPatientModal] = useState<boolean>(false)
  const [newPacNome, setNewPacNome] = useState('')
  const [newPacTelefone, setNewPacTelefone] = useState('')
  const [savingNewPac, setSavingNewPac] = useState(false)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const [pacList, tipoList, cfg] = await Promise.all([
          pacientesService.getAll(),
          tiposAtendimentoService.getAll(true),
          configuracoesService.getConfigs(),
        ])
        setPacientes(pacList)
        setTipos(tipoList)
        setConfig(cfg)

        if (tipoList.length > 0 && !selectedTipoId) {
          setSelectedTipoId(tipoList[0].id)
          setDuracaoMinutos(tipoList[0].duracao_minutos)
          setHoraFim(addMinutesToTime(horaInicio, tipoList[0].duracao_minutos))
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Update horaFim when horaInicio or duracao changes
  useEffect(() => {
    if (horaInicio && duracaoMinutos) {
      setHoraFim(addMinutesToTime(horaInicio, duracaoMinutos))
    }
  }, [horaInicio, duracaoMinutos])

  // When tipo selection changes, automatically fill duration
  const handleTipoChange = (tipoId: string) => {
    setSelectedTipoId(tipoId)
    const chosen = tipos.find((t) => t.id === tipoId)
    if (chosen) {
      setDuracaoMinutos(chosen.duracao_minutos)
      setHoraFim(addMinutesToTime(horaInicio, chosen.duracao_minutos))
    }
  }

  const handleCreateQuickPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPacNome.trim() || !newPacTelefone.trim()) {
      toast({
        title: 'Dados obrigatórios',
        description: 'Informe o nome e o telefone do paciente.',
        variant: 'destructive',
      })
      return
    }

    setSavingNewPac(true)
    try {
      const created = await pacientesService.create({
        nome: newPacNome.trim(),
        telefone: newPacTelefone.trim(),
      })
      setPacientes((prev) => [created, ...prev])
      setSelectedPacienteId(created.id)
      setShowNewPatientModal(false)
      setNewPacNome('')
      setNewPacTelefone('')
      toast({
        title: 'Paciente cadastrado!',
        description: `${created.nome} foi selecionado para o agendamento.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar paciente',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingNewPac(false)
    }
  }

  /** O que ainda falta para poder agendar — usado no aviso e no botão */
  const pendencias = React.useMemo(() => {
    const faltas: string[] = []
    if (!selectedPacienteId) faltas.push('paciente')
    if (!selectedTipoId) faltas.push('tipo de atendimento')
    if (!date) faltas.push('data')
    if (!horaInicio) faltas.push('horário')
    return faltas
  }, [selectedPacienteId, selectedTipoId, date, horaInicio])

  const podeSalvar = pendencias.length === 0 && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setTentouSalvar(true)

    if (!selectedPacienteId) {
      setError('Selecione o paciente para a consulta.')
      return
    }
    if (!selectedTipoId) {
      setError('Selecione o tipo de atendimento.')
      return
    }
    if (!date) {
      setError('Escolha a data da consulta.')
      return
    }
    if (!horaInicio) {
      setError('Escolha o horário de início.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Check if day is blocked or weekend blocked
      const bloqs = await bloqueiosService.getByDate(date)
      const isWeekendDay = isWeekend(date)
      const weekendDefaultBlocked = config?.bloquear_fins_de_semana ?? true
      const dayBlockRecord = bloqs.find((b) => b.dia_inteiro && b.tipo !== 'desbloqueio_fds')
      const weekendUnlocked = bloqs.find((b) => b.tipo === 'desbloqueio_fds')

      if (dayBlockRecord || (isWeekendDay && weekendDefaultBlocked && !weekendUnlocked)) {
        throw new Error('Esta data está bloqueada para novos atendimentos na agenda da clínica.')
      }

      // 2. Check overlap with other consultations on same day
      const dayConsultas = await consultasService.getByDate(date)
      const overlap = dayConsultas.find(
        (c) =>
          c.status !== 'cancelada' &&
          ((horaInicio >= c.hora_inicio && horaInicio < c.hora_fim) ||
            (horaFim > c.hora_inicio && horaFim <= c.hora_fim) ||
            (horaInicio <= c.hora_inicio && horaFim >= c.hora_fim)),
      )

      if (overlap) {
        throw new Error(
          `Conflito de horário com o atendimento de ${overlap.expand?.paciente?.nome || 'outro paciente'} (${overlap.hora_inicio} às ${overlap.hora_fim}).`,
        )
      }

      // 3. Create appointment
      await consultasService.create({
        paciente: selectedPacienteId,
        tipo_atendimento: selectedTipoId,
        data: date,
        hora_inicio: horaInicio,
        duracao_minutos: duracaoMinutos,
        hora_fim: horaFim,
        status: 'agendada',
        observacoes: observacoes.trim(),
      })

      toast({
        title: 'Consulta agendada com sucesso!',
        description: `Agendada para ${date} às ${horaInicio}.`,
      })
      navigate('/agenda')
    } catch (err: any) {
      setError(err.message || 'Erro ao agendar consulta.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPacientes = pacientes.filter(
    (p) =>
      p.nome.toLowerCase().includes(pacienteSearch.toLowerCase()) ||
      p.telefone.includes(pacienteSearch),
  )

  const selectedPaciente = pacientes.find((p) => p.id === selectedPacienteId)
  const selectedTipo = tipos.find((t) => t.id === selectedTipoId)

  const availableSlots = generateTimeSlots(
    config?.horario_inicio || '08:00',
    config?.horario_fim || '18:00',
    config?.intervalo_minutos || 30,
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 md:pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-marca-vermelho" />
          Novo Agendamento de Consulta
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Selecione o paciente, o tipo de atendimento e o horário desejado.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Aviso fixo quando falta preencher algo. Fica visível o tempo todo, e
          não só no topo: antes o erro aparecia acima do formulário e quem
          estava com o botão à vista não percebia. */}
      {pendencias.length > 0 && (
        <div className="sticky top-2 z-10 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-[11px] sm:text-xs text-amber-900 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Falta preencher: <strong className="font-semibold">{pendencias.join(', ')}</strong>
            </span>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Paciente */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader
            className={`pb-3 ${tentouSalvar && !selectedPacienteId ? 'bg-red-50/60 rounded-t-lg' : ''}`}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {tentouSalvar && !selectedPacienteId && (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <User className="w-4 h-4 text-marca-vermelho" />
                1. Identificação do Paciente
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-marca-vermelho-escuro border-marca-vermelho/40 hover:bg-marca-vermelho-claro"
                onClick={() => setShowNewPatientModal(!showNewPatientModal)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {showNewPatientModal ? 'Fechar' : 'Cadastrar Paciente Rápido'}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Escolha um paciente cadastrado ou adicione um novo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick new patient box */}
            {showNewPatientModal && (
              <div className="p-4 bg-marca-vermelho-claro/60 border border-marca-vermelho/30 rounded-lg space-y-3">
                <h4 className="text-xs font-semibold text-marca-vermelho-escuro flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-marca-vermelho" />
                  Cadastro Rápido de Paciente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome Completo *</Label>
                    <Input
                      placeholder="Nome do paciente"
                      value={newPacNome}
                      onChange={(e) => setNewPacNome(e.target.value)}
                      className="bg-white text-xs h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp / Telefone *</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={newPacTelefone}
                      onChange={(e) => setNewPacTelefone(e.target.value)}
                      className="bg-white text-xs h-9"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs h-8"
                    onClick={() => setShowNewPatientModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-8"
                    onClick={handleCreateQuickPaciente}
                    disabled={savingNewPac}
                  >
                    {savingNewPac ? 'Salvando...' : 'Salvar e Selecionar'}
                  </Button>
                </div>
              </div>
            )}

            {/* Selected Paciente Display or Search */}
            {selectedPaciente ? (
              <div className="p-3 bg-marca-vermelho-claro/70 border border-marca-vermelho/30 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-marca-vermelho-escuro flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-marca-vermelho" />
                    {selectedPaciente.nome}
                  </p>
                  <p className="text-xs text-red-800/80 mt-0.5">
                    Tel: {selectedPaciente.telefone}
                    {selectedPaciente.email ? ` • ${selectedPaciente.email}` : ''}
                  </p>
                  {(() => {
                    const pref = textoPreferenciaHorario(selectedPaciente)
                    return pref ? (
                      <p className="text-[11px] text-amber-800 mt-1 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 shrink-0" />
                        Paciente prefere: {pref}
                      </p>
                    ) : null
                  })()}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setSelectedPacienteId('')}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <BuscaComLista
                itens={pacientes.map<ItemBusca>((p) => ({
                  id: p.id,
                  nome: p.nome,
                  detalhe: [
                    p.telefone,
                    textoPreferenciaHorario(p) ? `Prefere: ${textoPreferenciaHorario(p)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  original: p,
                }))}
                placeholder="Buscar paciente por nome ou telefone..."
                vazioTexto="Nenhum paciente encontrado com esse termo."
                onSelecionar={(it) => setSelectedPacienteId(it.id)}
                alturaMaxima={288}
              />
            )}
          </CardContent>
        </Card>

        {/* Step 2: Tipo de Atendimento */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-marca-vermelho" />
              2. Procedimento / Tipo de Atendimento
              <span className="text-marca-vermelho">*</span>
            </CardTitle>
            <CardDescription className="text-xs">
              A duração é preenchida automaticamente na agenda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {tipos.map((t) => {
                const isSelected = selectedTipoId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTipoChange(t.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-marca-vermelho bg-marca-vermelho-claro/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900">
                        {t.nome}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-marca-vermelho shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                      <span className="flex items-center gap-1 font-medium text-marca-vermelho-escuro">
                        <Clock className="w-3 h-3" />
                        {t.duracao_minutos} minutos
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Data e Horário */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-marca-vermelho" />
              3. Data e Horário do Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="data" className="text-xs">
                  Data da Consulta *
                </Label>
                {/* Calendário em português: o campo nativo usa mm/dd no navegador */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="data"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal text-xs sm:text-sm mt-1"
                    >
                      <Calendar className="w-4 h-4 mr-2 text-marca-vermelho" />
                      {formatDateBr(date)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarioUI
                      mode="single"
                      locale={ptBR}
                      selected={dataDeChave(date)}
                      defaultMonth={dataDeChave(date)}
                      onSelect={(d) => {
                        if (d) setDate(chaveDeData(d))
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="hora_inicio" className="text-xs">
                  Hora de Início *
                </Label>
                <select
                  id="hora_inicio"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-md bg-white mt-1 outline-none focus:ring-2 focus:ring-marca-vermelho"
                >
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="duracao" className="text-xs">
                  Duração (minutos)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="duracao"
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(Number(e.target.value))}
                    className="text-xs sm:text-sm"
                  />
                  <div className="text-xs font-mono bg-slate-100 px-2.5 py-2 rounded text-slate-700 whitespace-nowrap">
                    Término: <b>{horaFim}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
              <span>
                Horário reservado na agenda:{' '}
                <strong className="text-marca-vermelho-escuro">
                  {horaInicio} às {horaFim}
                </strong>{' '}
                ({duracaoMinutos} min)
              </span>
              <span className="text-slate-400">Sem sobreposição</span>
            </div>

            <div>
              <Label htmlFor="obs" className="text-xs">
                Observações / Queixa Principal (opcional)
              </Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Ex.: Paciente com dor no molar superior direito..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="text-xs sm:text-sm mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/agenda')}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="submit"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white min-w-[140px] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
              disabled={!podeSalvar}
            >
              {submitting ? 'Gravando...' : 'Confirmar Agendamento'}
            </Button>
            {pendencias.length > 0 && (
              <p className="text-[10px] text-slate-500">
                Preencha os campos obrigatórios para liberar
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
