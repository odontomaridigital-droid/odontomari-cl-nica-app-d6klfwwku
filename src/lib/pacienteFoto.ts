import pb from '@/lib/pocketbase/client'

/** URL de foto de paciente gravada no PocketBase, com fallback undefined. */
export function pacienteFotoUrl(p: { id: string; foto?: string }): string | undefined {
  if (!p?.foto) return undefined
  return pb.files.getURL(p as any, p.foto)
}
