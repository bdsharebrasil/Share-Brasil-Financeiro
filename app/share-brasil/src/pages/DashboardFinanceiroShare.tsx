import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, CircleAlert, Landmark, Plus, Receipt, RefreshCw, Users, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CabecalhoSecao, CartaoKpi, EstadoVazio, EtiquetaStatus, HeroDashboard } from "@/components/dashboard/PrimitivosDashboard";
import { buscarLancamentosShare, buscarOpcoesFinanceiroShare, criarLancamentoShare, formatarMoeda, formatarData, type CategoriaCaixaShare, type LancamentoShare, type ResumoShare } from "@/lib/financeiro-share-api";

type Aba = "todos" | "contas" | "colaboradores" | "reembolsos";
type Formulario = { descricao: string; tipo: string; valor_total: string; data_emissao: string; data_vencimento: string; categoria_id: string; categoria_nome: string; grupo_categoria: string; fluxo: string; status: string; forma_pagamento: string; conta_bancaria: string; fornecedor_nome: string; observacoes: string };

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial: Formulario = { descricao: "", tipo: "CONTA", valor_total: "", data_emissao: hoje(), data_vencimento: "", categoria_id: "", categoria_nome: "", grupo_categoria: "DESPESAS EMPRESA", fluxo: "SAIDA", status: "pendente", forma_pagamento: "", conta_bancaria: "", fornecedor_nome: "", observacoes: "" };

function valorReais(valor: string) {
  const limpo = valor.trim();
  if (!limpo) return 0;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo) || 0;
}

function grupoDoItem(item: LancamentoShare) {
  const natureza = (item.tipo || "").toLowerCase();
  if (natureza.includes("reembols")) return "reembolsos";
  if (natureza.includes("colaborador") || natureza.includes("folha")) return "colaboradores";
  const texto = `${item.grupo_categoria || ""} ${item.categoria_nome || ""} ${item.descricao} ${item.fornecedor_nome || ""}`.toLowerCase();
  if (texto.includes("reembols")) return "reembolsos";
  if (texto.includes("folha") || texto.includes("funcion") || texto.includes("salário") || texto.includes("salario")) return "colaboradores";
  return "contas";
}

function statusFinanceiro(status: string | null) {
  const normalizado = (status || "pendente").toLowerCase();
  if (["pago", "quitado", "conciliado", "aprovado"].includes(normalizado)) return { label: "Pago", tone: "green" as const };
  if (["cancelado", "reprovado"].includes(normalizado)) return { label: "Cancelado", tone: "red" as const };
  return { label: "Pendente", tone: "amber" as const };
}

function CategoriaBarra({ nome, valor, total, cor }: { nome: string; valor: number; total: number; cor: string }) {
  const largura = total > 0 ? Math.max(8, Math.min(100, (valor / total) * 100)) : 8;
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="truncate font-semibold">{nome}</span><span className="shrink-0 font-mono">{formatarMoeda(valor)}</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} /></div></div>;
}

