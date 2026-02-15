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

let supabaseInstance: SupabaseClient<Database> | null = null;
let supabaseAdminInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance;
  
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }

  supabaseInstance = createClient<Database>(url, anonKey, options);
  return supabaseInstance;
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  supabaseAdminInstance = createClient<Database>(url, serviceRoleKey, {
    ...options,
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return supabaseAdminInstance;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient<Database>];
  }
});

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    return getSupabaseAdminClient()[prop as keyof SupabaseClient<Database>];
  }
});
