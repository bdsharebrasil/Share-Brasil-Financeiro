import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";

export type PerfilColaborador = {
  id: string;
  email: string;
  nome_completo: string;
  nome_exibicao: string | null;
  foto_url: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  data_criacao: string;
  data_atualizacao: string;
  data_nascimento: string | null;
  data_admissao: string | null;
  cpf: string | null;
  rg: string | null;
  canac: string | null;
  status: string;
  nome_banco: string | null;
  tipo_conta: string | null;
  conta_numero: string | null;
  agencia_numero: string | null;
  tipo_chave_pix: string | null;
  pix: string | null;
  tipo_user: string | null;
  departamento: string | null;
  cliente_id: string | null;
  dias_ferias_direito: number;
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

export type FuncaoColaborador = {
  id: string;
  funcao: string;
  criado_em: string | null;
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
  funcoes: FuncaoColaborador[];
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

export function atualizarPerfilColaborador(dados: Partial<Pick<PerfilColaborador, "nome_completo" | "cpf" | "telefone">>) {
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

export type SolicitacaoVooInterna = {
  id: string;
  cliente_id: string | null;
  aeronave_id: string | null;
  origem: string;
  destino: string;
  data_agendada: string;
  horario_previsto_agendamento: string | null;
  dias_duracao: number;
  numero_passageiros: number;
  voo_emprestado: string;
  status: "pendente" | "aprovada" | "reprovada" | "cancelada" | string;
  motivo_rejeicao: string | null;
  numero_voo: string | null;
  criado_em: string;
  atualizado_em: string | null;
  cliente_razao_social: string | null;
  socio_nome?: string | null;
  codigo_cliente: string | null;
  matricula_registro: string | null;
  modelo: string | null;
  observacoes?: string | null;
  piloto_id?: string | null;
  copiloto_id?: string | null;
};

export type AeronaveAgendamento = {
  id: string;
  matricula_registro: string;
  fabricante: string;
  modelo: string;
  status: string;
  ano: string | null;
  base: string | null;
  url_imagem: string | null;
  tipo_aeronave: string | null;
};

export type TripulanteAgendamento = {
  id: string;
  nome_completo: string;
  canac: string;
  status: string | null;
  tipo_licenca: string | null;
  origem: "tripulacao" | "freelancer";
};

export type EscalaAgendamento = {
  id: string;
  data_agendada: string;
  data_fim: string;
  numero_voo: string | null;
  origem: string;
  destino: string;
  piloto_id: string | null;
  piloto_nome: string | null;
  copiloto_id: string | null;
  copiloto_nome: string | null;
  status: string;
};

export type DisponibilidadeTripulacao = {
  id: string;
  tripulante_id: string;
  tripulante_origem: "tripulacao" | "freelancer";
  data_inicio: string;
  data_fim: string;
  status: "aviso" | "ferias" | "disponivel" | string;
  observacoes: string | null;
};

export type OpcaoClienteAgendamento = { id: string; nome: string; codigo_cliente: string | null };
export type OpcaoSocioAgendamento = { id: string; nome: string; cliente_id: string | null };
export type VinculoCotistaAgendamento = { id: string; cliente_id: string | null; socio_id: string | null; aeronave_id: string; codigo_cliente: string | null; matricula_registro: string | null; modelo: string | null };
export type OpcoesAgendamentoResponse = { clientes: OpcaoClienteAgendamento[]; socios: OpcaoSocioAgendamento[]; aeronaves: AeronaveAgendamento[]; vinculos: VinculoCotistaAgendamento[] };

export type PainelAgendamentoResponse = {
  inicio: string;
  fim: string;
  agendamentos: SolicitacaoVooInterna[];
  aeronaves: AeronaveAgendamento[];
  tripulacao: TripulanteAgendamento[];
  escala: EscalaAgendamento[];
  disponibilidades: DisponibilidadeTripulacao[];
};

export type PainelOperacoesResponse = {
  data_referencia: string;
  resumo: { voos_hoje: number; pendencias: number; reservas_abertas: number; aeronaves_ativas: number };
  solicitacoes: SolicitacaoVooInterna[];
};

export type MovimentacaoFinanceira = {
  id: string;
  descricao: string;
  status: string | null;
  data_pagamento: string | null;
  valor: number;
  observacoes: string | null;
  criado_em: string;
};

export type PainelFinanceiroResponse = {
  resumo: { total_a_receber: number; total_pago: number; pendencias: number; pagamentos_confirmados: number };
  movimentacoes: MovimentacaoFinanceira[];
};

export function buscarOpcoesAgendamento() {
  return colaboradorRequest<OpcoesAgendamentoResponse>("/api/interno/agendamento/opcoes");
}

export function buscarPainelAgendamento(inicio?: string, fim?: string) {
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  const query = params.toString() ? `?${params.toString()}` : "";
  return colaboradorRequest<PainelAgendamentoResponse>(`/api/interno/agendamento${query}`);
}

export function definirDisponibilidadeTripulacao(dados: { tripulante_id: string; data_inicio: string; data_fim?: string; status: "aviso" | "ferias" | "disponivel"; observacoes?: string }) {
  return colaboradorRequest<{ id: string; tripulante_nome: string }>("/api/interno/agendamento/disponibilidade", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export type NovoAgendamento = {
  cliente_id?: string;
  socio_id?: string;
  aeronave_id: string;
  origem: string;
  destino: string;
  data_agendada: string;
  horario_previsto_agendamento?: string;
  dias_duracao?: number;
  numero_passageiros?: number;
  voo_emprestado?: string;
  piloto_id?: string;
  copiloto_id?: string;
  observacoes?: string;
};

export function criarAgendamento(dados: NovoAgendamento) {
  return colaboradorRequest<{ id: string; status: string; numero_voo: string | null }>("/api/interno/agendamento", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function buscarPainelOperacoes(data?: string) {
  const query = data ? `?data=${encodeURIComponent(data)}` : "";
  return colaboradorRequest<PainelOperacoesResponse>(`/api/interno/dashboard/operacoes${query}`);
}

export function buscarSolicitacoesInternas(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return colaboradorRequest<SolicitacaoVooInterna[]>(`/api/interno/solicitacoes${query}`);
}

export function aprovarSolicitacaoVoo(id: string, pilotoId: string, copilotoId?: string) {
  return colaboradorRequest<{ success: boolean; status: string; solicitacao_id: string; numero_voo: string }>(`/api/interno/solicitacoes/${id}/aprovar`, {
    method: "POST",
    body: JSON.stringify({ piloto_id: pilotoId, copiloto_id: copilotoId || undefined }),
  });
}

export function reprovarSolicitacaoVoo(id: string, motivoRejeicao: string) {
  return colaboradorRequest<{ success: boolean; status: string; solicitacao_id: string }>(`/api/interno/solicitacoes/${id}/reprovar`, {
    method: "POST",
    body: JSON.stringify({ motivo_rejeicao: motivoRejeicao }),
  });
}

export function buscarPainelFinanceiro() {
  return colaboradorRequest<PainelFinanceiroResponse>("/api/interno/dashboard/financeiro");
}
