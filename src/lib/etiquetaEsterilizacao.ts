import { jsPDF } from 'jspdf'
import JsBarcode from 'jsbarcode'
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
 * O código de barras é desenhado pela JsBarcode (biblioteca testada). Antes
 * eu havia escrito a tabela Code 128 à mão e ela tinha 107 entradas quando o
 * padrão tem 106 — gerava barras ilegíveis. Nunca escrever tabela de código
 * de barras à mão: usar biblioteca.
 *
 * Tamanho padrão: 50 x 30 mm (o mais usado em odontologia; cabe no envelope
 * de papel grau cirúrgico). Funciona em impressora térmica e comum.
 */

/**
 * Renderiza o código de barras Code 128 como PNG (data URL), pronto para o
 * jsPDF desenhar. Altura em pixels proporcional à altura física desejada.
 */
function codigoBarrasPng(texto: string, alturaPx: number): { dataUrl: string; proporcao: number } {
  const canvas = document.createElement('canvas')
  try {
    // width: 4 = 4px por módulo. Resolução alta de propósito: no PDF a imagem
    // é reduzida, e reduzir mantém as barras nítidas. Ampliar borra — foi o
    // que quebrou a leitura na primeira versão (eu redimensionava o canvas).
    JsBarcode(canvas, texto, {
      format: 'CODE128',
      width: 4,
      height: alturaPx,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return {
      dataUrl: canvas.toDataURL('image/png'),
      proporcao: canvas.width / canvas.height,
    }
  } catch {
    // lote com caractere que o Code 128B não aceita: a etiqueta sai só com o
    // lote em texto, sem barras, em vez de falhar.
    return { dataUrl: '', proporcao: 0 }
  }
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

  // gera o código uma vez: é o mesmo lote para todas as etiquetas
  const barras = codigoBarrasPng(carga.lote, 160)

  const desenhar = (pacote: PacoteEsterilizado) => {
    const x0 = 2
    const larguraUtil = W - 4

    // borda leve para recorte
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

    // I, III e complementos
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

    // código de barras — largura calculada pela proporção natural do código,
    // centralizada na etiqueta, sem esticar nem espremer as barras.
    if (barras.dataUrl && barras.proporcao > 0) {
      const alturaBarra = 6.2
      let larguraBarra = alturaBarra * barras.proporcao
      if (larguraBarra > larguraUtil) larguraBarra = larguraUtil
      const xBarra = x0 + (larguraUtil - larguraBarra) / 2
      doc.addImage(barras.dataUrl, 'PNG', xBarra, 18.2, larguraBarra, alturaBarra)
    }

    // lote em texto legível caso o leitor falhe
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.4)
    doc.setTextColor(40, 45, 50)
    doc.text(carga.lote, x0 + larguraUtil / 2, 28, { align: 'center' })
  }

  const lista: PacoteEsterilizado[] =
    pacotes.length > 0
      ? pacotes
      : [
          {
            id: '',
            esterilizacao: carga.id,
            identificacao: 'Kit odontológico',
            data_esterilizacao: carga.data,
          } as PacoteEsterilizado,
        ]

  lista.forEach((p, i) => {
    if (i > 0) doc.addPage()
    desenhar(p)
  })

  doc.save(`Etiquetas-${carga.lote}.pdf`)
}
