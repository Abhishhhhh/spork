import { supabase } from './supabase'
import { parseEstimateResponse } from './parseEstimate'
import type { EstimateResult } from '../store/logDraft'

const MAX_DIMENSION_PX = 1024
const JPEG_QUALITY = 0.8

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Calls the estimate-meal Edge Function. Returns null on ANY failure —
 * network error, non-2xx response, or a shape parseEstimateResponse
 * rejects — never throws. The Log flow's fallback rule (spec §6) treats
 * every failure mode identically: blank manual-entry fields, log never
 * blocked.
 */
export async function estimateMeal(photo: File, description: string): Promise<EstimateResult | null> {
  try {
    const resized = await resizeImage(photo)
    const photoBase64 = await blobToBase64(resized)

    const { data, error } = await supabase.functions.invoke('estimate-meal', {
      body: { photoBase64, description },
    })

    if (error) return null

    const parsed = parseEstimateResponse(data)
    if (!parsed) return null

    return { parsed, raw: data }
  } catch {
    return null
  }
}
