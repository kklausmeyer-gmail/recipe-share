import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Where magic links send people back to (the site root). */
export const siteUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`
