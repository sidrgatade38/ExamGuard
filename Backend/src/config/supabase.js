const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

let supabaseClient = null;

/**
 * Initializes or returns the singleton Supabase client using server-side credentials.
 * Uses SUPABASE_SERVICE_ROLE_KEY for privileged backend operations.
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = config.supabase.url;
    // Prefer service role key on backend to bypass RLS and perform administrative queries
    const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase configuration error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in Backend/.env'
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Transparent proxy allowing direct usage like `supabase.from('users')`
 * while deferring client instantiation until first usage.
 */
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      const value = client[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    },
  }
);

module.exports = {
  supabase,
  getSupabaseClient,
};
