import { jsPDF } from 'jspdf'
import { Esterilizacao, PacoteEsterilizado } from '@/services/esterilizacao'
import { formatDateBr } from '@/lib/formatters'

/**
 * Etiqueta de esterilização — art. 81 da RDC Anvisa 1002/2025.
 *
 * Campos obrigatórios:
 *   I  - data da esterilização
 *   II - nome do responsável pelo preparo
 *   III- lote da carga
 *   IV - identificação dos DM incluídos (se a embalagem não for transparente)
 *
 * Acrescentamos a validade e o código de barras com o lote. O código NÃO é
 * exigido pela norma (P&R Anvisa 3.3.21) — está aqui porque no atendimento a
 * recepção bipa o pacote e o lote entra sozinho, sem digitação manual.
 *
 * Tamanho padrão: 50 x 30 mm (o mais usado em odontologia; cabe no envelope
 * de papel grau cirúrgico). Funciona em térmica e em impressora comum.
 */

/** Tabela Code 128B: 11 módulos por símbolo, larguras alternadas barra/espaço. */
const TABELA_CODE128: number[][] = [
  [2, 1, 2, 2, 2, 2],
  [2, 2, 2, 1, 2, 2],
  [2, 2, 2, 2, 2, 1],
  [1, 2, 1, 2, 2, 3],
  [1, 2, 1, 3, 2, 2],
  [1, 3, 1, 2, 2, 2],
  [1, 2, 2, 2, 1, 3],
  [1, 2, 2, 3, 1, 2],
  [1, 3, 2, 2, 1, 2],
  [2, 2, 1, 2, 1, 3],
  [2, 2, 1, 3, 1, 2],
  [2, 3, 1, 2, 1, 2],
  [1, 1, 2, 2, 3, 2],
  [1, 2, 2, 1, 3, 2],
  [1, 2, 2, 2, 3, 1],
  [1, 1, 3, 2, 2, 2],
  [1, 2, 3, 1, 2, 2],
  [1, 2, 3, 2, 2, 1],
  [2, 2, 3, 2, 1, 1],
  [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1],
  [2, 1, 3, 2, 1, 2],
  [2, 2, 3, 1, 1, 2],
  [3, 1, 2, 1, 3, 1],
  [3, 1, 1, 2, 2, 2],
  [3, 2, 1, 1, 2, 2],
  [3, 2, 1, 2, 2, 1],
  [3, 1, 2, 2, 1, 2],
  [3, 2, 2, 1, 1, 2],
  [3, 2, 2, 2, 1, 1],
  [2, 1, 2, 1, 2, 3],
  [2, 1, 2, 3, 2, 1],
  [2, 3, 2, 1, 2, 1],
  [1, 1, 1, 3, 2, 3],
  [1, 3, 1, 1, 2, 3],
  [1, 3, 1, 3, 2, 1],
  [1, 1, 2, 3, 1, 3],
  [1, 3, 2, 1, 1, 3],
  [1, 3, 2, 3, 1, 1],
  [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3],
  [2, 3, 1, 3, 1, 1],
  [1, 1, 2, 1, 3, 3],
  [1, 1, 2, 3, 3, 1],
  [1, 3, 2, 1, 3, 1],
  [1, 1, 3, 1, 2, 3],
  [1, 1, 3, 3, 2, 1],
  [1, 3, 3, 1, 2, 1],
  [3, 1, 3, 1, 2, 1],
  [2, 1, 1, 3, 3, 1],
  [2, 3, 1, 1, 3, 1],
  [2, 1, 3, 1, 1, 3],
  [2, 1, 3, 3, 1, 1],
  [2, 1, 3, 1, 3, 1],
  [3, 1, 1, 1, 2, 3],
  [3, 1, 1, 3, 2, 1],
  [3, 3, 1, 1, 2, 1],
  [3, 1, 2, 1, 1, 3],
  [3, 1, 2, 3, 1, 1],
  [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1],
  [2, 2, 1, 4, 1, 1],
  [4, 3, 1, 1, 1, 1],
  [1, 1, 1, 2, 2, 4],
  [1, 1, 1, 4, 2, 2],
  [1, 2, 1, 1, 2, 4],
  [1, 2, 1, 4, 2, 1],
  [1, 4, 1, 1, 2, 2],
  [1, 4, 1, 2, 2, 1],
  [1, 1, 2, 2, 1, 4],
  [1, 1, 2, 4, 1, 2],
  [1, 2, 2, 1, 1, 4],
  [1, 2, 2, 4, 1, 1],
  [1, 4, 2, 1, 1, 2],
  [1, 4, 2, 2, 1, 1],
  [2, 4, 1, 2, 1, 1],
  [2, 2, 1, 1, 1, 4],
  [4, 1, 3, 1, 1, 1],
  [2, 4, 1, 1, 1, 2],
  [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2],
  [1, 2, 1, 1, 4, 2],
  [1, 2, 1, 2, 4, 1],
  [1, 1, 4, 2, 1, 2],
  [1, 2, 4, 1, 1, 2],
  [1, 2, 4, 2, 1, 1],
  [4, 1, 1, 2, 1, 2],
  [4, 2, 1, 1, 1, 2],
  [4, 2, 1, 2, 1, 1],
  [2, 1, 2, 1, 4, 1],
  [2, 1, 4, 1, 2, 1],
  [4, 1, 2, 1, 2, 1],
  [1, 1, 1, 1, 4, 3],
  [1, 1, 1, 3, 4, 1],
  [1, 3, 1, 1, 4, 1],
  [1, 1, 4, 1, 1, 3],
  [1, 1, 4, 3, 1, 1],
  [4, 1, 1, 1, 1, 3],
  [4, 1, 1, 3, 1, 1],
  [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1],
  [3, 1, 1, 1, 4, 1],
  [4, 1, 1, 1, 3, 1],
  [2, 1, 1, 4, 1, 2],
  [2, 1, 1, 2, 1, 4],
  [2, 1, 1, 2, 3, 2],
  [2, 3, 3, 1, 1, 1],
]

