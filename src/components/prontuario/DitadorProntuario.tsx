import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2, Sparkles, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Resultado da estruturação feita pela IA no backend */
export interface DitadoEstruturado {
  procedimentos: string
  dente_regiao: string
  anotacoes: string
  retorno_dias: number | null
}

interface DitadorProntuarioProps {
  /** Chamado quando a IA terminou de estruturar o texto */
  onEstruturado: (dados: DitadoEstruturado) => void
  /** Chamado quando só existe o texto cru (IA indisponível) */
  onTextoCru?: (texto: string) => void
  onErro: (titulo: string, mensagem: string) => void
  /** Texto já ditado, mantido pelo formulário para não perder ao reabrir */
  texto?: string
  onTextoChange?: (texto: string) => void
}

/**
 * Botão de ditado do prontuário.
 *
 * A transcrição usa a Web Speech API do próprio navegador (gratuita, sem chave):
 * funciona no Chrome, Edge e Safari. O texto transcrito é enviado ao backend, que
 * organiza nos campos do prontuário com IA.
 */
export const DitadorProntuario: React.FC<DitadorProntuarioProps> = ({
  onEstruturado,
  onTextoCru,
  onErro,
  texto = '',
  onTextoChange,
}) => {
  const [ouvindo, setOuvindo] = useState<boolean>(false)
  const [transcrito, setTranscrito] = useState<string>(texto)
  const [estruturando, setEstruturando] = useState<boolean>(false)
  const [suportado, setSuportado] = useState<boolean>(true)
  const [interim, setInterim] = useState<string>('')

  const reconhecimentoRef = useRef<any>(null)
  const textoFinalRef = useRef<string>(texto)

  // Detecta suporte do navegador e prepara o reconhecedor
  useEffect(() => {
    const W = window as any
    const Reconhecimento = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Reconhecimento) {
      setSuportado(false)
      return
    }

    const rec = new Reconhecimento()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (evento: any) => {
      let parcial = ''
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i]
        if (resultado.isFinal) {
          const trecho = resultado[0]?.transcript?.trim()
          if (trecho) {
            textoFinalRef.current = textoFinalRef.current
              ? `${textoFinalRef.current} ${trecho}`
              : trecho
            setTranscrito(textoFinalRef.current)
            onTextoChange?.(textoFinalRef.current)
          }
        } else {
          parcial += resultado[0]?.transcript || ''
        }
      }
      setInterim(parcial)
    }

    rec.onerror = (evento: any) => {
      const codigo = evento?.error || ''
      if (codigo === 'not-allowed' || codigo === 'service-not-allowed') {
        onErro(
          'Microfone bloqueado',
          'Permita o acesso ao microfone no navegador para usar o ditado.',
        )
      } else if (codigo === 'no-speech') {
        // silencioso: nada foi dito nesta janela
      } else if (codigo === 'network') {
        onErro('Sem conexão', 'O reconhecimento de voz precisa de internet.')
      }
      setOuvindo(false)
    }

    rec.onend = () => {
      setOuvindo(false)
      setInterim('')
    }

    reconhecimentoRef.current = rec

    return () => {
      try {
        rec.stop()
      } catch {
        // ignora
      }
    }
  }, [])

  // Mantém o texto sincronizado quando o formulário limpa o campo
  useEffect(() => {
    if (!ouvindo && texto !== transcrito) {
      setTranscrito(texto)
      textoFinalRef.current = texto
    }
  }, [texto, ouvindo])

  const iniciar = () => {
    const rec = reconhecimentoRef.current
    if (!rec) return
    try {
      textoFinalRef.current = transcrito
      rec.start()
      setOuvindo(true)
    } catch {
      // start() falha se já estiver rodando; ignora
    }
  }

  const parar = () => {
    const rec = reconhecimentoRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch {
      // ignora
    }
    setOuvindo(false)
    setInterim('')
  }

  const limpar = () => {
    textoFinalRef.current = ''
    setTranscrito('')
    setInterim('')
    onTextoChange?.('')
  }

  const estruturar = async () => {
    const textoParaEnviar = transcrito.trim()
    if (!textoParaEnviar) {
      onErro('Nada para organizar', 'Fale algo antes de pedir a organização.')
      return
    }

    setEstrutuando(true)
    try {
      const { default: pb } = await import('@/lib/pocketbase/client')
      const resposta = await pb.send('/backend/v1/prontuario/estruturar', {
        method: 'POST',
        body: { texto: textoParaEnviar },
      })

      if (resposta?.ok && resposta.estruturado) {
        onEstruturado({
          procedimentos: resposta.procedimentos || '',
          dente_regiao: resposta.dente_regiao || '',
          anotacoes: resposta.anotacoes || '',
          retorno_dias: resposta.retorno_dias ?? null,
        })
      } else {
        // IA devolveu texto livre: entrega como anotação para revisão
        onTextoCru?.(resposta?.anotacoes || textoParaEnviar)
      }
      limpar()
    } catch (err: any) {
      onErro(
        'Não foi possível organizar',
        err?.message ||
          'A IA não respondeu. O texto ditado continua aqui — você pode copiar para o campo.',
      )
    } finally {
      setEstrutuando(false)
    }
  }

  if (!suportado) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
          <MicOff className="w-3.5 h-3.5" />
          Ditado indisponível neste navegador
        </p>
        <p className="text-[11px] text-amber-800 mt-0.5">
          O ditado funciona no Chrome, Edge e Safari. Abra o sistema em um desses navegadores — ou
          digite normalmente.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-marca-vermelho" />
          Ditar o atendimento
        </p>
        <div className="flex items-center gap-1.5">
          {!ouvindo ? (
            <Button
              type="button"
              size="sm"
              onClick={iniciar}
              disabled={estruturando}
              className="h-8 text-[11px] bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
            >
              <Mic className="w-3.5 h-3.5 mr-1" />
              {transcrito ? 'Continuar ditando' : 'Falar'}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={parar}
              className="h-8 text-[11px] border-red-300 text-red-700 hover:bg-red-50"
            >
              <Square className="w-3 h-3 mr-1" />
              Parar
            </Button>
          )}
          {transcrito && !ouvindo && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={estruturar}
                disabled={estruturando}
                className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {estruturando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Organizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Organizar com IA
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={limpar}
                disabled={estruturando}
                className="h-8 text-[11px] text-slate-500"
              >
                Limpar
              </Button>
            </>
          )}
        </div>
      </div>

      {ouvindo && (
        <div className="flex items-center gap-2 text-[11px] text-red-600 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          Ouvindo... fale normalmente
        </div>
      )}

      {(transcrito || interim) && (
        <div
          className={cn(
            'rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed',
            'text-slate-700 max-h-28 overflow-y-auto whitespace-pre-wrap',
          )}
        >
          {transcrito}
          {interim && <span className="text-slate-400"> {interim}</span>}
        </div>
      )}

      {!transcrito && !ouvindo && (
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Ex.: "restauração em resina no dente dezesseis, face oclusal, paciente relatou
          sensibilidade ao frio, retorno em sete dias".
        </p>
      )}
    </div>
  )
}
