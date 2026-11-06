import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pacientesService } from '@/services/clinica'
import { Paciente } from '@/types'
import { formatDateBr, formatPhone } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
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
  const [saving, setSaving] = useState<boolean>(false)

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

  useEffect(() => {
    loadPacientes()
  }, [])

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
      }
      if (formData.data_nascimento) {
        payload.data_nascimento = `${formData.data_nascimento} 00:00:00.000Z`
      } else {
        payload.data_nascimento = null
      }

      if (editingPaciente) {
        await pacientesService.update(editingPaciente.id, payload)
        toast({ title: 'Paciente atualizado com sucesso!' })
      } else {
        await pacientesService.create(payload)
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

  const handleDelete = async (id: string, nome: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isAdmin) return
    if (!confirm(`Tem certeza que deseja excluir o cadastro de ${nome}?`)) return

    try {
      await pacientesService.delete(id)
      toast({ title: 'Paciente removido.' })
      loadPacientes(searchQuery)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            Pacientes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Cadastros, histórico de consultas e prontuário odontológico
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm h-9"
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
              Buscar
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
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
              className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-xs"
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
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                        {p.nome}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Phone className="w-3 h-3 text-teal-600" />
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
                          onClick={(e) => handleDelete(p.id, p.nome, e)}
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
                    <span className="text-teal-600 font-medium flex items-center gap-1">
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
                        <Loader2 className="w-4 h-4 text-teal-600 animate-spin absolute right-2.5 top-3" />
                      )}
                    </div>
                    {cepMensagem && (
                      <p
                        className={`mt-1 text-[11px] ${
                          cepStatus === 'error' ? 'text-red-600' : 'text-teal-700'
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
                          ? 'ring-2 ring-teal-500 border-teal-500'
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
                <Textarea
                  id="obs"
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Alergia a medicamentos, sensibilidade, histórico prévio..."
                  className="mt-1 text-xs sm:text-sm"
                />
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
                className="bg-teal-600 hover:bg-teal-700 text-white"
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
