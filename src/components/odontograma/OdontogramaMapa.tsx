import React from 'react'
import { cn } from '@/lib/utils'
import {
  CONDICAO_POR_ID,
  CondicaoDente,
  QUADRANTES_INFERIOR,
  QUADRANTES_SUPERIOR,
  TODOS_OS_DENTES,
} from '@/lib/odontograma'

export interface EstadoDente {
  dente: number
  condicao: CondicaoDente
}

interface OdontogramaMapaProps {
  estados: EstadoDente[]
  /** Dente selecionado no momento (destacado com anel) */
  selecionado?: number | null
  onSelecionar?: (dente: number) => void
  /** Modo leitura: sem cursor de clique e sem hover */
  somenteLeitura?: boolean
  className?: string
}

/**
 * Mapa visual dos 32 dentes permanentes.
 * Arco superior: quadrantes 1 (direita do paciente) e 2 (esquerda), exibidos
 * da esquerda para a direita da TELA — por isso o quadrante 1 aparece invertido.
 * Arco inferior segue a mesma lógica com os quadrantes 4 e 3.
 */
export const OdontogramaMapa: React.FC<OdontogramaMapaProps> = ({
  estados,
  selecionado,
  onSelecionar,
  somenteLeitura,
  className,
}) => {
  const mapa = new Map<number, CondicaoDente>()
  for (const e of estados) mapa.set(e.dente, e.condicao)

  const renderDente = (dente: number) => {
    const condicao = mapa.get(dente) || 'higido'
    const info = CONDICAO_POR_ID[condicao]
    const ativo = selecionado === dente
    return (
      <button
        key={dente}
        type="button"
        disabled={somenteLeitura}
        onClick={() => onSelecionar?.(dente)}
        title={`Dente ${dente} — ${info?.label || condicao}`}
        aria-label={`Dente ${dente}, ${info?.label || condicao}`}
        className={cn(
          'group relative flex flex-col items-center gap-0.5 outline-none',
          !somenteLeitura && 'cursor-pointer',
        )}
      >
        <span className="text-[9px] font-semibold text-slate-400 leading-none">{dente}</span>
        <span
          className={cn(
            'flex items-center justify-center rounded-md border-2 transition-all',
            'w-6 h-8 sm:w-7 sm:h-9 text-[9px] font-bold',
            ativo
              ? 'border-marca-vermelho ring-2 ring-marca-vermelho/30 scale-105'
              : 'border-slate-300',
            !somenteLeitura && 'group-hover:border-marca-vermelho/70 group-hover:scale-105',
          )}
          style={{ backgroundColor: info?.cor, color: info?.texto }}
        >
          {info?.sigla || ''}
        </span>
      </button>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Arco superior */}
      <div className="flex items-start justify-center gap-1 sm:gap-2">
        {QUADRANTES_SUPERIOR.map((q, idx) => (
          <React.Fragment key={q.id}>
            <div className="flex gap-0.5 sm:gap-1">
              {(idx === 0 ? q.dentes : q.dentes).map(renderDente)}
            </div>
            {idx === 0 && <div className="w-px self-stretch bg-slate-200 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Linha média (oclusão) */}
      <div className="flex items-center gap-2 px-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[9px] font-medium text-slate-300 uppercase tracking-wider">
          Linha média
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Arco inferior */}
      <div className="flex items-start justify-center gap-1 sm:gap-2">
        {QUADRANTES_INFERIOR.map((q, idx) => (
          <React.Fragment key={q.id}>
            <div className="flex gap-0.5 sm:gap-1">{q.dentes.map(renderDente)}</div>
            {idx === 0 && <div className="w-px self-stretch bg-slate-200 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-2">
        {Object.values(CONDICAO_POR_ID)
          .filter((c) => (mapa.size === 0 ? c.id !== 'higido' : true))
          .filter((c) => c.id !== 'higido')
          .map((c) => (
            <span key={c.id} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span
                className="w-2.5 h-2.5 rounded-sm border border-slate-300 shrink-0"
                style={{ backgroundColor: c.cor }}
              />
              {c.label}
            </span>
          ))}
      </div>
    </div>
  )
}

/** Versão compacta de leitura — sem legenda, usada em cards e resumos. */
export const OdontogramaMini: React.FC<{ estados: EstadoDente[] }> = ({ estados }) => {
  const mapa = new Map<number, CondicaoDente>()
  for (const e of estados) mapa.set(e.dente, e.condicao)
  return (
    <div className="flex flex-wrap gap-0.5">
      {TODOS_OS_DENTES.map((d) => {
        const condicao = mapa.get(d)
        if (!condicao || condicao === 'higido') return null
        const info = CONDICAO_POR_ID[condicao]
        return (
          <span
            key={d}
            title={`${d} — ${info?.label}`}
            className="w-3.5 h-3.5 rounded-sm text-[7px] font-bold flex items-center justify-center"
            style={{ backgroundColor: info?.cor, color: info?.texto }}
          >
            {info?.sigla}
          </span>
        )
      })}
    </div>
  )
}
