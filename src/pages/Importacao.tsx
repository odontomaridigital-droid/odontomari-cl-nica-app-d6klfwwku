import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Paciente } from '@/types'
import {
  DESTINOS,
  DestinoColecao,
  ColecaoDestino,
  PALAVRAS_ABA_PACIENTES,
} from '@/lib/importacao/destinos'
import { PlanilhaArquivo, PlanilhaAba, lerPlanilha } from '@/lib/importacao/lerPlanilha'
import { converterConsultas } from '@/lib/importacao/consultas'
import { MOLDE_CONSULTAS_DENTISTA_ORGANIZADO } from '@/lib/importacao/destinos'
import {
  reconheceAbaItens,
  agruparItensPorOrcamento,
  converterOrcamentosComItens,
} from '@/lib/importacao/itensOrcamento'
import {
  ColunaMapeada,
  LinhaConvertida,
  converterLinha,
  sugerirMapeamento,
} from '@/lib/importacao/mapeamento'
import {
  carregarPacientesExistentes,
  gravarPacientes,
  gravarRegistrosVinculados,
  ResumoImportacao,
} from '@/lib/importacao/gravacao'
import { formatPhone, formatDateBr } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Database,
  Loader2,
} from 'lucide-react'

type Passo = 1 | 2 | 3 | 4 | 5

/** Marca a aba que parece conter os pacientes (nomes conhecidos do Dentista Organizado). */
function pontuarAba(aba: PlanilhaAba, destino: ColecaoDestino): number {
  const nomeNorm = aba.nome.toLowerCase()
  let pontos = 0
  if (destino === 'pacientes') {
    if (PALAVRAS_ABA_PACIENTES.some((p) => nomeNorm.includes(p))) pontos += 5
  }
  // Colunas que batem com os campos de destino também pontuam
  const nomesColunas = new Set(aba.colunas.map((c) => c.toLowerCase()))
  for (const campo of DESTINOS[destino].campos) {
    if (nomesColunas.has(campo.campo) || nomesColunas.has(campo.rotulo.toLowerCase())) pontos++
  }
  return pontos
}

/** Um problema de uma linha formatado para exibição na prévia. */
function rotuloProblema(p: { coluna: string; mensagem: string }): string {
  return `${p.coluna}: ${p.mensagem}`
}

/** Rótulo amigável de um campo de destino, para a prévia. */
function rotuloCampo(campo: string, destino: ColecaoDestino): string {
  return DESTINOS[destino].campos.find((c) => c.campo === campo)?.rotulo ?? campo
}

/** Valor pronto para exibição na prévia (datas e números formatados). */
function formatarValor(campo: string, valor: unknown): string {
  if (typeof valor === 'number') return String(valor)
  const s = String(valor ?? '')
  if (campo === 'telefone') return formatPhone(s)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return formatDateBr(s.slice(0, 10))
  return s
}