const START_B = [2, 1, 1, 2, 1, 4]
const STOP = [2, 3, 3, 1, 1, 1, 2]

/** Desenha o Code 128B do texto, ajustado a uma largura máxima. */
function desenharCodigoBarras(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  altura: number,
  larguraMaxima: number,
) {
  const valores: number[] = []
  for (const ch of texto) {
    const code = ch.charCodeAt(0)
    valores.push(code >= 32 && code <= 126 ? code - 32 : 0)
  }
  // checksum do Code 128: 104 (start) + Σ(valor × posição), módulo 103
  let soma = 104
  valores.forEach((v, i) => {
    soma += v * (i + 1)
  })
  const checksum = soma % 103

  const simbolos: number[][] = [START_B]
  valores.forEach((v) => simbolos.push(TABELA_CODE128[v] || TABELA_CODE128[0]))
  simbolos.push(TABELA_CODE128[checksum])
  simbolos.push(STOP)

  const modulos = simbolos.reduce((acc, s) => acc + s.reduce((a, b) => a + b, 0), 0)
  const m = larguraMaxima / modulos

  doc.setFillColor(0, 0, 0)
  let cx = x
  simbolos.forEach((padrao) => {
    padrao.forEach((largura, j) => {
      const w = largura * m
      if (j % 2 === 0) doc.rect(cx, y, w, altura, 'F')
      cx += w
    })
  })
}

export interface OpcoesEtiqueta {
  /** 1 = rolo de 50 mm (padrão); 2 = folha com duas etiquetas lado a lado */
  colunas?: 1 | 2
  /** Tamanho da etiqueta em mm (padrão 50 x 30) */
  largura?: number
  altura?: number
}

/**
 * Gera o PDF das etiquetas de um lote — uma etiqueta por pacote.
 * Sem pacotes, gera uma etiqueta só com os dados da carga.
 */
export async function gerarEtiquetas(
  carga: Esterilizacao,
  pacotes: PacoteEsterilizado[],
  opcoes: OpcoesEtiqueta = {},
): Promise<void> {
  const colunas = opcoes.colunas || 1
  const W = opcoes.largura || 50
  const H = opcoes.altura || 30
  const larguraPagina = colunas === 2 ? W * 2 : W

  const doc = new jsPDF({
    unit: 'mm',
    format: [larguraPagina, H],
    orientation: 'landscape',
  })

  const desenhar = (pacote: PacoteEsterilizado) => {
    const x0 = 2
    const larguraUtil = W - 4

    // borda para recorte
    doc.setDrawColor(205, 205, 205)
    doc.setLineWidth(0.1)
    doc.rect(0.5, 0.5, W - 1, H - 1)

    // IV — identificação do conteúdo
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(15, 20, 25)
    const conteudo =
      pacote.identificacao.length > 30
        ? pacote.identificacao.slice(0, 29) + '…'
        : pacote.identificacao
    doc.text(conteudo, x0, 4.8)

    // I, III e os complementos: data, lote, validade e responsável
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.6)
    doc.setTextColor(40, 45, 50)
    doc.text(`Lote: ${carga.lote}`, x0, 8.6)
    doc.text(`Esterilizado: ${formatDateBr(pacote.data_esterilizacao)}`, x0, 11.4)
    if (pacote.validade) {
      doc.text(`Validade: ${formatDateBr(pacote.validade)}`, x0, 14.2)
    }
    // II — responsável pelo preparo
    const resp = (carga.operador || '').slice(0, 30)
    doc.text(`Responsável: ${resp}`, x0, 17)

    // código de barras do lote
    desenharCodigoBarras(doc, carga.lote, x0, 18.6, 6.2, larguraUtil)

    // lote em texto legível, caso o leitor falhe
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(40, 45, 50)
    doc.text(carga.lote, x0 + larguraUtil / 2, 28, { align: 'center' })
  }

  const lista =
    pacotes.length > 0
      ? pacotes
      : ([
          {
            id: '',
            esterilizacao: carga.id,
            identificacao: 'Kit odontológico',
            data_esterilizacao: carga.data,
            validade: undefined,
          } as PacoteEsterilizado,
        ] as PacoteEsterilizado[])

  lista.forEach((p, i) => {
    if (i > 0) doc.addPage()
    desenhar(p)
  })

  doc.save(`Etiquetas-${carga.lote}.pdf`)
}
