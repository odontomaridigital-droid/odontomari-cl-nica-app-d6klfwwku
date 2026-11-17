import React, { useEffect, useRef, useState } from 'react'
import { Mic, Square, Sparkles, Loader2, RotateCcw } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

/**
 * CampoComIA — textarea com fala e "Organizar com IA", usado em TODO campo de
 * texto livre do sistema (observações, queixa, anotações, mensagens).
 *
 * Por que existe: a dentista não digita, ela fala. Digitar no meio do
 * atendimento toma tempo. Então qualquer campo em que se escreve bastante
 * ganha o mesmo par de botões, no mesmo lugar, do mesmo jeito.
 *
 * Como funciona:
 *  1. A pessoa clica em "Falar" e dita. O navegador transcreve (Web Speech).
 *  2. Clica em "Organizar com IA". O backend limpa a fala e devolve texto
 *     clínico pronto — sem repetição, com pontuação, com termo técnico certo.
 *  3. O texto entra no campo para revisão. Nada é gravado sem a pessoa ver.
 *
 * O botão "Desfazer" volta ao texto cru do ditado, caso a IA mude algo que a
 * pessoa não queria.
 *
 * A ordem importa (lição de 2026-11-15): os botões vêm DEPOIS do campo que
 * eles preenchem. Antes ficavam acima e o resultado aparecia abaixo — parecia
 * que não funcionava.
 */

interface CampoComIAProps {
  value: string
  onChange: (texto: string) => void
  /** O que este campo é, para a IA saber como tratar. Ex.: "queixa principal" */
  contexto: string
  label?: string
  placeholder?: string
  rows?: number
  /** Marca o campo como obrigatório no rótulo */
  obrigatorio?: boolean
  /** Chamado quando há erro de microfone/rede/IA */
  onErro?: (titulo: string, mensagem: string) => void
  /** Texto de ajuda abaixo do campo */
  ajuda?: string
  className?: string
}

export const CampoComIA: React.FC<CampoComIAProps> = ({
  value,
  onChange,
  contexto,
  label,
  placeholder,
  rows = 3,
  obrigatorio = false,
  onErro,
  ajuda,
  className,
}) => {
  const [temVoz, setTemVoz] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [organizando, setOrganizando] = useState(false)
  const [interim, setInterim] = useState('')
  const [versaoAnterior, setVersaoAnterior] = useState<string | null>(null)

  const recRef = useRef<any>(null)
  const valorRef = useRef(value)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    valorRef.current = value
  }, [value])

  // ---------- reconhecimento de voz ----------
  useEffect(() => {
    const W = window as any
    const Reconhecimento = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Reconhecimento) return
    setTemVoz(true)

    const rec = new Reconhecimento()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (evento: any) => {
      let parcial = ''
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const r = evento.results[i]
        if (r.isFinal) {
          const trecho = (r[0]?.transcript || '').trim()
          if (trecho) {
            const novo = valorRef.current ? `${valorRef.current} ${trecho}` : trecho
            valorRef.current = novo
            onChange(novo)
          }
        } else {
          parcial += r[0]?.transcript || ''
        }
      }
      setInterim(parcial)
    }

    rec.onerror = (evento: any) => {
      const codigo = evento?.error || ''
      if (codigo === 'not-allowed' || codigo === 'service-not-allowed') {
        onErro?.('Microfone bloqueado', 'Permita o acesso ao microfone no navegador.')
      } else if (codigo === 'network') {
        onErro?.('Sem conexão', 'O reconhecimento de voz precisa de internet.')
      }
      setOuvindo(false)
    }

    rec.onend = () => {
      setOuvindo(false)
      setInterim('')
    }

    recRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {
        /* ignora */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alternarVoz = () => {
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
      valorRef.current = value
      rec.start()
      setOuvindo(true)
    } catch {
      /* já está ouvindo */
    }
  }

  // ---------- organizar com IA ----------
  const organizar = async () => {
    const conteudo = value.trim()
    if (!conteudo) {
      onErro?.('Nada para organizar', 'Fale ou escreva algo antes de organizar.')
      return
    }
    setOrganizando(true)
    try {
      const resposta: any = await pb.send('/backend/v1/texto/organizar', {
        method: 'POST',
        body: { texto: conteudo, contexto },
      })
      const organizado = (resposta?.texto || '').trim()
      if (organizado && organizado !== conteudo) {
        setVersaoAnterior(conteudo)
        onChange(organizado)
      }
    } catch (err: any) {
      onErro?.(
        'Não foi possível organizar',
        err?.message || 'A IA não respondeu. O texto continua no campo.',
      )
    } finally {
      setOrganizando(false)
    }
  }

  const desfazer = () => {
    if (versaoAnterior === null) return
    onChange(versaoAnterior)
    setVersaoAnterior(null)
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-slate-700">
          {label}
          {obrigatorio && <span className="text-marca-vermelho ml-0.5">*</span>}
        </label>
      )}

      <div className="relative mt-1">
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => {
            setVersaoAnterior(null)
            onChange(e.target.value)
          }}
          rows={rows}
          placeholder={placeholder}
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs sm:text-sm leading-relaxed outline-none focus:border-marca-vermelho"
        />
        {interim && (
          <span className="text-[11px] text-slate-400 px-2 pb-1 block -mt-1">{interim}</span>
        )}
      </div>

      {/* Os botões vêm DEPOIS do campo — é o campo que eles preenchem. */}
      {temVoz && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <button
            type="button"
            onClick={alternarVoz}
            disabled={organizando}
            className={cn(
              'h-7 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 transition-colors',
              ouvindo
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white border-slate-300 text-slate-600 hover:border-marca-vermelho hover:text-marca-vermelho',
            )}
          >
            {ouvindo ? (
              <>
                <Square className="w-3 h-3" />
                Parar
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" />
                Falar
              </>
            )}
          </button>

          {value.trim() && (
            <>
              <button
                type="button"
                onClick={organizar}
                disabled={organizando}
                className="h-7 px-2 rounded-md text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 disabled:opacity-60"
              >
                {organizando ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Organizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Organizar com IA
                  </>
                )}
              </button>

              {versaoAnterior !== null && (
                <button
                  type="button"
                  onClick={desfazer}
                  className="h-7 px-2 rounded-md text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Desfazer
                </button>
              )}
            </>
          )}

          {ouvindo && <span className="text-[10px] text-red-600">Ouvindo...</span>}
        </div>
      )}

      {ajuda && <p className="text-[10px] text-slate-500 mt-1">{ajuda}</p>}
    </div>
  )
}
