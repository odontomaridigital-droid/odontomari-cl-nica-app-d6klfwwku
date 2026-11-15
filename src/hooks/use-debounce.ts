import { useEffect, useState } from 'react'

/**
 * Devolve o valor recebido só depois de `atrasoMs` sem mudança.
 *
 * Usado nas buscas do sistema: enquanto a pessoa digita, a busca não roda;
 * quando ela para de digitar por um instante, a busca dispara sozinha.
 * Evita uma requisição por tecla.
 */
export function useDebounce<T>(valor: T, atrasoMs = 350): T {
  const [valorComAtraso, setValorComAtraso] = useState<T>(valor)

  useEffect(() => {
    const timer = setTimeout(() => setValorComAtraso(valor), atrasoMs)
    return () => clearTimeout(timer)
  }, [valor, atrasoMs])

  return valorComAtraso
}
