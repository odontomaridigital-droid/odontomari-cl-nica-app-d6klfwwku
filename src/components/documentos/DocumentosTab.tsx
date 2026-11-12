import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Plus, Printer, Send, Eye, Download } from 'lucide-react'
import { DocumentoEmitido, DocumentoModelo } from '@/types'
import { formatDateBr, createWhatsAppUrl } from '@/lib/formatters'
import { gerarPdfDocumento, renderizarModelo } from '@/lib/documentoPdf'
import { BotaoDitar } from '@/components/voz/BotaoDitar'
import { documentosEmitidosService, documentosModelosService } from '@/services/clinica'
import { useAuth } from '@/contexts/AuthContext'

interface DocumentosTabProps {
  documentos: DocumentoEmitido[]
  isAdmin: boolean
  pacienteId: string
  pacienteNome: string
  pacienteTelefone: string
  autorId?: string
  onSaved: () => void
  onError: (title: string, message: string) => void
}

const CATEGORIAS: Record<string, string> = {
  pos_cirurgico: 'Pós-cirúrgico',
  pos_operatorio: 'Pós-operatório',
  orientacao: 'Orientação',
  atestado: 'Atestado',
  declaracao: 'Declaração',
  termo: 'Termo',
  outro: 'Outro',
}

/**
 * Aba "Documentos" da ficha do paciente: emite a partir de um modelo, imprime,
 * baixa em PDF e envia o texto pelo WhatsApp.
 */
