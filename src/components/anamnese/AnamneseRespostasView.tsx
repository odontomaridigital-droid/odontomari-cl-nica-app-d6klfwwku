import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ANAMNESE_SECOES, RespostasAnamnese, RespostaSimNao } from '@/lib/anamneseModelo'
import { Check, X, MinusCircle } from 'lucide-react'

/** Visualização somente-leitura das respostas de uma anamnese, agrupadas por seção */
export const AnamneseRespostasView: React.FC<{ respostas: RespostasAnamnese }> = ({
  respostas,
}) => {
  return (
    <div className="space-y-4">
      {ANAMNESE_SECOES.map((secao, idx) => (
        <Card key={secao.id} className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-teal-100 text-teal-800 rounded-md px-1.5 py-0.5 text-[11px] font-bold">
                {idx + 1}
              </span>
              {secao.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {secao.questoes.map((q) => {
              const v = respostas[q.id]

              if (q.tipo === 'texto') {
                const txt = typeof v === 'string' ? v.trim() : ''
                return (
                  <div key={q.id}>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      {q.texto}
                    </h5>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">
                      {txt || <span className="text-slate-400 italic text-xs">Não informado</span>}
                    </p>
                  </div>
                )
              }

              const r = (v as RespostaSimNao) || { resposta: '', detalhe: '' }
              return (
                <div key={q.id}>
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {q.texto}
                      {q.dica && (
                        <span className="block text-[10px] text-slate-400 font-normal normal-case italic">
                          {q.dica}
                        </span>
                      )}
                    </h5>
                    <Badge
                      className={
                        r.resposta === 'sim'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          : r.resposta === 'nao'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                      }
                    >
                      {r.resposta === 'sim' && (
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3" /> Sim
                        </span>
                      )}
                      {r.resposta === 'nao' && (
                        <span className="flex items-center gap-1">
                          <X className="w-3 h-3" /> Não
                        </span>
                      )}
                      {!r.resposta && (
                        <span className="flex items-center gap-1">
                          <MinusCircle className="w-3 h-3" /> —
                        </span>
                      )}
                    </Badge>
                  </div>
                  {r.resposta === 'sim' && r.detalhe && (
                    <p className="text-xs text-slate-700 whitespace-pre-wrap mt-1 bg-slate-50 border border-slate-100 rounded-lg p-2">
                      {r.detalhe}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
