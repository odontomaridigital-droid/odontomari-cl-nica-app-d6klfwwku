import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, MessageSquare, Pencil, Trash2, Save, CheckCircle2, Info } from 'lucide-react'
import {
  mensagensAutomaticasService,
  VARIAVEIS_MENSAGEM,
  preencherMensagem,
} from '@/services/clinica'
import { MensagemAutomatica } from '@/types'
import { useToast } from '@/hooks/use-toast'

const FINALIDADES: { valor: MensagemAutomatica['finalidade']; label: string }[] = [
  { valor: 'aniversario', label: 'Aniversário' },
  { valor: 'retorno', label: 'Retorno' },
  { valor: 'pos_operatorio', label: 'Pós-operatório' },
  { valor: 'outro', label: 'Outro' },
]

const VAZIA = {
  nome: '',
  finalidade: 'aniversario' as MensagemAutomatica['finalidade'],
  texto: '',
  ativo: false,
}

/**
 * Cadastro das mensagens automáticas. Não é uma mensagem por ano: é uma lista
 * que o dono edita quando quiser, com uma marcada como "em uso".
 */
export const CatalogoMensagens: React.FC = () => {
  const { toast } = useToast()
  const [mensagens, setMensagens] = useState<MensagemAutomatica[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [editando, setEditando] = useState<MensagemAutomatica | null>(null)
  const [form, setForm] = useState({ ...VAZIA })
  const [salvando, setSalvando] = useState(false)
  const areaTexto = useRef<HTMLTextAreaElement | null>(null)
  // Última posição do cursor conhecida. Sem isso, ao clicar no botão a textarea
  // perde o foco, selectionStart volta a 0 e a variável entra no começo do texto.
  const cursorRef = useRef<number | null>(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      setMensagens(await mensagensAutomaticasService.getAll())
    } catch (err: any) {
      toast({ title: 'Erro ao carregar', description: err.message, variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const abrirNova = () => {
    setEditando(null)
    setForm({ ...VAZIA })
    setDialog(true)
  }

  const abrirEditar = (m: MensagemAutomatica) => {
    setEditando(m)
    setForm({
      nome: m.nome,
      finalidade: m.finalidade,
      texto: m.texto,
      ativo: m.ativo ?? false,
    })
    setDialog(true)
  }

  /**
   * Insere a variável na posição do cursor. Se o campo não estiver focado,
   * acrescenta no fim — assim o botão nunca "perde" o clique.
   */
  const inserirVariavel = (tag: string) => {
    const campo = areaTexto.current
    const textoAtual = form.texto

    // Usa a posição guardada; se o campo está focado, a posição viva manda.
    const focado = campo && document.activeElement === campo
    const posicao =
      focado && campo
        ? (campo.selectionStart ?? textoAtual.length)
        : (cursorRef.current ?? textoAtual.length)

    const inicio = Math.min(posicao, textoAtual.length)
    const novo = textoAtual.slice(0, inicio) + tag + textoAtual.slice(inicio)
    setForm((f) => ({ ...f, texto: novo }))

    const depois = inicio + tag.length
    cursorRef.current = depois
    requestAnimationFrame(() => {
      if (!campo) return
      campo.focus()
      campo.setSelectionRange(depois, depois)
    })
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: 'Dê um nome à mensagem', variant: 'destructive' })
      return
    }
    if (!form.texto.trim()) {
      toast({ title: 'Escreva o texto da mensagem', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const dados = {
        nome: form.nome.trim(),
        finalidade: form.finalidade,
        texto: form.texto.trim(),
        ativo: form.ativo,
      }
      if (editando) {
        await mensagensAutomaticasService.update(editando.id, dados)
        if (dados.ativo) await mensagensAutomaticasService.ativar(editando.id, dados.finalidade)
        toast({ title: 'Mensagem atualizada' })
      } else {
        const criada = await mensagensAutomaticasService.create(dados)
        if (dados.ativo) await mensagensAutomaticasService.ativar(criada.id, dados.finalidade)
        toast({ title: 'Mensagem cadastrada' })
      }
      setDialog(false)
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const definirComoAtiva = async (m: MensagemAutomatica) => {
    try {
      await mensagensAutomaticasService.ativar(m.id, m.finalidade)
      toast({ title: `"${m.nome}" é a mensagem em uso` })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    }
  }

  const remover = async (m: MensagemAutomatica) => {
    if (!window.confirm(`Remover a mensagem "${m.nome}"?`)) return
    try {
      await mensagensAutomaticasService.remove(m.id, m.nome)
      toast({ title: 'Mensagem removida' })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  // Prévia com dados fictícios: mostra como a mensagem chega no celular.
  const previa = preencherMensagem(form.texto, {
    pacienteNome: 'Maria Souza',
    idade: 42,
    clinica: 'Clínica Odontomari',
    dentista: 'Dra. Marinalva',
    telefone: '(19) 97171-4344',
  })

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-marca-vermelho" />
              Mensagens automáticas
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Uma mensagem fica em uso por vez. Edite o texto quando quiser — vale na hora.
            </p>
          </div>
          <Button
            size="sm"
            onClick={abrirNova}
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova mensagem
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <p className="text-xs text-slate-500">Carregando...</p>
          ) : mensagens.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhuma mensagem cadastrada. Sem mensagem, o painel de aniversariantes fica só
              informativo.
            </p>
          ) : (
            mensagens.map((m) => (
              <div
                key={m.id}
                className={`border rounded-lg p-3 flex items-start justify-between gap-3 ${
                  m.ativo ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{m.nome}</span>
                    <Badge variant="outline" className="text-[10px] text-slate-600">
                      {FINALIDADES.find((f) => f.valor === m.finalidade)?.label || m.finalidade}
                    </Badge>
                    {m.ativo && (
                      <Badge className="text-[10px] bg-emerald-600 text-white">em uso</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{m.texto}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!m.ativo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-700 hover:text-emerald-800"
                      title="Usar esta mensagem"
                      onClick={() => definirComoAtiva(m)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => abrirEditar(m)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => remover(m)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
            <DialogDescription className="text-xs">
              O texto pode usar as variáveis abaixo. Elas são trocadas pelos dados de cada paciente
              na hora do envio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Parabéns padrão"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Para que serve</Label>
                <select
                  value={form.finalidade}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      finalidade: e.target.value as MensagemAutomatica['finalidade'],
                    })
                  }
                  className="mt-1 w-full border border-slate-200 rounded-md px-2 py-2 text-xs bg-white"
                >
                  {FINALIDADES.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ---------------- Variáveis ---------------- */}
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5">
              <p className="text-[11px] font-semibold text-sky-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Variáveis disponíveis — clique para inserir no texto
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {VARIAVEIS_MENSAGEM.map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => inserirVariavel(v.tag)}
                    title={v.descricao}
                    className="px-2 py-1 rounded-md border border-sky-300 bg-white text-[11px] font-mono text-sky-800 hover:bg-sky-100 hover:border-sky-400"
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-sky-800 mt-1.5">
                Só estas funcionam. Texto entre chaves que não esteja aqui aparece literalmente na
                mensagem.
              </p>
            </div>

            <div>
              <Label className="text-xs">Texto da mensagem</Label>
              <Textarea
                ref={areaTexto}
                rows={5}
                value={form.texto}
                onChange={(e) => {
                  setForm({ ...form, texto: e.target.value })
                  cursorRef.current = e.target.selectionStart ?? e.target.value.length
                }}
                onSelect={(e) => {
                  const alvo = e.target as HTMLTextAreaElement
                  cursorRef.current = alvo.selectionStart ?? alvo.value.length
                }}
                onClick={(e) => {
                  const alvo = e.target as HTMLTextAreaElement
                  cursorRef.current = alvo.selectionStart ?? alvo.value.length
                }}
                onKeyUp={(e) => {
                  const alvo = e.target as HTMLTextAreaElement
                  cursorRef.current = alvo.selectionStart ?? alvo.value.length
                }}
                placeholder="Olá {primeiro_nome}! A equipe da {clinica} deseja um feliz aniversário..."
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            {/* Prévia */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Como chega no celular (exemplo)
              </p>
              <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{previa || '—'}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Exemplo com paciente fictício: Maria Souza, 42 anos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
              <Label className="text-xs">
                Usar esta mensagem ({FINALIDADES.find((f) => f.valor === form.finalidade)?.label})
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
