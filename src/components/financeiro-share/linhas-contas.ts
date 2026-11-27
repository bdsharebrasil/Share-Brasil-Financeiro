import type { ContaAPagar, ContaAReceber, Lancamento } from "./tipos";
import type { MovimentoHoldingPendente } from "@/lib/financeiro-share-api";

export type FluxoLinha =
  | "ESTORNO"
  | "RECEITA"
  | "DESPESA"
  | "SAIDA REEMBOLSO"
  | "ENTRADA REEMBOLSO"
  | "SAIDA"
  | "ENTRADA";
export type SituacaoLinha = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";

export type LinhaConta = {
  id: string;
  documento: string | null;
  fluxo: FluxoLinha;
  natureza: string;
  caixa: "SHARE" | "CLIENTE" | "HOLDING";
  descricao: string;
  categoria: string;
  favorecido: string;
  favorecidoPessoa: string | null;
  fornecedor: string | null;
  contaBancaria: string;
  aeronaveId: string | null;
  aeronave: string | null;
  dataLancamento: string;
  dataVencimento: string | null;
  periodicidade: string | null;
  situacao: SituacaoLinha;
  statusOriginal: string;
  valor: number;
  raw: ContaAPagar | ContaAReceber;
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const FLUXOS = new Set<FluxoLinha>([
  "ESTORNO", "RECEITA", "DESPESA", "SAIDA REEMBOLSO",
  "ENTRADA REEMBOLSO", "SAIDA", "ENTRADA",
]);

function statusOriginal(conta: ContaAPagar | ContaAReceber): string {
  const status = (conta as unknown as Record<string, unknown>).status;
  return String(status ?? "EM_ABERTO").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function fluxoDaConta(conta: ContaAPagar | ContaAReceber, fallback: FluxoLinha): FluxoLinha {
  const dados = conta as unknown as Record<string, unknown>;
  const fluxo = [dados.fluxo, dados.tipo_fluxo, dados.natureza]
    .find((valor): valor is string => typeof valor === "string" && Boolean(valor.trim()));
  const normalizado = fluxo?.trim().toUpperCase().replace(/_/g, " ") as FluxoLinha | undefined;
  return normalizado && FLUXOS.has(normalizado) ? normalizado : fallback;
}

function situacaoDaConta(status: string, vencimento: string | null): SituacaoLinha {
  if (status === "CANCELADO") return "CANCELADO";
  if (["PAGO", "RECEBIDO", "REEMBOLSADO"].includes(status)) return "PAGO";
  if (["ATRASADO", "EM_ATRASO"].includes(status)) return "ATRASADO";
  if (vencimento && vencimento.slice(0, 10) < hojeISO()) return "ATRASADO";
  return "PENDENTE";
}

export function linhasDeContasAPagar(contas: ContaAPagar[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: fluxoDaConta(c, "SAIDA"),
    natureza: "DESPESA",
    caixa: "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.fornecedor || "—",
    favorecidoPessoa: c.cotistaNome || c.cotista || null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoPagamento || c.contaBancariaId || "—",
    aeronaveId: c.aeronaveId || null,
    aeronave: c.aeronaveMatricula || null,
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    periodicidade: c.periodicidade ?? null,
    situacao: situacaoDaConta(statusOriginal(c), c.dataVencimento),
    statusOriginal: statusOriginal(c),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}

export function linhasDeLancamentosHolding(lancamentos: Lancamento[], movimentos: MovimentoHoldingPendente[] = []): LinhaConta[] {
  const linhasLancamentos: LinhaConta[] = lancamentos.map((l): LinhaConta => {
    const status = String(l.status ?? "EM_ABERTO").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const entrada = l.fluxo === "ENTRADA";
    const raw = {
      ...l,
      lancamentoId: l.id,
      fonteLancamento: true,
      valor: l.valorCentavos / 100,
      dataEmissao: l.data,
      dataVencimento: l.prazo ?? l.data,
      categoriaNome: l.categoria,
    } as unknown as ContaAPagar;
    return {
      id: l.id,
      documento: l.documento || l.numeroDoc || null,
      fluxo: (entrada ? "ENTRADA" : "SAIDA") as FluxoLinha,
      natureza: entrada ? "RECEITA" : "DESPESA",
      caixa: "HOLDING" as const,
      descricao: l.descricao || "—",
      categoria: l.categoria || "—",
      favorecido: l.cotistaNome || l.cotista || l.fornecedor || "—",
      favorecidoPessoa: l.cotistaNome || l.cotista || null,
      fornecedor: l.fornecedorId ? l.fornecedor : null,
      contaBancaria: l.contaBancaria || l.contaBancariaId || "—",
      aeronaveId: l.aeronaveId || null,
      aeronave: null,
      dataLancamento: l.data || l.criadoEm || "",
      dataVencimento: l.prazo || null,
      periodicidade: l.periodicidade ?? null,
      situacao: situacaoDaConta(status, l.prazo || null),
      statusOriginal: status,
      valor: l.valorCentavos / 100,
      raw,
    };
  });
  const idsExistentes = new Set(lancamentos.map((lancamento) => lancamento.id));
  return [...linhasLancamentos, ...linhasDeMovimentosHolding(movimentos.filter((movimento) => !idsExistentes.has(movimento.id)))];
}

export function linhasDeMovimentosHolding(movimentos: MovimentoHoldingPendente[], caixa: "HOLDING" | "SHARE" = "HOLDING"): LinhaConta[] {
  return movimentos.map((movimento) => {
    const fluxo = String(movimento.fluxo ?? "SAIDA").trim().toUpperCase() === "ENTRADA" ? "ENTRADA" : "SAIDA";
    const status = String(movimento.status ?? "EM_ABERTO").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const raw = {
      ...movimento,
      id: movimento.id,
      lancamentoId: movimento.id,
      movimentoHoldingId: movimento.id,
      holdingId: movimento.holding_id,
      tipoCaixa: "HOLDING",
      fluxo,
      fonteLancamento: false,
      valor: Number(movimento.valor_centavos ?? 0) / 100,
      dataEmissao: movimento.data_emissao,
      dataVencimento: movimento.data_vencimento,
      categoriaNome: movimento.categoria_nome,
      fornecedor: movimento.fornecedor_nome,
      fornecedorId: movimento.fornecedor_id ?? null,
      contaBancariaId: movimento.conta_bancaria_id ?? null,
      bancoPagamento: movimento.conta_bancaria_nome ?? null,
      comprovantePagamentoUrl: movimento.comprovante_url ?? null,
      status,
    } as unknown as ContaAPagar;
    return {
      id: `holding:${movimento.id}`,
      documento: null,
      fluxo,
      natureza: fluxo === "ENTRADA" ? "RECEITA" : "DESPESA",
      caixa,
      descricao: movimento.descricao || "—",
      categoria: movimento.categoria_nome || "—",
      favorecido: movimento.holding_nome || movimento.socio_nome || movimento.fornecedor_nome || "—",
      favorecidoPessoa: movimento.socio_nome || null,
      fornecedor: movimento.fornecedor_nome || null,
      contaBancaria: movimento.conta_bancaria_nome || movimento.conta_bancaria_id || "—",
      aeronaveId: movimento.aeronave_id || null,
      aeronave: movimento.aeronave || null,
      dataLancamento: movimento.data_emissao || movimento.criado_em || "",
      dataVencimento: movimento.data_vencimento || null,
      periodicidade: movimento.periodicidade ?? null,
      situacao: situacaoDaConta(status, movimento.data_vencimento || null),
      statusOriginal: status,
      valor: Number(movimento.valor_centavos || 0) / 100,
      raw,
    };
  });
}

export function linhasDeContasAReceber(contas: ContaAReceber[]): LinhaConta[] {
  return contas.map((c) => ({
    id: c.id,
    documento: c.documento || null,
    fluxo: fluxoDaConta(c, "ENTRADA"),
    natureza: "RECEITA",
    caixa: c.cotistaId ? "CLIENTE" : "SHARE",
    descricao: c.descricao || "—",
    categoria: c.categoriaNome || "—",
    favorecido: c.cotistaNome || c.cotista || c.fornecedor || "—",
    favorecidoPessoa: c.cotistaNome || c.cotista || null,
    fornecedor: c.fornecedorId ? c.fornecedor : null,
    contaBancaria: c.bancoRecebimento || c.contaBancariaId || "—",
    aeronaveId: c.aeronaveId || null,
    aeronave: c.aeronaveMatricula || null,
    dataLancamento: c.dataEmissao || c.criadoEm || "",
    dataVencimento: c.dataVencimento || null,
    periodicidade: c.periodicidade ?? null,
    situacao: situacaoDaConta(statusOriginal(c), c.dataVencimento),
    statusOriginal: statusOriginal(c),
    valor: Number(c.valor || 0),
    raw: c,
  }));
}
