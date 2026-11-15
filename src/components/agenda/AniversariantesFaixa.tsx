import React from 'react'
import { Cake, Check, Send } from 'lucide-react'
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
  /** Ids dos pacientes que já receberam a mensagem neste ano */
  enviados?: Set<string>
  /** Quando informado, mostra o botão de enviar em quem ainda não recebeu */
  onEnviar?: (item: AniversarianteItem) => void
  /** Clique no selo de enviado — permite desfazer */
  onDesfazerEnvio?: (item: AniversarianteItem) => void
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
 * Mostra quem já recebeu (selo verde) e quem ainda não (botão de enviar),
 * para a recepção nunca parabenizar o mesmo paciente duas vezes no ano.
 */
export const FaixaAniversario: React.FC<FaixaAniversarioProps> = ({
  titulo,
  itens,
  onAbrir,
  cor = 'text-slate-600',
  destaque = false,
  enviados,
  onEnviar,
  onDesfazerEnvio,
}) => {
  const pretendeMostrarStatus = !!enviados

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
          {itens.map((item) => {
            const { p, janela } = item
            const jaEnviado = pretendeMostrarStatus ? enviados!.has(p.id) : false

            return (
              <span
                key={p.id}
                className={cn(
                  'flex items-center gap-1 rounded-full pl-1 pr-1 py-0.5 border',
                  jaEnviado
                    ? 'bg-emerald-50 border-emerald-300'
                    : destaque
                      ? 'bg-pink-600 border-pink-600 text-white'
                      : janela.offset < 0
                        ? 'bg-white border-slate-200'
                        : 'bg-white border-pink-200',
                )}
              >
                <button
                  type="button"
                  onClick={() => onAbrir(p.id)}
                  title={`Abrir prontuário de ${p.nome}`}
                  className="flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 rounded-full hover:opacity-80"
                >
                  <PacienteAvatar
                    paciente={p}
                    className="w-5 h-5"
                    textClassName={destaque && !jaEnviado ? 'text-[8px] text-white' : 'text-[8px]'}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-semibold leading-none',
                      jaEnviado ? 'text-emerald-900' : destaque ? 'text-white' : 'text-slate-800',
                    )}
                  >
                    {p.nome}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] leading-none',
                      jaEnviado
                        ? 'text-emerald-700'
                        : destaque
                          ? 'text-pink-100'
                          : 'text-slate-500',
                    )}
                  >
                    {diaMes(p.data_nascimento)}
                    {janela.idade !== null && ` · ${janela.idade} anos`}
                    {' · '}
                    {quando(janela.offset)}
                  </span>
                  {destaque && !jaEnviado && <Cake className="w-3 h-3 shrink-0" />}
                </button>

                {/* Selo de enviado / botão de enviar */}
                {pretendeMostrarStatus && jaEnviado && (
                  <button
                    type="button"
                    onClick={() => onDesfazerEnvio?.(item)}
                    title="Já recebeu neste ano. Clique para desfazer."
                    className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
                {pretendeMostrarStatus && !jaEnviado && onEnviar && (
                  <button
                    type="button"
                    onClick={() => onEnviar(item)}
                    title="Enviar parabéns pelo WhatsApp"
                    className="shrink-0 w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center hover:bg-pink-700"
                  >
                    <Send className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
