import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";

export type PerfilColaborador = {
  id: string;
  usuario_id: string;
  email: string;
  nome_completo: string;
  cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  telefone: string | null;
  data_admissao: string | null;
  foto_url: string | null;
  dias_ferias_direito: number;
  criado_em: string;
  atualizado_em: string;
};

export type PagamentoColaborador = {
  id: string;
  descricao: string;
  competencia: string | null;
  data_pagamento: string | null;
  valor: number;
  status: "pago" | "pendente" | "cancelado";
  observacoes: string | null;
};

export type DocumentoPessoal = {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  status: "em_analise" | "aprovado" | "reprovado";
  criado_em: string;
  atualizado_em: string;
  arquivo_url: string;
};

export type SolicitacaoFerias = {
  id: string;
  data_inicio: string;
  data_fim: string;
  quantidade_dias: number;
  status: "solicitada" | "aprovada" | "reprovada" | "cancelada";
  observacoes: string | null;
  motivo_reprovacao: string | null;
  aprovado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type PerfilColaboradorResponse = {
  perfil: PerfilColaborador;
  pagamentos: PagamentoColaborador[];
  documentos: DocumentoPessoal[];
  ferias: SolicitacaoFerias[];
  resumo_ferias: {
    dias_direito: number;
    dias_utilizados: number;
    dias_disponiveis: number;
  };
};

async function colaboradorRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit" });
  const data = await response.json().catch(() => null) as T & { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || `api_${response.status}`);
  return data as T;
}

export function buscarPerfilColaborador() {
  return colaboradorRequest<PerfilColaboradorResponse>("/api/colaborador/perfil");
}

export function atualizarPerfilColaborador(dados: Partial<Pick<PerfilColaborador, "nome_completo" | "cpf" | "cargo" | "departamento" | "telefone">>) {
  return colaboradorRequest<{ perfil: PerfilColaborador }>("/api/colaborador/perfil", {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export async function atualizarSenhaColaborador(novaSenha: string) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

export async function carregarArquivoColaborador(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response.blob();
}

export function enviarFotoColaborador(foto: File) {
  const body = new FormData();
  body.append("foto", foto);
  return colaboradorRequest<{ foto_url: string }>("/api/colaborador/foto", { method: "POST", body });
}

export function enviarDocumentoPessoal(tipoDocumento: string, arquivo: File) {
  const body = new FormData();
  body.append("tipo_documento", tipoDocumento);
  body.append("arquivo", arquivo);
  return colaboradorRequest<{ id: string; tipo_documento: string; nome_arquivo: string; status: string; arquivo_url: string }>("/api/colaborador/documentos", { method: "POST", body });
}

export function solicitarFerias(dataInicio: string, dataFim: string, observacoes: string) {
  return colaboradorRequest<SolicitacaoFerias>("/api/colaborador/ferias", {
    method: "POST",
    body: JSON.stringify({ data_inicio: dataInicio, data_fim: dataFim, observacoes }),
  });
}