export const ImportacaoPage: React.FC = () => {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [passo, setPasso] = useState<Passo>(1)
  const [arquivo, setArquivo] = useState<PlanilhaArquivo | null>(null)
  const [carregandoArquivo, setCarregandoArquivo] = useState(false)
  const [abaIndex, setAbaIndex] = useState<number>(-1)
  const [destino, setDestino] = useState<ColecaoDestino>('pacientes')
  const [mapeamento, setMapeamento] = useState<ColunaMapeada[]>([])
  const [existentes, setExistentes] = useState<Paciente[]>([])
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 })
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [confirmarOpen, setConfirmarOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const abaAtual = arquivo && abaIndex >= 0 ? arquivo.abas[abaIndex] : null
  const destinoAtual = DESTINOS[destino]

  /**
   * A aba "Consultas" do Dentista Organizado tem a coluna `nome_completo`
   * preenchida com o nome da DENTISTA, e o paciente em `nome`. Por isso ela é
   * lida por posição fixa, com um conversor próprio — o mapeamento genérico
   * jogaria todas as consultas na dentista.
   */
  const ehAbaConsultas = useMemo(
    () => Boolean(abaAtual && MOLDE_CONSULTAS_DENTISTA_ORGANIZADO.reconhece(abaAtual.colunas)),
    [abaAtual],
  )

  const conversaoConsultas = useMemo(() => {
    if (!abaAtual || destino !== 'consultas' || !ehAbaConsultas) return null
    return converterConsultas(abaAtual.linhas)
  }, [abaAtual, destino, ehAbaConsultas])

  /**
   * A aba "Itens do Orcamento" é a única que tem o detalhamento de cada
   * planejamento (procedimento, dente, face e valor). Ela é agrupada por
   * orçamento e vira o campo JSON `itens` do orçamento correspondente.
   */
  const ehAbaItens = useMemo(
    () => Boolean(abaAtual && reconheceAbaItens(abaAtual.colunas)),
    [abaAtual],
  )

  const conversaoItens = useMemo(() => {
    if (!abaAtual || destino !== 'orcamentos' || !ehAbaItens) return null
    const { grupos, descartes } = agruparItensPorOrcamento(abaAtual.linhas)
    return { linhas: converterOrcamentosComItens(grupos), descartes, grupos: grupos.length }
  }, [abaAtual, destino, ehAbaItens])

  const linhasConvertidas: LinhaConvertida[] = useMemo(() => {
    if (!abaAtual) return []
    if (conversaoConsultas) return conversaoConsultas.linhas
    if (conversaoItens) return conversaoItens.linhas
    return abaAtual.linhas.map((linha) =>
      converterLinha(linha, abaAtual.colunas, mapeamento, destinoAtual),
    )
  }, [abaAtual, mapeamento, destinoAtual, conversaoConsultas, conversaoItens])

  const totalProblemas = linhasConvertidas.filter((l) => l.problemas.length > 0).length
  const totalExtras = mapeamento.filter((m) => m.mapeamento.tipo === 'extras').length

  // Proteção: só admin acessa
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/agenda', { replace: true })
    }
  }, [user, isAdmin, navigate])

  const handleArquivoEscolhido = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCarregandoArquivo(true)
    setArquivo(null)
    setAbaIndex(-1)
    setResumo(null)
    setPasso(1)
    try {
      const resultado = await lerPlanilha(file)
      if (resultado.abas.length === 0) {
        throw new Error('O arquivo não tem nenhuma aba legível.')
      }
      setArquivo(resultado)
      setPasso(2)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao ler planilha',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setCarregandoArquivo(false)
    }
  }

  const escolherAba = async (index: number) => {
    setAbaIndex(index)
    const aba = arquivo?.abas[index]
    if (!aba) return
    setMapeamento(sugerirMapeamento(aba.colunas, destinoAtual))
    setPasso(3)
    // Pacientes existentes são carregados quando o destino é pacientes (dedupe)
    if (destino === 'pacientes' && existentes.length === 0) {
      try {
        setExistentes(await carregarPacientesExistentes())
      } catch {
        /* segue sem dedupe; a gravação ainda funciona */
      }
    }
  }

  const trocarDestino = (novo: ColecaoDestino) => {
    setDestino(novo)
    setExistentes([])
    if (abaIndex >= 0) {
      setMapeamento(sugerirMapeamento(arquivo!.abas[abaIndex].colunas, DESTINOS[novo]))
      setPasso(3)
    }
  }

  const atualizarMapeamento = (indice: number, novo: ColunaMapeada['mapeamento']) => {
    setMapeamento((prev) => prev.map((m) => (m.indice === indice ? { ...m, mapeamento: novo } : m)))
  }

  const iniciarGravacao = async () => {
    if (!abaAtual) return
    setConfirmarOpen(false)
    setGravando(true)
    setProgresso({
      feitas: 0,
      total: linhasConvertidas.filter((l) => l.problemas.length === 0).length,
    })
    try {
      let res: ResumoImportacao
      if (destino === 'pacientes') {
        res = await gravarPacientes(linhasConvertidas, existentes, (feitas, total) =>
          setProgresso({ feitas, total }),
        )
      } else {
        res = await gravarRegistrosVinculados(destino, linhasConvertidas, (feitas, total) =>
          setProgresso({ feitas, total }),
        )
      }
      setResumo(res)
      setPasso(5)
    } catch (err: unknown) {
      toast({
        title: 'Erro na gravação',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
    } finally {
      setGravando(false)
    }
  }

  const reiniciar = () => {
    setArquivo(null)
    setAbaIndex(-1)
    setMapeamento([])
    setResumo(null)
    setPasso(1)
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">Área restrita ao administrador.</div>
    )
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-marca-vermelho" />
            Importação de Planilha
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Traga os dados do sistema antigo (arquivos .xlsx) para dentro do app
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] w-fit">
          Somente administrador
        </Badge>
      </div>

      {/* Passos (bola numerada) */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 overflow-x-auto pb-1">
        {['Arquivo', 'Aba', 'Mapeamento', 'Prévia', 'Resultado'].map((titulo, i) => (
          <React.Fragment key={titulo}>
            {i > 0 && <div className="h-px bg-slate-300 w-6 shrink-0" />}
            <div
              className={`flex items-center gap-1 shrink-0 ${passo >= i + 1 ? 'text-marca-vermelho font-semibold' : ''}`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  passo > i + 1
                    ? 'bg-green-100 text-green-700'
                    : passo === i + 1
                      ? 'bg-marca-vermelho text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {passo > i + 1 ? '✓' : i + 1}
              </span>
              {titulo}
            </div>
          </React.Fragment>
        ))}
      </div>

      {gravando && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-marca-vermelho" />
              Gravando {progresso.feitas}/{progresso.total}...
            </div>
            <Progress value={progresso.total ? (progresso.feitas / progresso.total) * 100 : 0} />
          </CardContent>
        </Card>
      )}

      {/* PASSO 1: upload */}
      {passo === 1 && (
        <Card>
          <CardContent className="p-8">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleArquivoEscolhido}
            />
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-marca-vermelho/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-marca-vermelho" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  Escolha o arquivo .xlsx exportado do sistema antigo
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  O arquivo é lido no seu navegador e não é armazenado em lugar nenhum até você
                  confirmar a gravação.
                </p>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={carregandoArquivo}
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              >
                {carregandoArquivo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Lendo arquivo...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Selecionar planilha
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 2: escolha da aba */}
      {passo === 2 && arquivo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-marca-vermelho" />
              Abas encontradas em "{arquivo.nomeArquivo}"
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {arquivo.abas.map((aba, i) => {
              const melhor =
                i ===
                  arquivo.abas.reduce(
                    (b, a, j) =>
                      pontuarAba(a, destino) > pontuarAba(arquivo.abas[b], destino) ? j : b,
                    0,
                  ) && pontuarAba(aba, destino) >= 5
              return (
                <button
                  key={aba.nome}
                  onClick={() => escolherAba(i)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between ${
                    melhor
                      ? 'border-marca-vermelho bg-marca-vermelho/5'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {aba.nome}
                      {melhor && (
                        <Badge className="text-[10px] bg-marca-vermelho text-white">sugerida</Badge>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {aba.totalLinhas} linha(s), {aba.colunas.length} coluna(s)
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* PASSO 3: mapeamento */}
      {passo === 3 && abaAtual && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Mapeamento — aba "{abaAtual.nome}" ({abaAtual.totalLinhas} linhas)
            </CardTitle>
            <Select value={destino} onValueChange={(v) => trocarDestino(v as ColecaoDestino)}>
              <SelectTrigger className="w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DESTINOS).map((d) => (
                  <SelectItem key={d.colecao} value={d.colecao}>
                    {d.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">{destinoAtual.descricao}</p>

            {ehAbaConsultas && destino === 'consultas' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold">Aba de consultas reconhecida</p>
                <p>
                  Nesta aba o nome da dentista está na coluna <code>nome_completo</code> e o
                  paciente na coluna <code>nome</code>. Por isso ela é lida por posição, não pelo
                  mapeamento abaixo — a lista de colunas aqui é só informativa.
                </p>
                <p>
                  A data e a hora vêm juntas ("14/03/2022 - 09:50") e são separadas automaticamente.
                </p>
                {conversaoConsultas && Object.keys(conversaoConsultas.descartes).length > 0 && (
                  <p className="font-medium">
                    Descartadas:{' '}
                    {Object.entries(conversaoConsultas.descartes)
                      .map(([m, n]) => `${n} por ${m}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
            )}

            {ehAbaItens && destino === 'orcamentos' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
                <p className="font-semibold">Aba de itens do orçamento reconhecida</p>
                <p>
                  Cada orçamento vira <strong>um registro completo</strong>, com todos os
                  procedimentos, dentes, faces e valores dentro. Não precisa importar a aba
                  "Orcamentos" — esta já traz tudo.
                </p>
                {conversaoItens && (
                  <p className="font-medium">
                    {conversaoItens.grupos} orçamentos agrupados a partir das {abaAtual.totalLinhas}{' '}
                    linhas de itens.
                  </p>
                )}
                {conversaoItens && Object.keys(conversaoItens.descartes).length > 0 && (
                  <p>
                    Descartadas:{' '}
                    {Object.entries(conversaoItens.descartes)
                      .map(([m, n]) => `${n} por ${m}`)
                      .join(' · ')}
                  </p>
                )}
                <p className="pt-1 border-t border-blue-200">
                  ⚠️ Importe <strong>esta aba</strong> em vez da aba "Orcamentos". Se importar as
                  duas, os orçamentos entram duplicados: um completo e outro sem os itens.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {mapeamento.map((col) => (
                <div
                  key={col.indice}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-slate-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{col.nome}</p>
                    <p className="text-[11px] text-slate-400">
                      Ex.: {abaAtual.linhas[0]?.[col.indice] || '—'}
                    </p>
                  </div>
                  <ArrowRight className="hidden sm:block w-4 h-4 text-slate-300" />
                  <Select
                    value={
                      col.mapeamento.tipo === 'campo' ? col.mapeamento.campo : col.mapeamento.tipo
                    }
                    onValueChange={(v) =>
                      atualizarMapeamento(
                        col.indice,
                        v === 'extras' || v === 'ignorar'
                          ? { tipo: v as 'extras' | 'ignorar' }
                          : { tipo: 'campo', campo: v },
                      )
                    }
                  >
                    <SelectTrigger className="w-full sm:w-64 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {destinoAtual.campos.map((c) => (
                        <SelectItem key={c.campo} value={c.campo}>
                          {c.rotulo}
                          {c.obrigatorio ? ' *' : ''}
                        </SelectItem>
                      ))}
                      <SelectItem value="extras">Guardar em extras</SelectItem>
                      <SelectItem value="ignorar">Ignorar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {totalExtras > 0 && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                {totalExtras} coluna(s) sem campo próprio serão guardadas em "extras" no registro
                (nada é perdido).
              </p>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setPasso(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setPasso(4)}
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              >
                Ver prévia <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 4: prévia */}
      {passo === 4 && abaAtual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prévia das primeiras linhas convertidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              {linhasConvertidas.length} linha(s) no total —{' '}
              <span className="text-green-700 font-medium">
                {linhasConvertidas.length - totalProblemas} prontas
              </span>
              {totalProblemas > 0 && (
                <span className="text-amber-700 font-medium">, {totalProblemas} com problema</span>
              )}
              . Linhas com problema não serão gravadas.
            </p>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {linhasConvertidas.slice(0, 20).map((linha) => (
                <div
                  key={linha.indiceLinha}
                  className={`p-3 rounded-lg border ${
                    linha.problemas.length > 0
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium">
                      {String(linha.campos.nome ?? linha.campos.paciente ?? '(sem nome)')}
                    </p>
                    {linha.problemas.length > 0 ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-amber-200 text-amber-900 shrink-0"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {linha.problemas.length} problema(s)
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-green-100 text-green-800 shrink-0"
                      >
                        ok
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {Object.entries(linha.campos)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .slice(0, 6)
                      .map(([campo, valor]) => (
                        <span key={campo}>
                          <span className="text-slate-400">{rotuloCampo(campo, destino)}:</span>{' '}
                          {formatarValor(campo, valor)}
                        </span>
                      ))}
                    {Object.keys(linha.extras).length > 0 && (
                      <span className="text-slate-400">
                        + {Object.keys(linha.extras).length} campo(s) em extras
                      </span>
                    )}
                  </div>
                  {linha.problemas.length > 0 && (
                    <ul className="mt-1.5 text-[11px] text-amber-800 space-y-0.5">
                      {linha.problemas.map((p, i) => (
                        <li key={i}>• {rotuloProblema(p)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setPasso(3)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setConfirmarOpen(true)}
                disabled={linhasConvertidas.every((l) => l.problemas.length > 0)}
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              >
                Confirmar gravação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 5: resumo */}
      {passo === 5 && resumo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-2xl font-bold text-green-700">{resumo.criados}</p>
                <p className="text-xs text-green-800">Criados</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">{resumo.atualizados}</p>
                <p className="text-xs text-blue-800">Atualizados</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-2xl font-bold text-amber-700">{resumo.pulados}</p>
                <p className="text-xs text-amber-800">Pulados</p>
              </div>
            </div>
            {resumo.motivosPulo.length > 0 && (
              <p className="text-xs text-slate-500">
                {resumo.motivosPulo.slice(0, 10).map((m, i) => (
                  <span key={i} className="block truncate">
                    • {m}
                  </span>
                ))}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={reiniciar}>
                Importar outro arquivo
              </Button>
              {destino === 'pacientes' && (
                <Button variant="secondary" onClick={() => navigate('/pacientes')}>
                  Ver pacientes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmação */}
      <Dialog open={confirmarOpen} onOpenChange={setConfirmarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar gravação?</DialogTitle>
            <DialogDescription>
              Serão gravados {linhasConvertidas.filter((l) => l.problemas.length === 0).length}{' '}
              registro(s) em {destinoAtual.rotulo} (aba "{abaAtual?.nome}"). Linhas com problema
              serão puladas. Esta ação grava no banco real da clínica.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={iniciarGravacao}
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
            >
              Gravar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
