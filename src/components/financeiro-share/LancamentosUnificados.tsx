import { useEffect, useMemo, useState } from "react";
import { CirclePlus, ChevronLeft, ChevronRight, Filter, Loader2, Pencil, Printer, RefreshCw, Search, ArrowUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarOpcoesFinanceiroShare, darBaixaContaAPagar, darBaixaContaAReceber, darBaixaLancamento, editarLancamento, excluirLancamento, formatarData, formatarMoeda, type CategoriaCaixaShare, type ContaBancaria } from "@/lib/financeiro-share-api";
import { useLancamentosUnificados, type FluxoUnificado, type LancamentoUnificado, type SituacaoUnificada } from "@/hooks/useLancamentosUnificados";
import type { ContaAPagar, ContaAReceber } from "./tipos";
import { ModalContaAPagar } from "./ModalContaAPagar";
import { ModalContaAReceber } from "./ModalContaAReceber";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";

const hoje = () => new Date().toISOString().slice(0, 10);
const podeExcluir = (l: LancamentoUnificado) => l.origem === "lancamentos";
const podeBaixar = (l: LancamentoUnificado) => l.situacao !== "PAGO" && l.situacao !== "CANCELADO" && ["lancamentos", "contas_apagar", "contas_areceber"].includes(l.origem);

