import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, CreditCard, Pencil, Trash2, Save, Banknote } from 'lucide-react'
import { maquinasService, condicoesPagamentoService } from '@/services/clinica'
import { Maquina, CondicaoPagamento, CondicaoTipo, FormaLancamento } from '@/types'
import { useToast } from '@/hooks/use-toast'

const MAQUINA_VAZIA = {
  nome: '',
  ativo: true,
  dias_debito: 1,
  dias_credito_vista: 30,
  dias_credito_parcelado: 30,
  dias_pix: 0,
  taxa_debito: 0,
  taxa_credito_vista: 0,
  taxa_credito_parcelado: 0,
  taxa_pix: 0,
  observacoes: '',
}

const TIPOS_CONDICAO: { valor: CondicaoTipo; label: string }[] = [
  { valor: 'dinheiro', label: 'Dinheiro' },
  { valor: 'pix', label: 'PIX' },
  { valor: 'cartao_credito', label: 'Cartão de crédito' },
  { valor: 'cartao_debito', label: 'Cartão de débito' },
  { valor: 'cheque', label: 'Cheque' },
  { valor: 'boleto', label: 'Boleto' },
]

const FORMAS: { valor: FormaLancamento; label: string; dica: string }[] = [
  {
    valor: 'um_lancamento',
    label: 'Um lancamento so',
    dica: 'O dinheiro cai de uma vez. Usado no cartao: as parcelas ficam so registradas.',
  },
  {
    valor: 'por_parcela',
    label: 'Uma conta por parcela',
    dica: 'Cada parcela vira uma conta a receber, com o seu vencimento.',
  },
  {
    valor: 'na_compensacao',
    label: 'Um por cheque, na compensacao',
    dica: 'Cada cheque com a sua data de compensacao.',
  },
]

/**
 * Cadastro de maquinas de cartao e condicoes de pagamento.
 * A maquina guarda o prazo de repasse (D+N) e a taxa por modalidade; e dela
 * que o contas a receber tira a data e o valor liquido de cada venda no cartao.
 */
