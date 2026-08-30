export interface Env {
  DB: D1Database;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGIN?: string;
}

type Departamento = "operacoes" | "financeiro" | "gestor" | "portal";
type Caixa = "share" | "cliente";

const departments = new Set<Departamento>(["operacoes", "financeiro", "gestor", "portal"]);
const cashTypes = new Set<Caixa>(["share", "cliente"]);

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN || origin || "*";
  return new Headers({
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

async function requireUser(request: Request, env: Env): Promise<{ id: string } | Response> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(request, env, { error: "missing_authorization" }, 401);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return json(request, env, { error: "supabase_not_configured" }, 500);
  }

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: authorization,
    },
  });
  if (!response.ok) {
    return json(request, env, { error: "invalid_token" }, 401);
  }
  const user = (await response.json()) as { id?: string };
  if (!user.id) {
    return json(request, env, { error: "invalid_user" }, 401);
  }
  return { id: user.id };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");

  if (request.method === "GET" && path === "/api/healthz") {
    return json(request, env, { status: "ok" });
  }

  const user = await requireUser(request, env);
  if (user instanceof Response) return user;

  if (request.method === "GET" && path === "/api/dashboard/summary") {
    const departamento = url.searchParams.get("departamento") as Departamento | null;
    if (!departamento || !departments.has(departamento)) {
      return json(request, env, { error: "invalid_departamento" }, 400);
    }
    const row = await env.DB.prepare(
      `SELECT departamento, greeting, period, metrics_json, alerts_json
       FROM dashboard_summaries WHERE user_id = ?1 AND departamento = ?2`,
    ).bind(user.id, departamento).first<{
      departamento: Departamento;
      greeting: string;
      period: string;
      metrics_json: string;
      alerts_json: string;
    }>();
    if (!row) {
      return json(request, env, {
        departamento,
        greeting: "Olá",
        period: "Sem dados cadastrados",
        metrics: [],
        alerts: [],
      });
    }
    return json(request, env, {
      departamento: row.departamento,
      greeting: row.greeting,
      period: row.period,
      metrics: parseJson(row.metrics_json),
      alerts: parseJson(row.alerts_json),
    });
  }

  if (request.method === "GET" && path === "/api/financeiro/movimentacoes") {
    const caixa = url.searchParams.get("caixa") as Caixa | null;
    const limiteRaw = Number(url.searchParams.get("limite") || "10");
    const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(Math.trunc(limiteRaw), 1), 50) : 10;
    if (caixa && !cashTypes.has(caixa)) {
      return json(request, env, { error: "invalid_caixa" }, 400);
    }
    const query = caixa
      ? `SELECT id, date, description, category, account, paid_by AS paidBy, amount, status, caixa,
          reimbursable FROM movements WHERE user_id = ?1 AND caixa = ?2 ORDER BY created_at DESC LIMIT ?3`
      : `SELECT id, date, description, category, account, paid_by AS paidBy, amount, status, caixa,
          reimbursable FROM movements WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`;
    const statement = caixa ? env.DB.prepare(query).bind(user.id, caixa, limite) : env.DB.prepare(query).bind(user.id, limite);
    const result = await statement.all();
    return json(request, env, result.results.map((item) => ({ ...item, reimbursable: Boolean(item.reimbursable) })));
  }

  if (request.method === "GET" && path === "/api/financeiro/cotistas") {
    const result = await env.DB.prepare(
      `SELECT id, name, aircraft, hours, balance, utilization, status
       FROM shareholders WHERE user_id = ?1 ORDER BY name`,
    ).bind(user.id).all();
    return json(request, env, result.results);
  }

  return json(request, env, { error: "not_found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    try {
      return await handleApi(request, env);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: "internal_error" }, 500);
    }
  },
};
