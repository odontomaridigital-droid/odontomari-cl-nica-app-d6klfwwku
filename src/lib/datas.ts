/**
 * Datas em formato ISO curto (YYYY-MM-DD), sem depender de fuso.
 * O app trabalha com data "de calendário" — somar dias com `new Date` e
 * toISOString pode voltar um dia por causa do fuso de Brasília.
 */

/** Hoje no fuso local, como YYYY-MM-DD */
export function hojeIso(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Normaliza qualquer data (ISO completo ou YYYY-MM-DD) para YYYY-MM-DD */
export function somenteData(valor: string): string {
  if (!valor) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor.slice(0, 10)
  const ano = d.getUTCFullYear()
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Soma dias a uma data YYYY-MM-DD e devolve YYYY-MM-DD */
export function addDays(data: string, dias: number): string {
  const base = somenteData(data)
  const partes = base.split('-').map(Number)
  if (partes.length !== 3 || partes.some(Number.isNaN)) return base
  // Meio-dia em UTC evita a virada de dia por fuso.
  const d = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2], 12, 0, 0))
  d.setUTCDate(d.getUTCDate() + Number(dias || 0))
  const ano = d.getUTCFullYear()
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Data de hoje + N dias, em YYYY-MM-DD */
export function hojeMais(dias: number): string {
  return addDays(hojeIso(), dias)
}
