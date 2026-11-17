import { colaboradorRequest } from "./colaborador-api";
import { supabase } from "./supabase";
import { API_BASE } from "./api";
import { PONTO_ATIVO_EVENTO, PONTO_ATIVO_STORAGE } from "@/types/navegacao";
export type GeolocalizacaoPonto = {
  status: "INFORMADA" | "NEGADA" | "INDISPONIVEL" | "NAO_SOLICITADA";
  latitude?: number;
  longitude?: number;
  precisao_metros?: number;
};
export type ContextoPonto = {
  linha_atual: Record<string, string> | null;
  elegivel: boolean;
  permissoes: { gestor: boolean; dp: boolean; geral: boolean };
  fuso_horario: string;
  hoje: string;
  horario_servidor: string;
};
export type AvisoPonto = {
  exibir: boolean;
  elegivel: boolean;
  data_local?: string;
  fuso_horario?: string;
  horario_servidor?: string;
  ponto_ativo?: boolean;
};
export type ComprovantePonto = {
  id: string;
  tipo: string;
  registrado_em: string;
  hora_local: string;
  fuso_horario: string;
  latitude: number | null;
  longitude: number | null;
  precisao_metros: number | null;
  geolocalizacao_status: string;
};
export type SolicitacaoPonto = {
  id: string;
  user_id: string;
  tipo: string;
  data_referencia: string;
  minutos: number;
  campo: string | null;
  horario_corrigido: string | null;
  justificativa: string;
  status: string;
  anexo_id?: string;
  origem_tipo?: string;
  aprovado_por?: string;
  motivo_rejeicao?: string;
};
export type DiaPonto = {
  data: string;
  previstos_min: number;
  trabalhados_min: number;
  intervalo_min: number;
  extras_min: number;
  extras_aprovadas_min: number;
  extras_pendentes_min: number;
  deficit_min: number;
  banco_min: number;
  noturnos_reduzidos_min: number | null;
  sobreaviso_equivalente_min: number | null;
  alertas: string[];
  encerrado: boolean;
  linha: Record<string, string> | null;
  original: Record<string, string> | null;
  marcas: ComprovantePonto[];
  fuso_horario: string;
  escala: { tipo: string; entrada?: string; saida?: string } | null;
};
export type EspelhoPonto = {
  user_id: string;
  competencia: string;
  dias: DiaPonto[];
  totais: Record<string, number>;
  solicitacoes: SolicitacaoPonto[];
  banco: {
    saldo_min: number;
    vencido_a_liquidar_min: number;
    movimentos: Array<{
      id: string;
      minutos: number;
      validade_ate: string | null;
    }>;
  };
  fechamento: null | {
    id: string;
    status: string;
    conferido_em: string | null;
    aprovado_em: string | null;
    fechado_em: string | null;
  };
  congelado: boolean;
};
export type MembroPonto = {
  id: string;
  nome_completo: string;
  nome_exibicao: string | null;
  departamento: string | null;
  hoje: DiaPonto | null;
  fechamento: EspelhoPonto["fechamento"];
  totais: Record<string, number>;
  banco: EspelhoPonto["banco"];
  pendencias: string[];
  solicitacoes: SolicitacaoPonto[];
};
export type ConfiguracaoPonto = {
  bases_cct: any[];
  feriados: any[];
  equipe: MembroPonto[];
  gestores: Array<{ id: string; nome_completo: string; perfis: string[] }>;
  regras: any[];
  escalas: any[];
  vinculos: any[];
  modelos: Record<
    string,
    Array<{
      tipo: string;
      entrada?: string;
      saida?: string;
      intervalo_min?: number;
    }>
  >;
  referencia_regras: Record<string, number | boolean | string>;
  permissoes: ContextoPonto["permissoes"];
};
export const fusoDispositivo = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
export const contextoPonto = () =>
  colaboradorRequest<ContextoPonto>(
    `/api/sharebrasil/ponto/contexto?fuso=${encodeURIComponent(fusoDispositivo())}`,
  );
