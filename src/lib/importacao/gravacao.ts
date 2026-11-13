import pb from '@/lib/pocketbase/client'
import { Paciente } from '@/types'
import { LinhaConvertida } from './mapeamento'
import { ColecaoDestino } from './destinos'
import { registrarLog } from '@/services/logsAuditoria'

/** Resultado da gravação de uma importação. */
export interface ResumoImportacao {
  criados: number
  atualizados: number
  pulados: number
  motivosPulo: string[]
}

/** Normaliza telefone: só dígitos (comparação por telefone ignora formatação). */
function digitosTelefone(v?: string | null): string {
  return String(v ?? '').replace(/\D/g, '')
}

/** Normaliza nome para deduplicação: sem acento, minúsculo, espaços colapsados. */
function chaveNome(nome?: string | null): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Carrega todos os pacientes existentes para deduplicação (nome+telefone). */
export async function carregarPacientesExistentes(): Promise<Paciente[]> {
  return await pb.collection('pacientes').getFullList<Paciente>({ sort: 'nome' })
}

/**
 * Grava pacientes em lote, em páginas de writes (para não travar a UI),
 * com deduplicação por nome+telefone: já existente → atualiza, novo → cria.
 * Extras (colunas sem campo próprio) vão no campo JSON "extras" do paciente.
 */
export async function gravarPacientes(
  linhas: LinhaConvertida[],
  existentes: Paciente[],
  onProgresso: (feitas: number, total: number) => void,
): Promise<ResumoImportacao> {
  const porChave = new Map<string, Paciente>()
  for (const p of existentes) {
    const chave = `${chaveNome(p.nome)}|${digitosTelefone(p.telefone)}`
    if (digitosTelefone(p.telefone) && chaveNome(p.nome)) porChave.set(chave, p)
  }

  const resumo: ResumoImportacao = { criados: 0, atualizados: 0, pulados: 0, motivosPulo: [] }
  const validas = linhas.filter((l) => l.problemas.length === 0)
  const total = validas.length
  let feitas = 0
  const LOTE = 25

  for (let i = 0; i < validas.length; i += LOTE) {
    const lote = validas.slice(i, i + LOTE)
    // sequencial dentro do lote
    for (const linha of lote) {
      const nome = String(linha.campos.nome ?? '').trim()
      const telefone = String(linha.campos.telefone ?? '').trim()
      const chave = `${chaveNome(nome)}|${digitosTelefone(telefone)}`
      const existente = porChave.get(chave)

      const payload: Record<string, unknown> = { ...linha.campos }
      if (Object.keys(linha.extras).length > 0) {
        // Mescla com extras já existentes (atualização de paciente importado antes)
        payload.extras = { ...(existente?.extras ?? {}), ...linha.extras }
      }

      try {
        if (existente) {
          await pb.collection('pacientes').update(existente.id, payload)
          resumo.atualizados++
        } else {
          const criado = await pb.collection('pacientes').create<Paciente>(payload)
          porChave.set(chave, criado)
          resumo.criados++
        }
      } catch (err: unknown) {
        resumo.pulados++
        const msg = err instanceof Error ? err.message : String(err)
        resumo.motivosPulo.push(`"${nome || 'sem nome'}": ${msg}`)
      }
      feitas++
    }
    onProgresso(Math.min(feitas, total), total)
    // Devolve o controle à UI entre lotes
    await new Promise((r) => setTimeout(r, 0))
  }

  if (resumo.criados + resumo.atualizados > 0) {
    registrarLog(
      'criou',
      'paciente',
      `Importou ${resumo.criados + resumo.atualizados} pacientes via planilha (${resumo.criados} novos, ${resumo.atualizados} atualizados)`,
    )
  }
  return resumo
}

/** Busca paciente por nome (igual ou contendo) ou pelos dígitos do telefone. */
export async function buscarPacientePorReferencia(ref: string): Promise<Paciente | null> {
  const digitos = digitosTelefone(ref)
  try {
    if (digitos.length >= 10) {
      const porTelefone = await pb
        .collection('pacientes')
        .getFirstListItem<Paciente>(`telefone ~ "${digitos}"`)
      return porTelefone
    }
  } catch {
    /* segue para busca por nome */
  }
  try {
    return await pb.collection('pacientes').getFirstListItem<Paciente>(`nome ~ "${ref}"`)
  } catch {
    return null
  }
}

/** Grava consultas/orçamentos, vinculando cada linha ao paciente encontrado. */
export async function gravarRegistrosVinculados(
  colecao: ColecaoDestino,
  linhas: LinhaConvertida[],
  onProgresso: (feitas: number, total: number) => void,
): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { criados: 0, atualizados: 0, pulados: 0, motivosPulo: [] }
  const validas = linhas.filter((l) => l.problemas.length === 0)
  const total = validas.length
  let feitas = 0
  const LOTE = 25
  const cachePacientes = new Map<string, Paciente | null>()

  for (let i = 0; i < validas.length; i += LOTE) {
    const lote = validas.slice(i, i + LOTE)
    for (const linha of lote) {
      const ref = String(linha.campos.paciente ?? '').trim()
      let paciente = cachePacientes.get(ref) ?? null
      if (paciente === null && !cachePacientes.has(ref)) {
        paciente = await buscarPacientePorReferencia(ref)
        cachePacientes.set(ref, paciente)
      }
      if (!paciente) {
        resumo.pulados++
        resumo.motivosPulo.push(`"${ref}": paciente não encontrado no cadastro`)
        continue
      }
      const payload: Record<string, unknown> = { ...linha.campos, paciente: paciente.id }
      if (Object.keys(linha.extras).length > 0) payload.extras = linha.extras
      try {
        if (colecao === 'consultas') {
          payload.hora_fim = payload.hora_fim || ''
        }
        await pb.collection(colecao).create(payload)
        resumo.criados++
      } catch (err: unknown) {
        resumo.pulados++
        const msg = err instanceof Error ? err.message : String(err)
        resumo.motivosPulo.push(`"${ref}": ${msg}`)
      }
      feitas++
    }
    onProgresso(Math.min(feitas, total), total)
    await new Promise((r) => setTimeout(r, 0))
  }
  return resumo
}
