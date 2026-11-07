import React, { useState, useEffect } from 'react'
import { medicamentosService } from '@/services/clinica'
import { Medicamento } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pill, Plus, Trash2, Edit2, Search, PackageOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface CatalogoMedicamentosProps {
  /** chamado quando o catálogo muda (para recarregar no emissor de receitas) */
  onChange?: () => void
}

/** Catálogo de medicamentos com posologia pré-definida (cadastro somente administrador) */
export const CatalogoMedicamentos: React.FC<CatalogoMedicamentosProps> = ({ onChange }) => {
  const { toast } = useToast()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Medicamento | null>(null)
  const [nome, setNome] = useState('')
  const [apresentacao, setApresentacao] = useState('')
  const [posologia, setPosologia] = useState('')
  const [saving, setSaving] = useState(false)

  const carregar = async () => {
    setLoading(true)
    try {
      const lista = await medicamentosService.getAll(false)
      setMedicamentos(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar medicamentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const listaFiltrada = medicamentos.filter((m) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return m.nome.toLowerCase().includes(q) || (m.apresentacao || '').toLowerCase().includes(q)
  })

  const abrirNovo = () => {
    setEditando(null)
    setNome('')
    setApresentacao('')
    setPosologia('')
    setDialogOpen(true)
  }

  const abrirEdicao = (m: Medicamento) => {
    setEditando(m)
    setNome(m.nome)
    setApresentacao(m.apresentacao || '')
    setPosologia(m.posologia_padrao || '')
    setDialogOpen(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do medicamento.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      if (editando) {
        await medicamentosService.update(editando.id, {
          nome: nome.trim(),
          apresentacao: apresentacao.trim(),
          posologia_padrao: posologia.trim(),
        })
        toast({ title: 'Medicamento atualizado!' })
      } else {
        await medicamentosService.create({
          nome: nome.trim(),
          apresentacao: apresentacao.trim(),
          posologia_padrao: posologia.trim(),
          ativo: true,
        })
        toast({ title: 'Medicamento cadastrado no catálogo!' })
      }
      setDialogOpen(false)
      carregar()
      onChange?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar medicamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleExcluir = async (m: Medicamento) => {
    if (!confirm(`Deseja realmente excluir "${m.nome}" do catálogo?`)) return
    try {
      await medicamentosService.delete(m.id)
      toast({ title: 'Medicamento removido do catálogo.' })
      carregar()
      onChange?.()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Medicamentos com posologia pré-definida, usados ao emitir receitas no prontuário
        </p>
        <Button
          size="sm"
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-8 shrink-0"
          onClick={abrirNovo}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo Medicamento
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar medicamento..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-xs sm:text-sm"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <p className="text-xs text-slate-500">Carregando catálogo...</p>
        </div>
      ) : listaFiltrada.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-8 text-center bg-white">
          <PackageOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {medicamentos.length === 0
              ? 'Nenhum medicamento cadastrado ainda.'
              : 'Nenhum medicamento encontrado para essa busca.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {listaFiltrada.map((m) => (
            <Card key={m.id} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill className="w-4 h-4 text-marca-vermelho shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-900">{m.nome}</h3>
                    {m.ativo === false && (
                      <Badge variant="outline" className="text-[10px] text-slate-400">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {m.apresentacao && <p className="text-xs text-slate-500">{m.apresentacao}</p>}
                  {m.posologia_padrao && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-md px-2 py-1.5">
                      {m.posologia_padrao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    onClick={() => abrirEdicao(m)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => handleExcluir(m)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar Medicamento' : 'Novo Medicamento do Catálogo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              A posologia pré-definida vem preenchida automaticamente ao adicionar o medicamento em
              uma receita — e pode ser ajustada item a item na emissão.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome do Medicamento *</Label>
              <Input
                placeholder="Ex.: Amoxicilina"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Apresentação</Label>
              <Input
                placeholder="Ex.: 500mg, caixa com 21 cápsulas"
                value={apresentacao}
                onChange={(e) => setApresentacao(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Posologia Pré-definida</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: Tomar 1 cápsula a cada 8 horas por 7 dias, após as refeições."
                value={posologia}
                onChange={(e) => setPosologia(e.target.value)}
                className="mt-1 text-xs sm:text-sm"
              />
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
                {saving ? 'Salvando...' : 'Salvar Medicamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
