import { ArrowDownRight, ArrowUpRight, FileText, Landmark, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
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

  return <div className="route-enter mx-auto max-w-[1480px] space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Gestor / Financeiro</p><h1 className="mt-1 flex items-center gap-3 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><WalletCards className="text-primary" size={27} /> Financeiro Share</h1><p className="mt-2 max-w-2xl text-xs text-muted-foreground">Controle centralizado do caixa próprio, compromissos e recebimentos da Share Brasil.</p></div>
      <Button className="gap-2" onClick={() => setDialogoAberto(true)} disabled={categorias.length === 0}><Plus size={15} /> Novo lançamento</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {indicadores.map(({ titulo, valor, icone: Icone, classe, texto }) => <div key={titulo} className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{titulo}</p><Icone size={16} className={classe} /></div><p className="mt-2 text-xl font-bold tracking-[-.03em]">{carregando ? "—" : typeof valor === "number" && titulo === "Movimentações" ? valor : formatarCentavos(valor as number)}</p><p className="mt-1 text-[10px] text-muted-foreground">{texto ?? "Dados do banco de dados"}</p></div>)}
    </section>

    <Tabs value={aba} onValueChange={mudarAba} className="space-y-5"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm"><TabsTrigger value="caixa-empresa" className="gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><WalletCards size={14}/> Caixa Empresa</TabsTrigger><TabsTrigger value="contas-apagar" className="gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ReceiptText size={14}/> Contas a Pagar</TabsTrigger><TabsTrigger value="contas-areceber" className="gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Landmark size={14}/> Contas a Receber</TabsTrigger><TabsTrigger value="nota-fiscal-saida" className="gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText size={14}/> Nota Fiscal Saída / Recibo</TabsTrigger></TabsList><TabsContent value="caixa-empresa" className="mt-0"><AbaCaixaEmpresa key={versaoCaixa} /></TabsContent><TabsContent value="contas-apagar" className="mt-0"><AbaContasAPagar /></TabsContent><TabsContent value="contas-areceber" className="mt-0"><AbaContasAReceber /></TabsContent><TabsContent value="nota-fiscal-saida" className="mt-0"><NFSaidaTab /></TabsContent></Tabs>
    <NovoLancamentoShareDialog aberto={dialogoAberto} aoFechar={() => setDialogoAberto(false)} categorias={categorias} contas={contas} aoCriar={aoCriarLancamento} />
  </div>;
}
