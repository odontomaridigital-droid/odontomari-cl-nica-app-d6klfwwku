/** Normaliza um texto para comparação de nomes de colunas (sem acento, minúsculo). */
export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
