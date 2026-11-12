import React from 'react'
import { Consulta } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Lock, Unlock, AlertTriangle } from 'lucide-react'
import { getDiaSemanaCurto } from '@/lib/semana'

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

/** Cor da faixa lateral de cada consulta, para a recepção saber de relance
 *  quem já confirmou e quem ainda precisa ser contatado. */
function corFaixaStatus(status: Consulta['status']): string {
  switch (status) {
    case 'confirmada':
      return 'border-l-emerald-500'
    case 'realizada':
      return 'border-l-blue-500'
    case 'faltou':
      return 'border-l-amber-500'
    case 'cancelada':
      return 'border-l-red-400'
    default:
      return 'border-l-slate-300'
  }
}

interface AgendaDiaColunaProps {
  data: string
  isHoje: boolean
  consultas: Consulta[]
  bloqueado: boolean
  isFimDeSemana: boolean
  desbloqueadoFds: boolean
  motivoBloqueio?: string
  timeSlots: string[]
  onOpenConsulta: (c: Consulta) => void
  onNovoAgendamento: (hora?: string) => void
  onToggleBloqueio: () => void
}

export const AgendaDiaColuna: React.FC<AgendaDiaColunaProps> = ({
  data,
  isHoje,
  consultas,
  bloqueado,
  isFimDeSemana,
  desbloqueadoFds,
  motivoBloqueio,
  timeSlots,
  onOpenConsulta,
  onNovoAgendamento,
  onToggleBloqueio,
}) => {
  const ocupado = (slot: string) =>
    consultas.some((c) => c.status !== 'cancelada' && slot >= c.hora_inicio && slot < c.hora_fim)
  const livres = bloqueado ? [] : timeSlots.filter((slot) => !ocupado(slot))

  return (
    <div
      className={`flex flex-col min-w-0 bg-white rounded-xl border shadow-sm ${
        isHoje ? 'border-marca-vermelho ring-2 ring-red-200' : 'border-slate-200'
      }`}
    >
      <div
        className={`p-3 rounded-t-xl border-b ${
          isHoje
            ? 'bg-marca-vermelho text-white border-marca-vermelho'
            : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {getDiaSemanaCurto(data)}
          </span>
          {isHoje && (
            <span className="text-[10px] bg-white text-marca-vermelho font-semibold px-1.5 py-0.5 rounded">
              Hoje
            </span>
          )}
        </div>
        <div className="text-lg font-bold">
          {data.slice(8, 10)}/{data.slice(5, 7)}
        </div>
      </div>

      <div className="p-2 space-y-2 flex-1">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] flex-1"
            onClick={onToggleBloqueio}
            title={bloqueado ? 'Desbloquear dia' : 'Bloquear dia inteiro'}
          >
            {bloqueado ? (
              <>
                <Unlock className="w-3 h-3 mr-1 text-emerald-600" />
                Desbloquear
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1 text-amber-600" />
                Bloquear
              </>
            )}
          </Button>
          {!bloqueado && (
            <Button
              size="icon"
              className="h-7 w-7 bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white shrink-0"
              onClick={() => onNovoAgendamento()}
              title="Novo agendamento neste dia"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {bloqueado && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
            <span>
              {isFimDeSemana && !desbloqueadoFds
                ? 'Fim de semana bloqueado por padrão'
                : motivoBloqueio || 'Dia inteiro bloqueado'}
            </span>
          </div>
        )}

        {consultas.length === 0 && !bloqueado && (
          <p className="text-[11px] text-slate-400 text-center py-2">Sem consultas</p>
        )}

        {consultas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpenConsulta(c)}
            className={`w-full text-left rounded-lg border border-slate-200 border-l-4 ${corFaixaStatus(
              c.status,
            )} hover:border-marca-vermelho/50 hover:bg-marca-vermelho-claro/50 p-2 transition-colors`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-xs font-bold text-marca-vermelho">
                {c.hora_inicio}
              </span>
              <StatusConsultaBadge status={c.status} />
            </div>
            <p className="text-xs font-medium text-slate-900 truncate mt-0.5">
              {c.expand?.paciente?.nome || 'Paciente não identificado'}
            </p>
            <p className="text-[10px] text-marca-vermelho-escuro truncate">
              {c.expand?.tipo_atendimento?.nome || 'Procedimento odontológico'}
            </p>
            {(c.status === 'agendada' || c.status === 'confirmada') && (
              <p
                className={`text-[9px] mt-0.5 font-medium ${
                  c.status === 'confirmada' ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {c.status === 'confirmada' ? '✓ Presença confirmada' : '! Ainda não confirmou'}
              </p>
            )}
          </button>
        ))}

        {livres.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-600 mt-2 mb-1">
              Horários livres ({livres.length})
            </p>
            <div className="grid grid-cols-3 gap-1 max-h-[260px] overflow-y-auto pr-0.5">
              {livres.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onNovoAgendamento(slot)}
                  className="text-[11px] font-mono py-1 rounded border bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
