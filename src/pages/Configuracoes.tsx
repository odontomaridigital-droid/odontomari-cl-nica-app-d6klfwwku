import React, { useState, useEffect } from 'react'
import { configuracoesService, tiposAtendimentoService, bloqueiosService } from '@/services/clinica'
import { ClinicaConfig, TipoAtendimento, BloqueioAgenda } from '@/types'
import { formatCurrency, formatDateBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  Clock,
  Calendar,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Check,
  Shield,
  Stethoscope,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const ConfiguracoesPage: React.FC = () => {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState<boolean>(true)
  const [config, setConfig] = useState<ClinicaConfig | null>(null)
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([])

  // Config Form
  const [horarioInicio, setHorarioInicio] = useState('08:00')
  const [horarioFim, setHorarioFim] = useState('18:00')
  const [intervaloMinutos, setIntervaloMinutos] = useState(30)
  const [bloquearFds, setBloquearFds] = useState(true)
  const [nomeClinica, setNomeClinica] = useState('Clínica Odontomari')
  const [telefoneClinica, setTelefoneClinica] = useState('(11) 98765-4321')
  const [mensagemLembrete, setMensagemLembrete] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  // Tipos Atendimento Dialog
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false)
  const [editingTipo, setEditingTipo] = useState<TipoAtendimento | null>(null)
  const [tipoNome, setTipoNome] = useState('')
  const [tipoDuracao, setTipoDuracao] = useState(30)
  const [tipoValor, setTipoValor] = useState(0)
  const [tipoDescricao, setTipoDescricao] = useState('')
  const [savingTipo, setSavingTipo] = useState(false)

  // Bloqueio Futuro Dialog
  const [bloqueioDialogOpen, setBloqueioDialogOpen] = useState(false)
  const [bloqueioData, setBloqueioData] = useState('')
  const [bloqueioMotivo, setBloqueioMotivo] = useState('')
  const [savingBloqueio, setSavingBloqueio] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cfg, tps, bloqs] = await Promise.all([
        configuracoesService.getConfigs(),
        tiposAtendimentoService.getAll(false), // all including inactive
        bloqueiosService.getByDateRange(
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ),
      ])
      setConfig(cfg)
      setTipos(tps)
      setBloqueios(bloqs)

      // Populate config state
      setHorarioInicio(cfg.horario_inicio)
      setHorarioFim(cfg.horario_fim)
      setIntervaloMinutos(cfg.intervalo_minutos)
      setBloquearFds(cfg.bloquear_fins_de_semana)
      setNomeClinica(cfg.nome_clinica)
      setTelefoneClinica(cfg.telefone_clinica)
      setMensagemLembrete(cfg.mensagem_lembrete_padrao)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleSaveConfigs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    setSavingConfig(true)
    try {
      await configuracoesService.saveAllConfigs({
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        intervalo_minutos: intervaloMinutos,
        bloquear_fins_de_semana: bloquearFds,
        nome_clinica: nomeClinica,
        telefone_clinica: telefoneClinica,
        mensagem_lembrete_padrao: mensagemLembrete,
      })

      toast({ title: 'Configurações gerais salvas com sucesso!' })
      loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  const handleOpenTipoCreate = () => {
    setEditingTipo(null)
    setTipoNome('')
    setTipoDuracao(30)
    setTipoValor(0)
    setTipoDescricao('')
    setTipoDialogOpen(true)
  }

  const handleOpenTipoEdit = (t: TipoAtendimento) => {
    setEditingTipo(t)
    setTipoNome(t.nome)
    setTipoDuracao(t.duracao_minutos)
    setTipoValor(t.valor_padrao || 0)
    setTipoDescricao(t.descricao || '')
    setTipoDialogOpen(true)
  }

  const handleSaveTipo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tipoNome.trim() || !tipoDuracao) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o nome e a duração em minutos.',
        variant: 'destructive',
      })
      return
    }

    setSavingTipo(true)
    try {
      if (editingTipo) {
        await tiposAtendimentoService.update(editingTipo.id, {
          nome: tipoNome.trim(),
          duracao_minutos: Number(tipoDuracao),
          valor_padrao: Number(tipoValor),
          descricao: tipoDescricao.trim(),
        })
        toast({ title: 'Tipo de atendimento atualizado!' })
      } else {
        await tiposAtendimentoService.create({
          nome: tipoNome.trim(),
          duracao_minutos: Number(tipoDuracao),
          valor_padrao: Number(tipoValor),
          descricao: tipoDescricao.trim(),
          ativo: true,
        })
        toast({ title: 'Novo tipo de atendimento cadastrado!' })
      }
      setTipoDialogOpen(false)
      loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar tipo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingTipo(false)
    }
  }

  const handleDeleteTipo = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente remover o tipo de atendimento "${nome}"?`)) return
    try {
      await tiposAtendimentoService.delete(id)
      toast({ title: 'Tipo de atendimento removido.' })
      loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleSaveBloqueio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bloqueioData) {
      toast({ title: 'Escolha a data do bloqueio.', variant: 'destructive' })
      return
    }

    setSavingBloqueio(true)
    try {
      await bloqueiosService.create({
        data: bloqueioData,
        dia_inteiro: true,
        tipo: 'bloqueio',
        motivo: bloqueioMotivo.trim() || 'Feriado / Recesso da clínica',
      })
      toast({ title: 'Data bloqueada na agenda da clínica!' })
      setBloqueioDialogOpen(false)
      setBloqueioData('')
      setBloqueioMotivo('')
      loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar bloqueio',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSavingBloqueio(false)
    }
  }

  const handleDeleteBloqueio = async (id: string) => {
    try {
      await bloqueiosService.delete(id)
      toast({ title: 'Bloqueio removido da agenda.' })
      loadAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir bloqueio',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center bg-white border-slate-200">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-xs text-slate-500 mt-1">
          Apenas o perfil Administrador pode alterar os horários da clínica, procedimentos e regras
          da agenda.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-600" />
          Configurações da Clínica
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Horários de funcionamento, tipos de atendimento com duração e bloqueios de agenda
        </p>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="geral" className="text-xs sm:text-sm">
            Horários & Geral
          </TabsTrigger>
          <TabsTrigger value="tipos" className="text-xs sm:text-sm">
            Tipos de Atendimento ({tipos.length})
          </TabsTrigger>
          <TabsTrigger value="bloqueios" className="text-xs sm:text-sm">
            Bloqueios de Agenda ({bloqueios.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Horários & Geral */}
        <TabsContent value="geral" className="space-y-4 pt-2">
          <form onSubmit={handleSaveConfigs}>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Horários de Atendimento da Agenda
                </CardTitle>
                <CardDescription className="text-xs">
                  Defina o primeiro e o último horário de atendimento do dia do dentista
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Primeiro Atendimento do Dia</Label>
                    <Input
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="mt-1 text-xs sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Último Atendimento do Dia</Label>
                    <Input
                      type="time"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="mt-1 text-xs sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Intervalo Padrão da Agenda (min)</Label>
                    <Input
                      type="number"
                      step={5}
                      min={10}
                      max={120}
                      value={intervaloMinutos}
                      onChange={(e) => setIntervaloMinutos(Number(e.target.value))}
                      className="mt-1 text-xs sm:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Bloquear fins de semana por padrão (Sábados e Domingos)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      A agenda manterá sábados e domingos restritos, permitindo desbloqueio pontual.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={bloquearFds}
                    onChange={(e) => setBloquearFds(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Dados da Clínica & Modelo de Mensagem WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Nome da Clínica</Label>
                    <Input
                      value={nomeClinica}
                      onChange={(e) => setNomeClinica(e.target.value)}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Telefone / WhatsApp da Clínica</Label>
                    <Input
                      value={telefoneClinica}
                      onChange={(e) => setTelefoneClinica(e.target.value)}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Texto Padrão do Lembrete</Label>
                    <span className="text-[11px] text-slate-400">
                      Variáveis: {'{paciente}'}, {'{data}'}, {'{hora}'}, {'{tipo}'}
                    </span>
                  </div>
                  <Textarea
                    rows={3}
                    value={mensagemLembrete}
                    onChange={(e) => setMensagemLembrete(e.target.value)}
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    className="bg-teal-600 hover:bg-teal-700 text-white min-w-[150px]"
                    disabled={savingConfig}
                  >
                    {savingConfig ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Tab 2: Tipos de Atendimento */}
        <TabsContent value="tipos" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Procedimentos com duração pré-configurada para preenchimento ágil da agenda
            </p>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8"
              onClick={handleOpenTipoCreate}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Tipo de Atendimento
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tipos.map((t) => (
              <Card key={t.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">{t.nome}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-teal-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t.duracao_minutos} minutos
                      </span>
                      {t.valor_padrao ? <span>Valor: {formatCurrency(t.valor_padrao)}</span> : null}
                    </div>
                    {t.descricao && <p className="text-xs text-slate-500 mt-1">{t.descricao}</p>}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-700"
                      onClick={() => handleOpenTipoEdit(t)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteTipo(t.id, t.nome)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Bloqueios de Agenda */}
        <TabsContent value="bloqueios" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Recessos, congressos, férias ou dias bloqueados para atendimentos futuros
            </p>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8"
              onClick={() => setBloqueioDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Bloquear Nova Data
            </Button>
          </div>

          <div className="space-y-2">
            {bloqueios.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 p-8 text-center bg-white">
                <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  Nenhuma data futura com bloqueio especial cadastrada.
                </p>
              </Card>
            ) : (
              bloqueios.map((b) => (
                <Card key={b.id} className="border-slate-200 bg-white">
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold font-mono">
                        {formatDateBr(b.data)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {b.tipo === 'desbloqueio_fds'
                            ? 'Fim de semana desbloqueado'
                            : 'Dia Inteiro Bloqueado'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {b.motivo || 'Sem observação especificada'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-600 hover:bg-red-50 h-7"
                      onClick={() => handleDeleteBloqueio(b.id)}
                    >
                      Remover
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tipo Atendimento Dialog */}
      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTipo ? 'Editar Tipo de Atendimento' : 'Novo Tipo de Atendimento'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTipo} className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome do Procedimento / Tipo *</Label>
              <Input
                placeholder="Ex.: Tratamento a Laser, Clareamento, Extração"
                value={tipoNome}
                onChange={(e) => setTipoNome(e.target.value)}
                required
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Duração Padrão (minutos) *</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={tipoDuracao}
                  onChange={(e) => setTipoDuracao(Number(e.target.value))}
                  required
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Valor Padrão sugerido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tipoValor}
                  onChange={(e) => setTipoValor(Number(e.target.value))}
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição / Instruções</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes ou protocolo do atendimento..."
                value={tipoDescricao}
                onChange={(e) => setTipoDescricao(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTipoDialogOpen(false)}
                disabled={savingTipo}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={savingTipo}
              >
                {savingTipo ? 'Salvando...' : 'Salvar Tipo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bloqueio Dialog */}
      <Dialog open={bloqueioDialogOpen} onOpenChange={setBloqueioDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Data na Agenda</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBloqueio} className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Data a ser bloqueada *</Label>
              <Input
                type="date"
                required
                value={bloqueioData}
                onChange={(e) => setBloqueioData(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Motivo do Bloqueio</Label>
              <Input
                placeholder="Ex.: Feriado Nacional, Congresso de Odontologia, Recesso"
                value={bloqueioMotivo}
                onChange={(e) => setBloqueioMotivo(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBloqueioDialogOpen(false)}
                disabled={savingBloqueio}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={savingBloqueio}
              >
                {savingBloqueio ? 'Bloqueando...' : 'Confirmar Bloqueio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
