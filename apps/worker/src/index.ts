interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  ALLOWED_ORIGIN?: string;
  CLIENT_SESSION_SECRET: string;
  CLIENT_SESSION_TTL_SECONDS?: string;
}

type UserClient = {
  id: string;
  login: string;
  nome_exibicao: string | null;
  cliente_id: string | null;
  socio_id: string | null;
};

type ClientSession = UserClient & { exp: number };
type InternalUser = { userId: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const allowedStatuses = new Set(["pendente", "aprovada", "reprovada", "cancelada"]);

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin");
  const allowedOrigin = env.ALLOWED_ORIGIN || origin || "*";
  return new Headers({
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Internal-User-Id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
}

function json(request: Request, env: Env, body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(extraHeaders || {})) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function optionalText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations = 210_000): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

function passwordHashFormat(hash: Uint8Array, salt: Uint8Array, iterations = 210_000): string {
  return `pbkdf2_sha256$${iterations}$${base64Url(salt)}$${base64Url(hash)}`;
}

async function verifyPassword(password: string, storedValue: string): Promise<{ valid: boolean; legacyPlaintext: boolean }> {
  const parts = storedValue.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return { valid: storedValue === password, legacyPlaintext: storedValue === password };
  }
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return { valid: false, legacyPlaintext: false };
  try {
    const hash = await derivePasswordHash(password, fromBase64Url(parts[2]), iterations);
    return { valid: constantTimeEqual(hash, fromBase64Url(parts[3])), legacyPlaintext: false };
  } catch {
    return { valid: false, legacyPlaintext: false };
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return passwordHashFormat(await derivePasswordHash(password, salt), salt);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function createSession(user: UserClient, env: Env): Promise<{ token: string; expiresAt: string }> {
  const ttl = positiveInt(env.CLIENT_SESSION_TTL_SECONDS, SESSION_TTL_SECONDS, 60 * 60 * 24 * 30);
  const payload: ClientSession = { ...user, exp: Math.floor(Date.now() / 1000) + ttl };
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await importHmacKey(env.CLIENT_SESSION_SECRET), encoder.encode(encoded))));
  return { token: `${encoded}.${signature}`, expiresAt: new Date(payload.exp * 1000).toISOString() };
}

async function readClientSession(request: Request, env: Env): Promise<UserClient | null> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ") || !env.CLIENT_SESSION_SECRET) return null;
  const token = authorization.slice(7).trim();
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await importHmacKey(env.CLIENT_SESSION_SECRET), fromBase64Url(signature), encoder.encode(encoded));
    if (!valid) return null;
    const session = JSON.parse(decoder.decode(fromBase64Url(encoded))) as ClientSession;
    if (!session.id || !session.login || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return { id: session.id, login: session.login, nome_exibicao: session.nome_exibicao, cliente_id: session.cliente_id, socio_id: session.socio_id };
  } catch {
    return null;
  }
}

async function requireClient(request: Request, env: Env): Promise<UserClient | Response> {
  const user = await readClientSession(request, env);
  return user || json(request, env, { error: "client_auth_required" }, 401);
}

async function requireInternal(request: Request, env: Env): Promise<InternalUser | Response> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(request, env, { error: "internal_auth_required" }, 401);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization } });
  if (!response.ok) return json(request, env, { error: "invalid_internal_token" }, 401);
  const user = await response.json() as { id?: string };
  return user.id ? { userId: user.id } : json(request, env, { error: "invalid_internal_user" }, 401);
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : new Response(null, { status: 400 });
  } catch {
    return new Response(null, { status: 400 });
  }
}

