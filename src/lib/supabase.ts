import { createClient } from "@supabase/supabase-js";

// Pegando as variáveis de ambiente (padrão Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Se no seu .env está PUBLISHABLE_KEY, pode manter, mas ANON_KEY é o padrão oficial:
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY; 

// Exporta um booleano útil para o frontend saber se deve mostrar tela de erro/configuração
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Cria o cliente com fallback para não quebrar a compilação caso o .env esteja vazio
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-anon-key"
);
