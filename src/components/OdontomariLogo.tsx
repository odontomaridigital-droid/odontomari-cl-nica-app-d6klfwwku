import React from 'react'
import logoUrl from '@/assets/odontomari-logo-novo-87a22.png'
import { cn } from '@/lib/utils'

interface OdontomariLogoProps {
  /** Altura em px do símbolo (o "m"). A proporção original é preservada. */
  altura?: number
  className?: string
  /** Título acessível */
  titulo?: string
}

/**
 * Logo oficial da clínica Odontomari (asset enviado pela clínica).
 * O PNG é quadrado, com o símbolo "m" ocupando a região central-superior;
 * o recorte via object-fit/object-position isola o símbolo sem distorcer.
 */
export const OdontomariLogoSimbolo: React.FC<OdontomariLogoProps> = ({
  altura = 36,
  className,
  titulo = 'Odontomari',
}) => {
  return (
    <img
      src={logoUrl}
      alt={titulo}
      title={titulo}
      style={{ height: altura, width: altura }}
      className={cn('object-cover object-[50%_22%] scale-[1.9] shrink-0', className)}
      draggable={false}
    />
  )
}

interface OdontomariLogoCompletaProps extends OdontomariLogoProps {
  /** Altura em px da logo completa (símbolo + texto). */
}

/**
 * Fração inferior da imagem (409×505 px) que contém o slogan "semeando sorrisos"
 * embutido em preto — invisível em fundos escuros. Recortamos essa faixa via CSS
 * (overflow-hidden) e o slogan é renderizado como texto do app
 * (componente OdontomariSlogan), para nunca duplicar nem sumir.
 */
const FRACAO_SLOGAN_IMAGEM = 0.18

/** Logo completa (símbolo + texto "Odontomari"), sem a faixa do slogan embutido. */
export const OdontomariLogoCompleta: React.FC<OdontomariLogoCompletaProps> = ({
  altura = 96,
  className,
  titulo = 'Odontomari — Clínica Odontológica',
}) => {
  return (
    <div
      className={cn('overflow-hidden shrink-0', className)}
      style={{ height: altura }}
      title={titulo}
    >
      <img
        src={logoUrl}
        alt={titulo}
        style={{ height: altura / (1 - FRACAO_SLOGAN_IMAGEM) }}
        className="w-auto object-contain block max-w-none"
        draggable={false}
      />
    </div>
  )
}

interface OdontomariSloganProps {
  /** Use true quando o slogan ficar sobre fundo grafite (sidebar/header). */
  sobreFundoEscuro?: boolean
  className?: string
}

/** Slogan "semeando sorrisos" renderizado como texto do app — sempre legível. */
export const OdontomariSlogan: React.FC<OdontomariSloganProps> = ({
  sobreFundoEscuro = false,
  className,
}) => (
  <p
    className={cn(
      'italic tracking-wide select-none',
      sobreFundoEscuro ? 'text-white/80' : 'text-marca-vermelho',
      className,
    )}
  >
    semeando sorrisos
  </p>
)
