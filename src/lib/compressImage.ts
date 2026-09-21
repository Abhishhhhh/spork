/**
 * Downscale + re-encode a photo as JPEG in the browser before it goes
 * anywhere. Phone cameras produce 4000px / 3–5 MB files, but nothing in
 * Spork renders wider than ~1600 device pixels, so storing the original
 * only burns Supabase storage + egress (the free-tier caps we hit first).
 *
 * 1600px long edge at q0.8 ≈ 200–350 KB — visually identical in the feed
 * and the full-screen viewer. The AI estimate uses a smaller 1024px copy.
 *
 * Decoding goes through an <img> element rather than createImageBitmap:
 * every browser applies the EXIF orientation there (Android Chrome's
 * createImageBitmap doesn't by default, which turns portrait shots
 * sideways once the canvas strips EXIF), and Safari can decode HEIC that
 * way. createImageBitmap is only the fallback. If nothing can decode the
 * file we return it unchanged so a post never fails because of this.
 */
type Decoded = { source: CanvasImageSource; width: number; height: number; cleanup: () => void }

function decodeViaImg(file: File): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth, height = img.naturalHeight
      if (!width || !height) { URL.revokeObjectURL(url); reject(new Error('empty image')); return }
      resolve({ source: img, width, height, cleanup: () => URL.revokeObjectURL(url) })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img decode failed')) }
    img.src = url
  })
}

async function decodeViaBitmap(file: File): Promise<Decoded> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() }
}

export async function compressImage(file: File, maxDimensionPx = 1600, quality = 0.8): Promise<File> {
  let decoded: Decoded
  try {
    decoded = await decodeViaImg(file)
  } catch {
    try {
      decoded = await decodeViaBitmap(file)
    } catch {
      console.warn('[compressImage] could not decode', file.type, file.size)
      return file
    }
  }

  try {
    const scale  = Math.min(1, maxDimensionPx / Math.max(decoded.width, decoded.height))
    const width  = Math.round(decoded.width * scale)
    const height = Math.round(decoded.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(decoded.source, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file

    // Already small and no downscale happened? Keep the original bytes.
    if (scale === 1 && blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    decoded.cleanup()
  }
}
