import { useCallback, useEffect, useState } from "react";
import { buscarCaixaEmpresa, buscarContasAPagar, buscarContasAReceber, buscarSolicitacoesCompraFinanceiras, type SolicitacaoCompraFinanceira } from "@/lib/financeiro-share-api";
import { buscarEnviosPagamento, type EnvioPagamento } from "@/lib/colaborador-api";
import type { ContaAPagar, ContaAReceber, Lancamento } from "@/components/financeiro-share/tipos";

export type FluxoUnificado = "ENTRADA" | "SAIDA";
export type SituacaoUnificada = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";
export type OrigemUnificada = "lancamentos" | "contas_apagar" | "contas_areceber" | "solicitacoes_pagamento" | "solicitacoes_compra";
export type LancamentoUnificado = {
  id: string; codigo: string; fluxo: FluxoUnificado; natureza: string; caixa: "SHARE" | "CLIENTE";
  descricao: string; categoria: string; favorecido: string; contaBancaria: string; dataLancamento: string;
  dataVencimento: string | null; dataPagamento: string | null; situacao: SituacaoUnificada; valor: number;
  reembolsavel: boolean; cotistaId: string | null; origem: OrigemUnificada; origemId: string;
  lancamentoId: string | null; documentoUrl: string | null; raw: Lancamento | ContaAPagar | ContaAReceber;
};
const dataHoje = () => new Date().toISOString().slice(0, 10);
function situacao(status: string | null | undefined, vencimento: string | null | undefined): SituacaoUnificada {
  const s = String(status || "").toUpperCase();
  if (["CANCELADO", "CANCELADA"].includes(s)) return "CANCELADO";
  if (["PAGO", "RECEBIDO", "CONCILIADO"].includes(s)) return "PAGO";
  if (vencimento && vencimento.slice(0, 10) < dataHoje()) return "ATRASADO";
  return "PENDENTE";
}
export function normalizarFontesFinanceiras(lancamentos: Lancamento[], pagar: ContaAPagar[], receber: ContaAReceber[], solicitacoes: EnvioPagamento[] = [], compras: SolicitacaoCompraFinanceira[] = []): LancamentoUnificado[] {
  const linhas: LancamentoUnificado[] = [];
  const idsRelacionados = new Set<string>();
  for (const item of pagar) if (item.lancamentoId) idsRelacionados.add(item.lancamentoId);
  for (const item of receber) if (item.lancamentoId) idsRelacionados.add(item.lancamentoId);
  for (const item of solicitacoes) if (item.lancamento_id) idsRelacionados.add(item.lancamento_id);
  for (const item of compras) if (item.lancamento_id) idsRelacionados.add(item.lancamento_id);
  for (const l of lancamentos) {
    if (idsRelacionados.has(l.id)) continue;
    linhas.push({ id: l.id, codigo: l.id.slice(-8).toUpperCase(), fluxo: l.fluxo, natureza: l.grupoCategoria || l.tipo || l.categoria,
      caixa: l.caixa === "CLIENTE" ? "CLIENTE" : "SHARE", descricao: l.descricao || "—", categoria: l.categoria || "—",
      favorecido: l.fornecedor || l.pagoPor || "—", contaBancaria: "—", dataLancamento: l.data,
      dataVencimento: l.prazo || null, dataPagamento: ["PAGO", "RECEBIDO"].includes(l.status) ? l.data : null,
      situacao: situacao(l.status, l.prazo), valor: l.valorCentavos / 100, reembolsavel: l.reembolsavel,
      cotistaId: l.cotistaId, origem: "lancamentos", origemId: l.id, lancamentoId: l.id,
      documentoUrl: l.documentoUrl || l.anexos?.[0]?.url || null, raw: l });
  }
  for (const c of pagar) {
    linhas.push({ id: `pagar:${c.id}`, codigo: c.id.slice(-8).toUpperCase(), fluxo: "SAIDA", natureza: "DESPESA",
      caixa: "SHARE", descricao: c.descricao || "—", categoria: c.categoriaNome || "—", favorecido: c.fornecedor || "—",
      contaBancaria: c.bancoPagamento || "—", dataLancamento: c.dataEmissao || c.criadoEm || "",
      dataVencimento: c.dataVencimento || null, dataPagamento: c.dataPagamento || null,
      situacao: situacao(c.status, c.dataVencimento), valor: Number(c.valor || 0), reembolsavel: false,
      cotistaId: c.cotistaId || null, origem: "contas_apagar", origemId: c.id, lancamentoId: c.lancamentoId || null,
      documentoUrl: c.comprovantePagamentoUrl || c.boletoUrl || c.nfUrl || c.documentoUrl || null, raw: c });
  }
  for (const c of receber) {
    linhas.push({ id: `receber:${c.id}`, codigo: c.id.slice(-8).toUpperCase(), fluxo: "ENTRADA", natureza: "RECEITA",
      caixa: c.cotistaId ? "CLIENTE" : "SHARE", descricao: c.descricao || "—", categoria: c.categoriaNome || "—",
      favorecido: c.cotistaNome || c.cotista || c.fornecedor || "—", contaBancaria: c.bancoRecebimento || "—",
      dataLancamento: c.dataEmissao || c.criadoEm || "", dataVencimento: c.dataVencimento || null,
      dataPagamento: c.dataRecebimento || null, situacao: situacao(c.status, c.dataVencimento), valor: Number(c.valor || 0),
      reembolsavel: false, cotistaId: c.cotistaId || null, origem: "contas_areceber", origemId: c.id,
      lancamentoId: c.lancamentoId || null, documentoUrl: c.comprovanteRecebimentoUrl || c.boletoUrl || c.nfUrl || c.documentoUrl || null, raw: c });
  }
  for (const s of solicitacoes) {
    if (s.lancamento_id) continue;
    const estado = String(s.status || "").toUpperCase();
    if (["CANCELADO", "CANCELADA", "REJEITADO", "REJEITADA", "CONCLUIDO", "CONCLUÍDO"].includes(estado)) continue;
    const vencimento = s.data_vencimento || s.vencimento || null;
    linhas.push({ id: `solicitacao:${s.id}`, codigo: s.id.slice(-8).toUpperCase(), fluxo: "SAIDA",
      natureza: "SOLICITAÇÃO DE PAGAMENTO", caixa: s.tipo === "cliente" ? "CLIENTE" : "SHARE",
      descricao: s.descricao || "Solicitação de pagamento", categoria: s.categoria_nome || "—",
      favorecido: s.fornecedor || "—", contaBancaria: "—", dataLancamento: s.data_despesa || s.criado_em || "",
      dataVencimento: vencimento, dataPagamento: null, situacao: situacao(estado, vencimento),
      valor: Number(s.valor ?? Number(s.valor_centavos || 0) / 100), reembolsavel: s.tipo === "reembolso",
      cotistaId: s.cotista_aeronave_id || s.socio_id || null, origem: "solicitacoes_pagamento", origemId: s.id,
      lancamentoId: s.lancamento_id || null, documentoUrl: null, raw: s as unknown as Lancamento });
  }
  for (const c of compras) {
    if (c.envio_id || c.lancamento_id) continue;
    const estado = String(c.status || "").toUpperCase();
    if (["CONCLUIDA", "CONCLUIDO", "REJEITADA", "CANCELADA", "CANCELADO"].includes(estado)) continue;
    linhas.push({ id: `compra:${c.id}`, codigo: c.numero_solicitacao || c.id.slice(-8).toUpperCase(), fluxo: "SAIDA",
      natureza: "SOLICITAÇÃO DE COMPRA", caixa: c.tipo_caixa === "CLIENTE" ? "CLIENTE" : "SHARE",
      descricao: c.descricao || "Solicitação de compra", categoria: "Solicitada para aprovação",
      favorecido: c.solicitante_nome || "—", contaBancaria: "—", dataLancamento: c.data_solicitacao || "",
      dataVencimento: c.data_necessaria || c.vencimento || null, dataPagamento: null,
      situacao: situacao(estado === "APROVADA" ? "PENDENTE" : estado, c.data_necessaria || c.vencimento),
      valor: Number(c.valor || 0), reembolsavel: false, cotistaId: null, origem: "solicitacoes_compra",
      origemId: c.id, lancamentoId: null, documentoUrl: null, raw: c as unknown as Lancamento });
  }
  return linhas.sort((a, b) => (b.dataLancamento || "").localeCompare(a.dataLancamento || ""));
}
export function useLancamentosUnificados() {
  const [lancamentos, setLancamentos] = useState<LancamentoUnificado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const [caixaShare, caixaCliente, pagar, receber, solicitacoes, compras] = await Promise.all([buscarCaixaEmpresa({ caixa: "SHARE" }), buscarCaixaEmpresa({ caixa: "CLIENTE" }), buscarContasAPagar(), buscarContasAReceber(), buscarEnviosPagamento(), buscarSolicitacoesCompraFinanceiras()]);
      setLancamentos(normalizarFontesFinanceiras([...caixaShare, ...caixaCliente], pagar, receber, solicitacoes.envios || [], compras));
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar os lançamentos."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void recarregar(); }, [recarregar]);
  return { lancamentos, carregando, erro, recarregar };
}
