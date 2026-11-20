import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { env } from './env';

/**
 * The only Supabase client in the app. Components never import this directly;
 * data access goes through hooks in features/<name>/api.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // PKCE returns ?code=… instead of tokens in the hash; works with the PWA service worker.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