export function LancamentosUnificados({ fluxo, filtroInicial }: { fluxo?: FluxoUnificado; filtroInicial?: { situacao?: SituacaoUnificada; inicio?: string; fim?: string } }) {
  const { lancamentos, carregando, erro, recarregar } = useLancamentosUnificados();
  const [busca, setBusca] = useState("");
  const [situacaoFiltro, setSituacaoFiltro] = useState(filtroInicial?.situacao || "TODAS");
  const [caixaFiltro, setCaixaFiltro] = useState("TODOS");
  const [naturezaFiltro, setNaturezaFiltro] = useState("TODAS");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [ordenacao, setOrdenacao] = useState<{ chave: "descricao" | "favorecido" | "caixa" | "data" | "situacao" | "valor"; crescente: boolean }>({ chave: "data", crescente: false });
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [contaBaixa, setContaBaixa] = useState<LancamentoUnificado | null>(null);
  const [lancamentoBaixa, setLancamentoBaixa] = useState<LancamentoUnificado | null>(null);
  const [dataBaixaLancamento, setDataBaixaLancamento] = useState(hoje);
  const [edicao, setEdicao] = useState<{ item: LancamentoUnificado; descricao: string } | null>(null);
  useEffect(() => {
    void buscarOpcoesFinanceiroShare()
      .then((o) => { setCategorias(o.categorias); setContasBancarias(o.contas_bancarias); })
      .catch(() => { setCategorias([]); setContasBancarias([]); });
  }, []);
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
    const valor = ordenacao.chave === "descricao" ? a.descricao.localeCompare(b.descricao, "pt-BR")
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
  const linhasExcluiveis = linhas.filter(podeExcluir);
  const todasDaPaginaSelecionadas = linhasExcluiveis.length > 0 && linhasExcluiveis.every((l) => selecionados.includes(l.id));
  const itensSelecionados = lancamentos.filter((l) => selecionados.includes(l.id) && podeExcluir(l));
  const mudarMes = (delta: number) => { const d = new Date(`${mes}-01T12:00:00`); d.setMonth(d.getMonth() + delta); setMes(d.toISOString().slice(0, 7)); setPagina(1); };
  const alternarSelecao = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  const alternarPagina = () => setSelecionados((atual) => todasDaPaginaSelecionadas
    ? atual.filter((id) => !linhasExcluiveis.some((l) => l.id === id))
    : [...new Set([...atual, ...linhasExcluiveis.map((l) => l.id)])]);

  function abrirBaixa(l: LancamentoUnificado) {
    if (!podeBaixar(l)) return;
    if (l.origem === "lancamentos") { setDataBaixaLancamento(hoje()); setLancamentoBaixa(l); }
    else setContaBaixa(l);
  }

  async function excluir(itens: LancamentoUnificado[]) {
    const mensagem = itens.length === 1 ? "Excluir este lançamento? Esta ação não pode ser desfeita." : `Excluir ${itens.length} lançamentos? Esta ação não pode ser desfeita.`;
    if (!window.confirm(mensagem)) return;
    setProcessando(true);
    const resultados = await Promise.allSettled(itens.map((l) => excluirLancamento(l.origemId)));
    const falhas = resultados.filter((r) => r.status === "rejected").length;
    setSelecionados((atual) => atual.filter((id) => !itens.some((l) => l.id === id)));
    await recarregar();
    setProcessando(false);
    if (falhas) toast.error(`${falhas} de ${itens.length} lançamento(s) não puderam ser excluídos.`);
    else toast.success(`${itens.length} lançamento(s) excluído(s).`);
  }

  async function salvarEdicao() {
    if (!edicao) return;
    setProcessando(true);
    try {
      await editarLancamento(edicao.item.origemId, { descricao: edicao.descricao.trim() });
      setEdicao(null);
      await recarregar();
      toast.success("Lançamento atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o lançamento.");
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarBaixaLancamento() {
    if (!lancamentoBaixa) return;
    setProcessando(true);
    try {
      await darBaixaLancamento(lancamentoBaixa.origemId, { dataPagamento: dataBaixaLancamento });
      setLancamentoBaixa(null);
      await recarregar();
      toast.success("Baixa registrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível dar baixa.");
    } finally {
      setProcessando(false);
    }
  }

  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro · {fluxo || "entradas e saídas"}</p><h2 className="mt-1 text-xl font-extrabold">{titulo}</h2><p className="mt-1 text-xs text-muted-foreground">Lista única, sem separar caixa de contas a pagar ou a receber.</p></div>
      <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo listado · {filtrados.length} itens</p><strong className="font-mono text-xl">{formatarMoeda(total)}</strong></div>
    </header>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setNovo(true)} className="gap-2"><CirclePlus size={15}/> Novo</Button>
      {itensSelecionados.length > 0 && <Button variant="destructive" disabled={processando} onClick={() => void excluir(itensSelecionados)} className="gap-2"><Trash2 size={14}/> Excluir selecionados ({itensSelecionados.length})</Button>}
      <Button variant="outline" onClick={() => void recarregar()} className="gap-2"><RefreshCw size={14}/> Atualizar</Button>
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
      <table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>
        <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todasDaPaginaSelecionadas} disabled={!linhasExcluiveis.length} onChange={alternarPagina} className="accent-primary"/></th>
        {([{ label: "Data / vencimento", key: "data" },{ label: "Descrição / categoria", key: "descricao" },{ label: "Favorecido", key: "favorecido" },{ label: "Caixa", key: "caixa" },{ label: "Situação", key: "situacao" },{ label: "Valor", key: "valor" }] as const).map(({label,key}) => <th key={label} className="px-4 py-3"><button type="button" className="inline-flex items-center gap-1" onClick={() => setOrdenacao((atual) => ({ chave: key, crescente: atual.chave === key ? !atual.crescente : true }))}>{label}<ArrowUpDown size={11}/></button></th>)}
        <th className="px-4 py-3 text-right">Ações</th>
      </tr></thead>
        <tbody>{carregando ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline animate-spin" size={16}/>Carregando lançamentos…</td></tr> : linhas.length ? linhas.map((l) => <tr key={`${l.origem}:${l.id}`} onClick={() => abrirBaixa(l)} className={`border-b border-border/60 hover:bg-muted/20 ${podeBaixar(l) ? "cursor-pointer" : ""}`}>
          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${l.descricao}`} disabled={!podeExcluir(l)} checked={selecionados.includes(l.id)} onChange={() => alternarSelecao(l.id)} className="accent-primary"/></td>
          <td className="px-4 py-3">{formatarData(l.dataLancamento)}{l.dataVencimento && <div className="mt-1 text-[10px] text-muted-foreground">Venc. {formatarData(l.dataVencimento)}</div>}</td>
          <td className="px-4 py-3"><strong>{l.descricao}</strong><div className="mt-1 text-[10px] text-muted-foreground">{l.categoria}</div></td>
          <td className="px-4 py-3">{l.favorecido}</td>
          <td className="px-4 py-3">{l.caixa}</td>
          <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${l.situacao === "PAGO" ? "bg-emerald-500/10 text-emerald-400" : l.situacao === "ATRASADO" ? "bg-red-500/10 text-red-400" : l.situacao === "CANCELADO" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-400"}`}>{l.situacao === "PAGO" ? "Pago / conciliado" : l.situacao}</span></td>
          <td className={`px-4 py-3 text-right font-mono font-bold ${l.fluxo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>{l.fluxo === "ENTRADA" ? "+ " : "− "}{formatarMoeda(l.valor)}</td>
          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label="Editar lançamento" title={podeExcluir(l) ? "Editar" : "Edição disponível apenas para lançamentos diretos"} disabled={!podeExcluir(l) || processando} onClick={() => setEdicao({ item: l, descricao: l.descricao })}><Pencil size={14}/></Button>
            <Button variant="ghost" size="icon" aria-label="Excluir lançamento" title={podeExcluir(l) ? "Excluir" : "Exclusão disponível apenas para lançamentos diretos"} disabled={!podeExcluir(l) || processando} onClick={() => void excluir([l])}><Trash2 size={14}/></Button>
          </div></td>
        </tr>) : <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Nenhum lançamento encontrado para os filtros.</td></tr>}</tbody>
        {linhas.length > 0 && <tfoot className="border-t border-border bg-muted/20 font-bold"><tr><td colSpan={6} className="px-4 py-3">TOTAL LISTADO ({filtrados.length} itens)</td><td className="px-4 py-3 text-right font-mono">{formatarMoeda(total)}</td><td/></tr></tfoot>}
      </table>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtrados.length ? `${(pagina-1)*porPagina+1}–${Math.min(pagina*porPagina,filtrados.length)} de ${filtrados.length}` : "0 itens"}</span><div className="flex items-center gap-2"><Select value={String(porPagina)} onValueChange={(v) => {setPorPagina(Number(v));setPagina(1);}}><SelectTrigger className="h-8 w-24"><SelectValue/></SelectTrigger><SelectContent>{[10,25,50,100].map((n)=><SelectItem key={n} value={String(n)}>{n} / pág.</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" disabled={pagina<=1} onClick={()=>setPagina(pagina-1)}>Anterior</Button><Button variant="outline" size="sm" disabled={pagina>=paginas} onClick={()=>setPagina(pagina+1)}>Próxima</Button></div></footer>
    <NovoLancamentoShareDialog aberto={novo} aoFechar={()=>setNovo(false)} categorias={categorias} aoCriar={()=>void recarregar()} somenteDespesa={fluxo === "SAIDA"} somenteEntrada={fluxo === "ENTRADA"}/>
    {contaBaixa?.origem === "contas_apagar" && <ModalContaAPagar conta={contaBaixa.raw as ContaAPagar} aberto onFechar={() => setContaBaixa(null)} onConfirmar={async (dados) => { await darBaixaContaAPagar(contaBaixa.origemId, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
    {contaBaixa?.origem === "contas_areceber" && <ModalContaAReceber conta={contaBaixa.raw as ContaAReceber} aberto onFechar={() => setContaBaixa(null)} contasBancarias={contasBancarias} onConfirmar={async (dados) => { await darBaixaContaAReceber(contaBaixa.origemId, dados); setContaBaixa(null); await recarregar(); toast.success("Baixa registrada."); }}/>}
    <Dialog open={!!lancamentoBaixa} onOpenChange={(v) => { if (!v) setLancamentoBaixa(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dar baixa</DialogTitle></DialogHeader>
        <div className="space-y-2"><p className="text-sm text-muted-foreground">{lancamentoBaixa?.descricao} · {lancamentoBaixa && formatarMoeda(lancamentoBaixa.valor)}</p><Label htmlFor="data-baixa">Data do pagamento</Label><Input id="data-baixa" type="date" value={dataBaixaLancamento} onChange={(e) => setDataBaixaLancamento(e.target.value)}/></div>
        <DialogFooter><Button variant="outline" onClick={() => setLancamentoBaixa(null)} disabled={processando}>Cancelar</Button><Button onClick={() => void confirmarBaixaLancamento()} disabled={processando || !dataBaixaLancamento}>{processando && <Loader2 className="mr-2 animate-spin" size={14}/>}Confirmar baixa</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!edicao} onOpenChange={(v) => { if (!v) setEdicao(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
        <div className="space-y-2"><Label htmlFor="descricao-edicao">Descrição</Label><Input id="descricao-edicao" value={edicao?.descricao ?? ""} onChange={(e) => setEdicao((atual) => atual && { ...atual, descricao: e.target.value })}/></div>
        <DialogFooter><Button variant="outline" onClick={() => setEdicao(null)} disabled={processando}>Cancelar</Button><Button onClick={() => void salvarEdicao()} disabled={processando || !edicao?.descricao.trim()}>{processando && <Loader2 className="mr-2 animate-spin" size={14}/>}Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
