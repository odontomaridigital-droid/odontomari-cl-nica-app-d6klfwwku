/** Rótulos e campos de destino para cada coleção que o wizard de importação suporta. */

export type ColecaoDestino = 'pacientes' | 'consultas' | 'orcamentos'

export interface DestinoCampo {
  /** Nome do campo no PocketBase */
  campo: string
  /** Rótulo amigável exibido na UI */
  rotulo: string
  /** Obrigatório para o registro ser gravado */
  obrigatorio?: boolean
  tipo?:
    | 'texto'
    | 'data'
    | 'telefone'
    | 'cpf'
    | 'email'
    | 'numero'
    | 'json'
    | 'cep'
    | 'cidade'
    | 'uf'
}

export interface DestinoColecao {
  colecao: ColecaoDestino
  rotulo: string
  descricao: string
  campos: DestinoCampo[]
}

const CAMPOS_PACIENTE: DestinoCampo[] = [
  { campo: 'nome', rotulo: 'Nome', obrigatorio: true, tipo: 'texto' },
  {
    campo: 'telefone',
    rotulo: 'Telefone / Celular',
    tipo: 'telefone',
    // Não é obrigatório: no backup real do Dentista Organizado, 35 pacientes
    // não têm telefone nenhum. Bloquear impediria de trazê-los.
  },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
  { campo: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data' },
  { campo: 'cpf', rotulo: 'CPF', tipo: 'cpf' },
  { campo: 'cep', rotulo: 'CEP', tipo: 'cep' },
  { campo: 'logradouro', rotulo: 'Logradouro', tipo: 'texto' },
  { campo: 'numero', rotulo: 'Número', tipo: 'texto' },
  { campo: 'complemento', rotulo: 'Complemento', tipo: 'texto' },
  { campo: 'bairro', rotulo: 'Bairro', tipo: 'texto' },
  { campo: 'cidade', rotulo: 'Cidade', tipo: 'cidade' },
  { campo: 'uf', rotulo: 'UF / Estado', tipo: 'uf' },
  { campo: 'endereco', rotulo: 'Endereço (texto completo)', tipo: 'texto' },
  { campo: 'observacoes', rotulo: 'Observações', tipo: 'texto' },
  { campo: 'origem', rotulo: 'Origem (como chegou)', tipo: 'texto' },
  { campo: 'origem_complemento', rotulo: 'Complemento da origem', tipo: 'texto' },
]

export const DESTINOS: Record<ColecaoDestino, DestinoColecao> = {
  pacientes: {
    colecao: 'pacientes',
    rotulo: 'Pacientes',
    descricao: 'Cadastro de pacientes (nome e telefone são obrigatórios)',
    campos: CAMPOS_PACIENTE,
  },
  consultas: {
    colecao: 'consultas',
    rotulo: 'Consultas',
    descricao: 'Histórico de atendimentos — o paciente é localizado pelo nome/telefone da planilha',
    campos: [
      { campo: 'paciente', rotulo: 'Paciente (nome ou telefone na planilha)', obrigatorio: true },
      { campo: 'data', rotulo: 'Data da consulta', tipo: 'data', obrigatorio: true },
      { campo: 'hora_inicio', rotulo: 'Hora de início (HH:MM)', obrigatorio: true },
      { campo: 'duracao_minutos', rotulo: 'Duração (minutos)', tipo: 'numero' },
      { campo: 'hora_fim', rotulo: 'Hora de término (HH:MM) — calculada se vazia' },
      { campo: 'status', rotulo: 'Status (agendada/realizada/cancelada/faltou)' },
      { campo: 'observacoes', rotulo: 'Observações' },
    ],
  },
  orcamentos: {
    colecao: 'orcamentos',
    rotulo: 'Planejamentos de Tratamento',
    descricao:
      'Planejamentos — o paciente é localizado pelo nome/telefone da planilha; itens em extras',
    campos: [
      { campo: 'paciente', rotulo: 'Paciente (nome ou telefone na planilha)', obrigatorio: true },
      { campo: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
      { campo: 'status', rotulo: 'Status (aberto/aceito/recusado)' },
      { campo: 'valor_total', rotulo: 'Valor total (R$)', tipo: 'numero' },
      { campo: 'observacoes', rotulo: 'Observações' },
    ],
  },
}

/** Palavras-chave que identificam a aba de pacientes numa planilha com várias abas. */
export const PALAVRAS_ABA_PACIENTES = ['contato', 'paciente', 'cliente']

/**
 * Molde do backup "Lista de Pacientes" do Dentista Organizado.
 *
 * O arquivo real tem uma única aba "Contatos" com 18 colunas. Mapear por
 * igualdade de nome não basta — este molde fixa o destino de cada coluna
 * conhecida, inclusive as que não têm campo próprio (vão para `extras` com
 * o nome original, para não perder informação clínica nem administrativa).
 */
export const MOLDE_DENTISTA_ORGANIZADO: Record<
  string,
  { campo?: string; extra?: string; ignorar?: boolean }
> = {
  nome: { campo: 'nome' },
  rg: { extra: 'RG' },
  cpf: { campo: 'cpf' },
  logradouro: { campo: 'logradouro' },
  numero: { campo: 'numero' },
  cep: { campo: 'cep' },
  bairro: { campo: 'bairro' },
  cidade: { campo: 'cidade' },
  estado: { campo: 'uf' },
  // Celular e residencial disputam o campo telefone: o celular tem prioridade
  // (é o que serve para WhatsApp). O residencial vai para extras.
  celular: { campo: 'telefone' },
  'fone residencial': { extra: 'Telefone residencial' },
  sexo: { extra: 'Sexo' },
  referencia: { campo: 'origem' },
  aniversario: { campo: 'data_nascimento' },
  // A data de cadastro não pode ir para `created` (o PocketBase ignora escrita
  // nesse campo), então fica em extras para preservar o histórico.
  'data cadastro': { extra: 'Data de cadastro no sistema antigo' },
  prontuario: { extra: 'Número do prontuário (sistema antigo)' },
  email: { campo: 'email' },
  responsavel: { extra: 'Responsável' },
}

/**
 * Molde da aba "Consultas" do backup completo do Dentista Organizado.
 *
 * ⚠️ Esta aba tem uma pegadinha: a coluna chamada `nome_completo` contém o nome
 * da DENTISTA (Marinalva Cordeiro, em 3.648 de 3.648 linhas), e o paciente está
 * na coluna chamada `nome`. Mapear por nome de coluna colocaria todas as
 * consultas na dentista.
 *
 * As datas vêm no formato "14/03/2022 -  09:50" (data e hora no mesmo campo).
 * O mapeamento é por POSIÇÃO, não por nome de coluna.
 */
export const MOLDE_CONSULTAS_DENTISTA_ORGANIZADO = {
  /** Confere se os cabeçalhos são dessa aba (tolerante a acento e caixa). */
  reconhece(colunas: string[]): boolean {
    const norm = (s: string) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z]+/g, ' ')
        .trim()
    const alvo = colunas.map(norm)
    return (
      alvo.includes('nome completo') &&
      alvo.some((c) => c.startsWith('data de in')) &&
      alvo.includes('status') &&
      alvo.includes('nome')
    )
  },

  /** Índices fixos das colunas nesta aba. */
  colunas: {
    paciente: 4, // "nome" — atenção: NÃO é "nome_completo"
    dataHoraInicio: 1, // "Data de Início" no formato "DD/MM/AAAA -  HH:MM"
    dataHoraFim: 2, // "Hora Fim", mesmo formato
    status: 3, // Confirmada / Agendada / Cancelada / Faltou
    observacoes: 5,
  },
}

/** Campos que, no molde, são guardados em `extras` em vez de coluna própria. */
export function destinoDoMolde(coluna: string): { campo?: string; extra?: string } | null {
  const chave = coluna
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return MOLDE_DENTISTA_ORGANIZADO[chave] || null
}
