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
  const data = await response.json().catch(() => null) as T & { error?: string; detail?: string; solicitacao_id?: string; cliente_id?: string | null; socio_id?: string | null; aeronave_id?: string | null } | null;
  if (!response.ok) {
    const diagnostico = [data?.detail, data?.solicitacao_id && `solicitacao=${data.solicitacao_id}`, data?.cliente_id && `cliente=${data.cliente_id}`, data?.socio_id && `socio=${data.socio_id}`, data?.aeronave_id && `aeronave=${data.aeronave_id}`].filter(Boolean).join(" | ");
    throw new Error([data?.error || `api_${response.status}`, diagnostico].filter(Boolean).join(" — "));
  }
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
export function buscarClientesShare() { return colaboradorRequest<{ clientes: ClienteShare[]; socios: ClienteShare[]; vinculos: ClienteShare[]; documentos: ClienteShare[]; documentos_socios?: ClienteShare[]; aeronaves: ClienteShare[] }>("/api/sharebrasil/clientes"); }
export function criarClienteShare(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/clientes", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarClienteShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function atualizarSocioShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/socios/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function vincularAeronaveCliente(clienteId: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/aeronaves`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarLogoCliente(clienteId: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/logo`, { method: "POST", body }); }
export function enviarDocumentoCliente(clienteId: string, arquivo: File, categoria = "geral") { const body = new FormData(); body.append("arquivo", arquivo); body.append("categoria", categoria); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/documentos`, { method: "POST", body }); }
export function enviarDocumentoSocioShare(socioId: string, arquivo: File, categoria = "geral") { const body = new FormData(); body.append("arquivo", arquivo); body.append("categoria", categoria); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/socios/${socioId}/documentos`, { method: "POST", body }); }

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
export type MaterialTreinamento = { id: string; titulo: string; descricao: string; video_url: string | null; conteudo_html: string | null; categoria: "TUTORIAL" | "TREINAMENTO" | string; tema: string | null; ordem: number; criado_por: string | null; criado_em: string; atualizado_em: string; arquivo_url: string | null; tipo_arquivo: string | null; tamanho_arquivo: number | null; publicado: boolean };
export type SalaTreinamento = { id: string; titulo: string; descricao: string | null; status: string; criado_por: string; criado_por_nome?: string | null; criado_em: string; encerrado_em?: string | null };
export function buscarMateriaisCentro(categoria: "TUTORIAL" | "TREINAMENTO") { return colaboradorRequest<MaterialTreinamento[]>(`/api/sharebrasil/centro-treinamento/materiais?categoria=${categoria}`); }
export function criarMaterialCentro(body: FormData) { return colaboradorRequest<MaterialTreinamento>("/api/sharebrasil/centro-treinamento/materiais", { method: "POST", body }); }
export function atualizarMaterialCentro(id: string, payload: Record<string, unknown>) { return colaboradorRequest<MaterialTreinamento>(`/api/sharebrasil/centro-treinamento/materiais/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirMaterialCentro(id: string) { return colaboradorRequest<Record<string, unknown>>(`/api/sharebrasil/centro-treinamento/materiais/${id}`, { method: "DELETE" }); }
export function carregarMaterialCentro(id: string) { return carregarArquivoColaborador(`/api/sharebrasil/centro-treinamento/materiais/${id}/arquivo`); }
export function buscarSalasTreinamento() { return colaboradorRequest<SalaTreinamento[]>("/api/sharebrasil/centro-treinamento/reunioes"); }
export function criarSalaTreinamento(payload: { titulo: string; descricao?: string }) { return colaboradorRequest<SalaTreinamento>("/api/sharebrasil/centro-treinamento/reunioes", { method: "POST", body: JSON.stringify(payload) }); }
export function encerrarSalaTreinamento(id: string) { return colaboradorRequest<Record<string, unknown>>(`/api/sharebrasil/centro-treinamento/reunioes/${id}/encerrar`, { method: "POST" }); }
export function buscarIceServersCentro() { return colaboradorRequest<{ ice_servers: RTCIceServer[]; turn_configurado: boolean }>("/api/sharebrasil/centro-treinamento/turn"); }
export type HotelShare = { id: string; nome: string; telefone: string | null; endereco: string | null; uf: string | null; cidade: string | null; preco_single: number | null; preco_duplo: number | null; criado_em: string; atualizado_em: string; estrelas: number; convenio: boolean; email: string | null; telefone_reservas: string | null; contato_comercial: string | null; telefone_comercial: string | null; email_comercial: string | null; observacoes: string | null };
export type ReservaHotelPayload = { data_checkin: string; data_checkout: string; tipo_quarto: string; quantidade_hospedes: number; hospede_nome: string; hospede_telefone: string; hospede_email?: string; observacoes?: string };
export function buscarHoteisShare(q = "", ordem = "nome") { const params = new URLSearchParams({ ordem }); if (q) params.set("q", q); return colaboradorRequest<HotelShare[]>(`/api/sharebrasil/hoteis?${params}`); }
export function criarHotelShare(payload: Partial<HotelShare>) { return colaboradorRequest<HotelShare>("/api/sharebrasil/hoteis", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarHotelShare(id: string, payload: Partial<HotelShare>) { return colaboradorRequest<HotelShare>(`/api/sharebrasil/hoteis/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirHotelShare(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/sharebrasil/hoteis/${id}`, { method: "DELETE" }); }
export function reservarHotelShare(id: string, payload: ReservaHotelPayload) { return colaboradorRequest<{ success: boolean; id: string; destinatario_email: string }>(`/api/sharebrasil/hoteis/${id}/reservar`, { method: "POST", body: JSON.stringify(payload) }); }
export type ColaboradorGestao = { id: string; email: string; nome_completo: string; nome_exibicao: string | null; telefone: string | null; cidade: string | null; uf: string | null; data_nascimento: string | null; data_admissao: string | null; cpf: string | null; rg: string | null; canac: string | null; status: string | null; tipo_user: string | null; departamento: string | null; data_criacao: string | null; data_atualizacao: string | null };
export function buscarGestaoColaboradores() { return colaboradorRequest<ColaboradorGestao[]>("/api/gestor/gestao-colaborador"); }
export function criarUsuarioColaborador(payload: Record<string, unknown>) { return colaboradorRequest<ColaboradorGestao>("/api/gestor/gestao-colaborador", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarGestaoColaborador(id: string, payload: Record<string, unknown>) { return colaboradorRequest<ColaboradorGestao>(`/api/gestor/gestao-colaborador/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export type EnvioPagamento = { id: string; tipo: "share" | "reembolso" | "cliente"; descricao: string; valor: number; data_despesa: string | null; vencimento: string | null; fornecedor: string | null; cliente_id: string | null; socio_id: string | null; aeronave_id: string | null; numero_voo: string | null; centro_custo: string | null; observacoes: string | null; status: string; criado_por: string | null; criado_em: string };
export function buscarEnviosPagamento(tipo?: EnvioPagamento["tipo"]) { return colaboradorRequest<{ envios: EnvioPagamento[] }>(`/api/financeiro/envios-pagamento${tipo ? `?tipo=${tipo}` : ""}`); }
export function criarEnvioPagamento(payload: Omit<EnvioPagamento, "id" | "status" | "criado_por" | "criado_em">) { return colaboradorRequest<EnvioPagamento>("/api/financeiro/envios-pagamento", { method: "POST", body: JSON.stringify(payload) }); }
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

export type Abastecimento = { id: string; cliente_id: string | null; socio_id: string | null; aeronave_id: string | null; data: string; tipo_combustivel: string | null; trecho: string | null; local: string; numero_comanda: string | null; numero_nf: string | null; litros: number; valor_unitario: number; valor_total: number; desconto: number | null; comanda_url: string | null; nota_url: string | null; boleto_url: string | null; fornecedor_id: string | null; status: string | null; observacao: string | null; forma_pagamento: string | null; data_vencimento_boleto: string | null; data_pagamento: string | null; banco: string | null; voo_emprestado: number; numero_voo: string | null; cliente_nome?: string | null; socio_nome?: string | null; matricula_registro?: string | null; fabricante?: string | null; modelo?: string | null; fornecedor_nome?: string | null; fornecedor_apelido?: string | null; criado_por_nome?: string | null };
export type AbastecimentoOpcoes = { clientes: Array<{ id: string; nome: string | null; codigo_cliente: string | null }>; socios: Array<{ id: string; nome: string; cliente_id: string; cliente_nome: string | null }>; aeronaves: Array<{ id: string; matricula_registro: string; fabricante: string; modelo: string; status: string | null }>; fornecedores: Array<Record<string, any>>; diarios: Array<Record<string, any>> };
export function buscarAbastecimentoOpcoes(aeronaveId?: string) { return colaboradorRequest<AbastecimentoOpcoes>(`/api/interno/abastecimentos/opcoes${aeronaveId ? `?aeronave_id=${encodeURIComponent(aeronaveId)}` : ""}`); }
export function criarFornecedorAbastecimento(payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>("/api/interno/abastecimentos/fornecedores", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarFornecedorAbastecimento(id: string, payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>(`/api/interno/abastecimentos/fornecedores/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirFornecedorAbastecimento(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/abastecimentos/fornecedores/${id}`, { method: "DELETE" }); }
export function buscarAbastecimentos(params: Record<string, string> = {}) { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString(); return colaboradorRequest<{ abastecimentos: Abastecimento[] }>(`/api/interno/abastecimentos${query ? `?${query}` : ""}`); }
export function criarAbastecimento(payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>("/api/interno/abastecimentos", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarAbastecimento(id: string, payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>(`/api/interno/abastecimentos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirAbastecimento(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/abastecimentos/${id}`, { method: "DELETE" }); }
export function anexarArquivoAbastecimento(id: string, tipo: "comanda" | "nota" | "boleto", arquivo: File) { const body = new FormData(); body.append("tipo", tipo); body.append("arquivo", arquivo); return colaboradorRequest<{ success: boolean; caminho_arquivo: string }>(`/api/interno/abastecimentos/${id}/arquivo`, { method: "POST", body }); }
export async function baixarArquivoAbastecimento(id: string, tipo: "comanda" | "nota" | "boleto") { const response = await fetch(`${getApiBaseUrl()}/api/interno/abastecimentos/${id}/arquivo/${tipo}`, { headers: authHeaders() }); if (!response.ok) throw new Error("Não foi possível baixar o arquivo do abastecimento."); return response.blob(); }

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
  checklist_status?: string | null;
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
  status: "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel" | string;
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

export function definirDisponibilidadeTripulacao(dados: { tripulante_id: string; data_inicio: string; data_fim?: string; status: "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel"; observacoes?: string }) {
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

export type ChecklistPreVoo = { id: string; solicitacao_id: string; itens: Record<string, unknown>; observacoes: string | null; abastecimento_id: string | null; status: string; executado_por_nome?: string | null; usuario_id?: string | null };
export function buscarChecklistPreVoo(id: string) { return colaboradorRequest<ChecklistPreVoo | null>(`/api/interno/agendamento/${id}/checklist`); }
export function salvarChecklistPreVoo(id: string, payload: { itens: Record<string, unknown>; observacoes?: string; abastecimento?: Record<string, unknown>; status?: string }) { return colaboradorRequest<{ id: string; abastecimento_id: string | null }>(`/api/interno/agendamento/${id}/checklist`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarComandaAbastecimento(id: string, arquivo: File) { const form = new FormData(); form.append("arquivo", arquivo); form.append("tipo", "comanda"); return colaboradorRequest<{ success: boolean; caminho_arquivo: string }>(`/api/interno/abastecimentos/${id}/arquivo`, { method: "POST", body: form }); }

export type ItemCarregamento = { id: string; descricao: string; peso: number | null; braco: number | null };
export type PesoBalanceamentoFicha = {
  id: string;
  solicitacao_id: string;
  aeronave_id: string;
  peso_balanceamento_id: string;
  data_voo: string;
  numero_voo: string | null;
  piloto_responsavel: string;
  peso_vazio_kg: number;
  braco_vazio: number | null;
  momento_vazio: number | null;
  itens_carregamento: ItemCarregamento[];
  fuel_litros: number | null;
  fuel_kg: number | null;
  fuel_braco: number | null;
  fuel_momento: number | null;
  peso_total_kg: number | null;
  momento_total: number | null;
  cg_calculado: number | null;
  peso_maximo_decolagem: number | null;
  peso_maximo_pouso: number | null;
  peso_maximo_sem_combustivel: number | null;
  cg_limite_dianteiro: number | null;
  cg_limite_traseiro: number | null;
  dentro_dos_limites: number | boolean | null;
  status: string;
  snapshot_limites: Record<string, unknown>;
  observacoes: string | null;
  assinatura_nome: string | null;
  criado_em: string;
  finalizado_em: string | null;
};
export type PesoBalanceamentoContexto = {
  solicitacao: SolicitacaoVooInterna & { fabricante?: string | null; matricula_registro?: string | null; modelo?: string | null };
  piloto: { id: string; nome: string; canac: string | null } | null;
  copiloto: { id: string; nome: string; canac: string | null } | null;
  configuracao: Record<string, any> | null;
  ficha: PesoBalanceamentoFicha | null;
};
export function buscarPesoBalanceamentoVoo(id: string) { return colaboradorRequest<PesoBalanceamentoContexto>(`/api/interno/agendamento/${id}/peso-balanceamento`); }
export function salvarPesoBalanceamentoVoo(id: string, payload: Record<string, unknown>) { return colaboradorRequest<{ success: boolean; ficha: PesoBalanceamentoFicha }>(`/api/interno/agendamento/${id}/peso-balanceamento`, { method: "POST", body: JSON.stringify(payload) }); }

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

export type DiarioAeronaveResumo = {
  id: string;
  matricula_registro: string;
  fabricante: string | null;
  modelo: string | null;
  status: string | null;
  consumo_combustivel: number | string | null;
  horas_ano: number;
  celula_atual_ttotal: number;
  celula_prox_revisao_ttotal: number;
  mes_referencia: number;
  fechado: number;
};

export type DiarioTripulante = { id: string; canac: string; nome_completo: string; status: string | null; origem: string };
export type DiarioOpcaoCliente = { id: string; nome: string | null; codigo_cliente: string | null; proprietario?: string | null };
export type DiarioOpcaoSocio = { id: string; nome: string; cliente_id: string | null };
export type DiarioOpcaoAerodromo = { id: string; designativo: string; nome: string };
export type DiarioOpcoesResponse = { clientes: DiarioOpcaoCliente[]; socios: DiarioOpcaoSocio[]; tripulantes: DiarioTripulante[]; aerodromos: DiarioOpcaoAerodromo[] };
export type DiarioMes = {
  id: string;
  aeronave_id: string;
  ano: number;
  mes: number;
  celula_anterior_ttotal: number;
  celula_atual_ttotal: number;
  celula_prox_revisao_ttotal: number;
  celula_disponivel_ttotal: number;
  horimetro_inicio: number;
  horimetro_final: number;
  horimetro_ativo: number;
  fechado: number;
  aerodromo_base: string | null;
  tarifa_diaria: number;
  consumo_combustivel: string | null;
  tem_tarifa_diaria: number;
  celula_atual_tvoo: number | null;
  celula_disponivel_tvoo: number | null;
  celula_anterior_tvoo: number | null;
  celula_prox_revisao_tvoo: number | null;
};
export type DiarioLancamento = {
  id: string;
  numero_sequencial: number;
  diario_mes_id: string;
  aeronave_id: string;
  numero_voo: string | null;
  data_registro: string;
  aerodromo_partida: string;
  aerodromo_chegada: string;
  aerodromo_partida_icao?: string | null;
  aerodromo_partida_nome?: string | null;
  aerodromo_chegada_icao?: string | null;
  aerodromo_chegada_nome?: string | null;
  trecho: string | null;
  pic_canac: string;
  pic_nome: string | null;
  pic_nome_exibicao?: string | null;
  sic_canac: string | null;
  sic_nome: string | null;
  sic_nome_exibicao?: string | null;
  cliente_id: string | null;
  socio_id: string | null;
  cliente_tomador_emprestimo_id?: string | null;
  socio_tomador_emprestimo_id?: string | null;
  cliente_nome?: string | null;
  cliente_codigo?: string | null;
  cliente_proprietario?: string | null;
  socio_nome?: string | null;
  cliente_tomador_nome?: string | null;
  cliente_tomador_codigo?: string | null;
  socio_tomador_nome?: string | null;
  voo_emprestado: number;
  tempo_ac: string | null;
  tempo_dep: string | null;
  tempo_pou: string | null;
  tempo_cor: string | null;
  tempo_ifr: number;
  tempo_voo: number;
  tempo_total: number;
  horas_diurnas: number;
  horas_noturnas: number;
  pousos_total: number;
  distancia_nm: number;
  litros_combustivel_inicio_voo: number;
  litros_combustivel_abastecido: number;
  local_combustivel: string | null;
  celula: number;
  passageiros: number;
  carga_kg: string | null;
  natureza_voo: string;
  ocorrencias: string | null;
  discrepancias: string | null;
  acoes_corretivas: string | null;
  confirmado: number;
  abastecimento_id?: string | null;
  abastecimento_litros?: number | null;
  abastecimento_data?: string | null;
  abastecimento_pagador_nome?: string | null;
  abastecimento_comanda?: string | null;
  abastecimento_nota?: string | null;
};
export type DiarioDetalhesResponse = { aeronave: DiarioAeronaveResumo; diario_mes: DiarioMes | null; lancamentos: DiarioLancamento[]; meses_disponiveis: Array<Pick<DiarioMes, "id" | "ano" | "mes" | "fechado" | "celula_atual_ttotal" | "celula_prox_revisao_ttotal">>; horas_cotistas?: Array<{ cotista_id: string | null; cotista_nome: string; horas_voo: number }>; horas_emprestadas?: { horas_total: number; quantidade: number } };

export function buscarResumoDiario(ano?: number) {
  return colaboradorRequest<{ ano: number; aeronaves: DiarioAeronaveResumo[] }>(`/api/interno/diario-bordo/resumo${ano ? `?ano=${ano}` : ""}`);
}

export function buscarOpcoesDiario() {
  return colaboradorRequest<DiarioOpcoesResponse>("/api/interno/diario-bordo/opcoes");
}

export function buscarDetalhesDiario(aeronaveId: string, ano: number, mes: number) {
  const params = new URLSearchParams({ aeronave_id: aeronaveId, ano: String(ano), mes: String(mes) });
  return colaboradorRequest<DiarioDetalhesResponse>(`/api/interno/diario-bordo/detalhes?${params.toString()}`);
}

export function criarMesDiario(payload: Record<string, unknown>) {
  return colaboradorRequest<DiarioMes>("/api/interno/diario-bordo/mes", { method: "POST", body: JSON.stringify(payload) });
}

export function atualizarMesDiario(id: string, payload: Record<string, unknown>) {
  return colaboradorRequest<DiarioMes>(`/api/interno/diario-bordo/mes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function criarLancamentoDiario(payload: Record<string, unknown>) {
  return colaboradorRequest<DiarioLancamento>("/api/interno/diario-bordo/lancamentos", { method: "POST", body: JSON.stringify(payload) });
}

export function atualizarLancamentoDiario(id: string, payload: Record<string, unknown>) {
  return colaboradorRequest<DiarioLancamento>(`/api/interno/diario-bordo/lancamentos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function excluirLancamentoDiario(id: string) {
  return colaboradorRequest<{ success: boolean }>(`/api/interno/diario-bordo/lancamentos/${id}`, { method: "DELETE" });
}

export type AerodromoCadastro = { id: string; nome: string; designativo_icao: string; coordenadas: string | null };
export function buscarAerodromosCadastro() { return colaboradorRequest<{ aerodromos: AerodromoCadastro[] }>("/api/interno/aerodromos"); }
export function criarAerodromoCadastro(payload: Omit<AerodromoCadastro, "id">) { return colaboradorRequest<AerodromoCadastro>("/api/interno/aerodromos", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarAerodromoCadastro(id: string, payload: Omit<AerodromoCadastro, "id">) { return colaboradorRequest<{ success: boolean }>(`/api/interno/aerodromos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirAerodromoCadastro(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/aerodromos/${id}`, { method: "DELETE" }); }

export type JornadaVoo = { id: string; solicitacao_id: string; aeronave_id: string; tripulante_id: string | null; data: string; horario_acionamento: string | null; horario_apresentacao: string | null; horario_corte_inicio: string | null; horario_corte_final: string | null; status: string; pernas: Array<{ id: string; numero: number; origem: string; destino: string; horario_ac: string | null; horario_dep: string | null; horario_pouso: string | null; horario_corte: string | null; status: string }> };
export function buscarJornadaVoo(id: string) { return colaboradorRequest<JornadaVoo | null>(`/api/interno/agendamento/${id}/jornada`); }
export function iniciarJornadaVoo(id: string, payload: Record<string, unknown>) { return colaboradorRequest<JornadaVoo>(`/api/interno/agendamento/${id}/jornada`, { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarJornadaVoo(id: string, payload: Record<string, unknown>) { return colaboradorRequest<JornadaVoo>(`/api/interno/jornadas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function adicionarPernaJornada(id: string, payload: Record<string, unknown>) { return colaboradorRequest<{ id: string; status: string }>(`/api/interno/jornadas/${id}/pernas`, { method: "POST", body: JSON.stringify(payload) }); }
