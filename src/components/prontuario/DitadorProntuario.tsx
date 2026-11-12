import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2, Sparkles, Square } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

/** Resultado da estruturação feita pela IA no backend */
export interface DitadoEstruturado {
  procedimentos: string
  dente_regiao: string
  anotacoes: string
  retorno_dias: number | null
}

interface DitadorProntuarioProps {
  onEstruturado: (dados: DitadoEstruturado) => void
  onTextoCru?: (texto: string) => void
  onErro: (titulo: string, mensagem: string) => void
  texto?: string
  onTextoChange?: (texto: string) => void
}

/**
 * Ditado do atendimento no prontuário.
 *
 * A transcrição usa a Web Speech API do próprio navegador (gratuita, sem chave):
 * funciona no Chrome, Edge e Safari. O texto é enviado ao backend, que organiza
 * nos campos do prontuário com IA.
 *
 * Sem suporte a voz, a caixa de texto continua disponível: o dentista escreve
 * em linguagem livre e a IA separa nos campos.
 */
export const DitadorProntuario: React.FC<DitadorProntuarioProps> = ({
  onEstruturado,
  onTextoCru,
  onErro,
  texto = '',
  onTextoChange,
}) => {
  const [ouvindo, setOuvindo] = useState(false)
  const [transcrito, setTranscrito] = useState(texto)
  const [organizando, setOrganizando] = useState(false)
  const [temVoz, setTemVoz] = useState(false)
  const [interim, setInterim] = useState('')

  const recRef = useRef<any>(null)
  const textoRef = useRef(texto)

  // ---------- prepara o reconhecimento de voz, quando existir ----------
  useEffect(() => {
    const W = window as any
    const Reconhecimento = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!Reconhecimento) {
      setTemVoz(false)
      return
    }
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
            textoRef.current = textoRef.current ? textoRef.current + ' ' + trecho : trecho
            setTranscrito(textoRef.current)
            onTextoChange?.(textoRef.current)
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
        onErro('Microfone bloqueado', 'Permita o acesso ao microfone para usar o ditado.')
      } else if (codigo === 'network') {
        onErro('Sem conexão', 'O reconhecimento de voz precisa de internet.')
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
  }, [])

  const iniciar = () => {
    if (!recRef.current) return
    try {
      textoRef.current = transcrito
      recRef.current.start()
      setOuvindo(true)
    } catch {
      /* já está rodando */
    }
  }

  const parar = () => {
    if (!recRef.current) return
    try {
      recRef.current.stop()
    } catch {
      /* ignora */
    }
    setOuvindo(false)
    setInterim('')
  }

  const limpar = () => {
    textoRef.current = ''
    setTranscrito('')
    setInterim('')
    onTextoChange?.('')
  }

  // ---------- organiza com IA ----------
  const organizar = async () => {
    const conteudo = transcrito.trim()
    if (!conteudo) {
      onErro('Nada para organizar', 'Escreva ou fale o atendimento antes de organizar.')
      return
    }

    setOrganizando(true)
    try {
      const resposta: any = await pb.send('/backend/v1/prontuario/estruturar', {
        method: 'POST',
        body: { texto: conteudo },
      })

      if (resposta?.ok && resposta?.estruturado) {
        onEstruturado({
          procedimentos: resposta.procedimentos || '',
          dente_regiao: resposta.dente_regiao || '',
          anotacoes: resposta.anotacoes || '',
          retorno_dias: resposta.retorno_dias ?? null,
        })
      } else {
        onTextoCru?.(resposta?.anotacoes || conteudo)
      }
      limpar()
    } catch (err: any) {
      onErro(
        'Não foi possível organizar',
        err?.message || 'A IA não respondeu. O texto continua aqui para você revisar.',
      )
    } finally {
      setOrganizando(false)
    }
  }

  const botaoOrganizar = (
    <Button
      type="button"
      size="sm"
      onClick={organizar}
      disabled={organizando || !transcrito.trim()}
      className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      {organizando ? (
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
  )

  const botaoLimpar = transcrito ? (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={limpar}
      disabled={organizando}
      className="h-8 text-[11px] text-slate-500"
    >
      Limpar
    </Button>
  ) : null

  // ---------- sem voz: caixa de texto + IA ----------
  if (!temVoz) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-marca-vermelho" />
          Descrever o atendimento e organizar com IA
        </p>
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 leading-relaxed">
          <MicOff className="w-3 h-3 inline mr-1" />
          Este navegador não tem ditado por voz (funciona no Chrome, Edge e Safari). Escreva abaixo
          do jeito que preferir — a IA organiza nos campos.
        </p>
        <textarea
          value={transcrito}
          onChange={(e) => {
            setTranscrito(e.target.value)
            textoRef.current = e.target.value
            onTextoChange?.(e.target.value)
          }}
          rows={3}
          placeholder="Ex.: restauração em resina no dente 16 face oclusal, paciente relatou sensibilidade ao frio, retorno em 7 dias"
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-[11px] leading-relaxed text-slate-700 outline-none focus:border-marca-vermelho"
        />
        <div className="flex items-center gap-1.5">
          {botaoOrganizar}
          {botaoLimpar}
        </div>
      </div>
    )
  }

  // ---------- com voz ----------
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-marca-vermelho" />
          Ditar o atendimento
        </p>
        <div className="flex items-center gap-1.5">
          {ouvindo ? (
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
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={iniciar}
              disabled={organizando}
              className="h-8 text-[11px] bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
            >
              <Mic className="w-3.5 h-3.5 mr-1" />
              {transcrito ? 'Continuar ditando' : 'Falar'}
            </Button>
          )}
          {!ouvindo && transcrito && (
            <>
              {botaoOrganizar}
              {botaoLimpar}
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
        <div className="rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-700 max-h-28 overflow-y-auto whitespace-pre-wrap">
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
