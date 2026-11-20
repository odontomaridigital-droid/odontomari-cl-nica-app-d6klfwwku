import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type CampoSenhaProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Classe extra para o invólucro relativo do campo. */
  className?: string
}

/**
 * Campo de senha com botão de olho (mostrar/ocultar) embutido à direita.
 *
 * O botão é um <button type="button"> dentro de um invólucro relativo —
 * assim funciona por toque e teclado em qualquer contexto (diálogo,
 * formulário de login, mobile) sem depender de ícones absolutos sobre o input.
 */
export const CampoSenha: React.FC<CampoSenhaProps> = ({ className, id, ...props }) => {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <Input {...props} id={id} type={mostrar ? 'text' : 'password'} className="pr-10" />
      <button
        type="button"
        tabIndex={0}
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={mostrar}
        title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-vermelho focus-visible:ring-offset-1 rounded-r-md"
      >
        {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
