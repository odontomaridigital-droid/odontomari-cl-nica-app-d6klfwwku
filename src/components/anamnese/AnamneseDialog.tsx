import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileHeart } from 'lucide-react'
import { AnamneseFormFields } from '@/components/anamnese/AnamneseFormFields'
import { anamnesesService } from '@/services/clinica'
import { Anamnese } from '@/types'
import {
  MODELO_ANAMNESE,
  RespostasAnamnese,
  respostasVazias,
  normalizarRespostas,
} from '@/lib/anamneseModelo'
import { formatDateBr } from '@/lib/formatters'

interface AnamneseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pacienteId: string
  pacienteNome: string
  /** Anamnese a editar; ausente = nova anamnese */
  anamnese?: Anamnese | null
  autorId?: string
  onSaved: () => void
  onError: (title: string, message: string) => void
}

/** Diálogo de criação/edição de anamnese com o modelo padrão embutido no app */
export const AnamneseDialog: React.FC<AnamneseDialogProps> = ({
  open,
  onOpenChange,
  pacienteId,
  pacienteNome,
  anamnese,
  autorId,
  onSaved,
  onError,
}) => {
  const isEdicao = Boolean(anamnese)
  const [dataPreenchimento, setDataPreenchimento] = useState<string>(
    new Date().toISOString().split('T')[0],
  )
  const [respostas, setRespostas] = useState<RespostasAnamnese>(respostasVazias())
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => {
    if (!open) return
    if (anamnese) {
      setRespostas(normalizarRespostas(anamnese.respostas))
      setDataPreenchimento((anamnese.data || '').split('T')[0].split(' ')[0])
    } else {
      setRespostas(respostasVazias())
      setDataPreenchimento(new Date().toISOString().split('T')[0])
    }
  }, [open, anamnese])

  const setResposta = (questaoId: string, valor: RespostasAnamnese[string]) => {
    setRespostas((prev) => ({ ...prev, [questaoId]: valor }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdicao && anamnese) {
        await anamnesesService.update(anamnese.id, {
          respostas,
          data: dataPreenchimento,
        })
      } else {
        await anamnesesService.create({
          paciente: pacienteId,
          autor: autorId,
          modelo: MODELO_ANAMNESE.id,
          respostas,
          data: dataPreenchimento,
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      onError(isEdicao ? 'Erro ao salvar anamnese' : 'Erro ao criar anamnese', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileHeart className="w-5 h-5 text-marca-vermelho" />
            {isEdicao ? 'Editar Anamnese' : 'Nova Anamnese'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Paciente: {pacienteNome} • Modelo: {MODELO_ANAMNESE.nome}
            {isEdicao && anamnese?.data ? ` • Original: ${formatDateBr(anamnese.data)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          <div>
            <Label htmlFor="anamnese_data" className="text-xs">
              Data de Preenchimento *
            </Label>
            <Input
              id="anamnese_data"
              type="date"
              value={dataPreenchimento}
              onChange={(e) => setDataPreenchimento(e.target.value)}
              className="mt-1 w-40 text-xs sm:text-sm"
            />
          </div>

          <AnamneseFormFields respostas={respostas} onChange={setResposta} />
        </div>

        <DialogFooter className="p-4 pt-3 border-t border-slate-100 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
            disabled={saving}
          >
            {saving ? 'Salvando...' : isEdicao ? 'Salvar Alterações' : 'Salvar Anamnese'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
