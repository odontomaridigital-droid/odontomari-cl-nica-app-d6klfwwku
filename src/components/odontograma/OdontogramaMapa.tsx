import React from 'react'
import { cn } from '@/lib/utils'
import { CONDICAO_POR_ID, CondicaoDente, FaceDente } from '@/lib/odontograma'

export interface EstadoDente {
  dente: number
  condicao: CondicaoDente
  faces?: FaceDente[]
}

interface OdontogramaMapaProps {
  estados: EstadoDente[]
  selecionado?: number | null
  onSelecionar?: (dente: number) => void
  somenteLeitura?: boolean
  className?: string
}

// ===================== Desenho da arcada =====================
// Cada dente é desenhado como uma peça real (coroa), posicionada sobre uma
// elipse e girada para acompanhar a curva da boca — como num odontograma de
// consultório, e não como uma fila de números.

/** Ordem de exibição, da esquerda para a direita da tela. */
const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const VIEW_W = 880
const VIEW_H = 500
const CX = VIEW_W / 2
const CY_SUP = 218
const CY_INF = 288
const RAIO_X = 322
const RAIO_Y = 96

/** Largura e altura da coroa por tipo de dente. */
function dimensoesDente(dente: number): { w: number; h: number; tipo: TipoDente } {
  const posicao = dente % 10 // 1..8
  if (posicao <= 2) return { w: 26, h: 40, tipo: 'incisivo' }
  if (posicao === 3) return { w: 29, h: 44, tipo: 'canino' }
  if (posicao <= 5) return { w: 30, h: 38, tipo: 'premolar' }
  return { w: 34, h: 36, tipo: 'molar' }
}

type TipoDente = 'incisivo' | 'canino' | 'premolar' | 'molar'

