import pb from '@/lib/pocketbase/client'
import { Paciente } from '@/types'
import { LinhaConvertida } from './mapeamento'
import { ColecaoDestino } from './destinos'
import { registrarLog } from '@/services/logsAuditoria'
import { corrigirAcentos } from './normalizar'

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

/**
 * Normaliza nome para deduplicação: corrige acento quebrado de exportação,
 * remove acento, minúsculo e espaços colapsados.
 */
function chaveNome(nome?: string | null): string {
  return corrigirAcentos(String(nome ?? ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
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
  // Índices de deduplicação. Reimportar a planilha atualizada é um caso de uso
  // real (o sistema antigo continua rodando), então o paciente é identificado
  // por três caminhos, do mais forte para o mais fraco:
  //   1. número do prontuário antigo (único e estável)
  //   2. telefone (ignora formatação)
  //   3. nome + telefone
  const porProntuario = new Map<string, Paciente>()
  const porTelefone = new Map<string, Paciente>()
  const porChave = new Map<string, Paciente>()

  for (const p of existentes) {
    const extras: Record<string, unknown> = (p as any).extras || {}
    const pront = String(extras['Número do prontuário (sistema antigo)'] || '').trim()
    if (pront) porProntuario.set(pront, p)

    const tel = digitosTelefone(p.telefone)
    if (tel && tel.length >= 10) porTelefone.set(tel, p)

    const chave = `${chaveNome(p.nome)}|${tel}`
    if (tel && chaveNome(p.nome)) porChave.set(chave, p)
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
      const telDigitos = digitosTelefone(telefone)
      const chave = `${chaveNome(nome)}|${telDigitos}`
      const prontuario = String(
        linha.extras?.['Número do prontuário (sistema antigo)'] ?? '',
      ).trim()

      // Ordem de identificação: prontuário antigo > telefone > nome+telefone
      let existente: Paciente | undefined
      if (prontuario) existente = porProntuario.get(prontuario)
      if (!existente && telDigitos.length >= 10) existente = porTelefone.get(telDigitos)
      if (!existente) existente = porChave.get(chave)

      const payload: Record<string, unknown> = { ...linha.campos }

      // O PocketBase não aceita telefone vazio em campo obrigatório de versões
      // antigas; hoje o campo é opcional, mas limpamos valores falsos.
      if (payload.telefone === '') delete payload.telefone

      // Origem "Outros" (comum no Dentista Organizado) não informa nada —
      // melhor deixar vazio do que poluir o relatório de marketing.
      if (
        String(payload.origem || '')
          .trim()
          .toLowerCase() === 'outros'
      ) {
        payload.origem = ''
      }
      // Data de nascimento do backup vem como "Aniversario": só vale se for
      // uma data válida e o paciente tiver idade plausível.
      if (payload.data_nascimento) {
        const ano = Number(String(payload.data_nascimento).slice(0, 4))
        const anoAtual = new Date().getFullYear()
        if (!ano || ano < 1900 || ano > anoAtual) delete payload.data_nascimento
      }

      if (Object.keys(linha.extras).length > 0) {
        // Mescla com extras já existentes (atualização de paciente importado antes)
        payload.extras = { ...((existente as any)?.extras ?? {}), ...linha.extras }
      }

      try {
        if (existente) {
          await pb.collection('pacientes').update(existente.id, payload)
          resumo.atualizados++
          // mantém os índices atualizados para as próximas linhas do mesmo arquivo
          porChave.set(chave, existente)
          if (telDigitos.length >= 10) porTelefone.set(telDigitos, existente)
          if (prontuario) porProntuario.set(prontuario, existente)
        } else {
          const criado = await pb.collection('pacientes').create<Paciente>(payload)
          porChave.set(chave, criado)
          if (telDigitos.length >= 10) porTelefone.set(telDigitos, criado)
          if (prontuario) porProntuario.set(prontuario, criado)
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

/**
 * Carrega as chaves já existentes de consultas/orçamentos para não duplicar
 * quando a planilha for importada de novo (o sistema antigo continua rodando).
 *
 * As chaves usam o MESMO formato da gravação:
 * - consultas: paciente|data|hora_inicio
 * - orçamentos: chave do conteúdo dos itens (nome do paciente + itens ordenados)
 */
async function carregarChavesExistentes(colecao: ColecaoDestino): Promise<Set<string>> {
  const chaves = new Set<string>()
  if (colecao === 'consultas') {
    const registros = await pb.collection('consultas').getFullList<any>({ sort: 'data' })
    for (const c of registros) {
      chaves.add(`${c.paciente}|${String(c.data || '').slice(0, 10)}|${c.hora_inicio}`)
    }
  } else {
    const registros = await pb.collection('orcamentos').getFullList<any>()
    for (const o of registros) {
      const itens = Array.isArray(o.itens) ? o.itens : []
      const assinatura = itens
        .map((i: any) => `${i.procedimento}|${i.dente || ''}|${i.valor || 0}`)
        .sort()
        .join('~')
      chaves.add(`${o.paciente}|${assinatura}`)
    }
  }
  return chaves
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

  // Reimportação: o que já existe é reconhecido e ignorado, em vez de duplicado.
  const chavesExistentes = await carregarChavesExistentes(colecao)

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

      // Chave de idempotência: se este registro já foi importado, ignora.
      const itensLinha = Array.isArray(payload.itens) ? (payload.itens as any[]) : []
      const assinaturaLinha = itensLinha
        .map((i: any) => `${i.procedimento}|${i.dente || ''}|${i.valor || 0}`)
        .sort()
        .join('~')
      const chaveRegistro =
        colecao === 'consultas'
          ? `${paciente.id}|${String(payload.data || '').slice(0, 10)}|${payload.hora_inicio}`
          : `${paciente.id}|${assinaturaLinha}`

      if (chavesExistentes.has(chaveRegistro)) {
        resumo.atualizados++
        feitas++
        continue
      }

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
            const itens = payload.itens as Array<{ valor?: number }>
            payload.valor_total = itens.reduce((s, it) => s + (Number(it.valor) || 0), 0)
          }
        }
        await pb.collection(colecao).create(payload)
        chavesExistentes.add(chaveRegistro)
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
