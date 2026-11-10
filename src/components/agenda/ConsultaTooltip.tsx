import React from 'react'
import { Consulta } from '@/types'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { Clock } from 'lucide-react'

/** Duração legível: "40 min", "1h", "1h30" */
function duracaoTexto(min: number): string {
  if (min % 60 === 0) return `${min / 60}h`
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

/** Resumo rápido do que será feito na consulta — hover/foco no desktop. */
export const ConsultaTooltip: React.FC<{ consulta: Consulta }> = ({ consulta: c }) => {
  const paciente = c.expand?.paciente
  const tipo = c.expand?.tipo_atendimento

  return (
    <div
      className="absolute left-0 top-full z-50 mt-1.5 w-64 pointer-events-none opacity-0 translate-y-1 transition-all duration-100 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
      role="tooltip"
    >
      <div className="rounded-lg bg-slate-900 text-white shadow-xl border border-slate-700 p-3">
        <div className="flex items-start gap-2.5">
          <PacienteAvatar
            paciente={paciente || null}
            className="w-9 h-9 ring-2 ring-white/20"
            textClassName="text-[11px]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight truncate">
              {paciente?.nome || 'Paciente não identificado'}
            </p>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
              {tipo?.nome || 'Procedimento odontológico'}
            </p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {c.hora_inicio} às {c.hora_fim} · {duracaoTexto(c.duracao_minutos || 0)}
            </p>
          </div>
        </div>
        {c.observacoes ? (
          <p className="text-[11px] text-slate-200 leading-snug mt-2 pt-2 border-t border-white/15 whitespace-pre-wrap">
            {c.observacoes}
          </p>
        ) : null}
      </div>
    </div>
  )
}
