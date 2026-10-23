import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Perfil from "@/pages/perfil";
import DashboardOperacoes from "@/pages/DashboardOperacoes";
import DashboardFinanceiro from "@/pages/DashboardFinanceiro";
import MovimentacoesFinanceiras from "@/components/dashboard/financeiro/MovimentacoesFinanceiras";
import DashboardGestorFinanceiro from "@/components/dashboard/gestor/DashboardGestorFinanceiro";
import DashboardGestorResumo from "@/components/dashboard/gestor/DashboardGestorResumo";
import MenuGestor from "@/components/dashboard/gestor/MenuGestor";
import FinanceiroCotista from "@/components/FinanceiroCotista/FinanceiroCotista";
import { PaginaFinanceiroShare } from "@/components/financeiro-share/FinanceiroShare";
import EmissaoRecibo from "@/pages/EmissaoRecibo";
import ModuloInterno from "@/pages/ModuloInterno";
import Agendamentos from "@/pages/Agendamentos";
import PlanoDeVoo from "@/pages/PlanoDeVoo";
import DiarioBordo from "@/pages/DiarioBordo";
import Ferias from "@/pages/Ferias";
import Recados from "@/pages/Recados";
import GestaoTripulacao from "@/pages/GestaoTripulacao";
import ControleAbastecimento from "@/pages/ControleAbastecimento";
import CentroTreinamento from "@/pages/CentroTreinamento";
import CentroMateriais from "@/pages/CentroMateriais";
import SalaReuniao from "@/pages/SalaReuniao";
import HoteisShareBrasil from "@/pages/HoteisShareBrasil";
import GestaoColaborador from "@/components/financeiro-share/GestaoColaborador";
import EnviarPagamento from "@/pages/EnviarPagamento";
import ConfiguracoesGestor from "@/components/dashboard/gestor/ConfiguracoesGestor";
import RelatorioDespesaViagem from "@/pages/RelatorioDespesaViagem";
import Emails from "@/pages/Emails";
import Aerodromos from "@/pages/Aerodromos";
import Aniversarios from "@/pages/Aniversarios";
import CTM from "@/pages/CTM";
import AeronavesShareBrasil from "@/pages/AeronavesShareBrasil";
import { DashboardShareBrasil, PontoShareBrasil, DocumentosShareBrasil, TarefasShareBrasil, ContatosClientesShareBrasil } from "@/pages/ShareBrasil";
import SenhasPastas from "@/pages/SenhasPastas";
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
    if (rotaFinanceiroShare) { setAmbiente("gestor"); setMenuAtivo("financeiro-share"); }
    else if (rotaFinanceiroCotista) { setAmbiente("gestor"); setMenuAtivo("financeiro-cotista"); }
  }, [rotaFinanceiroShare, rotaFinanceiroCotista]);
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
  useEffect(() => { void buscarPerfilColaborador().then((response) => { const papeisDashboard = [response.perfil.tipo_user || "", ...response.funcoes.map((item) => item.funcao)].map((papel) => papel.trim().toLowerCase().replace(/[\s-]+/g, "_")); const papeisMenu = [...papeisDashboard, (response.perfil.departamento || "").trim().toLowerCase().replace(/[\s-]+/g, "_")]; const permitido = papeisDashboard.some((papel) => ["admin", "administrador", "financeiro_master", "gestor_master", "rh_master", "rh"].includes(papel)); const menuGestorPermitido = papeisMenu.some((papel) => ["admin", "administrador", "gestor_master"].includes(papel)); const nome = response.perfil.nome_exibicao || response.perfil.nome_completo; if (nome) setNomeColaborador(nome); setPodeAcessarGestor(permitido); setPodeAcessarMenuGestor(menuGestorPermitido); if (permitido && !navegacaoManual.current && !rotaRecibo && !rotaFinanceiroShare && !rotaFinanceiroCotista && !rotaEnviarPagamento && !rotaMovimentacoes && !salaReuniaoDireta) { setAmbiente("gestor"); setMenuAtivo(menuInicial("gestor")); } }).catch(() => { setPodeAcessarGestor(false); setPodeAcessarMenuGestor(false); }); }, [rotaRecibo, rotaFinanceiroShare, rotaFinanceiroCotista, rotaEnviarPagamento, rotaMovimentacoes, salaReuniaoDireta]);

  const itens = menusPorAmbiente[ambiente];
  const itemAtivo = useMemo(() => itens.find((item) => item.id === menuAtivo) ?? itens[0], [itens, menuAtivo]);
  const trocarAmbiente = (proximo: Ambiente) => { if (proximo === "gestor" && !podeAcessarGestor) return; navegacaoManual.current = true; setAmbiente(proximo); setMenuAtivo(menuInicial(proximo)); if (rotaRecibo || rotaFinanceiroShare || rotaFinanceiroCotista || rotaEnviarPagamento || rotaMovimentacoes) navegar("/"); setMenuAberto(false); };
  const selecionarMenu = (menu: string, aba?: string) => {
    if (ambiente === "gestor" && menu === "gestor" && !podeAcessarMenuGestor) return;
    navegacaoManual.current = true;
    setMenuAtivo(menu);
    if (menu === "enviar-pagamento") { setAmbiente("financeiro"); navegar("/financeiro/enviar-pagamento"); }
    else if (menu === "movimentacoes") { setAmbiente("financeiro"); navegar("/financeiro/movimentacoes"); }
    else if (ambiente === "gestor" && menu === "financeiro-share") navegar(`/gestor/financeiro-share${aba ? `?aba=${encodeURIComponent(aba)}` : ""}`);
    else if (ambiente === "gestor" && menu === "financeiro-cotista") navegar("/gestor/financeiro-cotista");
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
    if (ambiente === "gestor" && menuAtivo === "financeiro-share") return <PaginaFinanceiroShare />;
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

  return <div className="app-noise flex min-h-[100dvh] min-w-0 max-w-[100vw] overflow-x-hidden bg-background"><Sidebar ambiente={ambiente} menuAtivo={menuAtivo} aberta={menuAberto} recolhida={sidebarRecolhida} podeAcessarMenuGestor={podeAcessarMenuGestor} aoFechar={() => setMenuAberto(false)} aoAlternarRecolhimento={() => setSidebarRecolhida((atual) => !atual)} aoSelecionar={selecionarMenu} /><div className="min-w-0 flex-1 bg-background md:pl-[76px]"><BarraSuperior ambiente={ambiente} podeAcessarGestor={podeAcessarGestor} tema={tema} aoTrocarAmbiente={trocarAmbiente} aoAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} aoAbrirMenu={() => setMenuAberto(true)} aoAbrirPerfil={abrirPerfil} aoAbrirRelatorio={abrirRelatorioNotificado} aoSair={sair} /><ScrollArea ref={scrollAreaRef} className="app-main-scroll h-[calc(100dvh-var(--app-header-height))]"><main className="-mx-[6px] -my-[28px] min-w-0 w-full max-w-[1540px] bg-[#080a12] px-[33px] py-[87px]">{renderConteudo()}</main></ScrollArea></div>{nomeColaborador && <WelcomeToast name={nomeColaborador} />}</div>;
}
