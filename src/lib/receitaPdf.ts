import { jsPDF } from 'jspdf'
import logoUrl from '@/assets/odontomari-logo-novo-87a22.png'
import { Receita, ClinicaConfig } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import { normalizarItensReceita } from '@/lib/receitas'

/**
 * Geração do PDF do receituário (jsPDF puro — texto nítido, download funciona
 * em desktop e mobile). O visual segue o ReceitaDocumento: cabeçalho com a logo
 * da clínica, dados do paciente, itens numerados, orientações e assinatura.
 */

const VERMELHO: [number, number, number] = [200, 32, 46] // marca-vermelho #C8202E
const VERMELHO_ESCURO: [number, number, number] = [163, 26, 38] // #A31A26
const VERMELHO_CLARO: [number, number, number] = [251, 233, 235] // #FBE9EB
const GRAFITE: [number, number, number] = [43, 47, 51] // #2B2F33
const CINZA: [number, number, number] = [75, 79, 84] // #4B4F54
const CINZA_CLARO: [number, number, number] = [148, 152, 158]

const MARGEM = 16
const LARGURA_UTIL = 210 - MARGEM * 2

/** Nome amigável do arquivo: Receita-NomePaciente-AAAA-MM-DD.pdf */
export function nomeArquivoReceita(pacienteNome: string, data?: string): string {
  const slug = (pacienteNome || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const dia = (data || '').split(' ')[0].split('T')[0] || 'sem-data'
  return `Receita-${slug}-${dia}.pdf`
}

function textoSeguro(doc: jsPDF, texto: string, largura: number): string[] {
  return doc.splitTextToSize(texto, largura) as string[]
}

function quebrarPalavra(doc: jsPDF, texto: string, largura: number): string[] {
  const linhas: string[] = []
  for (const bruta of texto.split(/\r?\n/)) {
    let atual = ''
    for (const palavra of bruta.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra
      if (doc.getStringUnitWidth(tentativa) * doc.getFontSize() <= largura) {
        atual = tentativa
      } else if (atual) {
        linhas.push(atual)
        atual = palavra
      } else {
        // palavra maior que a linha: corta caractere a caractere
        let pedaco = ''
        for (const ch of palavra) {
          if (doc.getStringUnitWidth(pedaco + ch) * doc.getFontSize() <= largura) {
            pedaco += ch
          } else {
            linhas.push(pedaco)
            pedaco = ch
          }
        }
        atual = pedaco
      }
    }
    linhas.push(atual)
  }
  return linhas
}

/** Desenha o texto respeitando a largura útil; devolve o y depois da última linha. */
function desenharParagrafo(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  largura: number,
  alturaLinha: number,
): number {
  let yy = y
  for (const linha of quebrarPalavra(doc, texto, largura)) {
    doc.text(linha, x, yy)
    yy += alturaLinha
  }
  return yy
}

export async function gerarPdfReceita(
  receita: Receita,
  pacienteNome: string,
  config?: Pick<ClinicaConfig, 'nome_clinica' | 'dentista_nome' | 'dentista_cro'>,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const itens = normalizarItensReceita(Array.isArray(receita.itens) ? receita.itens : [])
  const nomeClinica = config?.nome_clinica || 'Clínica Odontomari'

  // ===== logo (asset da marca) =====
  // PNG quadrado (409×505): a faixa inferior (~18%) contém o slogan embutido em
  // preto — recortamos desenhando só a porção superior, como o componente
  // OdontomariLogoCompleta faz via CSS overflow-hidden.
  try {
    const img = new Image()
    img.src = logoUrl
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve() // segue sem logo em vez de falhar
    })
    if (img.complete && img.naturalWidth > 0) {
      const fracaoSlogan = 0.18
      const alturaVisivel = 22
      const alturaDesenhada = alturaVisivel / (1 - fracaoSlogan)
      const larguraLogo = alturaDesenhada * (img.naturalWidth / img.naturalHeight)
      const pixelRatio = img.naturalHeight * fracaoSlogan
      const alturaPx = Math.max(1, Math.round(img.naturalHeight - pixelRatio))
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = alturaPx
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, img.naturalWidth, alturaPx, 0, 0, img.naturalWidth, alturaPx)
        const recortada = canvas.toDataURL('image/png')
        doc.addImage(recortada, 'PNG', MARGEM, MARGEM - 4, larguraLogo, alturaVisivel)
      }
    }
  } catch {
    // sem logo, o documento segue com o texto do cabeçalho
  }

  // ===== cabeçalho =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...GRAFITE)
  doc.text(nomeClinica, MARGEM, MARGEM + 24)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...VERMELHO)
  doc.text('semeando sorrisos', MARGEM, MARGEM + 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  doc.text('Receituário Odontológico', 210 - MARGEM, MARGEM + 20, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...VERMELHO)
  doc.text('Receita', 210 - MARGEM, MARGEM + 26, { align: 'right' })

  // faixa vermelha separadora
  doc.setDrawColor(...VERMELHO)
  doc.setLineWidth(0.8)
  doc.line(MARGEM, MARGEM + 35, 210 - MARGEM, MARGEM + 35)

  // ===== dados do paciente =====
  let y = MARGEM + 45
  doc.setFontSize(7)
  doc.setTextColor(...CINZA_CLARO)
  doc.setFont('helvetica', 'normal')
  doc.text('PACIENTE', MARGEM, y)
  doc.text('DATA DE EMISSÃO', 78, y)
  doc.text('EMITIDA POR', 210 - MARGEM, y, { align: 'right' })

  doc.setFontSize(10)
  doc.setTextColor(...GRAFITE)
  doc.setFont('helvetica', 'bold')
  doc.text(pacienteNome || '—', MARGEM, y + 5)
  doc.text(formatDateBr(receita.data) || '—', 78, y + 5)
  doc.text(
    receita.expand?.autor?.name || config?.dentista_nome || 'Dentista',
    210 - MARGEM,
    y + 5,
    { align: 'right' },
  )

  // ===== itens =====
  y += 14
  itens.forEach((item, i) => {
    // quebra de página
    if (y > 265) {
      doc.addPage()
      y = MARGEM
    }

    // número dentro de círculo claro
    doc.setFillColor(...VERMELHO_CLARO)
    doc.circle(MARGEM + 2.2, y - 1.4, 2.2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...VERMELHO_ESCURO)
    doc.text(String(i + 1), MARGEM + 2.2, y - 0.7, { align: 'center' })

    // nome + apresentação
    doc.setFontSize(11)
    doc.setTextColor(...GRAFITE)
    const nome = item.nome + (item.apresentacao ? ` — ${item.apresentacao}` : '')
    const linhasNome = textoSeguro(doc, nome, LARGURA_UTIL - 8)
    doc.text(linhasNome[0], MARGEM + 6, y)
    y += 5.5

    // posologia recuada
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...CINZA)
    y = desenharParagrafo(doc, item.posologia, MARGEM + 6, y, LARGURA_UTIL - 6, 4.8)
    y += 4
  })

  // ===== orientações gerais =====
  if (receita.orientacoes?.trim()) {
    if (y > 250) {
      doc.addPage()
      y = MARGEM
    }
    y += 2
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(MARGEM, y, 210 - MARGEM, y)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...CINZA_CLARO)
    doc.text('ORIENTAÇÕES GERAIS', MARGEM, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...CINZA)
    y = desenharParagrafo(doc, receita.orientacoes.trim(), MARGEM, y, LARGURA_UTIL, 4.8)
  }

  // ===== assinatura =====
  const nomeDentista = config?.dentista_nome || receita.expand?.autor?.name || 'Dentista'
  const cro = config?.dentista_cro
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAFITE)
  const larguraLinha = 56
  const xLinha = 105 - larguraLinha / 2
  if (y > 255) {
    doc.addPage()
    y = MARGEM + 10
  }
  doc.setDrawColor(120, 124, 130)
  doc.setLineWidth(0.3)
  doc.line(xLinha, y + 14, xLinha + larguraLinha, y + 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text(nomeDentista, 105, y + 19, { align: 'center' })
  if (cro) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text(cro, 105, y + 24, { align: 'center' })
  }

  // rodapé
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...CINZA_CLARO)
  doc.text('Clínica Odontomari — semeando sorrisos', 105, 288, { align: 'center' })

  doc.save(nomeArquivoReceita(pacienteNome, receita.data))
}
