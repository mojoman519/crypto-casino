import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
