/** Rótulos e campos de destino para cada coleção que o wizard de importação suporta. */

export type ColecaoDestino = 'pacientes' | 'consultas' | 'orcamentos'

export interface DestinoCampo {
  /** Nome do campo no PocketBase */
  campo: string
  /** Rótulo amigável exibido na UI */
  rotulo: string
  /** Obrigatório para o registro ser gravado */
  obrigatorio?: boolean
  tipo?: 'texto' | 'data' | 'telefone' | 'cpf' | 'email' | 'numero' | 'json'
}

export interface DestinoColecao {
  colecao: ColecaoDestino
  rotulo: string
  descricao: string
  campos: DestinoCampo[]
}

const CAMPOS_PACIENTE: DestinoCampo[] = [
  { campo: 'nome', rotulo: 'Nome', obrigatorio: true, tipo: 'texto' },
  { campo: 'telefone', rotulo: 'Telefone (WhatsApp)', obrigatorio: true, tipo: 'telefone' },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
  { campo: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data' },
  { campo: 'cpf', rotulo: 'CPF', tipo: 'cpf' },
  { campo: 'cep', rotulo: 'CEP', tipo: 'texto' },
  { campo: 'logradouro', rotulo: 'Logradouro', tipo: 'texto' },
  { campo: 'numero', rotulo: 'Número', tipo: 'texto' },
  { campo: 'complemento', rotulo: 'Complemento', tipo: 'texto' },
  { campo: 'bairro', rotulo: 'Bairro', tipo: 'texto' },
  { campo: 'cidade', rotulo: 'Cidade', tipo: 'texto' },
  { campo: 'uf', rotulo: 'UF', tipo: 'texto' },
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
