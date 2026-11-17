import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import {
  ShieldCheck,
  Plus,
  Printer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  Package,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDateBr } from '@/lib/formatters'
import {
  esterilizacaoService,
  Esterilizacao,
  PacoteEsterilizado,
  MonitoramentoEsterilizacao,
  ROTULO_TIPO_MONITORAMENTO,
  ROTULO_STATUS_PACOTE,
  TipoMonitoramento,
} from '@/services/esterilizacao'
import { gerarEtiquetas } from '@/lib/etiquetaEsterilizacao'
import { CampoComIA } from '@/components/voz/CampoComIA'
import { BuscaComLista } from '@/components/busca/BuscaComLista'
import { pacientesService } from '@/services/clinica'
import { Paciente } from '@/types'

/**
 * Esterilização — módulo de conformidade da RDC Anvisa 1002/2025.
 *
 * Duas abas: as cargas de autoclave do dia a dia (com etiqueta e vínculo de
 * paciente) e o monitoramento periódico (indicador biológico e integrador,
 * de semana em semana).
 *
 * A norma não exige software, mas o registro em papel falha justamente no
 * ponto que a fiscalização cobra: achar o lote de uma data antiga.
 */

type Aba = 'cargas' | 'monitoramento' | 'busca'

export const EsterilizacaoPage: React.FC = () => {
  const { toast } = useToast()

  /** Aviso de erro padronizado da página (título + detalhe). */
  const onError = (titulo: string, mensagem?: string) =>
    toast({ title: titulo, description: mensagem, variant: 'destructive' })
  const [aba, setAba] = useState<Aba>('cargas')

  const [cargas, setCargas] = useState<Esterilizacao[]>([])
  const [carregando, setCarregando] = useState(true)
  /** Lista de pacientes para o vínculo de rastreabilidade */
  const [pacientes, setPacientes] = useState<Paciente[]>([])

  // ---------- nova carga ----------
  const [novaAberta, setNovaAberta] = useState(false)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [equipamento, setEquipamento] = useState('Autoclave')
  const [operador, setOperador] = useState('')
  const [tempo, setTempo] = useState('')
  const [temperatura, setTemperatura] = useState('134')
  const [pressao, setPressao] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState<'aprovado' | 'reprovado' | 'nao_realizado'>(
    'aprovado',
  )
  const [tipoTeste, setTipoTeste] = useState<
    'biologico' | 'integrador_5' | 'integrador_6' | 'bowie_dick' | 'nenhum'
  >('integrador_5')
  const [validadeDias, setValidadeDias] = useState('30')
  const [observacoes, setObservacoes] = useState('')
  const [pacotesTexto, setPacotesTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  // ---------- detalhe da carga ----------
  const [cargaAberta, setCargaAberta] = useState<Esterilizacao | null>(null)
  const [pacotesDaCarga, setPacotesDaCarga] = useState<PacoteEsterilizado[]>([])

  // ---------- monitoramento ----------
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoEsterilizacao[]>([])
  const [diasBiologico, setDiasBiologico] = useState<number | null>(null)
  const [monitAberto, setMonitAberto] = useState(false)
  const [monitTipo, setMonitTipo] = useState<TipoMonitoramento>('biologico')
  const [monitResultado, setMonitResultado] = useState<'aprovado' | 'reprovado'>('aprovado')
  const [monitData, setMonitData] = useState(new Date().toISOString().slice(0, 10))
  const [monitOperador, setMonitOperador] = useState('')

  // ---------- busca inversa ----------
  const [loteBusca, setLoteBusca] = useState('')
  const [resultadoBusca, setResultadoBusca] = useState<PacoteEsterilizado[] | null>(null)

  // ---------- vínculo com paciente ----------
  const [pacoteVinculo, setPacoteVinculo] = useState<PacoteEsterilizado | null>(null)
  const [pacienteVinculoId, setPacienteVinculoId] = useState('')

  const vincular = async () => {
    if (!pacoteVinculo || !pacienteVinculoId) return
    try {
      await esterilizacaoService.vincularAoPaciente(pacoteVinculo.id, pacienteVinculoId)
      toast({
        title: 'Pacote vinculado',
        description: 'A rastreabilidade agora aponta para o paciente.',
      })
      setPacoteVinculo(null)
      setPacienteVinculoId('')
      if (cargaAberta) abrirCarga(cargaAberta)
      if (resultadoBusca) buscar()
    } catch (err: any) {
      onError('Não foi possível vincular', err?.message)
    }
  }

  const carregar = async () => {
    setCarregando(true)
    try {
      const [cs, ms, dias, pcs] = await Promise.all([
        esterilizacaoService.getCargas(),
        esterilizacaoService.getMonitoramentos(),
        esterilizacaoService.diasDesdeUltimoBiologico(),
        pacientesService.getAll().catch(() => [] as Paciente[]),
      ])
      setCargas(cs)
      setMonitoramentos(ms)
      setDiasBiologico(dias)
      setPacientes(pcs)
      // marca vencidos em segundo plano
      esterilizacaoService.atualizarVencidos().catch(() => {})
    } catch (err: any) {
      onError('Erro ao carregar', err?.message || 'Não foi possível ler os dados de esterilização.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alertaBiologico = useMemo(() => {
    if (diasBiologico === null)
      return { cor: 'amber', texto: 'Nenhum indicador biológico registrado ainda.' }
    if (diasBiologico > 7)
      return {
        cor: 'red',
        texto: `Último indicador biológico há ${diasBiologico} dias. A Anvisa pede monitoramento semanal.`,
      }
    return {
      cor: 'green',
      texto: `Indicador biológico em dia (há ${diasBiologico} dia${diasBiologico === 1 ? '' : 's'}).`,
    }
  }, [diasBiologico])

  const salvarCarga = async () => {
    if (!operador.trim()) {
      onError('Campo obrigatório', 'Informe quem operou a autoclave.')
      return
    }
    const lista = pacotesTexto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lista.length === 0) {
      onError('Sem pacotes', 'Informe pelo menos um pacote (um por linha).')
      return
    }

    setSalvando(true)
    try {
      await esterilizacaoService.criarCarga(
        {
          data,
          equipamento: equipamento.trim(),
          operador: operador.trim(),
          tempo_minutos: tempo ? Number(tempo) : undefined,
          temperatura: temperatura ? Number(temperatura) : undefined,
          pressao: pressao ? Number(pressao) : undefined,
          pacote_teste_resultado: resultadoTeste,
          pacote_teste_tipo: tipoTeste,
          validade_dias: validadeDias ? Number(validadeDias) : 30,
          observacoes: observacoes.trim(),
        },
        lista,
      )
      toast({
        title: 'Carga registrada',
        description: `${lista.length} pacote(s) criados com etiqueta.`,
      })
      setNovaAberta(false)
      setPacotesTexto('')
      setObservacoes('')
      carregar()
    } catch (err: any) {
      onError('Não foi possível salvar', err?.message || 'Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const abrirCarga = async (c: Esterilizacao) => {
    setCargaAberta(c)
    try {
      setPacotesDaCarga(await esterilizacaoService.getPacotesDaCarga(c.id))
    } catch {
      setPacotesDaCarga([])
    }
  }

  const imprimir = async (c: Esterilizacao) => {
    try {
      const pacotes = await esterilizacaoService.getPacotesDaCarga(c.id)
      await gerarEtiquetas(c, pacotes, { colunas: 1 })
    } catch (err: any) {
      onError('Erro ao gerar etiqueta', err?.message || 'Tente novamente.')
    }
  }

  const buscar = async () => {
    try {
      setResultadoBusca(await esterilizacaoService.buscarPorLote(loteBusca))
    } catch (err: any) {
      onError('Erro na busca', err?.message)
    }
  }

  const salvarMonitoramento = async () => {
    try {
      await esterilizacaoService.criarMonitoramento({
        data: monitData,
        tipo: monitTipo,
        resultado: monitResultado,
        operador: monitOperador.trim(),
      })
      toast({ title: 'Monitoramento registrado' })
      setMonitAberto(false)
      carregar()
    } catch (err: any) {
      onError('Não foi possível salvar', err?.message)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-marca-vermelho" />
          Esterilização e Rastreabilidade
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Registro de cargas da autoclave conforme a RDC Anvisa 1002/2025. Guarda de 5 anos.
        </p>
      </div>

      {/* alerta do indicador biológico */}
      <Alert
        className={
          alertaBiologico.cor === 'red'
            ? 'bg-red-50 border-red-300'
            : alertaBiologico.cor === 'amber'
              ? 'bg-amber-50 border-amber-300'
              : 'bg-emerald-50 border-emerald-300'
        }
      >
        {alertaBiologico.cor === 'green' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        ) : (
          <AlertTriangle
            className={`h-4 w-4 ${alertaBiologico.cor === 'red' ? 'text-red-700' : 'text-amber-700'}`}
          />
        )}
        <AlertDescription
          className={`text-xs ${
            alertaBiologico.cor === 'red'
              ? 'text-red-900'
              : alertaBiologico.cor === 'amber'
                ? 'text-amber-900'
                : 'text-emerald-900'
          }`}
        >
          {alertaBiologico.texto}
        </AlertDescription>
      </Alert>

      {/* abas */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
        {(
          [
            ['cargas', 'Cargas'],
            ['monitoramento', 'Monitoramento'],
            ['busca', 'Buscar por lote'],
          ] as [Aba, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              aba === id ? 'bg-marca-vermelho text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* ================= CARGAS ================= */}
      {aba === 'cargas' && (
        <>
          <Button
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-9"
            onClick={() => setNovaAberta(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova Carga de Esterilização
          </Button>

          {carregando ? (
            <p className="text-xs text-slate-500 p-6 text-center">Carregando...</p>
          ) : cargas.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none bg-white">
              <CardContent className="p-8 text-center">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Nenhuma carga registrada</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Registre o primeiro ciclo da autoclave. O sistema gera o lote, as etiquetas e a
                  validade de cada pacote.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {cargas.map((c) => (
                <Card key={c.id} className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{c.lote}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {formatDateBr(c.data)}
                          </Badge>
                          {c.pacote_teste_resultado === 'aprovado' && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              teste aprovado
                            </Badge>
                          )}
                          {c.pacote_teste_resultado === 'reprovado' && (
                            <Badge className="text-[10px] bg-red-100 text-red-800 hover:bg-red-100">
                              teste REPROVADO
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {c.operador}
                          {c.equipamento ? ` · ${c.equipamento}` : ''}
                          {c.temperatura ? ` · ${c.temperatura}°C` : ''}
                          {c.tempo_minutos ? ` · ${c.tempo_minutos} min` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => abrirCarga(c)}
                        >
                          Ver pacotes
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-marca-vermelho"
                          title="Imprimir etiquetas"
                          onClick={() => imprimir(c)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================= MONITORAMENTO ================= */}
      {aba === 'monitoramento' && (
        <>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500 max-w-lg">
              Em autoclave até 60 L sem bomba de vácuo a Anvisa pede monitoramento{' '}
              <strong>semanal</strong>: indicador biológico + integrador tipo 5/6 no primeiro ciclo,
              e integrador tipo 5/6 nas cargas seguintes. A fita zebrada (tipo 1) não monitora
              esterilização.
            </p>
            <Button
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-9 shrink-0"
              onClick={() => setMonitAberto(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Registrar Monitoramento
            </Button>
          </div>

          {monitoramentos.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none bg-white">
              <CardContent className="p-8 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  Nenhum monitoramento registrado
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Registre o indicador biológico da semana para manter a conformidade.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {monitoramentos.map((m) => (
                <Card key={m.id} className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900">
                          {ROTULO_TIPO_MONITORAMENTO[m.tipo] || m.tipo}
                        </span>
                        {m.resultado === 'aprovado' ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                            aprovado
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-red-100 text-red-800 hover:bg-red-100">
                            <XCircle className="w-2.5 h-2.5 mr-0.5" />
                            reprovado
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDateBr(m.data)}
                        {m.operador ? ` · ${m.operador}` : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================= BUSCA POR LOTE ================= */}
      {aba === 'busca' && (
        <>
          <p className="text-xs text-slate-500 max-w-lg">
            Digite o lote para saber quais pacientes receberam aquele material. É a pergunta que a
            fiscalização faz — e a que resolve um recall.
          </p>
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={loteBusca}
                onChange={(e) => setLoteBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="Ex.: 20261117-01"
                className="pl-8 text-xs sm:text-sm h-9"
              />
            </div>
            <Button
              size="sm"
              className="h-9 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              onClick={buscar}
            >
              Buscar
            </Button>
          </div>

          {resultadoBusca !== null && (
            <div className="space-y-2">
              {resultadoBusca.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 bg-white rounded-lg border border-slate-200">
                  Nenhum pacote encontrado com esse lote.
                </p>
              ) : (
                resultadoBusca.map((p) => (
                  <Card key={p.id} className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900">{p.identificacao}</p>
                          <p className="text-[11px] text-slate-500">
                            Lote {p.expand?.esterilizacao?.lote} ·{' '}
                            {formatDateBr(p.data_esterilizacao)}
                          </p>
                          {p.expand?.paciente?.nome && (
                            <p className="text-[11px] text-marca-vermelho font-medium mt-0.5">
                              Paciente: {p.expand.paciente.nome}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {ROTULO_STATUS_PACOTE[p.status || 'disponivel']}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ---------- diálogo vínculo com paciente ---------- */}
      <Dialog open={Boolean(pacoteVinculo)} onOpenChange={(o) => !o && setPacoteVinculo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular pacote ao paciente</DialogTitle>
            <DialogDescription className="text-xs">
              {pacoteVinculo?.identificacao} — a rastreabilidade passa a apontar para quem foi
              atendido com este material.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <BuscaComLista
              itens={pacientes.map((p) => ({
                id: p.id,
                nome: p.nome,
                detalhe: p.telefone,
                original: p,
              }))}
              placeholder="Buscar paciente por nome ou telefone..."
              vazioTexto="Nenhum paciente encontrado."
              onSelecionar={(it) => setPacienteVinculoId(it.id)}
              alturaMaxima={220}
            />
            {pacienteVinculoId && (
              <p className="text-xs text-emerald-700 font-medium">
                Selecionado: {pacientes.find((p) => p.id === pacienteVinculoId)?.nome}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPacoteVinculo(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              disabled={!pacienteVinculoId}
              onClick={vincular}
            >
              Vincular ao paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- diálogo nova carga ---------- */}
      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Carga de Esterilização</DialogTitle>
            <DialogDescription className="text-xs">
              O lote é gerado automaticamente. Estes dados são os que o art. 91 da RDC exige.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data da esterilização *</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Equipamento</Label>
                <Input
                  value={equipamento}
                  onChange={(e) => setEquipamento(e.target.value)}
                  placeholder="Autoclave"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Responsável pelo preparo *</Label>
              <Input
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
                placeholder="Quem montou e operou a autoclave"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Tempo (min)</Label>
                <Input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                  placeholder="30"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Temp. (°C)</Label>
                <Input
                  type="number"
                  value={temperatura}
                  onChange={(e) => setTemperatura(e.target.value)}
                  placeholder="134"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Pressão</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={pressao}
                  onChange={(e) => setPressao(e.target.value)}
                  placeholder="2.1"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Pacote teste — tipo</Label>
                <Select value={tipoTeste} onValueChange={(v) => setTipoTeste(v as any)}>
                  <SelectTrigger className="mt-1 text-xs sm:text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integrador_5" className="text-xs">
                      Integrador tipo 5
                    </SelectItem>
                    <SelectItem value="integrador_6" className="text-xs">
                      Integrador tipo 6
                    </SelectItem>
                    <SelectItem value="biologico" className="text-xs">
                      Indicador biológico
                    </SelectItem>
                    <SelectItem value="bowie_dick" className="text-xs">
                      Bowie-Dick
                    </SelectItem>
                    <SelectItem value="nenhum" className="text-xs">
                      Nenhum nesta carga
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Pacote teste — resultado</Label>
                <Select value={resultadoTeste} onValueChange={(v) => setResultadoTeste(v as any)}>
                  <SelectTrigger className="mt-1 text-xs sm:text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado" className="text-xs">
                      Aprovado
                    </SelectItem>
                    <SelectItem value="reprovado" className="text-xs">
                      Reprovado
                    </SelectItem>
                    <SelectItem value="nao_realizado" className="text-xs">
                      Não realizado
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Validade do pacote (dias)</Label>
                <Input
                  type="number"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(e.target.value)}
                  placeholder="30"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Pacotes (um por linha) *</Label>
              <textarea
                value={pacotesTexto}
                onChange={(e) => setPacotesTexto(e.target.value)}
                rows={5}
                placeholder={'Kit cirúrgico 01\nKit restauração 02\nKit endodontia 03'}
                className="w-full mt-1 rounded-md border border-slate-300 p-2 text-xs sm:text-sm"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Cada linha vira uma etiqueta. É a identificação que vai no pacote (art. 81, IV).
              </p>
            </div>

            <CampoComIA
              label="Observações"
              contexto="observações de uma carga de esterilização em autoclave odontológica"
              rows={2}
              value={observacoes}
              onChange={setObservacoes}
              placeholder="Ex.: ciclo reduzido por pouco material."
              onErro={(t, d) => onError(t, d)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNovaAberta(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={salvarCarga}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Registrar carga'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- diálogo pacotes da carga ---------- */}
      <Dialog open={Boolean(cargaAberta)} onOpenChange={(o) => !o && setCargaAberta(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pacotes do lote {cargaAberta?.lote}</DialogTitle>
            <DialogDescription className="text-xs">
              {formatDateBr(cargaAberta?.data || '')} · {pacotesDaCarga.length} pacote(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {pacotesDaCarga.length === 0 ? (
              <p className="text-xs text-slate-500 p-4">Nenhum pacote nesta carga.</p>
            ) : (
              pacotesDaCarga.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900">{p.identificacao}</p>
                    <p className="text-[10px] text-slate-500">
                      Validade: {p.validade ? formatDateBr(p.validade) : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {ROTULO_STATUS_PACOTE[p.status || 'disponivel']}
                    </Badge>
                    {p.status !== 'usado' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-marca-vermelho"
                        onClick={() => {
                          setPacoteVinculo(p)
                          setPacienteVinculoId('')
                        }}
                      >
                        Vincular
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={() => cargaAberta && imprimir(cargaAberta)}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Imprimir etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- diálogo monitoramento ---------- */}
      <Dialog open={monitAberto} onOpenChange={setMonitAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Monitoramento</DialogTitle>
            <DialogDescription className="text-xs">
              Anvisa pede monitoramento semanal, independente do volume de ciclos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={monitTipo} onValueChange={(v) => setMonitTipo(v as TipoMonitoramento)}>
                <SelectTrigger className="mt-1 text-xs sm:text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="biologico" className="text-xs">
                    Indicador biológico
                  </SelectItem>
                  <SelectItem value="integrador_5" className="text-xs">
                    Integrador tipo 5
                  </SelectItem>
                  <SelectItem value="integrador_6" className="text-xs">
                    Integrador tipo 6
                  </SelectItem>
                  <SelectItem value="bowie_dick" className="text-xs">
                    Bowie-Dick
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Resultado *</Label>
              <Select value={monitResultado} onValueChange={(v) => setMonitResultado(v as any)}>
                <SelectTrigger className="mt-1 text-xs sm:text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado" className="text-xs">
                    Aprovado
                  </SelectItem>
                  <SelectItem value="reprovado" className="text-xs">
                    Reprovado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={monitData}
                onChange={(e) => setMonitData(e.target.value)}
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input
                value={monitOperador}
                onChange={(e) => setMonitOperador(e.target.value)}
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMonitAberto(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={salvarMonitoramento}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
