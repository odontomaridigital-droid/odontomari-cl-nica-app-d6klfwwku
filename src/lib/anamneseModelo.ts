// Modelo padrão de Anamnese Odontológica (embutido no app, não editável por enquanto)

export type RespostaSimNao = {
  resposta: 'sim' | 'nao' | ''
  detalhe?: string
}

export type RespostaAnamnese = string | RespostaSimNao

export type RespostasAnamnese = Record<string, RespostaAnamnese>

export interface AnamneseQuestao {
  id: string
  texto: string
  tipo: 'simnao' | 'texto'
  /** Placeholder do campo de detalhe exibido quando a resposta é "sim" */
  detalhePlaceholder?: string
  /** Placeholder do campo de texto livre */
  placeholder?: string
  /** Dica contextual (ex.: "para mulheres") */
  dica?: string
}

export interface AnamneseSecao {
  id: string
  titulo: string
  questoes: AnamneseQuestao[]
}

export const MODELO_ANAMNESE = {
  id: 'odontologica_odontomari_v1',
  nome: 'Anamnese Odontológica — Modelo Odontomari',
}

export const ANAMNESE_SECOES: AnamneseSecao[] = [
  {
    id: 'queixa',
    titulo: 'Queixa Principal e História Atual',
    questoes: [
      {
        id: 'queixa_principal',
        texto: 'Queixa principal do paciente',
        tipo: 'texto',
        placeholder: 'Ex.: Dor no dente de cima do lado direito, sensibilidade ao frio...',
      },
      {
        id: 'queixa_tempo',
        texto: 'Há quanto tempo o paciente sente essa queixa?',
        tipo: 'texto',
        placeholder: 'Ex.: Há cerca de duas semanas, piorando nos últimos 3 dias',
      },
      {
        id: 'queixa_melhora',
        texto: 'O que melhora a queixa?',
        tipo: 'texto',
        placeholder: 'Ex.: Analgésico, alimentos frios, nada alivia...',
      },
      {
        id: 'queixa_piora',
        texto: 'O que piora a queixa?',
        tipo: 'texto',
        placeholder: 'Ex.: Alimentos quentes, mastigar do lado direito, deitar...',
      },
    ],
  },
  {
    id: 'historico_medico',
    titulo: 'Histórico Médico',
    questoes: [
      {
        id: 'diabetes',
        texto: 'Diabetes',
        tipo: 'simnao',
        detalhePlaceholder: 'Tipo 1 ou 2? Faz uso de insulina? Última glicose conhecida...',
      },
      {
        id: 'hipertensao',
        texto: 'Pressão alta (hipertensão)',
        tipo: 'simnao',
        detalhePlaceholder: 'Faz uso de qual medicamento? Última aferição conhecida...',
      },
      {
        id: 'cardiopatia',
        texto: 'Doença do coração (cardiopatia)',
        tipo: 'simnao',
        detalhePlaceholder: 'Qual? Sopro, arritmia, infarto, marca-passo, valvulopatia...',
      },
      {
        id: 'respiratorias',
        texto: 'Doenças respiratórias (asma, bronquite)',
        tipo: 'simnao',
        detalhePlaceholder: 'Qual? Faz uso de bombinha/inalador?',
      },
      {
        id: 'renal',
        texto: 'Doença renal',
        tipo: 'simnao',
        detalhePlaceholder: 'Qual? Faz hemodiálise?',
      },
      {
        id: 'epilepsia',
        texto: 'Epilepsia / convulsões',
        tipo: 'simnao',
        detalhePlaceholder: 'Com que frequência? Qual medicamento usa?',
      },
      {
        id: 'hepatite',
        texto: 'Hepatite ou outra doença do fígado',
        tipo: 'simnao',
        detalhePlaceholder: 'Tipo (A, B, C), quando foi diagnosticada...',
      },
      {
        id: 'anemia',
        texto: 'Anemia ou distúrbio do sangue',
        tipo: 'simnao',
        detalhePlaceholder: 'Qual? Hemofilia, talassemia, leucemia...',
      },
      {
        id: 'cancer',
        texto: 'Câncer (próprio ou em tratamento)',
        tipo: 'simnao',
        detalhePlaceholder: 'Tipo, ano do diagnóstico, tratamentos realizados...',
      },
      {
        id: 'cirurgias',
        texto: 'Já realizou alguma cirurgia?',
        tipo: 'simnao',
        detalhePlaceholder: 'Quais cirurgias e quando?',
      },
      {
        id: 'internacoes',
        texto: 'Foi internado nos últimos anos?',
        tipo: 'simnao',
        detalhePlaceholder: 'Motivo e ano da internação...',
      },
      {
        id: 'outras_doencas',
        texto: 'Outras doenças ou condições de saúde importantes',
        tipo: 'texto',
        placeholder: 'Ex.: Distúrbios da tireoide, osteoporose, doenças autoimunes, DSTs...',
      },
    ],
  },
  {
    id: 'alergias',
    titulo: 'Alergias',
    questoes: [
      {
        id: 'alergia_medicamentos',
        texto: 'Alergia a medicamentos',
        tipo: 'simnao',
        detalhePlaceholder: 'Quais? (Ex.: penicilina, dipirona, AAS...)',
      },
      {
        id: 'alergia_anestesicos',
        texto: 'Alergia a anestésicos',
        tipo: 'simnao',
        detalhePlaceholder: 'Quais? Já teve reação durante atendimento odontológico?',
      },
      {
        id: 'alergia_latex',
        texto: 'Alergia a látex',
        tipo: 'simnao',
        detalhePlaceholder: 'Como se manifesta a reação?',
      },
      {
        id: 'alergia_outras',
        texto: 'Outras alergias (alimentos, materiais, ambientes)',
        tipo: 'texto',
        placeholder: 'Ex.: Alergia a níquel, frutos do mar, poeira...',
      },
    ],
  },
  {
    id: 'medicacoes',
    titulo: 'Medicações em Uso Contínuo',
    questoes: [
      {
        id: 'medicacoes_uso',
        texto: 'O paciente faz uso de alguma medicação de forma contínua? Quais?',
        tipo: 'texto',
        placeholder: 'Ex.: Losartana 50mg (pressão), Metformina 850mg (diabetes), AAS 100mg/dia...',
      },
      {
        id: 'anticoagulante',
        texto: 'Faz uso de anticoagulante ou antiagregante?',
        tipo: 'simnao',
        detalhePlaceholder: 'Qual? (Ex.: Varfarina, Xarelto, AAS, Clopidogrel)',
      },
    ],
  },
  {
    id: 'habitos',
    titulo: 'Hábitos',
    questoes: [
      {
        id: 'fuma',
        texto: 'Fuma',
        tipo: 'simnao',
        detalhePlaceholder: 'Há quanto tempo? Quantos cigarros por dia?',
      },
      {
        id: 'alcool',
        texto: 'Consome bebida alcoólica',
        tipo: 'simnao',
        detalhePlaceholder: 'Com que frequência?',
      },
      {
        id: 'bruxismo',
        texto: 'Aperta ou range os dentes (bruxismo)',
        tipo: 'simnao',
        detalhePlaceholder: 'Durante o dia, durante o sono? Usa placa de mordida?',
      },
      {
        id: 'fio_dental',
        texto: 'Usa fio dental',
        tipo: 'simnao',
        detalhePlaceholder: 'Com que frequência? Diariamente, algumas vezes por semana...',
      },
      {
        id: 'escovacao',
        texto: 'Quantas vezes escova os dentes por dia? Usa enxaguatório?',
        tipo: 'texto',
        placeholder: 'Ex.: 3 vezes ao dia, com enxaguatório à noite',
      },
    ],
  },
  {
    id: 'experiencias',
    titulo: 'Experiências Anteriores com Tratamento',
    questoes: [
      {
        id: 'trismo',
        texto: 'Já teve dificuldade de abrir a boca após procedimento (trismo)?',
        tipo: 'simnao',
        detalhePlaceholder: 'Quando ocorreu? Quanto tempo durou?',
      },
      {
        id: 'sangramento',
        texto: 'Sangramento excessivo após extração ou corte (sangramento prolongado)',
        tipo: 'simnao',
        detalhePlaceholder: 'Em qual situação? Quanto tempo para estancar?',
      },
      {
        id: 'reacao_anestesia',
        texto: 'Reação adversa a anestesia odontológica',
        tipo: 'simnao',
        detalhePlaceholder: 'O que sentiu? (Palpitação, desmaio, urticária...)',
      },
      {
        id: 'consultas_anteriores',
        texto: 'Já foi atendido por dentista antes?',
        tipo: 'simnao',
        detalhePlaceholder: 'Quando foi a última consulta? Por que parou de tratar?',
      },
      {
        id: 'medo_dentista',
        texto: 'Tem medo ou ansiedade de ir ao dentista?',
        tipo: 'simnao',
        detalhePlaceholder: 'O que o deixa desconfortável? Já precisou de sedação?',
      },
    ],
  },
  {
    id: 'gestacao',
    titulo: 'Para Pacientes Mulheres',
    questoes: [
      {
        id: 'gestante',
        texto: 'Está gestante?',
        tipo: 'simnao',
        detalhePlaceholder: 'Quantas semanas de gestação? Está em acompanhamento pré-natal?',
        dica: 'Preencher somente para pacientes mulheres',
      },
      {
        id: 'amamentando',
        texto: 'Está amamentando?',
        tipo: 'simnao',
        detalhePlaceholder: 'Idade do bebê...',
      },
    ],
  },
  {
    id: 'observacoes',
    titulo: 'Observações Gerais',
    questoes: [
      {
        id: 'observacoes_livres',
        texto: 'Observações e comentários livres do dentista',
        tipo: 'texto',
        placeholder:
          'Espaço livre para qualquer informação relevante que não coube nas seções anteriores...',
      },
    ],
  },
]

