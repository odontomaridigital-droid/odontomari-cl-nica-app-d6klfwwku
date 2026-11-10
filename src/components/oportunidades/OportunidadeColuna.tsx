import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Oportunidade, resumoReferencia, mensagemWhatsApp } from '@/lib/oportunidades'
import { createWhatsAppUrl, formatCurrency, formatPhone } from '@/lib/formatters'
import {
  MessageCircle,
  PhoneOff,
  Wallet,
  CalendarX,
  CalendarCheck,
  UserX,
  Copy,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { TipoOportunidade } from '@/lib/oportunidades'

const ICONES: Record<TipoOportunidade, React.ElementType> = {
  planejamento_aberto: Wallet,
  faltou: UserX,
  cancelou: CalendarX,
  sem_voltar_6m: CalendarCheck,
  sem_telefone: PhoneOff,
}

const CORES: Record<TipoOportunidade, { chip: string; iconeBox: string }> = {
  planejamento_aberto: {
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
    iconeBox: 'bg-amber-50 text-amber-600',
  },
  faltou: {
    chip: 'bg-marca-vermelho-claro text-marca-vermelho-escuro border-red-200',
    iconeBox: 'bg-marca-vermelho-claro text-marca-vermelho',
  },
  cancelou: {
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    iconeBox: 'bg-slate-100 text-slate-600',
  },
  sem_voltar_6m: {
    chip: 'bg-blue-50 text-blue-800 border-blue-200',
    iconeBox: 'bg-blue-50 text-blue-600',
  },
  sem_telefone: {
    chip: 'bg-purple-50 text-purple-800 border-purple-200',
    iconeBox: 'bg-purple-50 text-purple-600',
  },
}

interface OportunidadeColunaProps {
  titulo: string
  descricao: string
  tipo: TipoOportunidade
  lista: Oportunidade[]
}

export const OportunidadeColuna: React.FC<OportunidadeColunaProps> = ({
  titulo,
  descricao,
  tipo,
  lista,
}) => {
  const { toast } = useToast()
  const Icone = ICONES[tipo]
  const cor = CORES[tipo]

  const abrirWhatsApp = (op: Oportunidade) => {
    const msg = mensagemWhatsApp(op.tipo, op.pacienteNome)
    window.open(createWhatsAppUrl(op.telefone, msg), '_blank')
  }

  const copiarMensagem = (op: Oportunidade) => {
    const msg = mensagemWhatsApp(op.tipo, op.pacienteNome)
    navigator.clipboard
      .writeText(msg)
      .then(() =>
        toast({
          title: 'Mensagem copiada!',
          description: `Mensagem de ${op.pacienteNome} copiada.`,
        }),
      )
      .catch(() => toast({ title: 'Não foi possível copiar', variant: 'destructive' }))
  }

  return (
    <Card className="border-slate-200 shadow-sm bg-white flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cor.iconeBox}`}
            >
              <Icone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">{titulo}</h2>
              <p className="text-[11px] text-slate-500 truncate">{descricao}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-bold shrink-0 border-marca-vermelho/30 text-marca-vermelho bg-marca-vermelho-claro/60"
          >
            {lista.length}
          </Badge>
        </div>
      </div>

      <CardContent className="p-3 space-y-2 flex-1">
        {lista.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-xs text-slate-400">Nenhum paciente nesta lista por enquanto. 🎉</p>
          </div>
        ) : (
          lista.map((op) => (
            <div
              key={op.pacienteId}
              className="rounded-xl border border-slate-200 p-3 space-y-2 hover:border-marca-vermelho/40 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{op.pacienteNome}</p>
                  <p className="text-[11px] text-slate-500">
                    {resumoReferencia(op)}
                    {op.telefone ? ` · ${formatPhone(op.telefone)}` : ''}
                  </p>
                </div>
                {typeof op.valorTotal === 'number' && op.valorTotal > 0 && (
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 text-[11px] shrink-0 font-bold">
                    {formatCurrency(op.valorTotal)}
                  </Badge>
                )}
              </div>

              {op.telefone ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                    onClick={() => abrirWhatsApp(op)}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px] text-slate-600 border-slate-200 px-2.5"
                    onClick={() => copiarMensagem(op)}
                    title="Copiar mensagem pronta"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                  <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                  Sem telefone cadastrado — atualize no cadastro do paciente.
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
