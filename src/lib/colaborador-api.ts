import { supabase } from "@/lib/supabase";
import { API_BASE } from "@/lib/api";
import type { Periodicidade } from "@/types/financeiro";

const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type PerfilColaborador = {
  id: string;
  email: string;
  nome_completo: string;
  nome_exibicao: string | null;
  foto_url: string | null;
  url_avatar?: string | null;
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
  data_vencimento: string | null;
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
export type PernaOperacao = {
  id: string; numero: number; jornada_numero: number;
  origem: string; destino: string; status: string;
  horario_ac: string | null; horario_dep: string | null;
  horario_pouso: string | null; horario_corte: string | null;
  horario_ac_user_id?: string | null; horario_dep_user_id?: string | null;
  horario_pouso_user_id?: string | null; horario_corte_user_id?: string | null;
  horario_ac_usuario_nome?: string | null; horario_dep_usuario_nome?: string | null;
  horario_pouso_usuario_nome?: string | null; horario_corte_usuario_nome?: string | null;
  origem_coord: { lat: number; lon: number } | null;
  destino_coord: { lat: number; lon: number } | null;
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

async function fetchColaborador(url: string, init: RequestInit): Promise<Response> {
  const podeRetentar = (init.method ?? "GET") === "GET";
  try {
    return await fetch(url, init);
  } catch {
    if (podeRetentar) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        return await fetch(url, init);
      } catch {
        /* cai no erro de conexão abaixo */
      }
    }
    throw new Error("Sem conexão com o servidor. Tente novamente.");
  }
}

export async function colaboradorRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) { await supabase.auth.signOut({ scope: "local" }).catch(() => undefined); throw new Error("sessao_expirada"); }
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (supabasePublishableKey) headers.set("apikey", supabasePublishableKey);
  const response = await fetchColaborador(`${API_BASE}${path}`, { ...init, headers, credentials: "omit", cache: "no-store" });
  const data = await response.json().catch(() => null) as T & { error?: string; message?: string; detail?: string; rateios?: Array<Record<string, unknown>>; solicitacao_id?: string; numero_voo?: string | null; tripulante_id?: string | null; tripulante_nome?: string | null; cliente_id?: string | null; socio_id?: string | null; aeronave_id?: string | null } | null;
  if (!response.ok) {
    const diagnostico = [data?.message, data?.detail, data?.numero_voo ? `voo=${data.numero_voo}` : data?.solicitacao_id && `solicitacao=${data.solicitacao_id}`, data?.tripulante_nome ? `tripulante=${data.tripulante_nome}` : data?.tripulante_id && `tripulante_id=${data.tripulante_id}`, data?.cliente_id && `cliente=${data.cliente_id}`, data?.socio_id && `socio=${data.socio_id}`, data?.aeronave_id && `aeronave=${data.aeronave_id}`].filter(Boolean).join(" | ");
    throw Object.assign(new Error([data?.error || `api_${response.status}`, diagnostico].filter(Boolean).join(" — ")), { rateiosDuplicados: data?.rateios });
  }
  return data as T;
}

export function buscarPerfilColaborador() {
  return colaboradorRequest<PerfilColaboradorResponse>("/api/colaborador/perfil");
}

export function buscarContagemMensagensNaoLidas() {
  return colaboradorRequest<MensagensNaoLidasResponse>("/api/mensagens/unread-count");
}