/** Cria o objeto de respostas vazio a partir do modelo */
export function respostasVazias(): RespostasAnamnese {
  const respostas: RespostasAnamnese = {}
  for (const secao of ANAMNESE_SECOES) {
    for (const q of secao.questoes) {
      respostas[q.id] = q.tipo === 'simnao' ? { resposta: '', detalhe: '' } : ''
    }
  }
  return respostas
}

/** Normaliza respostas carregadas do banco (garante a estrutura esperada pelo formulário) */
export function normalizarRespostas(raw: unknown): RespostasAnamnese {
  const base = respostasVazias()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  for (const secao of ANAMNESE_SECOES) {
    for (const q of secao.questoes) {
      const v = obj[q.id]
      if (v === undefined || v === null) continue
      if (q.tipo === 'simnao') {
        if (typeof v === 'object' && v !== null) {
          const r = v as { resposta?: string; detalhe?: string }
          base[q.id] = {
            resposta: r.resposta === 'sim' || r.resposta === 'nao' ? r.resposta : '',
            detalhe: typeof r.detalhe === 'string' ? r.detalhe : '',
          }
        } else if (v === 'sim' || v === 'nao') {
          base[q.id] = { resposta: v, detalhe: '' }
        }
      } else if (typeof v === 'string') {
        base[q.id] = v
      }
    }
  }
  return base
}

/** Conta quantas questões do modelo foram respondidas (para resumo do histórico) */
export function contarRespostas(respostas: RespostasAnamnese): number {
  let respondidas = 0
  for (const secao of ANAMNESE_SECOES) {
    for (const q of secao.questoes) {
      const v = respostas[q.id]
      if (q.tipo === 'texto') {
        if (typeof v === 'string' && v.trim()) respondidas++
      } else if (v && typeof v === 'object' && v.resposta) {
        respondidas++
      }
    }
  }
  return respondidas
}

export function totalQuestoes(): number {
  return ANAMNESE_SECOES.reduce((acc, s) => acc + s.questoes.length, 0)
}
