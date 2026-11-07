import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Printer, MessageCircle, CheckCircle2 } from 'lucide-react'
import { Receita } from '@/types'
import { formatDateBr } from '@/lib/formatters'

interface ReceitaPosSalvarDialogProps {
  receita: Receita | null
  pacienteNome: string
  onImprimir: (receita: Receita) => void
  onWhatsApp: (receita: Receita) => void
  onFechar: () => void
}

/**
 * Pergunta exibida logo após salvar uma receita: imprimir, enviar pelo WhatsApp
 * ou apenas fechar (a receita já fica salva no histórico).
 */
export const ReceitaPosSalvarDialog: React.FC<ReceitaPosSalvarDialogProps> = ({
  receita,
  pacienteNome,
  onImprimir,
  onWhatsApp,
  onFechar,
}) => {
  return (
    <Dialog open={Boolean(receita)} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Receita registrada
          </DialogTitle>
          <DialogDescription className="text-xs">
            A receita de {pacienteNome} de {formatDateBr(receita?.data)} foi salva no prontuário. O
            que deseja fazer agora?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="text-xs h-10"
            onClick={() => receita && onImprimir(receita)}
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir
          </Button>
          <Button
            type="button"
            className="bg-green-600 hover:bg-green-700 text-white text-xs h-10"
            onClick={() => receita && onWhatsApp(receita)}
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Enviar WhatsApp
          </Button>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" className="text-xs" onClick={onFechar}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