export type UsuarioMensagem = { id: string; nome: string; email: string; departamento?: string | null };
export type PastaMensagem = "inbox" | "nao-lidas" | "favoritas" | "enviadas" | "arquivo";
export type AnexoMensagemInterna = { id: string; nome_arquivo: string; tipo_arquivo: string | null; tamanho_arquivo?: number | null; criado_em?: string };
export type MensagemInterna = { id: string; remetente_id: string; destinatario_id: string; remetente_nome?: string; destinatario_nome?: string; assunto: string | null; conteudo: string; lida: number; favorita?: number; arquivada?: number; excluida?: number; papel?: "remetente" | "destinatario"; criado_em: string; anexos?: AnexoMensagemInterna[] };
export function buscarUsuariosMensagem() { return colaboradorRequest<{ usuarios: UsuarioMensagem[] }>("/api/mensagens/usuarios"); }
export function buscarInboxMensagens() { return colaboradorRequest<MensagemInterna[]>("/api/mensagens/inbox"); }
export function buscarMensagensPasta(pasta: PastaMensagem) { return colaboradorRequest<MensagemInterna[]>(`/api/mensagens/pasta/${pasta}`); }
export function buscarOutboxMensagens() { return buscarMensagensPasta("enviadas"); }
export function alterarEstadoMensagem(id: string, estado: Partial<Pick<MensagemInterna, "lida" | "favorita" | "arquivada" | "excluida">>) { return colaboradorRequest<{ success: boolean; mensagem_id: string }>(`/api/mensagens/${id}/estado`, { method: "PATCH", body: JSON.stringify(estado) }); }
export function enviarMensagemInterna(payload: { destinatario_id: string; assunto: string; conteudo: string; arquivos?: File[] }) {
  if (payload.arquivos?.length) {
    const body = new FormData();
    body.append("destinatario_id", payload.destinatario_id);
    body.append("assunto", payload.assunto);
    body.append("conteudo", payload.conteudo);
    payload.arquivos.forEach((arquivo) => body.append("arquivos", arquivo, arquivo.name));
    return colaboradorRequest<{ success: boolean; id: string; destinatario_id: string }>("/api/mensagens", { method: "POST", body });
  }
  return colaboradorRequest<{ success: boolean; id: string; destinatario_id: string }>("/api/mensagens", { method: "POST", body: JSON.stringify(payload) });
}
export async function baixarAnexoMensagem(mensagemId: string, anexoId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");
  const response = await fetch(`${API_BASE}/api/mensagens/${encodeURIComponent(mensagemId)}/anexos/${encodeURIComponent(anexoId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response.blob();
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
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) { await supabase.auth.signOut({ scope: "local" }).catch(() => undefined); throw new Error("sessao_expirada"); }
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
export type ContatoAgenda = { codigo_icao?: string | null; id: string; nome: string; nome_contato_responsavel?: string | null; telefone: string | null; email: string | null; empresa: string | null; razao_social?: string | null; cnpj?: string | null; cargo?: string | null; observacoes: string | null; endereco: string | null; uf: string | null; cidade: string | null; categoria: string | null; categoria_tipo?: "FORNECEDOR" | "FORNECEDOR PEÇAS" | "MANUTENÇÃO" | "HANGAR" | "OUTRO" | null; categoria_personalizada?: string | null; gpu?: string | null; transfer?: string | null; valor_gpu?: string | null; valor_transfer?: string | null; ar_condicionado?: string | null; pernoite?: string | null; atendimento_pista?: "SIM" | "NAO" | string | null };
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
export function atualizarContatoShare(id: string, payload: Partial<ContatoAgenda>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/contatos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirContatoShare(id: string) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/contatos/${id}`, { method: "DELETE" }); }
export function buscarClientesShare() { return colaboradorRequest<{ clientes: ClienteShare[]; holdings?: ClienteShare[]; socios: ClienteShare[]; vinculos: ClienteShare[]; documentos: ClienteShare[]; documentos_socios?: ClienteShare[]; aeronaves: ClienteShare[] }>("/api/sharebrasil/clientes"); }
export function criarClienteShare(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/clientes", { method: "POST", body: JSON.stringify(payload) }); }
export function criarHoldingShare(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/holdings", { method: "POST", body: JSON.stringify(payload) }); }
export function criarSocioHoldingShare(holdingId: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/holdings/${holdingId}/socios`, { method: "POST", body: JSON.stringify(payload) }); }
export function vincularAeronaveSocioShare(socioId: string, payload: { aeronave_id: string; percentual_sociedade: number }) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/socios/${socioId}/aeronave`, { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarClienteShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function atualizarHoldingShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/holdings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function atualizarSocioShare(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/socios/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function vincularAeronaveCliente(clienteId: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/aeronave`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarLogoCliente(clienteId: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/clientes/${clienteId}/logo`, { method: "POST", body }); }
export function enviarLogoHolding(holdingId: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo); return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/holdings/${holdingId}/logo`, { method: "POST", body }); }
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
export type OrigemNotificacao = "tarefa" | "geral";
export function marcarNotificacaoLida(id: string, origem: OrigemNotificacao = "tarefa") { const query = origem === "geral" ? "?origem=geral" : ""; return colaboradorRequest<Record<string, any>>(`/api/sharebrasil/notificacoes/${encodeURIComponent(id)}/lida${query}`, { method: "PATCH" }); }
export type NotificacaoInterna = { id: string; user_id?: string; departamento_destinatario?: string | null; status?: string | null; mensagem: string | null; lido: number; criado_em: string; atualizado_em: string | null; origem_notificacao: OrigemNotificacao; id_from?: string | null; id_da_tarefa?: string | null; status_alterado_para?: string | null; tarefa_titulo?: string | null; tarefa_origem?: string | null; relatorio_id?: string | null; anexos_rejeicao?: string | null };
export function buscarNotificacoesInternas() { return colaboradorRequest<{ notificacoes: NotificacaoInterna[] }>("/api/sharebrasil/notificacoes"); }
export function excluirNotificacaoInterna(id: string, origem: OrigemNotificacao = "tarefa") { const query = origem === "geral" ? "?origem=geral" : ""; return colaboradorRequest<{ success: boolean }>(`/api/sharebrasil/notificacoes/${encodeURIComponent(id)}${query}`, { method: "DELETE" }); }
export function limparNotificacoesInternas() { return colaboradorRequest<{ success: boolean }>("/api/sharebrasil/notificacoes", { method: "DELETE" }); }
export async function baixarAnexoRejeicaoRelatorio(relatorioId: string, anexoId: string) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(error ? "sessao_expirada" : "sessao_nao_encontrada");
  const response = await fetch(`${API_BASE}/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(relatorioId)}/anexos-rejeicao/${encodeURIComponent(anexoId)}/arquivo`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) throw new Error(`api_${response.status}`);
  return response.blob();
}
export type MaterialTreinamento = { id: string; titulo: string; descricao: string; video_url: string | null; conteudo_html: string | null; categoria: "TUTORIAL" | "TREINAMENTO" | string; tema: string | null; ordem: number; criado_por: string | null; criado_em: string; atualizado_em: string; arquivo_url: string | null; tipo_arquivo: string | null; tamanho_arquivo: number | null; publicado: boolean };
export type SalaTreinamento = { id: string; titulo: string; descricao: string | null; status: string; criado_por: string; criado_por_nome?: string | null; criado_em: string; encerrado_em?: string | null };
export function buscarMateriaisCentro(categoria: "TUTORIAL" | "TREINAMENTO") { return colaboradorRequest<MaterialTreinamento[]>(`/api/sharebrasil/centro-treinamento/materiais?categoria=${categoria}`); }
export function criarMaterialCentro(body: FormData) { return colaboradorRequest<MaterialTreinamento>("/api/sharebrasil/centro-treinamento/materiais", { method: "POST", body }); }
export function atualizarMaterialCentro(id: string, payload: Record<string, unknown>) { return colaboradorRequest<MaterialTreinamento>(`/api/sharebrasil/centro-treinamento/materiais/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirMaterialCentro(id: string) { return colaboradorRequest<Record<string, unknown>>(`/api/sharebrasil/centro-treinamento/materiais/${id}`, { method: "DELETE" }); }
export function carregarMaterialCentro(id: string) { return carregarArquivoColaborador(`/api/sharebrasil/centro-treinamento/materiais/${id}/arquivo`); }
export function buscarSalasTreinamento() { return colaboradorRequest<SalaTreinamento[]>("/api/sharebrasil/centro-treinamento/reunioes"); }
export function buscarSalasTreinamentoEncerradas() { return colaboradorRequest<SalaTreinamento[]>("/api/sharebrasil/centro-treinamento/reunioes/encerradas"); }
export function criarSalaTreinamento(payload: { titulo: string; descricao?: string }) { return colaboradorRequest<SalaTreinamento>("/api/sharebrasil/centro-treinamento/reunioes", { method: "POST", body: JSON.stringify(payload) }); }
export function encerrarSalaTreinamento(id: string) { return colaboradorRequest<Record<string, unknown>>(`/api/sharebrasil/centro-treinamento/reunioes/${id}/encerrar`, { method: "POST" }); }
export function excluirSalaTreinamento(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/sharebrasil/centro-treinamento/reunioes/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function buscarIceServersCentro() { return colaboradorRequest<{ ice_servers: RTCIceServer[]; turn_configurado: boolean }>("/api/sharebrasil/centro-treinamento/turn"); }
export type HotelShare = { id: string; nome: string; telefone: string | null; endereco: string | null; uf: string | null; cidade: string | null; preco_single: number | null; preco_duplo: number | null; criado_em: string; atualizado_em: string; estrelas: number; convenio: boolean; email: string | null; telefone_reservas: string | null; contato_comercial: string | null; telefone_comercial: string | null; email_comercial: string | null; observacoes: string | null; cafe_manha: string | null };
export type ReservaHotelPayload = { data_checkin: string; data_checkout: string; tipo_quarto: string; quantidade_hospedes: number; hospede_nome: string; hospede_telefone: string; hospede_email?: string; observacoes?: string };
export function buscarHoteisShare(q = "", ordem = "nome") { const params = new URLSearchParams({ ordem }); if (q) params.set("q", q); return colaboradorRequest<HotelShare[]>(`/api/sharebrasil/hoteis?${params}`); }
export function criarHotelShare(payload: Partial<HotelShare>) { return colaboradorRequest<HotelShare>("/api/sharebrasil/hoteis", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarHotelShare(id: string, payload: Partial<HotelShare>) { return colaboradorRequest<HotelShare>(`/api/sharebrasil/hoteis/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirHotelShare(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/sharebrasil/hoteis/${id}`, { method: "DELETE" }); }
export function reservarHotelShare(id: string, payload: ReservaHotelPayload) { return colaboradorRequest<{ success: boolean; id: string; destinatario_email: string }>(`/api/sharebrasil/hoteis/${id}/reservar`, { method: "POST", body: JSON.stringify(payload) }); }
export type ColaboradorGestao = { endereco?: string | null; nome_banco?: string | null; tipo_conta?: string | null; conta_numero?: string | null; agencia_numero?: string | null; tipo_chave_pix?: string | null; pix?: string | null; url_avatar?: string | null; id: string; email: string; nome_completo: string; nome_exibicao: string | null; telefone: string | null; cidade: string | null; uf: string | null; data_nascimento: string | null; data_admissao: string | null; cpf: string | null; rg: string | null; canac: string | null; status: string | null; tipo_user: string | null; departamento: string | null; departamentos_email: string | null; funcoes?: string[]; exame_admissional_realizado: number | boolean | null; exame_admissional_data: string | null; exame_admissional_local: string | null; exame_admissional_empresa: string | null; exame_admissional_prazo: string | null; exame_admissional_documento_id: string | null; data_criacao: string | null; data_atualizacao: string | null };
export function carregarFotoGestao(colaboradorId: string) { return carregarArquivoColaborador(`/api/gestor/gestao-colaborador/${encodeURIComponent(colaboradorId)}/foto`); }
export function buscarGestaoColaboradores() { return colaboradorRequest<ColaboradorGestao[]>("/api/gestor/gestao-colaborador"); }
export function criarUsuarioColaborador(payload: Record<string, unknown>) { return colaboradorRequest<ColaboradorGestao>("/api/gestor/gestao-colaborador", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarGestaoColaborador(id: string, payload: Record<string, unknown>) { return colaboradorRequest<ColaboradorGestao>(`/api/gestor/gestao-colaborador/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export type FichaColaborador = { perfil: ColaboradorGestao & { endereco: string | null }; documentos: Array<Record<string, any>>; funcoes: Array<{ id: string; funcao: string; criado_em: string | null }>; ferias: Array<SolicitacaoFerias>; recebimentos: Array<Record<string, any>> };
export function buscarFichaColaborador(id: string) { return colaboradorRequest<FichaColaborador>(`/api/gestor/gestao-colaborador/${encodeURIComponent(id)}/ficha`); }
export type DocumentoGestao = FichaColaborador["documentos"][number] & { user_id?: string; arquivo_url?: string };
export function enviarDocumentoGestao(colaboradorId: string, arquivo: File, categoria: string, nomeArquivo?: string) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); body.append("categoria", categoria); if (nomeArquivo?.trim()) body.append("nome_arquivo", nomeArquivo.trim()); return colaboradorRequest<DocumentoGestao>(`/api/gestor/gestao-colaborador/${encodeURIComponent(colaboradorId)}/documentos`, { method: "POST", body }); }
export function atualizarDocumentoGestao(colaboradorId: string, documentoId: string, categoria: string, arquivo?: File) { const body = new FormData(); body.append("categoria", categoria); if (arquivo) body.append("arquivo", arquivo, arquivo.name); return colaboradorRequest<DocumentoGestao>(`/api/gestor/gestao-colaborador/${encodeURIComponent(colaboradorId)}/documentos/${encodeURIComponent(documentoId)}`, { method: "PATCH", body }); }
export function excluirDocumentoGestao(colaboradorId: string, documentoId: string) { return colaboradorRequest<{ success: boolean }>(`/api/gestor/gestao-colaborador/${encodeURIComponent(colaboradorId)}/documentos/${encodeURIComponent(documentoId)}`, { method: "DELETE" }); }
export function carregarDocumentoGestao(colaboradorId: string, documentoId: string) { return carregarArquivoColaborador(`/api/gestor/gestao-colaborador/${encodeURIComponent(colaboradorId)}/documentos/${encodeURIComponent(documentoId)}/arquivo`); }
export type PeriodoAquisitivoFerias = { id: string; colaborador_id: string; data_inicio: string; data_fim: string; data_limite_concessao: string | null; dias_direito: number; dias_gozados: number; dias_abono: number; dias_disponiveis: number; status: string; criado_em: string; nome_completo: string | null; nome_exibicao: string | null; email: string | null; departamento: string | null; data_admissao: string | null };
export type FeriasCorporativasResponse = { inicio: string; registros: Array<SolicitacaoFerias & { colaborador_id: string; nome_completo: string | null; nome_exibicao: string | null; email: string | null; departamento: string | null; data_admissao: string | null }>; periodos: PeriodoAquisitivoFerias[]; resumo: { ativas: number; solicitadas: number; vencidas: number } };
export function buscarFeriasCorporativas(inicio?: string) { return colaboradorRequest<FeriasCorporativasResponse>(`/api/gestor/ferias${inicio ? `?inicio=${encodeURIComponent(inicio)}` : ""}`); }
export function atualizarFeriasGestor(id: string, payload: { status: "aprovada" | "reprovada" | "cancelada"; motivo_reprovacao?: string }) { return colaboradorRequest<SolicitacaoFerias>(`/api/gestor/ferias/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export type EnvioPagamento = { id: string; tipo: "share" | "reembolso" | "cliente"; descricao: string; valor: number; valor_centavos?: number; data_despesa: string | null; data_vencimento?: string | null; vencimento: string | null; fornecedor: string | null; cliente_id: string | null; socio_id: string | null; cotista_aeronave_id?: string | null; cotista_ids?: string[]; fornecedor_id?: string | null; categoria_id?: string | null; categoria_nome?: string | null; email_solicitado?: boolean; email_enviado?: boolean; lancamento_id?: string | null; aeronave_id: string | null; numero_voo: string | null; centro_custo: string | null; observacoes: string | null; status: string; criado_por: string | null; criado_em: string; grupo_categoria?: string | null; tipo_caixa?: "SHARE" | "CLIENTE" | "HOLDING" | null; tipo_despesa?: "fixo" | "variável" | null; periodicidade?: Periodicidade | null; anexos?: Array<{ id: string; tipo: string; numero: string }>; rateio_linhas?: Array<{ cotista_id: string; percentual: number; valor_centavos: number }>; gera_rateio?: boolean; pago_diretamente?: boolean; pago_por?: string | null };
export type OpcaoEnvioPagamento = { fornecedores: Array<{ id: string; label: string }>; fornecedores_combustivel: Array<Record<string, unknown>>; aeronaves: Array<{ id: string; matricula_registro: string; fabricante: string; modelo: string; url_imagem?: string | null }>; voos: Array<{ numero_voo: string; ultima_data?: string | null; aeronave_id?: string | null; origem?: string | null; destino?: string | null }>; categorias: Array<{ id: string; nome: string; grupo_categoria?: string | null; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null }>; categorias_cliente: Array<{ id: string; nome: string; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null }> };
export type CotistaAeronave = { id: string; aeronave_id: string; cliente_id: string | null; socio_id: string | null; cotista_ids?: string[]; fornecedor_id?: string | null; categoria_id?: string | null; categoria_nome?: string | null; email?: string | null; email_solicitado?: boolean; email_enviado?: boolean; percentual_sociedade: number; nome: string; holding_id: string | null; eh_holding: number };
export async function buscarOpcoesEnvioPagamento(): Promise<OpcaoEnvioPagamento> {
  return colaboradorRequest<OpcaoEnvioPagamento>("/api/financeiro/envios-pagamento/opcoes");
}
export type OpcoesAnexosEnvioPagamento = { recibos: Array<{ id: string; numero_recibo: string; descricao_servico?: string | null; data_emissao?: string | null; anexo_id?: string | null; quantidade_anexos?: number | null; nome_arquivo?: string | null; tipo_arquivo?: string | null; arquivo_url?: string | null }>; relatorios: Array<{ id: string; numero_voo?: string | null; numero_relatorio?: string | null; matricula_registro?: string | null; anexo_id?: string | null; nome_arquivo?: string | null; quantidade_anexos?: number | null; tipo_arquivo?: string | null; arquivo_url?: string | null }>; abastecimentos: Array<{ id: string; numero_voo?: string | null; trecho?: string | null; data?: string | null; numero_comanda?: string | null; numero_nf?: string | null; local?: string | null; matricula_registro?: string | null; cotista_nome?: string | null; quantidade_anexos?: number | null; comanda_url?: string | null; nota_url?: string | null; boleto_url?: string | null }> };
export type OrigemDespesaEnvio = "ABASTECIMENTO" | "RECIBOS" | "RELATORIOS DE VIAGEM";
export type DespesaOrigemEnvio = { id: string; numero_voo?: string | null; aeronave_id: string; data_despesa?: string | null; valor?: number | null; fornecedor?: string | null; descricao?: string | null; categoria_nome?: string | null; grupo_categoria?: string | null; numero_comanda?: string | null; numero_nf?: string | null; numero_recibo?: string | null; numero_relatorio?: string | null; comanda_url?: string | null; nota_url?: string | null; boleto_url?: string | null; url_demonstrativo?: string | null; url_nf?: string | null; url_recibo?: string | null; url_boleto?: string | null; url_doc?: string | null; pdf_url?: string | null };
export function buscarDespesasOrigemEnvio(aeronaveId: string, numeroVoo: string | undefined, origem: OrigemDespesaEnvio) { return colaboradorRequest<{ registros: DespesaOrigemEnvio[] }>(`/api/financeiro/envios-pagamento/despesas-origem?aeronave_id=${encodeURIComponent(aeronaveId)}${numeroVoo ? `&numero_voo=${encodeURIComponent(numeroVoo)}` : ""}&origem=${encodeURIComponent(origem)}`); }
export function buscarOpcoesAnexosEnvioPagamento() { return colaboradorRequest<OpcoesAnexosEnvioPagamento>("/api/financeiro/envios-pagamento/anexos-opcoes"); }
export function buscarCotistasAeronave(aeronaveId: string) { return colaboradorRequest<{ cotistas: CotistaAeronave[] }>(`/api/financeiro/envios-pagamento/aeronave/${encodeURIComponent(aeronaveId)}/cotistas`); }
export type FornecedorCriado = { item: { id: string; nome_completo?: string | null; apelido?: string | null; nome_fornecedor?: string | null; nome_cidade?: string | null } };
export function criarFornecedorFavorito(nomeCompleto: string) { return colaboradorRequest<FornecedorCriado>("/api/financeiro/configuracoes/fornecedores", { method: "POST", body: JSON.stringify({ nome_completo: nomeCompleto }) }); }
export function criarFornecedorCombustivel(nomeFornecedor: string) { return colaboradorRequest<FornecedorCriado>("/api/financeiro/fornecedores-combustivel", { method: "POST", body: JSON.stringify({ nome_fornecedor: nomeFornecedor }) }); }
export function atualizarParticipacaoCotista(id: string, dados: { aeronave_id: string; percentual_sociedade: number }) { return colaboradorRequest<{ success: boolean }>(`/api/financeiro/envios-pagamento/cotistas/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(dados) }); }
export function excluirParticipacaoCotista(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/financeiro/envios-pagamento/cotistas/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function enviarAnexoEnvioPagamento(arquivo: File, anexoId: string) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); body.append("anexo_id", anexoId); return colaboradorRequest<{ url: string; key: string }>("/api/financeiro/envios-pagamento/anexos", { method: "POST", body }); }
export function buscarEnviosPagamento(tipo?: EnvioPagamento["tipo"]) { return colaboradorRequest<{ envios: EnvioPagamento[] }>(`/api/financeiro/envios-pagamento${tipo ? `?tipo=${tipo}` : ""}`); }
export function criarEnvioPagamento(payload: Record<string, unknown>) { return colaboradorRequest<EnvioPagamento>("/api/financeiro/envios-pagamento", { method: "POST", body: JSON.stringify(payload) }); }
export type RascunhoEnvioPagamento = { id: string; tipo_envio: EnvioPagamento["tipo"]; etapa_atual: number; dados_json: string; idempotency_key: string; envio_id: string | null; status: string; atualizado_em: string; envio_status?: string | null; envio_lancamento_id?: string | null; envio_movimentacao_id?: string | null; emails_enviados?: number; total_destinatarios?: number; emails_falhos?: number; rateio_total?: number; rateio_concluidos?: number };
export type DestinatarioRascunhoEnvio = { cotista_id: string; status: "PENDENTE" | "PROCESSANDO" | "ENVIADO" | "FALHOU" | string; email_id: string | null; erro: string | null; atualizado_em: string };
export function buscarRascunhosEnvioPagamento() { return colaboradorRequest<{ rascunhos: RascunhoEnvioPagamento[] }>("/api/financeiro/envios-pagamento/rascunhos"); }
export function buscarRascunhoEnvioPagamento(id: string) { return colaboradorRequest<{ rascunho: RascunhoEnvioPagamento; destinatarios: DestinatarioRascunhoEnvio[] }>(`/api/financeiro/envios-pagamento/rascunhos/${encodeURIComponent(id)}`); }
export function excluirRascunhoEnvioPagamento(id: string) { return colaboradorRequest<{ ok: boolean }>(`/api/financeiro/envios-pagamento/rascunhos/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function salvarRascunhoEnvioPagamento(payload: { id: string; tipo_envio: EnvioPagamento["tipo"]; etapa_atual: number; dados: Record<string, unknown>; idempotency_key: string; envio_id?: string | null; status?: string; destinatarios?: string[] }) { return colaboradorRequest<{ ok: boolean; atualizado_em: string }>("/api/financeiro/envios-pagamento/rascunhos", { method: "POST", body: JSON.stringify(payload) }); }
export function registrarEmailEnvioPagamento(id: string) { return colaboradorRequest<EnvioPagamento>(`/api/financeiro/envios-pagamento/${encodeURIComponent(id)}/email-enviado`, { method: "POST" }); }
export function converterEnvioPagamento(id: string) { return colaboradorRequest<Record<string, unknown>>(`/api/financeiro/envios-pagamento/${id}/converter`, { method: "POST" }); }
export function buscarCategoriasCalendario() { return colaboradorRequest<CategoriaCalendario[]>("/api/sharebrasil/calendario/categorias"); }
export function criarCategoriaCalendario(nome: string, cor: string) { return colaboradorRequest<CategoriaCalendario>("/api/sharebrasil/calendario/categorias", { method: "POST", body: JSON.stringify({ nome, cor }) }); }
export function buscarLembretesCalendario(inicio: string, fim: string) { return colaboradorRequest<LembreteCalendario[]>(`/api/sharebrasil/calendario?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`); }
export function criarLembreteCalendario(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/sharebrasil/calendario", { method: "POST", body: JSON.stringify(payload) }); }

export type RecadoColaborador = { id: string; criado_em: string; atualizado_em: string | null; autor_id: string; autor_nome: string | null; mensagem: string; fixado: boolean; departamento_id: string | null; departamento: string | null; lido: boolean; pode_excluir: boolean };
export type DepartamentoRecado = { departamento: string };
export function buscarRecados() { return colaboradorRequest<RecadoColaborador[]>("/api/colaborador/recados"); }
export function buscarDepartamentosRecados() { return colaboradorRequest<DepartamentoRecado[]>("/api/colaborador/recados/departamentos"); }
export function criarRecado(mensagem: string, departamento?: string | null, fixado = false) { return colaboradorRequest<Record<string, any>>("/api/colaborador/recados", { method: "POST", body: JSON.stringify({ mensagem, departamento: departamento || null, fixado }) }); }
export function excluirRecado(id: string) { return colaboradorRequest<Record<string, any>>(`/api/colaborador/recados/${id}`, { method: "DELETE" }); }
export function marcarRecadoLido(id: string) { return colaboradorRequest<Record<string, any>>(`/api/colaborador/recados/${id}/lido`, { method: "PATCH" }); }

export type HabilitacaoTripulante = { id: string; tripulacao_id: string | null; tipo_habilitacao: string; data_validade: string | null; classe_cma: string | null; validade_cma: string | null; fs_rh: string | null };
export type TripulanteGestao = { id: string; user_id: string | null; canac: string; nome_completo: string; status: string | null; tipo_licenca: string | null; email?: string | null; telefone?: string | null; url_avatar?: string | null; foto_url?: string | null; departamento?: string | null };
export type FreelancerTripulacao = { id: string; canac: string; nome_completo: string; data_nascimento?: string | null; url_avatar?: string | null; status: string | null; telefone?: string | null; aeronave_id?: string | null; matricula_registro?: string | null; fabricante?: string | null; modelo?: string | null; observacao?: string | null };
export type AeronaveTripulacao = { id: string; matricula_registro: string; fabricante: string; modelo: string; tipo_aeronave: string | null; numero_motores: number | null; status: string | null };
export type GestaoTripulacaoResponse = { tripulantes: TripulanteGestao[]; habilitacoes: HabilitacaoTripulante[]; freelancers: FreelancerTripulacao[]; aeronaves: AeronaveTripulacao[] };
export type HoraTripulacao = { canac: string | null; nome: string; funcao: "PIC" | "SIC"; horas_totais: number; horas_pic: number; horas_sic: number; horas_diurnas: number; horas_computaveis: number; horas_noturnas: number; horas_ifr: number; voos: number };
export type HoraAeronave = { voos: number; horas_totais: number; horas_diurnas: number; horas_computaveis: number; horas_noturnas: number; horas_ifr: number };
export type ExtratoHorasAeronave = { aeronave_id: string | null; matricula_registro: string; voos: number; pic: HoraAeronave; sic: HoraAeronave };
export type HorasTripulacaoResponse = { inicio: string; fim: string; voos: Array<Record<string, any>>; totais: HoraTripulacao[]; por_aeronave: ExtratoHorasAeronave[] };
export function buscarGestaoTripulacao() { return colaboradorRequest<GestaoTripulacaoResponse>("/api/interno/tripulacao/gestao"); }
export function atualizarTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function criarHabilitacaoTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/${id}/habilitacoes`, { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarHabilitacaoTripulante(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/habilitacoes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function atualizarFsRhTripulante(id: string, fsRh: string | null) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao/${id}/fs-rh`, { method: "PATCH", body: JSON.stringify({ fs_rh: fsRh }) }); }
export function criarTripulanteFreelancer(payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>("/api/interno/tripulacao-freelancer", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarTripulanteFreelancer(id: string, payload: Record<string, any>) { return colaboradorRequest<Record<string, any>>(`/api/interno/tripulacao-freelancer/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirTripulanteFreelancer(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/tripulacao-freelancer/${id}`, { method: "DELETE" }); }
export function buscarHorasTripulacao(params: { mes?: string; inicio?: string; fim?: string; aeronave_id?: string; canac?: string }) { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString(); return colaboradorRequest<HorasTripulacaoResponse>(`/api/interno/tripulacao/horas${query ? `?${query}` : ""}`); }

export type Abastecimento = { id: string; cliente_id: string | null; socio_id: string | null; cotista_ids?: string[]; fornecedor_id: string | null; categoria_id?: string | null; categoria_nome?: string | null; email_solicitado?: boolean; email_enviado?: boolean; aeronave_id: string | null; data: string; tipo_combustivel: string | null; trecho: string | null; local: string; numero_comanda: string | null; numero_nf: string | null; litros: number; valor_unitario: number; valor_total: number; desconto: number | null; comanda_url: string | null; nota_url: string | null; boleto_url: string | null; comprovante_url?: string | null; status: string | null; observacao: string | null; forma_pagamento: string | null; data_vencimento_boleto: string | null; criado_por?: string | null; lancamento_diario_id: string | null; voo_emprestado: number; rateio_entre_cotistas?: number | boolean; numero_voo: string | null; prazo_envio_cliente: string | null; cliente_nome?: string | null; socio_nome?: string | null; matricula_registro?: string | null; fabricante?: string | null; modelo?: string | null; fornecedor_nome?: string | null; aerodromo_nome?: string | null; aerodromo_icao?: string | null; fornecedor_apelido?: string | null; criado_por_nome?: string | null };
export type FornecedorCombustivel = { id: string; nome_cidade: string; codigo_icao: string | null; nome_fornecedor: string; pessoa_contato: string | null; telefone: string | null; preco_avgas: number | null; preco_jet: number | null; criado_em?: string | null; atualizado_em?: string | null };
export type AbastecimentoOpcoes = { clientes: Array<{ id: string; nome: string | null; codigo_cliente: string | null }>; socios: Array<{ id: string; nome: string }>; aeronaves: Array<{ id: string; matricula_registro: string; fabricante: string; modelo: string; status: string | null }>; fornecedores: FornecedorCombustivel[]; diarios: Array<Record<string, any>>; trechos_diario?: Array<Record<string, any>>; ultimo_trecho?: { id: string; aeronave_id: string; data_registro: string; aerodromo_partida: string | null; aerodromo_chegada: string | null; cliente_id: string | null; socio_id: string | null; cliente_nome: string | null; socio_nome: string | null } | null; aerodromos: Array<{ id: string; nome: string; designativo_icao: string }> };
export function buscarAbastecimentoOpcoes(aeronaveId?: string) { return colaboradorRequest<AbastecimentoOpcoes>(`/api/interno/abastecimentos/opcoes${aeronaveId ? `?aeronave_id=${encodeURIComponent(aeronaveId)}` : ""}`); }
export function criarFornecedorAbastecimento(payload: Omit<FornecedorCombustivel, "id" | "criado_em" | "atualizado_em">) { return colaboradorRequest<{ id: string; success: boolean }>("/api/interno/abastecimentos/fornecedores", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarFornecedorAbastecimento(id: string, payload: Omit<FornecedorCombustivel, "id" | "criado_em" | "atualizado_em">) { return colaboradorRequest<{ id: string; success: boolean }>(`/api/interno/abastecimentos/fornecedores/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirFornecedorAbastecimento(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/abastecimentos/fornecedores/${id}`, { method: "DELETE" }); }
export function buscarAbastecimentos(params: Record<string, string> = {}) { const query = new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as Array<[string, string]>).toString(); return colaboradorRequest<{ abastecimentos: Abastecimento[]; resumo_mensal?: Array<{ mes: string; cotista_id: string | null; cotista_nome: string; quantidade: number }> }>(`/api/interno/abastecimentos${query ? `?${query}` : ""}`); }
export function criarAbastecimento(payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>("/api/interno/abastecimentos", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarAbastecimento(id: string, payload: Record<string, any>) { return colaboradorRequest<{ id: string; success: boolean }>(`/api/interno/abastecimentos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirAbastecimento(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/abastecimentos/${id}`, { method: "DELETE" }); }
export function anexarArquivoAbastecimento(id: string, tipo: "comanda" | "nota" | "boleto" | "comprovante", arquivo: File) { const body = new FormData(); body.append("tipo", tipo); body.append("arquivo", arquivo); return colaboradorRequest<{ success: boolean; caminho_arquivo: string }>(`/api/interno/abastecimentos/${id}/arquivo`, { method: "POST", body }); }
export async function baixarArquivoAbastecimento(id: string, tipo: "comanda" | "nota" | "boleto" | "comprovante") {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new Error("sessao_expirada");
  }
  if (!session?.access_token) throw new Error("sessao_nao_encontrada");

  const response = await fetch(`${API_BASE}/api/interno/abastecimentos/${encodeURIComponent(id)}/arquivo/${tipo}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    credentials: "omit",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error([data?.error || `api_${response.status}`, data?.detail].filter(Boolean).join(" — "));
  }
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

export type PernaPlanejada = {
  id: string; solicitacao_id: string; data_prevista: string; origem: string; destino: string;
  horario_previsto: string | null; numero_passageiros: number;
  status: "PLANEJADA" | "INICIADA" | "CANCELADA";
  criado_em: string; atualizado_em: string;
};
export function planejarPernaVoo(solicitacaoId: string, dados: { data_prevista: string; origem: string; destino: string; numero_passageiros: number; horario_previsto?: string; chave_reenvio: string }) {
  return colaboradorRequest<PernaPlanejada>(`/api/interno/agendamento/${encodeURIComponent(solicitacaoId)}/pernas-planejadas`, { method: "POST", body: JSON.stringify(dados) });
}
export function cancelarPernaPlanejada(solicitacaoId: string, planejadaId: string) {
  return colaboradorRequest<{ success: boolean }>(`/api/interno/agendamento/${encodeURIComponent(solicitacaoId)}/pernas-planejadas/${encodeURIComponent(planejadaId)}`, { method: "DELETE" });
}

export type SolicitacaoVooInterna = {
  solicitacao_origem_id?: string | null;
  pernas_planejadas?: PernaPlanejada[];
  preparacao_pendencias?: number | null;
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
  passageiros?: string[];
  voo_emprestado: string;
  status: "pendente" | "aprovada" | "reprovada" | "cancelada" | string;
  checklist_status?: string | null;
  checklist_itens_respondidos?: number | string | null;
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
  piloto_nome?: string | null;
  copiloto_id?: string | null;
  copiloto_nome?: string | null;
  jornada_id?: string | null;
  jornada_status?: string | null;
  perna_atual_id?: string | null;
  perna_atual_numero?: number | null;
  perna_atual_origem?: string | null;
  perna_atual_destino?: string | null;
  perna_atual_horario_ac?: string | null;
  perna_atual_horario_dep?: string | null;
  perna_atual_horario_pouso?: string | null;
  perna_atual_horario_corte?: string | null;
  horario_corte?: string | null;
  perna_atual_status?: string | null;
  jornadas_encerradas?: number | string;
  jornadas_abertas?: number | string;
}

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
  foto_url?: string | null;
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
  horario_previsto_agendamento?: string | null;
  horario_pouso_previsto?: string | null;
  horario_corte?: string | null;
};

export type DisponibilidadeTripulacao = {
  id: string;
  tripulante_id: string;
  tripulante_origem: "tripulacao" | "freelancer";
  data_inicio: string;
  data_fim: string;
  status: "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel" | string;
  observacoes: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
};

export type OpcaoClienteAgendamento = { id: string; nome: string; codigo_cliente: string | null };
export type OpcaoSocioAgendamento = { id: string; nome: string; cliente_id: string | null };
export type VinculoCotistaAgendamento = { id: string; cliente_id: string | null; socio_id: string | null; cotista_ids?: string[]; fornecedor_id?: string | null; categoria_id?: string | null; categoria_nome?: string | null; email_solicitado?: boolean; email_enviado?: boolean; aeronave_id: string; codigo_cliente: string | null; matricula_registro: string | null; modelo: string | null };
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
  origem_tipo: "lancamentos" | "abastecimentos" | "movimentos_holding" | "rateio_hold";
  origem_id: string;
  referencias: string[];
  tipo_caixa: "CLIENTE" | "SHARE" | "HOLD" | "HOLDING" | string | null;
  fluxo?: string | null;
  descricao: string;
  fornecedor: string | null;
  codigo_cliente?: string | null;
  status: string | null;
  pendencia?: boolean;
  data_pagamento: string | null;
  valor: number;
  numero_doc: string | null;
  observacoes: string | null;
  email_enviado?: boolean | null;
  email_enviado_em?: string | null;
  email_enviado_id?: string | null;
  email_status?: string | null;
  status_email?: string | null;
  justificativa_reativacao?: string | null;
  reativado_em?: string | null;
  criado_em: string;
  anexos?: Array<{ id: string; nome?: string | null; filename?: string | null }>;
  destinatario_email?: string | null;
  reembolsavel?: boolean | null;
  grupo_categoria?: string | null;
  categoria_nome?: string | null;
};

export type OpcoesRateioMovimentacao = { origem_tipo: "lancamentos" | "abastecimentos" | "movimentos_holding" | "rateio_hold"; origem_id: string; valor_centavos: number; data_vencimento?: string | null; periodicidade?: Periodicidade | null; cotistas: Array<{ id: string; nome: string; percentual_sugerido: number }> };

export type PainelFinanceiroResponse = {
  resumo: { total_a_receber: number; total_pago: number; pendencias: number; pagamentos_confirmados: number };
  movimentacoes: MovimentacaoFinanceira[];
  emails_enviados?: RegistroFinanceiro[];
};

export type PastaMovimentacoesFinanceiras = {
  id: string;
  nome: string;
  quantidade: number;
  voos: Array<{
    id: string;
    numero_voo: string;
    periodo: string | null;
    quantidade: number;
    despesas: Array<Record<string, unknown> & { id: string; data: string | null; descricao: string | null; numero_doc: string | null; tipo_caixa: string | null; valor: number; status: string | null; email: string }>;
  }>;
};

export type AbastecimentoPendenteFinanceiro = {
  id: string;
  numero_voo: string | null;
  data: string | null;
  numero_nf: string | null;
  nota_url: string | null;
  numero_comanda: string | null;
  local: string | null;
  trecho: string | null;
  litros: number | null;
  valor_total: number | null;
  status: string | null;
  matricula_registro: string | null;
  fornecedor_nome: string | null;
  cotista_nome: string | null;
};

export function buscarMovimentacoesFinanceiras() {
  return colaboradorRequest<{ pastas: PastaMovimentacoesFinanceiras[]; abastecimentos_pendentes: AbastecimentoPendenteFinanceiro[] }>('/api/financeiro/dashboard/financeiro/movimentacoes');
}

export function buscarAbastecimentosPendentesFinanceiro() {
  return colaboradorRequest<{ abastecimentos_pendentes: AbastecimentoPendenteFinanceiro[] }>('/api/financeiro/dashboard/financeiro/movimentacoes?somente=abastecimentos_pendentes');
}

export function buscarOpcoesAgendamento() {
  return colaboradorRequest<OpcoesAgendamentoResponse>("/api/interno/agendamento/opcoes");
}

/** Horas reais do diário de bordo, sem estimativas e apenas para aeronaves ativas. */
export type HorasVoadasOperacionaisResponse = {
  ano: number;
  aeronaves: Array<{ id: string; matricula_registro: string; fabricante: string | null; modelo: string | null }>;
  dias: Array<{ aeronave_id: string; data: string; minutos: number; trechos: number }>;
};

export function buscarHorasVoadasOperacionais(ano: number) {
  return colaboradorRequest<HorasVoadasOperacionaisResponse>(
    `/api/interno/diario-bordo/horas-voadas?ano=${encodeURIComponent(String(ano))}`
  );
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
  passageiros: string[];
  cliente_emprestimo_id?: string;
  socio_emprestimo_id?: string;
  voo_emprestimo_confirmado?: boolean;
  piloto_id?: string;
  copiloto_id?: string;
  observacoes?: string;
};

export function criarAgendamento(dados: NovoAgendamento) {
  return colaboradorRequest<{ id: string; solicitacao_id?: string; status: string; numero_voo: string | null }>("/api/interno/agendamento", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export type AtualizacaoAgendamento = Partial<Pick<NovoAgendamento, 'aeronave_id' | 'origem' | 'destino' | 'data_agendada' | 'data_fim' | 'horario_previsto_agendamento' | 'numero_passageiros' | 'piloto_id' | 'copiloto_id' | 'observacoes'>>;
export function atualizarAgendamento(id: string, dados: AtualizacaoAgendamento) {
  return colaboradorRequest<{ success: boolean; id: string }>(`/api/interno/agendamento/${encodeURIComponent(id)}`, {
    method: 'PATCH',
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

export type StatusRastreio = "ao_vivo" | "atrasado" | "sem_sinal" | "sem_identificador" | "indisponivel";
export type RastreioAeronave = { hex: string; matricula: string | null; callsign: string | null; lat: number; lon: number; alt_ft: number | null; no_solo: boolean; gs_kt: number | null; rumo_graus: number | null; vs_fpm: number | null; visto_ha_s: number | null; squawk: string | null; fonte: string };
export type StatusVooOperacao = "aguardando" | "encerrada" | "acionado" | "decolado" | "em_voo" | "em_solo";
export type PontoRastreio = { lat: number; lon: number; alt_ft?: number | null; registrado_em?: string; trilha_id?: string };
export type EventoRastreio = { id: number; tipo: "SINAL_RECEBIDO" | "SINAL_PERDIDO" | "EM_SOLO_ADSB"; ocorrido_em: string; detectado_em: string; lat: number; lon: number };
export type VooEmOperacao = { id: string; numero_voo: string | null; status: StatusVooOperacao; aeronave_id: string | null; matricula_registro: string | null; modelo: string | null; icao_hex: string | null; origem: string | null; destino: string | null; origem_coord: { lat: number; lon: number } | null; destino_coord: { lat: number; lon: number } | null; horario_previsto_agendamento: string | null; cotista_nome: string | null; piloto_nome: string | null; copiloto_nome: string | null; rastreio: RastreioAeronave | null; rastreio_status: StatusRastreio; fonte_rastreio?: string | null; perna_atual: PernaOperacao | null; pernas: PernaOperacao[]; trilha?: PontoRastreio[]; eventos_rastreio?: EventoRastreio[]; historico_disponivel?: boolean };
export function buscarVoosEmOperacao() { return colaboradorRequest<{ atualizado_em: string; voos: VooEmOperacao[] }>("/api/interno/voos-em-operacao"); }
export function buscarHistoricoRastreio(solicitacaoId: string) { return colaboradorRequest<VooEmOperacao>(`/api/interno/solicitacoes/${encodeURIComponent(solicitacaoId)}/rastreio`); }
export function buscarRotaerOperacao(icao: string) { return colaboradorRequest<{ airport?: { coordinates?: { lat?: number; lng?: number } } }>(`/api/rotaer/${encodeURIComponent(icao)}`); }

export function buscarSolicitacoesInternas(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return colaboradorRequest<SolicitacaoVooInterna[]>(`/api/interno/solicitacoes${query}`);
}

export type AlteracoesAgendamentoConfirmacao = {
  aeronave_id: string;
  data_agendada: string;
  data_fim: string;
  horario_previsto_agendamento: string | null;
  numero_passageiros: number;
  cliente_emprestimo_id: string | null;
  socio_emprestimo_id: string | null;
};

export function aprovarSolicitacaoVoo(id: string, pilotoId: string, copilotoId?: string, alteracoes?: AlteracoesAgendamentoConfirmacao) {
  return colaboradorRequest<{ success: boolean; status: string; solicitacao_id: string; numero_voo: string }>(`/api/interno/solicitacoes/${id}/aprovar`, {
    method: "POST",
    body: JSON.stringify({ piloto_id: pilotoId, copiloto_id: copilotoId || undefined, ...alteracoes }),
  });
}

export function reprovarSolicitacaoVoo(id: string, motivoRejeicao: string) {
  return colaboradorRequest<{ success: boolean; status: string; solicitacao_id: string }>(`/api/interno/solicitacoes/${id}/reprovar`, {
    method: "POST",
    body: JSON.stringify({ motivo_rejeicao: motivoRejeicao }),
  });
}

export type ChecklistPreVoo = {
  id: string;
  solicitacao_id: string;
  itens: Record<string, unknown>;
  observacoes: string | null;
  abastecimento_id: string | null;
  precisa_abastecer?: number | boolean | null;
  status: string;
  executado_por_nome?: string | null;
  usuario_id?: string | null;
  nivel_oleo?: string | null;
  alerta_id?: string | null;
  alertas?: Record<string, string>;
};
export function buscarChecklistPreVoo(id: string) { return colaboradorRequest<ChecklistPreVoo | null>(`/api/interno/agendamento/${id}/checklist`); }
export function salvarChecklistPreVoo(id: string, payload: { itens: Record<string, unknown>; observacoes?: string; abastecimento?: Record<string, unknown>; status?: string; alertas?: Record<string, string>; nivel_oleo?: string | null }) { return colaboradorRequest<{ id: string; abastecimento_id: string | null }>(`/api/interno/agendamento/${id}/checklist`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarComandaAbastecimento(id: string, arquivo: File) { const form = new FormData(); form.append("arquivo", arquivo); form.append("tipo", "comanda"); return colaboradorRequest<{ success: boolean; caminho_arquivo: string }>(`/api/interno/abastecimentos/${id}/arquivo`, { method: "POST", body: form }); }

export type ItemCarregamento = { id: string; descricao: string; categoria?: string; peso: number | null; braco: number | null };
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
export type PontoEnvelopePeso = { peso_kg: number; cg_estacao: number };
export type ConfiguracaoPesoBalanceamento = {
  id: string;
  aeronave_id: string;
  matricula_registro?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  peso_vazio_padrao: number;
  braco_cg_padrao: number;
  momento_padrao?: number | null;
  peso_maximo_decolagem: number;
  peso_maximo_pouso: number;
  peso_maximo_sem_combustivel?: number | null;
  cg_limite_dianteiro: number;
  cg_limite_traseiro: number;
  mac_comprimento: number;
  lemac_distancia: number;
  capacidade_combustivel_total?: number | null;
  capacidade_combustivel_util?: number | null;
  validado?: number | boolean | null;
  notas?: string | null;
  data_ultima_pesagem?: string | null;
  numero_relatorio_pesagem?: string | null;
  responsavel_tecnico?: string | null;
  limite_bagagem_diant_kg?: number | null;
  limite_bagagem_tras_kg?: number | null;
  envelope_pontos?: PontoEnvelopePeso[] | null;
  envelope_pontos_json?: PontoEnvelopePeso[] | string | null;
  atualizado_em?: string | null;
};
export type PesoBalanceamentoContexto = {
  solicitacao: SolicitacaoVooInterna & { fabricante?: string | null; matricula_registro?: string | null; modelo?: string | null };
  piloto: { id: string; nome: string; canac: string | null } | null;
  copiloto: { id: string; nome: string; canac: string | null } | null;
  configuracao: ConfiguracaoPesoBalanceamento | null;
  ficha: PesoBalanceamentoFicha | null;
};
export function buscarPesoBalanceamentoVoo(id: string) { return colaboradorRequest<PesoBalanceamentoContexto>(`/api/interno/agendamento/${id}/peso-balanceamento`); }
export function salvarPesoBalanceamentoVoo(id: string, payload: Record<string, unknown>) { return colaboradorRequest<{ success: boolean; ficha: PesoBalanceamentoFicha }>(`/api/interno/agendamento/${id}/peso-balanceamento`, { method: "POST", body: JSON.stringify(payload) }); }

export type FichaPesoBalanceamentoLista = PesoBalanceamentoFicha & { matricula_registro?: string | null; modelo?: string | null; origem?: string | null; destino?: string | null; data_agendada?: string | null };
export function buscarConfiguracoesPesoBalanceamento(aeronaveId?: string) { return colaboradorRequest<{ configuracoes: ConfiguracaoPesoBalanceamento[] }>(`/api/ctm/peso-balanceamento${aeronaveId ? `?aeronave_id=${encodeURIComponent(aeronaveId)}` : ""}`); }
export function salvarConfiguracaoPesoBalanceamento(payload: Partial<ConfiguracaoPesoBalanceamento> & { aeronave_id: string }) { return colaboradorRequest<{ configuracao: ConfiguracaoPesoBalanceamento }>("/api/ctm/peso-balanceamento", { method: "POST", body: JSON.stringify(payload) }); }
export function buscarFichasPesoBalanceamento() { return colaboradorRequest<{ fichas: FichaPesoBalanceamentoLista[] }>("/api/ctm/fichas-peso-balanceamento"); }

export type PlanoVooSalvo = {
  id: string;
  numero_voo: string | null;
  adep: string;
  ades: string;
  data_voo: string | null;
  eobt: string | null;
  created_at: string;
  checklist_status?: "rascunho" | "concluido" | string | null;
  payload: Record<string, any>;
};

export type ChecklistPlanoVoo = {
  id: string;
  plano_voo_id: string;
  itens: Record<string, unknown>;
  observacoes: string | null;
  status: "rascunho" | "concluido" | string;
  executado_por_nome?: string | null;
  atualizado_em?: string | null;
  concluido_em?: string | null;
};

export type PrecoAbastecimento = {
  id?: string;
  fornecedor?: string | null;
  codigo_icao?: string | null;
  valor_unitario: number;
  litros?: number | null;
  data?: string | null;
  tipo_combustivel?: string | null;
  local?: string | null;
  origem: "fornecedor_cadastrado" | "abastecimento_historico" | string;
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

export function buscarChecklistPlanoVoo(id: string) {
  return colaboradorRequest<ChecklistPlanoVoo | null>(`/api/interno/planos-voo/${encodeURIComponent(id)}/checklist`);
}

export function salvarChecklistPlanoVoo(id: string, payload: { itens: Record<string, unknown>; observacoes?: string; status?: "rascunho" | "concluido" }) {
  return colaboradorRequest<{ id: string; plano_voo_id: string; status: string; atualizado_em: string }>(`/api/interno/planos-voo/${encodeURIComponent(id)}/checklist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function enviarPdfPlanoVoo(id: string, arquivo: File) {
  const body = new FormData();
  body.append("arquivo", arquivo, arquivo.name);
  return colaboradorRequest<{ success: boolean; nome_arquivo: string }>(`/api/interno/planos-voo/${encodeURIComponent(id)}/pdf`, { method: "POST", body });
}

export function buscarPrecosAbastecimento(icao: string, tipoCombustivel?: string) {
  const query = new URLSearchParams({ icao });
  if (tipoCombustivel) query.set("tipo_combustivel", tipoCombustivel);
  return colaboradorRequest<{ icao: string; tipo_combustivel: string | null; fornecedores: PrecoAbastecimento[]; historico: PrecoAbastecimento[]; source: string }>(`/api/interno/abastecimentos/precos?${query.toString()}`);
}

type RegistroFinanceiro = Record<string, unknown>;

type PainelFinanceiroPayload = {
  resumo?: Partial<PainelFinanceiroResponse["resumo"]> | null;
  lancamentos?: RegistroFinanceiro[] | null;
  rateio_hold?: RegistroFinanceiro[] | null;
  movimentacoes?: RegistroFinanceiro[] | null;
  movimentos_holding?: RegistroFinanceiro[] | null;
  emails_enviados?: RegistroFinanceiro[] | null;
};

function registrosFinanceiros(valor: unknown): RegistroFinanceiro[] {
  return Array.isArray(valor)
    ? valor.filter(
        (item): item is RegistroFinanceiro =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function primeiraFonteFinanceira(...fontes: unknown[]) {
  for (const fonte of fontes) {
    const registros = registrosFinanceiros(fonte);
    if (registros.length > 0) return registros;
  }
  return [];
}

function textoFinanceiro(valor: unknown): string | null {
  return valor === null || valor === undefined || String(valor).trim() === ""
    ? null
    : String(valor);
}

function numeroFinanceiro(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function booleanoFinanceiro(valor: unknown): boolean | null {
  if (valor === true || valor === 1 || valor === "1" || valor === "true") return true;
  if (valor === false || valor === 0 || valor === "0" || valor === "false") return false;
  return null;
}

function primeiroTexto(...valores: unknown[]) {
  return valores.map(textoFinanceiro).find(Boolean) || null;
}

function referenciasFinanceiras(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
  if (typeof valor !== "string" || !valor.trim()) return [];
  try {
    const convertido: unknown = JSON.parse(valor);
    return Array.isArray(convertido) ? convertido.map(String).filter(Boolean) : [valor];
  } catch {
    return [valor];
  }
}

function numeroDocumento(registro: RegistroFinanceiro) {
  return primeiroTexto(
    registro.numero_nf,
    registro.numero_recibo,
    registro.numero_doc,
    registro.numero_demonstrativo,
  );
}

function normalizarMovimentacao(
  registro: RegistroFinanceiro,
  origemTipo: "lancamentos" | "abastecimentos" | "movimentos_holding" | "rateio_hold",
): MovimentacaoFinanceira | null {
  const origemId = textoFinanceiro(registro.origem_id) || textoFinanceiro(registro.id) || textoFinanceiro(registro.movimento_holding_id);
  if (!origemId) return null;
  const registroId = textoFinanceiro(registro.id) || origemId;
  const valor = registro.valor !== undefined
    ? numeroFinanceiro(registro.valor)
    : numeroFinanceiro(
        registro.valor_reais ?? registro.valor_centavos ?? registro.valor_rateado_centavos,
      ) / (registro.valor_reais !== undefined ? 1 : 100);
  const emailEnviado = booleanoFinanceiro(registro.email_enviado);

  return {
    id: `${origemTipo}:${registroId}`,
    origem_tipo: origemTipo,
    origem_id: origemId,
    referencias: [
      ...referenciasFinanceiras(registro.referencias),
      ...referenciasFinanceiras(registro.referencias_json),
      textoFinanceiro(registro.id),
      textoFinanceiro(registro.origem_id),
      textoFinanceiro(registro.origem_tipo) && textoFinanceiro(registro.origem_id)
        ? `${textoFinanceiro(registro.origem_tipo)}:${textoFinanceiro(registro.origem_id)}`
        : null,
    ].filter((valor): valor is string => Boolean(valor)),
    tipo_caixa: textoFinanceiro(registro.tipo_caixa),
    fluxo: textoFinanceiro(registro.fluxo),
    descricao:
      primeiroTexto(registro.descricao, registro.descricao_despesa) ||
      "Movimentação sem descrição",
    fornecedor: primeiroTexto(registro.fornecedor, registro.fornecedor_nome),
    codigo_cliente: primeiroTexto(registro.codigo_cliente, registro.cliente_codigo, registro.cotista_codigo),
    status: textoFinanceiro(registro.status),
    reembolsavel: booleanoFinanceiro(registro.reembolsavel),
    grupo_categoria: textoFinanceiro(registro.grupo_categoria),
    categoria_nome: textoFinanceiro(registro.categoria_nome),
    anexos: Array.isArray(registro.anexos) ? registro.anexos.filter((item): item is { id: string; nome?: string | null; filename?: string | null } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string")) : [],
    destinatario_email: textoFinanceiro(registro.destinatario_email ?? registro.socio_email),
    data_pagamento: primeiroTexto(
      registro.data_pagamento,
      registro.data_emissao,
      registro.criado_em,
    ),
    valor,
    numero_doc: numeroDocumento(registro),
    observacoes: textoFinanceiro(registro.observacoes),
    email_enviado: emailEnviado,
    email_enviado_em: textoFinanceiro(registro.email_enviado_em),
    email_enviado_id: textoFinanceiro(registro.email_enviado_id),
    email_status: textoFinanceiro(registro.email_status),
    status_email: textoFinanceiro(registro.status_email),
    pendencia: booleanoFinanceiro(registro.pendencia) ?? false,
    justificativa_reativacao: textoFinanceiro(registro.justificativa_reativacao),
    reativado_em: textoFinanceiro(registro.reativado_em),
    criado_em: textoFinanceiro(registro.criado_em) || "",
  };
}

function consolidarRateioHold(registros: RegistroFinanceiro[]) {
  const grupos = new Map<string, RegistroFinanceiro>();
  for (const registro of registros) {
    const chave =
      textoFinanceiro(registro.movimento_holding_id) ||
      textoFinanceiro(registro.id);
    if (!chave) continue;
    const existente = grupos.get(chave);
    if (!existente) {
      grupos.set(chave, { ...registro, id: chave });
      continue;
    }
    existente.valor_rateado_centavos =
      numeroFinanceiro(existente.valor_rateado_centavos) +
      numeroFinanceiro(registro.valor_rateado_centavos);
  }
  return [...grupos.values()];
}

function valoresEmail(registro: RegistroFinanceiro, campo: string) {
  const valor = registro[campo];
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor !== "string") return valor ? [String(valor)] : [];
  try {
    const convertido: unknown = JSON.parse(valor);
    return Array.isArray(convertido) ? convertido.map(String) : [valor];
  } catch {
    return [valor];
  }
}

function emailRelacionaMovimentacao(
  email: RegistroFinanceiro,
  movimentacao: MovimentacaoFinanceira,
) {
  const referencias = [
    ...valoresEmail(email, "referencias"),
    ...valoresEmail(email, "referencias_json"),
    ...valoresEmail(email, "referencia"),
    ...valoresEmail(email, "anexos"),
  ];
  const identificadores = [
    ...movimentacao.referencias,
    movimentacao.origem_id,
    movimentacao.id,
    movimentacao.numero_doc,
    `${movimentacao.origem_tipo}:${movimentacao.origem_id}`,
  ].filter(Boolean);
  const idRelatorio = movimentacao.referencias
    .find((referencia) => referencia.toUpperCase().startsWith("RELATORIO_DESPESA_VIAGEM:"))
    ?.split(":", 2)[1];
  return referencias.some((referencia) =>
    identificadores.includes(referencia) ||
    Boolean(idRelatorio && referencia === `relatorio_pdf:${idRelatorio}`),
  );
}

export function buscarOpcoesRateioMovimentacao(origemTipo: MovimentacaoFinanceira["origem_tipo"], origemId: string) { return colaboradorRequest<OpcoesRateioMovimentacao>(`/api/financeiro/dashboard/financeiro/movimentacoes/${encodeURIComponent(origemTipo)}/${encodeURIComponent(origemId)}/rateio-opcoes`); }
export function criarRateioMovimentacao(origemTipo: MovimentacaoFinanceira["origem_tipo"], origemId: string, payload: { data_vencimento: string; periodicidade: Periodicidade; tipo_rateio: string; linhas: Array<{ cotista_id: string; percentual: number }> }) { return colaboradorRequest<{ ok: boolean; rateio_ids: string[] }>(`/api/financeiro/dashboard/financeiro/movimentacoes/${encodeURIComponent(origemTipo)}/${encodeURIComponent(origemId)}/rateio`, { method: "POST", body: JSON.stringify(payload) }); }

export async function buscarPainelFinanceiro(): Promise<PainelFinanceiroResponse> {
  const payload = await colaboradorRequest<PainelFinanceiroPayload>("/api/financeiro/dashboard/financeiro");
  const lancamentos = primeiraFonteFinanceira(
    payload?.lancamentos,
    payload?.movimentacoes,
  )
    .map((registro) => normalizarMovimentacao(registro, registro.origem_tipo === "abastecimentos" ? "abastecimentos" : "lancamentos"))
    .filter((item): item is MovimentacaoFinanceira => Boolean(item));
  const movimentosHoldingDiretos = primeiraFonteFinanceira(payload?.movimentos_holding);
  const rateiosHold = movimentosHoldingDiretos.length
    ? movimentosHoldingDiretos
        .map((registro) => normalizarMovimentacao(registro, "movimentos_holding"))
        .filter((item): item is MovimentacaoFinanceira => Boolean(item))
    : consolidarRateioHold(registrosFinanceiros(payload?.rateio_hold))
        .map((registro) => normalizarMovimentacao(registro, "rateio_hold"))
        .filter((item): item is MovimentacaoFinanceira => Boolean(item));
  const emails = registrosFinanceiros(payload?.emails_enviados);
  const movimentacoes = [...lancamentos, ...rateiosHold].map((movimentacao) => {
    const email = emails.find((registro) =>
      emailRelacionaMovimentacao(registro, movimentacao),
    );
    if (!email) return movimentacao;
    const status = textoFinanceiro(email.status);
    return {
      ...movimentacao,
      email_enviado: booleanoFinanceiro(email.enviado ?? email.email_enviado) ?? status?.toLowerCase() === "enviado",
      email_status: status,
    };
  });

  return {
    resumo: {
      total_a_receber: Number(payload?.resumo?.total_a_receber ?? 0),
      total_pago: Number(payload?.resumo?.total_pago ?? 0),
      pendencias: Number(payload?.resumo?.pendencias ?? 0),
      pagamentos_confirmados: Number(payload?.resumo?.pagamentos_confirmados ?? 0),
    },
    movimentacoes,
  };
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
  celula_disponivel_ttotal?: number | null;
  celula_atual_tvoo?: number | null;
  celula_prox_revisao_tvoo?: number | null;
  celula_disponivel_tvoo?: number | null;
  mes_referencia: number;
  fechado: number;
};

export type DiarioTripulante = { id: string; canac: string; nome_completo: string; status: string | null; origem: string };
export type DiarioOpcaoCliente = { id: string; nome: string | null; codigo_cliente: string | null; proprietario?: string | null };
export type DiarioOpcaoHolding = { id: string; nome: string; proprietario?: string | null };
export type DiarioOpcaoSocio = { id: string; nome: string; cliente_id: string | null; holding_id?: string | null };
export type DiarioOpcaoAerodromo = { id: string; designativo: string; nome: string };
export type DiarioOpcoesResponse = { clientes: DiarioOpcaoCliente[]; holdings: DiarioOpcaoHolding[]; socios: DiarioOpcaoSocio[]; tripulantes: DiarioTripulante[]; aerodromos: DiarioOpcaoAerodromo[]; fornecedores_combustivel?: Array<{ id: string; nome_fornecedor: string }> };
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
  modo_celula?: "tvoo" | "tempo_total" | null;
};
export type DiarioLancamento = {
  id: string;
  acionamento_utc?: string | null;
  decolagem_utc?: string | null;
  pouso_utc?: string | null;
  corte_utc?: string | null;
  numero_sequencial: number;
  diario_mes_id: string;
  aeronave_id: string;
  matricula_registro?: string | null;
  numero_voo: string | null;
  jornada_id?: string | null;
  perna_jornada_id?: string | null;
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
  holding_id: string | null;
  socio_id: string | null;
  cliente_tomador_emprestimo_id?: string | null;
  socio_tomador_emprestimo_id?: string | null;
  cliente_nome?: string | null;
  holding_nome?: string | null;
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
  diarias?: string | null;
  litros_combustivel_inicio_voo: number;
  litros_combustivel_abastecido: number;
  local_combustivel: string | null;
  celula: number;
  celula_tvoo: number | null;
  passageiros: number;
  carga_kg: string | null;
  natureza_voo: string;
  ocorrencias: string | null;
  discrepancias: string | null;
  acoes_corretivas: string | null;
  confirmado: number;
  consumo_combustivel_voo?: number | null;
  consumo_combustivel_total?: number | null;
  abastecimento_valor_total?: number | null;
  abastecimento_litros_precificados?: number | null;
  abastecimento_valor_precificado?: number | null;
  abastecimento_id?: string | null;
  abastecimento_litros?: number | null;
  abastecimento_data?: string | null;
  abastecimento_pagador_nome?: string | null;
  abastecimento_comanda?: string | null;
  abastecimento_nota?: string | null;
  abastecimento_tipo_combustivel?: string | null;
  abastecimento_valor_unitario?: number | null;
  abastecimento_fornecedor_id?: string | null;
};
export type DiarioDetalhesResponse = { aeronave: DiarioAeronaveResumo; diario_mes: DiarioMes | null; lancamentos: DiarioLancamento[]; meses_disponiveis: Array<Pick<DiarioMes, "id" | "ano" | "mes" | "fechado" | "celula_atual_ttotal" | "celula_prox_revisao_ttotal" | "celula_disponivel_ttotal" | "celula_atual_tvoo" | "celula_prox_revisao_tvoo" | "celula_disponivel_tvoo">>; horas_cotistas?: Array<{ cotista_id: string | null; cotista_nome: string; horas_voo: number }>; horas_emprestadas?: { horas_total: number; quantidade: number } };

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
export function atualizarHorimetroDiario(id: string, payload: Pick<DiarioMes, "horimetro_inicio" | "horimetro_final" | "horimetro_ativo">) {
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

export type JornadaResumo = {
  id: string;
  tripulante_id: string;
  numero_jornada: number;
  funcao: string;
  status: string;
  apresentacao: string | null;
  corte: string | null;
  encerramento: string | null;
  minutos_pos_corte: number | null;
  minutos_reais: number | null;
  minutos_registrados: number | null;
  quantidade_pernas: number;
  limite_sistema_minutos: number;
  diferenca_sistema_minutos: number | null;
  avisos: string[];
};
export type PeriodoResumo = {
  id: string;
  tipo: 'semana' | 'mes';
  inicio: string;
  fim: string;
  fuso_apuracao: 'UTC';
  criterio: string;
  operacao_minutos: number | null;
  total_minutos: number;
  referencia_minutos: number;
  diferenca_minutos: number | null;
  registros_incompletos: number;
  nivel: 'abaixo_referencia' | 'referencia_atingida' | 'acima_referencia' | 'incompleto';
};
export type TripulanteResumo = {
  id: string;
  nome: string;
  funcoes: string[];
  jornadas: JornadaResumo[];
  minutos_reais_operacao: number | null;
  minutos_registrados_operacao: number | null;
  referencia_em: string | null;
  periodos: PeriodoResumo[];
};
export type ResumoJornadaOperacao = {
  solicitacao_id: string;
  numero_voo: string | null;
  gerado_em: string;
  tripulantes: TripulanteResumo[];
  validacao_legal_completa: false;
  fuso_base: null;
  fora_base: { dias_operacao: null; referencia_dias: 21; local_operacao_referencia_dias: 17; motivo: string };
  avisos: string[];
};

export function buscarResumoJornadaOperacao(id: string) {
  return colaboradorRequest<ResumoJornadaOperacao>(`/api/interno/agendamento/${encodeURIComponent(id)}/resumo-jornada`);
}

export type NivelAlertaJornada = "normal" | "atencao" | "critico" | "excedido";
export type FaixaLimiteJornada = { minutos: number; limite: number; restante: number; nivel: NivelAlertaJornada };
export type LimitesJornada = { jornada_id: string; tripulante_id: string | null; data: string; minutos_jornada: number; limite_jornada_minutos: number; restante_minutos: number; nivel_alerta: NivelAlertaJornada; semana: FaixaLimiteJornada; mes: FaixaLimiteJornada; pernas_abertas: number; referencia_em?: string; criterio_semanal?: string; dados_incompletos?: boolean; validacao_legal_completa?: boolean };
export type JornadaVoo = { id: string; solicitacao_id: string; aeronave_id: string; tripulante_id: string | null; tripulante_nome?: string | null; numero_voo?: string | null; origem?: string | null; destino?: string | null; matricula_registro?: string | null; modelo?: string | null; funcao_tripulante: "PIC" | "SIC"; jornada_principal_id: string | null; numero_jornada: number; data: string; horario_acionamento: string | null; horario_apresentacao: string | null; horario_pouso: string | null; horario_corte: string | null; horario_encerramento?: string | null; minutos_reais?: number | null; minutos_pos_corte: number; minutos_jornada: number | null; nivel_alerta: NivelAlertaJornada; status: string; status_agendamento?: string; observacoes: string | null; pernas: Array<{ id: string; jornada_id?: string; numero: number; origem: string; destino: string; numero_passageiros: number; horario_ac: string | null; horario_dep: string | null; horario_pouso: string | null; horario_corte: string | null; horario_ac_user_id?: string | null; horario_dep_user_id?: string | null; horario_pouso_user_id?: string | null; horario_corte_user_id?: string | null; status: string; lancamento_diario_id?: string | null }>; tripulantes?: JornadaTripulante[]; historico?: JornadaVoo[] };
export type JornadaTripulante = JornadaVoo & { funcao_tripulante: "PIC" | "SIC"; limites: LimitesJornada };
export function buscarJornadaVoo(id: string) { return colaboradorRequest<JornadaVoo | null>(`/api/interno/agendamento/${id}/jornada`); }
export function buscarPernasPlanoVoo(id: string) {
  return colaboradorRequest<{ pernas: import("./tipos").PernaPlanoVoo[] }>(`/api/interno/agendamento/${encodeURIComponent(id)}/pernas-plano`);
}
export function buscarExtratoJornadaTripulante(id: string, inicio?: string, fim?: string) {
  const params = new URLSearchParams();
  if (inicio) params.set("inicio", inicio);
  if (fim) params.set("fim", fim);
  const query = params.toString() ? `?${params.toString()}` : "";
  return colaboradorRequest<{ tripulante_id: string; tripulante_nome: string; canac: string | null; inicio: string; fim: string; jornadas: JornadaVoo[] }>(`/api/interno/tripulacao/${encodeURIComponent(id)}/jornadas${query}`);
}
export type PreenchimentoJornadaDiario = { jornada_id: string; solicitacao_id: string; aeronave_id: string; pernas: Array<Partial<DiarioLancamento> & { jornada_id: string; aeronave_id: string; perna_id: string; ja_lancado: boolean }> };
export function buscarPreenchimentoJornadaDiario(id: string) { return colaboradorRequest<PreenchimentoJornadaDiario>(`/api/interno/diario-bordo/preenchimento-jornada/${encodeURIComponent(id)}`); }

export type NumeroVooOpcao = { solicitacao_id: string; numero_voo: string; origem: string | null; destino: string | null; data_agendada: string | null; cliente_id: string | null; socio_id: string | null; voo_emprestado: string | null; cliente_emprestimo_id: string | null; socio_emprestimo_id: string | null; piloto_id: string | null; copiloto_id: string | null; pic_canac: string | null; pic_nome: string | null; sic_canac: string | null; sic_nome: string | null };
export type NumeroVooPerna = { perna_id: string; numero: number; origem: string; destino: string; numero_passageiros: number; horario_ac: string | null; horario_dep: string | null; horario_pouso: string | null; horario_corte: string | null; status: string; lancamento_diario_id: string | null; distancia_nm: number; tempo_voo: number; tempo_total: number; horas_diurnas: number; horas_noturnas: number; consumo_combustivel_voo: number; consumo_combustivel_total: number; solar_status: string };
export type NumeroVooJornada = { jornada_id: string; numero_jornada: number; data: string; status: string; horario_apresentacao: string | null; horario_acionamento: string | null; horario_pouso: string | null; horario_corte: string | null; pernas: NumeroVooPerna[] };
export function buscarNumerosVooAeronave(aeronaveId: string) {
  return colaboradorRequest<{ voos: Array<NumeroVooOpcao & { jornadas: NumeroVooJornada[] }> }>(`/api/interno/diario-bordo/numeros-voo/${encodeURIComponent(aeronaveId)}`);
}

export function iniciarJornadaVoo(id: string, payload: Record<string, unknown> & { tripulantes?: Array<{ tripulante_id: string; funcao: "PIC" | "SIC" }> }) { return colaboradorRequest<JornadaVoo>(`/api/interno/agendamento/${id}/jornada`, { method: "POST", body: JSON.stringify(payload) }); }
export function finalizarAgendamento(id: string) { return colaboradorRequest<{ success: boolean; status: string; id: string; numero_voo: string | null }>(`/api/interno/agendamento/${encodeURIComponent(id)}/finalizar`, { method: "POST" }); }
export function atualizarJornadaVoo(id: string, payload: Record<string, unknown>) { return colaboradorRequest<JornadaVoo>(`/api/interno/jornadas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirJornadaVoo(id: string) { return colaboradorRequest<{ success: boolean; id: string }>(`/api/interno/jornadas/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function buscarLimitesJornada(id: string, corteFinal?: string) { const query = corteFinal ? `?corte_final=${encodeURIComponent(corteFinal)}` : ""; return colaboradorRequest<LimitesJornada>(`/api/interno/jornadas/${encodeURIComponent(id)}/limites${query}`); }
export function encerrarJornadaVoo(id: string, payload: { horario_pouso?: string; horario_corte: string; observacoes?: string; confirmar_excedente?: boolean }) { return atualizarJornadaVoo(id, { ...payload, status: "encerrada" }); }
export type NovaPernaJornadaPayload = Record<string, unknown> & { confirmar_excedente?: boolean };
export function adicionarPernaJornada(id: string, payload: NovaPernaJornadaPayload) { return colaboradorRequest<{ id: string; status: string; status_agendamento?: string }>(`/api/interno/jornadas/${id}/pernas`, { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarPernaJornada(jornadaId: string, pernaId: string, payload: Record<string, unknown>) { return colaboradorRequest<{ id: string; status: string; status_agendamento?: string }>(`/api/interno/jornadas/${jornadaId}/pernas/${pernaId}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirPernaJornada(jornadaId: string, pernaId: string) { return colaboradorRequest<{ success: boolean; id: string }>(`/api/interno/jornadas/${encodeURIComponent(jornadaId)}/pernas/${encodeURIComponent(pernaId)}`, { method: "DELETE" }); }

export type RelatorioDespesaViagem = Record<string, any> & {
  id: string;
  numero_relatorio: string;
  numero_voo: string | null;
  cliente_id: string | null;
  cliente_nome?: string | null;
  socio_nome?: string | null;
  socio_id: string | null;
  aeronave_id: string | null;
  aeronave_matricula?: string | null;
  rota: string | null;
  data_inicio: string;
  data_fim: string;
  quantidade_dias: number;
  despesas: Array<{ id?: string; data: string; categoria: string; descricao: string; valor: number; observacoes?: string; pago_por?: string; paid_by?: string }>;
  total_valor: number;
  status: string;
  tripulacao_id: string | null;
  nome_tripulante: string | null;
  tripulante_id_2: string | null;
  nome_tripulante_2: string | null;
  anexos?: RelatorioDespesaViagemAnexo[];
  pdf_url?: string | null;
  pdf_path?: string | null;
};
export type RelatorioDespesaViagemAnexo = { id: string; relatorio_despesa_viagem_id: string; indice_despesa: number; nome_arquivo: string; caminho_arquivo: string; url_arquivo: string; tipo_arquivo: string | null; tamanho_arquivo: number | null };
export type OpcoesRelatorioViagem = {
  clientes: Array<{ id: string; razao_social: string | null; codigo_cliente: string | null; holding: number | boolean | null }>;
  aeronaves: Array<{ id: string; matricula_registro: string; fabricante: string; modelo: string; status: string | null }>;
  tripulantes: Array<{ id: string; nome_completo: string; canac: string; status: string | null; origem: string }>;
  voos: Array<{ numero_voo: string; cliente_id: string | null; socio_id: string | null; aeronave_id: string | null; origem: string | null; destino: string | null; rota_nome?: string | null; rota_icao?: string | null; data_agendada: string | null; dias_duracao: number | null; matricula_registro: string | null; piloto_id: string | null; copiloto_id: string | null; cotista_nome: string | null; socio_nome: string | null; tripulante_nome: string | null; tripulante_nome_2: string | null }>;
  socios: Array<{ id: string; nome: string; holding_id: string | null }>;
};
export function buscarOpcoesRelatorioViagem() { return colaboradorRequest<OpcoesRelatorioViagem>("/api/financeiro/relatorios-despesa-viagem/opcoes"); }
export function buscarRelatoriosDespesaViagem() { return colaboradorRequest<{ relatorios: RelatorioDespesaViagem[] }>("/api/financeiro/relatorios-despesa-viagem"); }
export function buscarRelatorioDespesaViagem(id: string) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}`); }
export function criarRelatorioDespesaViagem(payload: Record<string, unknown>) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>("/api/financeiro/relatorios-despesa-viagem", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarRelatorioDespesaViagem(id: string, payload: Record<string, unknown>) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirRelatorioDespesaViagem(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function finalizarRelatorioDespesaViagem(id: string) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/finalizar`, { method: "POST" }); }
export function voltarRelatorioDespesaViagemParaRascunho(id: string) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/voltar-rascunho`, { method: "POST" }); }
export function enviarRelatorioParaAprovacao(id: string, tripulantePos: 1 | 2) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem; token: string; link: string; mensagem: string }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/enviar-aprovacao`, { method: "POST", body: JSON.stringify({ tripulante_pos: tripulantePos }) }); }
export function decidirAprovacaoRelatorio(id: string, tripulantePos: 1 | 2, aprovado: boolean, observacoes: string) { return colaboradorRequest<{ relatorio: RelatorioDespesaViagem }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/aprovacao`, { method: "POST", body: JSON.stringify({ tripulante_pos: tripulantePos, aprovado, observacoes }) }); }
export function enviarAnexoRelatorio(id: string, arquivo: File, indiceDespesa = 0) { const body = new FormData(); body.append("arquivo", arquivo); body.append("indice_despesa", String(indiceDespesa)); return colaboradorRequest<{ anexo: RelatorioDespesaViagemAnexo }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/anexos`, { method: "POST", body }); }
export function excluirAnexoRelatorio(id: string, anexoId: string) { return colaboradorRequest<{ success: boolean }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}`, { method: "DELETE" }); }
export async function baixarAnexoRelatorio(id: string, anexoId: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error(sessionError ? "sessao_expirada" : "sessao_nao_encontrada");
  const response = await fetch(`${API_BASE}/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}/arquivo`, { headers: { Authorization: `Bearer ${session.access_token}` }, credentials: "omit" });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data?.error || `api_${response.status}`); }
  return response.blob();
}
export function enviarPdfRelatorio(id: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); return colaboradorRequest<{ pdf_url: string; pdf_path: string }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/pdf`, { method: "POST", body }); }
export async function baixarPdfRelatorio(id: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error(sessionError ? "sessao_expirada" : "sessao_nao_encontrada");
  const response = await fetch(`${API_BASE}/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/pdf`, { headers: { Authorization: `Bearer ${session.access_token}` }, credentials: "omit" });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data?.error || `api_${response.status}`); }
  return response.blob();
}
export function buscarProgramacaoReembolsoRelatorio(id: string) { return colaboradorRequest<{ descricao: string; valor: number; fornecedor: string; grupo_categoria_id: string; subcategoria: string; aeronave_id: string; aeronave_matricula: string | null; cliente_id: string | null; socio_id: string | null; data_vencimento_reembolso: string | null; periodicidade: Periodicidade; tipo_rateio: string; pdf_url: string | null; pdf_path: string | null }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/programacao-reembolso`); }
export function enviarDespesaAoCliente(id: string, payload: { data_vencimento: string; periodicidade?: Periodicidade; tipo_rateio?: string; email_enviado_id?: string }) { return colaboradorRequest<{ success: boolean; status: string; message: string; relatorio?: Record<string, any> }>(`/api/financeiro/relatorios-despesa-viagem/${encodeURIComponent(id)}/enviar-cliente`, { method: "POST", body: JSON.stringify(payload) }); }

// ─── Emissão de recibos (cliente reembolsável / caixa cliente / colaborador) ────────────────
export type ClienteRecibo = { id: string; razao_social: string; cnpj: string | null; endereco: string | null; cidade: string | null; uf: string | null; holding: number | boolean | null; status: string | null; codigo_cliente?: string | null };
export type ColaboradorRecibo = { id: string; nome_completo: string; nome_exibicao: string | null; cpf: string | null };
export type RecebedorRecibo = { id: string; nome: string; nome_completo?: string | null; cpf: string | null; email: string | null; telefone: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; tipo_user: string | null; origem: "user_profiles" | "tripulacao_freelancer"; canac?: string | null };
export type AeronaveRecibo = { id: string; matricula_registro: string; fabricante: string | null; modelo: string | null };
export type CotistaRecibo = { id: string; aeronave_id: string; cliente_id: string | null; socio_id: string | null; codigo_cliente?: string | null; cnpj?: string | null; cpf?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; cotista_ids?: string[]; fornecedor_id?: string | null; categoria_id?: string | null; categoria_nome?: string | null; email_solicitado?: boolean; email_enviado?: boolean; percentual_sociedade: number; nome: string };
export type AbastecimentoRecibo = { id: string; aeronave_id: string; data: string; tipo_combustivel: string | null; trecho: string | null; local: string | null; numero_comanda: string | null; numero_nf: string | null; litros: number | null; valor_total: number; matricula_registro: string | null; cotista_nome: string };
export type CategoriaRecibo = { id: string; nome: string; grupo_categoria: string; tipo_despesa?: "fixo" | "variável" | null };
export type FornecedorRecibo = { id: string; nome: string; nome_completo?: string | null; documento?: string | null; cnpj?: string | null; origem: "favorito" | "combustivel" | "agenda" | string };
export type CategoriaClienteRecibo = { id: string; nome: string; subcategoria_1: string | null; subcategoria_2: string | null; subcategoria_3: string | null; subcategoria_4: string | null };
export type OpcoesRecibos = { clientes: ClienteRecibo[]; colaboradores: ColaboradorRecibo[]; aeronaves: AeronaveRecibo[]; cotistas: CotistaRecibo[]; categorias: CategoriaRecibo[]; categorias_cliente: CategoriaClienteRecibo[]; abastecimentos: AbastecimentoRecibo[]; fornecedores: FornecedorRecibo[]; recebedores: RecebedorRecibo[] };

export type TipoRecibo = "recibo_reembolso" | "recibo_colaborador" | "recibo_pagamento";
export type StatusRecibo = "CRIADO" | "ANEXO_PENDENTE" | "PDF_PENDENTE" | "EMITIDO" | "EMAIL_ENVIADO" | "ERRO_ANEXO" | "ERRO_PDF" | "CANCELADO" | "emitido" | "aguardando_reembolso" | "reembolsado" | "cancelado";
export type Recibo = {
  id: string;
  numero_recibo: string;
  tipo_recibo: TipoRecibo;
  beneficiario_tipo?: "cliente" | "colaborador" | "freelancer" | "fornecedor";
  pagador_tipo: "empresa" | "cotista_aeronave" | "cliente";
  pagador_id: string;
  cliente_id?: string | null;
  colaborador_id: string | null;
  freelancer_id?: string | null;
  cotista_id?: string | null;
  recebedor_nome: string | null;
  recebedor_cpf: string | null;
  recebedor_endereco?: string | null;
  recebedor_cidade?: string | null;
  recebedor_uf?: string | null;
  aeronave_id: string | null;
  categoria_movimentacao_id?: string | null;
  numero_voo?: string | null;
  rateado: number;
  nome_pagador: string;
  documento_pagador: string | null;
  endereco_pagador: string | null;
  cidade_pagador: string | null;
  uf_pagador: string | null;
  valor: number;
  descricao_servico?: string;
  descricao?: string;
  data_emissao: string;
  data_vencimento: string | null;
  forma_pagamento: string | null;
  numero_documento_anexo: string | null;
  anexo_id: string | null;
  observacoes: string | null;
  grupo_categoria: string;
  categoria_id?: string | null;
  natureza_despesa?: "aeronave" | "empresa" | null;
  tipo_caixa: "SHARE" | "CLIENTE" | "HOLDING";
  status: StatusRecibo;
  url_recibo: string | null;
  pdf_anexo_id?: string | null;
  pdf_url?: string | null;
  conta_pagar_id?: string | null;
  despesa_programada?: boolean;
  rateio_linhas?: Array<{ id: string; rateio_id: string | null; percentual: number; valor: number; cotista_id: string | null; cotista_nome?: string | null }>;
  /** Movimento da conta holding; nulo quando o recibo usa somente o caixa Share. */
  /** Lançamento do caixa Share; nulo quando o recibo é exclusivamente da holding. */
  lancamento_id?: string | null;
  criado_por: string | null;
  criado_em: string;
};
export type RateioLinhaRecibo = { id: string; recibo_id: string; rateio_despesas_id: string; cotista_id?: string | null; cotista_nome?: string | null; cliente_id: string | null; socio_id: string | null; cotista_ids?: string[]; fornecedor_id?: string | null; categoria_id?: string | null; categoria_nome?: string | null; email_solicitado?: boolean; email_enviado?: boolean; nome: string | null; percentual: number; valor: number };

export type RateioLinhaEnvio = { cotista_id?: string; cliente_id?: string; socio_id?: string | null; percentual?: number; percentual_sociedade?: number; valor?: number; valor_centavos?: number; pago_por?: string };
export type CriarReciboPayload = {
  tipo_recibo: TipoRecibo;
  natureza_despesa?: "aeronave" | "empresa" | null;
  categoria_nome_manual?: string | null;
  reembolsavel?: boolean;
  rateado?: boolean;
  aeronave_id?: string | null;
  cliente_id?: string | null;
  colaborador_id?: string | null;
  recebedor_id?: string | null;
  recebedor_nome?: string | null;
  recebedor_cpf?: string | null;
  recebedor_endereco?: string | null;
  recebedor_cidade?: string | null;
  recebedor_uf?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  /** O backend usa a Share Brasil como pagadora fixa; campos antigos permanecem opcionais para compatibilidade. */
  nome_pagador?: string;
  documento_pagador?: string | null;
  endereco_pagador?: string | null;
  cidade_pagador?: string | null;
  uf_pagador?: string | null;
  valor?: number;
  valor_centavos: number;
  descricao?: string;
  data_emissao: string;
  data_vencimento?: string | null;
  forma_pagamento?: string | null;
  categoria_movimentacao_id: string;
  categoria_despesa_subcategoria?: string | null;
  numero_voo?: string | null;
  categoria_nome?: string | null;
  categoria_lancamento_id?: string | null;
  codigo_cliente?: string | null;
  abastecimentos_id?: string | null;
  pagador_tipo: "empresa" | "cotista_aeronave" | "cliente";
  pagador_id: string;
  periodicidade?: Periodicidade | null;
  tipo_rateio?: string | null;
  tipo_despesa?: "fixo" | "variável" | null;
  grupo_categoria?: string | null;
  boleto_url?: string | null;
  nf_url?: string | null;
  anexo_id?: string | null;
  numero_documento_anexo?: string | null;
  observacoes?: string | null;
  rateio_linhas?: RateioLinhaEnvio[];
};

type RespostaOpcoesRecibos = Partial<OpcoesRecibos> & {
  recebedores?: RecebedorRecibo[];
  usuarios?: Array<Record<string, unknown>>;
  freelancers?: Array<Record<string, unknown>>;
  tripulantes?: Array<Record<string, unknown>>;
  colaboradores?: ColaboradorRecibo[];
};

function normalizarRecebedor(item: Record<string, unknown>, origem: RecebedorRecibo["origem"], prefixo: string): RecebedorRecibo {
  const nome = String(item.nome ?? item.nome_exibicao ?? item.nome_completo ?? item.email ?? "").trim();
  return {
    id: `${prefixo}:${String(item.id ?? nome)}`,
    nome: nome || (origem === "tripulacao_freelancer" ? "Freelancer sem nome" : "Perfil sem nome"),
    cpf: item.cpf ? String(item.cpf) : null,
    email: item.email ? String(item.email) : null,
    telefone: item.telefone ? String(item.telefone) : null,
    endereco: item.endereco ? String(item.endereco) : null,
    cidade: item.cidade ? String(item.cidade) : null,
    uf: item.uf ? String(item.uf) : null,
    tipo_user: item.tipo_user ? String(item.tipo_user) : origem === "tripulacao_freelancer" ? "freelancer" : null,
    origem,
    canac: item.canac ? String(item.canac) : null,
  };
}

export async function buscarOpcoesRecibos(): Promise<OpcoesRecibos> {
  const resposta = await colaboradorRequest<RespostaOpcoesRecibos>("/api/financeiro/recibos/opcoes");
  const recebedorFallback = [
    ...(Array.isArray(resposta.usuarios) ? resposta.usuarios.map((item) => normalizarRecebedor(item, "user_profiles", "perfil")) : []),
    ...(Array.isArray(resposta.colaboradores) ? resposta.colaboradores.map((item) => normalizarRecebedor(item, "user_profiles", "perfil")) : []),
    ...(Array.isArray(resposta.tripulantes) ? resposta.tripulantes.map((item) => normalizarRecebedor(item, "tripulacao_freelancer", "freelancer")) : []),
    ...(Array.isArray(resposta.freelancers) ? resposta.freelancers.map((item) => normalizarRecebedor(item, "tripulacao_freelancer", "freelancer")) : []),
  ];
  const recebedores = Array.isArray(resposta.recebedores) && resposta.recebedores.length > 0 ? resposta.recebedores : recebedorFallback;
  return {
    clientes: Array.isArray(resposta.clientes) ? resposta.clientes : [],
    colaboradores: Array.isArray(resposta.colaboradores) ? resposta.colaboradores : [],
    aeronaves: Array.isArray(resposta.aeronaves) ? resposta.aeronaves : [],
    cotistas: Array.isArray(resposta.cotistas) ? resposta.cotistas : [],
    categorias: Array.isArray(resposta.categorias) ? resposta.categorias : [],
    categorias_cliente: Array.isArray(resposta.categorias_cliente) ? resposta.categorias_cliente : [],
    abastecimentos: Array.isArray(resposta.abastecimentos) ? resposta.abastecimentos : [],
    fornecedores: Array.isArray(resposta.fornecedores) ? resposta.fornecedores : [],
    recebedores,
  };
}
export function buscarRecibos(filtro?: { status?: StatusRecibo; beneficiario_tipo?: "cliente" | "colaborador" | "freelancer" | "fornecedor"; q?: string; data_inicial?: string; data_final?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filtro?.status) params.set("status", filtro.status);
  if (filtro?.beneficiario_tipo) params.set("beneficiario_tipo", filtro.beneficiario_tipo);
  if (filtro?.q?.trim()) params.set("q", filtro.q.trim());
  if (filtro?.data_inicial) params.set("data_inicial", filtro.data_inicial);
  if (filtro?.data_final) params.set("data_final", filtro.data_final);
  if (filtro?.limit !== undefined) params.set("limit", String(filtro.limit));
  if (filtro?.offset !== undefined) params.set("offset", String(filtro.offset));
  const query = params.toString();
  return colaboradorRequest<{ recibos: Recibo[]; pagina?: { limit: number; offset: number; total: number; has_more: boolean } }>(`/api/financeiro/recibos${query ? `?${query}` : ""}`);
}
export function buscarRecibo(id: string) { return colaboradorRequest<{ recibo: Recibo; rateio: RateioLinhaRecibo[] }>(`/api/financeiro/recibos/${encodeURIComponent(id)}`); }
export function criarRecibo(payload: CriarReciboPayload) {
  return colaboradorRequest<{ recibo: Recibo; lancamento_id: string | null; rateio_ids: string[]; rateio_linhas: RateioLinhaEnvio[] }>("/api/financeiro/recibos", { method: "POST", body: JSON.stringify(payload) });
}
export type LeituraDemonstrativoResponse = { sucesso: boolean; persistido: false; tipo: string; dados_extraidos: Record<string, any> };
export function lerDemonstrativoRecibo(payload: { imageBase64: string; mimeType: string; tipo: string }) {
  return colaboradorRequest<LeituraDemonstrativoResponse>("/api/financeiro/recibos/leitura-demonstrativo", { method: "POST", body: JSON.stringify(payload) });
}
export type GrupoReciboDemonstrativo = {
  cotista_id: string;
  aeronave_id: string;
  nome_pagador: string;
  documento_pagador?: string | null;
  endereco_pagador?: string | null;
  cidade_pagador?: string | null;
  uf_pagador?: string | null;
  valor_centavos: number;
  descricao: string;
  data_emissao: string;
  data_vencimento: string;
  numero_voo?: string | null;
  categoria_movimentacao_id: string;
  categoria_nome: string;
  grupo_categoria?: string | null;
  numero_documento_anexo?: string | null;
  observacoes?: string | null;
  idempotency_key?: string | null;
};
export function gerarRecibosDemonstrativo(grupos: GrupoReciboDemonstrativo[]) {
  return colaboradorRequest<{ recibos: Recibo[] }>("/api/financeiro/recibos/gerar-demonstrativo", { method: "POST", body: JSON.stringify({ grupos }) });
}
export function confirmarReembolsoRecibo(id: string, payload?: { data?: string; observacoes?: string }) {
  return colaboradorRequest<{ ok: boolean; id: string; lancamento_share_id: string; lancamento_cliente_id: string; conta_receber_id: string; status: string; idempotent?: boolean }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/reembolso`, { method: "POST", body: JSON.stringify(payload || {}) });
}
export function cancelarRecibo(id: string) { return colaboradorRequest<{ ok: boolean; status: StatusRecibo }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/cancelar`, { method: "POST" }); }
export function reativarRecibo(id: string, justificativa: string) {
  return colaboradorRequest<{ ok: boolean; id: string; status: StatusRecibo }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/reativar`, { method: "POST", body: JSON.stringify({ justificativa }) });
}
export function atualizarStatusRecibo(id: string, status: StatusRecibo) { return colaboradorRequest<{ ok: boolean; status: StatusRecibo }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); }
export type LinhaProgramacaoRecibo = { cotista_id: string; percentual_uso: number; socio_id?: string | null };
export type ProgramacaoReciboPayload = { aeronave_id: string; fornecedor_id?: string | null; fornecedor_nome?: string | null; periodicidade?: Periodicidade | null; data_vencimento: string; categoria_id?: string | null; categoria_nome?: string | null; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null; tipo_rateio: "FIXO" | "VARIAVEL_POR_VOO" | "VARIAVEL_POR_HORA" | "EXTRA"; observacoes?: string | null; boleto_url?: string | null; linhas: LinhaProgramacaoRecibo[] };
export function programarContaAPagarRecibo(id: string, payload: ProgramacaoReciboPayload) { return colaboradorRequest<{ ok: boolean; conta_pagar_id: string; rateio_ids: string[] }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/programar-contas-apagar`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarDespesaRateioRecibo(id: string, payload?: { aeronave_id?: string | null; fornecedor_id?: string | null; fornecedor_nome?: string | null; periodicidade?: Periodicidade | null; data_vencimento?: string | null; observacoes?: string | null; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null; rateio_linhas?: RateioLinhaEnvio[] }) { return colaboradorRequest<{ ok: boolean; recibo_id: string; lancamento_id: string | null; rateio_ids: string[]; idempotent?: boolean }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/enviar-despesa-rateio`, { method: "POST", body: JSON.stringify(payload || {}) }); }
export function enviarAnexoRecibo(arquivo: File, reciboId?: string) { const body = new FormData(); body.append("arquivo", arquivo); if (reciboId) body.append("recibo_id", reciboId); return colaboradorRequest<{ id: string; url: string; nome_arquivo: string; tipo_arquivo: string; tamanho_arquivo: number }>("/api/financeiro/recibos/anexos", { method: "POST", body }); }
export function enviarPdfRecibo(id: string, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); return colaboradorRequest<{ anexo_id: string; pdf_url: string }>(`/api/financeiro/recibos/${encodeURIComponent(id)}/pdf`, { method: "POST", body }); }
export function enviarDemonstrativoRecibo(arquivo: File, reciboId?: string) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); if (reciboId) body.append("recibo_id", reciboId); return colaboradorRequest<{ id: string; recibo_id: string | null; caminho_arquivo: string; url: string; nome_arquivo: string; tipo_arquivo: string; tamanho_arquivo: number }>("/api/financeiro/recibos/demonstrativo", { method: "POST", body }); }
export type ContatoEmail = {
  id: string;
  nome: string;
  email: string;
  tipo: "cliente" | "socio" | string;
  cliente_id?: string | null;
};

export type AnexoEmail = {
  id: string;
  nome: string;
  origem: "recibo" | "relatorio_despesa_viagem" | "nf_saida" | "recibo_saida" | string;
  tipo_arquivo: string | null;
  tamanho_arquivo?: number | null;
  arquivo_url: string;
};

export type EmailEnviado = {
  id: string;
  destinatarios: string[];
  assunto: string;
  status: "enviado" | "erro" | "pendente" | "processando" | "enviado_parcial" | "cancelado" | string;
  quantidade_anexos: number;
  mensagem?: string | null;
  anexos_detalhes?: Array<{ nome_arquivo: string; tipo_arquivo: string; tamanho_bytes?: number; key?: string }>;
  criado_em: string;
  email_enviado_em?: string | null;
  erro?: string | null;
  enviado_por?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
};

export type CentralEmailResponse = {
  contatos: ContatoEmail[];
  anexos: AnexoEmail[];
  historico: EmailEnviado[];
};

export function buscarCentralEmail() {
  return colaboradorRequest<CentralEmailResponse>("/api/interno/emails");
}
export async function baixarAnexoEmailEnviado(emailId: string, indice: number) {
  return carregarArquivoColaborador(`/api/interno/emails/${encodeURIComponent(emailId)}/anexos/${indice}`);
}

export function enviarEmailCliente(payload: {
  destinatarios: string[];
  cc?: string[];
  assunto: string;
  mensagem: string;
  dados_bancarios?: string;
  anexos?: string[];
  referencias?: string[];
  arquivos?: File[];
  arquivos_persistidos?: Array<{ key: string; filename: string; content_type: string }>;
  rascunho_id?: string;
  cotista_id?: string;
  idempotency_key?: string;
  nome_destinatario?: string;
}) {
  const hasFiles = (payload.arquivos && payload.arquivos.length > 0) || (payload.arquivos_persistidos && payload.arquivos_persistidos.length > 0);
  if (hasFiles) {
    const body = new FormData();
    body.append("destinatarios", JSON.stringify(payload.destinatarios));
    body.append("assunto", payload.assunto);
    body.append("mensagem", payload.mensagem);
    if (payload.dados_bancarios) body.append("dados_bancarios", payload.dados_bancarios);
    if (payload.anexos?.length) body.append("anexos", JSON.stringify(payload.anexos));
    if (payload.referencias?.length) body.append("referencias", JSON.stringify(payload.referencias));
    if (payload.arquivos_persistidos?.length) body.append("arquivos_persistidos", JSON.stringify(payload.arquivos_persistidos));
    if (payload.rascunho_id) body.append("rascunho_id", payload.rascunho_id);
    if (payload.cotista_id) body.append("cotista_id", payload.cotista_id);
    if (payload.idempotency_key) body.append("idempotency_key", payload.idempotency_key);
    if (payload.nome_destinatario) body.append("nome_destinatario", payload.nome_destinatario);
    for (const arquivo of payload.arquivos!) body.append("arquivos", arquivo);
    return colaboradorRequest<{ success: boolean; id: string }>("/api/interno/emails", { method: "POST", body });
  }
  return colaboradorRequest<{ success: boolean; id: string }>("/api/interno/emails", {
    method: "POST",
    body: JSON.stringify({ ...payload, arquivos: undefined }),
  });
}

export type ContaBancariaEmail = { id: string; banco: string; agencia: string | null; numero_conta: string | null; tipo_conta: string | null; cnpj: string | null; razao_social: string | null; pix: string | null; texto: string };
export type AssinaturaEmail = { nome: string; cargo?: string | null; telefone?: string | null; endereco?: string | null; email?: string | null; logo_url?: string | null };
export function buscarMinhaAssinatura() { return colaboradorRequest<AssinaturaEmail | null>("/api/minha-assinatura"); }
export function salvarMinhaAssinatura(payload: Omit<AssinaturaEmail, "logo_url" | "email">) { return colaboradorRequest<AssinaturaEmail>("/api/minha-assinatura", { method: "PATCH", body: JSON.stringify(payload) }); }
export function buscarContasBancariasEmail() { return colaboradorRequest<{ contas: ContaBancariaEmail[] }>("/api/interno/emails/contas-bancarias"); }
export function salvarContaBancariaEmail(id: string, payload: Partial<Omit<ContaBancariaEmail, "id" | "texto">>) { return colaboradorRequest<{ ok: boolean }>(`/api/interno/emails/contas-bancarias/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function removerLogoAssinatura() { return Promise.resolve({ success: true }); }
export type CtmRegistro = Record<string, any>
export type CtmDashboard = { aeronaves: CtmRegistro[]; aeronave: CtmRegistro | null; programa: CtmRegistro[]; diretrizes: CtmRegistro[]; componentes: CtmRegistro[]; oas: CtmRegistro[]; orcamentos: CtmRegistro[]; ras: CtmRegistro[]; carregamentos: CtmRegistro[]; resumo: Record<string, number> }
export function buscarCtmDashboard(aeronaveId?: string) { return colaboradorRequest<{ data: CtmDashboard }>(`/api/ctm/dashboard${aeronaveId ? `?aeronave_id=${encodeURIComponent(aeronaveId)}` : ""}`); }
export type CtmDocumentoAeronave = { id: string; nome: string; descricao: string | null; tipo_arquivo: string | null; tamanho_arquivo: number | null; enviado_por: string | null; criado_em: string | null; aeronave_id: string; tipo_documento: string | null; data_validade: string | null; atualizado_em: string | null; dias_alerta: number | null; arquivo_url?: string };
export type CtmDocumentoAeronavePayload = { nome: string; descricao?: string | null; tipo_documento?: string | null; data_validade?: string | null; dias_alerta?: number };
export function buscarCtmDocumentosAeronave(aeronaveId: string) { return colaboradorRequest<{ documentos: CtmDocumentoAeronave[] }>(`/api/ctm/aeronaves/${encodeURIComponent(aeronaveId)}/documentos`); }
export function enviarCtmDocumentoAeronave(aeronaveId: string, payload: CtmDocumentoAeronavePayload, arquivo: File) { const body = new FormData(); body.append("arquivo", arquivo, arquivo.name); body.append("nome", payload.nome); body.append("descricao", payload.descricao || ""); body.append("tipo_documento", payload.tipo_documento || "outro"); body.append("data_validade", payload.data_validade || ""); body.append("dias_alerta", String(payload.dias_alerta ?? 30)); return colaboradorRequest<{ documento: CtmDocumentoAeronave }>(`/api/ctm/aeronaves/${encodeURIComponent(aeronaveId)}/documentos`, { method: "POST", body }); }
export function atualizarCtmDocumentoAeronave(aeronaveId: string, id: string, payload: CtmDocumentoAeronavePayload) { return colaboradorRequest<{ documento: CtmDocumentoAeronave; success: boolean }>(`/api/ctm/aeronaves/${encodeURIComponent(aeronaveId)}/documentos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirCtmDocumentoAeronave(aeronaveId: string, id: string) { return colaboradorRequest<{ success: boolean }>(`/api/ctm/aeronaves/${encodeURIComponent(aeronaveId)}/documentos/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function carregarArquivoCtmDocumentoAeronave(aeronaveId: string, id: string) { return carregarArquivoColaborador(`/api/ctm/aeronaves/${encodeURIComponent(aeronaveId)}/documentos/${encodeURIComponent(id)}/arquivo`); }
export type AeronaveShare = { id: string; matricula_registro: string; fabricante: string; modelo: string; numero_serie?: string | null; nome_proprietario?: string | null; status?: string | null; consumo_combustivel?: number | null; ano?: number | null; base?: string | null; preco_hora?: number | null; url_imagem?: string | null; velocidade_cruzeiro?: number | null; tipo_aeronave?: string | null; numero_motores?: number | null; performance_aeronave_id?: string | null; performance_id?: string | null; performance_categoria?: string | null; performance_modelo?: string | null; performance_teto_servico_ft?: number | null; performance_nivel_cruzeiro_min_ft?: number | null; performance_nivel_cruzeiro_max_ft?: number | null; performance_aprovado_rvsm?: number | null; performance_velocidade_cruzeiro_kt?: number | null; performance_taxa_subida_fpm?: number | null; performance_taxa_descida_fpm?: number | null };
export type AeronavePayload = Partial<Omit<AeronaveShare, "id" | "performance_id">> & { matricula_registro: string; fabricante: string; modelo: string };
export function buscarAeronavesShare(status: "ativa" | "inativa" = "ativa") { return colaboradorRequest<{ aeronaves: AeronaveShare[] }>(`/api/sharebrasil/aeronaves?status=${status}`); }
export function buscarAeronaveShare(id: string) { return colaboradorRequest<{ aeronave: AeronaveShare }>(`/api/sharebrasil/aeronaves/${encodeURIComponent(id)}`); }
export function criarAeronaveShare(payload: AeronavePayload) { return colaboradorRequest<{ aeronave: AeronaveShare; performance_id: string | null }>("/api/sharebrasil/aeronaves", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarAeronaveShare(id: string, payload: AeronavePayload) { return colaboradorRequest<{ success: boolean; performance_id: string | null }>(`/api/sharebrasil/aeronaves/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function enviarImagemAeronave(file: File) { const body = new FormData(); body.append("file", file, file.name); body.append("folder", "aeronaves/images"); return colaboradorRequest<{ url: string; key: string }>("/api/upload", { method: "POST", body }); }
export type AniversarioShare = { id: string; nome: string; data_aniversario: string; empresa: string | null; categoria: string | null; url_avatar: string | null; status?: string | null; origem: "user_profiles" | "aniversarios"; criado_em?: string | null; atualizado_em?: string | null };
export type AniversarioSharePayload = { nome: string; data_aniversario: string; empresa?: string | null; categoria?: string | null; url_avatar?: string | null };
export function buscarAniversariosShare() { return colaboradorRequest<{ aniversarios: AniversarioShare[] }>("/api/interno/aniversarios"); }
export function criarAniversarioShare(payload: AniversarioSharePayload) { return colaboradorRequest<{ aniversario: AniversarioShare }>("/api/interno/aniversarios", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarAniversarioShare(id: string, payload: AniversarioSharePayload) { return colaboradorRequest<{ aniversario: AniversarioShare; success: boolean }>(`/api/interno/aniversarios/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirAniversarioShare(id: string) { return colaboradorRequest<{ success: boolean }>(`/api/interno/aniversarios/${encodeURIComponent(id)}`, { method: "DELETE" }); }
