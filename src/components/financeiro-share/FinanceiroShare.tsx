import { FileText, Landmark, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buscarOpcoesFinanceiroShare, type CategoriaCaixaShare, type ContaBancaria } from "@/lib/financeiro-share-api";
import { useCaixaEmpresa } from "@/hooks/useCaixaEmpresa";
import { AbaCaixaEmpresa } from "./AbaCaixaEmpresa";
import { AbaContasAPagar } from "./AbaContasAPagar";
import { AbaContasAReceber } from "./AbaContasAReceber";
import { AbaReembolsos } from "./AbaReembolsos";
import { AbaSalarios } from "./AbaSalarios";
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
  const { recarregar } = useCaixaEmpresa();

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
      <Button className="financeiro-primary-action w-full gap-2 sm:w-auto" onClick={() => setDialogoAberto(true)} disabled={categorias.length === 0}><Plus size={15} /> Novo lançamento</Button>
    </header>


    <Tabs value={aba} onValueChange={mudarAba} className="space-y-5"><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm"><TabsTrigger value="caixa-empresa" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><WalletCards size={14}/> Caixa Empresa</TabsTrigger><TabsTrigger value="contas-apagar" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ReceiptText size={14}/> Contas a Pagar</TabsTrigger><TabsTrigger value="contas-areceber" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Landmark size={14}/> Contas a Receber</TabsTrigger><TabsTrigger value="reembolsos" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Reembolsos Pendentes</TabsTrigger><TabsTrigger value="salarios" className="shrink-0 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Salários</TabsTrigger><TabsTrigger value="nota-fiscal-saida" className="shrink-0 gap-2 rounded-xl px-4 py-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><FileText size={14}/> Nota Fiscal Saída / Recibo</TabsTrigger></TabsList><TabsContent value="caixa-empresa" className="mt-0"><AbaCaixaEmpresa key={versaoCaixa} /></TabsContent><TabsContent value="contas-apagar" className="mt-0"><AbaContasAPagar /></TabsContent><TabsContent value="contas-areceber" className="mt-0"><AbaContasAReceber /></TabsContent><TabsContent value="reembolsos" className="mt-0"><AbaReembolsos /></TabsContent><TabsContent value="salarios" className="mt-0"><AbaSalarios /></TabsContent><TabsContent value="nota-fiscal-saida" className="mt-0"><NFSaidaTab /></TabsContent></Tabs>
    <NovoLancamentoShareDialog aberto={dialogoAberto} aoFechar={() => setDialogoAberto(false)} categorias={categorias} contas={contas} aoCriar={aoCriarLancamento} />
  </div>;
}
