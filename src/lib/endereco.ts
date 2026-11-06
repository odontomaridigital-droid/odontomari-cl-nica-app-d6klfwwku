import type { Paciente } from '@/types'

export interface EnderecoForm {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export const enderecoVazio: EnderecoForm = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

/** Máscara 00000-000 (aceita até 8 dígitos). */
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/**
 * Consulta o ViaCEP diretamente pelo frontend (sem chave).
 * Lança Error com mensagem para o usuário quando o CEP não existe ou a consulta falha.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<Partial<EnderecoForm>> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido. Informe os 8 dígitos.')
  }

  let data: any
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) {
      throw new Error('CEP não encontrado.')
    }
    data = await res.json()
  } catch (err: any) {
    if (err instanceof Error && err.message === 'CEP não encontrado.') throw err
    throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.')
  }

  if (!data || data.erro) {
    throw new Error('CEP não encontrado. Preencha o endereço manualmente.')
  }

  return {
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    cidade: data.localidade || '',
    uf: data.uf || '',
  }
}

/** Texto único do endereço, gravado também no campo legado `endereco`. */
export function montarEnderecoTexto(e: Partial<EnderecoForm>): string {
  const cidadeUf = e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade || e.uf || ''
  const partes = [
    e.logradouro,
    e.numero,
    e.complemento,
    e.bairro,
    cidadeUf,
    e.cep ? `CEP ${e.cep}` : '',
  ]
  return partes
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ')
}

/** Endereço do cadastro para preencher o formulário; usa o texto legado quando não há campos separados. */
export function enderecoDeRegistro(p: Partial<Paciente>): EnderecoForm {
  const temCampos = Boolean(p.logradouro || p.cep || p.cidade)
  return {
    cep: p.cep || '',
    logradouro: temCampos ? p.logradouro || '' : p.endereco || '',
    numero: p.numero || '',
    complemento: p.complemento || '',
    bairro: p.bairro || '',
    cidade: p.cidade || '',
    uf: p.uf || '',
  }
}
