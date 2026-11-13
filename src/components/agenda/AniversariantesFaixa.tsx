import React from 'react'
import { Cake } from 'lucide-react'
import { Paciente } from '@/types'
import { PacienteAvatar } from '@/components/PacienteAvatar'
import { cn } from '@/lib/utils'

export interface AniversarianteItem {
  p: Paciente
  janela: { offset: number; idade: number | null; ano: number }
}

interface FaixaAniversarioProps {
  titulo: string
  itens: AniversarianteItem[]
  onAbrir: (pacienteId: string) => void
  cor?: string
  destaque?: boolean
}

/** Data (dd/mm) do aniversário a partir do dia e mês de nascimento. */
function diaMes(dataNascimento?: string | null): string {
  const s = String(dataNascimento ?? '')
  const m = s.match(/^\d{4}-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${m[2]}/${m[1]}`
}

/** Texto do deslocamento: "hoje", "há 3 dias", "em 2 dias". */
function quando(offset: number): string {
  if (offset === 0) return 'hoje'
  if (offset === -1) return 'ontem'
  if (offset === 1) return 'amanhã'
  if (offset < 0) return `há ${Math.abs(offset)} dias`
  return `em ${offset} dias`
}

/**
 * Uma faixa de aniversariantes (passados, hoje ou próximos).
 * Quando a faixa está vazia, mostra uma linha discreta em vez de sumir —
 * assim a recepção vê que ninguém se encaixa ali.
 */
export const FaixaAniversario: React.FC<FaixaAniversarioProps> = ({
  titulo,
  itens,
  onAbrir,
  cor = 'text-slate-600',
  destaque = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
      <span
        className={cn(
          'text-[10px] font-bold uppercase tracking-wide shrink-0 sm:w-44 sm:pt-1.5',
          cor,
        )}
      >
        {titulo}
      </span>
      {itens.length === 0 ? (
        <span className="text-[11px] text-slate-400 sm:pt-1.5">ninguém</span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {itens.map(({ p, janela }) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAbrir(p.id)}
              title={`Abrir prontuário de ${p.nome}`}
              className={cn(
                'flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 border transition-colors',
                destaque
                  ? 'bg-pink-600 border-pink-600 text-white hover:bg-pink-700'
                  : janela.offset < 0
                    ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    : 'bg-white border-pink-200 text-pink-900 hover:border-pink-400',
              )}
            >
              <PacienteAvatar
                paciente={p}
                className="w-5 h-5"
                textClassName={destaque ? 'text-[8px] text-white' : 'text-[8px]'}
              />
              <span className="text-[11px] font-semibold leading-none">{p.nome}</span>
              <span
                className={cn(
                  'text-[10px] leading-none',
                  destaque ? 'text-pink-100' : 'text-slate-500',
                )}
              >
                {diaMes(p.data_nascimento)}
                {janela.idade !== null && ` · ${janela.idade} anos`}
                {' · '}
                {quando(janela.offset)}
              </span>
              {destaque && <Cake className="w-3 h-3 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
