import React, { useEffect, useMemo, useState } from 'react'
import { procedimentosService, NOMES_CATEGORIA_PROCEDIMENTO } from '@/services/clinica'
import { Procedimento, ProcedimentoCategoria } from '@/types'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Edit2, Trash2, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

/**
 * Catálogo de PROCEDIMENTOS CLÍNICOS — o que se faz e se cobra.
 *
 * Não confundir com a aba "Tipos de Atendimento", que é da agenda: tipo de
 * atendimento tem duração; procedimento tem valor.
 */
const CATEGORIAS: ProcedimentoCategoria[] = [
  'diagnostico',
  'preventivo',
  'restaurador',
  'endodontia',
  'periodontia',
  'cirurgia',
  'implante',
  'protese',
  'estetica',
  'harmonizacao',
  'outro',
]

export const CatalogoProcedimentos: React.FC = () => {
  const { toast } = useToast()
  const [lista, setLista] = useState<Procedimento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Procedimento | null>(null)
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState<ProcedimentoCategoria>('restaurador')
  const [valor, setValor] = useState('')
  const [codigo, setCodigo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const carregar = async () => {
    setLoading(true)
    try {
      setLista(await procedimentosService.getAll(false))
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar o catálogo',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const q = busca
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return lista.filter((p) => {
      if (filtroCategoria !== 'todas' && p.categoria !== filtroCategoria) return false
      if (!q) return true
      const alvo = `${p.nome} ${p.codigo || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return alvo.includes(q)
    })
  }, [lista, busca, filtroCategoria])

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, Procedimento[]>()
    for (const p of filtrados) {
      const arr = mapa.get(p.categoria) || []
      arr.push(p)
      mapa.set(p.categoria, arr)
    }
    return Array.from(mapa.entries()).sort(
      (a, b) =>
        CATEGORIAS.indexOf(a[0] as ProcedimentoCategoria) -
        CATEGORIAS.indexOf(b[0] as ProcedimentoCategoria),
    )
  }, [filtrados])

  const abrirNovo = () => {
    setEditing(null)
    setNome('')
    setCategoria(
      filtroCategoria !== 'todas' ? (filtroCategoria as ProcedimentoCategoria) : 'restaurador',
    )
    setValor('')
    setCodigo('')
    setObservacoes('')
    setDialogOpen(true)
  }

  const abrirEdicao = (p: Procedimento) => {
    setEditing(p)
    setNome(p.nome)
    setCategoria(p.categoria)
    setValor(p.valor ? String(p.valor) : '')
    setCodigo(p.codigo || '')
    setObservacoes(p.observacoes || '')
    setDialogOpen(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do procedimento.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const dados = {
        nome: nome.trim(),
        categoria,
        valor: valor ? Number(valor) : 0,
        codigo: codigo.trim(),
        observacoes: observacoes.trim(),
      }
      if (editing) {
        await procedimentosService.update(editing.id, dados)
        toast({ title: 'Procedimento atualizado' })
      } else {
        await procedimentosService.create({ ...dados, ativo: true })
        toast({ title: 'Procedimento cadastrado' })
      }
      setDialogOpen(false)
      carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Verifique se já existe um procedimento com esse nome.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const excluir = async (p: Procedimento) => {
    if (!confirm(`Remover o procedimento "${p.nome}" do catálogo?`)) return
    try {
      await procedimentosService.delete(p.id, p.nome)
      toast({ title: 'Procedimento removido' })
      carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            O que a clínica faz e cobra. O valor que entra no planejamento sai daqui.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Para a agenda, o que vale é a aba Tipos de Atendimento (duração, sem valor).
          </p>
        </div>
        <Button
          size="sm"
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-8 shrink-0"
          onClick={abrirNovo}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo Procedimento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar procedimento por nome ou código..."
            className="pl-8 text-xs sm:text-sm h-9"
          />
        </div>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs sm:text-sm">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {NOMES_CATEGORIA_PROCEDIMENTO[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Carregando catálogo...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none bg-white">
          <CardContent className="p-8 text-center">
            <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              {lista.length === 0
                ? 'Nenhum procedimento cadastrado ainda'
                : 'Nenhum procedimento encontrado com esse filtro'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {lista.length === 0
                ? 'Cadastre o primeiro ou importe a tabela da clínica.'
                : 'Tente outro termo ou limpe o filtro de categoria.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {porCategoria.map(([cat, itens]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {NOMES_CATEGORIA_PROCEDIMENTO[cat as ProcedimentoCategoria] || cat}
                </h3>
                <span className="text-[11px] text-slate-400">{itens.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {itens.map((p) => (
                  <Card key={p.id} className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                          {p.nome}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-marca-vermelho/30 text-marca-vermelho bg-marca-vermelho-claro font-semibold"
                          >
                            {formatCurrency(p.valor || 0)}
                          </Badge>
                          {p.codigo && (
                            <span className="text-[10px] text-slate-400">cód. {p.codigo}</span>
                          )}
                          {p.ativo === false && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              inativo
                            </Badge>
                          )}
                        </div>
                        {p.observacoes && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {p.observacoes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-700"
                          onClick={() => abrirEdicao(p)}
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          onClick={() => excluir(p)}
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar procedimento' : 'Novo procedimento'}</DialogTitle>
            <DialogDescription>
              Procedimento é o que se cobra. O valor entra no planejamento e no orçamento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <Label htmlFor="proc-nome" className="text-xs">
                Nome do procedimento *
              </Label>
              <Input
                id="proc-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Coroa em Cerômero"
                className="text-sm mt-1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria *</Label>
                <Select
                  value={categoria}
                  onValueChange={(v) => setCategoria(v as ProcedimentoCategoria)}
                >
                  <SelectTrigger className="text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {NOMES_CATEGORIA_PROCEDIMENTO[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="proc-valor" className="text-xs">
                  Valor (R$)
                </Label>
                <Input
                  id="proc-valor"
                  type="number"
                  min="0"
                  step="1"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0"
                  className="text-sm mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="proc-codigo" className="text-xs">
                Código (opcional)
              </Label>
              <Input
                id="proc-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código do convênio ou da tabela interna"
                className="text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="proc-obs" className="text-xs">
                Observações
              </Label>
              <Textarea
                id="proc-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Detalhes, materiais, condições"
                className="text-sm mt-1"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              >
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