const avisosPendentes = new Map<string, Promise<AvisoPonto>>();
export function consultarAvisoPonto(usuarioId: string) {
  const atual = avisosPendentes.get(usuarioId);
  if (atual) return atual;
  const nova = colaboradorRequest<AvisoPonto>(
    "/api/sharebrasil/ponto/entrada-login",
    {
      method: "POST",
      body: JSON.stringify({ fuso_horario: fusoDispositivo() }),
    },
  );
  avisosPendentes.set(usuarioId, nova);
  void nova
    .finally(() => {
      if (avisosPendentes.get(usuarioId) === nova)
        avisosPendentes.delete(usuarioId);
    })
    .catch(() => undefined);
  return nova;
}
export function capturarLocalizacaoPonto(): Promise<GeolocalizacaoPonto> {
  return new Promise((resolve) => {
    let concluida = false;
    const terminar = (valor: GeolocalizacaoPonto) => {
      if (concluida) return;
      concluida = true;
      clearTimeout(limite);
      resolve(valor);
    };
    // O timeout da API do navegador pode aguardar a permissão indefinidamente.
    const limite = setTimeout(
      () => terminar({ status: "INDISPONIVEL" }),
      10000,
    );
    if (!navigator.geolocation) return terminar({ status: "INDISPONIVEL" });
    try {
      navigator.geolocation.getCurrentPosition(
        (p) =>
          terminar({
            status: "INFORMADA",
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            precisao_metros: p.coords.accuracy,
          }),
        (e) => terminar({ status: e.code === 1 ? "NEGADA" : "INDISPONIVEL" }),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      );
    } catch {
      terminar({ status: "INDISPONIVEL" });
    }
  });
}
export function sinalizarPonto(ativo: boolean) {
  window.localStorage.setItem(PONTO_ATIVO_STORAGE, ativo ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(PONTO_ATIVO_EVENTO, { detail: { ativo } }),
  );
  window.dispatchEvent(new Event("ponto:atualizado"));
}
export async function registrarPonto(
  acao: string,
  geolocalizacao: GeolocalizacaoPonto,
  requisicao_id = crypto.randomUUID(),
) {
  const r = await colaboradorRequest<{
    success: boolean;
    comprovante: ComprovantePonto;
  }>("/api/sharebrasil/ponto/marcar", {
    method: "POST",
    body: JSON.stringify({
      acao,
      geolocalizacao,
      requisicao_id,
      fuso_horario: fusoDispositivo(),
    }),
  });
  sinalizarPonto(!["saida", "encerrar"].includes(acao));
  return r;
}
export const carregarEspelhoPonto = (mes: string, userId?: string) =>
  colaboradorRequest<EspelhoPonto>(
    `/api/sharebrasil/ponto/espelho?mes=${encodeURIComponent(mes)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`,
  );
export const carregarGestaoPonto = (mes: string) =>
  colaboradorRequest<{ equipe: MembroPonto[]; atualizado_em: string }>(
    `/api/sharebrasil/ponto/gestao?mes=${encodeURIComponent(mes)}`,
  );
export const carregarConfiguracaoPonto = () =>
  colaboradorRequest<ConfiguracaoPonto>("/api/sharebrasil/ponto/configuracao");
export const validarReferenciaPonto = (id: string) =>
  colaboradorRequest(
    `/api/sharebrasil/ponto/regras/${encodeURIComponent(id)}/validar`,
    { method: "POST" },
  );
