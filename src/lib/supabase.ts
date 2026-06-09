import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfiguration = Object.freeze({
  dataMode: import.meta.env.VITE_EVENTOS_DATA_MODE ?? "local",
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
});

export const supabase = supabaseConfiguration.isConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;
