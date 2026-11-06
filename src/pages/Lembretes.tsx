import React, { useState, useEffect } from 'react'
import { consultasService, configuracoesService } from '@/services/clinica'
import { Consulta, ClinicaConfig } from '@/types'
import {
  getTodayDateString,
  formatDateBr,
  formatPhone,
  createWhatsAppUrl,
  getDayOfWeekName,
} from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Calendar,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const LembretesPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [date, setDate] = useState<string>(getTodayDateString())
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const loadData = async (dateStr: string) => {
    setLoading(true)
    try {
      const [cons, cfg] = await Promise.all([
        consultasService.getByDate(dateStr),
        configuracoesService.getConfigs(),
      ])
      setConsultas(cons)
      setConfig(cfg)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar consultas para lembretes',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(date)
  }, [date])

  const generateMessage = (c: Consulta): string => {
    const pacienteNome = c.expand?.paciente?.nome || 'Paciente'
    const hora = c.hora_inicio
    const dataFmt = formatDateBr(c.data)
    const tipo = c.expand?.tipo_atendimento?.nome || 'consulta odontológica'

    let template =
      config?.mensagem_lembrete_padrao ||
      'Olá {paciente}, confirmamos sua consulta ({tipo}) na Clínica Odontomari no dia {data} às {hora}. Para confirmar sua presença, por favor responda esta mensagem.'

    return template
      .replace('{paciente}', pacienteNome)
      .replace('{data}', dataFmt)
      .replace('{hora}', hora)
      .replace('{tipo}', tipo)
  }

  const handleSendReminder = async (c: Consulta) => {
    const paciente = c.expand?.paciente
    if (!paciente?.telefone) {
      toast({
        title: 'Sem telefone',
        description: 'Paciente não possui número de WhatsApp cadastrado.',
        variant: 'destructive',
      })
      return
    }

    const message = generateMessage(c)
    const url = createWhatsAppUrl(paciente.telefone, message)

    // Open WhatsApp Web / App
    window.open(url, '_blank')

    // Register that reminder was sent
    setMarkingId(c.id)
    try {
      const senderName = user?.name || 'Recepção'
      await consultasService.markLembreteEnviado(c.id, senderName)
      toast({
        title: 'Envio registrado!',
        description: `Lembrete marcado como enviado por ${senderName}.`,
      })
      loadData(date)
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar envio',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setMarkingId(null)
    }
  }

  const handlePrevDay = () => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDate(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setDate(d.toISOString().split('T')[0])
  }

  const enviadasCount = consultas.filter((c) => c.lembrete_enviado).length
  const pendentesCount = consultas.filter(
    (c) => !c.lembrete_enviado && c.status !== 'cancelada',
  ).length

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-teal-600" />
            Lembretes de Consultas (WhatsApp)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Mensagens prontas para envio aos pacientes com registro automático
          </p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-2">
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(getTodayDateString())}
            className="text-xs h-9"
          >
            Hoje
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total de Consultas</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">{consultas.length}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-medium">Lembretes Pendentes</p>
              <h3 className="text-xl font-bold text-amber-900 mt-0.5">{pendentesCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 font-medium">Lembretes Já Enviados</p>
              <h3 className="text-xl font-bold text-emerald-900 mt-0.5">{enviadasCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultas List with Prepared Messages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Consultas agendadas para {getDayOfWeekName(date)}, {formatDateBr(date)}
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando consultas...</p>
          </div>
        ) : consultas.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-medium text-slate-700 text-sm">
              Nenhuma consulta agendada nesta data
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Nenhum lembrete a ser disparado para o dia selecionado.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {consultas.map((c) => {
              const pac = c.expand?.paciente
              const tipo = c.expand?.tipo_atendimento
              const msgReady = generateMessage(c)

              return (
                <Card
                  key={c.id}
                  className={`border-slate-200 shadow-sm bg-white transition-all ${
                    c.lembrete_enviado
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-amber-500'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-center shrink-0">
                          <span className="block text-sm font-bold text-slate-800">
                            {c.hora_inicio}
                          </span>
                          <span className="block text-[10px] text-slate-500">até {c.hora_fim}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm sm:text-base">
                              {pac?.nome || 'Paciente não identificado'}
                            </span>
                            {c.lembrete_enviado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Lembrete Enviado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-800 border-amber-300 bg-amber-50 text-xs"
                              >
                                Pendente de envio
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            {tipo?.nome || 'Atendimento'} • Tel: {formatPhone(pac?.telefone)}
                          </p>
                        </div>
                      </div>

                      {/* Action */}
                      <Button
                        onClick={() => handleSendReminder(c)}
                        disabled={markingId === c.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 min-w-[170px]"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {c.lembrete_enviado ? 'Reenviar no WhatsApp' : 'Enviar Lembrete Agora'}
                      </Button>
                    </div>

                    {/* Pre-written message preview */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                        Mensagem formatada para o WhatsApp:
                      </span>
                      <p className="text-xs text-slate-700 italic whitespace-pre-wrap font-sans">
                        "{msgReady}"
                      </p>
                    </div>

                    {/* Meta info about send */}
                    {c.lembrete_enviado && (
                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                        <span>
                          Registrado por: <strong>{c.lembrete_enviado_por || 'Recepção'}</strong>
                        </span>
                        {c.lembrete_data_envio && (
                          <span>
                            Último envio:{' '}
                            {new Date(c.lembrete_data_envio).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
