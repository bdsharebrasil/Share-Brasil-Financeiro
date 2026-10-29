import type { EnvioPagamento, RascunhoEnvioPagamento } from "@/lib/colaborador-api";

export type SituacaoHistorico = "pendente" | "pago" | "cancelado" | "outro" | "rascunho";
export type FiltroHistorico = "todos" | SituacaoHistorico;
type Registro = Record<string, unknown>;

export interface ItemHistorico {
  id: string;
  origem: "envio" | "rascunho";
  envio?: EnvioPagamento;
  rascunho?: RascunhoEnvioPagamento;
  grupoId: string;
  cliente: string;
  clienteIds: string[];
  descricao: string;
  fornecedor: string;
  responsavel: string;
  tipo: string;
  situacao: SituacaoHistorico;
  status: string;
  valorCentavos: number;
  criadoEm: string;
  atualizadoEm: string;
  emissao: string;
  vencimento: string;
  pagamento: string;
  emailEnviado: boolean;
  emailEm: string;
  emailDestinatario: string;
  lancamentoId: string;
  categoria: string;
  observacoes: string;
  aeronaveId: string;
  aeronaveGrupoId: string;
  aeronave: string;
  etapa: number;
  envioVinculado: boolean;
  busca: string;
}

export interface GrupoHistorico {
  id: string;
  nome: string;
  itens: ItemHistorico[];
  totalCentavos: number;
  pendentes: number;
}

export const registro = (valor: unknown): Registro =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : {};

