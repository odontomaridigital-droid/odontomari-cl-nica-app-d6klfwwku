import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Pill,
  Plus,
  Trash2,
  Printer,
  MessageCircle,
  Search,
  FileSignature,
  Eye,
  Loader2,
  X,
} from 'lucide-react'
import { ReceitaDocumento } from '@/components/receitas/ReceitaDocumento'
import {
  medicamentosService,
  receitasService,
  configuracoesService,
  DEFAULT_CONFIGS,
} from '@/services/clinica'
import { Medicamento, Receita, ItemReceita, ClinicaConfig } from '@/types'
import { formatDateBr, getTodayDateString, createWhatsAppUrl } from '@/lib/formatters'
import { montarTextoReceita, normalizarItensReceita } from '@/lib/receitas'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ReceitasTabProps {
  receitas: Receita[]
  isAdmin: boolean
  pacienteId: string
  pacienteNome: string
  pacienteTelefone?: string
  autorId?: string
  onSaved: () => void
  onError: (title: string, message: string) => void
}

interface ItemForm extends ItemReceita {}

/** Aba "Receitas" da ficha do paciente: histórico + emissão de receituário simples */
export const ReceitasTab: React.FC<ReceitasTabProps> = ({
  receitas,
  isAdmin,
  pacienteId,
  pacienteNome,
  pacienteTelefone,
  autorId,
  onSaved,
  onError,
}) => {
  const { toast } = useToast()

  // ===== catálogo + configurações (dados da clínica/dentista p/ assinatura) =====
  const [catalogo, setCatalogo] = useState<Medicamento[]>([])
  const [config, setConfig] = useState<ClinicaConfig>(DEFAULT_CONFIGS)

  useEffect(() => {
    medicamentosService
      .getAll()
      .then(setCatalogo)
      .catch(() => {})
    configuracoesService
      .getConfigs()
      .then((c) => setConfig(c))
      .catch(() => {})
  }, [])

  // ===== diálogo de emissão =====
  const [dialogOpen, setDialogOpen] = useState(false)
  const [data, setData] = useState(getTodayDateString())
  const [itens, setItens] = useState<ItemForm[]>([])
  const [orientacoes, setOrientacoes] = useState('')
  const [saving, setSaving] = useState(false)

  // busca no catálogo
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Medicamento[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ===== visualização / impressão / whatsapp / confirmação =====
  const [visualizando, setVisualizando] = useState<Receita | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const abrirNova = () => {
    if (!isAdmin) {
      onError(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode emitir receitas. A recepção tem acesso somente de leitura.',
      )
      return
    }
    setData(getTodayDateString())
    setItens([])
    setOrientacoes('')
    setBusca('')
    setEditandoId(null)
    setDialogOpen(true)
  }

  const abrirEdicao = (receita: Receita) => {
    if (!isAdmin) {
      onError(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode editar receitas. A recepção tem acesso somente de leitura.',
      )
      return
    }
    setData(receita.data ? receita.data.split(' ')[0].split('T')[0] : getTodayDateString())
    setItens(Array.isArray(receita.itens) ? [...receita.itens] : [])
    setOrientacoes(receita.orientacoes || '')
    setBusca('')
    setEditandoId(receita.id)
    setDialogOpen(true)
  }

  // ===== busca com debounce no catálogo =====
  const buscarCatalogo = (q: string) => {
    if (buscaTimer.current) clearTimeout(buscaTimer.current)
    buscaTimer.current = setTimeout(async () => {
      if (!q.trim()) {
        setResultados([])
        return
      }
      setBuscando(true)
      try {
        const res = await medicamentosService.search(q)
        setResultados(res)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 250)
  }

  const handleBuscaChange = (valor: string) => {
    setBusca(valor)
    setMostrarResultados(true)
    buscarCatalogo(valor)
  }

  const adicionarDoCatalogo = (m: Medicamento) => {
    setItens((prev) => [
      ...prev,
      {
        medicamento_id: m.id,
        nome: m.nome,
        apresentacao: m.apresentacao || undefined,
        posologia: m.posologia_padrao || '',
      },
    ])
    setBusca('')
    setResultados([])
    setMostrarResultados(false)
  }

  const adicionarLivre = () => {
    const nome = busca.trim()
    if (!nome) return
    setItens((prev) => [...prev, { nome, posologia: '' }])
    setBusca('')
    setResultados([])
    setMostrarResultados(false)
  }

  const removerItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  const atualizarItem = (idx: number, campo: keyof ItemForm, valor: string) => {
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)))
  }

  // ===== salvar (com diálogo de confirmação) =====
  const handleSalvar = async () => {
    if (!isAdmin) return
    const itensNorm = normalizarItensReceita(itens)
    if (itensNorm.length === 0) {
      toast({
        title: 'Receita vazia',
        description: 'Adicione pelo menos um medicamento com posologia.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload = {
        itens: itensNorm,
        orientacoes: orientacoes.trim() || undefined,
        data,
      }
      if (editandoId) {
        await receitasService.update(editandoId, payload)
        toast({ title: 'Receita atualizada!' })
      } else {
        await receitasService.create({
          ...payload,
          paciente: pacienteId,
          autor: autorId,
        })
        toast({ title: 'Receita registrada no prontuário!' })
      }
      setDialogOpen(false)
      setConfirmando(false)
      setEditandoId(null)
      onSaved()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar receita',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ===== WhatsApp =====
  const enviarWhatsApp = (receita: Receita) => {
    if (!pacienteTelefone) {
      toast({
        title: 'Paciente sem telefone',
        description: 'Cadastre um telefone para o paciente para enviar a receita pelo WhatsApp.',
        variant: 'destructive',
      })
      return
    }
    const texto = montarTextoReceita(receita, pacienteNome, config)
    window.open(createWhatsAppUrl(pacienteTelefone, texto), '_blank')
  }

  // ===== impressão =====
  const imprimir = (receita: Receita) => {
    setVisualizando(receita)
    // aguarda o diálogo montar o documento antes de imprimir
    setTimeout(() => {
      window.print()
    }, 150)
  }

  return (
    <div className="space-y-4">
      {receitas.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-medium text-slate-700 text-sm">Nenhuma receita emitida</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Emita a primeira receita deste paciente escolhendo medicamentos do catálogo com posologia pré-definida.'
              : 'Nenhuma receita emitida pelo dentista até o momento.'}
          </p>
          {isAdmin && (
            <Button
              size="sm"
              className="mt-4 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              onClick={abrirNova}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Emitir Primeira Receita
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {receitas.length} receita{receitas.length > 1 ? 's' : ''} no histórico deste paciente
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
                onClick={abrirNova}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Receita
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {receitas.map((r) => (
              <Card key={r.id} className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-marca-vermelho-claro text-marca-vermelho-escuro hover:bg-marca-vermelho-claro text-xs">
                      {formatDateBr(r.data)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px] text-slate-500 border-slate-300"
                    >
                      {Array.isArray(r.itens) ? r.itens.length : 0} medicamento
                      {Array.isArray(r.itens) && r.itens.length === 1 ? '' : 's'}
                    </Badge>
                    {r.origem && r.origem !== 'manual' && (
                      <Badge
                        variant="outline"
                        className="text-[11px] text-slate-400 border-slate-300"
                      >
                        {r.origem}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium text-right">
                    Emitida por {r.expand?.autor?.name || 'Dentista'}
                  </span>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {Array.isArray(r.itens) && r.itens.length > 0
                          ? r.itens.map((i) => i.nome).join(', ')
                          : 'Receita sem medicamentos'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Registrada em {formatDateBr(r.created || r.data)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setVisualizando(r)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver Receita
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => enviarWhatsApp(r)}
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        WhatsApp
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-slate-600"
                          onClick={() => abrirEdicao(r)}
                        >
                          <Pill className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ===== Diálogo de emissão/edição (Admin) ===== */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileSignature className="w-5 h-5 text-marca-vermelho" />
              {editandoId ? 'Editar Receita' : 'Nova Receita'} — {pacienteNome}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha medicamentos do catálogo (a posologia pré-definida vem preenchida e pode ser
              ajustada) ou digite um medicamento livre.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-4">
            {/* Data */}
            <div>
              <Label className="text-xs">Data de emissão</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 text-xs sm:text-sm max-w-[200px]"
              />
            </div>

            {/* Busca no catálogo */}
            <div className="relative">
              <Label className="text-xs">Medicamentos</Label>
              <div className="relative mt-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar no catálogo (ex.: amoxicilina) ou digite um medicamento livre + Enter"
                  value={busca}
                  onChange={(e) => handleBuscaChange(e.target.value)}
                  onFocus={() => setMostrarResultados(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (resultados.length > 0) {
                        adicionarDoCatalogo(resultados[0])
                      } else if (busca.trim()) {
                        adicionarLivre()
                      }
                    }
                  }}
                  className="pl-9 pr-8 text-xs sm:text-sm"
                />
                {busca && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      setBusca('')
                      setResultados([])
                      setMostrarResultados(false)
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {buscando && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                </p>
              )}

              {mostrarResultados && resultados.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {resultados.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-marca-vermelho-claro/50 border-b border-slate-100 last:border-0"
                      onClick={() => adicionarDoCatalogo(m)}
                    >
                      <p className="text-xs font-semibold text-slate-900">{m.nome}</p>
                      {m.apresentacao && (
                        <p className="text-[11px] text-slate-500">{m.apresentacao}</p>
                      )}
                      {m.posologia_padrao && (
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {m.posologia_padrao}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {mostrarResultados && !buscando && busca.trim() && resultados.length === 0 && (
                <button
                  type="button"
                  className="mt-1 w-full text-left px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs text-slate-600 hover:bg-slate-50"
                  onClick={adicionarLivre}
                >
                  + Adicionar "{busca.trim()}" como medicamento livre (não está no catálogo)
                </button>
              )}
            </div>

            {/* Itens da receita */}
            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">
                Nenhum medicamento adicionado ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-marca-vermelho text-white hover:bg-marca-vermelho text-[10px]">
                        {idx + 1}
                      </Badge>
                      <Input
                        value={item.nome}
                        onChange={(e) => atualizarItem(idx, 'nome', e.target.value)}
                        placeholder="Nome do medicamento"
                        className="h-8 text-xs font-semibold flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
                        onClick={() => removerItem(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={item.apresentacao || ''}
                      onChange={(e) => atualizarItem(idx, 'apresentacao', e.target.value)}
                      placeholder="Apresentação (ex.: 500mg, caixa 21 comprimidos)"
                      className="h-8 text-xs"
                    />
                    <Textarea
                      rows={2}
                      value={item.posologia}
                      onChange={(e) => atualizarItem(idx, 'posologia', e.target.value)}
                      placeholder="Posologia (ex.: Tomar 1 comprimido a cada 8 horas por 7 dias)"
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Orientações gerais */}
            <div>
              <Label className="text-xs">Orientações gerais (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ex.: retornar em 7 dias para reavaliação; evitar alimentos muito quentes hoje."
                value={orientacoes}
                onChange={(e) => setOrientacoes(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              disabled={saving || itens.length === 0}
              onClick={() => setConfirmando(true)}
            >
              Revisar e Salvar Receita
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Diálogo de confirmação resumindo a receita ===== */}
      <Dialog open={confirmando} onOpenChange={(o) => !o && setConfirmando(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Confirmar emissão da receita</DialogTitle>
            <DialogDescription className="text-xs">
              Revise o resumo antes de registrar no prontuário de {pacienteNome}.
            </DialogDescription>
          </DialogHeader>

          <div className="text-xs text-slate-700 space-y-2 max-h-[40vh] overflow-y-auto">
            <p>
              <span className="text-slate-400">Data:</span> {formatDateBr(data)}
            </p>
            {normalizarItensReceita(itens).map((item, i) => (
              <div key={i} className="border-l-2 border-marca-vermelho/40 pl-2">
                <p className="font-semibold">
                  {i + 1}. {item.nome}
                  {item.apresentacao ? ` (${item.apresentacao})` : ''}
                </p>
                <p className="text-slate-600 whitespace-pre-line">{item.posologia}</p>
              </div>
            ))}
            {orientacoes.trim() && (
              <div className="border-l-2 border-slate-200 pl-2">
                <p className="text-slate-400">Orientações gerais</p>
                <p className="text-slate-600 whitespace-pre-line">{orientacoes}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmando(false)}
              disabled={saving}
            >
              Voltar e Editar
            </Button>
            <Button
              type="button"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={handleSalvar}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Confirmar e Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Diálogo de visualização / impressão ===== */}
      <Dialog open={Boolean(visualizando)} onOpenChange={(o) => !o && setVisualizando(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 print:static print:bg-white print:max-w-none print:max-h-none print:border-0 print:shadow-none">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100 print:hidden">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileSignature className="w-5 h-5 text-marca-vermelho" />
              Receita de {formatDateBr(visualizando?.data)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paciente: {pacienteNome} • Emitida por{' '}
              {visualizando?.expand?.autor?.name || 'Dentista'}
            </DialogDescription>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => window.print()}
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Imprimir
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                onClick={() => visualizando && enviarWhatsApp(visualizando)}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" />
                Enviar no WhatsApp
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 print:overflow-visible print:p-0">
            {visualizando && (
              <ReceitaDocumento
                receita={visualizando}
                pacienteNome={pacienteNome}
                dentistaNome={config.dentista_nome}
                dentistaCro={config.dentista_cro}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
