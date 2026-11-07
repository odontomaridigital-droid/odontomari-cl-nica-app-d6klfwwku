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

/** Logo completa com o texto "Odontomari" — para o login e telas de destaque. */
export const OdontomariLogoCompleta: React.FC<OdontomariLogoCompletaProps> = ({
  altura = 96,
  className,
  titulo = 'Odontomari — Clínica Odontológica',
}) => {
  return (
    <img
      src={logoUrl}
      alt={titulo}
      title={titulo}
      style={{ height: altura }}
      className={cn('w-auto object-contain', className)}
      draggable={false}
    />
  )
}
