import React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ANAMNESE_SECOES,
  AnamneseSecao,
  RespostasAnamnese,
  RespostaSimNao,
  contarRespostas,
  totalQuestoes,
} from '@/lib/anamneseModelo'
import { FileHeart } from 'lucide-react'

interface AnamneseFormFieldsProps {
  respostas: RespostasAnamnese
  onChange: (questaoId: string, valor: RespostaSimNao | string) => void
  /** Seções a exibir; sem esta prop usa o modelo embutido no app */
  secoes?: AnamneseSecao[]
}

/** Todos os campos do modelo de anamnese, agrupados por seção (usado no diálogo) */
export const AnamneseFormFields: React.FC<AnamneseFormFieldsProps> = ({
  respostas,
  onChange,
  secoes,
}) => {
  const listaSecoes = secoes && secoes.length > 0 ? secoes : ANAMNESE_SECOES
  return (
    <div className="space-y-4">
      {listaSecoes.map((secao, idx) => (
        <Card key={secao.id} className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-marca-vermelho-claro text-marca-vermelho-escuro rounded-md px-1.5 py-0.5 text-[11px] font-bold">
                {idx + 1}
              </span>
              {secao.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {secao.questoes.map((q) => {
              if (q.tipo === 'texto') {
                return (
                  <div key={q.id}>
                    <Label htmlFor={`anm_${q.id}`} className="text-xs font-medium text-slate-700">
                      {q.texto}
                    </Label>
                    <Textarea
                      id={`anm_${q.id}`}
                      rows={2}
                      value={(respostas[q.id] as string) || ''}
                      onChange={(e) => onChange(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="mt-1 text-xs sm:text-sm"
                    />
                  </div>
                )
              }

              const r = (respostas[q.id] as RespostaSimNao) || { resposta: '', detalhe: '' }
              return (
                <div key={q.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-xs font-medium text-slate-700">
                      {q.texto}
                      {q.dica && (
                        <span className="block text-[10px] text-slate-400 font-normal italic">
                          {q.dica}
                        </span>
                      )}
                    </Label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onChange(q.id, { resposta: 'sim', detalhe: r.detalhe || '' })
                        }
                        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                          r.resposta === 'sim'
                            ? 'bg-marca-vermelho border-marca-vermelho text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-marca-vermelho'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChange(q.id, { resposta: 'nao', detalhe: r.detalhe || '' })
                        }
                        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                          r.resposta === 'nao'
                            ? 'bg-slate-600 border-slate-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                  {r.resposta === 'sim' && (
                    <Textarea
                      rows={2}
                      value={r.detalhe || ''}
                      onChange={(e) => onChange(q.id, { resposta: 'sim', detalhe: e.target.value })}
                      placeholder={q.detalhePlaceholder || 'Detalhe a resposta...'}
                      className="mt-2 text-xs sm:text-sm bg-white"
                    />
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

/** Resumo "X de Y perguntas respondidas" para a lista do histórico */
export const AnamneseResumoRespostas: React.FC<{ respostas: RespostasAnamnese }> = ({
  respostas,
}) => {
  const respondidas = contarRespostas(respostas)
  const total = totalQuestoes()
  return (
    <span className="text-[11px] text-slate-500 flex items-center gap-1">
      <FileHeart className="w-3 h-3 text-marca-vermelho" />
      {respondidas} de {total} perguntas respondidas
    </span>
  )
}