export const salvarConfiguracaoPonto = (
  recurso: "escalas" | "regras" | "vinculos" | "feriados",
  body: unknown,
) =>
  colaboradorRequest<{ id: string }>(`/api/sharebrasil/ponto/${recurso}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const atualizarConfiguracaoPonto = (
  recurso: "escalas" | "vinculos",
  id: string,
  body: unknown,
) =>
  colaboradorRequest<{ id: string }>(
    recurso === "vinculos"
      ? "/api/sharebrasil/ponto/vinculos"
      : `/api/sharebrasil/ponto/escalas/${encodeURIComponent(id)}`,
    {
      method: recurso === "vinculos" ? "POST" : "PATCH",
      body: JSON.stringify(recurso === "vinculos" ? { ...(body as object), id } : body),
    },
  );
export const solicitarPonto = (form: FormData) =>
  colaboradorRequest("/api/sharebrasil/ponto/solicitacoes", {
    method: "POST",
    body: form,
  });
export const decidirSolicitacaoPonto = (
  id: string,
  status: string,
  motivo: string,
  minutos: number,
) =>
  colaboradorRequest(
    `/api/sharebrasil/ponto/solicitacoes/${encodeURIComponent(id)}/decisao`,
    { method: "POST", body: JSON.stringify({ status, motivo, minutos }) },
  );
export const acaoFechamentoPonto = (
  mes: string,
  acao: "conferir" | "aprovar" | "fechar",
  user_id?: string,
) =>
  colaboradorRequest(
    `/api/sharebrasil/ponto/fechamentos/${encodeURIComponent(mes)}/${acao}`,
    { method: "POST", body: JSON.stringify({ user_id }) },
  );
export function baixarComprovantePonto(c: ComprovantePonto) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `registro-ponto-${c.id.replace(/[^a-z0-9-]/gi, "")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function baixarAnexoSolicitacaoPonto(id: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão encerrada.");
  const r = await fetch(
    `${API_BASE}/api/sharebrasil/ponto/solicitacoes/${encodeURIComponent(id)}/anexo`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  if (!r.ok) throw new Error("Não foi possível acessar o anexo.");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "comprovante-ponto";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function horasPonto(minutos: number | null | undefined) {
  if (minutos == null) return "—";
  const n = Math.round(Math.abs(minutos));
  return `${minutos < 0 ? "−" : ""}${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export const dataPonto = (valor: string) =>
  valor.slice(0, 10).split("-").reverse().join("/");
export const rotulosPonto: Record<string, string> = {
  ATRASO: "Atraso",
  AUSENCIA: "Entrada não registrada",
  PAUSA_NAO_REGISTRADA: "Pausa não registrada",
  HORA_EXTRA_INICIANDO: "Hora extra iniciando",
  MARCACAO_INCOMPLETA: "Marcação incompleta",
  INTERVALO_INSUFICIENTE: "Intervalo insuficiente",
  HORA_EXTRA_PENDENTE: "Hora extra sem aprovação",
  ABRANGENCIA_CCT_PENDENTE: "Enquadramento territorial a conferir",
  SOBREAVISO_A_VALIDAR: "Regra de sobreaviso a validar",
  CARGA_SEMANAL_EXCEDIDA: "Escala excede carga semanal",
  REGRA_PENDENTE: "Regra a validar",
  ESCALA_PENDENTE: "Escala a definir",
  SOLICITACAO_PENDENTE: "Solicitação pendente",
  HORARIOS_INCONSISTENTES: "Horários inconsistentes",
  REGISTROS_LEGADOS_DUPLICADOS: "Registros antigos duplicados",
  ABONO_LEGADO_SEM_DURACAO: "Abono antigo sem duração",
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  EM_CONFERENCIA: "Em conferência",
  CONFERIDO: "Conferido pelo colaborador",
  APROVADO_GESTOR: "Aprovado pelo gestor",
  FECHADO_DP: "Fechado pelo DP",
  CORRECAO: "Correção de ponto",
  ATESTADO: "Atestado",
  DISPENSA: "Dispensa",
  HORA_EXTRA: "Hora extra",
  COMPENSACAO: "Compensação de banco",
  ENTRADA: "Entrada",
  INICIO_INTERVALO: "Início do intervalo",
  FIM_INTERVALO: "Retorno do intervalo",
  SAIDA: "Saída",
};
export function mensagemErroPonto(e: unknown) {
  const codigo = e instanceof Error ? e.message : "Falha ao processar ponto";
  const mensagens: Record<string, string> = {
    departamento_sem_registro_de_ponto:
      "Este departamento não utiliza o registro de ponto.",
    marcacao_ja_registrada:
      "Este horário já foi registrado. Atualize o espelho.",
    competencia_fechada: "Este mês está fechado. O espelho foi preservado.",
    atualizacao_ponto_pendente_migracao:
      "O módulo de ponto aguarda a atualização do banco.",
    gestor_sem_permissao_ou_autoaprovacao:
      "A aprovação precisa ser feita por outro gestor autorizado.",
    sequencia_de_marcacoes_invalida:
      "Confira a sequência de entrada, intervalo e saída.",
    encerre_o_intervalo_antes_da_saida:
      "Registre o retorno do intervalo antes da saída.",
    competencia_ainda_em_curso: "O mês ainda está em curso.",
    falha_no_modulo_de_ponto:
      "Não foi possível carregar o ponto. Tente novamente.",
  };
  return mensagens[codigo] || codigo.replace(/_/g, " ");
}