function texto(...valores: unknown[]): string {
  for (const valor of valores) {
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return "";
}

function lerJson(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  try { return JSON.parse(valor); } catch { return undefined; }
}

export function normalizarBusca(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function chave(valor: unknown): string {
  return normalizarBusca(String(valor ?? "")).replace(/[\s-]+/g, "_");
}

// A API original usa `valor` em reais; o formulário do rascunho usa moeda pt-BR.
function centavos(valor: unknown, formulario = false): number {
  let numero = valor;
  if (typeof valor === "string") {
    const limpo = valor.replace(/R\$|\s/g, "");
    numero = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : formulario && /^\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, "") : limpo);
  }
  return typeof numero === "number" && Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export const moeda = (valorCentavos: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorCentavos / 100);

export function dataHistorico(valor: string, horario = false): string {
  if (!valor) return "Não informado";
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00` : valor);
  if (!Number.isFinite(data.getTime())) return "Não informado";
  return horario
    ? data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : data.toLocaleDateString("pt-BR");
}

const PAGOS = new Set(["pago", "paga", "pagamento_concluido", "pago_diretamente", "reembolsado", "liquidado", "quitado"]);
const CANCELADOS = new Set(["cancelado", "cancelada", "rejeitado", "rejeitada"]);
const PENDENTES = new Set(["pendente", "em_aberto", "aguardando", "aguardando_aprovacao", "aguardando_pagamento", "em_aprovacao", "aprovado", "enviado", "programado", "convertido", "email_pendente", "email_enviado", "em_atraso", "atrasado"]);

function situacaoEnvio(dados: Registro): { situacao: SituacaoHistorico; status: string } {
  const original = chave(dados.status);
  const financeiro = chave(dados.status_pagamento);
  if (CANCELADOS.has(original)) return { situacao: "cancelado", status: original.startsWith("rejeitad") ? "Rejeitado" : "Cancelado" };
  const status = financeiro || original;
  if (PAGOS.has(status)) return { situacao: "pago", status: "Pago" };
  if (CANCELADOS.has(status)) return { situacao: "cancelado", status: "Cancelado" };
  if (PENDENTES.has(status)) return { situacao: "pendente", status: status === "convertido" ? "Lançado" : status === "aguardando_aprovacao" ? "Em aprovação" : status === "email_pendente" ? "E-mail pendente" : "Pendente" };
  // Conversão em lançamento não comprova pagamento. Status desconhecidos são mantidos.
  return { situacao: "outro", status: texto(dados.status_pagamento, dados.status).replace(/_/g, " ") || "Sem status" };
}

function identificarCliente(dados: Registro, form: Registro, tipo: string, nomes: Record<string, string>) {
  if (tipo === "share") return { grupoId: "share", cliente: "Share Brasil", clienteIds: [] };
  const cliente = registro(dados.cliente);
  const cotista = registro(dados.cotista);
  const nome = texto(dados.cliente_razao_social, dados.cliente_nome, dados.nome_cliente, dados.razao_social_cliente, dados.cotista_nome, dados.nome_cotista, dados.socio_nome, cliente.razao_social, cliente.nome, cotista.nome, form.cliente_nome, form.cotista_nome);
  const clienteDireto = texto(dados.cliente_id, cliente.id, form.cliente_id, dados.socio_id, form.socio_id);
  const rateio = lerJson(dados.rateio_linhas_json ?? dados.rateio_linhas ?? form.rateio_linhas);
  const idsRateio = Array.isArray(rateio) ? rateio.map(linha => texto(registro(linha).cotista_id)).filter(Boolean) : [];
  const idsFormulario = Array.isArray(form.cotista_ids) ? form.cotista_ids.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
  const ids = [...new Set([texto(dados.cotista_aeronave_id, dados.cotista_id, cotista.id), ...idsRateio, ...idsFormulario].filter(Boolean))].sort();
  if (clienteDireto) return { grupoId: `cliente:${clienteDireto}`, cliente: nome || nomes[clienteDireto] || "Cliente não informado", clienteIds: [clienteDireto] };
  if (ids.length > 1) {
    const conhecidos = ids.map(id => nomes[id]).filter(Boolean);
    const faltantes = ids.length - conhecidos.length;
    const titulo = conhecidos.length ? [...conhecidos, ...(faltantes ? [`${faltantes} cotista(s) não identificado(s)`] : [])].join(" · ") : `Rateio entre ${ids.length} cotistas`;
    return { grupoId: `rateio:${ids.join(",")}`, cliente: titulo, clienteIds: ids };
  }
  const id = ids[0];
  return { grupoId: id ? `cliente:${id}` : nome ? `nome:${normalizarBusca(nome)}` : "cliente:nao-informado", cliente: nome || nomes[id] || "Cliente não informado", clienteIds: id ? [id] : nome ? [`nome:${normalizarBusca(nome)}`] : [] };
}

function montarItem(fonte: EnvioPagamento | RascunhoEnvioPagamento, origem: "envio" | "rascunho", nomesCotistas: Record<string, string>, matriculasAeronaves: Record<string, string>): ItemHistorico {
  const dados = registro(fonte);
  const salvo = origem === "rascunho" ? registro(lerJson(dados.dados_json)) : {};
  const form = registro(salvo.form);
  const nomes = { ...nomesCotistas };
  const cotistasSalvos = Array.isArray(salvo.cotistasEmail) ? salvo.cotistasEmail : [];
  for (const valor of cotistasSalvos) {
    const cotistaSalvo = registro(valor);
    const id = texto(cotistaSalvo.id);
    const nome = texto(cotistaSalvo.nome);
    if (id && nome) nomes[id] = nome;
  }
  const tipo = texto(dados.tipo, dados.tipo_envio);
  const situacao = origem === "rascunho"
    ? { situacao: "rascunho" as const, status: chave(dados.status) === "email_pendente" ? "E-mail pendente" : "Rascunho" }
    : situacaoEnvio(dados);
  const email = registro(dados.email);
  const dadosAeronave = registro(dados.aeronave);
  const descricao = texto(dados.descricao, form.descricao) || "Programação sem descrição";
  const matriculaNaDescricao = descricao.match(/\b(?:PP|PR|PS|PT|PU)-[A-Z]{3}\b/i)?.[0]?.toUpperCase() || "";
  const aeronaveId = texto(dados.aeronave_id, dados.aeronaveId, dadosAeronave.id, form.aeronave_id);
  const matriculaAeronave = texto(dados.matricula_registro, dados.aeronave_matricula, dadosAeronave.matricula_registro, form.matricula_registro, aeronaveId ? matriculasAeronaves[aeronaveId] : "", matriculaNaDescricao);
  const aeronaveGrupoId = aeronaveId
    ? `aeronave:${aeronaveId}`
    : matriculaAeronave
      ? `matricula:${normalizarBusca(matriculaAeronave).replace(/[\s-]+/g, "")}`
      : "aeronave:sem-vinculo";
  const emailEm = texto(dados.email_enviado_em, dados.data_envio_email, email.enviado_em, email.enviadoEm);
  const emailEnviado = dados.email_enviado === true || dados.email_enviado === 1 || chave(dados.status_email) === "enviado" || chave(dados.status) === "email_enviado" || Boolean(emailEm);
  const item: ItemHistorico = {
    id: `${origem}:${String(dados.id)}`,
    origem,
    envio: origem === "envio" ? fonte as EnvioPagamento : undefined,
    rascunho: origem === "rascunho" ? fonte as RascunhoEnvioPagamento : undefined,
    ...identificarCliente(dados, form, tipo, nomes),
    ...situacao,
    tipo,
    descricao,
    fornecedor: texto(dados.fornecedor, dados.fornecedor_nome, form.fornecedor) || "Fornecedor não informado",
    responsavel: texto(dados.criado_por_nome, dados.responsavel_nome, dados.autor_nome, registro(dados.autor).nome) || "Não informado",
    valorCentavos: origem === "rascunho" ? centavos(form.valor, true) : dados.valor != null ? centavos(dados.valor) : Math.round(Number(dados.valor_centavos) || 0),
    criadoEm: texto(dados.criado_em, dados.created_at),
    atualizadoEm: texto(dados.atualizado_em, dados.updated_at, dados.criado_em),
    emissao: texto(dados.data_despesa, dados.data_emissao, form.data_despesa),
    vencimento: texto(dados.data_vencimento, dados.vencimento, form.vencimento),
    pagamento: texto(dados.data_pagamento, dados.pago_em),
    emailEnviado,
    emailEm,
    emailDestinatario: texto(dados.email_destinatario, email.destinatario),
    lancamentoId: texto(dados.lancamento_id),
    categoria: texto(dados.categoria_nome, form.categoria_nome, dados.grupo_categoria, form.grupo_categoria),
    observacoes: texto(dados.observacoes, form.observacoes),
    aeronaveId,
    aeronaveGrupoId,
    aeronave: matriculaAeronave,
    etapa: Math.max(0, Number(dados.etapa_atual) || 0),
    envioVinculado: Boolean(dados.envio_id || salvo.envioId),
    busca: "",
  };
  item.busca = normalizarBusca([item.cliente, item.descricao, item.fornecedor, item.responsavel, item.categoria, item.aeronave, item.status].join(" "));
  return item;
}

export function prepararHistorico(envios: EnvioPagamento[], rascunhos: RascunhoEnvioPagamento[], nomesCotistas: Record<string, string> = {}, matriculasAeronaves: Record<string, string> = {}) {
  const unicos = <T extends { id: string }>(itens: T[]) => Array.from(new Map(itens.map(item => [item.id, item])).values());
  const ordenar = (a: ItemHistorico, b: ItemHistorico) => (b.atualizadoEm || b.criadoEm).localeCompare(a.atualizadoEm || a.criadoEm);
  return {
    historico: unicos(envios).map(envio => montarItem(envio, "envio", nomesCotistas, matriculasAeronaves)).sort(ordenar),
    rascunhos: unicos(rascunhos).filter(item => !["concluido", "cancelado", "excluido"].includes(chave(item.status))).map(item => montarItem(item, "rascunho", nomesCotistas, matriculasAeronaves)).sort(ordenar),
  };
}

export function agruparHistorico(itens: ItemHistorico[]): GrupoHistorico[] {
  const grupos = new Map<string, GrupoHistorico>();
  for (const item of itens) {
    let grupo = grupos.get(item.grupoId);
    if (!grupo) {
      grupo = { id: item.grupoId, nome: item.cliente, itens: [], totalCentavos: 0, pendentes: 0 };
      grupos.set(item.grupoId, grupo);
    }
    if (grupo.nome === "Cliente não informado" && item.cliente !== grupo.nome) grupo.nome = item.cliente;
    grupo.itens.push(item);
    // Cancelados não compõem o valor programado ou em aberto.
    if (item.situacao !== "cancelado") grupo.totalCentavos += item.valorCentavos;
    if (item.situacao === "pendente") grupo.pendentes++;
  }
  return Array.from(grupos.values());
}

export function agruparHistoricoPorAeronave(itens: ItemHistorico[]): GrupoHistorico[] {
  const grupos = new Map<string, GrupoHistorico>();
  for (const item of itens) {
    const id = item.aeronaveGrupoId || (item.aeronave ? `matricula:${normalizarBusca(item.aeronave).replace(/[\s-]+/g, "")}` : "aeronave:sem-vinculo");
    let grupo = grupos.get(id);
    if (!grupo) {
      grupo = { id, nome: item.aeronave || "Sem aeronave vinculada", itens: [], totalCentavos: 0, pendentes: 0 };
      grupos.set(id, grupo);
    }
    grupo.itens.push(item);
    if (item.situacao !== "cancelado") grupo.totalCentavos += item.valorCentavos;
    if (item.situacao === "pendente") grupo.pendentes++;
  }
  return Array.from(grupos.values());
}

export function agruparHistoricoPorMes(itens: ItemHistorico[]): GrupoHistorico[] {
  const grupos = new Map<string, GrupoHistorico>();
  for (const item of itens) {
    const valorData = item.criadoEm || item.atualizadoEm;
    const correspondencia = /^(\d{4})-(\d{2})/.exec(valorData);
    const data = correspondencia
      ? new Date(Number(correspondencia[1]), Number(correspondencia[2]) - 1, 1)
      : new Date(valorData);
    const dataValida = Number.isFinite(data.getTime());
    const chaveMes = dataValida ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}` : "0000-00";
    const nome = dataValida
      ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(data)
      : "Data não informada";
    let grupo = grupos.get(chaveMes);
    if (!grupo) {
      grupo = { id: `mes:${chaveMes}`, nome, itens: [], totalCentavos: 0, pendentes: 0 };
      grupos.set(chaveMes, grupo);
    }
    grupo.itens.push(item);
    if (item.situacao !== "cancelado") grupo.totalCentavos += item.valorCentavos;
    if (item.situacao === "pendente") grupo.pendentes++;
  }
  return Array.from(grupos.values()).sort((a, b) => b.id.localeCompare(a.id));
}
