// Supabase client. Only the project URL and the publishable key live here (safe to publish; RLS protects data).
import { createClient } from '../vendor/supabase.js';

export const SUPABASE_URL = 'https://tmeiarfoaovlenulqtrk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_4Mr6gN-OKfdFzty-Rtx5OA_BFsV_AvH';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mls_auth' },
});
