import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { FileHeart, Pencil, Plus } from 'lucide-react'
import { AnamneseRespostasView } from '@/components/anamnese/AnamneseRespostasView'
import { AnamneseDialog } from '@/components/anamnese/AnamneseDialog'
import { Anamnese } from '@/types'
import { formatDateBr } from '@/lib/formatters'

interface AnamneseTabProps {
  anamneses: Anamnese[]
  isAdmin: boolean
  pacienteId: string
  pacienteNome: string
  autorId?: string
  onSaved: () => void
  onError: (title: string, message: string) => void
  onViewError: (title: string, message: string) => void
}

/** Aba "Anamnese" da ficha do paciente: histórico de anamneses + botão Nova Anamnese */
export const AnamneseTab: React.FC<AnamneseTabProps> = ({
  anamneses,
  isAdmin,
  pacienteId,
  pacienteNome,
  autorId,
  onSaved,
  onError,
  onViewError,
}) => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [emEdicao, setEmEdicao] = useState<Anamnese | null>(null)
  const [visualizando, setVisualizando] = useState<Anamnese | null>(null)

  const abrirNova = () => {
    if (!isAdmin) {
      onError(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode preencher anamneses. A recepção tem acesso somente de leitura.',
      )
      return
    }
    setEmEdicao(null)
    setDialogOpen(true)
  }

  const abrirEdicao = (anamnese: Anamnese) => {
    if (!isAdmin) {
      onError(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode editar anamneses. A recepção tem acesso somente de leitura.',
      )
      return
    }
    setEmEdicao(anamnese)
    setDialogOpen(true)
  }

  const handleSaved = () => {
    setDialogOpen(false)
    setEmEdicao(null)
    onSaved()
  }

  return (
    <div className="space-y-4">
      {anamneses.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
          <FileHeart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-medium text-slate-700 text-sm">Nenhuma anamnese registrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Preencha a primeira anamnese deste paciente usando o modelo odontológico da clínica.'
              : 'Nenhuma anamnese registrada pelo dentista até o momento.'}
          </p>
          {isAdmin && (
            <Button
              size="sm"
              className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-xs"
              onClick={abrirNova}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Criar Primeira Anamnese
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {anamneses.length} anamnese{anamneses.length > 1 ? 's' : ''} no histórico deste
              paciente
            </p>
            {isAdmin && (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                onClick={abrirNova}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova Anamnese
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {anamneses.map((anm) => (
              <Card key={anm.id} className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 text-xs">
                      {formatDateBr(anm.data)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[11px] text-slate-500 border-slate-300"
                    >
                      Anamnese Odontológica
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Preenchida por {anm.expand?.autor?.name || 'Dentista'}
                  </span>
                </CardHeader>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Ficha de anamnese completa
                    </p>
                    <p className="text-xs text-slate-500">
                      {anm.expand?.autor?.name
                        ? `Registrada por ${anm.expand.autor.name}`
                        : 'Autor não registrado'}
                      {' • '}
                      Última atualização: {formatDateBr(anm.updated || anm.created || anm.data)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        if (!anm.respostas || typeof anm.respostas !== 'object') {
                          onViewError(
                            'Anamnese sem respostas',
                            'Este registro de anamnese não possui respostas para exibir.',
                          )
                          return
                        }
                        setVisualizando(anm)
                      }}
                    >
                      Ver Respostas
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-slate-600"
                        onClick={() => abrirEdicao(anm)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Formulário de nova/edição de anamnese (Admin) */}
      <AnamneseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pacienteId={pacienteId}
        pacienteNome={pacienteNome}
        anamnese={emEdicao}
        autorId={autorId}
        onSaved={handleSaved}
        onError={onError}
      />

      {/* Visualização somente-leitura das respostas */}
      <Dialog open={Boolean(visualizando)} onOpenChange={(o) => !o && setVisualizando(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileHeart className="w-5 h-5 text-teal-600" />
              Anamnese de {formatDateBr(visualizando?.data)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paciente: {pacienteNome} • Preenchida por{' '}
              {visualizando?.expand?.autor?.name || 'Dentista'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            <AnamneseRespostasView respostas={visualizando?.respostas || {}} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
