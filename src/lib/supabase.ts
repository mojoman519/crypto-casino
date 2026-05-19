import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!_supabase) _supabase = createClient(url, key)
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => {
    const client = getSupabase()
    if (!client) return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
    return (client as unknown as Record<string, unknown>)[prop as string]
  },
})

export const AVATAR_BUCKET = 'avatars'
export const BANNER_BUCKET = 'banners'

export async function uploadAvatar(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar_${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    console.error('[supabase/uploadAvatar]', error)
    return null
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadBanner(file: File, userId: string): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/banner_${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    console.error('[supabase/uploadBanner]', error)
    return null
  }

  const { data } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
