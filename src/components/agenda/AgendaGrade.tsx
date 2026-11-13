import React, { useMemo } from 'react'
import { Consulta } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Plus, Lock, LockOpen, Cake } from 'lucide-react'
import { getDiaSemanaCurto } from '@/lib/semana'
import { cn } from '@/lib/utils'
import { ConsultaTooltip } from '@/components/agenda/ConsultaTooltip'
import { extrairDiaMes } from '@/lib/aniversario'

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

const GUTTER_PX = 52
const HOUR_PX = 62 // altura de cada hora na grade
const MIN_EVENT_PX = 22
const COL_FDS_PX = 88 // sábado e domingo mais estreitos que os dias úteis

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Cor do bloco de consulta conforme o status. */
const blockStyle = (status: Consulta['status']): string => {
  switch (status) {
    case 'confirmada':
      return 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100 text-emerald-950'
    case 'realizada':
      return 'bg-blue-50 border-blue-400 hover:bg-blue-100 text-blue-950'
    case 'cancelada':
      return 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-70'
    case 'faltou':
      return 'bg-rose-50 border-rose-400 hover:bg-rose-100 text-rose-950'
    default:
      // Agendada e ainda sem confirmação: âmbar, para a recepção ver
      // de relance quem precisa ser contatado.
      return 'bg-amber-50 border-amber-400 hover:bg-amber-100 text-amber-950'
  }
}

/** Bolinha de status, usada no lugar de texto quando o bloco é baixo. */
const dotStyle = (status: Consulta['status']): string => {
  switch (status) {
    case 'confirmada':
      return 'bg-emerald-500'
    case 'realizada':
      return 'bg-blue-500'
    case 'cancelada':
      return 'bg-slate-300'
    case 'faltou':
      return 'bg-rose-500'
    default:
      return 'bg-amber-500'
  }
}

/**
 * Aniversariantes do próprio dia (não todos os pacientes do dia).
 * O filtro anterior mostrava qualquer paciente com data de nascimento
 * preenchida, o que enchia o cabeçalho de nomes sem relação com a data.
 */
function aniversariantesDoDia(consultas: Consulta[], data: string) {
  const [, mm, dd] = data.split('-').map(Number)
  const vistos = new Set<string>()
  const out: { id: string; nome: string }[] = []
  for (const c of consultas) {
    const p = c.expand?.paciente
    if (!p || vistos.has(p.id)) continue
    const dm = extrairDiaMes(p.data_nascimento)
    if (!dm || dm.mes !== mm || dm.dia !== dd) continue
    vistos.add(p.id)
    out.push({ id: p.id, nome: p.nome })
  }
  return out
}

interface EventoLayout {
  consulta: Consulta
  top: number
  height: number
  leftPct: number
  widthPct: number
}

