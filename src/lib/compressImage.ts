/**
 * Downscale + re-encode a photo as JPEG in the browser before it goes
 * anywhere. Phone cameras produce 4000px / 3–5 MB files, but nothing in
 * Spork renders wider than ~1600 device pixels, so storing the original
 * only burns Supabase storage + egress (the free-tier caps we hit first).
 *
 * 1600px long edge at q0.8 ≈ 200–350 KB — visually identical in the feed
 * and the full-screen viewer. The AI estimate uses a smaller 1024px copy.
 *
 * Falls back to the original file if the browser can't decode it
 * (e.g. an odd HEIC) so an upload never fails because of compression.
 */
export async function compressImage(file: File, maxDimensionPx = 1600, quality = 0.8): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale  = Math.min(1, maxDimensionPx / Math.max(bitmap.width, bitmap.height))
  const width  = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) return file

  // Already small and no downscale happened? Keep the original bytes.
  if (scale === 1 && blob.size >= file.size) return file

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