export const CatalogoPagamentos: React.FC = () => {
  const { toast } = useToast()

  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [condicoes, setCondicoes] = useState<CondicaoPagamento[]>([])
  const [carregando, setCarregando] = useState(true)

  const [maquinaDialog, setMaquinaDialog] = useState(false)
  const [maquinaEditando, setMaquinaEditando] = useState<Maquina | null>(null)
  const [formMaquina, setFormMaquina] = useState({ ...MAQUINA_VAZIA })

  const [condicaoDialog, setCondicaoDialog] = useState(false)
  const [condicaoEditando, setCondicaoEditando] = useState<CondicaoPagamento | null>(null)
  const [formCondicao, setFormCondicao] = useState({
    nome: '',
    tipo: 'dinheiro' as CondicaoTipo,
    maquina: '',
    permite_parcelamento: false,
    max_parcelas: 1,
    forma_lancamento: 'um_lancamento' as FormaLancamento,
    ativo: true,
  })

  const [salvando, setSalvando] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [ms, cs] = await Promise.all([
        maquinasService.getAll(),
        condicoesPagamentoService.getAll(),
      ])
      setMaquinas(ms)
      setCondicoes(cs)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- Maquinas ----------------
  const abrirNovaMaquina = () => {
    setMaquinaEditando(null)
    setFormMaquina({ ...MAQUINA_VAZIA })
    setMaquinaDialog(true)
  }

  const abrirEditarMaquina = (m: Maquina) => {
    setMaquinaEditando(m)
    setFormMaquina({
      nome: m.nome,
      ativo: m.ativo ?? true,
      dias_debito: m.dias_debito ?? 1,
      dias_credito_vista: m.dias_credito_vista ?? 30,
      dias_credito_parcelado: m.dias_credito_parcelado ?? 30,
      dias_pix: m.dias_pix ?? 0,
      taxa_debito: m.taxa_debito ?? 0,
      taxa_credito_vista: m.taxa_credito_vista ?? 0,
      taxa_credito_parcelado: m.taxa_credito_parcelado ?? 0,
      taxa_pix: m.taxa_pix ?? 0,
      observacoes: m.observacoes || '',
    })
    setMaquinaDialog(true)
  }

  const salvarMaquina = async () => {
    if (!formMaquina.nome.trim()) {
      toast({ title: 'De um nome a maquina', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const dados = {
        ...formMaquina,
        nome: formMaquina.nome.trim(),
        dias_debito: Number(formMaquina.dias_debito) || 0,
        dias_credito_vista: Number(formMaquina.dias_credito_vista) || 0,
        dias_credito_parcelado: Number(formMaquina.dias_credito_parcelado) || 0,
        dias_pix: Number(formMaquina.dias_pix) || 0,
        taxa_debito: Number(formMaquina.taxa_debito) || 0,
        taxa_credito_vista: Number(formMaquina.taxa_credito_vista) || 0,
        taxa_credito_parcelado: Number(formMaquina.taxa_credito_parcelado) || 0,
        taxa_pix: Number(formMaquina.taxa_pix) || 0,
      }
      if (maquinaEditando) {
        await maquinasService.update(maquinaEditando.id, dados)
        toast({ title: 'Maquina atualizada' })
      } else {
        await maquinasService.create(dados)
        toast({ title: 'Maquina cadastrada' })
      }
      setMaquinaDialog(false)
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const removerMaquina = async (m: Maquina) => {
    if (!window.confirm(`Remover a maquina ${m.nome}?`)) return
    try {
      await maquinasService.remove(m.id, m.nome)
      toast({ title: 'Maquina removida' })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  // ---------------- Condicoes ----------------
  const abrirNovaCondicao = () => {
    setCondicaoEditando(null)
    setFormCondicao({
      nome: '',
      tipo: 'dinheiro',
      maquina: '',
      permite_parcelamento: false,
      max_parcelas: 1,
      forma_lancamento: 'um_lancamento',
      ativo: true,
    })
    setCondicaoDialog(true)
  }

  const abrirEditarCondicao = (c: CondicaoPagamento) => {
    setCondicaoEditando(c)
    setFormCondicao({
      nome: c.nome,
      tipo: c.tipo,
      maquina: c.maquina || '',
      permite_parcelamento: c.permite_parcelamento ?? false,
      max_parcelas: c.max_parcelas ?? 1,
      forma_lancamento: c.forma_lancamento,
      ativo: c.ativo ?? true,
    })
    setCondicaoDialog(true)
  }

  const salvarCondicao = async () => {
    if (!formCondicao.nome.trim()) {
      toast({ title: 'De um nome a condicao', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const dados = {
        nome: formCondicao.nome.trim(),
        tipo: formCondicao.tipo,
        maquina: formCondicao.maquina || undefined,
        permite_parcelamento: formCondicao.permite_parcelamento,
        max_parcelas: Number(formCondicao.max_parcelas) || 1,
        forma_lancamento: formCondicao.forma_lancamento,
        ativo: formCondicao.ativo,
      }
      if (condicaoEditando) {
        await condicoesPagamentoService.update(condicaoEditando.id, dados)
        toast({ title: 'Condicao atualizada' })
      } else {
        await condicoesPagamentoService.create(dados)
        toast({ title: 'Condicao cadastrada' })
      }
      setCondicaoDialog(false)
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const removerCondicao = async (c: CondicaoPagamento) => {
    if (!window.confirm(`Remover a condicao ${c.nome}?`)) return
    try {
      await condicoesPagamentoService.remove(c.id, c.nome)
      toast({ title: 'Condicao removida' })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' })
    }
  }

  const ehCartao = formCondicao.tipo === 'cartao_credito' || formCondicao.tipo === 'cartao_debito'

  return (
    <div className="space-y-4">
      {/* Maquinas */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-marca-vermelho" />
              Maquinas de cartao
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              O prazo de repasse e quantos dias o dinheiro leva para cair. 0 = mesmo dia.
            </p>
          </div>
          <Button
            size="sm"
            onClick={abrirNovaMaquina}
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova maquina
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <p className="text-xs text-slate-500">Carregando...</p>
          ) : maquinas.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhuma maquina cadastrada. Sem maquina, o cartao cai no dia da venda.
            </p>
          ) : (
            maquinas.map((m) => (
              <div
                key={m.id}
                className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{m.nome}</span>
                    {!m.ativo && (
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        inativa
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-600">
                    <span>Debito: D+{m.dias_debito ?? 0}</span>
                    <span>Credito: D+{m.dias_credito_vista ?? 0}</span>
                    <span>Parcelado: D+{m.dias_credito_parcelado ?? 0}</span>
                    <span>PIX: D+{m.dias_pix ?? 0}</span>
                    <span>Taxa debito: {m.taxa_debito ?? 0}%</span>
                    <span>Taxa credito: {m.taxa_credito_vista ?? 0}%</span>
                    <span>Taxa parcelado: {m.taxa_credito_parcelado ?? 0}%</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => abrirEditarMaquina(m)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removerMaquina(m)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Condicoes */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-4 h-4 text-marca-vermelho" />
              Condicoes de pagamento
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Como o paciente paga. A forma de lancamento diz como isso vira conta a receber.
            </p>
          </div>
          <Button
            size="sm"
            onClick={abrirNovaCondicao}
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova condicao
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {condicoes.map((c) => (
            <div
              key={c.id}
              className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{c.nome}</span>
                  <Badge variant="outline" className="text-[10px] text-slate-600">
                    {TIPOS_CONDICAO.find((t) => t.valor === c.tipo)?.label || c.tipo}
                  </Badge>
                  {c.permite_parcelamento && (
                    <Badge variant="outline" className="text-[10px] text-sky-700 border-sky-200">
                      parcelado{c.max_parcelas ? ` ate ${c.max_parcelas}x` : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {FORMAS.find((f) => f.valor === c.forma_lancamento)?.label}
                  {c.expand?.maquina?.nome ? ` - ${c.expand.maquina.nome}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => abrirEditarCondicao(c)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => removerCondicao(c)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dialog maquina */}
      <Dialog open={maquinaDialog} onOpenChange={setMaquinaDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{maquinaEditando ? 'Editar maquina' : 'Nova maquina'}</DialogTitle>
            <DialogDescription className="text-xs">
              Os prazos e taxas saem do seu contrato com a adquirente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={formMaquina.nome}
                onChange={(e) => setFormMaquina({ ...formMaquina, nome: e.target.value })}
                placeholder="Ex.: Stone"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Debito - dias para cair</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMaquina.dias_debito}
                  onChange={(e) =>
                    setFormMaquina({ ...formMaquina, dias_debito: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Debito - taxa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMaquina.taxa_debito}
                  onChange={(e) =>
                    setFormMaquina({ ...formMaquina, taxa_debito: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Credito a vista - dias</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMaquina.dias_credito_vista}
                  onChange={(e) =>
                    setFormMaquina({ ...formMaquina, dias_credito_vista: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Credito a vista - taxa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMaquina.taxa_credito_vista}
                  onChange={(e) =>
                    setFormMaquina({ ...formMaquina, taxa_credito_vista: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Credito parcelado - dias</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMaquina.dias_credito_parcelado}
                  onChange={(e) =>
                    setFormMaquina({
                      ...formMaquina,
                      dias_credito_parcelado: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Credito parcelado - taxa (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMaquina.taxa_credito_parcelado}
                  onChange={(e) =>
                    setFormMaquina({
                      ...formMaquina,
                      taxa_credito_parcelado: Number(e.target.value),
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observacoes</Label>
              <Textarea
                rows={2}
                value={formMaquina.observacoes}
                onChange={(e) => setFormMaquina({ ...formMaquina, observacoes: e.target.value })}
                placeholder="Ex.: contrato com antecipacao"
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formMaquina.ativo}
                onCheckedChange={(v) => setFormMaquina({ ...formMaquina, ativo: v })}
              />
              <Label className="text-xs">Ativa (aparece para escolher)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaquinaDialog(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={salvarMaquina}
              disabled={salvando}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog condicao */}
      <Dialog open={condicaoDialog} onOpenChange={setCondicaoDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{condicaoEditando ? 'Editar condicao' : 'Nova condicao'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={formCondicao.nome}
                onChange={(e) => setFormCondicao({ ...formCondicao, nome: e.target.value })}
                placeholder="Ex.: Cartao de credito"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {TIPOS_CONDICAO.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setFormCondicao({ ...formCondicao, tipo: t.valor })}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-left ${
                      formCondicao.tipo === t.valor
                        ? 'border-marca-vermelho bg-marca-vermelho-claro text-marca-vermelho-escuro'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {ehCartao && (
              <div>
                <Label className="text-xs">Maquina usada</Label>
                <select
                  value={formCondicao.maquina}
                  onChange={(e) => setFormCondicao({ ...formCondicao, maquina: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">Nenhuma (cai no dia)</option>
                  {maquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  E a maquina que define a data do repasse e a taxa descontada.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={formCondicao.permite_parcelamento}
                onCheckedChange={(v) =>
                  setFormCondicao({ ...formCondicao, permite_parcelamento: v })
                }
              />
              <Label className="text-xs">Permite parcelamento</Label>
            </div>

            {formCondicao.permite_parcelamento && (
              <div>
                <Label className="text-xs">Maximo de parcelas (0 = sem limite)</Label>
                <Input
                  type="number"
                  min="0"
                  max="48"
                  value={formCondicao.max_parcelas}
                  onChange={(e) =>
                    setFormCondicao({ ...formCondicao, max_parcelas: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label className="text-xs">Como vira conta a receber</Label>
              <div className="space-y-1.5 mt-1">
                {FORMAS.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => setFormCondicao({ ...formCondicao, forma_lancamento: f.valor })}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border ${
                      formCondicao.forma_lancamento === f.valor
                        ? 'border-marca-vermelho bg-marca-vermelho-claro'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="block text-[11px] font-semibold text-slate-700">
                      {f.label}
                    </span>
                    <span className="block text-[10px] text-slate-500">{f.dica}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCondicaoDialog(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={salvarCondicao}
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
