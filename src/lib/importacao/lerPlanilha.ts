import * as XLSX from 'xlsx'

/** Uma aba lida da planilha enviada pela usuária. */
export interface PlanilhaAba {
  nome: string
  /** Matriz de linhas já convertidas: linha 0 = cabeçalhos, demais = valores brutos */
  matriz: unknown[][]
  /** Matriz como strings (para prévia e validação) */
  linhas: string[][]
  colunas: string[]
  totalLinhas: number
}

/** Resultado da leitura do arquivo .xlsx */
export interface PlanilhaArquivo {
  nomeArquivo: string
  abas: PlanilhaAba[]
}

/**
 * Lê um arquivo .xlsx no navegador (SheetJS) e devolve todas as abas.
 * Nada é enviado a servidor algum nesta etapa — o arquivo só é processado localmente.
 */
export async function lerPlanilha(file: File): Promise<PlanilhaArquivo> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { cellDates: false, raw: false })
  const abas: PlanilhaAba[] = []

  for (const nome of wb.SheetNames) {
    const sheet = wb.Sheets[nome]
    if (!sheet) continue
    // defval:'' garante células vazias como '' (sem buracos na matriz)
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    })
    // Remove linhas totalmente vazias do final/intermediárias
    const matrizLimpa = matriz.filter((linha) =>
      linha.some((cel) => String(cel ?? '').trim() !== ''),
    )
    if (matrizLimpa.length === 0) {
      abas.push({ nome, matriz: [], linhas: [], colunas: [], totalLinhas: 0 })
      continue
    }
    const cabecalho = matrizLimpa[0].map((c, i) => {
      const txt = String(c ?? '').trim()
      return txt || `Coluna ${i + 1}`
    })
    const linhas = matrizLimpa
      .slice(1)
      .map((linha) => cabecalho.map((_, i) => String(linha[i] ?? '').trim()))
    abas.push({
      nome,
      matriz: matrizLimpa,
      linhas,
      colunas: cabecalho,
      totalLinhas: linhas.length,
    })
  }

  return { nomeArquivo: file.name, abas }
}
