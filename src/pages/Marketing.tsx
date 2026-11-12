import React, { useEffect, useMemo, useState } from 'react'
import {
  pacientesService,
  consultasService,
  orcamentosService,
  campanhasService,
  conteudosService,
} from '@/services/clinica'
import { Paciente, Consulta, Orcamento, Campanha, Conteudo } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  TrendingUp,
  Users,
  Target,
  Wallet,
  Lightbulb,
  Plus,
  Megaphone,
  Clapperboard,
  ChevronRight,
  Trophy,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/formatters'
import {
  calcularMetricasMarketing,
  ROTULOS_CANAL,
  ROTULOS_FORMATO,
  ROTULOS_STATUS_CAMPANHA,
  ROTULOS_STATUS_CONTEUDO,
} from '@/lib/marketing'
import { ORIGENS } from '@/lib/pacienteCampos'

/**
 * Área de Marketing & Vendas.
 * Cruza a origem dos pacientes com as consultas e os planejamentos aprovados,
 * mostra o retorno de cada campanha e mantém a pauta combinada com o produtor
 * de conteúdo.
 */
export const MarketingPage: React.FC = () => {
  const { isAdmin, user } = useAuth()
  const { toast } = useToast()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)

  // ----- Campanha: dialog
  const [campanhaAberta, setCampanhaAberta] = useState<boolean>(false)
  const [campanhaEmEdicao, setCampanhaEmEdicao] = useState<Campanha | null>(null)
  const [cNome, setCNome] = useState('')
  const [cCanal, setCCanal] = useState('instagram')
  const [cStatus, setCStatus] = useState('planejada')
  const [cInvest, setCInvest] = useState('')
  const [cInicio, setCInicio] = useState('')
  const [cFim, setCFim] = useState('')
  const [cObjetivo, setCObjetivo] = useState('')
  const [cPublico, setCPublico] = useState('')
  const [cUtm, setCUtm] = useState('')

  // ----- Conteúdo: dialog
  const [conteudoAberto, setConteudoAberto] = useState<boolean>(false)
  const [conteudoEmEdicao, setConteudoEmEdicao] = useState<Conteudo | null>(null)
  const [tTitulo, setTTitulo] = useState('')
  const [tFormato, setTFormato] = useState('reels')
  const [tCanal, setTCanal] = useState('instagram')
  const [tStatus, setTStatus] = useState('ideia')
  const [tTema, setTTema] = useState('')
  const [tPublico, setTPublico] = useState('')
  const [tData, setTData] = useState('')
  const [tCampanha, setTCampanha] = useState('')
  const [tObs, setTObs] = useState('')

  const [salvando, setSalvando] = useState<boolean>(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [pacs, cons, orcs, camps, conts] = await Promise.all([
        pacientesService.getAll(),
        consultasService.getAll(),
        orcamentosService.getAll(),
        campanhasService.getAll(),
        conteudosService.getAll(),
      ])
      setPacientes(pacs)
      setConsultas(cons)
      setOrcamentos(orcs)
      setCampanhas(camps)
      setConteudos(conts)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar marketing',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const metricas = useMemo(
    () => calcularMetricasMarketing(pacientes, consultas, orcamentos, campanhas, conteudos),
    [pacientes, consultas, orcamentos, campanhas, conteudos],
  )

  const maiorMes = Math.max(1, ...metricas.novosPorMes.map((m) => m.total))

  // ---------- Campanha: abrir/salvar ----------
  const abrirCampanha = (camp?: Campanha) => {
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Apenas o administrador pode gerenciar campanhas.',
        variant: 'destructive',
      })
      return
    }
    if (camp) {
      setCampanhaEmEdicao(camp)
      setCNome(camp.nome)
      setCCanal(camp.canal)
      setCStatus(camp.status)
      setCInvest(camp.investimento ? String(camp.investimento) : '')
      setCInicio((camp.inicio || '').split('T')[0].split(' ')[0])
      setCFim((camp.fim || '').split('T')[0].split(' ')[0])
      setCObjetivo(camp.objetivo || '')
      setCPublico(camp.publico || '')
      setCUtm(camp.utm || '')
    } else {
      setCampanhaEmEdicao(null)
      setCNome('')
      setCCanal('instagram')
      setCStatus('planejada')
      setCInvest('')
      setCInicio('')
      setCFim('')
      setCObjetivo('')
      setCPublico('')
      setCUtm('')
    }
    setCampanhaAberta(true)
  }

  const salvarCampanha = async () => {
    if (!cNome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const dados = {
        nome: cNome.trim(),
        canal: cCanal,
        status: cStatus,
        investimento: cInvest ? Number(cInvest) : 0,
        inicio: cInicio || undefined,
        fim: cFim || undefined,
        objetivo: cObjetivo.trim(),
        publico: cPublico.trim(),
        utm: cUtm.trim(),
        responsavel: user?.id,
      }
      if (campanhaEmEdicao) {
        await campanhasService.update(campanhaEmEdicao.id, dados)
      } else {
        await campanhasService.create(dados)
      }
      setCampanhaAberta(false)
      carregar()
      toast({ title: 'Campanha salva.' })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar campanha',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // ---------- Conteúdo: abrir/salvar ----------
  const abrirConteudo = (cont?: Conteudo) => {
    if (cont) {
      setConteudoEmEdicao(cont)
      setTTitulo(cont.titulo)
      setTFormato(cont.formato)
      setTCanal(cont.canal)
      setTStatus(cont.status)
      setTTema(cont.tema || '')
      setTPublico(cont.publico_alvo || '')
      setTData((cont.data_publicacao || '').split('T')[0].split(' ')[0])
      setTCampanha(cont.campanha || '')
      setTObs(cont.observacoes || '')
    } else {
      setConteudoEmEdicao(null)
      setTTitulo('')
      setTFormato('reels')
      setTCanal('instagram')
      setTStatus('ideia')
      setTTema('')
      setTPublico('')
      setTData('')
      setTCampanha('')
      setTObs('')
    }
    setConteudoAberto(true)
  }

  const salvarConteudo = async () => {
    if (!tTitulo.trim()) {
      toast({ title: 'Título obrigatório', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      const dados = {
        titulo: tTitulo.trim(),
        formato: tFormato,
        canal: tCanal,
        status: tStatus,
        tema: tTema.trim(),
        publico_alvo: tPublico.trim(),
        data_publicacao: tData || undefined,
        campanha: tCampanha || undefined,
        observacoes: tObs.trim(),
        responsavel: user?.id,
      }
      if (conteudoEmEdicao) {
        await conteudosService.update(conteudoEmEdicao.id, dados)
      } else {
        await conteudosService.create(dados)
      }
      setConteudoAberto(false)
      carregar()
      toast({ title: 'Conteúdo salvo.' })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar conteúdo',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const avancarConteudo = async (cont: Conteudo) => {
    const ordem = ['ideia', 'roteiro', 'gravacao', 'edicao', 'aprovacao', 'agendado', 'publicado']
    const idx = ordem.indexOf(cont.status)
    if (idx < 0 || idx >= ordem.length - 1) return
    try {
      await conteudosService.update(cont.id, { status: ordem[idx + 1] })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao avançar', description: err?.message, variant: 'destructive' })
    }
  }

  if (carregando) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Carregando métricas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-marca-vermelho" />
            Marketing & Vendas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            De onde vêm os pacientes, quanto custa captar e o que está sendo produzido
          </p>
        </div>
      </div>

      {/* Cards de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[11px] text-slate-500 font-medium">Pacientes cadastrados</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{metricas.totalPacientes}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {metricas.pacientesComOrigem} com origem informada
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[11px] text-slate-500 font-medium">Investimento em campanhas</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatCurrency(metricas.investimentoTotal)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {metricas.campanhas.length} campanha{metricas.campanhas.length === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[11px] text-slate-500 font-medium">Receita atribuída</p>
            <h3 className="text-2xl font-bold text-emerald-700 mt-0.5">
              {formatCurrency(metricas.receitaAtribuida)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {metricas.pacientesAtribuidos} pacientes vindos de campanha
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-[11px] text-slate-500 font-medium">Custo por paciente</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {metricas.custoMedioPorPaciente !== null
                ? formatCurrency(metricas.custoMedioPorPaciente)
                : '—'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              investimento ÷ pacientes de campanha
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1 flex w-full flex-wrap h-auto justify-start gap-y-1">
          <TabsTrigger value="visao" className="text-xs sm:text-sm">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="origens" className="text-xs sm:text-sm">
            Origens
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="text-xs sm:text-sm">
            Campanhas ({campanhas.length})
          </TabsTrigger>
          <TabsTrigger value="conteudos" className="text-xs sm:text-sm">
            Conteúdo ({conteudos.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= VISÃO GERAL ================= */}
        <TabsContent value="visao" className="space-y-4 pt-2">
          {/* Funil */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-marca-vermelho" />
                Funil de conversão
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {metricas.funil.map((f, i) => (
                <div key={f.etapa}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{f.etapa}</span>
                    <span className="text-slate-500">
                      {f.total} <span className="text-slate-400">({f.percentual}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(f.percentual, 1)}%`,
                        backgroundColor: ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981'][i],
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Novos pacientes por mês */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-marca-vermelho" />
                Novos pacientes por mês
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {metricas.novosPorMes.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Sem dados ainda.</p>
              ) : (
                <div className="flex items-end justify-between gap-1.5 h-32">
                  {metricas.novosPorMes.map((m) => (
                    <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-600">{m.total}</span>
                      <div
                        className="w-full rounded-t bg-marca-vermelho/80 hover:bg-marca-vermelho transition-colors"
                        style={{ height: `${Math.max((m.total / maiorMes) * 100, 4)}%` }}
                        title={`${m.rotulo}: ${m.total} paciente(s)`}
                      />
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">
                        {m.rotulo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insight */}
          <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                O que os números estão dizendo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {metricas.insights.length === 0 ? (
                <p className="text-xs text-amber-800">
                  Registre a origem dos pacientes e crie campanhas para ver análises aqui.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {metricas.insights.map((t, i) => (
                    <li key={i} className="text-xs text-amber-900 flex gap-2">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ORIGENS ================= */}
        <TabsContent value="origens" className="pt-2">
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800">
                De onde vêm os pacientes
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Preenchido no cadastro de cada paciente, campo "Origem".
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {metricas.origens.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Nenhum paciente cadastrado ainda.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {metricas.origens.map((o) => (
                    <div key={o.origem} className="p-3.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900">{o.origem}</span>
                          {o.origem === 'Não informado' && (
                            <Badge
                              variant="outline"
                              className="text-[9px] border-amber-300 text-amber-700 bg-amber-50"
                            >
                              preencher
                            </Badge>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full bg-marca-vermelho/70"
                            style={{ width: `${Math.max(o.percentual, 2)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-900">
                          {o.pacientes}{' '}
                          <span className="font-normal text-slate-400">({o.percentual}%)</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {o.converteram} fecharam
                          {o.receita > 0 && (
                            <>
                              {' • '}
                              <span className="text-emerald-700 font-semibold">
                                {formatCurrency(o.receita)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-[11px] text-slate-400 mt-2 px-1">
            Opções de origem disponíveis no cadastro: {ORIGENS.join(' · ')}
          </p>
        </TabsContent>

        {/* ================= CAMPANHAS ================= */}
        <TabsContent value="campanhas" className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Cada campanha com investimento, pacientes captados e retorno.
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs shrink-0"
                onClick={() => abrirCampanha()}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova campanha
              </Button>
            )}
          </div>

          {campanhas.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-medium text-slate-700 text-sm">Nenhuma campanha cadastrada</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Cadastre cada ação (Instagram, Google, panfleto, indicação) com o valor investido. O
                app cruza com os pacientes que chegaram pela origem e mostra o retorno.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {metricas.campanhas.map((c) => (
                <Card key={c.id} className="border-slate-200 shadow-sm bg-white">
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{c.nome}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-slate-300 text-slate-600"
                          >
                            {ROTULOS_CANAL[c.canal] || c.canal}
                          </Badge>
                          <Badge
                            className={`text-[10px] ${
                              c.status === 'ativa'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {ROTULOS_STATUS_CAMPANHA[c.status] || c.status}
                          </Badge>
                        </div>
                        {c.objetivo && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{c.objetivo}</p>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-slate-500 shrink-0"
                          onClick={() => abrirCampanha(c)}
                        >
                          Editar
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                          Investido
                        </p>
                        <p className="text-xs font-bold text-slate-900">
                          {formatCurrency(Number(c.investimento) || 0)}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                          Pacientes
                        </p>
                        <p className="text-xs font-bold text-slate-900">{c.pacientes}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                          Custo/paciente
                        </p>
                        <p className="text-xs font-bold text-slate-900">
                          {c.custoPorPaciente !== null ? formatCurrency(c.custoPorPaciente) : '—'}
                        </p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2">
                        <p className="text-[9px] text-emerald-700 uppercase tracking-wide">
                          Receita
                        </p>
                        <p className="text-xs font-bold text-emerald-800">
                          {formatCurrency(c.receita)}
                        </p>
                      </div>
                    </div>

                    {c.roi !== null && (
                      <p
                        className={`text-[11px] mt-2 font-medium ${
                          c.roi >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {c.roi >= 0 ? (
                          <>
                            <Trophy className="w-3 h-3 inline mr-1" />
                            Retorno de {Math.round(c.roi)}% sobre o investido
                          </>
                        ) : (
                          <>Ainda não se pagou ({Math.round(c.roi)}%)</>
                        )}
                        {c.aprovados > 0 && ` • ${c.aprovados} tratamento(s) fechado(s)`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================= CONTEÚDO ================= */}
        <TabsContent value="conteudos" className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Pauta combinada com o produtor: da ideia até publicado.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs shrink-0"
              onClick={() => abrirConteudo()}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo conteúdo
            </Button>
          </div>

          {/* Contadores por status */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ROTULOS_STATUS_CONTEUDO).map(([k, v]) => (
              <Badge
                key={k}
                variant="outline"
                className={`text-[10px] ${
                  (metricas.conteudosPorStatus[k] || 0) > 0
                    ? 'border-marca-vermelho/40 text-marca-vermelho bg-marca-vermelho-claro'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {v}: {metricas.conteudosPorStatus[k] || 0}
              </Badge>
            ))}
          </div>

          {conteudos.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
              <Clapperboard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-medium text-slate-700 text-sm">Nenhum conteúdo na pauta</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Cadastre as ideias e o andamento de cada peça. Assim você e o produtor de conteúdo
                falam a mesma língua — e dá para comparar o que foi publicado com os pacientes que
                chegaram.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {conteudos.map((c) => {
                const podeAvancar = c.status !== 'publicado'
                return (
                  <Card key={c.id} className="border-slate-200 shadow-sm bg-white">
                    <CardContent className="p-3 flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {c.titulo}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] border-slate-300 text-slate-500"
                          >
                            {ROTULOS_FORMATO[c.formato] || c.formato}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[9px] border-slate-300 text-slate-500"
                          >
                            {ROTULOS_CANAL[c.canal] || c.canal}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {ROTULOS_STATUS_CONTEUDO[c.status] || c.status}
                          {c.data_publicacao && (
                            <> • {c.data_publicacao.split('T')[0].split(' ')[0]}</>
                          )}
                          {c.expand?.campanha?.nome && <> • {c.expand.campanha.nome}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {podeAvancar && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-slate-500"
                            title="Avançar etapa"
                            onClick={() => avancarConteudo(c)}
                          >
                            Avançar
                            <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[10px] text-slate-500"
                          onClick={() => abrirConteudo(c)}
                        >
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ Dialog Campanha ============ */}
      <Dialog open={campanhaAberta} onOpenChange={setCampanhaAberta}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-marca-vermelho" />
              {campanhaEmEdicao ? 'Editar campanha' : 'Nova campanha'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre o valor investido e o canal. O retorno é calculado com os pacientes que
              chegarem por essa origem.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
            <div>
              <Label className="text-xs">Nome da campanha *</Label>
              <Input
                value={cNome}
                onChange={(e) => setCNome(e.target.value)}
                placeholder="Ex.: Black Friday clareamento"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={cCanal} onValueChange={setCCanal}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_CANAL).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={cStatus} onValueChange={setCStatus}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_STATUS_CAMPANHA).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Investimento (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  value={cInvest}
                  onChange={(e) => setCInvest(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={cInicio}
                  onChange={(e) => setCInicio(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input
                  type="date"
                  value={cFim}
                  onChange={(e) => setCFim(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Objetivo</Label>
              <Input
                value={cObjetivo}
                onChange={(e) => setCObjetivo(e.target.value)}
                placeholder="Ex.: 30 avaliações de clareamento"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <Label className="text-xs">Público</Label>
              <Input
                value={cPublico}
                onChange={(e) => setCPublico(e.target.value)}
                placeholder="Ex.: mulheres 25-40 anos, Americana"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <Label className="text-xs">
                Marca para atribuição <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                value={cUtm}
                onChange={(e) => setCUtm(e.target.value)}
                placeholder="Ex.: blackfriday ou utm_campaign=blackfriday"
                className="mt-1 text-xs sm:text-sm h-9"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                É cruzado com o campo "Origem (complemento)" do paciente. Deixe igual para o app
                contar os pacientes certos.
              </p>
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCampanhaAberta(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvarCampanha}
              disabled={salvando}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Dialog Conteúdo ============ */}
      <Dialog open={conteudoAberto} onOpenChange={setConteudoAberto}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="text-base flex items-center gap-2">
              <Clapperboard className="w-5 h-5 text-marca-vermelho" />
              {conteudoEmEdicao ? 'Editar conteúdo' : 'Novo conteúdo'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pauta compartilhada com o produtor de conteúdo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
            <div>
              <Label className="text-xs">Título / tema da peça *</Label>
              <Input
                value={tTitulo}
                onChange={(e) => setTTitulo(e.target.value)}
                placeholder="Ex.: 3 sinais de que você precisa de canal"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Formato</Label>
                <Select value={tFormato} onValueChange={setTFormato}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_FORMATO).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select value={tCanal} onValueChange={setTCanal}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_CANAL).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Etapa</Label>
                <Select value={tStatus} onValueChange={setTStatus}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULOS_STATUS_CONTEUDO).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Publicação</Label>
                <Input
                  type="date"
                  value={tData}
                  onChange={(e) => setTData(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Tema</Label>
              <Input
                value={tTema}
                onChange={(e) => setTTema(e.target.value)}
                placeholder="Ex.: endodontia sem dor"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <Label className="text-xs">Público-alvo</Label>
              <Input
                value={tPublico}
                onChange={(e) => setTPublico(e.target.value)}
                placeholder="Ex.: quem tem medo de dentista"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <Label className="text-xs">Campanha vinculada</Label>
              <Select value={tCampanha} onValueChange={setTCampanha}>
                <SelectTrigger className="mt-1 text-xs h-9">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {campanhas.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Observações / briefing</Label>
              <Textarea
                rows={3}
                value={tObs}
                onChange={(e) => setTObs(e.target.value)}
                placeholder="Ex.: gravar na cadeira, mostrar antes e depois, tom leve"
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConteudoAberto(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvarConteudo}
              disabled={salvando}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
