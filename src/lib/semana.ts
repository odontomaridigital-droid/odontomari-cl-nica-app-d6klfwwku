// Helpers de datas para a visão semanal da agenda. Datas em formato YYYY-MM-DD.
const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function toDateKey(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysToDate(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** Retorna a segunda-feira da semana que contém a data informada. */
export function getWeekStart(dateStr: string): string {
  const dow = parseDateStr(dateStr).getDay()
  return addDaysToDate(dateStr, dow === 0 ? -6 : 1 - dow)
}

/** Retorna os 7 dias (segunda a domingo) a partir da segunda-feira informada. */
export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDate(weekStart, i))
}

/** Converte o campo `data` de um registro (ex.: "2026-11-02 00:00:00.000Z") em YYYY-MM-DD. */
export function dateKeyOf(data: string): string {
  return data.slice(0, 10)
}

export function getDiaSemanaCurto(dateStr: string): string {
  return NOMES_DIAS_CURTOS[parseDateStr(dateStr).getDay()]
}

/** YYYY-MM-DD → Date local (meio-dia, para não escorregar de fuso). */
export function dataDeChave(dateStr: string): Date {
  return parseDateStr(dateStr)
}

/** Date local → YYYY-MM-DD. */
export function chaveDeData(d: Date): string {
  return toDateKey(d)
}
