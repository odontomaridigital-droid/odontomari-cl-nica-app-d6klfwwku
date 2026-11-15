import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pacientesService } from '@/services/clinica'
import { Paciente, PreferenciaHorarioTipo } from '@/types'
import { HORAS_OPCOES } from '@/lib/pacienteCampos'
import { formatDateBr, formatPhone } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import {
  PREFERENCIA_OPCOES,
  ORIGENS,
  textoPreferenciaHorario,
  textoOrigem,
} from '@/lib/pacienteCampos'
import { comprimirImagem } from '@/lib/imagemUpload'
import { useDebounce } from '@/hooks/use-debounce'
import { pacienteFotoUrl } from '@/lib/pacienteFoto'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { BotaoDitar } from '@/components/voz/BotaoDitar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  FileText,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  ImagePlus,
  Trash2 as TrashIcon,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  EnderecoForm,
  enderecoVazio,
  formatCep,
  buscarEnderecoPorCep,
  montarEnderecoTexto,
  enderecoDeRegistro,
} from '@/lib/endereco'

export const PacientesPage: React.FC = () => {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    data_nascimento: '',
    cpf: '',
    observacoes: '',
  })
  const [preferencia, setPreferencia] = useState({
    tipo: '',
    de: '',
    ate: '',
    obs: '',
  })
  const [origem, setOrigem] = useState('')
  const [origemComplemento, setOrigemComplemento] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState<boolean>(false)
  const fotoFileRef = useRef<File | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState<boolean>(false)

  const handleFotoEscolhida = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const comprimida = await comprimirImagem(file, 500, 0.85)
      fotoFileRef.current = comprimida
      setFotoPreview(URL.createObjectURL(comprimida))
      setFotoRemovida(false)
    } catch (err: any) {
      toast({
        title: 'Foto inválida',
        description: err.message || 'Não foi possível processar a imagem.',
        variant: 'destructive',
      })
    }
  }

  const handleRemoverFoto = () => {
    fotoFileRef.current = null
    setFotoPreview(null)
    setFotoRemovida(true)
  }

  // Endereço estruturado (CEP -> ViaCEP -> número)
  const [enderecoForm, setEnderecoForm] = useState<EnderecoForm>(enderecoVazio)
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [cepMensagem, setCepMensagem] = useState<string>('')
  const cepRequestRef = useRef<number>(0)
  const numeroRef = useRef<HTMLInputElement>(null)

  const resetCep = () => {
    cepRequestRef.current += 1
    setCepStatus('idle')
    setCepMensagem('')
  }

  const buscarCep = async (cep: string) => {
    const requestId = ++cepRequestRef.current
    setCepStatus('loading')
    setCepMensagem('')
    try {
      const dados = await buscarEnderecoPorCep(cep)
      if (requestId !== cepRequestRef.current) return
      setEnderecoForm((prev) => ({ ...prev, ...dados }))
      setCepStatus('ok')
      setCepMensagem('Endereço encontrado. Informe o número.')
      setTimeout(() => numeroRef.current?.focus(), 0)
    } catch (err: any) {
      if (requestId !== cepRequestRef.current) return
      setCepStatus('error')
      setCepMensagem(err.message)
    }
  }

  const handleCepChange = (value: string) => {
    const cep = formatCep(value)
    setEnderecoForm((prev) => ({ ...prev, cep }))
    resetCep()
    if (cep.replace(/\D/g, '').length === 8) {
      buscarCep(cep)
    }
  }

  const handleCepBlur = () => {
    const digits = enderecoForm.cep.replace(/\D/g, '')
    if (digits.length > 0 && digits.length < 8) {
      setCepStatus('error')
      setCepMensagem('CEP incompleto. Informe os 8 dígitos ou preencha o endereço manualmente.')
    }
  }

  const loadPacientes = async (query = '') => {
    setLoading(true)
    try {
      const data = query ? await pacientesService.search(query) : await pacientesService.getAll()
      setPacientes(data)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar pacientes',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Busca enquanto digita: espera a pessoa parar por um instante e busca sozinha.
  const buscaComAtraso = useDebounce(searchQuery, 350)

  useEffect(() => {
    loadPacientes(buscaComAtraso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaComAtraso])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadPacientes(searchQuery)
  }

  const handleOpenCreate = () => {
    setEditingPaciente(null)
    setFormData({
      nome: '',
      telefone: '',
      email: '',
      data_nascimento: '',
      cpf: '',
      observacoes: '',
    })
    setPreferencia({ tipo: '', de: '', ate: '', obs: '' })
    setOrigem('')
    setOrigemComplemento('')
    setFotoPreview(null)
    setFotoRemovida(false)
    fotoFileRef.current = null
    setEnderecoForm(enderecoVazio)
    resetCep()
    setDialogOpen(true)
  }

  const handleOpenEdit = (p: Paciente, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingPaciente(p)
    setEnderecoForm(enderecoDeRegistro(p))
    resetCep()
    setFormData({
      nome: p.nome || '',
      telefone: p.telefone || '',
      email: p.email || '',
      data_nascimento: p.data_nascimento ? p.data_nascimento.split(' ')[0].split('T')[0] : '',
      cpf: p.cpf || '',
      observacoes: p.observacoes || '',
    })
    setPreferencia({
      tipo: p.preferencia_horario_tipo || '',
      de: p.preferencia_horario_de || '',
      ate: p.preferencia_horario_ate || '',
      obs: p.preferencia_horario_obs || '',
    })
    setOrigem(p.origem || '')
    setOrigemComplemento(p.origem_complemento || '')
    setFotoPreview(pacienteFotoUrl(p) || null)
    setFotoRemovida(false)
    fotoFileRef.current = null
    setDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nome.trim() || !formData.telefone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e telefone são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        ...formData,
        ...enderecoForm,
        endereco: montarEnderecoTexto(enderecoForm),
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim(),
        preferencia_horario_tipo: preferencia.tipo || null,
        preferencia_horario_de: preferencia.de || null,
        preferencia_horario_ate: preferencia.ate || null,
        preferencia_horario_obs: preferencia.obs.trim() || null,
        origem: origem || null,
        origem_complemento: origemComplemento.trim() || null,
      }
      if (formData.data_nascimento) {
        payload.data_nascimento = `${formData.data_nascimento} 00:00:00.000Z`
      } else {
        payload.data_nascimento = null
      }
      if (fotoRemovida) payload.foto = null

      if (editingPaciente) {
        await pacientesService.update(editingPaciente.id, payload, fotoFileRef.current || undefined)
        toast({ title: 'Paciente atualizado com sucesso!' })
      } else {
        await pacientesService.create(payload, fotoFileRef.current || undefined)
        toast({ title: 'Paciente cadastrado com sucesso!' })
      }

      setDialogOpen(false)
      loadPacientes(searchQuery)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const [excluirAlvo, setExcluirAlvo] = useState<Paciente | null>(null)
  const [motivoExclusao, setMotivoExclusao] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  const abrirExclusao = (p: Paciente, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAdmin) return
    setExcluirAlvo(p)
    setMotivoExclusao('')
  }

  const confirmarExclusao = async () => {
    if (!excluirAlvo) return
    const motivo = motivoExclusao.trim()
    if (!motivo) {
      toast({
        title: 'Informe o motivo da exclusão',
        description: 'O motivo fica registrado no log de auditoria.',
        variant: 'destructive',
      })
      return
    }

    setExcluindo(true)
    try {
      await pacientesService.delete(excluirAlvo.id, motivo)
      toast({ title: 'Paciente removido.' })
      setExcluirAlvo(null)
      loadPacientes(searchQuery)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-marca-vermelho" />
            Pacientes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Cadastros, histórico de consultas e prontuário odontológico
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs sm:text-sm h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Paciente
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input
                placeholder="Buscar paciente por nome, telefone ou CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>
            <Button type="submit" variant="secondary" className="text-xs sm:text-sm">
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('')
                  loadPacientes('')
                }}
                className="text-xs sm:text-sm"
              >
                Limpar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Pacientes List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando lista de pacientes...</p>
          </div>
        ) : pacientes.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-medium text-slate-700 text-sm">Nenhum paciente cadastrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Nenhum resultado encontrado para a busca.'
                : 'Cadastre os pacientes para gerenciar consultas, histórico e planejamentos.'}
            </p>
            <Button
              size="sm"
              className="mt-4 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              onClick={handleOpenCreate}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Cadastrar Primeiro Paciente
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pacientes.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate(`/pacientes/${p.id}/prontuario`)}
                className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white group"
              >
                <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <PacienteAvatar paciente={p} className="w-10 h-10" textClassName="text-sm" />
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-marca-vermelho transition-colors">
                          {p.nome}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Phone className="w-3 h-3 text-marca-vermelho" />
                            {formatPhone(p.telefone)}
                          </span>
                          {p.email && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {p.email}
                            </span>
                          )}
                          {p.data_nascimento && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Nasc: {formatDateBr(p.data_nascimento)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-slate-700"
                        onClick={(e) => handleOpenEdit(p, e)}
                        title="Editar dados"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          onClick={(e) => abrirExclusao(p, e)}
                          title="Excluir paciente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {p.observacoes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-2">
                      <span className="font-medium text-slate-700">Obs:</span> {p.observacoes}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-marca-vermelho font-medium flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Abrir Prontuário & Histórico →
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2 text-slate-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/novo-agendamento?pacienteId=${p.id}`)
                      }}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Agendar Consulta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de exclusão com motivo obrigatório */}
      <Dialog open={!!excluirAlvo} onOpenChange={(open) => !open && setExcluirAlvo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5 text-marca-vermelho" />
              Excluir paciente
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir o cadastro de{' '}
            <span className="font-semibold text-slate-900">{excluirAlvo?.nome}</span>? Esta ação não
            pode ser desfeita.
          </p>

          <div className="space-y-1.5 py-1">
            <Label htmlFor="motivo-exclusao" className="text-xs">
              Motivo da exclusão *
            </Label>
            <Textarea
              id="motivo-exclusao"
              rows={3}
              value={motivoExclusao}
              onChange={(e) => setMotivoExclusao(e.target.value)}
              placeholder="Ex.: pedido do responsável, cadastro duplicado..."
              className="text-xs sm:text-sm"
              autoFocus
            />
            <p className="text-[11px] text-slate-500">
              O motivo fica registrado no log de auditoria.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setExcluirAlvo(null)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarExclusao}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              disabled={excluindo || !motivoExclusao.trim()}
            >
              {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPaciente ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="nome" className="text-xs">
                  Nome Completo *
                </Label>
                <Input
                  id="nome"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do paciente"
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="telefone" className="text-xs">
                  Telefone / WhatsApp *
                </Label>
                <Input
                  id="telefone"
                  required
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 98888-0000"
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-xs">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="paciente@exemplo.com"
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="nasc" className="text-xs">
                  Data de Nascimento
                </Label>
                <Input
                  id="nasc"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div>
                <Label htmlFor="cpf" className="text-xs">
                  CPF
                </Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-xs font-semibold text-slate-700">Endereço</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cep" className="text-xs">
                      CEP
                    </Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        inputMode="numeric"
                        value={enderecoForm.cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        className="mt-1 pr-8 text-xs sm:text-sm font-semibold"
                      />
                      {cepStatus === 'loading' && (
                        <Loader2 className="w-4 h-4 text-marca-vermelho animate-spin absolute right-2.5 top-3" />
                      )}
                    </div>
                    {cepMensagem && (
                      <p
                        className={`mt-1 text-[11px] ${
                          cepStatus === 'error' ? 'text-red-600' : 'text-marca-vermelho-escuro'
                        }`}
                      >
                        {cepMensagem}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="logradouro" className="text-xs">
                      Rua / Logradouro
                    </Label>
                    <Input
                      id="logradouro"
                      value={enderecoForm.logradouro}
                      onChange={(e) =>
                        setEnderecoForm({ ...enderecoForm, logradouro: e.target.value })
                      }
                      placeholder="Rua, avenida, travessa..."
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="numero" className="text-xs">
                      Número
                    </Label>
                    <Input
                      id="numero"
                      ref={numeroRef}
                      value={enderecoForm.numero}
                      onChange={(e) => setEnderecoForm({ ...enderecoForm, numero: e.target.value })}
                      placeholder="Nº"
                      className={`mt-1 text-xs sm:text-sm ${
                        cepStatus === 'ok' && !enderecoForm.numero
                          ? 'ring-2 ring-marca-vermelho border-marca-vermelho'
                          : ''
                      }`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="complemento" className="text-xs">
                      Complemento
                    </Label>
                    <Input
                      id="complemento"
                      value={enderecoForm.complemento}
                      onChange={(e) =>
                        setEnderecoForm({ ...enderecoForm, complemento: e.target.value })
                      }
                      placeholder="Apto, bloco, sala..."
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="bairro" className="text-xs">
                      Bairro
                    </Label>
                    <Input
                      id="bairro"
                      value={enderecoForm.bairro}
                      onChange={(e) => setEnderecoForm({ ...enderecoForm, bairro: e.target.value })}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cidade" className="text-xs">
                      Cidade
                    </Label>
                    <Input
                      id="cidade"
                      value={enderecoForm.cidade}
                      onChange={(e) => setEnderecoForm({ ...enderecoForm, cidade: e.target.value })}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="uf" className="text-xs">
                      UF
                    </Label>
                    <Input
                      id="uf"
                      maxLength={2}
                      value={enderecoForm.uf}
                      onChange={(e) =>
                        setEnderecoForm({ ...enderecoForm, uf: e.target.value.toUpperCase() })
                      }
                      placeholder="SP"
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="obs" className="text-xs">
                  Observações Gerais / Alergias / Histórico
                </Label>
                <div className="relative mt-1">
                  <Textarea
                    id="obs"
                    rows={3}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Alergia a medicamentos, sensibilidade, histórico prévio..."
                    className="text-xs sm:text-sm pr-10"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <BotaoDitar
                      titulo="Ditar as observações"
                      onTexto={(texto) =>
                        setFormData((f) => ({
                          ...f,
                          observacoes: f.observacoes?.trim()
                            ? `${f.observacoes.trimEnd()} ${texto}`
                            : texto,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Foto do paciente */}
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-xs font-semibold text-slate-700">Foto do paciente</p>
                <div className="flex items-center gap-3">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Pré-visualização da foto"
                      className="w-16 h-16 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFotoEscolhida}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => fotoInputRef.current?.click()}
                      >
                        <ImagePlus className="w-3.5 h-3.5 mr-1" />
                        {fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                      </Button>
                      {fotoPreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleRemoverFoto}
                        >
                          <TrashIcon className="w-3.5 h-3.5 mr-1" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      JPG ou PNG. A imagem é reduzida para ~500px automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Preferência de horário */}
              <div className="sm:col-span-2 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-xs font-semibold text-slate-700">
                  Preferência de horário para atendimento
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERENCIA_OPCOES.map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() =>
                        setPreferencia((prev) => ({
                          ...prev,
                          tipo: prev.tipo === op.valor ? '' : op.valor,
                        }))
                      }
                      className={`text-[11px] sm:text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        preferencia.tipo === op.valor
                          ? 'bg-marca-vermelho text-white border-marca-vermelho'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-marca-vermelho hover:text-marca-vermelho'
                      }`}
                    >
                      {op.rotulo}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500">Ou uma faixa livre:</span>
                  <span className="text-[11px] text-slate-500">entre</span>
                  <select
                    value={preferencia.de}
                    onChange={(e) => setPreferencia((prev) => ({ ...prev, de: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-700"
                  >
                    <option value="">--:--</option>
                    {HORAS_OPCOES.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500">e</span>
                  <select
                    value={preferencia.ate}
                    onChange={(e) => setPreferencia((prev) => ({ ...prev, ate: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-700"
                  >
                    <option value="">--:--</option>
                    {HORAS_OPCOES.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  value={preferencia.obs}
                  onChange={(e) => setPreferencia((prev) => ({ ...prev, obs: e.target.value }))}
                  placeholder="Observação livre (opcional). Ex.: prefere a primeira consulta do dia"
                  className="text-xs sm:text-sm"
                />
              </div>

              {/* Origem / como chegou */}
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-xs font-semibold text-slate-700">Como chegou à clínica</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="origem" className="text-xs">
                      Origem
                    </Label>
                    <select
                      id="origem"
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                      className="mt-1 w-full text-xs sm:text-sm border border-slate-200 rounded-md px-2 py-2 bg-white text-slate-700"
                    >
                      <option value="">Não informado</option>
                      {ORIGENS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="origem-complemento" className="text-xs">
                      Complemento {origem === 'Outro' ? '*' : '(opcional)'}
                    </Label>
                    <Input
                      id="origem-complemento"
                      value={origemComplemento}
                      onChange={(e) => setOrigemComplemento(e.target.value)}
                      placeholder={
                        origem === 'Outro'
                          ? 'Descreva a origem'
                          : 'Ex.: nome de quem indicou, @ do Instagram...'
                      }
                      className="mt-1 text-xs sm:text-sm"
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
                {saving ? 'Salvando...' : 'Salvar Paciente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
