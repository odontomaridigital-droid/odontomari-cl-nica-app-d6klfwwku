import type { Paciente, PreferenciaHorarioTipo } from '@/types'

/** Rótulos das sugestões rápidas de preferência de horário. */
export const PREFERENCIA_OPCOES: { valor: PreferenciaHorarioTipo; rotulo: string }[] = [
  { valor: 'manha', rotulo: 'Só de manhã' },
  { valor: 'tarde', rotulo: 'Só à tarde' },
  { valor: 'apos17', rotulo: 'Só após as 17h' },
  { valor: 'manha_e_tarde', rotulo: 'Manhã e tarde' },
]

export const HORAS_OPCOES: string[] = Array.from({ length: 33 }, (_, i) => {
  const h = 7 + Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

export const ORIGENS = [
  'Indicação de paciente',
  'Indicação de outro profissional',
  'Instagram',
  'Facebook',
  'Google',
  'Passou na clínica',
  'Mala direta',
  'Outro',
] as const

/** Texto de preferência de horário do paciente para exibir na UI ("" quando nada preenchido). */
export function textoPreferenciaHorario(p?: Paciente | null): string {
  if (!p) return ''
  const partes: string[] = []
  const tipo = p.preferencia_horario_tipo as PreferenciaHorarioTipo | '' | undefined
  const opcao = PREFERENCIA_OPCOES.find((o) => o.valor === tipo)
  if (opcao) partes.push(opcao.rotulo)
  if (p.preferencia_horario_de || p.preferencia_horario_ate) {
    partes.push(
      `entre ${p.preferencia_horario_de || '00:00'} e ${p.preferencia_horario_ate || '23:59'}`,
    )
  }
  if (p.preferencia_horario_obs) partes.push(p.preferencia_horario_obs)
  return partes.join(' · ')
}

/** Texto de origem do paciente ("" quando nada preenchido). */
export function textoOrigem(p?: Paciente | null): string {
  if (!p?.origem) return ''
  if (p.origem === 'Outro' && p.origem_complemento) return p.origem_complemento
  return p.origem_complemento ? `${p.origem} (${p.origem_complemento})` : p.origem
}
