import React, { useMemo } from 'react'
import { Consulta } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Lock, LockOpen, AlertTriangle, Cake } from 'lucide-react'
import { getDiaSemanaCurto } from '@/lib/semana'
import { cn } from '@/lib/utils'
import { ConsultaTooltip } from '@/components/agenda/ConsultaTooltip'
import { aniversarioDePaciente } from '@/lib/aniversario'

export const StatusConsultaBadge: React.FC<{ status: Consulta['status'] }> = ({ status }) => {
  switch (status) {
    case 'confirmada':
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-5 px-1.5">
          Confirmada
        </Badge>
      )
    case 'realizada':
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-5 px-1.5">
          Realizada
        </Badge>
      )
    case 'cancelada':
      return (
        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
          Cancelada
        </Badge>
      )
    case 'faltou':
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] h-5 px-1.5">
          Faltou
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="bg-slate-200 text-slate-800 text-[10px] h-5 px-1.5">
          Agendada
        </Badge>
      )
  }
}

export interface AgendaDiaInfo {
  data: string
  isHoje: boolean
  consultas: Consulta[]
  bloqueado: boolean
  isFds: boolean
  desbloqueadoFds: boolean
  motivoBloqueio?: string
}

interface AgendaGradeProps {
  dias: AgendaDiaInfo[]
  horarioInicio: string
  horarioFim: string
  intervaloMinutos: number
  onOpenConsulta: (c: Consulta) => void
  onNovoAgendamento: (data: string, hora?: string) => void
  onToggleBloqueio: (data: string) => void
}

const GUTTER_PX = 56
const HOUR_PX = 56 // altura de cada hora na grade
const MIN_EVENT_PX = 26

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Cor do bloco de consulta conforme o status. */
const blockStyle = (status: Consulta['status']): string => {
  switch (status) {
    case 'confirmada':
      return 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-900'
    case 'realizada':
      return 'bg-blue-50 border-blue-300 hover:bg-blue-100 text-blue-900'
    case 'cancelada':
      return 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-70'
    case 'faltou':
      return 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900'
    default:
      return 'bg-marca-vermelho-claro border-marca-vermelho/50 hover:bg-red-100 text-red-900'
  }
}

interface EventoLayout {
  consulta: Consulta
  top: number
  height: number
  leftPct: number
  widthPct: number
}

/** Distribui consultas sobrepostas em colunas laterais (como no Google Calendar). */
function layoutDoDia(consultas: Consulta[], inicioMin: number, totalMin: number): EventoLayout[] {
  const yOf = (t: string) => ((timeToMinutes(t) - inicioMin) / 60) * HOUR_PX
  const ativos = consultas.filter((c) => c.status !== 'cancelada')
  const canceladas = consultas.filter((c) => c.status === 'cancelada')

  const sorted = [...ativos].sort(
    (a, b) => a.hora_inicio.localeCompare(b.hora_inicio) || a.hora_fim.localeCompare(b.hora_fim),
  )

  const grupos: Consulta[][] = []
  let atual: Consulta[] = []
  let fimGrupo = ''
  for (const c of sorted) {
    if (atual.length && c.hora_inicio >= fimGrupo) {
      grupos.push(atual)
      atual = []
      fimGrupo = ''
    }
    atual.push(c)
    if (c.hora_fim > fimGrupo) fimGrupo = c.hora_fim
  }
  if (atual.length) grupos.push(atual)

  const eventos: EventoLayout[] = []
  for (const grupo of grupos) {
    // aloca faixas (lanes) dentro do grupo
    const lanesFim: string[] = []
    const alocados: { c: Consulta; lane: number }[] = []
    for (const c of grupo) {
      let lane = lanesFim.findIndex((fim) => fim <= c.hora_inicio)
      if (lane === -1) {
        lane = lanesFim.length
        lanesFim.push(c.hora_fim)
      } else {
        lanesFim[lane] = c.hora_fim
      }
      alocados.push({ c, lane })
    }
    const lanes = Math.max(1, lanesFim.length)
    for (const { c, lane } of alocados) {
      const top = Math.max(0, yOf(c.hora_inicio))
      const height = Math.max(MIN_EVENT_PX, yOf(c.hora_fim) - top - 2)
      eventos.push({
        consulta: c,
        top,
        height,
        leftPct: (lane / lanes) * 100,
        widthPct: (1 / lanes) * 100,
      })
    }
  }

  // canceladas: blocos pequenos, por cima, sem ocupar faixa
  for (const c of canceladas) {
    const top = Math.max(0, yOf(c.hora_inicio))
    eventos.push({
      consulta: c,
      top,
      height: Math.max(MIN_EVENT_PX, yOf(c.hora_fim) - top - 2),
      leftPct: 0,
      widthPct: 100,
    })
  }

  return eventos
}

