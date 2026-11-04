import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
const Perfil = lazy(() => import("@/pages/perfil"));
const DashboardOperacoes = lazy(() => import("@/pages/DashboardOperacoes"));
const DashboardFinanceiro = lazy(() => import("@/pages/DashboardFinanceiro"));
const MovimentacoesFinanceiras = lazy(() => import("@/components/dashboard/financeiro/MovimentacoesFinanceiras"));
const DashboardGestorResumo = lazy(() => import("@/components/dashboard/gestor/DashboardGestorResumo"));
const MenuGestor = lazy(() => import("@/components/dashboard/gestor/MenuGestor"));
const FinanceiroCotista = lazy(() => import("@/components/FinanceiroCotista/FinanceiroCotista"));
const EmissaoRecibo = lazy(() => import("@/pages/EmissaoRecibo"));
const ModuloInterno = lazy(() => import("@/pages/ModuloInterno"));
const Agendamentos = lazy(() => import("@/pages/Agendamentos"));
const PlanoDeVoo = lazy(() => import("@/pages/PlanoDeVoo"));
const DiarioBordo = lazy(() => import("@/pages/DiarioBordo"));
const Ferias = lazy(() => import("@/pages/Ferias"));
const Recados = lazy(() => import("@/pages/Recados"));
const GestaoTripulacao = lazy(() => import("@/pages/GestaoTripulacao"));
const ControleAbastecimento = lazy(() => import("@/pages/ControleAbastecimento"));
const CentroTreinamento = lazy(() => import("@/pages/CentroTreinamento"));
const CentroMateriais = lazy(() => import("@/pages/CentroMateriais"));
const SalaReuniao = lazy(() => import("@/pages/SalaReuniao"));
const HoteisShareBrasil = lazy(() => import("@/pages/HoteisShareBrasil"));
const GestaoColaborador = lazy(() => import("@/components/financeiro-share/GestaoColaborador"));
const EnviarPagamento = lazy(() => import("@/pages/EnviarPagamento"));
const ConfiguracoesGestor = lazy(() => import("@/components/dashboard/gestor/ConfiguracoesGestor"));
const RelatorioDespesaViagem = lazy(() => import("@/pages/RelatorioDespesaViagem"));
const Emails = lazy(() => import("@/pages/Emails"));
const Aerodromos = lazy(() => import("@/pages/Aerodromos"));
const Aniversarios = lazy(() => import("@/pages/Aniversarios"));
const CTM = lazy(() => import("@/pages/CTM"));
const AeronavesShareBrasil = lazy(() => import("@/pages/AeronavesShareBrasil"));
const DashboardShareBrasil = lazy(() => import("@/pages/ShareBrasil").then((module) => ({ default: module.DashboardShareBrasil })));
const PontoShareBrasil = lazy(() => import("@/pages/ShareBrasil").then((module) => ({ default: module.PontoShareBrasil })));
const DocumentosShareBrasil = lazy(() => import("@/pages/ShareBrasil").then((module) => ({ default: module.DocumentosShareBrasil })));
const TarefasShareBrasil = lazy(() => import("@/pages/ShareBrasil").then((module) => ({ default: module.TarefasShareBrasil })));
const ContatosClientesShareBrasil = lazy(() => import("@/pages/ShareBrasil").then((module) => ({ default: module.ContatosClientesShareBrasil })));
const SenhasPastas = lazy(() => import("@/pages/SenhasPastas"));
import { menusPorAmbiente, menuInicial, type Ambiente, type Tema } from "@/types/navegacao";
import { BarraSuperior } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { buscarPerfilColaborador } from "@/lib/colaborador-api";
import { limparNavegacao, restaurarNavegacao, salvarNavegacao } from "@/lib/navigation-state";
import { supabase } from "@/lib/supabase";
import WelcomeToast from "@/components/layout/WelcomeToast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function LayoutInterno() {
  const [navegacaoInicial] = useState(() => restaurarNavegacao(menusPorAmbiente, window.sessionStorage));
  const [ambiente, setAmbiente] = useState<Ambiente>(navegacaoInicial.ambiente);
  const [podeAcessarGestor, setPodeAcessarGestor] = useState(false);
  const [podeAcessarMenuGestor, setPodeAcessarMenuGestor] = useState(false);
  const [nomeColaborador, setNomeColaborador] = useState<string | null>(null);
  const [exibirBoasVindas, setExibirBoasVindas] = useState(false);
  const [menuAtivo, setMenuAtivo] = useState(navegacaoInicial.menuAtivo);
  const [tema, setTema] = useState<Tema>(() => (localStorage.getItem("share-brasil-theme") as Tema) || "dark");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const navegacaoManual = useRef(navegacaoInicial.restaurada);
  const navegar = useNavigate();
  const localizacao = useLocation();
  const rotaRecibo = localizacao.pathname === "/financeiro/emissao-recibo";
  const rotaFinanceiroShare = localizacao.pathname.startsWith("/gestor/financeiro-share");
  const moduloLegado = (() => { const aba = new URLSearchParams(localizacao.search).get("aba"); if (localizacao.pathname.endsWith("/contas-a-pagar") || aba === "contas-apagar" || aba === "caixa-empresa") return "saida"; if (localizacao.pathname.endsWith("/contas-a-receber") || aba === "contas-areceber") return "entrada"; if (localizacao.pathname.endsWith("/nota-fiscal-saida") || localizacao.pathname.endsWith("/recibo-saida") || aba === "nota-fiscal-saida") return "nf-saida"; if (aba === "baixas-portal") return "baixas"; if (aba === "holdings") return "holding"; if (aba === "salarios") return "folha"; return null; })();
  const rotaUrlFinanceiraLegada = rotaFinanceiroShare || ["/contas-a-pagar", "/contas-a-receber", "/nota-fiscal-saida", "/recibo-saida"].includes(localizacao.pathname);
  const rotaFinanceiroCotista = localizacao.pathname === "/gestor/financeiro-cotista";
  const rotaEnviarPagamento = localizacao.pathname === "/financeiro/enviar-pagamento";
  const rotaMovimentacoes = localizacao.pathname === "/financeiro/movimentacoes";
  const salaReuniaoDireta = Boolean(new URLSearchParams(localizacao.search).get("sala_reuniao"));
  const resetarRolagem = useCallback(() => {
    requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
      viewport?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  useEffect(() => { document.documentElement.classList.toggle("dark", tema === "dark"); localStorage.setItem("share-brasil-theme", tema); }, [tema]);
  useEffect(() => { if (rotaRecibo) { setAmbiente("financeiro"); setMenuAtivo("recibos"); } else if (menuAtivo === "recibos") { setMenuAtivo("overview"); } }, [rotaRecibo, menuAtivo]);
  useEffect(() => {
    if (rotaUrlFinanceiraLegada) { setAmbiente("gestor"); setMenuAtivo("overview"); navegar(`/?modulo=${moduloLegado || "entrada"}`, { replace: true }); }
    else if (rotaFinanceiroCotista) { setAmbiente("gestor"); setMenuAtivo("financeiro-cotista"); }
  }, [rotaUrlFinanceiraLegada, moduloLegado, rotaFinanceiroCotista, navegar]);
  useEffect(() => {
    if (rotaEnviarPagamento) {
      setAmbiente("financeiro");
      setMenuAtivo("enviar-pagamento");
    } else if (menuAtivo === "enviar-pagamento") {
      setMenuAtivo("overview");
    }
  }, [rotaEnviarPagamento, menuAtivo]);
  useEffect(() => { if (rotaMovimentacoes) { setAmbiente("financeiro"); setMenuAtivo("movimentacoes"); } }, [rotaMovimentacoes]);
  useEffect(() => { if (salaReuniaoDireta) { setAmbiente("share-brasil"); setMenuAtivo("sala-reuniao"); } }, [salaReuniaoDireta]);
  useEffect(() => { resetarRolagem(); }, [ambiente, menuAtivo, resetarRolagem]);
  useEffect(() => { salvarNavegacao(window.sessionStorage, { ambiente, menuAtivo }); }, [ambiente, menuAtivo]);
  useEffect(() => { void buscarPerfilColaborador().then((response) => { const papeisDashboard = [response.perfil.tipo_user || "", ...response.funcoes.map((item) => item.funcao)].map((papel) => papel.trim().toLowerCase().replace(/[\s-]+/g, "_")); const papeisMenu = [...papeisDashboard, (response.perfil.departamento || "").trim().toLowerCase().replace(/[\s-]+/g, "_")]; const permitido = papeisDashboard.some((papel) => ["admin", "administrador", "financeiro_master", "gestor_master", "rh_master", "rh"].includes(papel)); const menuGestorPermitido = papeisMenu.some((papel) => ["admin", "administrador", "gestor_master"].includes(papel)); const nome = response.perfil.nome_exibicao || response.perfil.nome_completo; if (nome) {
        setNomeColaborador(nome);
        const chaveBoasVindas = `share-brasil-boas-vindas:${nome}`;
        if (!window.localStorage.getItem(chaveBoasVindas)) {
          window.localStorage.setItem(chaveBoasVindas, "1");
          setExibirBoasVindas(true);
        }
      } setPodeAcessarGestor(permitido); setPodeAcessarMenuGestor(menuGestorPermitido); if (permitido && !navegacaoManual.current && !rotaRecibo && !rotaFinanceiroShare && !rotaFinanceiroCotista && !rotaEnviarPagamento && !rotaMovimentacoes && !salaReuniaoDireta) { setAmbiente("gestor"); setMenuAtivo(menuInicial("gestor")); } }).catch(() => { setPodeAcessarGestor(false); setPodeAcessarMenuGestor(false); }); }, [rotaRecibo, rotaFinanceiroShare, rotaFinanceiroCotista, rotaEnviarPagamento, rotaMovimentacoes, salaReuniaoDireta]);

  const itens = menusPorAmbiente[ambiente];
  const itemAtivo = useMemo(() => itens.find((item) => item.id === menuAtivo) ?? itens[0], [itens, menuAtivo]);
  const trocarAmbiente = (proximo: Ambiente) => { if (proximo === "gestor" && !podeAcessarGestor) return; navegacaoManual.current = true; setAmbiente(proximo); setMenuAtivo(menuInicial(proximo)); if (rotaRecibo || rotaFinanceiroShare || rotaFinanceiroCotista || rotaEnviarPagamento || rotaMovimentacoes) navegar("/"); setMenuAberto(false); };
  const selecionarMenu = (menu: string, aba?: string) => {
    if (ambiente === "gestor" && menu === "gestor" && !podeAcessarMenuGestor) return;
    navegacaoManual.current = true;
    setMenuAtivo(menu);
    if (menu === "enviar-pagamento") { setAmbiente("financeiro"); navegar("/financeiro/enviar-pagamento"); }
    else if (menu === "movimentacoes") { setAmbiente("financeiro"); navegar("/financeiro/movimentacoes"); }
    else if (ambiente === "gestor" && menu === "financeiro-share") { setMenuAtivo("overview"); navegar(`/?modulo=${encodeURIComponent(aba || "entrada")}`); }
    else if (ambiente === "gestor" && menu === "financeiro-cotista") navegar("/gestor/financeiro-cotista");
    else if (ambiente === "gestor" && menu === "overview" && localizacao.search) navegar("/");
    else if (menu === "recibos") navegar("/financeiro/emissao-recibo");
    else if (rotaRecibo || rotaFinanceiroShare || rotaFinanceiroCotista || rotaEnviarPagamento || rotaMovimentacoes) navegar("/");
  };
  const abrirPerfil = () => { navegacaoManual.current = true; setMenuAtivo("perfil"); if (rotaRecibo || rotaEnviarPagamento) navegar("/"); };
  const abrirRelatorioNotificado = (id: string) => { navegacaoManual.current = true; window.sessionStorage.setItem("share:relatorio-notificacao", id); setAmbiente("financeiro"); setMenuAtivo("despesas"); setMenuAberto(false); if (rotaRecibo || rotaEnviarPagamento || rotaMovimentacoes) navegar("/"); };
  const sair = async () => { limparNavegacao(window.sessionStorage); await supabase.auth.signOut({ scope: "local" }).catch(() => undefined); navegar("/login", { replace: true }); };

  const renderConteudo = () => {
    if (menuAtivo === "perfil") return <Perfil tema={tema} onAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} />;
    if (ambiente === "operacoes" && menuAtivo === "agendamentos") return <Agendamentos />;
    if (ambiente === "operacoes" && menuAtivo === "plano-de-voo") return <PlanoDeVoo />;
    if (ambiente === "operacoes" && menuAtivo === "diario-de-bordo") return <DiarioBordo aoVoltar={() => setMenuAtivo("overview")} aoAbrirAerodromos={() => setMenuAtivo("aerodromos")} />;
    if (ambiente === "operacoes" && menuAtivo === "aerodromos") return <Aerodromos aoVoltar={() => setMenuAtivo("diario-de-bordo")} />;
    if (ambiente === "operacoes" && menuAtivo === "tripulacao") return <GestaoTripulacao aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes" && menuAtivo === "abastecimentos") return <ControleAbastecimento aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes" && menuAtivo === "ctm") return <CTM />;
    if (ambiente === "gestor" && menuAtivo === "ferias") return <Ferias />;
    if (ambiente === "gestor" && menuAtivo === "gestor" && podeAcessarMenuGestor) return <MenuGestor />;
    if (ambiente === "gestor" && menuAtivo === "financeiro-cotista") return <FinanceiroCotista />;

    if (ambiente === "financeiro" && menuAtivo === "enviar-pagamento") return <EnviarPagamento />;
    if (ambiente === "financeiro" && menuAtivo === "movimentacoes") return <MovimentacoesFinanceiras aoVoltar={() => selecionarMenu("overview")} />;
    if (ambiente === "financeiro" && menuAtivo === "recibos") return <EmissaoRecibo aoVoltar={() => selecionarMenu("overview")} />;
    if (ambiente === "financeiro" && menuAtivo === "despesas") return <RelatorioDespesaViagem aoVoltar={() => setMenuAtivo("overview")} aoResetarRolagem={resetarRolagem} />;
    if (ambiente === "financeiro" && menuAtivo === "email") return <Emails />;
    if (ambiente === "gestor" && podeAcessarGestor && menuAtivo === "gestao-colaborador") return <GestaoColaborador />;
    if (ambiente === "gestor" && podeAcessarGestor && menuAtivo === "configuracoes") return <ConfiguracoesGestor />;
    if (menuAtivo === "recados" && ["gestor", "operacoes", "financeiro"].includes(ambiente)) return <Recados />;
    if (ambiente === "share-brasil" && menuAtivo === "aniversarios") return <Aniversarios />;
    if (ambiente === "share-brasil" && menuAtivo === "ponto") return <PontoShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "documentos") return <DocumentosShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "senhas") return <SenhasPastas />;
    if (ambiente === "share-brasil" && menuAtivo === "tarefas") return <TarefasShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "contatos-clientes") return <ContatosClientesShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "hoteis") return <HoteisShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "aeronaves") return <AeronavesShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "centro-treinamento") return <CentroTreinamento aoNavegar={selecionarMenu} />;
    if (ambiente === "share-brasil" && menuAtivo === "sala-reuniao") return <SalaReuniao />;
    if (ambiente === "share-brasil" && menuAtivo === "tutorial") return <CentroMateriais categoria="TUTORIAL" />;
    if (ambiente === "share-brasil" && menuAtivo === "treinamento") return <CentroMateriais categoria="TREINAMENTO" />;
    if (menuAtivo !== "overview" && itemAtivo) return <ModuloInterno ambiente={ambiente} menu={itemAtivo} aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes") return <DashboardOperacoes aoNavegar={selecionarMenu} />;
    if (ambiente === "financeiro") return <DashboardFinanceiro aoNavegar={selecionarMenu} />;
    if (ambiente === "share-brasil") return <DashboardShareBrasil aoNavegar={selecionarMenu} />;
    return podeAcessarGestor ? <DashboardGestorResumo aoNavegar={selecionarMenu} /> : <DashboardShareBrasil aoNavegar={selecionarMenu} />;
  };

  return <div className="app-noise flex min-h-[100dvh] min-w-0 max-w-[100vw] overflow-x-hidden bg-background"><Sidebar ambiente={ambiente} menuAtivo={menuAtivo} aberta={menuAberto} recolhida={sidebarRecolhida} podeAcessarMenuGestor={podeAcessarMenuGestor} aoFechar={() => setMenuAberto(false)} aoAlternarRecolhimento={() => setSidebarRecolhida((atual) => !atual)} aoSelecionar={selecionarMenu} /><div className="min-w-0 flex-1 bg-background md:pl-[76px]"><BarraSuperior ambiente={ambiente} podeAcessarGestor={podeAcessarGestor} tema={tema} aoTrocarAmbiente={trocarAmbiente} aoAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} aoAbrirMenu={() => setMenuAberto(true)} aoAbrirPerfil={abrirPerfil} aoAbrirRelatorio={abrirRelatorioNotificado} aoSair={sair} /><ScrollArea ref={scrollAreaRef} className="app-main-scroll h-[calc(100dvh-var(--app-header-height))]"><main className="-mx-[6px] -my-[60px] min-w-0 w-full max-w-[1540px] bg-[rgba(8,10,18,0)] px-[18px] py-[81px]"><Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">Carregando módulo…</div>}>{renderConteudo()}</Suspense></main></ScrollArea></div>{exibirBoasVindas && nomeColaborador && <WelcomeToast name={nomeColaborador} onClose={() => setExibirBoasVindas(false)} />}</div>;
}
