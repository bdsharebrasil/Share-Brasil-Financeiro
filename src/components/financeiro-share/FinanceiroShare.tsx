import { Bell, Building2, CirclePlus, FileText, Landmark, LayoutDashboard, ReceiptText, WalletCards } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { buscarOpcoesFinanceiroShare, buscarSolicitacoesBaixaPortal, type CategoriaCaixaShare, type ContaBancaria, type SolicitacaoBaixaPortal } from "@/lib/financeiro-share-api";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { AbaCaixaEmpresa } from "./AbaCaixaEmpresa";
import { AbaContasAPagar } from "./AbaContasAPagar";
import { AbaContasAReceber } from "./AbaContasAReceber";
import { AbaResumoFinanceiro } from "./AbaResumoFinanceiro";
import { AbaSolicitacoesBaixaPortal } from "./AbaSolicitacoesBaixaPortal";
import { AbaMovimentosHolding } from "./AbaMovimentosHolding";
import { AbaSalarios } from "./AbaSalarios";
import NFSaidaTab from "./NFSaidaTab";
import { NovoLancamentoShareDialog } from "./NovoLancamentoShareDialog";

export function PaginaFinanceiroShare() {
  const localizacao = useLocation();
  const navegar = useNavigate();
  const parametroAba = new URLSearchParams(localizacao.search).get("aba");
  const abaInicial = parametroAba === "solicitacoes-pagamento" ? "contas-apagar" : parametroAba ||
    (localizacao.pathname.endsWith("/contas-a-pagar") ? "contas-apagar" :
      localizacao.pathname.endsWith("/contas-a-receber") ? "contas-areceber" :
        localizacao.pathname.endsWith("/nota-fiscal-saida") || localizacao.pathname.endsWith("/recibo-saida") ? "nota-fiscal-saida" : "resumo");
  const subAbaInicial = parametroAba === "solicitacoes-pagamento" ? "solicitacoes" : "contas";
  const [aba, setAba] = useState(abaInicial);
  const [subAbaContas, setSubAbaContas] = useState(subAbaInicial);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [somenteDespesa, setSomenteDespesa] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCaixaShare[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [versaoCaixa, setVersaoCaixa] = useState(0);
  const [solicitacoesBaixa, setSolicitacoesBaixa] = useState<SolicitacaoBaixaPortal[]>([]);
  const [carregandoBaixas, setCarregandoBaixas] = useState(true);
  const [erroBaixas, setErroBaixas] = useState(false);
  const { recarregar } = useCaixaEmpresa();
  const componenteAtivo = useRef(false);
  const atualizarBaixasPortal = useCallback(async () => {
    try {
      const resposta = await buscarSolicitacoesBaixaPortal();
      if (componenteAtivo.current) {
        setSolicitacoesBaixa(resposta.solicitacoes || []);
        setErroBaixas(false);
      }
    } catch {
      if (componenteAtivo.current) setErroBaixas(true);
    } finally {
      if (componenteAtivo.current) setCarregandoBaixas(false);
    }
  }, []);
  const quantidadeBaixasAnterior = useRef<number | null>(null);
  useEffect(() => {
    const quantidade = solicitacoesBaixa.length;
    if (quantidade > (quantidadeBaixasAnterior.current ?? 0)) {
      const novas = quantidade - (quantidadeBaixasAnterior.current ?? 0);
      toast.info(`${novas} nova${novas === 1 ? " solicitação" : "s solicitações"} de baixa do Portal Cliente.`, { description: "Abra a aba Baixas do portal para conferir o comprovante." });
    }
    quantidadeBaixasAnterior.current = quantidade;
  }, [solicitacoesBaixa.length]);

  useEffect(() => {
    componenteAtivo.current = true;
    void atualizarBaixasPortal();
    const timer = window.setInterval(() => void atualizarBaixasPortal(), 30_000);
    window.addEventListener("focus", atualizarBaixasPortal);
    return () => {
      componenteAtivo.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", atualizarBaixasPortal);
    };
  }, [atualizarBaixasPortal]);

  useEffect(() => setAba(abaInicial), [abaInicial]);
  useEffect(() => setSubAbaContas(subAbaInicial), [subAbaInicial]);
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

  const abrirNovoLancamento = (despesa = false) => {
    setSomenteDespesa(despesa);
    setDialogoAberto(true);
  };

  return <main className="financeiro-shell route-enter mx-auto w-full max-w-[1480px] space-y-6 pb-10">
    <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="financeiro-eyebrow mb-3 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" /> Share Brasil · Gestão financeira
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-[-.04em] text-foreground sm:text-[30px]">
            <span className="financeiro-title-icon size-10 shrink-0 rounded-xl"><WalletCards size={19} /></span>
            Financeiro Share
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Acompanhe caixa, contas, baixas do portal, holdings, salários e documentos fiscais em um só lugar.
          </p>
        </div>
        <Button type="button" onClick={() => abrirNovoLancamento()} className="financeiro-primary-action shrink-0 gap-2 self-start sm:self-center">
          <CirclePlus size={16} /> Novo lançamento
        </Button>
      </div>
    </header>

    <Tabs value={aba} onValueChange={mudarAba} className="space-y-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList aria-label="Seções do Financeiro Share" className="financeiro-tabs h-auto w-max min-w-full justify-start gap-1 rounded-xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
          <TabsTrigger value="resumo" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><LayoutDashboard size={15} /> Resumo</TabsTrigger>
          <TabsTrigger value="caixa-empresa" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><WalletCards size={15} /> Caixa Empresa</TabsTrigger>
          <TabsTrigger value="contas-apagar" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><ReceiptText size={15} /> Contas a Pagar</TabsTrigger>
          <TabsTrigger value="contas-areceber" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><Landmark size={15} /> Contas a Receber</TabsTrigger>
          <TabsTrigger value="baixas-portal" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm">
            <Bell size={15} /> Baixas do portal
            {solicitacoesBaixa.length > 0 && <span className="ml-0.5 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-destructive-foreground">{solicitacoesBaixa.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="holdings" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><Building2 size={15} /> Holdings</TabsTrigger>
          <TabsTrigger value="salarios" className="shrink-0 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm">Salários</TabsTrigger>
          <TabsTrigger value="nota-fiscal-saida" className="shrink-0 gap-2 rounded-lg px-3 py-2.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"><FileText size={15} /> NF e recibo de saída</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="resumo" className="mt-0"><AbaResumoFinanceiro aoMudarAba={mudarAba} /></TabsContent>
      <TabsContent value="caixa-empresa" className="mt-0"><AbaCaixaEmpresa key={versaoCaixa} onNovoLancamento={() => abrirNovoLancamento()} /></TabsContent>
      <TabsContent value="contas-apagar" className="mt-0"><AbaContasAPagar onNovaConta={() => abrirNovoLancamento(true)} contasBancarias={contas} subAba={subAbaContas} onSubAbaChange={setSubAbaContas} /></TabsContent>
      <TabsContent value="contas-areceber" className="mt-0"><AbaContasAReceber contasBancarias={contas} /></TabsContent>
      <TabsContent value="baixas-portal" className="mt-0"><AbaSolicitacoesBaixaPortal solicitacoes={solicitacoesBaixa} carregando={carregandoBaixas} erro={erroBaixas} contasBancarias={contas} aoAtualizar={atualizarBaixasPortal} /></TabsContent>
      <TabsContent value="holdings" className="mt-0"><AbaMovimentosHolding /></TabsContent>
      <TabsContent value="salarios" className="mt-0"><AbaSalarios /></TabsContent>
      <TabsContent value="nota-fiscal-saida" className="mt-0 bg-[#01051d]"><NFSaidaTab /></TabsContent>
    </Tabs>
    <NovoLancamentoShareDialog aberto={dialogoAberto} aoFechar={() => setDialogoAberto(false)} categorias={categorias} aoCriar={aoCriarLancamento} somenteDespesa={somenteDespesa} />
  </main>;
}