interface ColunaDiaProps {
  dia: AgendaDiaInfo
  eventos: EventoLayout[]
  inicioMin: number
  fimMin: number
  intervaloMinutos: number
  hourLines: string[]
  onOpenConsulta: (c: Consulta) => void
  onNovoAgendamento: (data: string, hora?: string) => void
  onToggleBloqueio: (data: string) => void
}

const ColunaDia: React.FC<ColunaDiaProps> = ({
  dia,
  eventos,
  inicioMin,
  fimMin,
  intervaloMinutos,
  hourLines,
  onOpenConsulta,
  onNovoAgendamento,
  onToggleBloqueio,
}) => {
  const yOf = (hora: string) => ((timeToMinutes(hora) - inicioMin) / 60) * HOUR_PX

  // faixas clicáveis de horário livre (uma por intervalo da clínica)
  const slotsLivres = useMemo(() => {
    if (dia.bloqueado) return []
    const out: string[] = []
    for (let m = inicioMin; m + intervaloMinutos <= fimMin; m += intervaloMinutos) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    }
    return out
  }, [dia.bloqueado, inicioMin, fimMin, intervaloMinutos])

  const slotOcupado = (slot: string) =>
    dia.consultas.some(
      (c) => c.status !== 'cancelada' && slot >= c.hora_inicio && slot < c.hora_fim,
    )

  return (
    <div
      className={cn(
        'relative h-full',
        dia.bloqueado && 'bg-amber-50/70',
        dia.isFds && !dia.bloqueado && 'bg-slate-50/60',
      )}
    >
      {/* linhas de horário */}
      {hourLines.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none"
          style={{ top: yOf(h) }}
        />
      ))}

      {dia.bloqueado ? (
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center group"
          onClick={() => onToggleBloqueio(dia.data)}
          title={dia.desbloqueadoFds ? 'Bloquear novamente' : 'Desbloquear dia'}
        >
          {dia.desbloqueadoFds ? (
            <Lock className="w-4 h-4 text-amber-500" />
          ) : (
            <LockOpen className="w-4 h-4 text-emerald-600" />
          )}
          <span className="text-[10px] font-medium text-amber-800 leading-tight group-hover:underline">
            {dia.isFds
              ? 'Fim de semana bloqueado por padrão'
              : dia.motivoBloqueio || 'Dia inteiro bloqueado'}
          </span>
          <span className="text-[10px] text-slate-500 group-hover:text-emerald-700">
            {dia.desbloqueadoFds ? 'Clique para bloquear' : 'Clique para liberar'}
          </span>
        </button>
      ) : (
        <>
          {/* zonas de horário livre */}
          {slotsLivres.map((slot) => (
            <button
              key={slot}
              type="button"
              className={cn(
                'absolute left-0 right-0 border-t border-dashed border-transparent hover:border-marca-vermelho/50 hover:bg-marca-vermelho-claro/60 group transition-colors',
                slotOcupado(slot) && 'pointer-events-none',
              )}
              style={{ top: yOf(slot), height: (intervaloMinutos / 60) * HOUR_PX }}
              onClick={() => onNovoAgendamento(dia.data, slot)}
              title={`Novo agendamento ${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)} às ${slot}`}
            >
              <Plus className="w-3 h-3 text-marca-vermelho opacity-0 group-hover:opacity-100 absolute right-1 top-1 pointer-events-none" />
            </button>
          ))}

          {/* consultas */}
          {eventos.map(({ consulta: c, top, height, leftPct, widthPct }) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                'group absolute rounded-md border-l-4 border shadow-sm px-1.5 py-0.5 text-left overflow-visible hover:shadow-md transition-shadow z-10',
                blockStyle(c.status),
              )}
              style={{
                top,
                height,
                left: `calc(${leftPct}% + 2px)`,
                width: `calc(${widthPct}% - 4px)`,
              }}
              onClick={() => onOpenConsulta(c)}
              aria-label={`Consulta de ${c.expand?.paciente?.nome || 'Paciente'} às ${c.hora_inicio}: ${c.expand?.tipo_atendimento?.nome || 'Procedimento odontológico'}`}
              tabIndex={0}
            >
              <ConsultaTooltip consulta={c} />
              <span className="block font-mono text-[10px] font-bold leading-tight">
                {c.hora_inicio}
              </span>
              <span className="block text-[11px] font-semibold leading-tight truncate">
                {c.expand?.paciente?.nome || 'Paciente não identificado'}
              </span>
              {(() => {
                const aniv = aniversarioDePaciente(c.expand?.paciente?.data_nascimento)
                if (!aniv || aniv.diasAte > 5) return null
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 mt-0.5 px-1 py-px rounded text-[9px] font-semibold leading-tight',
                      aniv.ehHoje ? 'bg-pink-600 text-white' : 'bg-pink-100 text-pink-800',
                    )}
                    title={`🎂 ${aniv.ehHoje ? 'Aniversário hoje!' : `Faz aniversário em ${aniv.diasAte} ${aniv.diasAte === 1 ? 'dia' : 'dias'}`}`}
                  >
                    <Cake className="w-2.5 h-2.5" />
                    {aniv.ehHoje ? 'Aniversário hoje' : `Aniv. em ${aniv.diasAte}d`}
                  </span>
                )
              })()}
              {height > MIN_EVENT_PX + 10 && (
                <span className="block text-[10px] leading-tight truncate opacity-80">
                  {c.expand?.tipo_atendimento?.nome || 'Procedimento odontológico'}
                </span>
              )}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export const AgendaGrade: React.FC<AgendaGradeProps> = ({
  dias,
  horarioInicio,
  horarioFim,
  intervaloMinutos,
  onOpenConsulta,
  onNovoAgendamento,
  onToggleBloqueio,
}) => {
  const inicioMin = timeToMinutes(horarioInicio)
  const fimMin = Math.max(timeToMinutes(horarioFim), inicioMin + 60)
  const alturaCorpo = ((fimMin - inicioMin) / 60) * HOUR_PX

  // rótulos de hora cheia da lateral
  const hourLines = useMemo(() => {
    const out: string[] = []
    for (let m = Math.ceil(inicioMin / 60) * 60; m <= fimMin; m += 60) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`)
    }
    return out
  }, [inicioMin, fimMin])

  const eventosPorDia = useMemo(
    () => dias.map((d) => layoutDoDia(d.consultas, inicioMin, fimMin)),
    [dias, inicioMin, fimMin],
  )

  const colTemplate = { gridTemplateColumns: `${GUTTER_PX}px repeat(7, minmax(0, 1fr))` }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* rolagem horizontal no mobile, com a grade preservada */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* cabeçalho dos dias */}
          <div className="grid border-b border-slate-200 bg-white" style={colTemplate}>
            <div />
            {dias.map((d) => {
              const ddmm = `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`
              return (
                <div
                  key={d.data}
                  className={cn(
                    'border-l border-slate-200 px-2 py-2',
                    d.isHoje
                      ? 'bg-marca-vermelho text-white'
                      : d.bloqueado
                        ? 'bg-amber-50'
                        : 'bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-wide',
                        d.isHoje ? 'text-white' : 'text-slate-600',
                      )}
                    >
                      {getDiaSemanaCurto(d.data)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {!d.bloqueado && (
                        <button
                          type="button"
                          onClick={() => onNovoAgendamento(d.data)}
                          title="Novo agendamento neste dia"
                          className={cn(
                            'w-5 h-5 rounded flex items-center justify-center',
                            d.isHoje
                              ? 'hover:bg-red-700 text-white'
                              : 'hover:bg-marca-vermelho-claro text-marca-vermelho',
                          )}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleBloqueio(d.data)}
                        title={d.bloqueado ? 'Desbloquear dia' : 'Bloquear dia inteiro'}
                        className={cn(
                          'w-5 h-5 rounded flex items-center justify-center',
                          d.isHoje
                            ? 'hover:bg-red-700 text-white'
                            : d.bloqueado
                              ? 'text-emerald-600 hover:bg-emerald-100'
                              : 'text-amber-600 hover:bg-amber-100',
                        )}
                      >
                        {d.bloqueado ? (
                          <LockOpen className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-base font-bold', d.isHoje ? 'text-white' : '')}>
                      {ddmm}
                    </span>
                    {d.isHoje && (
                      <span className="text-[9px] bg-white text-marca-vermelho font-semibold px-1 py-px rounded leading-none">
                        HOJE
                      </span>
                    )}
                  </div>
                  {(() => {
                    const anives = d.consultas
                      .map((c) => c.expand?.paciente)
                      .filter((p): p is NonNullable<typeof p> => !!p?.data_nascimento)
                      .map((p) => ({ p, aniv: aniversarioDePaciente(p.data_nascimento) }))
                      .filter((x) => x.aniv !== null)
                    if (anives.length === 0) return null
                    return (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {anives.map(({ p, aniv }) => (
                          <span
                            key={p.id}
                            className={cn(
                              'inline-flex items-center gap-0.5 px-1 py-px rounded-full text-[9px] font-semibold leading-none max-w-full',
                              aniv!.ehHoje
                                ? d.isHoje
                                  ? 'bg-white text-pink-700'
                                  : 'bg-pink-600 text-white'
                                : d.isHoje
                                  ? 'bg-pink-100 text-pink-800'
                                  : 'bg-pink-100 text-pink-800',
                            )}
                            title={`🎂 ${p.nome}: ${aniv!.ehHoje ? 'aniversário hoje!' : `aniversário em ${aniv!.diasAte} dia(s)`}`}
                          >
                            <Cake className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{p.nome.split(' ')[0]}</span>
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* corpo da grade */}
          <div className="grid" style={colTemplate}>
            {/* coluna de horas */}
            <div className="relative bg-slate-50/70" style={{ height: alturaCorpo }}>
              {hourLines.map((h) => (
                <span
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] font-mono text-slate-400"
                  style={{ top: ((timeToMinutes(h) - inicioMin) / 60) * HOUR_PX }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* área dos 7 dias */}
            <div className="col-span-7 relative" style={{ height: alturaCorpo }}>
              {dias.map((d, i) => (
                <div
                  key={d.data}
                  className={cn('absolute top-0 bottom-0', i > 0 && 'border-l border-slate-200')}
                  style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
                >
                  <ColunaDia
                    dia={d}
                    eventos={eventosPorDia[i]}
                    inicioMin={inicioMin}
                    fimMin={fimMin}
                    intervaloMinutos={intervaloMinutos}
                    hourLines={hourLines}
                    onOpenConsulta={onOpenConsulta}
                    onNovoAgendamento={onNovoAgendamento}
                    onToggleBloqueio={onToggleBloqueio}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
