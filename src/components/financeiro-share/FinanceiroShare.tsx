import { ArrowDownRight, ArrowUpRight, FileText, Landmark, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarOpcoesFinanceiroShare, formatarCentavos, type CategoriaCaixaShare, type ContaBancaria } from "@/lib/financeiro-share-api";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { AbaCaixaEmpresa } from "./AbaCaixaEmpresa";
import { AbaContasAPagar } from "./AbaContasAPagar";
import { AbaContasAReceber } from "./AbaContasAReceber";
import NFSaidaTab from "./NFSaidaTab";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PaginaFinanceiroShare() {
  const localizacao = useLocation();
  const navegar = useNavigate();
  const abaInicial = new URLSearchParams(localizacao.search).get("aba") ||
    (localizacao.pathname.endsWith("/contas-a-pagar") ? "contas-apagar" :
      localizacao.pathname.endsWith("/contas-a-receber") ? "contas-areceber" :
        localizacao.pathname.endsWith("/nota-fiscal-saida") || localizacao.pathname.endsWith("/recibo-saida") ? "nota-fiscal-saida" : "caixa-empresa");
  const [aba, setAba] = useState(abaInicial);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [versaoCaixa, setVersaoCaixa] = useState(0);
  const { lancamentos, carregando, saldoCentavos, totalEntradasCentavos, totalSaidasCentavos, recarregar } = useCaixaEmpresa();

  useEffect(() => setAba(abaInicial), [abaInicial]);
  useEffect(() => {
    void buscarOpcoesFinanceiroShare()
      .then((opcoes) => {
        setCategorias(opcoes.categorias);
        setContas(opcoes.contas_bancarias);
      })
      .catch(() => {
        setCategorias([]);
        setContas([]);
      });
  }, []);

  const mudarAba = (valor: string) => {
    setAba(valor);
    navegar(`/gestor/financeiro-share?aba=${encodeURIComponent(valor)}`);
  };

  const aoCriarLancamento = () => {
    setVersaoCaixa((atual) => atual + 1);
    recarregar();
  };

  const indicadores = [
    { titulo: "Saldo do caixa", valor: saldoCentavos, icone: WalletCards, classe: saldoCentavos >= 0 ? "text-emerald-500" : "text-red-500" },
    { titulo: "Entradas", valor: totalEntradasCentavos, icone: ArrowUpRight, classe: "text-emerald-500" },
    { titulo: "Saídas", valor: totalSaidasCentavos, icone: ArrowDownRight, classe: "text-red-500" },
    { titulo: "Movimentações", valor: lancamentos.length, icone: ReceiptText, classe: "text-primary", texto: `${lancamentos.length} registro(s) no período` },
  ];

  const dadosMensais = useMemo(() => {
    const porMes = new Map<string, { mes: string; entradas: number; saidas: number }>();
    lancamentos.filter((l) => l.status !== "CANCELADO").forEach((l) => {
      const chave = String(l.data || "").slice(0, 7);
      if (!chave) return;
      const atual = porMes.get(chave) ?? { mes: chave, entradas: 0, saidas: 0 };
      if (l.fluxo === "ENTRADA") atual.entradas += l.valorCentavos;
      else atual.saidas += l.valorCentavos;
      porMes.set(chave, atual);
    });
    return Array.from(porMes.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6).map((item) => ({
      ...item,
      mesLabel: new Date(`${item.mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      entradas: item.entradas / 100,
      saidas: item.saidas / 100,
    }));
  }, [lancamentos]);

  const dadosCategorias = useMemo(() => {
    const porCategoria = new Map<string, number>();
    lancamentos.filter((l) => l.fluxo === "SAIDA" && l.status !== "CANCELADO").forEach((l) => {
      const chave = l.categoria || "Sem categoria";
      porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + l.valorCentavos);
    });
    return Array.from(porCategoria, ([nome, valor]) => ({ nome, valor: valor / 100 }))
      .sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [lancamentos]);

  return <div className="financeiro-shell route-enter mx-auto max-w-[1480px] space-y-5 pb-10">
    <header className="financeiro-header flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="financeiro-eyebrow">GESTOR / FINANCEIRO</p>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">
          <span className="financeiro-title-icon"><WalletCards size={18} /></span> Financeiro Share
        </h1>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">Controle centralizado do caixa próprio, compromissos e recebimentos da Share Brasil.</p>
      </div>
      <Button className="financeiro-primary-action w-full gap-2 sm:w-auto" onClick={() => setDialogoAberto(true)} disabled={categorias.length === 0}><Plus size={15} /> Novo lançamento</Button>
    </header>

    <section className="financial-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {indicadores.map(({ titulo, valor, icone: Icone, classe, texto }, index) => <div key={titulo} className={`financeiro-kpi ${index === 0 ? "financeiro-kpi--primary" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="financeiro-kpi-label">{titulo}</p>
          <span className={`financeiro-kpi-icon ${classe}`}><Icone size={15} /></span>
        </div>
        <p className={`mt-2 font-mono text-xl font-bold tracking-[-.04em] ${index === 0 ? "md:text-2xl" : ""}`}>{carregando ? "—" : typeof valor === "number" && titulo === "Movimentações" ? valor : formatarCentavos(valor as number)}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{texto ?? "Dados do banco de dados"}</p>
      </div>)}
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <div className="financeiro-panel min-w-0">
        <div className="financeiro-panel-header">
          <div><p className="text-sm font-bold">Fluxo de caixa</p><p className="text-[10px] text-muted-foreground">Entradas e saídas dos últimos meses disponíveis</p></div>
          <span className="financeiro-live-dot"><i /> DADOS EM TEMPO REAL</span>
        </div>
        <div className="h-56 px-1 pb-2 pt-4">
          {dadosMensais.length > 0 ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dadosMensais} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs><linearGradient id="shareFluxoArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="mesLabel" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatarCentavos(v * 100).replace(",00", "")} width={58} />
              <Tooltip formatter={(v: number) => formatarCentavos(v * 100)} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--primary))" fill="url(#shareFluxoArea)" strokeWidth={2} />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--chart-2))" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados suficientes para o gráfico.</div>}
        </div>
      </div>

      <div className="financeiro-panel min-w-0">
        <div className="financeiro-panel-header">
          <div><p className="text-sm font-bold">Despesas por categoria</p><p className="text-[10px] text-muted-foreground">Principais saídas do caixa Share</p></div>
          <ReceiptText size={15} className="text-muted-foreground" />
        </div>
        <div className="space-y-3 p-4">
          {dadosCategorias.length ? dadosCategorias.map((item, index) => {
            const maior = dadosCategorias[0]?.valor || 1;
            return <div key={item.nome}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]"><span className="min-w-0 truncate font-medium">{item.nome}</span><span className="font-mono text-muted-foreground">{formatarCentavos(item.valor * 100)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(8, (item.valor / maior) * 100)}%`, opacity: 1 - index * 0.12 }} /></div>
            </div>;
          }) : <div className="py-10 text-center text-xs text-muted-foreground">Nenhuma despesa categorizada.</div>}
        </div>
      </div>
    </section>

    <Tabs value={aba} onValueChange={mudarAba} className="space-y-5"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm"><TabsTrigger value="caixa-empresa" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><WalletCards size={14}/> Caixa Empresa</TabsTrigger><TabsTrigger value="contas-apagar" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ReceiptText size={14}/> Contas a Pagar</TabsTrigger><TabsTrigger value="contas-areceber" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Landmark size={14}/> Contas a Receber</TabsTrigger><TabsTrigger value="nota-fiscal-saida" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText size={14}/> Nota Fiscal Saída / Recibo</TabsTrigger></TabsList><TabsContent value="caixa-empresa" className="mt-0"><AbaCaixaEmpresa key={versaoCaixa} /></TabsContent><TabsContent value="contas-apagar" className="mt-0"><AbaContasAPagar /></TabsContent><TabsContent value="contas-areceber" className="mt-0"><AbaContasAReceber /></TabsContent><TabsContent value="nota-fiscal-saida" className="mt-0"><NFSaidaTab /></TabsContent></Tabs>
    <NovoLancamentoShareDialog aberto={dialogoAberto} aoFechar={() => setDialogoAberto(false)} categorias={categorias} contas={contas} aoCriar={aoCriarLancamento} />
  </div>;
}
