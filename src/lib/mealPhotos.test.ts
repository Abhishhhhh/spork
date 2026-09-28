import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
const createSignedUrls = vi.fn()
const upload = vi.fn()
const remove = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    storage: { from: () => ({ createSignedUrls, upload, remove }) },
  },
}))

const { signMealPhotos, uploadMealPhoto, deleteMealPhotos } = await import('./mealPhotos')

const U = '11111111-1111-1111-1111-111111111111'
const L = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('signMealPhotos', () => {
  it('signs old photos via Supabase and R2 photos via the function, merged', async () => {
    createSignedUrls.mockResolvedValue({ data: [{ path: `${U}/a.jpg`, signedUrl: 'https://supabase/a' }] })
    invoke.mockResolvedValue({ data: { urls: { [`r2/${U}/b.jpg`]: 'https://r2/b' } }, error: null })

    const urls = await signMealPhotos([`${U}/a.jpg`, `r2/${U}/b.jpg`, `r2/${U}/b.jpg`])

    expect(createSignedUrls).toHaveBeenCalledWith([`${U}/a.jpg`], 3600)
    expect(invoke).toHaveBeenCalledWith('meal-photos', { body: { action: 'sign', paths: [`r2/${U}/b.jpg`] } })
    expect(Object.fromEntries(urls)).toEqual({ [`${U}/a.jpg`]: 'https://supabase/a', [`r2/${U}/b.jpg`]: 'https://r2/b' })
  })

  it('never calls the function while every photo is still in Supabase', async () => {
    createSignedUrls.mockResolvedValue({ data: [] })
    await signMealPhotos([`${U}/a.jpg`])
    expect(invoke).not.toHaveBeenCalled()
  })

  it('a failing function only hides the R2 photos', async () => {
    createSignedUrls.mockResolvedValue({ data: [{ path: `${U}/a.jpg`, signedUrl: 'https://supabase/a' }] })
    invoke.mockResolvedValue({ data: null, error: new Error('down') })
    const urls = await signMealPhotos([`${U}/a.jpg`, `r2/${U}/b.jpg`])
    expect([...urls.keys()]).toEqual([`${U}/a.jpg`])
  })
})

describe('uploadMealPhoto', () => {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

  it('stores in R2 and returns the r2/ path', async () => {
    invoke.mockResolvedValue({ data: { path: `r2/${U}/${L}.jpg` }, error: null })
    await expect(uploadMealPhoto(U, L, file)).resolves.toBe(`r2/${U}/${L}.jpg`)
    expect(upload).not.toHaveBeenCalled()
    const form = invoke.mock.calls[0][1].body as FormData
    expect(form.get('action')).toBe('upload')
    expect(form.get('path')).toBe(`${U}/${L}.jpg`)
  })

  it('falls back to Supabase Storage if R2 fails, so posting still works', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('not deployed') })
    upload.mockResolvedValue({ error: null })
    await expect(uploadMealPhoto(U, L, file)).resolves.toBe(`${U}/${L}.jpg`)
    expect(upload).toHaveBeenCalledWith(`${U}/${L}.jpg`, file, { contentType: 'image/jpeg' })
  })

  it('throws only if both stores fail', async () => {
    invoke.mockRejectedValue(new Error('offline'))
    upload.mockResolvedValue({ error: new Error('offline') })
    await expect(uploadMealPhoto(U, L, file)).rejects.toThrow('offline')
  })
})

describe('deleteMealPhotos', () => {
  it('routes each photo to where it lives', async () => {
    remove.mockResolvedValue({ error: null })
    invoke.mockResolvedValue({ data: { deleted: 1 }, error: null })
    await deleteMealPhotos([`${U}/a.jpg`, `r2/${U}/b.jpg`])
    expect(remove).toHaveBeenCalledWith([`${U}/a.jpg`])
    expect(invoke).toHaveBeenCalledWith('meal-photos', { body: { action: 'delete', paths: [`r2/${U}/b.jpg`] } })
  })
})
