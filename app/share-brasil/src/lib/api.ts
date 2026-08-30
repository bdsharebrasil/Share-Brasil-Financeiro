import { supabase } from "@/lib/supabase";

const API_BASE = "https://api-workers.sharebrasil.workers.dev";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${path} falhou: ${res.status}`);
  return res.json();
}