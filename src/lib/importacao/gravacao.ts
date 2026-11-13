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
          // hora_fim é obrigatório no banco: calcula pela duração quando a
          // planilha não trouxer a hora final.
          const inicio = String(payload.hora_inicio || '').trim()
          const duracao = Number(payload.duracao_minutos) || 30
          if (!payload.duracao_minutos) payload.duracao_minutos = duracao
          if (!payload.hora_fim && /^\d{2}:\d{2}$/.test(inicio)) {
            const [h, m] = inicio.split(':').map(Number)
            const total = h * 60 + m + duracao
            payload.hora_fim = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
              total % 60,
            ).padStart(2, '0')}`
          }
          // tipo_atendimento é obrigatório: usa o primeiro tipo ativo da clínica
          // quando a planilha não indicar um.
          if (!payload.tipo_atendimento) {
            try {
              const tipos = await pb
                .collection('tipos_atendimento')
                .getFullList({ filter: 'ativo = true', sort: 'nome' })
              const primeiro = tipos[0]?.id
              if (primeiro) payload.tipo_atendimento = primeiro
            } catch {
              /* sem tipo: a criação vai falhar e a linha é reportada como pulada */
            }
          }
          if (!payload.hora_inicio) {
            resumo.pulados++
            resumo.motivosPulo.push(`"${ref}": consulta sem hora de início`)
            continue
          }
        }
        if (colecao === 'orcamentos') {
          // itens é obrigatório no banco: monta a partir do valor/observação
          // quando a planilha não tiver itens detalhados.
          if (!Array.isArray(payload.itens) || payload.itens.length === 0) {
            payload.itens = [
              {
                procedimento: String(payload.observacoes || 'Tratamento importado').slice(0, 180),
                valor: Number(payload.valor_total) || 0,
                dente: '',
              },
            ]
          }
          if (!payload.valor_total) {
            payload.valor_total = payload.itens.reduce(
              (s: number, it: { valor?: number }) => s + (Number(it.valor) || 0),
              0,
            )
          }
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
