#!/usr/bin/env node
// One-off: downscale every existing object in the `meal-photos` and
// `avatars` buckets to the same limits new uploads use (see
// src/lib/compressImage.ts): 1600px long edge for meals, 512px for
// avatars, JPEG q80, EXIF rotation baked in. Objects are overwritten in
// place at the same path, so `logs.photo_url` / `users.photo_url` keep
// working; only the bytes shrink.
//
// Needs the SERVICE ROLE key (bypasses RLS) — run it locally, never ship it.
//
//   npm i --no-save sharp
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//     node scripts/shrink-photos.mjs            # dry run: prints what it would do
//   ... node scripts/shrink-photos.mjs --apply  # actually rewrite the files
//
// Safe to re-run: files already at/below the limit are skipped.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
if (!URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BUCKETS = [
  { name: 'meal-photos', maxDim: 1600 },
  { name: 'avatars',     maxDim: 512 },
]
const QUALITY = 80
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?)$/i

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

async function listAll(bucket, prefix = '') {
  const out = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw error
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) out.push(...(await listAll(bucket, path)))   // folder
      else out.push({ path, size: entry.metadata?.size ?? 0 })
    }
    if (data.length < 1000) break
    offset += 1000
  }
  return out
}

const fmt = (n) => `${(n / 1024).toFixed(0)} KB`
let totalBefore = 0, totalAfter = 0, changed = 0, skipped = 0, failed = 0

for (const { name: bucket, maxDim } of BUCKETS) {
  const files = (await listAll(bucket)).filter((f) => IMAGE_EXT.test(f.path) || !/\./.test(f.path.split('/').pop()))
  console.log(`\n${bucket}: ${files.length} file(s)`)

  for (const file of files) {
    try {
      const { data: blob, error } = await supabase.storage.from(bucket).download(file.path)
      if (error) throw error
      const input = Buffer.from(await blob.arrayBuffer())
      const meta = await sharp(input).metadata()
      const long = Math.max(meta.width ?? 0, meta.height ?? 0)

      // Nothing to gain: already within the limit and reasonably small.
      if (long <= maxDim && input.length <= 400 * 1024) {
        skipped++; totalBefore += input.length; totalAfter += input.length
        continue
      }

      const output = await sharp(input)
        .rotate()                                   // bake EXIF orientation in
        .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer()

      totalBefore += input.length
      totalAfter  += Math.min(input.length, output.length)
      if (output.length >= input.length) { skipped++; continue }

      console.log(`${APPLY ? 'shrink' : 'would shrink'}  ${file.path}  ${meta.width}x${meta.height} ${fmt(input.length)} → ${fmt(output.length)}`)
      if (APPLY) {
        const { error: upErr } = await supabase.storage.from(bucket)
          .upload(file.path, output, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
        if (upErr) throw upErr
      }
      changed++
    } catch (err) {
      failed++
      console.warn(`skip (error) ${file.path}: ${err.message ?? err}`)
    }
  }
}

console.log(`\n${APPLY ? 'Done' : 'Dry run'}: ${changed} shrunk, ${skipped} already small, ${failed} failed`)
console.log(`Total ${fmt(totalBefore)} → ${fmt(totalAfter)} (${totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}% saved)`)
if (!APPLY) console.log('Re-run with --apply to write the changes.')