/** Distribui consultas sobrepostas em colunas laterais (como no Google Calendar). */
function layoutDoDia(consultas: Consulta[], inicioMin: number): EventoLayout[] {
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
  estreita: boolean
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
  estreita,
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
        dia.bloqueado && 'bg-slate-100/80',
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
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center group hover:bg-emerald-50/60 transition-colors"
          onClick={() => onToggleBloqueio(dia.data)}
          title={dia.desbloqueadoFds ? 'Bloquear novamente' : 'Desbloquear dia'}
        >
          {dia.desbloqueadoFds ? (
            <Lock className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <LockOpen className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span className="text-[9px] font-semibold text-slate-500 leading-tight">Fechado</span>
          <span className="text-[9px] text-emerald-700 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
            {dia.desbloqueadoFds ? 'bloquear' : 'abrir'}
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
          {eventos.map(({ consulta: c, top, height, leftPct, widthPct }) => {
            const nome = c.expand?.paciente?.nome || 'Paciente não identificado'
            const procedimento = c.expand?.tipo_atendimento?.nome || ''
            // conteúdo conforme a altura do bloco: nada de texto cortado
            const mostraProcedimento = height >= 50
            const mostraStatusTexto = height >= 68
            return (
              <button
                key={c.id}
                type="button"
                className={cn(
                  'group absolute rounded border-l-[3px] border shadow-sm px-1 py-0.5 text-left overflow-hidden hover:shadow-md hover:z-20 transition-shadow z-10',
                  blockStyle(c.status),
                )}
                style={{
                  top,
                  height,
                  left: `calc(${leftPct}% + 1px)`,
                  width: `calc(${widthPct}% - 2px)`,
                }}
                onClick={() => onOpenConsulta(c)}
                aria-label={`Consulta de ${nome} às ${c.hora_inicio}: ${procedimento || 'Procedimento odontológico'}`}
                tabIndex={0}
              >
                <ConsultaTooltip consulta={c} />
                <span className="flex items-center gap-1 leading-none">
                  <span className="font-mono text-[10px] font-bold tabular-nums">
                    {c.hora_inicio.slice(0, 5)}
                  </span>
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyle(c.status))}
                    title={
                      c.status === 'confirmada'
                        ? 'Confirmada'
                        : c.status === 'agendada'
                          ? 'Aguardando confirmação'
                          : c.status
                    }
                  />
                </span>
                <span
                  className={cn(
                    'block font-semibold leading-tight truncate',
                    estreita ? 'text-[10px]' : 'text-[11px]',
                  )}
                >
                  {nome}
                </span>
                {mostraProcedimento && procedimento && (
                  <span className="block text-[9px] leading-tight truncate opacity-75">
                    {procedimento}
                  </span>
                )}
                {mostraStatusTexto && c.status === 'agendada' && (
                  <span className="block text-[9px] leading-tight font-medium text-amber-700">
                    aguardando confirmação
                  </span>
                )}
              </button>
            )
          })}
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
    () => dias.map((d) => layoutDoDia(d.consultas, inicioMin)),
    [dias, inicioMin],
  )

  // Sábado e domingo ocupam menos largura; os dias úteis ficam com o resto.
  const colTemplate = {
    gridTemplateColumns: `${GUTTER_PX}px repeat(5, minmax(132px, 1fr)) ${COL_FDS_PX}px ${COL_FDS_PX}px`,
  }

  const estreitaEm = (i: number) => i >= 5

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* rolagem horizontal no mobile, com a grade preservada */}
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          {/* cabeçalho dos dias */}
          <div className="grid border-b border-slate-200 bg-white" style={colTemplate}>
            <div />
            {dias.map((d, i) => {
              const ddmm = `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`
              const ativas = d.consultas.filter((c) => c.status !== 'cancelada').length
              const anives = aniversariantesDoDia(d.consultas, d.data)
              const estreita = estreitaEm(i)
              return (
                <div
                  key={d.data}
                  className={cn(
                    'border-l border-slate-200 px-1.5 py-1.5 group/dia',
                    d.isHoje
                      ? 'bg-marca-vermelho text-white'
                      : d.bloqueado
                        ? 'bg-slate-100'
                        : 'bg-slate-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wide leading-none',
                        d.isHoje ? 'text-white' : 'text-slate-500',
                      )}
                    >
                      {getDiaSemanaCurto(d.data)}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/dia:opacity-100 transition-opacity">
                      {!d.bloqueado && (
                        <button
                          type="button"
                          onClick={() => onNovoAgendamento(d.data)}
                          title="Novo agendamento neste dia"
                          className={cn(
                            'w-4 h-4 rounded flex items-center justify-center',
                            d.isHoje
                              ? 'hover:bg-red-700 text-white'
                              : 'hover:bg-marca-vermelho-claro text-marca-vermelho',
                          )}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleBloqueio(d.data)}
                        title={d.bloqueado ? 'Desbloquear dia' : 'Bloquear dia inteiro'}
                        className={cn(
                          'w-4 h-4 rounded flex items-center justify-center',
                          d.isHoje
                            ? 'hover:bg-red-700 text-white'
                            : d.bloqueado
                              ? 'text-emerald-600 hover:bg-emerald-100'
                              : 'text-amber-600 hover:bg-amber-100',
                        )}
                      >
                        {d.bloqueado ? (
                          <LockOpen className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      className={cn(
                        'font-bold leading-none',
                        estreita ? 'text-[12px]' : 'text-sm',
                        d.isHoje ? 'text-white' : 'text-slate-800',
                      )}
                    >
                      {ddmm}
                    </span>
                    {d.isHoje && (
                      <span className="text-[8px] bg-white text-marca-vermelho font-bold px-1 py-px rounded leading-none">
                        HOJE
                      </span>
                    )}
                  </div>

                  {/* resumo do dia: quantas consultas, para bater o olho */}
                  {!d.bloqueado && ativas > 0 && (
                    <span
                      className={cn(
                        'text-[9px] leading-none',
                        d.isHoje ? 'text-red-50' : 'text-slate-500',
                      )}
                    >
                      {ativas} {ativas === 1 ? 'consulta' : 'consultas'}
                    </span>
                  )}

                  {/* aniversariantes DO DIA (não todos os que têm data de nascimento) */}
                  {anives.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 px-1 py-px rounded text-[9px] font-semibold leading-none max-w-full',
                          d.isHoje ? 'bg-white text-pink-700' : 'bg-pink-100 text-pink-800',
                        )}
                        title={anives.map((a) => a.nome).join(', ')}
                      >
                        <Cake className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">
                          {anives.length === 1
                            ? anives[0].nome.split(' ')[0]
                            : `${anives[0].nome.split(' ')[0]} +${anives.length - 1}`}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* corpo da grade — usa a mesma grade do cabeçalho, então as colunas alinham */}
          <div className="grid" style={colTemplate}>
            {/* coluna de horas */}
            <div className="relative bg-slate-50/70" style={{ height: alturaCorpo }}>
              {hourLines.map((h) => (
                <span
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] font-mono text-slate-400 tabular-nums"
                  style={{ top: ((timeToMinutes(h) - inicioMin) / 60) * HOUR_PX }}
                >
                  {h}
                </span>
              ))}
            </div>

            {dias.map((d, i) => (
              <div
                key={d.data}
                className={cn(
                  'border-l border-slate-200',
                  d.isHoje && 'ring-1 ring-inset ring-marca-vermelho/20',
                )}
                style={{ height: alturaCorpo }}
              >
                <ColunaDia
                  dia={d}
                  eventos={eventosPorDia[i]}
                  inicioMin={inicioMin}
                  fimMin={fimMin}
                  intervaloMinutos={intervaloMinutos}
                  hourLines={hourLines}
                  estreita={estreitaEm(i)}
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
  )
}
