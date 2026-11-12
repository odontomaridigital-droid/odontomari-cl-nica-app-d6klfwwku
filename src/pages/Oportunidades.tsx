import React, { useState, useEffect } from 'react'
import {
  orcamentosService,
  pacientesService,
  consultasService,
  prontuariosService,
} from '@/services/clinica'
import { Paciente, Consulta, Orcamento, Prontuario } from '@/types'
import {
  calcularOportunidades,
  TipoOportunidade,
  tituloLista,
  descricaoLista,
  totalOportunidades,
} from '@/lib/oportunidades'
import { aniversarioDePaciente } from '@/lib/aniversario'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { OportunidadeColuna } from '@/components/oportunidades/OportunidadeColuna'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import {
  Target,
  TrendingUp,
  CalendarX,
  UserX,
  Clock,
  Wallet,
  PhoneOff,
  Cake,
  RotateCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const ICONE_POR_TIPO: Record<TipoOportunidade, React.ElementType> = {
  planejamento_aberto: Wallet,
  retorno_vencido: RotateCcw,
  faltou: UserX,
  cancelou: CalendarX,
  sem_voltar_6m: Clock,
  sem_telefone: PhoneOff,
}

export const OportunidadesPage: React.FC = () => {
  const { toast } = useToast()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const [pacs, cons, orcs, pronts] = await Promise.all([
          pacientesService.getAll(),
          consultasService.getAll(),
          orcamentosService.getAll(),
          prontuariosService.getAll(),
        ])
        if (!alive) return
        setPacientes(pacs)
        setConsultas(cons)
        setOrcamentos(orcs)
        setProntuarios(pronts)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar oportunidades',
          description: err?.message || 'Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const funis = React.useMemo(
    () => calcularOportunidades(pacientes, consultas, orcamentos, prontuarios),
    [pacientes, consultas, orcamentos, prontuarios],
  )
  const total = totalOportunidades(funis)
  const tiposOrdenados: TipoOportunidade[] = [
    'planejamento_aberto',
    'retorno_vencido',
    'faltou',
    'cancelou',
    'sem_voltar_6m',
    'sem_telefone',
  ]

  // Aniversariantes da semana (7 dias), mais próximos primeiro
  const aniversariantes = React.useMemo(
    () =>
      pacientes
        .map((p) => ({ p, aniv: aniversarioDePaciente(p.data_nascimento) }))
        .filter((x) => x.aniv !== null && x.aniv.diasAte <= 7)
        .sort((a, b) => a.aniv!.diasAte - b.aniv!.diasAte),
    [pacientes],
  )

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-marca-vermelho border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Carregando oportunidades...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-marca-vermelho" />
            Oportunidades
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Listas de pacientes para a recepção retomar o contato — cada uma com mensagem pronta no
            WhatsApp
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs px-3 py-1 border-marca-vermelho/40 text-marca-vermelho bg-marca-vermelho-claro w-fit"
        >
          {total} oportunidade{total === 1 ? '' : 's'}
        </Badge>
      </div>

      {/* Resumo — cartões clicáveis (no celular eles abrem a lista abaixo) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {tiposOrdenados.map((tipo) => {
          const Icone = ICONE_POR_TIPO[tipo]
          return (
            <a
              key={tipo}
              href={`#lista-${tipo}`}
              className="text-left"
              title={`Ir para a lista: ${tituloLista(tipo)}`}
            >
              <Card className="border-slate-200 shadow-sm bg-white hover:border-marca-vermelho/50 transition-colors h-full">
                <CardContent className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] leading-tight text-slate-500 font-medium">
                      {tituloLista(tipo)}
                    </p>
                    <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                      {funis[tipo].length}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-marca-vermelho-claro flex items-center justify-center text-marca-vermelho shrink-0">
                    <Icone className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </a>
          )
        })}
      </div>

      {/* Aniversariantes da semana */}
      {aniversariantes.length > 0 && (
        <Card className="border-pink-200 bg-pink-50/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-pink-900 flex items-center gap-2">
              <Cake className="w-4 h-4 text-pink-600" />
              Aniversariantes da semana
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {aniversariantes.map(({ p, aniv }) => (
                <a
                  key={p.id}
                  href={`/pacientes/${p.id}/prontuario`}
                  className="flex items-center gap-2 rounded-full bg-white border border-pink-200 pl-1 pr-3 py-1 hover:border-pink-400 transition-colors"
                  title={`Abrir prontuário de ${p.nome}`}
                >
                  <PacienteAvatar paciente={p} className="w-6 h-6" textClassName="text-[9px]" />
                  <span className="text-xs font-semibold text-pink-900">{p.nome}</span>
                  <span className="text-[10px] text-pink-600">
                    {aniv!.ehHoje
                      ? '🎉 hoje!'
                      : `em ${aniv!.diasAte} dia${aniv!.diasAte === 1 ? '' : 's'}`}
                  </span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desktop: colunas lado a lado */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {tiposOrdenados.map((tipo) => (
          <div key={tipo} id={`lista-${tipo}`} className="scroll-mt-6">
            <OportunidadeColuna
              tipo={tipo}
              titulo={tituloLista(tipo)}
              descricao={descricaoLista(tipo)}
              lista={funis[tipo]}
            />
          </div>
        ))}
      </div>

      {/* Celular: listas empilhadas */}
      <div className="lg:hidden space-y-4">
        {tiposOrdenados.map((tipo) => (
          <div key={tipo} id={`lista-${tipo}`} className="scroll-mt-4">
            <OportunidadeColuna
              tipo={tipo}
              titulo={tituloLista(tipo)}
              descricao={descricaoLista(tipo)}
              lista={funis[tipo]}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
