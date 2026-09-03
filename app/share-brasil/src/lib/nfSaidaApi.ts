import { colaboradorRequest } from "./colaborador-api";

export interface CotistaOpcao { cotista_aeronave_id: string; aeronave_id: string; cliente_id: string | null; socio_id: string | null; codigo_cliente: string | null; nome: string; cnpj?: string | null; percentual_sociedade?: number; }
export interface CategoriaOpcao { id: string; nome: string; grupo_categoria?: string | null; tipo?: string | null; }
export interface CategoriaDespesaOpcao { id: string; nome: string; subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null; }
export interface NotaOuReciboSaidaRow { [key: string]: any; id: string; }
const request = <T,>(path: string, init?: RequestInit) => colaboradorRequest<T>(path, init);
export function buscarNotasSaida() { return request<{ notas: NotaOuReciboSaidaRow[]; recibos: NotaOuReciboSaidaRow[] }>("/api/financeiro/notas-saida"); }
export function buscarOpcoesNotasSaida() { return request<{ cotistas: CotistaOpcao[]; aeronaves: { id: string; matricula_registro: string }[]; categoriasReceita: CategoriaOpcao[]; categoriasDespesa: CategoriaDespesaOpcao[]; contasBancarias: any[] }>("/api/financeiro/notas-saida/opcoes"); }
export function criarNotaSaida(payload: Record<string, unknown>) { return request<{ nota: NotaOuReciboSaidaRow }>("/api/financeiro/notas-saida", { method: "POST", body: JSON.stringify(payload) }); }
export function atualizarNotaSaida(id: string, payload: Record<string, unknown>) { return request<{ nota: NotaOuReciboSaidaRow }>(`/api/financeiro/notas-saida/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function criarReciboSaida(payload: Record<string, unknown>) { return request<{ recibo: NotaOuReciboSaidaRow }>("/api/financeiro/recibos-saida", { method: "POST", body: JSON.stringify(payload) }); }
export function excluirNotaOuReciboSaida(id: string, origem: "nf_saida" | "recibo_saida") { return request<{ ok: boolean }>(`/api/financeiro/${origem === "nf_saida" ? "notas-saida" : "recibos-saida"}/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export function darBaixaNotaOuReciboSaida(id: string, payload: Record<string, unknown>) { return request<{ ok: boolean }>(`/api/financeiro/${payload.origem === "nf_saida" ? "notas-saida" : "recibos-saida"}/${encodeURIComponent(id)}/dar-baixa`, { method: "POST", body: JSON.stringify(payload) }); }
export function enviarAnexoNotaSaida(arquivo: Blob, nome = "anexo") { const body = new FormData(); body.append("arquivo", arquivo, nome); return request<{ id: string; url: string }>("/api/financeiro/notas-saida/anexos", { method: "POST", body }); }
