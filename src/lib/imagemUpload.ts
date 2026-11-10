/** Compressão de imagem no cliente (canvas) antes do upload da foto do paciente. */
export async function comprimirImagem(file: File, maxLado = 500, qualidade = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Imagem inválida.'))
    image.src = dataUrl
  })

  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const largura = Math.max(1, Math.round(img.width * escala))
  const altura = Math.max(1, Math.round(img.height * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, largura, altura)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', qualidade),
  )
  if (!blob) return file

  const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '-foto.jpg'
  return new File([blob], nome, { type: 'image/jpeg' })
}
