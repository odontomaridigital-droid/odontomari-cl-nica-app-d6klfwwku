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
import { FileText, Plus, Trash2, Edit2, Search, PackageOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { documentosModelosService } from '@/services/clinica'
import { DocumentoModelo } from '@/types'
import { BotaoDitar } from '@/components/voz/BotaoDitar'

const ROTULOS_CATEGORIA: Record<string, string> = {
  pos_cirurgico: 'Pós-cirúrgico',
  pos_operatorio: 'Pós-operatório',
  orientacao: 'Orientação',
  atestado: 'Atestado',
  declaracao: 'Declaração',
  termo: 'Termo',
  outro: 'Outro',
}

/** Variáveis que podem ser usadas no corpo do modelo. */
const VARIAVEIS = [
  { chave: '{paciente}', desc: 'nome completo do paciente' },
  { chave: '{primeiro_nome}', desc: 'só o primeiro nome' },
  { chave: '{data}', desc: 'data de emissão' },
  { chave: '{procedimento}', desc: 'procedimento informado na emissão' },
  { chave: '{clinica}', desc: 'nome da clínica' },
  { chave: '{dentista}', desc: 'nome da dentista' },
  { chave: '{cro}', desc: 'CRO da dentista' },
  { chave: '{telefone}', desc: 'telefone da clínica' },
]

/**
 * Modelos de documento: atestados, declarações e orientações que a clínica
 * emite para o paciente. O texto usa variáveis que são trocadas na emissão.
 */
export const ModelosDocumento: React.FC = () => {
  const { toast } = useToast()
  const [modelos, setModelos] = useState<DocumentoModelo[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<DocumentoModelo | null>(null)
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('pos_cirurgico')
  const [corpo, setCorpo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const lista = await documentosModelosService.getAll(false)
      setModelos(lista)
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
      m.titulo.toLowerCase().includes(q) ||
      (m.corpo || '').toLowerCase().includes(q) ||
      (ROTULOS_CATEGORIA[m.categoria] || '').toLowerCase().includes(q)
    )
  })

  const abrirNovo = () => {
    setEditando(null)
    setTitulo('')
    setCategoria('pos_cirurgico')
    setCorpo('')
    setAberto(true)
  }

  const abrirEdicao = (m: DocumentoModelo) => {
    setEditando(m)
    setTitulo(m.titulo)
    setCategoria(m.categoria)
    setCorpo(m.corpo)
    setAberto(true)
  }

  const salvar = async () => {
    if (!titulo.trim() || !corpo.trim()) {
      toast({
        title: 'Título e conteúdo são obrigatórios',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await documentosModelosService.update(editando.id, {
          titulo: titulo.trim(),
          categoria,
          corpo: corpo.trim(),
        })
        toast({ title: 'Modelo atualizado!' })
      } else {
        await documentosModelosService.create({
          titulo: titulo.trim(),
          categoria,
          corpo: corpo.trim(),
          ativo: true,
        })
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

  const excluir = async (m: DocumentoModelo) => {
    if (!confirm(`Excluir o modelo "${m.titulo}"?`)) return
    try {
      await documentosModelosService.delete(m.id)
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
          Atestados, declarações e orientações que a clínica entrega ao paciente. O texto usa
          variáveis que são preenchidas na hora de emitir.
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

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
        <p className="text-[11px] font-semibold text-blue-900 mb-1">
          Variáveis que você pode usar no texto:
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {VARIAVEIS.map((v) => (
            <span key={v.chave} className="text-[10px] text-blue-800">
              <code className="bg-white px-1 rounded border border-blue-200">{v.chave}</code>{' '}
              {v.desc}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Buscar modelo de documento..."
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
              ? 'Nenhum modelo de documento cadastrado ainda.'
              : 'Nenhum modelo encontrado para essa busca.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((m) => (
            <Card key={m.id} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="w-4 h-4 text-marca-vermelho shrink-0" />
                      <h3 className="text-sm font-semibold text-slate-900">{m.titulo}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-slate-300 text-slate-600"
                      >
                        {ROTULOS_CATEGORIA[m.categoria] || m.categoria}
                      </Badge>
                      {m.ativo === false && (
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          Inativo
                        </Badge>
                      )}
                    </div>
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
                <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-3 whitespace-pre-line">
                  {m.corpo.slice(0, 220)}
                  {m.corpo.length > 220 ? '…' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-marca-vermelho" />
              {editando ? 'Editar modelo de documento' : 'Novo modelo de documento'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Use as variáveis entre chaves para preencher os dados automaticamente na emissão.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Atestado de comparecimento"
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
                    {Object.entries(ROTULOS_CATEGORIA).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Conteúdo do documento *</Label>
              <div className="relative mt-1">
                <Textarea
                  rows={14}
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  placeholder="Escreva o texto. Ex.: Atesto que o(a) paciente {paciente} compareceu..."
                  className="text-xs sm:text-sm font-mono pr-10"
                />
                <div className="absolute right-1.5 top-1.5">
                  <BotaoDitar
                    titulo="Ditar o conteúdo"
                    onErro={(msg) =>
                      toast({ title: 'Ditado', description: msg, variant: 'destructive' })
                    }
                    onTexto={(texto) =>
                      setCorpo((atual) => (atual.trim() ? `${atual.trimEnd()} ${texto}` : texto))
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
