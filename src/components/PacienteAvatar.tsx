import React from 'react'
import { cn } from '@/lib/utils'
import { pacienteFotoUrl } from '@/lib/pacienteFoto'
import { User } from 'lucide-react'

interface PacienteAvatarProps {
  paciente?: { id: string; nome: string; foto?: string } | null
  className?: string
  /** tamanho do texto das iniciais quando não há foto */
  textClassName?: string
}

/** Avatar do paciente: mostra a foto quando existe, senão as iniciais. */
export const PacienteAvatar: React.FC<PacienteAvatarProps> = ({
  paciente,
  className,
  textClassName = 'text-xs',
}) => {
  const url = paciente ? pacienteFotoUrl(paciente) : undefined
  const iniciais = (paciente?.nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div
      className={cn(
        'rounded-full bg-marca-vermelho-claro text-marca-vermelho flex items-center justify-center overflow-hidden shrink-0 select-none',
        className || 'w-9 h-9',
      )}
      aria-hidden="true"
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className={cn('font-semibold leading-none', textClassName)}>
          {paciente?.nome ? iniciais : <User className="w-4 h-4" />}
        </span>
      )}
    </div>
  )
}
