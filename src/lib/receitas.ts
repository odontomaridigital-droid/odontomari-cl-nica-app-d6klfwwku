import { Receita, ItemReceita, ClinicaConfig } from '@/types'
import { formatDateBr } from '@/lib/formatters'

/** Monta o texto em texto corrido da receita (usado no WhatsApp e no diálogo de confirmação). */
export function montarTextoReceita(
  receita: Pick<Receita, 'itens' | 'orientacoes' | 'data'>,
  pacienteNome: string,
  config?: Pick<ClinicaConfig, 'nome_clinica' | 'dentista_nome' | 'dentista_cro'>,
): string {
  const nomeClinica = config?.nome_clinica || 'Clínica Odontomari'
  const linhas: string[] = []

  linhas.push(`*${nomeClinica}*`)
  linhas.push('')
  linhas.push(`Receituário — ${pacienteNome}`)
  linhas.push(`Data: ${formatDateBr(receita.data)}`)
  linhas.push('')

  receita.itens.forEach((item, i) => {
    const apresentacao = item.apresentacao ? ` (${item.apresentacao})` : ''
    linhas.push(`${i + 1}. ${item.nome}${apresentacao}`)
    linhas.push(`   ${item.posologia}`)
    linhas.push('')
  })

  if (receita.orientacoes?.trim()) {
    linhas.push('Orientações gerais:')
    linhas.push(receita.orientacoes.trim())
    linhas.push('')
  }

  if (config?.dentista_nome) {
    linhas.push('________________________________')
    const cro = config.dentista_cro ? ` — ${config.dentista_cro}` : ''
    linhas.push(`${config.dentista_nome}${cro}`)
  }

  return linhas.join('\n')
}

/** Normaliza um item antes de salvar (nomes sem espaços extras, sem itens vazios). */
export function normalizarItensReceita(itens: ItemReceita[]): ItemReceita[] {
  return itens
    .filter((i) => i.nome.trim() && i.posologia.trim())
    .map((i) => ({
      medicamento_id: i.medicamento_id,
      nome: i.nome.trim(),
      apresentacao: i.apresentacao?.trim() || undefined,
      posologia: i.posologia.trim(),
    }))
}
