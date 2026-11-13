import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { FileSignature, Plus, Trash2, Edit2, Search, PackageOpen, Pill } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { receitaModelosService, medicamentosService } from '@/services/clinica'
import { ReceitaModelo, Medicamento, ItemReceita } from '@/types'
import { BotaoDitar } from '@/components/voz/BotaoDitar'

/** Rótulos das categorias de modelo de receita. */
export const ROTULOS_CATEGORIA_RECEITA: Record<string, string> = {
  pos_cirurgico: 'Pós-cirúrgico',
  antibiotico: 'Antibiótico',
  analgesico: 'Analgésico',
  anti_inflamatorio: 'Anti-inflamatório',
  bochecho: 'Bochecho',
  ansiolitico: 'Ansiolítico',
  outro: 'Outro',
}

interface ItemForm {
  nome: string
  apresentacao: string
  posologia: string
}

/**
 * Modelos de receita: o dentista cadastra um conjunto pronto de medicamentos
 * com posologia e orientações. Na emissão da receita, escolhe o modelo e ajusta.
 */
export const ModelosReceita: React.FC = () => {
  const { toast } = useToast()
  const [modelos, setModelos] = useState<ReceitaModelo[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ReceitaModelo | null>(null)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('pos_cirurgico')
  const [descricao, setDescricao] = useState('')
  const [orientacoes, setOrientacoes] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ nome: '', apresentacao: '', posologia: '' }])
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [lista, meds] = await Promise.all([
        receitaModelosService.getAll(false),
        medicamentosService.getAll(true),
      ])
      setModelos(lista)
      setMedicamentos(meds)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar modelos',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = modelos.filter((m) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.descricao || '').toLowerCase().includes(q) ||
      (ROTULOS_CATEGORIA_RECEITA[m.categoria] || '').toLowerCase().includes(q)
    )
  })

  const abrirNovo = () => {
    setEditando(null)
    setNome('')
    setCategoria('pos_cirurgico')
    setDescricao('')
    setOrientacoes('')
    setItens([{ nome: '', apresentacao: '', posologia: '' }])
    setAberto(true)
  }

  const abrirEdicao = (m: ReceitaModelo) => {
    setEditando(m)
    setNome(m.nome)
    setCategoria(m.categoria)
    setDescricao(m.descricao || '')
    setOrientacoes(m.orientacoes || '')
    const lista = Array.isArray(m.itens) ? m.itens : []
    setItens(
      lista.length > 0
        ? lista.map((i) => ({
            nome: i.nome || '',
            apresentacao: i.apresentacao || '',
            posologia: i.posologia || '',
          }))
        : [{ nome: '', apresentacao: '', posologia: '' }],
    )
    setAberto(true)
  }

  /** Ao escolher um medicamento do catálogo, traz apresentação e posologia. */
  const escolherMedicamento = (idx: number, nomeMed: string) => {
    const med = medicamentos.find((m) => m.nome === nomeMed)
    setItens((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              nome: nomeMed,
              apresentacao: med?.apresentacao || it.apresentacao,
              posologia: med?.posologia_padrao || it.posologia,
            }
          : it,
      ),
    )
  }

  const atualizarItem = (idx: number, campo: keyof ItemForm, valor: string) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)))
  }

  const adicionarItem = () =>
    setItens((prev) => [...prev, { nome: '', apresentacao: '', posologia: '' }])

  const removerItem = (idx: number) => {
    if (itens.length === 1) {
      toast({ title: 'O modelo precisa de pelo menos um medicamento.' })
      return
    }
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  const salvar = async () => {
    if (!nome.trim()) {
      toast({ title: 'Informe o nome do modelo', variant: 'destructive' })
      return
    }
    const itensValidos: ItemReceita[] = itens
      .filter((i) => i.nome.trim())
      .map((i) => ({
        nome: i.nome.trim(),
        apresentacao: i.apresentacao.trim() || undefined,
        posologia: i.posologia.trim(),
      }))
    if (itensValidos.length === 0) {
      toast({ title: 'Adicione pelo menos um medicamento', variant: 'destructive' })
      return
    }

    setSalvando(true)
    try {
      const dados = {
        nome: nome.trim(),
        categoria,
        descricao: descricao.trim(),
        itens: itensValidos,
        orientacoes: orientacoes.trim(),
      }
      if (editando) {
        await receitaModelosService.update(editando.id, dados)
        toast({ title: 'Modelo atualizado!' })
      } else {
        await receitaModelosService.create({ ...dados, ativo: true })
        toast({ title: 'Modelo criado!' })
      }
      setAberto(false)
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (m: ReceitaModelo) => {
    if (!confirm(`Excluir o modelo "${m.nome}"?`)) return
    try {
      await receitaModelosService.delete(m.id)
      toast({ title: 'Modelo removido.' })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Receitas prontas: escolha um modelo ao emitir e a receita já vem preenchida, com
          medicamentos e orientações. Dá para ajustar item a item antes de salvar.
        </p>
        <Button
          size="sm"
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-8 shrink-0"
          onClick={abrirNovo}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo modelo
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar modelo de receita..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-xs sm:text-sm"
        />
      </div>

      {carregando ? (
        <div className="p-8 text-center">
          <p className="text-xs text-slate-500">Carregando modelos...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-8 text-center bg-white">
          <PackageOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {modelos.length === 0
              ? 'Nenhum modelo de receita cadastrado ainda.'
              : 'Nenhum modelo encontrado para essa busca.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((m) => {
            const lista = Array.isArray(m.itens) ? m.itens : []
            return (
              <Card key={m.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileSignature className="w-4 h-4 text-marca-vermelho shrink-0" />
                        <h3 className="text-sm font-semibold text-slate-900">{m.nome}</h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-slate-300 text-slate-600"
                        >
                          {ROTULOS_CATEGORIA_RECEITA[m.categoria] || m.categoria}
                        </Badge>
                        {m.ativo === false && (
                          <Badge variant="outline" className="text-[10px] text-slate-400">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      {m.descricao && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{m.descricao}</p>
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
                        onClick={() => excluir(m)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {lista.map((i, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] bg-slate-50 border border-slate-100 rounded-md px-2 py-1"
                      >
                        <Pill className="w-3 h-3 text-marca-vermelho shrink-0 mt-0.5" />
                        <span className="text-slate-700">
                          <strong>{i.nome}</strong>
                          {i.apresentacao ? ` — ${i.apresentacao}` : ''}
                          {i.posologia ? (
                            <span className="block text-slate-500">{i.posologia}</span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>

                  {m.orientacoes && (
                    <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                      <strong>Orientações:</strong> {m.orientacoes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSignature className="w-5 h-5 text-marca-vermelho" />
              {editando ? 'Editar modelo de receita' : 'Novo modelo de receita'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Monte o conjunto de medicamentos com posologia. Na emissão da receita o dentista
              escolhe este modelo e ajusta o que precisar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do modelo *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Pós-cirúrgico de extração"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_CATEGORIA_RECEITA).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Para pós-operatório de exodontia simples"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Medicamentos do modelo *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarItem}
                  className="h-7 text-[11px]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-lg p-2.5 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-marca-vermelho text-white hover:bg-marca-vermelho text-[10px]">
                        {idx + 1}
                      </Badge>
                      <Select value={item.nome} onValueChange={(v) => escolherMedicamento(idx, v)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Escolher do catálogo" />
                        </SelectTrigger>
                        <SelectContent>
                          {medicamentos.map((m) => (
                            <SelectItem key={m.id} value={m.nome} className="text-xs">
                              {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      value={item.nome}
                      onChange={(e) => atualizarItem(idx, 'nome', e.target.value)}
                      placeholder="Nome do medicamento (ou escolha acima)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={item.apresentacao}
                      onChange={(e) => atualizarItem(idx, 'apresentacao', e.target.value)}
                      placeholder="Apresentação (ex.: 500mg, caixa 21 cápsulas)"
                      className="h-8 text-xs"
                    />
                    <div className="relative">
                      <Textarea
                        rows={2}
                        value={item.posologia}
                        onChange={(e) => atualizarItem(idx, 'posologia', e.target.value)}
                        placeholder="Posologia (ex.: Tomar 1 comprimido de 8/8 horas por 7 dias)"
                        className="text-xs pr-10"
                      />
                      <div className="absolute right-1.5 top-1.5">
                        <BotaoDitar
                          titulo="Ditar a posologia"
                          onErro={(msg) =>
                            toast({ title: 'Ditado', description: msg, variant: 'destructive' })
                          }
                          onTexto={(texto) => {
                            const atual = (item.posologia || '').trim()
                            atualizarItem(idx, 'posologia', atual ? `${atual} ${texto}` : texto)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Orientações gerais</Label>
              <div className="relative mt-1">
                <Textarea
                  rows={3}
                  value={orientacoes}
                  onChange={(e) => setOrientacoes(e.target.value)}
                  placeholder="Ex.: Manter a gaze por 40 minutos. Não fumar por 48 horas."
                  className="text-xs sm:text-sm pr-10"
                />
                <div className="absolute right-1.5 top-1.5">
                  <BotaoDitar
                    titulo="Ditar as orientações"
                    onErro={(msg) =>
                      toast({ title: 'Ditado', description: msg, variant: 'destructive' })
                    }
                    onTexto={(texto) =>
                      setOrientacoes((atual) =>
                        atual.trim() ? `${atual.trimEnd()} ${texto}` : texto,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAberto(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              disabled={salvando}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
            >
              {salvando ? 'Salvando...' : 'Salvar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
