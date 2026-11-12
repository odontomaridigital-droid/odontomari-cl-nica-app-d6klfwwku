import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ClipboardList, Trash2, Save, Stethoscope } from 'lucide-react'
import { OdontogramaMapa } from '@/components/odontograma/OdontogramaMapa'
import {
  CONDICOES,
  CONDICAO_POR_ID,
  CondicaoDente,
  FACES,
  FaceDente,
  nomeDente,
} from '@/lib/odontograma'
import { OdontogramaRegistro } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface OdontogramaTabProps {
  registros: OdontogramaRegistro[]
  isAdmin: boolean
  pacienteNome: string
  onSalvar: (data: {
    dente: number
    condicao: CondicaoDente
    faces: FaceDente[]
    observacao: string
  }) => Promise<void>
  onRemover: (registroId: string, dente: number) => Promise<void>
  onAviso: (title: string, message: string) => void
}

/**
 * Aba do prontuário com o mapa dos 32 dentes.
 * Clique num dente para registrar/alterar a condição dele.
 * A recepção vê o mapa em modo leitura.
 */
export const OdontogramaTab: React.FC<OdontogramaTabProps> = ({
  registros,
  isAdmin,
  pacienteNome,
  onSalvar,
  onRemover,
  onAviso,
}) => {
  const [denteSelecionado, setDenteSelecionado] = useState<number | null>(null)
  const [condicao, setCondicao] = useState<CondicaoDente>('higido')
  const [faces, setFaces] = useState<FaceDente[]>([])
  const [observacao, setObservacao] = useState<string>('')
  const [salvando, setSalvando] = useState<boolean>(false)

  const registroDoDente = (dente: number) => registros.find((r) => r.dente === dente)

  const abrirDente = (dente: number) => {
    if (!isAdmin) {
      onAviso(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode registrar o odontograma. A recepção tem acesso somente de leitura.',
      )
      return
    }
    const atual = registroDoDente(dente)
    setDenteSelecionado(dente)
    setCondicao((atual?.condicao as CondicaoDente) || 'higido')
    setFaces(((atual?.faces as FaceDente[]) || []).slice())
    setObservacao(atual?.observacao || '')
  }

  const fechar = () => {
    setDenteSelecionado(null)
    setObservacao('')
    setFaces([])
  }

  const salvar = async () => {
    if (denteSelecionado === null) return
    setSalvando(true)
    try {
      await onSalvar({ dente: denteSelecionado, condicao, faces, observacao })
      fechar()
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    if (denteSelecionado === null) return
    const atual = registroDoDente(denteSelecionado)
    if (!atual) {
      fechar()
      return
    }
    setSalvando(true)
    try {
      await onRemover(atual.id, denteSelecionado)
      fechar()
    } finally {
      setSalvando(false)
    }
  }

  const toggleFace = (face: FaceDente) => {
    setFaces((prev) => (prev.includes(face) ? prev.filter((f) => f !== face) : [...prev, face]))
  }

  const alterados = registros.filter((r) => r.condicao !== 'higido')

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <Card className="border-slate-200 bg-slate-50 shadow-none">
          <CardContent className="p-3 text-xs text-slate-600">
            Visualização do odontograma. O registro é de acesso exclusivo do dentista.
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="p-4 pb-2 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-marca-vermelho" />
            Odontograma — {pacienteNome}
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isAdmin
              ? 'Clique em um dente para registrar a condição. Os números seguem a numeração FDI.'
              : 'Mapa da situação atual dos dentes.'}
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <OdontogramaMapa
            estados={registros.map((r) => ({
              dente: r.dente,
              condicao: r.condicao as CondicaoDente,
            }))}
            selecionado={denteSelecionado}
            onSelecionar={abrirDente}
            somenteLeitura={!isAdmin}
          />
        </CardContent>
      </Card>

      {alterados.length > 0 && (
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="p-4 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-marca-vermelho" />
              Dentes com registro ({alterados.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-1.5">
            {alterados
              .slice()
              .sort((a, b) => a.dente - b.dente)
              .map((r) => {
                const info = CONDICAO_POR_ID[r.condicao as CondicaoDente]
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => abrirDente(r.dente)}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg border border-slate-100 hover:border-marca-vermelho/40 text-left transition-colors"
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 border border-slate-300"
                      style={{ backgroundColor: info?.cor, color: info?.texto }}
                    >
                      {info?.sigla || r.dente}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800">
                          Dente {r.dente}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-600"
                        >
                          {info?.label || r.condicao}
                        </Badge>
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {nomeDente(r.dente)}
                        {r.faces && r.faces.length > 0 && (
                          <>
                            {' '}
                            {' • '}faces: {r.faces.join(', ')}
                          </>
                        )}
                      </span>
                      {r.observacao && (
                        <span className="block text-[11px] text-slate-600 italic mt-0.5">
                          {r.observacao}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatDateBr(r.data)}
                    </span>
                  </button>
                )
              })}
          </CardContent>
        </Card>
      )}

      {alterados.length === 0 && (
        <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-6 bg-white">
          <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'Nenhum dente registrado ainda. Clique num dente no mapa para começar.'
              : 'Nenhum registro no odontograma até o momento.'}
          </p>
        </Card>
      )}

      {/* Dialog de registro do dente */}
      <Dialog open={denteSelecionado !== null} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="w-5 h-5 text-marca-vermelho" />
              Dente {denteSelecionado} — {denteSelecionado ? nomeDente(denteSelecionado) : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Escolha a condição e, se quiser, as faces afetadas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Condição</Label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                {CONDICOES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCondicao(c.id)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-colors',
                      condicao === c.id
                        ? 'border-marca-vermelho bg-marca-vermelho-claro'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-slate-300 shrink-0"
                      style={{ backgroundColor: c.cor }}
                    />
                    <span className="text-[11px] font-medium text-slate-700 leading-tight">
                      {c.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Faces afetadas <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {FACES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFace(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors',
                      faces.includes(f.id)
                        ? 'border-marca-vermelho bg-marca-vermelho text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="obs-dente" className="text-xs font-semibold text-slate-700">
                Observação <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Textarea
                id="obs-dente"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: cárie profunda em oclusal, sem sintomatologia..."
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-slate-100 flex-row justify-between gap-2">
            {registroDoDente(denteSelecionado ?? 0) ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={remover}
                disabled={salvando}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Limpar registro
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fechar}
                disabled={salvando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={salvar}
                disabled={salvando}
                className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
