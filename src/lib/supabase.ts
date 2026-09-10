import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; 

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Cria o cliente com fallback para não quebrar a compilação caso o .env esteja vazio
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-publishable-key"
);
