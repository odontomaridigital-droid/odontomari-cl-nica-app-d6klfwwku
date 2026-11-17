import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import { BuscaComLista, ItemBusca } from '@/components/busca/BuscaComLista'

/**
 * SeletorProcedimento — escolher um procedimento do catálogo com BUSCA.
 *
 * Antes era um <select> nativo ("Predefinidos..."): sem busca, o usuário
 * rolava 100 itens até achar. Agora abre uma lista com campo de busca, no
 * mesmo padrão de todas as outras buscas do sistema.
 */
interface SeletorProcedimentoProps {
  procedimentos: { id: string; nome: string; valor?: number; categoria?: string }[]
  onEscolher: (procedimentoId: string) => void
  /** Texto do botão fechado */
  rotulo?: string
  formatarValor?: (v: number) => string
}

const NOMES_CATEGORIA: Record<string, string> = {
  diagnostico: 'Diagnóstico',
  preventivo: 'Preventivo',
  restaurador: 'Restaurador',
  endodontia: 'Endodontia',
  periodontia: 'Periodontia',
  cirurgia: 'Cirurgia',
  implante: 'Implante',
  protese: 'Prótese',
  estetica: 'Estética',
  harmonizacao: 'Harmonização',
  outro: 'Outro',
}

export const SeletorProcedimento: React.FC<SeletorProcedimentoProps> = ({
  procedimentos,
  onEscolher,
  rotulo = 'Buscar procedimento',
  formatarValor,
}) => {
  const [aberto, setAberto] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const itens: ItemBusca[] = procedimentos.map((p) => ({
    id: p.id,
    nome: p.nome,
    detalhe: p.categoria ? NOMES_CATEGORIA[p.categoria] || p.categoria : undefined,
    direita: formatarValor && p.valor ? formatarValor(p.valor) : undefined,
    termosBusca: p.categoria,
  }))

  return (
    <div ref={caixaRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-marca-vermelho-escuro hover:border-marca-vermelho/50 flex items-center gap-1"
        title="Escolher do catálogo de procedimentos"
      >
        <Sparkles className="w-3 h-3" />
        {rotulo}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {aberto && (
        <div className="absolute z-40 right-0 mt-1 w-72 bg-white rounded-lg border border-slate-200 shadow-xl p-2">
          <BuscaComLista
            itens={itens}
            placeholder="Digite parte do nome..."
            vazioTexto="Nenhum procedimento com esse termo."
            abrirAoFocar
            alturaMaxima={240}
            onSelecionar={(it) => {
              onEscolher(it.id)
              setAberto(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
