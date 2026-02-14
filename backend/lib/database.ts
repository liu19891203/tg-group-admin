import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { Database } from '../types/database';

type DatabaseOptions = SupabaseClientOptions<'public'>;

const options: DatabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
};

export function getSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }

  return createClient<Database>(url, anonKey, options);
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient<Database>(url, serviceRoleKey, {
    ...options,
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();
