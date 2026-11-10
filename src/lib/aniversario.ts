/** Helpers de aniversário a partir de data de nascimento (inclusive incompleta). */

/** Extrai mês (1-12) e dia (1-31) de uma data ISO/YYYY-MM-DD. Retorna null se vazio/inválido. */
export function extrairDiaMes(dataNascimento?: string | null): { mes: number; dia: number } | null {
  if (!dataNascimento) return null
  const s = String(dataNascimento).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { mes, dia }
}

/** Ano de nascimento a partir de uma data ISO ("1990-05-12..." → 1990). null se ausente/inválido. */
function extrairAno(dataNascimento?: string | null): number | null {
  if (!dataNascimento) return null
  const m = String(dataNascimento)
    .trim()
    .match(/^(\d{4})-/)
  if (!m) return null
  const ano = Number(m[1])
  return ano >= 1900 && ano <= new Date().getFullYear() ? ano : null
}

/** Aniversário do paciente em relação a hoje (local). null se sem dia/mês. */
export function aniversarioDePaciente(dataNascimento?: string | null, hoje = new Date()) {
  const dm = extrairDiaMes(dataNascimento)
  if (!dm) return null
  const hojeMes = hoje.getMonth() + 1
  const hojeDia = hoje.getDate()

  // dias até o próximo aniversário (29/2 tratado como 29/2 quando possível)
  let ano = hoje.getFullYear()
  let alvo = new Date(ano, dm.mes - 1, dm.dia)
  if (isNaN(alvo.getTime())) alvo = new Date(ano, dm.mes, 0) // 31 -> último dia do mês
  if (alvo < new Date(hoje.getFullYear(), hojeMes - 1, hojeDia)) {
    ano += 1
    alvo = new Date(ano, dm.mes - 1, dm.dia)
    if (isNaN(alvo.getTime())) alvo = new Date(ano, dm.mes, 0)
  }
  const MS = 86400000
  const base = new Date(hoje.getFullYear(), hojeMes - 1, hojeDia)
  const diasAte = Math.round((alvo.getTime() - base.getTime()) / MS)
  const anoNasc = extrairAno(dataNascimento)
  const idade = anoNasc ? hoje.getFullYear() - anoNasc : null
  const ehHoje = diasAte === 0
  return { mes: dm.mes, dia: dm.dia, diasAte, ehHoje, idade, anoAniversario: ano }
}

/** Texto curto tipo "hoje", "em 3 dias", "em 25/09". */
export function textoAniversario(diasAte: number, dataNascimento?: string | null): string {
  if (diasAte === 0) return 'aniversário hoje! 🎂'
  if (diasAte === 1) return 'aniversário amanhã'
  const dm = extrairDiaMes(dataNascimento)
  if (diasAte > 1 && diasAte <= 30 && dm) {
    return `aniversário em ${diasAte} dias (${String(dm.dia).padStart(2, '0')}/${String(dm.mes).padStart(2, '0')})`
  }
  return `aniversário em ${diasAte} dias`
}
