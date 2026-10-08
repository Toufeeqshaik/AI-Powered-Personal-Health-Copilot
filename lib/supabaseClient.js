import { createClient } from '@supabase/supabase-js'

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
// Keep the demo UI bootable without deployment credentials. Network-backed records
// remain unavailable until real Supabase settings are supplied.
const supabaseUrl = configuredSupabaseUrl || 'http://127.0.0.1:54321'
const supabaseAnonKey = configuredSupabaseAnonKey || 'offline-demo-placeholder'

// Client-side / public Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
