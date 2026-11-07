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
import { Printer, MessageCircle, CheckCircle2, Download } from 'lucide-react'
import { Receita } from '@/types'
import { formatDateBr } from '@/lib/formatters'

interface ReceitaPosSalvarDialogProps {
  receita: Receita | null
  pacienteNome: string
  onImprimir: (receita: Receita) => void
  onWhatsApp: (receita: Receita) => void
  onBaixarPdf?: (receita: Receita) => void
  onFechar: () => void
}

/**
 * Pergunta exibida logo após salvar uma receita: imprimir, enviar pelo WhatsApp
 * (baixa o PDF e abre a conversa), baixar só o PDF ou apenas fechar
 * (a receita já fica salva no histórico).
 */
export const ReceitaPosSalvarDialog: React.FC<ReceitaPosSalvarDialogProps> = ({
  receita,
  pacienteNome,
  onImprimir,
  onWhatsApp,
  onBaixarPdf,
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

        <p className="text-[11px] text-slate-500 -mt-1">
          No WhatsApp, o PDF da receita é baixado automaticamente para você anexar na conversa que
          vai abrir — a mensagem curta já sai pronta.
        </p>

        {onBaixarPdf && (
          <Button
            type="button"
            variant="outline"
            className="w-full text-xs h-10"
            onClick={() => receita && onBaixarPdf(receita)}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Baixar PDF
          </Button>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" className="text-xs" onClick={onFechar}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
