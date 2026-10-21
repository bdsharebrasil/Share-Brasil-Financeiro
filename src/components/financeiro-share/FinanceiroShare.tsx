import { FileText, Landmark, ReceiptText, WalletCards, HandCoins, Building2, LayoutDashboard, Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarOpcoesFinanceiroShare, buscarSolicitacoesBaixaPortal, type CategoriaCaixaShare, type ContaBancaria } from "@/lib/financeiro-share-api";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { AbaCaixaEmpresa } from "./AbaCaixaEmpresa";
import { AbaContasAPagar } from "./AbaContasAPagar";
import { AbaContasAReceber } from "./AbaContasAReceber";
import { AbaResumoFinanceiro } from "./AbaResumoFinanceiro";
import { AbaSolicitacoesPagamento } from "./AbaSolicitacoesPagamento";
import { AbaSolicitacoesBaixaPortal } from "./AbaSolicitacoesBaixaPortal";
import { AbaMovimentosHolding } from "./AbaMovimentosHolding";
import { AbaSalarios } from "./AbaSalarios";
import NFSaidaTab from "./NFSaidaTab";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";

export function PaginaFinanceiroShare() {
  const localizacao = useLocation();
  const navegar = useNavigate();
  const abaInicial = new URLSearchParams(localizacao.search).get("aba") ||
    (localizacao.pathname.endsWith("/contas-a-pagar") ? "contas-apagar" :
      localizacao.pathname.endsWith("/contas-a-receber") ? "contas-areceber" :
        localizacao.pathname.endsWith("/nota-fiscal-saida") || localizacao.pathname.endsWith("/recibo-saida") ? "nota-fiscal-saida" : "resumo");
  const [aba, setAba] = useState(abaInicial);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [somenteDespesa, setSomenteDespesa] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [versaoCaixa, setVersaoCaixa] = useState(0);
  const { recarregar } = useCaixaEmpresa();
  const baixasPortal = useQuery({
    queryKey: ["solicitacoes-baixa-portal"],
    queryFn: buscarSolicitacoesBaixaPortal,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const quantidadeBaixasAnterior = useRef<number | null>(null);
  useEffect(() => {
    const quantidade = baixasPortal.data?.solicitacoes.length;
    if (quantidade === undefined) return;
    if (quantidade > (quantidadeBaixasAnterior.current ?? 0)) {
      const novas = quantidade - (quantidadeBaixasAnterior.current ?? 0);
      toast.info(`${novas} nova${novas === 1 ? " solicitação" : "s solicitações"} de baixa do Portal Cliente.`, { description: "Abra a aba Baixas do portal para conferir o comprovante." });
    }
    quantidadeBaixasAnterior.current = quantidade;
  }, [baixasPortal.data?.solicitacoes.length]);

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

  return <div className="financeiro-shell route-enter mx-auto max-w-[1480px] space-y-5 pb-10">
    <header className="financeiro-header flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">
          <span className="financeiro-title-icon"><WalletCards size={18} /></span> Financeiro Share
        </h1>
      </div>
    </header>


    <Tabs value={aba} onValueChange={mudarAba} className="space-y-5">
      <TabsList className="financeiro-tabs h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
        <TabsTrigger value="resumo" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><LayoutDashboard size={14} /> Resumo</TabsTrigger>
        <TabsTrigger value="caixa-empresa" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><WalletCards size={14} /> Caixa Empresa</TabsTrigger>
        <TabsTrigger value="contas-apagar" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ReceiptText size={14} /> Contas a Pagar</TabsTrigger>
        <TabsTrigger value="contas-areceber" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Landmark size={14} /> Contas a Receber</TabsTrigger>
        <TabsTrigger value="solicitacoes-pagamento" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><HandCoins size={14} /> Solicitações de pagamento</TabsTrigger>
        <TabsTrigger value="baixas-portal" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Bell size={14} /> Baixas do portal{Boolean(baixasPortal.data?.solicitacoes.length) && <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] leading-none text-white">{baixasPortal.data?.solicitacoes.length}</span>}</TabsTrigger>
        <TabsTrigger value="holdings" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Building2 size={14} /> Holdings</TabsTrigger>
        <TabsTrigger value="salarios" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Salários</TabsTrigger>
        <TabsTrigger value="nota-fiscal-saida" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText size={14} /> NF e recibo de saída</TabsTrigger>
      </TabsList>
      <TabsContent value="resumo" className="mt-0"><AbaResumoFinanceiro aoMudarAba={mudarAba} /></TabsContent>
      <TabsContent value="caixa-empresa" className="mt-0"><AbaCaixaEmpresa key={versaoCaixa} onNovoLancamento={() => { setSomenteDespesa(false); setDialogoAberto(true); }} /></TabsContent>
      <TabsContent value="contas-apagar" className="mt-0"><AbaContasAPagar onNovaConta={() => { setSomenteDespesa(true); setDialogoAberto(true); }} /></TabsContent>
      <TabsContent value="contas-areceber" className="mt-0"><AbaContasAReceber contasBancarias={contas} /></TabsContent>
      <TabsContent value="solicitacoes-pagamento" className="mt-0"><AbaSolicitacoesPagamento contasBancarias={contas} /></TabsContent>
      <TabsContent value="baixas-portal" className="mt-0"><AbaSolicitacoesBaixaPortal solicitacoes={baixasPortal.data?.solicitacoes || []} carregando={baixasPortal.isLoading} erro={Boolean(baixasPortal.error)} contasBancarias={contas} aoAtualizar={() => baixasPortal.refetch()} /></TabsContent>
      <TabsContent value="holdings" className="mt-0"><AbaMovimentosHolding /></TabsContent>
      <TabsContent value="salarios" className="mt-0"><AbaSalarios /></TabsContent>
      <TabsContent value="nota-fiscal-saida" className="mt-0 bg-[#01051d]"><NFSaidaTab /></TabsContent>
    </Tabs>
    <NovoLancamentoShareDialog aberto={dialogoAberto} aoFechar={() => setDialogoAberto(false)} categorias={categorias} aoCriar={aoCriarLancamento} somenteDespesa={somenteDespesa} />
  </div>;
}
