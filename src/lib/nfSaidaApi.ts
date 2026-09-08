import { colaboradorRequest } from "./colaborador-api";
import type { CotistaAeronaveRef, DocumentoSaidaOrigem, StatusDocumentoSaida } from "../../shared/financeiro-contracts";
export type { CotistaAeronaveRef, DocumentoSaidaOrigem, StatusDocumentoSaida } from "../../shared/financeiro-contracts";

export interface CotistaOpcao { cotista_aeronave_id: string; aeronave_id: string; cliente_id: string | null; socio_id: string | null; codigo_cliente: string | null; nome: string; cnpj?: string | null; cpf?: string | null; documento?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; tipo_cotista?: "cliente" | "socio_hold"; percentual_sociedade?: number; }
export interface CategoriaOpcao { id: string; nome: string; grupo_categoria?: string | null; tipo?: string | null; }
export interface CategoriaDespesaOpcao { id: string; nome: string; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null; }
export interface ContaBancariaOpcao { id: string; banco: string; numero_conta: string | null; }
export interface NotaOuReciboSaidaRow {
	id: string;
	origem?: DocumentoSaidaOrigem;
	numero?: string | null;
	numero_recibo?: string | null;
	cotista_aeronave_id?: string | null;
	cotista_id?: string | null;
	cliente_id: string | null;
	socio_id: string | null;
	cliente_nome: string | null;
	cliente_cnpj: string | null;
	cliente_endereco?: string | null;
	cliente_cidade?: string | null;
	cliente_uf?: string | null;
	cliente_email?: string | null;
	aeronave_id?: string | null;
	aeronave_matricula?: string | null;
	data_criacao?: string | null;
	data_emissao?: string | null;
	data_vencimento: string | null;
	valor?: number | string | null;
	valor_total?: number | string | null;
	categoria?: string | null;
	nome_categoria?: string | null;
	descricao?: string | null;
	descricao_servico?: string | null;
	status: StatusDocumentoSaida | null;
	arquivo_pdf_url?: string | null;
	pdf_url?: string | null;
	contas_areceber_id?: string | null;
	criado_em: string | null;
	atualizado_em: string | null;
}
export interface DocumentoSaida {
	id: string;
	origem?: DocumentoSaidaOrigem;
	numero: string | null;
	cotista_aeronave_id: string | null;
	cliente_id: string | null;
	socio_id: string | null;
	cliente_nome: string | null;
	cliente_cnpj: string | null;
	cliente_endereco: string | null;
	cliente_cidade: string | null;
	cliente_uf: string | null;
	cliente_email: string | null;
	data_criacao: string | null;
	data_vencimento: string | null;
	valor: number | string | null;
	categoria: string | null;
	descricao: string | null;
	status: string | null;
	arquivo_pdf_url: string | null;
	criado_em: string | null;
	atualizado_em: string | null;
	aeronave: string | null;
	aircraft_id: string | null;
	contas_areceber_id: string | null;
}
export interface NotaSaidaPayload {
	numero: string;
	cotista_aeronave_id: string;
	aeronave_id: string;
	categoria_receita_id: string;
	categoria_receita_nome: string;
	categoria_id: string | null;
	subcategoria_1: string | null;
	data_emissao: string;
	data_vencimento: string;
	valor_total: number;
	nome_categoria: string;
	descricao_servico: string;
	status: StatusDocumentoSaida;
	arquivo_pdf_url: string | null;
}
export interface ReciboSaidaPayload {
	cotista_aeronave_id: string;
	aeronave_id: string;
	categoria_receita_id: string;
	categoria_receita_nome: string;
	categoria_despesa_id: string;
	categoria_despesa_subcategoria: string | null;
	data_emissao: string;
	data_vencimento: string;
	valor: number;
	descricao_servico: string;
	status: StatusDocumentoSaida;
}
export interface AtualizarNotaSaidaPayload extends Partial<NotaSaidaPayload> {}
export interface AtualizarReciboSaidaPayload { pdf_url: string; }
export interface BaixaDocumentoSaidaPayload {
	origem: DocumentoSaidaOrigem;
	data_pagamento: string;
	conta_bancaria: string | null;
	forma_pagamento: string | null;
	comprovante_url: string | null;
}
export interface OpcoesNotasSaida {
	cotistas: CotistaOpcao[];
	aeronaves: { id: string; matricula_registro: string }[];
	categoriasReceita: CategoriaOpcao[];
	categoriasDespesa: CategoriaDespesaOpcao[];
	contasBancarias: ContaBancariaOpcao[];
}
const request = <T,>(path: string, init?: RequestInit) => colaboradorRequest<T>(path, init);
export function buscarNotasSaida() { return request<{ notas: NotaOuReciboSaidaRow[]; recibos: NotaOuReciboSaidaRow[] }>("/api/financeiro/notas-saida"); }
export function buscarOpcoesNotasSaida() { return request<OpcoesNotasSaida>("/api/financeiro/notas-saida/opcoes"); }
function paraPayloadNotaSaida(payload: NotaSaidaPayload | AtualizarNotaSaidaPayload): Record<string, unknown> {
	const { cotista_aeronave_id, ...resto } = payload;
	return { ...resto, ...(cotista_aeronave_id !== undefined ? { cotista_id: cotista_aeronave_id } : {}) };
}
export function criarNotaSaida(payload: NotaSaidaPayload) { return request<{ nota: NotaOuReciboSaidaRow }>("/api/financeiro/notas-saida", { method: "POST", body: JSON.stringify(paraPayloadNotaSaida(payload)) }); }
export function atualizarNotaSaida(id: string, payload: AtualizarNotaSaidaPayload) { return request<{ nota: NotaOuReciboSaidaRow }>(`/api/financeiro/notas-saida/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(paraPayloadNotaSaida(payload)) }); }
export function criarReciboSaida(payload: ReciboSaidaPayload) { return request<{ recibo: NotaOuReciboSaidaRow }>("/api/financeiro/recibos-saida", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarReciboSaida(id: string, payload: AtualizarReciboSaidaPayload) { return request<{ recibo: NotaOuReciboSaidaRow }>(`/api/financeiro/recibos-saida/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function excluirNotaOuReciboSaida(id: string, origem: DocumentoSaidaOrigem) { return request<{ ok: boolean }>(`/api/financeiro/${origem === "nf_saida" ? "notas-saida" : "recibos-saida"}/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function darBaixaNotaOuReciboSaida(id: string, payload: BaixaDocumentoSaidaPayload) { return request<{ ok: boolean }>(`/api/financeiro/${payload.origem === "nf_saida" ? "notas-saida" : "recibos-saida"}/${encodeURIComponent(id)}/dar-baixa`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarAnexoDocumentoSaida(arquivo: Blob, nome = "anexo", options: { origem?: "nota_fiscal_saida" | "recibo_saida"; documentoId?: string } = {}) { const body = new FormData(); body.append("arquivo", arquivo, nome); body.append("origem", options.origem || "nota_fiscal_saida"); if (options.documentoId) body.append("documento_id", options.documentoId); return request<{ id: string | null; url: string }>("/api/financeiro/notas-saida/anexos", { method: "POST", body }); }
