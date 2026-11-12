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
// A boca é desenhada como duas arcadas curvas. Cada dente é uma coroa com o
// formato do grupo a que pertence (incisivo, canino, pré-molar, molar), levemente
// inclinada para acompanhar a curva — como no odontograma de consultório.

const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const TOTAL = 16
const PASSO = 46 // distância horizontal entre centros de dentes
const LARGURA = PASSO * (TOTAL - 1) + 120 // 810
const ALTURA = 460
const CX = LARGURA / 2

const CY_SUP = 168 // linha de referência do arco superior
const CY_INF = 292 // linha de referência do arco inferior
const CURVA = 34 // quanto as pontas do arco sobem/descem
const INCLINACAO = 15 // graus de inclinação máxima nas pontas

type TipoDente = 'incisivo' | 'canino' | 'premolar' | 'molar'

function dimensoesDente(dente: number): { w: number; h: number; tipo: TipoDente } {
  const posicao = dente % 10
  if (posicao <= 2) return { w: 27, h: 42, tipo: 'incisivo' }
  if (posicao === 3) return { w: 30, h: 46, tipo: 'canino' }
  if (posicao <= 5) return { w: 31, h: 40, tipo: 'premolar' }
  return { w: 35, h: 38, tipo: 'molar' }
}

/** Contorno da coroa no sistema local, com o centro em (0,0) e a borda
 *  oclusal/incisal no lado +y (que aponta para o centro da boca). */
function caminhoCoroa(w: number, h: number, tipo: TipoDente): string {
  const x = -w / 2
  const y = -h / 2
  const r = Math.min(w, h) * 0.2

  if (tipo === 'canino') {
    return [
      `M ${x + r} ${y}`,
      `L ${x + w - r} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + r}`,
      `L ${x + w} ${y + h - r * 1.4}`,
      `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
      `Q ${x + w / 2} ${y + h + 7} ${x + r} ${y + h}`,
      `Q ${x} ${y + h} ${x} ${y + h - r * 1.4}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      'Z',
    ].join(' ')
  }

  if (tipo === 'molar') {
    return [
      `M ${x + r} ${y}`,
      `Q ${x + w * 0.28} ${y - 4} ${x + w * 0.5} ${y}`,
      `Q ${x + w * 0.72} ${y - 4} ${x + w - r} ${y}`,
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
      `Q ${x + w * 0.5} ${y - 3} ${x + w - r} ${y}`,
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
    `L ${x + w} ${y + h - r * 0.5}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r * 0.5}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ')
}

/** Posição e inclinação de cada dente no arco. */
function posicaoDente(indice: number, arcada: 'superior' | 'inferior') {
  // t vai de -1 (extremo esquerdo da tela) a +1 (extremo direito)
  const t = (indice - (TOTAL - 1) / 2) / ((TOTAL - 1) / 2)
  const x = CX + (indice - (TOTAL - 1) / 2) * PASSO
  // As pontas do arco (molares) ficam mais para fora do plano oclusal
  const deslocamento = CURVA * t * t
  const y = arcada === 'superior' ? CY_SUP - deslocamento : CY_INF + deslocamento
  // Inclinação suave: o dente aponta para o centro do arco
  const rot = arcada === 'superior' ? t * INCLINACAO : t * -INCLINACAO
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

  const desenharDente = (dente: number, indice: number, arcada: 'superior' | 'inferior') => {
    const { w, h, tipo } = dimensoesDente(dente)
    const { x, y, rot } = posicaoDente(indice, arcada)
    const estado = mapa.get(dente)
    const info = CONDICAO_POR_ID[estado?.condicao || 'higido'] || CONDICAO_POR_ID.higido
    const alterado = (estado?.condicao || 'higido') !== 'higido'
    const ativo = selecionado === dente
    const textoClaro = info.texto === '#ffffff'

    const yRotulo = arcada === 'superior' ? y - h / 2 - 9 : y + h / 2 + 15

    return (
      <g key={dente}>
        <g
          transform={`translate(${x} ${y}) rotate(${rot})`}
          onClick={() => !somenteLeitura && onSelecionar?.(dente)}
          style={{ cursor: somenteLeitura ? 'default' : 'pointer' }}
          role="button"
          aria-label={`Dente ${dente}${alterado ? ` — ${info.label}` : ''}`}
        >
          {/* halo de seleção */}
          <path
            d={caminhoCoroa(w + 8, h + 8, tipo)}
            fill={ativo ? 'rgba(200,32,46,0.12)' : 'transparent'}
            stroke={ativo ? '#C8202E' : 'transparent'}
            strokeWidth={2}
          />
          <path
            d={caminhoCoroa(w, h, tipo)}
            fill={info.cor}
            stroke={alterado ? '#94a3b8' : '#cbd5e1'}
            strokeWidth={1.3}
            className={cn('transition-all duration-100', !somenteLeitura && 'hover:brightness-95')}
          />
          {/* sulco oclusal nos posteriores */}
          {(tipo === 'molar' || tipo === 'premolar') && (
            <line
              x1={-w / 2 + 6}
              y1={h / 2 - 9}
              x2={w / 2 - 6}
              y2={h / 2 - 9}
              stroke={textoClaro && alterado ? 'rgba(255,255,255,0.5)' : '#e2e8f0'}
              strokeWidth={1}
            />
          )}
          {alterado && info.sigla && (
            <text
              x={0}
              y={h / 2 - 13}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fill={info.texto}
              style={{ pointerEvents: 'none' }}
            >
              {info.sigla}
            </text>
          )}
        </g>
        <text
          x={x}
          y={yRotulo}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={ativo ? 700 : 600}
          fill={ativo ? '#C8202E' : '#94a3b8'}
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
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="w-full h-auto select-none"
        role="group"
        aria-label="Odontograma — arcada superior e inferior"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Arcada superior */}
        {ARCADA_SUPERIOR.map((d, i) => desenharDente(d, i, 'superior'))}

        {/* Plano oclusal */}
        <line
          x1={30}
          y1={ALTURA / 2}
          x2={LARGURA - 30}
          y2={ALTURA / 2}
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeDasharray="6 6"
        />
        <text
          x={CX}
          y={ALTURA / 2 - 5}
          textAnchor="middle"
          fontSize={8.5}
          fontWeight={600}
          fill="#cbd5e1"
          letterSpacing="0.5"
        >
          PLANO OCLUSAL
        </text>

        {/* Arcada inferior */}
        {ARCADA_INFERIOR.map((d, i) => desenharDente(d, i, 'inferior'))}

        {/* Divisória dos quadrantes (linha média) */}
        <line x1={CX} y1={70} x2={CX} y2={ALTURA / 2 - 14} stroke="#f1f5f9" strokeWidth={1} />
        <line
          x1={CX}
          y1={ALTURA / 2 + 14}
          x2={CX}
          y2={ALTURA - 70}
          stroke="#f1f5f9"
          strokeWidth={1}
        />
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-[3px] border border-slate-300 bg-white shrink-0" />
          Hígido
        </span>
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
      </div>
    </div>
  )
}

/** Versão compacta de leitura — sem legenda, usada em cards e resumos. */
export const OdontogramaMini: React.FC<{ estados: EstadoDente[] }> = ({ estados }) => {
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