export const DocumentosTab: React.FC<DocumentosTabProps> = ({
  documentos,
  isAdmin,
  pacienteId,
  pacienteNome,
  pacienteTelefone,
  autorId,
  onSaved,
  onError,
}) => {
  const { user } = useAuth()
  const [modelos, setModelos] = useState<DocumentoModelo[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)
  const [dialogAberto, setDialogAberto] = useState<boolean>(false)
  const [modeloId, setModeloId] = useState<string>('')
  const [procedimento, setProcedimento] = useState<string>('')
  const [titulo, setTitulo] = useState<string>('')
  const [categoria, setCategoria] = useState<string>('pos_cirurgico')
  const [corpo, setCorpo] = useState<string>('')
  const [data, setData] = useState<string>(new Date().toISOString().split('T')[0])
  const [salvando, setSalvando] = useState<boolean>(false)
  const [visualizando, setVisualizando] = useState<DocumentoEmitido | null>(null)

  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      setCarregando(true)
      try {
        const [lista, cfg] = await Promise.all([
          documentosModelosService.getAll(),
          import('@/services/clinica').then((m) => m.configuracoesService.getConfigs()),
        ])
        if (!vivo) return
        setModelos(lista)
        setConfig(cfg)
      } catch (err: any) {
        onError('Erro ao carregar modelos', err?.message || 'Tente novamente.')
      } finally {
        if (vivo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      vivo = false
    }
  }, [])

  const modelosAgrupados = useMemo(() => {
    const grupos: Record<string, DocumentoModelo[]> = {}
    for (const m of modelos) {
      const k = m.categoria || 'outro'
      grupos[k] = [...(grupos[k] || []), m]
    }
    return grupos
  }, [modelos])

  const aplicarModelo = (id: string) => {
    const modelo = modelos.find((m) => m.id === id)
    if (!modelo) return
    setModeloId(id)
    setTitulo(modelo.titulo)
    setCategoria(modelo.categoria)
    setCorpo(
      renderizarModelo(modelo.corpo, {
        pacienteNome,
        data,
        procedimento,
        config,
      }),
    )
  }

  const abrirNovo = () => {
    if (!isAdmin) {
      onError(
        'Acesso Restrito',
        'Apenas o dentista / administrador pode emitir documentos. A recepção pode visualizar, imprimir e enviar.',
      )
      return
    }
    setModeloId('')
    setTitulo('')
    setCorpo('')
    setProcedimento('')
    setData(new Date().toISOString().split('T')[0])
    setDialogAberto(true)
  }

  const salvar = async () => {
    if (!titulo.trim() || !corpo.trim()) {
      onError('Campos obrigatórios', 'Informe o título e o conteúdo do documento.')
      return
    }
    setSalvando(true)
    try {
      await documentosEmitidosService.create({
        paciente: pacienteId,
        modelo: modeloId || undefined,
        titulo: titulo.trim(),
        categoria,
        corpo: corpo.trim(),
        autor: autorId,
        data,
      })
      setDialogAberto(false)
      onSaved()
    } catch (err: any) {
      onError('Erro ao emitir documento', err?.message || 'Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const baixarPdf = async (d: DocumentoEmitido) => {
    try {
      await gerarPdfDocumento(
        { titulo: d.titulo, corpo: d.corpo, data: d.data },
        pacienteNome,
        config,
      )
    } catch (err: any) {
      onError('Erro ao gerar PDF', err?.message || 'Tente novamente.')
    }
  }

  const imprimir = async (d: DocumentoEmitido) => {
    // Gera o PDF e abre na mesma aba para impressão; o próprio gesto do usuário
    // autoriza a janela, então geramos em memória e abrimos um blob.
    try {
      const janela = window.open('', '_blank')
      await gerarPdfDocumento(
        { titulo: d.titulo, corpo: d.corpo, data: d.data },
        pacienteNome,
        config,
      )
      // O jsPDF dispara o download; para impressão direta o usuário abre o PDF.
      janela?.close()
    } catch (err: any) {
      onError('Erro ao imprimir', err?.message || 'Tente novamente.')
    }
  }

  const enviarWhatsApp = async (d: DocumentoEmitido) => {
    if (!pacienteTelefone) {
      onError('Sem telefone', 'Paciente não possui número de WhatsApp cadastrado.')
      return
    }
    const mensagem = `*${d.titulo}*\n\n${d.corpo}\n\n_${config?.nome_clinica || 'Clínica Odontomari'}_`
    window.open(createWhatsAppUrl(pacienteTelefone, mensagem), '_blank')
    try {
      await documentosEmitidosService.marcarEnviado(d.id, 'whatsapp_texto')
      onSaved()
    } catch {
      // o envio em si já aconteceu; falha ao registrar não deve travar
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Orientações, atestados e declarações prontos para imprimir, baixar em PDF ou enviar pelo
          WhatsApp.
        </p>
        {isAdmin && (
          <Button
            size="sm"
            className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs shrink-0"
            onClick={abrirNovo}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo documento
          </Button>
        )}
      </div>

      {documentos.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 shadow-none text-center p-8 bg-white">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-medium text-slate-700 text-sm">Nenhum documento emitido</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Emita orientações pós-cirúrgicas, atestados e declarações a partir dos modelos da clínica.'
              : 'Nenhum documento emitido pelo dentista até o momento.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {documentos.map((d) => (
            <Card key={d.id} className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-3 pb-1.5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className="bg-marca-vermelho-claro text-marca-vermelho-escuro hover:bg-marca-vermelho-claro text-[11px] shrink-0">
                    {formatDateBr(d.data)}
                  </Badge>
                  <span className="text-sm font-semibold text-slate-900 truncate">{d.titulo}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] border-slate-300 text-slate-500 shrink-0"
                >
                  {CATEGORIAS[d.categoria] || d.categoria}
                </Badge>
              </CardHeader>
              <CardContent className="p-3">
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-2.5 whitespace-pre-line">
                  {d.corpo.slice(0, 180)}
                  {d.corpo.length > 180 ? '…' : ''}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => setVisualizando(d)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => baixarPdf(d)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={() => imprimir(d)}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Imprimir
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => enviarWhatsApp(d)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    WhatsApp
                  </Button>
                  {d.enviado_em && (
                    <span className="text-[10px] text-emerald-700 ml-1">
                      Enviado {formatDateBr(d.enviado_em)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de emissão */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5 text-marca-vermelho" />
              Emitir documento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paciente: {pacienteNome}. Escolha um modelo e ajuste o texto antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Modelo</Label>
                <Select value={modeloId} onValueChange={aplicarModelo}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue placeholder={carregando ? 'Carregando...' : 'Escolha um modelo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelosAgrupados).map(([cat, lista]) => (
                      <React.Fragment key={cat}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {CATEGORIAS[cat] || cat}
                        </div>
                        {lista.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.titulo}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-data" className="text-xs">
                  Data
                </Label>
                <Input
                  id="doc-data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="doc-titulo" className="text-xs">
                  Título *
                </Label>
                <Input
                  id="doc-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Cuidados pós-extração"
                  className="mt-1 text-xs sm:text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="mt-1 text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIAS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="doc-proc" className="text-xs">
                Procedimento <span className="text-slate-400 font-normal">(usado no atestado)</span>
              </Label>
              <Input
                id="doc-proc"
                value={procedimento}
                onChange={(e) => setProcedimento(e.target.value)}
                placeholder="Ex.: exodontia do dente 38"
                className="mt-1 text-xs sm:text-sm h-9"
              />
            </div>

            <div>
              <Label htmlFor="doc-corpo" className="text-xs">
                Conteúdo *
              </Label>
              <div className="relative mt-1">
                <Textarea
                  id="doc-corpo"
                  rows={12}
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                  className="text-xs sm:text-sm font-sans pr-10"
                  placeholder="Escolha um modelo acima ou escreva o documento do zero."
                />
                <div className="absolute right-1.5 top-1.5">
                  <BotaoDitar
                    titulo="Ditar o documento"
                    onErro={(m) => onError('Ditado', m)}
                    onTexto={(texto) =>
                      setCorpo((atual) => (atual.trim() ? `${atual.trimEnd()} ${texto}` : texto))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogAberto(false)}
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
              {salvando ? 'Salvando...' : 'Emitir e salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualização */}
      <Dialog open={Boolean(visualizando)} onOpenChange={(o) => !o && setVisualizando(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100">
            <DialogTitle className="text-base">{visualizando?.titulo}</DialogTitle>
            <DialogDescription className="text-xs">
              {pacienteNome} • {formatDateBr(visualizando?.data || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {visualizando?.corpo}
            </p>
          </div>
          <DialogFooter className="p-3 border-t border-slate-100">
            {visualizando && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => baixarPdf(visualizando)}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Baixar PDF
              </Button>
            )}
            {visualizando && (
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => enviarWhatsApp(visualizando)}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Enviar por WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