function validateReservation(body: Record<string, unknown>): string | null {
  const required = ["aeronave_id", "origem", "destino", "data_agendada"];
  for (const key of required) if (!text(body[key])) return `campo_obrigatorio_${key}`;
  const date = new Date(`${text(body.data_agendada)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "data_agendada_invalida";
  if (date < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) return "data_agendada_no_passado";
  if (positiveInt(body.dias_duracao, 1, 30) < 1) return "dias_duracao_invalido";
  if (positiveInt(body.numero_passageiros, 1, 20) < 1) return "numero_passageiros_invalido";
  return null;
}

async function getCompanyTelegramChatId(env: Env): Promise<string | null> {
  const company = await env.DB.prepare("SELECT telegram_chat_id FROM empresa ORDER BY criado_em LIMIT 1").first<{ telegram_chat_id: string | null }>();
  return company?.telegram_chat_id?.trim() || null;
}

async function sendTelegram(env: Env, chatId: string, message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("telegram_not_configured");
  const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`telegram_request_failed_${response.status}`);
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error("telegram_api_rejected");
}

async function reservationDetails(env: Env, id: string) {
  return env.DB.prepare(`
    SELECT s.*, c.razao_social AS cliente_razao_social, c.codigo_cliente,
           a.matricula_registro, a.fabricante, a.modelo
    FROM solicitacoes_reserva_voo s
    LEFT JOIN cliente c ON c.id = s.cliente_id
    LEFT JOIN aeronave a ON a.id = s.aeronave_id
    WHERE s.id = ?1
  `).bind(id).first<Record<string, unknown>>();
}

function escapeHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[char] || char);
}

function reservationTelegramMessage(row: Record<string, unknown>): string {
  return [
    "<b>Nova solicitação de reserva de voo</b>",
    `Cliente: <b>${escapeHtml(row.cliente_razao_social || row.socio_nome || row.codigo_cliente)}</b>`,
    `Aeronave: ${escapeHtml([row.matricula_registro, row.fabricante, row.modelo].filter(Boolean).join(" · "))}`,
    `Origem → destino: ${escapeHtml(row.origem)} → ${escapeHtml(row.destino)}`,
    `Data: ${escapeHtml(row.data_agendada)} · Horário: ${escapeHtml(row.horario_previsto_agendamento)}`,
    `Duração: ${escapeHtml(row.dias_duracao)} dia(s) · Passageiros: ${escapeHtml(row.numero_passageiros)}`,
    `Voo de empréstimo: ${String(row.voo_emprestado) === "sim" ? "Sim" : "Não"}`,
    `Observações: ${escapeHtml(row.observacoes)}`,
    `ID da solicitação: <code>${escapeHtml(row.id)}</code>`,
    "Acesse o Sistema Interno Share Brasil para aprovar ou reprovar.",
  ].join("\n");
}

async function resolveClientId(env: Env, user: UserClient): Promise<string | null> {
  if (user.cliente_id) return user.cliente_id;
  if (!user.socio_id) return null;
  const row = await env.DB.prepare("SELECT cliente_id FROM hold_socios WHERE id = ?1").bind(user.socio_id).first<{ cliente_id: string | null }>();
  return row?.cliente_id || null;
}

async function handleClientApi(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method === "POST" && path === "/api/portal/login") {
    const body = await readBody(request);
    if (body instanceof Response) return json(request, env, { error: "invalid_json" }, 400);
    const login = text(body.login).toLowerCase();
    const password = text(body.senha);
    if (!login || !password) return json(request, env, { error: "login_e_senha_obrigatorios" }, 400);
    const row = await env.DB.prepare(`SELECT id, login, senha, nome_exibicao, cliente_id, socio_id FROM user_cliente WHERE lower(login) = ?1 LIMIT 1`).bind(login).first<UserClient & { senha: string }>();
    if (!row) return json(request, env, { error: "credenciais_invalidas" }, 401);
    const verified = await verifyPassword(password, row.senha);
    if (!verified.valid) return json(request, env, { error: "credenciais_invalidas" }, 401);
    if (verified.legacyPlaintext) {
      const migratedHash = await hashPassword(password);
      await env.DB.prepare("UPDATE user_cliente SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").bind(migratedHash, row.id).run();
    }
    const user: UserClient = { id: row.id, login: row.login, nome_exibicao: row.nome_exibicao, cliente_id: row.cliente_id, socio_id: row.socio_id };
    const session = await createSession(user, env);
    return json(request, env, { user, ...session });
  }

  const user = await requireClient(request, env);
  if (user instanceof Response) return user;

  if (request.method === "GET" && path === "/api/portal/me") return json(request, env, { user });

  if (request.method === "GET" && path === "/api/portal/disponibilidade") {
    const from = text(new URL(request.url).searchParams.get("de"), new Date().toISOString().slice(0, 10));
    const to = text(new URL(request.url).searchParams.get("ate"), from);
    const aircraft = await env.DB.prepare(`SELECT id, matricula_registro, fabricante, modelo, tipo_aeronave, status FROM aeronave WHERE lower(status) = 'ativa' ORDER BY matricula_registro`).all();
    const reservations = await env.DB.prepare(`SELECT aeronave_id, data_agendada, dias_duracao, status FROM solicitacoes_reserva_voo WHERE data_agendada BETWEEN ?1 AND ?2 AND status IN ('pendente', 'aprovada') ORDER BY data_agendada`).bind(from, to).all();
    return json(request, env, { from, to, aeronaves: aircraft.results, reservas: reservations.results });
  }

  if (request.method === "GET" && path === "/api/portal/solicitacoes") {
    const clientId = await resolveClientId(env, user);
    if (!clientId) return json(request, env, []);
    const rows = await env.DB.prepare(`SELECT s.id, s.aeronave_id, s.origem, s.destino, s.data_agendada, s.horario_previsto_agendamento, s.dias_duracao, s.numero_passageiros, s.voo_emprestado, s.status, s.motivo_rejeicao, s.numero_voo, s.criado_em, a.matricula_registro, a.modelo FROM solicitacoes_reserva_voo s LEFT JOIN aeronave a ON a.id = s.aeronave_id WHERE s.cliente_id = ?1 ORDER BY s.criado_em DESC`).bind(clientId).all();
    return json(request, env, rows.results);
  }

  if (request.method === "POST" && path === "/api/portal/solicitacoes") {
    const clientId = await resolveClientId(env, user);
    if (!clientId) return json(request, env, { error: "cliente_nao_vinculado" }, 409);
    const body = await readBody(request);
    if (body instanceof Response) return json(request, env, { error: "invalid_json" }, 400);
    const validationError = validateReservation(body);
    if (validationError) return json(request, env, { error: validationError }, 400);
    const aircraft = await env.DB.prepare("SELECT id, status FROM aeronave WHERE id = ?1").bind(text(body.aeronave_id)).first<{ id: string; status: string }>();
    if (!aircraft || aircraft.status.toLowerCase() !== "ativa") return json(request, env, { error: "aeronave_indisponivel" }, 409);
    const id = crypto.randomUUID();
    const status = "pendente";
    await env.DB.prepare(`INSERT INTO solicitacoes_reserva_voo (id, cliente_id, aeronave_id, voo_emprestado, origem, destino, data_agendada, horario_previsto_agendamento, dias_duracao, numero_passageiros, status, observacoes, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(id, clientId, text(body.aeronave_id), text(body.voo_emprestado, "nao"), text(body.origem), text(body.destino), text(body.data_agendada), optionalText(body.horario_previsto_agendamento), positiveInt(body.dias_duracao, 1, 30), positiveInt(body.numero_passageiros, 1, 20), status, optionalText(body.observacoes)).run();
    const row = await reservationDetails(env, id);
    const chatId = await getCompanyTelegramChatId(env);
    if (!chatId) return json(request, env, { error: "telegram_chat_id_nao_configurado", solicitacao_id: id }, 500);
    try {
      await sendTelegram(env, chatId, reservationTelegramMessage(row || { ...body, id, cliente_razao_social: user.nome_exibicao }));
    } catch (error) {
      console.error("telegram_notification_failed", error);
      return json(request, env, { error: "solicitacao_salva_mas_telegram_falhou", solicitacao_id: id }, 502);
    }
    return json(request, env, { success: true, solicitacao_id: id, message: "Solicitação enviada com sucesso. Aguarde a confirmação da coordenação." }, 201);
  }

  return json(request, env, { error: "not_found" }, 404);
}

async function nextFlightNumber(env: Env, clientCode: string): Promise<string> {
  const sequence = await env.DB.prepare("UPDATE voo_sequencia SET ultimo_numero = ultimo_numero + 1 WHERE id = 1 RETURNING ultimo_numero").first<{ ultimo_numero: number }>();
  if (!sequence) throw new Error("flight_sequence_not_initialized");
  return `${clientCode}-${String(sequence.ultimo_numero).padStart(4, "0")}`;
}

async function handleInternalApi(request: Request, env: Env, path: string): Promise<Response> {
  const auth = await requireInternal(request, env);
  if (auth instanceof Response) return auth;

  if (request.method === "POST" && path === "/api/interno/seguranca/migrar-senhas") {
    const rows = await env.DB.prepare("SELECT id, senha FROM user_cliente WHERE senha NOT LIKE 'pbkdf2_sha256$%' ").all<{ id: string; senha: string }>();
    let migrated = 0;
    for (const row of rows.results) {
      await env.DB.prepare("UPDATE user_cliente SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").bind(await hashPassword(row.senha), row.id).run();
      migrated += 1;
    }
    return json(request, env, { success: true, migrated });
  }

  if (request.method === "GET" && path === "/api/interno/solicitacoes") {
    const status = optionalText(new URL(request.url).searchParams.get("status"));
    if (status && !allowedStatuses.has(status)) return json(request, env, { error: "status_invalido" }, 400);
    const query = status
      ? `SELECT s.*, c.razao_social AS cliente_razao_social, c.codigo_cliente, a.matricula_registro, a.modelo FROM solicitacoes_reserva_voo s LEFT JOIN cliente c ON c.id = s.cliente_id LEFT JOIN aeronave a ON a.id = s.aeronave_id WHERE s.status = ?1 ORDER BY s.data_agendada, s.criado_em`
      : `SELECT s.*, c.razao_social AS cliente_razao_social, c.codigo_cliente, a.matricula_registro, a.modelo FROM solicitacoes_reserva_voo s LEFT JOIN cliente c ON c.id = s.cliente_id LEFT JOIN aeronave a ON a.id = s.aeronave_id ORDER BY s.data_agendada, s.criado_em`;
    const result = status ? await env.DB.prepare(query).bind(status).all() : await env.DB.prepare(query).all();
    return json(request, env, result.results);
  }

  const match = path.match(/^\/api\/interno\/solicitacoes\/([^/]+)\/(aprovar|reprovar)$/);
  if (request.method === "POST" && match) {
    const [, id, action] = match;
    const reservation = await env.DB.prepare(`SELECT s.*, c.codigo_cliente, c.razao_social AS cliente_razao_social FROM solicitacoes_reserva_voo s LEFT JOIN cliente c ON c.id = s.cliente_id WHERE s.id = ?1`).bind(id).first<Record<string, unknown>>();
    if (!reservation) return json(request, env, { error: "solicitacao_nao_encontrada" }, 404);
    if (reservation.status !== "pendente") return json(request, env, { error: "solicitacao_nao_pendente" }, 409);
    const body = await readBody(request);
    if (body instanceof Response) return json(request, env, { error: "invalid_json" }, 400);
    if (action === "reprovar") {
      const motivo = text(body.motivo_rejeicao);
      if (!motivo) return json(request, env, { error: "motivo_rejeicao_obrigatorio" }, 400);
      await env.DB.prepare("UPDATE solicitacoes_reserva_voo SET status = 'reprovada', motivo_rejeicao = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").bind(motivo, auth.userId, id).run();
      return json(request, env, { success: true, status: "reprovada", solicitacao_id: id });
    }
    const clientCode = text(reservation.codigo_cliente);
    if (!clientCode) return json(request, env, { error: "codigo_cliente_obrigatorio" }, 409);
    const flightNumber = await nextFlightNumber(env, clientCode);
    const pilotId = optionalText(body.piloto_id);
    const copilotId = optionalText(body.copiloto_id);
    if (!pilotId) return json(request, env, { error: "piloto_obrigatorio" }, 400);
    const pilot = await env.DB.prepare("SELECT id FROM tripulacao WHERE id = ?1 AND lower(COALESCE(status, 'ativo')) = 'ativo' UNION ALL SELECT id FROM tripulacao_freelancer WHERE id = ?1 AND lower(COALESCE(status, 'ativo')) = 'ativo' LIMIT 1").bind(pilotId).first();
    if (!pilot) return json(request, env, { error: "piloto_invalido" }, 400);
    if (copilotId) {
      const copilot = await env.DB.prepare("SELECT id FROM tripulacao WHERE id = ?1 AND lower(COALESCE(status, 'ativo')) = 'ativo' UNION ALL SELECT id FROM tripulacao_freelancer WHERE id = ?1 AND lower(COALESCE(status, 'ativo')) = 'ativo' LIMIT 1").bind(copilotId).first();
      if (!copilot) return json(request, env, { error: "copiloto_invalido" }, 400);
    }
    await env.DB.prepare("UPDATE solicitacoes_reserva_voo SET status = 'aprovada', numero_voo = ?, piloto_id = ?, copiloto_id = ?, aprovado_por = ?, aprovado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?").bind(flightNumber, pilotId, copilotId, auth.userId, id).run();
    return json(request, env, { success: true, status: "aprovada", solicitacao_id: id, numero_voo: flightNumber });
  }

  return json(request, env, { error: "not_found" }, 404);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "GET" && path === "/api/healthz") return json(request, env, { status: "ok", database: "d1" });
  if (path.startsWith("/api/portal")) return handleClientApi(request, env, path);
  if (path.startsWith("/api/interno")) return handleInternalApi(request, env, path);
  return json(request, env, { error: "not_found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    try {
      return await handleApi(request, env);
    } catch (error) {
      console.error(error);
      return json(request, env, { error: "internal_error" }, 500);
    }
  },
};