/** Caminho da coroa no sistema local (0,0 no centro do dente). */
function caminhoCoroa(w: number, h: number, tipo: TipoDente): string {
  const x = -w / 2
  const y = -h / 2
  const r = Math.min(w, h) * 0.22

  if (tipo === 'canino') {
    // ponta arredondada na borda incisal (lado +y)
    return [
      `M ${x + r} ${y}`,
      `L ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r}`,
      `Q ${x + w} ${y + h} ${x + w - r * 1.6} ${y + h}`,
      `Q 0 ${y + h + 5} ${x + r * 1.6} ${y + h}`,
      `Q ${x} ${y + h} ${x} ${y + h - r}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      'Z',
    ].join(' ')
  }

  if (tipo === 'molar') {
    // topo levemente ondulado (cúspides) e base arredondada
    return [
      `M ${x + r} ${y}`,
      `Q ${x + w * 0.3} ${y - 3} ${x + w * 0.5} ${y}`,
      `Q ${x + w * 0.7} ${y - 3} ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r}`,
      `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
      `L ${x + r} ${y + h}`,
      `Q ${x} ${y + h} ${x} ${y + h - r}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      'Z',
    ].join(' ')
  }

  if (tipo === 'premolar') {
    return [
      `M ${x + r} ${y}`,
      `Q ${x + w * 0.5} ${y - 2.5} ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r}`,
      `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
      `L ${x + r} ${y + h}`,
      `Q ${x} ${y + h} ${x} ${y + h - r}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      'Z',
    ].join(' ')
  }

  // incisivo: borda incisal reta
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r * 0.6}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r * 0.6}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ')
}

/** Posição e rotação do dente na arcada. */
function posicaoDente(
  indice: number,
  arcada: 'superior' | 'inferior',
): { x: number; y: number; rot: number } {
  const total = 16
  const a = Math.PI - (Math.PI * (indice + 0.5)) / total
  const x = CX + RAIO_X * Math.cos(a)
  const cy = arcada === 'superior' ? CY_SUP : CY_INF
  const y = arcada === 'superior' ? cy - RAIO_Y * Math.sin(a) : cy + RAIO_Y * Math.sin(a)

  // superior: +y local aponta para o centro da boca (para baixo);
  // inferior: +y local aponta para cima (para o centro).
  const rot = arcada === 'superior' ? 90 - (a * 180) / Math.PI : 270 - (a * 180) / Math.PI
  return { x, y, rot }
}

export const OdontogramaMapa: React.FC<OdontogramaMapaProps> = ({
  estados,
  selecionado,
  onSelecionar,
  somenteLeitura,
  className,
}) => {
  const mapa = new Map<number, EstadoDente>()
  for (const e of estados) mapa.set(e.dente, e)

  const corDe = (dente: number) => {
    const cond = mapa.get(dente)?.condicao || 'higido'
    return CONDICAO_POR_ID[cond] || CONDICAO_POR_ID.higido
  }

  const desenharDente = (dente: number, indice: number, arcada: 'superior' | 'inferior') => {
    const { w, h, tipo } = dimensoesDente(dente)
    const { x, y, rot } = posicaoDente(indice, arcada)
    const info = corDe(dente)
    const ativo = selecionado === dente
    const alterado = (mapa.get(dente)?.condicao || 'higido') !== 'higido'

    // Rótulo do número fora da arcada, sempre na horizontal
    const alcance = arcada === 'superior' ? y - h / 2 - 14 : y + h / 2 + 14
    const a = Math.PI - (Math.PI * (indice + 0.5)) / 16
    const lx = CX + (RAIO_X + 26) * Math.cos(a)
    const ly =
      arcada === 'superior'
        ? CY_SUP - (RAIO_Y + 34) * Math.sin(a)
        : CY_INF + (RAIO_Y + 34) * Math.sin(a)

    return (
      <g key={dente}>
        <g
          transform={`translate(${x} ${y}) rotate(${rot})`}
          onClick={() => !somenteLeitura && onSelecionar?.(dente)}
          style={{ cursor: somenteLeitura ? 'default' : 'pointer' }}
          role="button"
          aria-label={`Dente ${dente}`}
        >
          {/* contorno de seleção */}
          <path
            d={caminhoCoroa(w + 7, h + 7, tipo)}
            fill="transparent"
            stroke={ativo ? '#C8202E' : 'transparent'}
            strokeWidth={2.5}
          />
          <path
            d={caminhoCoroa(w, h, tipo)}
            fill={info.cor}
            stroke={alterado ? info.cor : '#cbd5e1'}
            strokeWidth={1.5}
            className={cn('transition-all', !somenteLeitura && 'hover:brightness-95')}
          />
          {/* sulco oclusal nos posteriores, para parecer dente de verdade */}
          {(tipo === 'molar' || tipo === 'premolar') && (
            <line
              x1={-w / 2 + 5}
              y1={h * 0.16}
              x2={w / 2 - 5}
              y2={h * 0.16}
              stroke={alterado && info.texto === '#ffffff' ? 'rgba(255,255,255,0.55)' : '#cbd5e1'}
              strokeWidth={1}
            />
          )}
          {/* sigla da condição dentro do dente */}
          {alterado && info.sigla && (
            <text
              x={0}
              y={h * 0.16 + 8}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={info.texto}
              style={{ pointerEvents: 'none' }}
            >
              {info.sigla}
            </text>
          )}
        </g>
        <text
          x={lx}
          y={ly + 3}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={600}
          fill={selecionado === dente ? '#C8202E' : '#94a3b8'}
          style={{ pointerEvents: 'none' }}
        >
          {dente}
        </text>
      </g>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto max-h-[420px] mx-auto select-none"
        role="group"
        aria-label="Odontograma — arcada superior e inferior"
      >
        {/* Arcada superior */}
        <ellipse
          cx={CX}
          cy={CY_SUP}
          rx={RAIO_X + 4}
          ry={RAIO_Y + 4}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={26}
        />
        {ARCADA_SUPERIOR.map((d, i) => desenharDente(d, i, 'superior'))}

        {/* Linha média / oclusão */}
        <line
          x1={CX - RAIO_X}
          y1={253}
          x2={CX + RAIO_X}
          y2={253}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <text x={CX} y={250} textAnchor="middle" fontSize={9} fill="#cbd5e1" fontWeight={600}>
          PLANO OCLUSAL
        </text>

        {/* Arcada inferior */}
        <ellipse
          cx={CX}
          cy={CY_INF}
          rx={RAIO_X + 4}
          ry={RAIO_Y + 4}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={26}
        />
        {ARCADA_INFERIOR.map((d, i) => desenharDente(d, i, 'inferior'))}
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
        {Object.values(CONDICAO_POR_ID)
          .filter((c) => c.id !== 'higido')
          .map((c) => (
            <span key={c.id} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span
                className="w-2.5 h-2.5 rounded-[3px] border border-slate-300 shrink-0"
                style={{ backgroundColor: c.cor }}
              />
              {c.label}
            </span>
          ))}
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-[3px] border border-slate-300 bg-white shrink-0" />
          Hígido
        </span>
      </div>
    </div>
  )
}

/** Versão compacta de leitura — sem legenda, usada em cards e resumos. */
export const OdontogramaMini: React.FC<{ estados: EstadoDente[] }> = ({ estados }) => {
  const mapa = new Map<number, CondicaoDente>()
  for (const e of estados) mapa.set(e.dente, e.condicao)
  const alterados = estados.filter((e) => e.condicao !== 'higido')
  if (alterados.length === 0) return null
  return (
    <div className="flex flex-wrap gap-0.5">
      {alterados.map((e) => {
        const info = CONDICAO_POR_ID[e.condicao]
        return (
          <span
            key={e.dente}
            title={`${e.dente} — ${info?.label}`}
            className="w-4 h-4 rounded-[3px] text-[7px] font-bold flex items-center justify-center"
            style={{ backgroundColor: info?.cor, color: info?.texto }}
          >
            {e.dente}
          </span>
        )
      })}
    </div>
  )
}
