import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  pacientesService,
  consultasService,
  prontuariosService,
  orcamentosService,
  anamnesesService,
} from '@/services/clinica'
import { Paciente, Consulta, Prontuario, Orcamento, Anamnese } from '@/types'
import { formatDateBr, formatCurrency, formatPhone } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileText,
  User,
  Calendar,
  Clock,
  Plus,
  ShieldAlert,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Stethoscope,
  DollarSign,
  AlertCircle,
  Compass,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { montarEnderecoTexto, enderecoDeRegistro } from '@/lib/endereco'
import { textoPreferenciaHorario, textoOrigem } from '@/lib/pacienteCampos'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { aniversarioDePaciente, textoAniversario } from '@/lib/aniversario'
import { AnamneseTab } from '@/components/anamnese/AnamneseTab'
import { ReceitasTab } from '@/components/receitas/ReceitasTab'
import { OdontogramaTab } from '@/components/odontograma/OdontogramaTab'
import { DitadorProntuario } from '@/components/prontuario/DitadorProntuario'
import { BotaoDitar } from '@/components/voz/BotaoDitar'
import { OdontogramaMapa } from '@/components/odontograma/OdontogramaMapa'
import { DocumentosTab } from '@/components/documentos/DocumentosTab'
import { CondicaoDente, FaceDente } from '@/lib/odontograma'
import { Receita, OdontogramaRegistro, DocumentoEmitido } from '@/types'
import { receitasService, odontogramaService, documentosEmitidosService } from '@/services/clinica'

