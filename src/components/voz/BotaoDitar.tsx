import React, { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botão de ditado para qualquer campo de texto do sistema.
 *
 * Usa a Web Speech API do navegador (gratuita, sem chave): funciona no Chrome,
 * Edge e Safari. O texto reconhecido é entregue ao campo como se tivesse sido
 * digitado, para o usuário revisar antes de gravar.
 *
 * Quando o navegador não tem suporte, nada é renderizado — o campo continua
 * funcionando normalmente.
 */
interface BotaoDitarProps {
  /** Recebe o texto ditado (trecho final reconhecido) */
  onTexto: (texto: string) => void
  /** Chamado quando há erro de microfone ou rede */
  onErro?: (mensagem: string) => void
  /** Idioma do reconhecimento */
  idioma?: string
  className?: string
  /** Rótulo acessível; por padrão "Ditar" */
  titulo?: string
}

export const BotaoDitar: React.FC<BotaoDitarProps> = ({
  onTexto,
  onErro,
  idioma = 'pt-BR',
  className,
  titulo = 'Ditar por voz',
}) => {
  const [suportado, setSuportado] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const recRef = useRef<any>(null)
  const onTextoRef = useRef(onTexto)
  const onErroRef = useRef(onErro)

  // mantém os callbacks atualizados sem recriar o reconhecedor
  useEffect(() => {
    onTextoRef.current = onTexto
    onErroRef.current = onErro
  }, [onTexto, onErro])

  useEffect(() => {
    const W = window as any
    const Reconhecimento = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Reconhecimento) {
      setSuportado(false)
      return
    }
    setSuportado(true)

    const rec = new Reconhecimento()
    rec.lang = idioma
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (evento: any) => {
      let trecho = ''
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const r = evento.results[i]
        if (r.isFinal) {
          trecho += (r[0]?.transcript || '').trim()
        }
      }
      if (trecho) onTextoRef.current(trecho)
    }

    rec.onerror = (evento: any) => {
      const codigo = evento?.error || ''
      if (codigo === 'not-allowed' || codigo === 'service-not-allowed') {
        onErroRef.current?.('Permita o acesso ao microfone no navegador para usar o ditado.')
      } else if (codigo === 'network') {
        onErroRef.current?.('O reconhecimento de voz precisa de internet.')
      }
      setOuvindo(false)
    }

    rec.onend = () => setOuvindo(false)

    recRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {
        /* ignora */
      }
    }
  }, [idioma])

  if (!suportado) return null

  const alternar = () => {
    const rec = recRef.current
    if (!rec) return
    if (ouvindo) {
      try {
        rec.stop()
      } catch {
        /* ignora */
      }
      setOuvindo(false)
      return
    }
    try {
      rec.start()
      setOuvindo(true)
    } catch {
      /* já está ouvindo */
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={ouvindo ? 'Parar de ouvir' : titulo}
      aria-label={ouvindo ? 'Parar de ouvir' : titulo}
      className={cn(
        'inline-flex items-center justify-center rounded-md border transition-colors shrink-0',
        'h-8 w-8',
        ouvindo
          ? 'bg-red-500 border-red-500 text-white animate-pulse'
          : 'bg-white border-slate-300 text-slate-500 hover:border-marca-vermelho hover:text-marca-vermelho',
        className,
      )}
    >
      {ouvindo ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  )
}

/**
 * Campo de texto com botão de ditar ao lado.
 * Aceita as mesmas props de um <textarea>, mais idioma e mensagem de erro.
 */
interface CampoComVozProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onErroVoz?: (mensagem: string) => void
  idioma?: string
}

export const CampoComVoz: React.FC<CampoComVozProps> = ({
  onErroVoz,
  idioma,
  className,
  value,
  onChange,
  ...resto
}) => {
  const ref = useRef<HTMLTextAreaElement>(null)

  const inserir = (texto: string) => {
    const atual = typeof value === 'string' ? value : ''
    const novo = atual ? `${atual.trimEnd()} ${texto}` : texto
    // Repassa como um evento de mudança sintético para o formulário reagir
    if (ref.current) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set
      setter?.call(ref.current, novo)
      ref.current.dispatchEvent(new Event('input', { bubbles: true }))
    }
    onChange?.({
      target: { value: novo },
    } as React.ChangeEvent<HTMLTextAreaElement>)
  }

  return (
    <div className="relative">
      <textarea ref={ref} value={value} onChange={onChange} className={className} {...resto} />
      <div className="absolute right-1.5 top-1.5">
        <BotaoDitar onTexto={inserir} onErro={onErroVoz} idioma={idioma} />
      </div>
    </div>
  )
}
