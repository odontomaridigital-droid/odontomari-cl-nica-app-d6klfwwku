import { LinhaConvertida } from './mapeamento'
import { MOLDE_CONSULTAS_DENTISTA_ORGANIZADO } from './destinos'
import { corrigirAcentos } from './normalizar'

/**
 * Converte as linhas da aba "Consultas" do Dentista Organizado em registros
 * prontos para gravar, lendo por POSIÇÃO de coluna.
 *
 * Motivo de não usar o mapeamento genérico: esta aba tem uma coluna chamada
 * `nome_completo` que contém o nome da DENTISTA, e o paciente está em `nome`.
 * Além disso, data e hora vêm juntas no formato "14/03/2022 -  09:50".
 */

/** Lê "14/03/2022 -  09:50" (com 1 ou 2 espaços) e devolve data e hora separadas. */
export function lerDataHoraBr(valor: string): { data: string; hora: string } | null {
  const v = String(valor ?? '').trim()
  if (!v) return null
  // Aceita: "14/03/2022 -  09:50", "14/03/2022 - 9:50", "14/03/2022 09:50"
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(-|\s)\s*(\d{1,2}):(\d{2})/)
  if (!m) {
    // Só a data, sem hora
    const soData = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (soData) {
      const [, d, mes, ano] = soData
      return {
        data: `${ano}-${mes.padStart(2, '0')}-${d.padStart(2, '0')} 00:00:00.000Z`,
        hora: '00:00',
      }
    }
    return null
  }
  const [, d, mes, ano, , h, min] = m
  const dia = Number(d)
  const mesN = Number(mes)
  if (mesN < 1 || mesN > 12 || dia < 1 || dia > 31) return null
  return {
    data: `${ano}-${String(mesN).padStart(2, '0')}-${String(dia).padStart(2, '0')} 00:00:00.000Z`,
    hora: `${String(Number(h)).padStart(2, '0')}:${min}`,
  }
}

/**
 * A planilha grava a hora em formato 12h SEM AM/PM: o que era 15:00 aparece
 * como "03:00" e 18:30 como "06:30". Como a clínica atende das 08:00 às 18:00,
 * toda hora de 01 a 06 é, na verdade, da tarde. Hora 07 é ambígua (07:00 ou
 * 19:00) e fica como veio.
 */
export function ajustarHora12h(hora: string): string {
  const [h, m] = String(hora ?? '').split(':')
  const n = Number(h)
  if (!isNaN(n) && n >= 1 && n <= 6) return `${String(n + 12).padStart(2, '0')}:${m ?? '00'}`
  return hora
}

/** Converte o status do Dentista Organizado para o status do Odontomari. */
export function statusConsultaDe(
  valor: string,
): 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'faltou' {
  const s = String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  if (s.startsWith('confirm')) return 'confirmada'
  if (s.startsWith('cancel')) return 'cancelada'
  if (s.startsWith('falt')) return 'faltou'
  if (s.startsWith('realiz') || s.startsWith('conclu') || s.startsWith('atend')) return 'realizada'
  return 'agendada'
}

/** Diferença em minutos entre dois horários "HH:MM". */
function minutosEntre(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  if ([h1, m1, h2, m2].some((n) => isNaN(n))) return 30
  let diff = h2 * 60 + m2 - (h1 * 60 + m1)
  if (diff <= 0) diff += 24 * 60 // virou o dia
  return diff
}

export interface ResultadoConsultas {
  linhas: LinhaConvertida[]
  /** Contagem por motivo de descarte, para mostrar na tela */
  descartes: Record<string, number>
}

/**
 * Transforma as linhas cruas da aba de Consultas em registros prontos.
 * O campo `paciente` guarda o NOME do paciente (a gravação resolve para o id).
 */
export function converterConsultas(linhas: string[][]): ResultadoConsultas {
  const c = MOLDE_CONSULTAS_DENTISTA_ORGANIZADO.colunas
  const resultado: LinhaConvertida[] = []
  const descartes: Record<string, number> = {}

  const descartar = (motivo: string) => {
    descartes[motivo] = (descartes[motivo] || 0) + 1
  }

  linhas.forEach((linha, i) => {
    const paciente = corrigirAcentos(String(linha[c.paciente] ?? '').trim())
    const inicioBruto = String(linha[c.dataHoraInicio] ?? '').trim()
    const fimBruto = String(linha[c.dataHoraFim] ?? '').trim()
    const statusBruto = String(linha[c.status] ?? '').trim()
    const observacoes = corrigirAcentos(String(linha[c.observacoes] ?? '').trim())

    if (!paciente) {
      descartar('sem nome de paciente')
      return
    }
    const inicio = lerDataHoraBr(inicioBruto)
    if (!inicio) {
      descartar('data de início inválida')
      return
    }

    // hora de origem em 12h sem AM/PM: 01:00-06:00 são 13:00-18:00
    inicio.hora = ajustarHora12h(inicio.hora)

    const fim = lerDataHoraBr(fimBruto)
    if (fim?.hora) fim.hora = ajustarHora12h(fim.hora)
    const duracao = fim?.hora && fim.hora !== '00:00' ? minutosEntre(inicio.hora, fim.hora) : 30

    const campos: Record<string, unknown> = {
      paciente,
      data: inicio.data,
      hora_inicio: inicio.hora,
      duracao_minutos: duracao > 0 && duracao <= 480 ? duracao : 30,
      hora_fim:
        fim?.hora && fim.hora !== '00:00'
          ? fim.hora
          : (() => {
              const [h, m] = inicio.hora.split(':').map(Number)
              const total = h * 60 + m + (duracao > 0 && duracao <= 480 ? duracao : 30)
              return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(
                total % 60,
              ).padStart(2, '0')}`
            })(),
      status: statusConsultaDe(statusBruto),
    }
    if (observacoes) campos.observacoes = observacoes

    resultado.push({
      indiceLinha: i,
      campos,
      extras: { 'Status original (sistema antigo)': statusBruto },
      problemas: [],
    })
  })

  return { linhas: resultado, descartes }
}
