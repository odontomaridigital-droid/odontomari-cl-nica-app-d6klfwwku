import React from 'react'
import { OdontomariLogoCompleta } from '@/components/OdontomariLogo'
import { Receita } from '@/types'
import { formatDateBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface ReceitaDocumentoProps {
  receita: Receita
  pacienteNome: string
  dentistaNome?: string
  dentistaCro?: string
  className?: string
}

/**
 * Visual imprimível da receita: cabeçalho da clínica com logo, dados do paciente,
 * itens numerados com posologia, orientações e campo de assinatura.
 * Usado tanto na tela (dentro do diálogo de visualização) quanto na impressão.
 */
export const ReceitaDocumento: React.FC<ReceitaDocumentoProps> = ({
  receita,
  pacienteNome,
  dentistaNome,
  dentistaCro,
  className,
}) => {
  const itens = Array.isArray(receita.itens) ? receita.itens : []

  return (
    <div
      className={cn(
        'receita-documento bg-white text-slate-900 border border-slate-200 rounded-lg p-5 sm:p-7',
        className,
      )}
    >
      {/* Cabeçalho da clínica: logo da marca + slogan embaixo, tipo de documento à direita */}
      <div className="flex items-start gap-4 border-b-2 border-marca-vermelho pb-4">
        <div className="flex flex-col items-center">
          <OdontomariLogoCompleta altura={48} />
          <p className="italic text-marca-vermelho text-[11px] mt-0.5 tracking-wide">
            semeando sorrisos
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
            Receituário Odontológico
          </p>
          <p className="text-sm font-semibold text-marca-vermelho">Receita</p>
        </div>
      </div>

      {/* Dados do paciente (sem "emitida por": a assinatura já identifica o profissional) */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400 uppercase text-[10px] tracking-wide">Paciente</p>
          <p className="font-semibold text-sm text-slate-900">{pacienteNome}</p>
        </div>
        <div>
          <p className="text-slate-400 uppercase text-[10px] tracking-wide">Data de emissão</p>
          <p className="font-semibold text-sm text-slate-900">{formatDateBr(receita.data)}</p>
        </div>
      </div>

      {/* Itens numerados com posologia */}
      <div className="mt-6 space-y-4">
        {itens.map((item, i) => (
          <div key={i} className="break-inside-avoid">
            <p className="text-sm font-semibold text-slate-900">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-marca-vermelho-claro text-marca-vermelho-escuro text-[10px] font-bold mr-1.5 align-middle">
                {i + 1}
              </span>
              {item.nome}
              {item.apresentacao && (
                <span className="font-normal text-slate-500"> — {item.apresentacao}</span>
              )}
            </p>
            <p className="text-sm text-slate-800 pl-6 mt-0.5 whitespace-pre-line">
              {item.posologia}
            </p>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-xs text-slate-400">Nenhum medicamento nesta receita.</p>
        )}
      </div>

      {/* Orientações gerais */}
      {receita.orientacoes?.trim() && (
        <div className="mt-6 border-t border-slate-200 pt-4 break-inside-avoid">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            Orientações gerais
          </p>
          <p className="text-sm text-slate-800 whitespace-pre-line mt-1">{receita.orientacoes}</p>
        </div>
      )}

      {/* Assinatura */}
      <div className="mt-10 break-inside-avoid">
        <div className="w-56 mx-auto border-t border-slate-400 pt-1.5 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {dentistaNome || receita.expand?.autor?.name || 'Dentista'}
          </p>
          {dentistaCro && <p className="text-xs text-slate-500">{dentistaCro}</p>}
        </div>
      </div>
    </div>
  )
}
