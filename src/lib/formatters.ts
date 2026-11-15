export function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Valor para dentro do campo de digitação: sempre com duas casas decimais,
 * separador de milhar no ponto e decimal na vírgula (pt-BR).
 * Ex.: 1750 -> "1.750,00"
 */
export function formatValorInput(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Lê o que a pessoa digitou no campo de valor e devolve número.
 * Aceita "1.750,00", "1750,00", "1750.00" e "1750".
 * Se o texto não tem nenhum dígito, devolve 0.
 */
export function parseValorInput(texto: string): number {
  if (!texto) return 0
  let limpo = texto.replace(/[^\d.,]/g, '')
  if (!limpo) return 0

  // Vírgula é o separador decimal no Brasil: daí o ponto só pode ser milhar.
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
    const n = Number(limpo)
    return Number.isFinite(n) ? n : 0
  }

  const partes = limpo.split('.')
  if (partes.length === 1) {
    const n = Number(limpo)
    return Number.isFinite(n) ? n : 0
  }

  // Sem vírgula, o ponto é ambíguo: milhar (1.500 = mil e quinhentos) ou
  // decimal (12.5 = doze e meio). É milhar quando todo grupo depois do
  // primeiro ponto tem exatamente 3 dígitos — senão, é decimal.
  const ehMilhar = partes.slice(1).every((p) => p.length === 3)
  if (ehMilhar) {
    const n = Number(partes.join(''))
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(`${partes[0]}.${partes.slice(1).join('')}`)
  return Number.isFinite(n) ? n : 0
}

export function formatPhone(phone?: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function formatDateBr(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    // If it's YYYY-MM-DD
    const parts = dateStr.split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return dateStr
  }
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hours, mins] = timeStr.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutesToAdd
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
}

export function generateTimeSlots(start = '08:00', end = '18:00', stepMinutes = 30): string[] {
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startTotal = startH * 60 + startM
  const endTotal = endH * 60 + endM

  const slots: string[] = []
  for (let m = startTotal; m <= endTotal; m += stepMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    slots.push(`${hh}:${mm}`)
  }
  return slots
}

export function isWeekend(dateStr: string): boolean {
  // dateStr format: YYYY-MM-DD
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    const day = d.getDay()
    return day === 0 || day === 6 // 0 Sunday, 6 Saturday
  }
  return false
}

export function getDayOfWeekName(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    const days = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ]
    return days[d.getDay()]
  }
  return ''
}

export function createWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
}
