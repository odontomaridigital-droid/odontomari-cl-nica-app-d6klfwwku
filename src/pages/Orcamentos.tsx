import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { orcamentosService, pacientesService, tiposAtendimentoService } from '@/services/clinica'
import { Orcamento, Paciente, ItemOrcamento, TipoAtendimento } from '@/types'
import {
  formatCurrency,
  formatDateBr,
  formatPhone,
  getTodayDateString,
  createWhatsAppUrl,
} from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  MessageCircle,
  Eye,
  Edit,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { BotaoDitar } from '@/components/voz/BotaoDitar'

export const OrcamentosPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const initialPacienteId = searchParams.get('pacienteId') || ''
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filterStatus, setFilterStatus] = useState<string>('todos')

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false)
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>(initialPacienteId)
  const [dataOrcamento, setDataOrcamento] = useState<string>(getTodayDateString())
  const [validadeDias, setValidadeDias] = useState<number>(30)
  const [observacoes, setObservacoes] = useState<string>('')
  const [itens, setItens] = useState<ItemOrcamento[]>([{ procedimento: '', valor: 0, dente: '' }])
  const [saving, setSaving] = useState<boolean>(false)

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState<boolean>(false)
  const [activeOrcamento, setActiveOrcamento] = useState<Orcamento | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [orcs, pacs, tps] = await Promise.all([
        orcamentosService.getAll(),
        pacientesService.getAll(),
        tiposAtendimentoService.getAll(true),
      ])
      setOrcamentos(orcs)
      setPacientes(pacs)
      setTipos(tps)

      if (initialPacienteId && !createDialogOpen) {
        setSelectedPacienteId(initialPacienteId)
        setCreateDialogOpen(true)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar planejamentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAddItem = () => {
    setItens([...itens, { procedimento: '', valor: 0, dente: '' }])
  }

  const handleRemoveItem = (index: number) => {
    if (itens.length === 1) {
      toast({ title: 'O planejamento precisa ter pelo menos um procedimento.' })
      return
    }
    setItens(itens.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ItemOrcamento, value: any) => {
    const updated = [...itens]
    updated[index] = { ...updated[index], [field]: value }
    setItens(updated)
  }

  const handleSelectProcedimentoPredefinido = (index: number, tipoId: string) => {
    const chosen = tipos.find((t) => t.id === tipoId)
    if (!chosen) return
    const updated = [...itens]
    updated[index] = {
      ...updated[index],
      procedimento: chosen.nome,
      valor: chosen.valor_padrao || 0,
    }
    setItens(updated)
  }

  const totalCalculado = itens.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

  const handleSaveOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPacienteId) {
      toast({
        title: 'Selecione o paciente',
        description: 'É necessário vincular o planejamento a um paciente.',
        variant: 'destructive',
      })
      return
    }

    const validItens = itens.filter((i) => i.procedimento.trim() !== '')
    if (validItens.length === 0) {
      toast({
        title: 'Itens vazios',
        description: 'Preencha ao menos um procedimento.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await orcamentosService.create({
        paciente: selectedPacienteId,
        data: dataOrcamento,
        status: 'aberto',
        itens: validItens,
        valor_total: totalCalculado,
        validade_dias: validadeDias,
        observacoes: observacoes.trim(),
      })

      toast({ title: 'Planejamento gerado com sucesso!' })
      setCreateDialogOpen(false)
      setItens([{ procedimento: '', valor: 0, dente: '' }])
      setObservacoes('')
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar planejamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: Orcamento['status']) => {
    try {
      await orcamentosService.updateStatus(id, newStatus)
      toast({ title: `Status atualizado para: ${newStatus.toUpperCase()}` })
      loadData()
      if (activeOrcamento && activeOrcamento.id === id) {
        setActiveOrcamento({ ...activeOrcamento, status: newStatus })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleSendViaWhatsApp = (orc: Orcamento) => {
    const pac = orc.expand?.paciente
    if (!pac?.telefone) {
      toast({
        title: 'Sem telefone',
        description: 'Paciente não possui número cadastrado.',
        variant: 'destructive',
      })
      return
    }

    const itensList = (Array.isArray(orc.itens) ? orc.itens : [])
      .map(
        (it) =>
          `- ${it.procedimento}${it.dente ? ` (${it.dente})` : ''}: ${formatCurrency(it.valor)}`,
      )
      .join('\n')

    const msg = `Olá ${pac.nome}, segue o resumo do seu Planejamento de Tratamento na Clínica Odontomari emitido em ${formatDateBr(orc.data)}:\n\n${itensList}\n\n*Valor Total:* ${formatCurrency(orc.valor_total)}\nValidade da proposta: ${orc.validade_dias || 30} dias.\n\nFicamos à disposição para tirar qualquer dúvida e agendar o início do tratamento!`

    window.open(createWhatsAppUrl(pac.telefone, msg), '_blank')
  }

  const filteredOrcamentos = orcamentos.filter((orc) => {
    if (filterStatus === 'todos') return true
    return orc.status === filterStatus
  })

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-marca-vermelho" />
            Planejamentos de Tratamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Criação de propostas por procedimentos, controle de aprovação e envio
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedPacienteId(initialPacienteId || (pacientes[0]?.id ?? ''))
            setCreateDialogOpen(true)
          }}
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs sm:text-sm h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Planejamento
        </Button>
      </div>

      {/* Filters and Summary */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 font-medium mr-2">Filtrar por:</span>
        <Button
          variant={filterStatus === 'todos' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-8"
          onClick={() => setFilterStatus('todos')}
        >
          Todos ({orcamentos.length})
        </Button>
        <Button
          variant={filterStatus === 'aberto' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-8 text-amber-700 border-amber-200"
          onClick={() => setFilterStatus('aberto')}
        >
          Abertos ({orcamentos.filter((o) => o.status === 'aberto').length})
        </Button>
        <Button
          variant={filterStatus === 'aceito' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-8 text-emerald-700 border-emerald-200"
          onClick={() => setFilterStatus('aceito')}
        >
          Aceitos ({orcamentos.filter((o) => o.status === 'aceito').length})
        </Button>
        <Button
          variant={filterStatus === 'recusado' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-8 text-red-700 border-red-200"
          onClick={() => setFilterStatus('recusado')}
        >
          Recusados ({orcamentos.filter((o) => o.status === 'recusado').length})
        </Button>
      </div>

      {/* Planejamentos List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Carregando planejamentos...</p>
          </div>
        ) : filteredOrcamentos.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-medium text-slate-700 text-sm">Nenhum planejamento encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Crie planejamentos de tratamento detalhados para os pacientes com procedimentos e
              valores.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Criar Primeiro Planejamento
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredOrcamentos.map((orc) => {
              const pac = orc.expand?.paciente
              const itensCount = Array.isArray(orc.itens) ? orc.itens.length : 0

              return (
                <Card
                  key={orc.id}
                  className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium block">
                        Emissão: {formatDateBr(orc.data)}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {pac?.nome || 'Paciente não informado'}
                      </h3>
                    </div>
                    <Badge
                      className={
                        orc.status === 'aceito'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : orc.status === 'recusado'
                            ? 'bg-red-100 text-red-800 hover:bg-red-100'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                      }
                    >
                      {orc.status.toUpperCase()}
                    </Badge>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                        <span>{itensCount} procedimento(s)</span>
                        <span className="font-semibold text-slate-900">
                          Total: {formatCurrency(orc.valor_total)}
                        </span>
                      </div>

                      {/* Small preview of items */}
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-xs space-y-1">
                        {Array.isArray(orc.itens) &&
                          orc.itens.slice(0, 3).map((it, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-[11px] text-slate-700"
                            >
                              <span className="truncate pr-2">
                                • {it.procedimento} {it.dente ? `(${it.dente})` : ''}
                              </span>
                              <span className="font-medium shrink-0">
                                {formatCurrency(it.valor)}
                              </span>
                            </div>
                          ))}
                        {itensCount > 3 && (
                          <span className="text-[10px] text-slate-400 italic block pt-0.5">
                            + {itensCount - 3} outro(s) item(ns)...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setActiveOrcamento(orc)
                          setViewDialogOpen(true)
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver Detalhes
                      </Button>

                      {pac?.telefone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => handleSendViaWhatsApp(orc)}
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Enviar WhatsApp
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Planejamento de Tratamento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveOrcamento} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Paciente *</Label>
                <select
                  value={selectedPacienteId}
                  onChange={(e) => setSelectedPacienteId(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-md bg-white mt-1 outline-none"
                  required
                >
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.telefone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Data de Emissão *</Label>
                <Input
                  type="date"
                  required
                  value={dataOrcamento}
                  onChange={(e) => setDataOrcamento(e.target.value)}
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Items section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Procedimentos & Itens do Planejamento
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-marca-vermelho-escuro border-marca-vermelho/40"
                  onClick={handleAddItem}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Procedimento
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {itens.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Item #{index + 1}</span>
                      <div className="flex items-center gap-2">
                        {/* Quick fill from saved types */}
                        <select
                          className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-marca-vermelho-escuro"
                          onChange={(e) => {
                            if (e.target.value)
                              handleSelectProcedimentoPredefinido(index, e.target.value)
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Predefinidos...
                          </option>
                          {tipos.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome} ({formatCurrency(t.valor_padrao)})
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-red-500"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <Input
                          placeholder="Descrição do procedimento"
                          value={item.procedimento}
                          onChange={(e) => handleItemChange(index, 'procedimento', e.target.value)}
                          className="bg-white text-xs h-8"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Input
                          placeholder="Dente / Região (ex 16)"
                          value={item.dente || ''}
                          onChange={(e) => handleItemChange(index, 'dente', e.target.value)}
                          className="bg-white text-xs h-8"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Valor R$"
                          value={item.valor}
                          onChange={(e) => handleItemChange(index, 'valor', Number(e.target.value))}
                          className="bg-white text-xs h-8"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-marca-vermelho-claro/70 border border-marca-vermelho/30 rounded-lg flex items-center justify-between">
                <span className="text-xs font-semibold text-marca-vermelho-escuro">
                  Valor Total do Planejamento:
                </span>
                <span className="text-base font-bold text-marca-vermelho">
                  {formatCurrency(totalCalculado)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Validade (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(Number(e.target.value))}
                  className="mt-1 text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Observações / Condições de Pagamento</Label>
                <div className="relative mt-1">
                  <Textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex.: Parcelamento em até 6x no cartão de crédito sem juros..."
                    className="text-xs sm:text-sm pr-10"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <BotaoDitar
                      titulo="Ditar as observações"
                      onErro={(m) =>
                        toast({ title: 'Ditado', description: m, variant: 'destructive' })
                      }
                      onTexto={(texto) =>
                        setObservacoes((atual) =>
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
                onClick={() => setCreateDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
                disabled={saving}
              >
                {saving ? 'Criando...' : 'Salvar Planejamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View / Manage Status Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        {activeOrcamento && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <DialogTitle>Planejamento de Tratamento</DialogTitle>
                <Badge
                  className={
                    activeOrcamento.status === 'aceito'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeOrcamento.status === 'recusado'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                  }
                >
                  {activeOrcamento.status.toUpperCase()}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p>
                  <strong>Paciente:</strong> {activeOrcamento.expand?.paciente?.nome}
                </p>
                <p>
                  <strong>Telefone:</strong>{' '}
                  {formatPhone(activeOrcamento.expand?.paciente?.telefone)}
                </p>
                <p>
                  <strong>Data de Emissão:</strong> {formatDateBr(activeOrcamento.data)}
                </p>
                <p>
                  <strong>Validade:</strong> {activeOrcamento.validade_dias || 30} dias
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">
                  Procedimentos Inclusos
                </h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {Array.isArray(activeOrcamento.itens) &&
                    activeOrcamento.itens.map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-medium text-slate-800">{it.procedimento}</p>
                          {it.dente && (
                            <span className="text-[11px] text-slate-400">
                              Dente/Região: {it.dente}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-700">{formatCurrency(it.valor)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-marca-vermelho-claro/70 border border-marca-vermelho/30 rounded-lg">
                <span className="text-xs font-bold text-marca-vermelho-escuro">Total:</span>
                <span className="text-base font-bold text-marca-vermelho">
                  {formatCurrency(activeOrcamento.valor_total)}
                </span>
              </div>

              {activeOrcamento.observacoes && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                  <strong>Observações:</strong> {activeOrcamento.observacoes}
                </div>
              )}

              {/* Status Change Controls */}
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Alterar Status do Planejamento:
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeOrcamento.status === 'aceito' ? 'default' : 'outline'}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleUpdateStatus(activeOrcamento.id, 'aceito')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Aceito
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeOrcamento.status === 'aberto' ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => handleUpdateStatus(activeOrcamento.id, 'aberto')}
                  >
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Aberto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeOrcamento.status === 'recusado' ? 'default' : 'outline'}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleUpdateStatus(activeOrcamento.id, 'recusado')}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Recusado
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setViewDialogOpen(false)}>
                Fechar
              </Button>
              {activeOrcamento.expand?.paciente?.telefone && (
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleSendViaWhatsApp(activeOrcamento)}
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" />
                  Enviar via WhatsApp
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
