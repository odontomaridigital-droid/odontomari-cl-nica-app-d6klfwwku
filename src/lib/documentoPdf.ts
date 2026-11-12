import { jsPDF } from 'jspdf'
import logoUrl from '@/assets/odontomari-logo-novo-87a22.png'
import { ClinicaConfig } from '@/types'
import { formatDateBr } from '@/lib/formatters'

/**
 * Geração do PDF dos documentos da clínica (orientações pós-cirúrgicas,
 * atestados, declarações). Mesmo visual do receituário: cabeçalho com a logo,
 * corpo em parágrafos e rodapé com o contato da clínica.
 */

const VERMELHO: [number, number, number] = [200, 32, 46]
const GRAFITE: [number, number, number] = [43, 47, 51]
const CINZA: [number, number, number] = [75, 79, 84]
const CINZA_CLARO: [number, number, number] = [148, 152, 158]

const MARGEM = 18
const LARGURA_UTIL = 210 - MARGEM * 2

export function nomeArquivoDocumento(titulo: string, pacienteNome: string, data?: string): string {
  const limpar = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const dia = (data || '').split(' ')[0].split('T')[0] || 'sem-data'
  return `${limpar(titulo) || 'Documento'}-${limpar(pacienteNome) || 'Paciente'}-${dia}.pdf`
}

/** Quebra o texto respeitando a largura útil, aceitando \n como quebra explícita. */
function quebrarLinhas(doc: jsPDF, texto: string, largura: number): string[] {
  const linhas: string[] = []
  for (const paragrafo of texto.split(/\r?\n/)) {
    if (!paragrafo.trim()) {
      linhas.push('')
      continue
    }
    const pedacos = doc.splitTextToSize(paragrafo, largura) as string[]
    linhas.push(...pedacos)
  }
  return linhas
}

export async function gerarPdfDocumento(
  doc_: { titulo: string; corpo: string; data: string },
  pacienteNome: string,
  config?: Pick<
    ClinicaConfig,
    'nome_clinica' | 'telefone_clinica' | 'dentista_nome' | 'dentista_cro'
  >,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const nomeClinica = config?.nome_clinica || 'Clínica Odontomari'

  // ===== Logo (só a parte superior, sem a faixa do slogan embutido) =====
  const FRACAO_SLOGAN = 0.18
  const ALTURA_LOGO = 18
  let y = MARGEM - 4
  let logoOk = false
  try {
    const img = new Image()
    img.src = logoUrl
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
    })
    if (img.complete && img.naturalWidth > 0) {
      const alturaDesenhada = ALTURA_LOGO / (1 - FRACAO_SLOGAN)
      const larguraLogo = alturaDesenhada * (img.naturalWidth / img.naturalHeight)
      const alturaPx = Math.max(1, Math.round(img.naturalHeight * (1 - FRACAO_SLOGAN)))
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = alturaPx
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, img.naturalWidth, alturaPx, 0, 0, img.naturalWidth, alturaPx)
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', MARGEM, y, larguraLogo, ALTURA_LOGO)
        logoOk = true
      }
    }
  } catch {
    // segue sem logo
  }

  if (!logoOk) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...VERMELHO)
    doc.text(nomeClinica, MARGEM, y + 8)
  }

  // ===== Cabeçalho direito =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  if (config?.telefone_clinica) {
    doc.text(config.telefone_clinica, 210 - MARGEM, y + 4, { align: 'right' })
  }
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...VERMELHO)
  doc.text('semeando sorrisos', 210 - MARGEM, y + 10, { align: 'right' })

  // Linha separadora
  const ySep = y + ALTURA_LOGO + 5
  doc.setDrawColor(...VERMELHO)
  doc.setLineWidth(0.7)
  doc.line(MARGEM, ySep, 210 - MARGEM, ySep)

  // ===== Título e identificação =====
  y = ySep + 11
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...GRAFITE)
  const tituloLinhas = doc.splitTextToSize(doc_.titulo, LARGURA_UTIL) as string[]
  doc.text(tituloLinhas, MARGEM, y)
  y += tituloLinhas.length * 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA_CLARO)
  doc.text(`Paciente: ${pacienteNome || '—'}`, MARGEM, y)
  doc.text(`Data: ${formatDateBr(doc_.data) || '—'}`, 210 - MARGEM, y, { align: 'right' })
  y += 8

  // ===== Corpo =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...CINZA)
  const linhas = quebrarLinhas(doc, doc_.corpo, LARGURA_UTIL)
  const alturaLinha = 5.4
  for (const linha of linhas) {
    if (y > 272) {
      doc.addPage()
      y = MARGEM
    }
    if (linha) doc.text(linha, MARGEM, y)
    y += alturaLinha
  }

  // ===== Assinatura =====
  if (y > 245) {
    doc.addPage()
    y = MARGEM + 10
  }
  y += 14
  const larguraLinha = 60
  const xLinha = 105 - larguraLinha / 2
  doc.setDrawColor(120, 124, 130)
  doc.setLineWidth(0.3)
  doc.line(xLinha, y, xLinha + larguraLinha, y)
  if (config?.dentista_nome) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...GRAFITE)
    doc.text(config.dentista_nome, 105, y + 5, { align: 'center' })
  }
  if (config?.dentista_cro) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text(config.dentista_cro, 105, y + 10, { align: 'center' })
  }

  // ===== Rodapé =====
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...CINZA_CLARO)
  const rodape = config?.telefone_clinica
    ? `${nomeClinica} — ${config.telefone_clinica}`
    : nomeClinica
  doc.text(rodape, 105, 288, { align: 'center' })

  doc.save(nomeArquivoDocumento(doc_.titulo, pacienteNome, doc_.data))
}

/** Substitui os placeholders do modelo pelos dados reais. */
export function renderizarModelo(
  corpo: string,
  dados: {
    pacienteNome: string
    data: string
    procedimento?: string
    config?: Pick<
      ClinicaConfig,
      'nome_clinica' | 'telefone_clinica' | 'dentista_nome' | 'dentista_cro'
    >
  },
): string {
  const primeiroNome = (dados.pacienteNome || '').split(' ')[0] || dados.pacienteNome || ''
  return (corpo || '')
    .replace(/\{paciente\}/g, dados.pacienteNome || '')
    .replace(/\{primeiro_nome\}/g, primeiroNome)
    .replace(/\{data\}/g, formatDateBr(dados.data))
    .replace(/\{procedimento\}/g, dados.procedimento || '')
    .replace(/\{clinica\}/g, dados.config?.nome_clinica || 'Clínica Odontomari')
    .replace(/\{telefone\}/g, dados.config?.telefone_clinica || '')
    .replace(/\{dentista\}/g, dados.config?.dentista_nome || '')
    .replace(/\{cro\}/g, dados.config?.dentista_cro || '')
}
