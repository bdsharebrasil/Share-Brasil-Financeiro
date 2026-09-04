const DEFAULT_API_ORIGIN = "https://api.share-brasil.com";
const configuredApiBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export const API_BASE = configuredApiBase || DEFAULT_API_ORIGIN;
export const API_ORIGIN = configuredApiBase || DEFAULT_API_ORIGIN;
const SESSION_STORAGE_KEY = "share-brasil-session";

export type AuthUser = {
  id: string;
  login: string;
  nome_exibicao: string | null;
  cliente_id: string | null;
  socio_id: string | null;
};

export type AuthSession = {
  user: AuthUser;
  token: string;
  expires_at: string;
};

function readSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session?.token || !session?.user?.id) return null;
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getAuthToken(): string | null {
  return readSession()?.token ?? null;
}

export function getAuthUser(): AuthUser | null {
  return readSession()?.user ?? null;
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

async function request(path: string, init: RequestInit = {}, token?: string | null) {
  const authToken = token ?? getAuthToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "omit",
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const errorMessage = typeof data === "object" && data !== null && "error" in data
      ? String((data as { error?: unknown }).error ?? `API ${path} falhou: ${response.status}`)
      : `API ${path} falhou: ${response.status}`;
    const error = new Error(errorMessage);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return data;
}

export async function login(login: string, senha: string): Promise<AuthSession> {
  const data = await request(
    "/api/portal/login",
    {
      method: "POST",
      body: JSON.stringify({ login, senha }),
    },
    null,
  ) as AuthSession;

  if (!data?.token || !data?.user?.id) {
    throw new Error("Resposta de autenticação inválida");
  }

  writeSession(data);
  return data;
}

export async function getCurrentSession(): Promise<AuthUser | null> {
  const session = readSession();
  if (!session) return null;

  try {
    const data = await request("/api/portal/me", { method: "GET" }, session.token) as { user?: AuthUser };
    if (!data?.user?.id) {
      clearAuthSession();
      return null;
    }
    return data.user;
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401) clearAuthSession();
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  try {
    return await request(path, init);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401) clearAuthSession();
    throw error;
  }
}
