import { useMemo, useState } from "react";
import { CirclePlus, ChevronLeft, ChevronRight, Download, Filter, Loader2, Printer, RefreshCw, Search, ArrowUpDown, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarMoeda, formatarData } from "@/lib/financeiro-share-api";
import { useLancamentosUnificados, type FluxoUnificado, type SituacaoUnificada } from "@/hooks/useLancamentosUnificados";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";
import { buscarOpcoesFinanceiroShare, cancelarLancamentoUnificado, type CategoriaCaixaShare } from "@/lib/financeiro-share-api";
import { useEffect } from "react";

export function LancamentosUnificados({ fluxo, filtroInicial }: { fluxo?: FluxoUnificado; filtroInicial?: { situacao?: SituacaoUnificada; inicio?: string; fim?: string } }) {
  const { lancamentos, carregando, erro, recarregar } = useLancamentosUnificados();
  const [busca, setBusca] = useState("");
  const [situacaoFiltro, setSituacaoFiltro] = useState(filtroInicial?.situacao || "TODAS");
  const [caixaFiltro, setCaixaFiltro] = useState("TODOS");
  const [naturezaFiltro, setNaturezaFiltro] = useState("TODAS");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordenacao, setOrdenacao] = useState<{ chave: "codigo" | "descricao" | "favorecido" | "caixa" | "data" | "situacao" | "valor"; crescente: boolean }>({ chave: "data", crescente: false });
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  useEffect(() => { void buscarOpcoesFinanceiroShare().then((o) => setCategorias(o.categorias)).catch(() => setCategorias([])); }, []);
  const titulo = fluxo === "ENTRADA" ? "Registrar entrada" : fluxo === "SAIDA" ? "Registrar saída" : "Lançamentos financeiros";
  const filtrados = useMemo(() => lancamentos.filter((l) => {
    if (fluxo && l.fluxo !== fluxo) return false;
    if (filtroInicial?.inicio && (l.dataVencimento || "") < filtroInicial.inicio) return false;
    if (filtroInicial?.fim && (l.dataVencimento || "") > filtroInicial.fim) return false;
    if (!filtroInicial?.inicio && !filtroInicial?.fim && mes && (l.dataLancamento || "").slice(0, 7) !== mes) return false;
    if (situacaoFiltro !== "TODAS" && l.situacao !== situacaoFiltro) return false;
    if (caixaFiltro !== "TODOS" && l.caixa !== caixaFiltro) return false;
    if (naturezaFiltro !== "TODAS" && l.natureza !== naturezaFiltro) return false;
    const texto = `${l.codigo} ${l.descricao} ${l.categoria} ${l.favorecido} ${l.natureza}`.toLocaleLowerCase("pt-BR");
    return texto.includes(busca.toLocaleLowerCase("pt-BR"));
  }).sort((a, b) => {
    const valor = ordenacao.chave === "codigo" ? a.codigo.localeCompare(b.codigo)
      : ordenacao.chave === "descricao" ? a.descricao.localeCompare(b.descricao, "pt-BR")
      : ordenacao.chave === "favorecido" ? a.favorecido.localeCompare(b.favorecido, "pt-BR")
      : ordenacao.chave === "caixa" ? a.caixa.localeCompare(b.caixa)
      : ordenacao.chave === "situacao" ? a.situacao.localeCompare(b.situacao)
      : ordenacao.chave === "valor" ? a.valor - b.valor
      : a.dataLancamento.localeCompare(b.dataLancamento);
    return ordenacao.crescente ? valor : -valor;
  }), [lancamentos, fluxo, mes, situacaoFiltro, caixaFiltro, naturezaFiltro, busca, filtroInicial, ordenacao]);
  const total = filtrados.reduce((s, l) => s + l.valor, 0);
  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const linhas = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);
  const mudarMes = (delta: number) => { const d = new Date(`${mes}-01T12:00:00`); d.setMonth(d.getMonth() + delta); setMes(d.toISOString().slice(0, 7)); setPagina(1); };
  const exportar = () => {
    const csv = ["Código;Descrição;Categoria;Favorecido;Conta;Data;Situação;Valor", ...filtrados.map((l) => [l.codigo,l.descricao,l.categoria,l.favorecido,l.contaBancaria,l.dataLancamento,l.situacao,l.valor.toFixed(2)].map((v) => `"${String(v).replace(/"/g,'""')}"`).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `lancamentos-${mes}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const cancelar = async (id: string) => {
    if (!window.confirm("Cancelar este lançamento? O histórico financeiro será preservado.")) return;
    try {
      await cancelarLancamentoUnificado(id);
      toast.success("Lançamento cancelado.");
      await recarregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o lançamento.");
    }
  };
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · {fluxo || "entradas e saídas"}</p><h2 className="mt-1 text-xl font-extrabold">{titulo}</h2><p className="mt-1 text-xs text-muted-foreground">Lista única, sem separar caixa de contas a pagar ou a receber.</p></div>
      <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo listado · {filtrados.length} itens</p><strong className="font-mono text-xl">{formatarMoeda(total)}</strong></div>
    </header>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setNovo(true)} className="gap-2"><CirclePlus size={15}/>{fluxo === "ENTRADA" ? "Registrar entrada" : fluxo === "SAIDA" ? "Registrar saída" : "Novo lançamento"}</Button>
      <Button variant="outline" onClick={() => void recarregar()} className="gap-2"><RefreshCw size={14}/> Atualizar</Button>
      <Button variant="outline" onClick={exportar} className="gap-2"><Download size={14}/> Imprimir relatório</Button>
      <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer size={14}/> Imprimir</Button>
      <span className="ml-auto flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={15}/></Button><Input aria-label="Competência" type="month" value={mes} onChange={(e) => {setMes(e.target.value);setPagina(1);}} className="w-40"/><Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={15}/></Button></span>
    </div>
    <div className="grid gap-2 rounded-xl border border-border bg-card/60 p-3 md:grid-cols-4">
      <label className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar lançamento" value={busca} onChange={(e) => {setBusca(e.target.value);setPagina(1);}}/></label>
      <Select value={situacaoFiltro} onValueChange={(v) => {setSituacaoFiltro(v);setPagina(1);}}><SelectTrigger><Filter size={14}/><SelectValue placeholder="Situação"/></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as situações</SelectItem><SelectItem value="PENDENTE">Pendente</SelectItem><SelectItem value="ATRASADO">Atrasado</SelectItem><SelectItem value="PAGO">Pago</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={caixaFiltro} onValueChange={setCaixaFiltro}><SelectTrigger><SelectValue placeholder="Caixa"/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os caixas</SelectItem><SelectItem value="SHARE">Share</SelectItem><SelectItem value="CLIENTE">Cliente</SelectItem></SelectContent></Select>
      <Select value={naturezaFiltro} onValueChange={setNaturezaFiltro}><SelectTrigger><SelectValue placeholder="Natureza"/></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as naturezas</SelectItem>{[...new Set(lancamentos.map((l) => l.natureza).filter(Boolean))].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select>
    </div>
    {erro && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
      <table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{([{ label: "Cód.", key: "codigo" },{ label: "Descrição / categoria", key: "descricao" },{ label: "Favorecido", key: "favorecido" },{ label: "Caixa", key: "caixa" },{ label: "Data / vencimento", key: "data" },{ label: "Situação", key: "situacao" },{ label: "Valor", key: "valor" }] as const).map(({label,key}) => <th key={label} className="px-4 py-3"><button type="button" className="inline-flex items-center gap-1" onClick={() => setOrdenacao((atual) => ({ chave: key, crescente: atual.chave === key ? !atual.crescente : true }))}>{label}<ArrowUpDown size={11}/></button></th>)}<th className="px-4 py-3">Ações</th></tr></thead>
        <tbody>{carregando ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline animate-spin" size={16}/>Carregando lançamentos…</td></tr> : linhas.length ? linhas.map((l) => <tr key={`${l.origem}:${l.id}`} className="border-b border-border/60 hover:bg-muted/20"><td className="px-4 py-3 font-mono text-muted-foreground">{l.codigo}</td><td className="px-4 py-3"><strong>{l.descricao}</strong><div className="mt-1 text-[10px] text-muted-foreground">{l.categoria}</div></td><td className="px-4 py-3">{l.favorecido}</td><td className="px-4 py-3">{l.caixa}</td><td className="px-4 py-3">{formatarData(l.dataLancamento)}{l.dataVencimento && <div className="mt-1 text-[10px] text-muted-foreground">Venc. {formatarData(l.dataVencimento)}</div>}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${l.situacao === "PAGO" ? "bg-emerald-500/10 text-emerald-400" : l.situacao === "ATRASADO" ? "bg-red-500/10 text-red-400" : l.situacao === "CANCELADO" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-400"}`}>{l.situacao === "PAGO" ? "Pago / conciliado" : l.situacao}</span></td><td className={`px-4 py-3 text-right font-mono font-bold ${l.fluxo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>{l.fluxo === "ENTRADA" ? "+ " : "− "}{formatarMoeda(l.valor)}</td><td className="px-4 py-3">{l.situacao !== "PAGO" && l.situacao !== "CANCELADO" && ["lancamentos", "contas_apagar", "contas_areceber"].includes(l.origem) && <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground hover:text-destructive" onClick={() => void cancelar(l.id)}><Ban size={13}/>Cancelar</Button>}</td></tr>) : <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum lançamento encontrado para os filtros.</td></tr>}</tbody>
        {linhas.length > 0 && <tfoot className="border-t border-border bg-muted/20 font-bold"><tr><td colSpan={6} className="px-4 py-3">TOTAL LISTADO ({filtrados.length} itens)</td><td className="px-4 py-3 text-right font-mono">{formatarMoeda(total)}</td><td /></tr></tfoot>}
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtrados.length ? `${(pagina-1)*porPagina+1}–${Math.min(pagina*porPagina,filtrados.length)} de ${filtrados.length}` : "0 itens"}</span><div className="flex items-center gap-2"><Select value={String(porPagina)} onValueChange={(v) => {setPorPagina(Number(v));setPagina(1);}}><SelectTrigger className="h-8 w-24"><SelectValue/></SelectTrigger><SelectContent>{[10,25,50,100].map((n)=><SelectItem key={n} value={String(n)}>{n} / pág.</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" disabled={pagina<=1} onClick={()=>setPagina(pagina-1)}>Anterior</Button><Button variant="outline" size="sm" disabled={pagina>=paginas} onClick={()=>setPagina(pagina+1)}>Próxima</Button></div></footer>
    <NovoLancamentoShareDialog aberto={novo} aoFechar={()=>setNovo(false)} categorias={categorias} aoCriar={()=>void recarregar()} somenteDespesa={fluxo === "SAIDA"} somenteEntrada={fluxo === "ENTRADA"}/>
  </section>;
}
