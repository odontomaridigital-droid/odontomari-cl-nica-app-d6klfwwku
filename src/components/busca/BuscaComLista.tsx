import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'

/**
 * BuscaComLista — o padrão único de busca do Odontomari.
 *
 * Por que existe: cada tela tinha um jeito diferente de procurar. Uma filtrava
 * na lista, outra usava um <select> nativo sem busca, outra não tinha busca
 * nenhuma. Aqui fica um componente só, e todas as telas usam ele — assim o
 * comportamento é idêntico em qualquer lugar do sistema.
 *
 * Como funciona:
 *  - Digitar filtra a lista na hora (ignora acento e maiúscula).
 *  - A lista aparece logo abaixo, com altura fixa e barra de rolagem: nunca
 *    "empurra" a tela, por mais itens que existam.
 *  - Ordem alfabética por padrão.
 *  - Serve tanto para escolher um item (modo seleção) quanto só para achar
 *    (modo lista, sem escolha).
 */

export interface ItemBusca {
  id: string
  /** Texto principal, o que aparece em destaque */
  nome: string
  /** Linha secundária, opcional (telefone, valor, categoria…) */
  detalhe?: string
  /** Termos extras que entram na busca mas não aparecem (ex.: código) */
  termosBusca?: string
  /** Dados originais do item, devolvidos no onSelecionar */
  original?: any
  /** Texto à direita, destacado (ex.: valor) */
  direita?: string
  /** Item indisponível — aparece na lista, apagado e sem clique */
  desabilitado?: boolean
}

interface BuscaComListaProps {
  itens: ItemBusca[]
  placeholder?: string
  /** Chamado ao clicar num item (modo seleção) */
  onSelecionar?: (item: ItemBusca) => void
  vazioTexto?: string
  /** Id do item já escolhido, mostrado como marcado */
  selecionadoId?: string
  /** Limpa a busca quando escolhe um item (padrão: true no modo seleção) */
  limparAoEscolher?: boolean
  /** Ordenação da lista (padrão: alfabética por nome) */
  ordenar?: (a: ItemBusca, b: ItemBusca) => number
  /** Abre a lista já ao carregar (útil dentro de modal pequeno) */
  abrirAoFocar?: boolean
  className?: string
  /** Altura máxima da lista em pixels (padrão 224) */
  alturaMaxima?: number
}

/** Remove acentos e caixa para comparar */
export function normalizarBusca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export const BuscaComLista: React.FC<BuscaComListaProps> = ({
  itens,
  placeholder = 'Buscar...',
  onSelecionar,
  vazioTexto = 'Nada encontrado com esse termo.',
  selecionadoId,
  limparAoEscolher,
  ordenar,
  abrirAoFocar = false,
  className = '',
  alturaMaxima = 224,
}) => {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(abrirAoFocar)
  const caixaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const limparAoEscolherFinal = limparAoEscolher ?? Boolean(onSelecionar)

  // fecha ao clicar fora
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const filtrados = useMemo(() => {
    const q = normalizarBusca(texto)
    const base = q
      ? itens.filter((it) => {
          const alvo = normalizarBusca(
            `${it.nome} ${it.detalhe || ''} ${it.termosBusca || ''} ${it.direita || ''}`,
          )
          return alvo.includes(q)
        })
      : itens
    const ordenado = [...base]
    ordenado.sort(ordenar || ((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    return ordenado
  }, [itens, texto, ordenar])

  const escolher = (item: ItemBusca) => {
    if (item.desabilitado) return
    onSelecionar?.(item)
    if (limparAoEscolherFinal) {
      setTexto('')
      setAberto(false)
    }
  }

  return (
    <div ref={caixaRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setAberto(true)
          }}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          className="w-full h-9 rounded-md border border-slate-300 bg-white pl-8 pr-8 text-xs sm:text-sm outline-none focus:border-marca-vermelho"
        />
        {texto ? (
          <button
            type="button"
            onClick={() => {
              setTexto('')
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            title="Limpar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>

      {aberto && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg overflow-y-auto"
          style={{ maxHeight: alturaMaxima }}
        >
          {filtrados.length === 0 ? (
            <p className="p-3 text-center text-[11px] text-slate-500">{vazioTexto}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtrados.map((it) => {
                const marcado = selecionadoId && it.id === selecionadoId
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      disabled={it.desabilitado}
                      onClick={() => escolher(it)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                        it.desabilitado
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-marca-vermelho-claro/60'
                      } ${marcado ? 'bg-marca-vermelho-claro/70' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-slate-900 truncate">
                          {it.nome}
                        </span>
                        {it.detalhe && (
                          <span className="block text-[11px] text-slate-500 truncate">
                            {it.detalhe}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {it.direita && (
                          <span className="text-[11px] font-semibold text-marca-vermelho">
                            {it.direita}
                          </span>
                        )}
                        {marcado && <Check className="w-3.5 h-3.5 text-marca-vermelho" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {itens.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">
          {filtrados.length} de {itens.length}
          {filtrados.length !== itens.length ? ' encontrados' : ' itens'}
        </p>
      )}
    </div>
  )
}
