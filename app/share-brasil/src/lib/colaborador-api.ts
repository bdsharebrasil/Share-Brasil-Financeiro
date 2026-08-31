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

export type MensagensNaoLidasResponse = {
  unread: number;
};

async function colaboradorRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit" });
  const data = await response.json().catch(() => null) as T & { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || `api_${response.status}`);
  return data as T;
}

export function buscarPerfilColaborador() {
  return colaboradorRequest<PerfilColaboradorResponse>("/api/colaborador/perfil");
}

export function buscarContagemMensagensNaoLidas() {
  return colaboradorRequest<MensagensNaoLidasResponse>("/api/mensagens/unread-count");
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

export type PontoLancamento = { id: string; user_id: string; data_entrada: string; entrada_hora: string | null; inicio_almoco: string | null; fim_almoco: string | null; saida_hora: string | null; horas_totais: number | null; status: string; motivo_da_ausencia?: string | null };
export type PontoResponse = { mes: string; lancamentos: PontoLancamento[]; anexos: Array<Record<string, any>>; justificativas: Array<Record<string, any>>; correcoes: Array<Record<string, any>> };
export type DocumentoInterno = { id: string; pasta_id: string | null; nome: string; caminho_arquivo: string; tipo_arquivo: string; tamanho_arquivo: number; enviado_por: string; criado_em: string; arquivo_url: string };
export type PastaDocumento = { id: string; nome: string; pasta_pai_id: string | null; criado_por: string; criado_em: string; restrita: number };
export type SenhaEmpresa = { id: string; titulo: string; site: string; login: string; senha?: string; observacoes: string | null; setor: string | null; criado_em: string };
export type ContatoAgenda = { id: string; nome: string; telefone: string | null; email: string | null; empresa: string | null; cargo: string | null; observacoes: string | null; endereco: string | null; uf: string | null; cidade: string | null; categoria: string | null };
export type ClienteShare = Record<string, any>;

export function buscarPonto(mes?: string) { return colaboradorRequest<PontoResponse>(`/api/sharebrasil/ponto${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`); }
export function marcarPonto(acao: "entrada" | "inicio_almoco" | "fim_almoco" | "pausa" | "saida" | "encerrar", data?: string, hora?: string) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/ponto/marcar", { method: "POST", body: JSON.stringify({ acao, data, hora }) }); }
export function solicitarCorrecaoPonto(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/ponto/correcao", { method: "POST", body: JSON.stringify(payload) }); }
export function enviarJustificativaAusencia(data: string, justificativa: string, arquivo?: File) { const body = new FormData(); body.append("data_registro", data); body.append("justificativa", justificativa); if (arquivo) body.append("arquivo", arquivo); return colaboradorRequest<Record<string, any>>("/api/sharebrasil/ponto/justificativa", { method: "POST", body }); }
export function buscarPastasDocumentos() { return colaboradorRequest<PastaDocumento[]>("/api/sharebrasil/documentos/pastas"); }
export function criarPastaDocumento(nome: string, pastaPaiId?: string) { return colaboradorRequest<PastaDocumento>("/api/sharebrasil/documentos/pastas", { method: "POST", body: JSON.stringify({ nome, pasta_pai_id: pastaPaiId || null }) }); }
export function buscarDocumentosInternos(pastaId?: string) { return colaboradorRequest<DocumentoInterno[]>(`/api/sharebrasil/documentos${pastaId ? `?pasta_id=${encodeURIComponent(pastaId)}` : ""}`); }
export function enviarDocumentoInterno(arquivo: File, pastaId?: string) { const body = new FormData(); body.append("arquivo", arquivo); if (pastaId) body.append("pasta_id", pastaId); return colaboradorRequest<DocumentoInterno>("/api/sharebrasil/documentos", { method: "POST", body }); }
export function buscarSenhas() { return colaboradorRequest<SenhaEmpresa[]>("/api/sharebrasil/senhas"); }
export function revelarSenha(id: string) { return colaboradorRequest<SenhaEmpresa>(`/api/sharebrasil/senhas/${id}`); }
export function criarSenha(payload: Partial<SenhaEmpresa>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/senhas", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarSenha(id: string, payload: Partial<SenhaEmpresa>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/senhas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirSenha(id: string) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/senhas/${id}`, { method: "DELETE" }); }
export function buscarContatosShare() { return colaboradorRequest<ContatoAgenda[]>("/api/sharebrasil/contatos"); }
export function criarContatoShare(payload: Partial<ContatoAgenda>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/contatos", { method: "POST", body: JSON.stringify(payload) }); }
export function excluirContatoShare(id: string) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/contatos/${id}`, { method: "DELETE" }); }
export function buscarClientesShare() { return colaboradorRequest<{ clientes: ClienteShare[]; socios: ClienteShare[]; vinculos: ClienteShare[]; documentos: ClienteShare[]; aeronaves: ClienteShare[] }>("/api/sharebrasil/clientes"); }
export function criarClienteShare(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/clientes", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarClienteShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function vincularAeronaveCliente(clienteId: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/aeronaves`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarLogoCliente(clienteId: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/logo`, { method: "POST", body }); }
export function enviarDocumentoCliente(clienteId: string, arquivo: File, categoria = "geral") { const body = new FormData(); body.append("arquivo", arquivo); body.append("categoria", categoria); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/documentos`, { method: "POST", body }); }

export type TarefaShare = { id: string; titulo: string; descricao: string | null; status: string; prioridade: string; criado_por: string | null; prazo: string | null; criado_em: string; atualizado_em: string | null; publico: number; origem: string; progresso: number; atribuido_para: string[]; comentarios: Array<Record<string, any>> };
export type NotificacaoTarefa = { id: string; id_da_tarefa: string; user_id: string; mensagem: string; status_alterado_para: string | null; lido: number; criado_em: string; atualizado_em: string | null };
export type CategoriaCalendario = { id: string; usuario_id: string; nome: string; cor: string; criado_em: string };
export type LembreteCalendario = { id: string; usuario_id: string; titulo: string; descricao: string | null; data: string; hora: string | null; visibilidade: "PRIVADO" | "TODOS"; cor_categoria_id: string | null; categoria_nome?: string | null; categoria_cor?: string | null };
export type TarefasResponse = { tarefas: TarefaShare[]; notificacoes: NotificacaoTarefa[] };
export type UsuariosTarefas = Array<{ id: string; nome_completo: string; nome_exibicao: string | null; email: string; tipo_user: string | null; departamento: string | null }>;
export function buscarTarefas() { return colaboradorRequest<TarefasResponse>("/api/sharebrasil/tarefas"); }
export function buscarUsuariosTarefas() { return colaboradorRequest<UsuariosTarefas>("/api/sharebrasil/tarefas/usuarios"); }
export function criarTarefaShare(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/tarefas", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarTarefaShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/tarefas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function comentarTarefaShare(id: string, comentario: string) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/tarefas/${id}/comentarios`, { method: "POST", body: JSON.stringify({ comentario }) }); }
export function marcarNotificacaoTarefaLida(id: string) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/notificacoes/${id}/lida`, { method: "PATCH" }); }
export function buscarCategoriasCalendario() { return colaboradorRequest<CategoriaCalendario[]>("/api/sharebrasil/calendario/categorias"); }
export function criarCategoriaCalendario(nome: string, cor: string) { return colaboradorRequest<CategoriaCalendario>("/api/sharebrasil/calendario/categorias", { method: "POST", body: JSON.stringify({ nome, cor }) }); }
export function buscarLembretesCalendario(inicio: string, fim: string) { return colaboradorRequest<LembreteCalendario[]>(`/api/sharebrasil/calendario?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`); }
export function criarLembreteCalendario(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/calendario", { method: "POST", body: JSON.stringify(payload) }); }

export type RecadoColaborador = { id: string; criado_em: string; atualizado_em: string | null; autor_id: string; autor_nome: string | null; mensagem: string; fixado: boolean; departamento_id: string | null; departamento: string | null; lido: boolean };
export type DepartamentoRecado = { departamento: string };
export function buscarRecados() { return colaboradorRequest<RecadoColaborador[]>("/api/colaborador/recados"); }
export function buscarDepartamentosRecados() { return colaboradorRequest<DepartamentoRecado[]>("/api/colaborador/recados/departamentos"); }
export function criarRecado(mensagem: string, departamento?: string | null, fixado = false) { return colaboradorRequest<Record<string, any>>("/api/colaborador/recados", { method: "POST", body: JSON.stringify({ mensagem, departamento: departamento || null, fixado }) }); }
export function marcarRecadoLido(id: string) { return colaboradorRequest<Record<string, any>>(`/api/colaborador/recados/${id}/lido`, { method: "PATCH" }); }

export type HabilitacaoTripulante = { id: string; tripulacao_id: string | null; tipo_habilitacao: string; data_validade: string | null; classe_cma: string | null; validade_cma: string | null; fs_rh: string | null };
export type TripulanteGestao = { id: string; user_id: string | null; canac: string; nome_completo: string; status: string | null; tipo_licenca: string | null; email?: string | null; telefone?: string | null; url_avatar?: string | null; departamento?: string | null };
export type FreelancerTripulacao = { id: string; canac: string; nome_completo: string; data_nascimento?: string | null; url_avatar?: string | null; status: string | null; telefone?: string | null; aeronave_id?: string | null; matricula_registro?: string | null; fabricante?: string | null; modelo?: string | null; observacao?: string | null };
export type AeronaveTripulacao = { id: string; matricula_registro: string; fabricante: string; modelo: string; tipo_aeronave: string | null; numero_motores: number | null; status: string | null };
export type GestaoTripulacaoResponse = { tripulantes: TripulanteGestao[]; habilitacoes: HabilitacaoTripulante[]; freelancers: FreelancerTripulacao[]; aeronaves: AeronaveTripulacao[] };
export type HoraTripulacao = { canac: string | null; nome: string; funcao: "PIC" | "SIC"; horas_totais: number; horas_pic: number; horas_sic: number; horas_diurnas: number; horas_noturnas: number; horas_ifr: number; voos: number };
export type HorasTripulacaoResponse = { inicio: string; fim: string; voos: Array<Record<string, any>>; totais: HoraTripulacao[] };
export function buscarGestaoTripulacao() { return colaboradorRequest<GestaoTripulacaoResponse>("/api/interno/tripulacao/gestao"); }
export function atualizarTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function criarHabilitacaoTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/${id}/habilitacoes`, { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarHabilitacaoTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/habilitacoes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function criarTripulanteFreelancer(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/interno/tripulacao-freelancer", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarTripulanteFreelancer(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao-freelancer/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function buscarHorasTripulacao(params: { mes?: string; inicio?: string; fim?: string; aeronave_id?: string }) { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString(); return colaboradorRequest<HorasTripulacaoResponse>(`/api/interno/tripulacao/horas${query ? `?${query}` : ""}`); }

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
  socio_id?: string | null;
  cliente_emprestimo_id?: string | null;
  socio_emprestimo_id?: string | null;
  aeronave_id: string | null;
  origem: string;
  destino: string;
  data_agendada: string;
  data_fim?: string | null;
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
  cliente_emprestimo_nome?: string | null;
  socio_emprestimo_nome?: string | null;
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
  consumo_combustivel?: number | string | null;
  velocidade_cruzeiro?: number | string | null;
  performance_categoria?: string | null;
  performance_velocidade_cruzeiro_kt?: number | null;
  performance_teto_servico_ft?: number | null;
  performance_taxa_subida_fpm?: number | null;
  performance_taxa_descida_fpm?: number | null;
};

export type TripulanteAgendamento = {
  id: string;
  nome_completo: string;
  canac: string;
  status: string | null;
  tipo_licenca: string | null;
  url_avatar?: string | null;
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
  data_fim: string;
  horario_previsto_agendamento?: string;
  numero_passageiros?: number;
  cliente_emprestimo_id?: string;
  socio_emprestimo_id?: string;
  voo_emprestimo_confirmado?: boolean;
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

export function excluirAgendamento(id: string) {
  return colaboradorRequest<{ success: boolean; agendamento_id: string }>(`/api/interno/agendamento/${encodeURIComponent(id)}`, {
    method: "DELETE",
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

export type PlanoVooSalvo = {
  id: string;
  numero_voo: string | null;
  adep: string;
  ades: string;
  data_voo: string | null;
  eobt: string | null;
  created_at: string;
  payload: Record<string, any>;
};

export function buscarPlanosVoo() {
  return colaboradorRequest<PlanoVooSalvo[]>("/api/interno/planos-voo");
}

export function salvarPlanoVoo(payload: Record<string, unknown>) {
  return colaboradorRequest<{ id: string; created_at: string }>("/api/interno/planos-voo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function buscarPainelFinanceiro() {
  return colaboradorRequest<PainelFinanceiroResponse>("/api/interno/dashboard/financeiro");
}