export default function DashboardFinanceiroShare() {
  const [lancamentos, setLancamentos] = useState<LancamentoShare[]>([]);
  const [resumo, setResumo] = useState<ResumoShare | null>(null);
  const [grupos, setGrupos] = useState<Array<{ grupo: string; valor: number }>>([]);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contas, setContas] = useState<Array<{ id: string; banco: string; numero_conta: string | null; tipo_conta: string | null }>>([]);
  const [inicio, setInicio] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
  const [fim, setFim] = useState(hoje);
  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(inicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const [resposta, opcoes] = await Promise.all([buscarLancamentosShare({ inicio, fim, busca: busca || undefined }), buscarOpcoesFinanceiroShare()]);
      setLancamentos(resposta.lancamentos || []);
      setResumo(resposta.resumo || null);
      setGrupos(resposta.grupos || []);
      setCategorias(opcoes.categorias || []);
      setContas(opcoes.contas_bancarias || []);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar o caixa Share.");
    } finally {
      setCarregando(false);
    }
  }, [busca, inicio]);

  useEffect(() => { void carregar(); }, [carregar]);

  const visiveis = useMemo(() => lancamentos.filter((item) => aba === "todos" || grupoDoItem(item) === aba).sort((a, b) => `${b.data_pagamento || b.data_emissao || ""}`.localeCompare(`${a.data_pagamento || a.data_emissao || ""}`)), [aba, lancamentos]);
  const pendentes = lancamentos.filter((item) => !["pago", "quitado", "conciliado", "cancelado"].includes((item.status || "pendente").toLowerCase()));
  const folha = lancamentos.filter((item) => grupoDoItem(item) === "colaboradores");
  const reembolsos = lancamentos.filter((item) => grupoDoItem(item) === "reembolsos");
  const totalGrupos = grupos.reduce((total, item) => total + item.valor, 0) || 1;
  const alterar = (campo: keyof Formulario, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const escolherCategoria = (id: string) => { const categoria = categorias.find((item) => item.id === id); setForm((atual) => ({ ...atual, categoria_id: id, categoria_nome: categoria?.nome || "", grupo_categoria: categoria?.grupo || atual.grupo_categoria })); };

  const salvar = async () => {
    if (!form.descricao.trim() || valorReais(form.valor_total) <= 0 || !form.categoria_id) { setErro("Informe descrição, valor e categoria para registrar o movimento."); return; }
    setSalvando(true); setErro(null);
    try {
      await criarLancamentoShare({ ...form, valor_total: valorReais(form.valor_total), tipo_caixa: "share", cotista_id: null });
      setNovoAberto(false); setForm({ ...inicial, data_emissao: hoje() }); await carregar(true);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível registrar o movimento."); } finally { setSalvando(false); }
  };

  return <div className="route-enter">
    <HeroDashboard ambiente="gestor" title="Financeiro Share" subtitle="Caixa corporativo, contas, folha e reembolsos de colaboradores">
      <Button type="button" onClick={() => { setErro(null); setNovoAberto(true); }} className="h-10 gap-2 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"><Plus size={15} /> Novo movimento</Button>
    </HeroDashboard>

    {erro && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]"><span>{erro}</span><Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 border-[#e77b80]/40 bg-transparent text-[10px] text-[#ed8c90]">Tentar novamente</Button></div>}

    <section className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 p-3"><span className="mr-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Período do caixa</span><Input type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} className="h-9 w-[145px] text-xs" /><span className="text-xs text-muted-foreground">até</span><Input type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} className="h-9 w-[145px] text-xs" /><Button type="button" variant="outline" onClick={() => void carregar(true)} className="h-9 gap-2 text-[10px]"><RefreshCw size={13} /> Atualizar</Button></section>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CartaoKpi label="Saldo do caixa" value={carregando ? "—" : formatarMoeda(resumo?.saldo)} detail="Entradas menos saídas Share" tone={Number(resumo?.saldo || 0) >= 0 ? "green" : "red"} icon={<WalletCards size={16} />} />
      <CartaoKpi label="Contas a pagar" value={carregando ? "—" : formatarMoeda(resumo?.valor_pendente)} detail={`${resumo?.pendentes || 0} pendência(s)`} tone="amber" icon={<Receipt size={16} />} />
      <CartaoKpi label="Folha e colaboradores" value={carregando ? "—" : formatarMoeda(folha.reduce((total, item) => total + Number(item.valor_total || 0), 0))} detail={`${folha.length} registro(s)`} tone="violet" icon={<Users size={16} />} />
      <CartaoKpi label="Reembolsos" value={carregando ? "—" : formatarMoeda(reembolsos.reduce((total, item) => total + Number(item.valor_total || 0), 0))} detail={`${reembolsos.length} registro(s)`} tone="blue" icon={<ArrowDownRight size={16} />} />
      <CartaoKpi label="Movimentos" value={carregando ? "—" : String(resumo?.total_lancamentos || 0)} detail="Registros no período" tone="green" icon={<Landmark size={16} />} />
    </div>

    <div className="mb-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Building2 size={15} />} title="Distribuição do caixa" detail="Saídas Share por grupo de categoria" />{grupos.length ? <div className="space-y-4 p-5">{grupos.slice(0, 6).map((item, index) => <CategoriaBarra key={item.grupo} nome={item.grupo} valor={item.valor} total={totalGrupos} cor={index === 0 ? "bg-primary" : index === 1 ? "bg-violet-400" : "bg-amber-400"} />)}</div> : <EstadoVazio label="Nenhuma saída categorizada" />}</section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<CircleAlert size={15} />} title="Acompanhamento operacional" detail="Itens que exigem ação do financeiro" /><div className="grid gap-3 p-5 sm:grid-cols-3"><div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-[10px] text-muted-foreground">Pendentes</p><p className="mt-1 font-mono text-lg font-bold text-amber-300">{pendentes.length}</p><p className="mt-1 text-[9px] text-muted-foreground">contas aguardando baixa</p></div><div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-[10px] text-muted-foreground">Contas bancárias</p><p className="mt-1 font-mono text-lg font-bold">{contas.length}</p><p className="mt-1 text-[9px] text-muted-foreground">disponíveis para registro</p></div><div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-[10px] text-muted-foreground">Saídas</p><p className="mt-1 font-mono text-lg font-bold text-red-300">{formatarMoeda(resumo?.saidas)}</p><p className="mt-1 text-[9px] text-muted-foreground">no período selecionado</p></div></div></section></div>

    <section className="overflow-hidden rounded-xl border border-border bg-card/75"><CabecalhoSecao icon={<Landmark size={15} />} title="Caixa Share" detail="Contas corporativas, colaboradores e reembolsos — sem lançamentos de cotista" action={<div className="flex flex-wrap items-center justify-end gap-2"><div className="flex rounded-lg border border-border p-0.5">{(["todos", "contas", "colaboradores", "reembolsos"] as Aba[]).map((item) => <button key={item} type="button" onClick={() => setAba(item)} className={`rounded-md px-2 py-1.5 text-[9px] font-bold capitalize transition-colors ${aba === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{item === "todos" ? "Todos" : item}</button>)}</div><Input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar no caixa" className="h-8 w-[155px] text-[10px]" /></div>} />{carregando ? <div className="space-y-3 p-5"><div className="skeleton h-11 rounded-lg" /><div className="skeleton h-11 rounded-lg" /></div> : visiveis.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Grupo</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Fluxo</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{visiveis.map((item) => { const status = statusFinanceiro(item.status); const entrada = (item.fluxo || "").toLowerCase() === "entrada"; return <tr key={item.id} className="border-b border-border/50 last:border-0"><td className="max-w-[280px] px-4 py-3"><p className="truncate text-xs font-bold">{item.descricao}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{item.fornecedor_nome || item.numero_doc || "Sem favorecido informado"}</p></td><td className="px-4 py-3"><p className="text-[10px] font-semibold">{item.grupo_categoria || item.categoria_nome || "Sem grupo"}</p><p className="mt-1 text-[9px] text-muted-foreground">{grupoDoItem(item)}</p></td><td className="px-4 py-3 text-[10px] text-muted-foreground">{formatarData(item.data_pagamento || item.data_emissao || item.data_vencimento)}</td><td className={`px-4 py-3 text-[10px] font-bold ${entrada ? "text-emerald-400" : "text-amber-300"}`}>{entrada ? <span className="inline-flex items-center gap-1"><ArrowDownRight size={12} /> Entrada</span> : <span className="inline-flex items-center gap-1"><ArrowUpRight size={12} /> Saída</span>}</td><td className="px-4 py-3 text-right font-mono text-xs font-bold">{formatarMoeda(Number(item.valor_pago_real ?? item.valor_total ?? 0))}</td><td className="px-4 py-3"><EtiquetaStatus tone={status.tone}>{status.label}</EtiquetaStatus></td></tr>; })}</tbody></table></div> : <EstadoVazio label="Nenhum movimento encontrado no filtro atual" />}</section>

    {novoAberto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-sm font-bold">Novo movimento do caixa Share</p><p className="mt-1 text-[10px] text-muted-foreground">Contas, folha, reembolso de colaborador ou entrada corporativa.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setNovoAberto(false)}><X size={16} /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Descrição *</Label><Input value={form.descricao} onChange={(evento) => alterar("descricao", evento.target.value)} placeholder="Ex.: pagamento de fornecedor, folha ou reembolso" /></div><div className="space-y-1.5"><Label className="text-[10px]">Natureza *</Label><Select value={form.tipo} onValueChange={(valor) => alterar("tipo", valor)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONTA">Conta corporativa</SelectItem><SelectItem value="COLABORADOR">Funcionário / folha</SelectItem><SelectItem value="REEMBOLSO">Reembolso de colaborador</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px]">Valor (R$) *</Label><Input value={form.valor_total} onChange={(evento) => alterar("valor_total", evento.target.value)} placeholder="0,00" inputMode="decimal" /></div><div className="space-y-1.5"><Label className="text-[10px]">Fluxo</Label><Select value={form.fluxo} onValueChange={(valor) => alterar("fluxo", valor)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="saida">Saída</SelectItem><SelectItem value="entrada">Entrada</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px]">Categoria *</Label><Select value={form.categoria_id} onValueChange={escolherCategoria}><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent>{categorias.map((categoria) => <SelectItem key={categoria.id} value={categoria.id}>{categoria.grupo ? `${categoria.grupo} · ` : ""}{categoria.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px]">Favorecido / fornecedor</Label><Input value={form.fornecedor_nome} onChange={(evento) => alterar("fornecedor_nome", evento.target.value)} placeholder="Pessoa, empresa ou órgão" /></div><div className="space-y-1.5"><Label className="text-[10px]">Data de emissão</Label><Input type="date" value={form.data_emissao} onChange={(evento) => alterar("data_emissao", evento.target.value)} /></div><div className="space-y-1.5"><Label className="text-[10px]">Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={(evento) => alterar("data_vencimento", evento.target.value)} /></div><div className="space-y-1.5"><Label className="text-[10px]">Conta bancária</Label><Select value={form.conta_bancaria} onValueChange={(valor) => alterar("conta_bancaria", valor)}><SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger><SelectContent>{contas.map((conta) => <SelectItem key={conta.id} value={conta.id}>{conta.banco}{conta.numero_conta ? ` · ${conta.numero_conta}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5 sm:col-span-2"><Label className="text-[10px]">Observações</Label><Input value={form.observacoes} onChange={(evento) => alterar("observacoes", evento.target.value)} placeholder="Informações para conferência" /></div></div><div className="flex justify-end gap-2 border-t border-border p-5"><Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>Cancelar</Button><Button type="button" disabled={salvando} onClick={() => void salvar()} className="gap-2">{salvando ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Registrar movimento</Button></div></div></div>}
  </div>;
}