export const ProntuarioPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const { toast } = useToast()

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [anamneses, setAnamneses] = useState<Anamnese[]>([])
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [odontograma, setOdontograma] = useState<OdontogramaRegistro[]>([])
  const [documentos, setDocumentos] = useState<DocumentoEmitido[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // New Prontuário Dialog (Admin only)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [dataRegistro, setDataRegistro] = useState<string>(new Date().toISOString().split('T')[0])
  const [procedimentos, setProcedimentos] = useState<string>('')
  const [anotacoes, setAnotacoes] = useState<string>('')
  const [denteRegiao, setDenteRegiao] = useState<string>('')
  const [retornoDias, setRetornoDias] = useState<string>('')
  const [textoDitado, setTextoDitado] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)

  /** Data de retorno calculada a partir da data do atendimento + dias informados */
  const retornoCalculado = React.useMemo(() => {
    const dias = Number(retornoDias)
    if (!retornoDias || isNaN(dias) || dias <= 0) return ''
    const base = new Date(`${dataRegistro}T12:00:00`)
    if (isNaN(base.getTime())) return ''
    base.setDate(base.getDate() + dias)
    return base.toISOString().split('T')[0]
  }, [retornoDias, dataRegistro])

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [pac, prontList, consList, orcList, anmList, recList, odoList, docList] =
        await Promise.all([
          pacientesService.getById(id),
          prontuariosService.getByPaciente(id),
          consultasService.getByPaciente(id),
          orcamentosService.getByPaciente(id),
          anamnesesService.getByPaciente(id),
          receitasService.getByPaciente(id),
          odontogramaService.getByPaciente(id),
          documentosEmitidosService.getByPaciente(id),
        ])
      setPaciente(pac)
      setProntuarios(prontList)
      setConsultas(consList)
      setOrcamentos(orcList)
      setAnamneses(anmList)
      setReceitas(recList)
      setOdontograma(odoList)
      setDocumentos(docList)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar prontuário',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleAddProntuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Apenas o dentista / administrador pode registrar anotações de prontuário.',
        variant: 'destructive',
      })
      return
    }
    if (!procedimentos.trim()) {
      toast({
        title: 'Procedimento obrigatório',
        description: 'Descreva os procedimentos realizados.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await prontuariosService.create({
        paciente: id!,
        data: dataRegistro,
        procedimentos: procedimentos.trim(),
        anotacoes: anotacoes.trim(),
        dente_regiao: denteRegiao.trim(),
        retorno_dias: retornoDias ? Number(retornoDias) : undefined,
        retorno_data: retornoCalculado || undefined,
      })

      toast({ title: 'Anotação clínica registrada com sucesso no prontuário!' })
      setDialogOpen(false)
      setProcedimentos('')
      setAnotacoes('')
      setDenteRegiao('')
      setRetornoDias('')
      setTextoDitado('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar prontuário',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-3 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Carregando prontuário do paciente...</p>
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Paciente não encontrado.</p>
        <Button onClick={() => navigate('/pacientes')} className="mt-4" variant="outline">
          Voltar para Pacientes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Back and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/pacientes')}
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-marca-vermelho" />
              Prontuário Odontológico
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">{paciente.nome}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/novo-agendamento?pacienteId=${paciente.id}`)}
            className="text-xs h-9"
          >
            <Calendar className="w-3.5 h-3.5 mr-1" />
            Nova Consulta
          </Button>

          {isAdmin ? (
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-9"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar Evolução / Procedimento
            </Button>
          ) : (
            <Badge variant="outline" className="text-[11px] text-slate-500 border-slate-300">
              Modo Visualização (Recepção)
            </Badge>
          )}
        </div>
      </div>

      {/* Patient Summary Card */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 min-w-0">
            <PacienteAvatar
              paciente={paciente}
              className="w-14 h-14 sm:w-16 sm:h-16"
              textClassName="text-lg"
            />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Paciente
              </p>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {paciente.nome}
              </h2>
              {(() => {
                const aniv = aniversarioDePaciente(paciente.data_nascimento)
                if (!aniv || aniv.ehHoje) return null
                return (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] text-pink-700 border-pink-200 bg-pink-50"
                  >
                    🎂 {textoAniversario(aniv.diasAte, paciente.data_nascimento)}
                  </Badge>
                )
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {textoPreferenciaHorario(paciente) && (
              <div className="flex items-start gap-2 text-slate-700">
                <Clock className="w-3.5 h-3.5 mt-0.5 text-marca-vermelho shrink-0" />
                <span>
                  <span className="font-semibold text-slate-500">Prefere:</span>{' '}
                  {textoPreferenciaHorario(paciente)}
                </span>
              </div>
            )}
            {textoOrigem(paciente) && (
              <div className="flex items-start gap-2 text-slate-700">
                <Compass className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                <span>
                  <span className="font-semibold text-slate-500">Como chegou:</span>{' '}
                  {textoOrigem(paciente)}
                </span>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-start gap-2 min-w-0">
              <Phone className="w-4 h-4 mt-0.5 text-marca-vermelho shrink-0" />
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Telefone / WhatsApp
                </dt>
                <dd className="font-medium text-slate-800 break-words">
                  {formatPhone(paciente.telefone)}
                </dd>
              </div>
            </div>

            {paciente.email && (
              <div className="flex items-start gap-2 min-w-0">
                <Mail className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    E-mail
                  </dt>
                  <dd className="font-medium text-slate-800 break-all">{paciente.email}</dd>
                </div>
              </div>
            )}

            {paciente.data_nascimento && (
              <div className="flex items-start gap-2 min-w-0">
                <Calendar className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Data de nascimento
                  </dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateBr(paciente.data_nascimento)}
                  </dd>
                </div>
              </div>
            )}

            {paciente.cpf && (
              <div className="flex items-start gap-2 min-w-0">
                <FileText className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    CPF
                  </dt>
                  <dd className="font-medium text-slate-800">{paciente.cpf}</dd>
                </div>
              </div>
            )}

            {montarEnderecoTexto(enderecoDeRegistro(paciente)) && (
              <div className="flex items-start gap-2 min-w-0 sm:col-span-2 lg:col-span-4">
                <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Endereço
                  </dt>
                  <dd className="font-medium text-slate-800 break-words">
                    {montarEnderecoTexto(enderecoDeRegistro(paciente))}
                  </dd>
                </div>
              </div>
            )}
          </dl>

          {paciente.observacoes && (
            <div className="flex items-start gap-2 rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 mt-px text-amber-600 shrink-0" />
              <p className="min-w-0">
                <span className="font-semibold text-amber-950">
                  Observações Clínicas e Alertas:{' '}
                </span>
                <span className="break-words">{paciente.observacoes}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Prontuário Clínico vs Histórico de Consultas vs Planejamentos */}
      <Tabs defaultValue="prontuario" className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1 flex w-full flex-wrap h-auto justify-start gap-y-1">
          <TabsTrigger value="odontograma" className="text-xs sm:text-sm">
            Odontograma
          </TabsTrigger>
          <TabsTrigger value="prontuario" className="text-xs sm:text-sm">
            Evolução Clínica ({prontuarios.length})
          </TabsTrigger>
          <TabsTrigger value="consultas" className="text-xs sm:text-sm">
            Histórico de Consultas ({consultas.length})
          </TabsTrigger>
          <TabsTrigger value="orcamentos" className="text-xs sm:text-sm">
            Planejamentos de Tratamento ({orcamentos.length})
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="text-xs sm:text-sm">
            Anamnese ({anamneses.length})
          </TabsTrigger>
          <TabsTrigger value="receitas" className="text-xs sm:text-sm">
            Receitas ({receitas.length})
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs sm:text-sm">
            Documentos ({documentos.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 0: Odontograma */}
        <TabsContent value="odontograma" className="space-y-4 pt-2">
          <OdontogramaTab
            registros={odontograma}
            isAdmin={isAdmin}
            pacienteNome={paciente.nome}
            onAviso={(title, message) =>
              toast({ title, description: message, variant: 'destructive' })
            }
            onSalvar={async ({ dente, condicao, faces, observacao }) => {
              try {
                await odontogramaService.salvar({
                  paciente: id!,
                  dente,
                  condicao: condicao as CondicaoDente,
                  faces: faces as FaceDente[],
                  observacao,
                  registrado_por: user?.id,
                })
                toast({ title: `Dente ${dente} atualizado no odontograma.` })
                loadData()
              } catch (err: any) {
                toast({
                  title: 'Erro ao salvar odontograma',
                  description: err.message,
                  variant: 'destructive',
                })
              }
            }}
            onRemover={async (registroId, dente) => {
              try {
                await odontogramaService.remover(registroId, dente)
                toast({ title: `Registro do dente ${dente} removido.` })
                loadData()
              } catch (err: any) {
                toast({
                  title: 'Erro ao remover registro',
                  description: err.message,
                  variant: 'destructive',
                })
              }
            }}
          />
        </TabsContent>

        {/* Tab 1: Prontuário Clínico */}
        <TabsContent value="prontuario" className="space-y-4 pt-2">
          {!isAdmin && (
            <Alert className="bg-slate-50 border-slate-200 text-slate-700 py-2.5">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <AlertDescription className="text-xs">
                Por política da clínica Odontomari, o registro de prontuário, evolução e condutas
                clínicas é de acesso exclusivo do dentista (administrador).
              </AlertDescription>
            </Alert>
          )}

          {prontuarios.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-medium text-slate-700 text-sm">
                Nenhum registro clínico no prontuário
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isAdmin
                  ? 'Adicione a primeira evolução clínica, anotações de procedimentos ou tratamentos executados.'
                  : 'Nenhuma anotação registrada pelo dentista até o momento.'}
              </p>
              {isAdmin && (
                <Button
                  size="sm"
                  className="mt-4 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar Primeira Evolução
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {prontuarios.map((item) => (
                <Card key={item.id} className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-marca-vermelho-claro text-marca-vermelho-escuro hover:bg-marca-vermelho-claro text-xs">
                        {formatDateBr(item.data)}
                      </Badge>
                      {item.dente_regiao && (
                        <Badge variant="outline" className="text-xs font-mono">
                          Região/Dente: {item.dente_regiao}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Registro do Dentista
                    </span>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Procedimentos Realizados
                      </h4>
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">
                        {item.procedimentos}
                      </p>
                    </div>

                    {item.anotacoes && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Anotações Clínicas / Conduta
                        </h4>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">
                          {item.anotacoes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Histórico de Consultas */}
        <TabsContent value="consultas" className="space-y-3 pt-2">
          {consultas.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Nenhuma consulta agendada para este paciente.
              </p>
            </Card>
          ) : (
            consultas.map((c) => (
              <Card key={c.id} className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-2 rounded-lg text-center min-w-[70px]">
                      <span className="block text-xs font-bold text-slate-800">
                        {formatDateBr(c.data)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {c.hora_inicio} - {c.hora_fim}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {c.expand?.tipo_atendimento?.nome || 'Atendimento Geral'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Duração: {c.duracao_minutos} min{' '}
                        {c.observacoes ? `• Obs: ${c.observacoes}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {c.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab 3: Planejamentos */}
        <TabsContent value="orcamentos" className="space-y-3 pt-2">
          {orcamentos.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Nenhum planejamento de tratamento cadastrado para este paciente.
              </p>
              <Button
                size="sm"
                className="mt-4 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
                onClick={() => navigate(`/orcamentos?pacienteId=${paciente.id}`)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Planejamento
              </Button>
            </Card>
          ) : (
            orcamentos.map((orc) => (
              <Card key={orc.id} className="border-slate-200 bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {formatDateBr(orc.data)}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          orc.status === 'aceito'
                            ? 'bg-emerald-100 text-emerald-800'
                            : orc.status === 'recusado'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }
                      >
                        {orc.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {orc.itens?.length || 0} procedimento(s) incluído(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-marca-vermelho block">
                      {formatCurrency(orc.valor_total)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 mt-1 text-slate-600"
                      onClick={() => navigate('/orcamentos')}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab 4: Anamnese */}
        <TabsContent value="anamnese" className="pt-2">
          <AnamneseTab
            anamneses={anamneses}
            isAdmin={isAdmin}
            pacienteId={paciente.id}
            pacienteNome={paciente.nome}
            autorId={user?.id}
            onSaved={() => {
              toast({ title: 'Anamnese salva com sucesso!' })
              loadData()
            }}
            onError={(title, description) => toast({ title, description, variant: 'destructive' })}
            onViewError={(title, description) =>
              toast({ title, description, variant: 'destructive' })
            }
          />
        </TabsContent>

        {/* Tab 5: Receitas */}
        <TabsContent value="receitas" className="pt-2">
          <ReceitasTab
            receitas={receitas}
            isAdmin={isAdmin}
            pacienteId={paciente.id}
            pacienteNome={paciente.nome}
            pacienteTelefone={paciente.telefone}
            autorId={user?.id}
            onSaved={() => loadData()}
            onError={(title, description) => toast({ title, description, variant: 'destructive' })}
          />
        </TabsContent>

        {/* Tab: Documentos emitidos para o paciente */}
        <TabsContent value="documentos" className="pt-2">
          <DocumentosTab
            documentos={documentos}
            isAdmin={isAdmin}
            pacienteId={paciente.id}
            pacienteNome={paciente.nome}
            pacienteTelefone={paciente.telefone}
            autorId={user?.id}
            onSaved={() => loadData()}
            onError={(title, description) => toast({ title, description, variant: 'destructive' })}
          />
        </TabsContent>
      </Tabs>

      {/* Add Prontuário Dialog (Admin only) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Anotação no Prontuário</DialogTitle>
            <DialogDescription>Paciente: {paciente.nome}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddProntuario} className="space-y-4 py-2">
            <DitadorProntuario
              texto={textoDitado}
              onTextoChange={setTextoDitado}
              onErro={(title, description) => toast({ title, description, variant: 'destructive' })}
              onEstruturado={(dados) => {
                setProcedimentos(dados.procedimentos || procedimentos)
                setAnotacoes(dados.anotacoes || anotacoes)
                setDenteRegiao(dados.dente_regiao || denteRegiao)
                if (dados.retorno_dias) setRetornoDias(String(dados.retorno_dias))
                setTextoDitado('')
                toast({
                  title: 'Ditado organizado!',
                  description: 'Confira os campos antes de gravar no prontuário.',
                })
              }}
              onTextoCru={(texto) => {
                setAnotacoes(texto)
                setTextoDitado('')
                toast({
                  title: 'Texto transcrito',
                  description:
                    'A IA não conseguiu separar os campos, mas o texto está nas anotações.',
                })
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="data_reg" className="text-xs">
                  Data da Sessão *
                </Label>
                <Input
                  id="data_reg"
                  type="date"
                  required
                  value={dataRegistro}
                  onChange={(e) => setDataRegistro(e.target.value)}
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="dente" className="text-xs">
                  Dente / Região (opcional)
                </Label>
                <Input
                  id="dente"
                  value={denteRegiao}
                  onChange={(e) => setDenteRegiao(e.target.value)}
                  placeholder="Ex.: 16, 21 ou Arcada Superior"
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="retorno" className="text-xs">
                  Retorno em (dias)
                </Label>
                <Input
                  id="retorno"
                  type="number"
                  min={0}
                  max={3650}
                  value={retornoDias}
                  onChange={(e) => setRetornoDias(e.target.value)}
                  placeholder="Ex.: 7, 30, 180"
                  className="mt-1 text-xs sm:text-sm"
                />
                {retornoCalculado && (
                  <p className="text-[10px] text-marca-vermelho font-medium mt-1">
                    Retorno previsto: {formatDateBr(retornoCalculado)}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="proced" className="text-xs">
                  Procedimentos Realizados *
                </Label>
                <div className="relative mt-1">
                  <Textarea
                    id="proced"
                    required
                    rows={3}
                    value={procedimentos}
                    onChange={(e) => setProcedimentos(e.target.value)}
                    placeholder="Ex.: Aplicação de laserterapia 4J/cm² em região de aftas, restauração dente 16 com resina Z350 cor A2..."
                    className="text-xs sm:text-sm pr-10"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <BotaoDitar
                      titulo="Ditar os procedimentos"
                      onErro={(m) =>
                        toast({ title: 'Ditado', description: m, variant: 'destructive' })
                      }
                      onTexto={(texto) =>
                        setProcedimentos((atual) =>
                          atual.trim() ? `${atual.trimEnd()} ${texto}` : texto,
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="anot" className="text-xs">
                  Anotações do Dentista / Conduta / Próximos Passos
                </Label>
                <div className="relative mt-1">
                  <Textarea
                    id="anot"
                    rows={3}
                    value={anotacoes}
                    onChange={(e) => setAnotacoes(e.target.value)}
                    placeholder="Ex.: Paciente referiu alívio imediato da dor. Prescrito bochecho. Retorno em 7 dias para avaliação..."
                    className="text-xs sm:text-sm pr-10"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <BotaoDitar
                      titulo="Ditar as anotações"
                      onErro={(m) =>
                        toast({ title: 'Ditado', description: m, variant: 'destructive' })
                      }
                      onTexto={(texto) =>
                        setAnotacoes((atual) =>
                          atual.trim() ? `${atual.trimEnd()} ${texto}` : texto,
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
                disabled={saving}
              >
                {saving ? 'Registrando...' : 'Gravar no Prontuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
