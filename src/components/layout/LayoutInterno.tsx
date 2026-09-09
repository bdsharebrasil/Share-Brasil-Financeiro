import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Perfil from "@/pages/perfil";
import DashboardOperacoes from "@/pages/DashboardOperacoes";
import DashboardFinanceiro from "@/pages/DashboardFinanceiro";
import DashboardGestorFinanceiro from "@/pages/DashboardGestorFinanceiro";
import DashboardGestorResumo from "@/pages/DashboardGestorResumo";
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
import GestaoColaborador from "@/pages/GestaoColaborador";
import EnviarPagamento from "@/pages/EnviarPagamento";
import ConfiguracoesGestor from "@/pages/ConfiguracoesGestor";
import RelatorioDespesaViagem from "@/pages/RelatorioDespesaViagem";
import Emails from "@/pages/Emails";
import Aerodromos from "@/pages/Aerodromos";
import CTM from "@/pages/CTM";
import AeronavesShareBrasil from "@/pages/AeronavesShareBrasil";
import { DashboardShareBrasil, PontoShareBrasil, DocumentosShareBrasil, TarefasShareBrasil, ContatosClientesShareBrasil } from "@/pages/ShareBrasil";
import SenhasPastas from "@/pages/SenhasPastas";
import { menusPorAmbiente, menuInicial, type Ambiente, type Tema } from "@/types/navegacao";
import { BarraSuperior } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { buscarPerfilColaborador } from "@/lib/colaborador-api";
import { supabase } from "@/lib/supabase";
import WelcomeToast from "@/components/layout/WelcomeToast";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function LayoutInterno() {
  const [ambiente, setAmbiente] = useState<Ambiente>("share-brasil");
  const [podeAcessarGestor, setPodeAcessarGestor] = useState(false);
  const [nomeColaborador, setNomeColaborador] = useState<string | null>(null);
  const [menuAtivo, setMenuAtivo] = useState("overview");
  const [tema, setTema] = useState<Tema>(() => (localStorage.getItem("share-brasil-theme") as Tema) || "dark");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const navegar = useNavigate();
  const localizacao = useLocation();
  const rotaRecibo = localizacao.pathname === "/financeiro/emissao-recibo";
  const rotaFinanceiroShare = localizacao.pathname.startsWith("/gestor/financeiro-share");
  const rotaFinanceiroCotista = localizacao.pathname === "/gestor/financeiro-cotista";
  const rotaEnviarPagamento = localizacao.pathname === "/financeiro/enviar-pagamento";
  const salaReuniaoDireta = Boolean(new URLSearchParams(localizacao.search).get("sala_reuniao"));

  useEffect(() => { document.documentElement.classList.toggle("dark", tema === "dark"); localStorage.setItem("share-brasil-theme", tema); }, [tema]);
  useEffect(() => { if (rotaRecibo) { setAmbiente("financeiro"); setMenuAtivo("recibos"); } else if (menuAtivo === "recibos") { setMenuAtivo("overview"); } }, [rotaRecibo]);
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
  useEffect(() => { if (salaReuniaoDireta) { setAmbiente("share-brasil"); setMenuAtivo("sala-reuniao"); } }, [salaReuniaoDireta]);
  useEffect(() => { void buscarPerfilColaborador().then((response) => { const permitido = response.funcoes.some((item) => ["admin", "financeiro_master", "gestor_master", "rh_master", "rh"].includes(item.funcao.trim().toLowerCase().replace(/[\s-]+/g, "_"))); const nome = response.perfil.nome_exibicao || response.perfil.nome_completo; if (nome) setNomeColaborador(nome); setPodeAcessarGestor(permitido); if (permitido && !rotaRecibo && !rotaFinanceiroShare && !rotaFinanceiroCotista && !rotaEnviarPagamento && !salaReuniaoDireta) { setAmbiente("gestor"); setMenuAtivo(menuInicial("gestor")); } }).catch(() => setPodeAcessarGestor(false)); }, [rotaRecibo, rotaFinanceiroShare, rotaFinanceiroCotista, rotaEnviarPagamento, salaReuniaoDireta]);

  const itens = menusPorAmbiente[ambiente];
  const itemAtivo = useMemo(() => itens.find((item) => item.id === menuAtivo) ?? itens[0], [itens, menuAtivo]);
  const trocarAmbiente = (proximo: Ambiente) => { if (proximo === "gestor" && !podeAcessarGestor) return; setAmbiente(proximo); setMenuAtivo(menuInicial(proximo)); if (rotaRecibo || rotaFinanceiroShare || rotaFinanceiroCotista || rotaEnviarPagamento) navegar("/"); setMenuAberto(false); };
  const selecionarMenu = (menu: string) => {
    setMenuAtivo(menu);
    if (menu === "enviar-pagamento") { setAmbiente("financeiro"); navegar("/financeiro/enviar-pagamento"); }
    else if (ambiente === "gestor" && menu === "financeiro-share") navegar("/gestor/financeiro-share");
    else if (ambiente === "gestor" && menu === "financeiro-cotista") navegar("/gestor/financeiro-cotista");
    else if (menu === "recibos") navegar("/financeiro/emissao-recibo");
    else if (rotaRecibo || rotaFinanceiroShare || rotaFinanceiroCotista || rotaEnviarPagamento) navegar("/");
  };
  const abrirPerfil = () => { setMenuAtivo("perfil"); if (rotaRecibo || rotaEnviarPagamento) navegar("/"); };
  const abrirMensagens = () => { setAmbiente("financeiro"); setMenuAtivo("email"); setMenuAberto(false); if (rotaRecibo || rotaEnviarPagamento) navegar("/"); };
  const sair = async () => { await supabase.auth.signOut({ scope: "local" }).catch(() => undefined); navegar("/login", { replace: true }); };

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
    if (ambiente === "gestor" && menuAtivo === "financeiro-share") return <PaginaFinanceiroShare />;
    if (ambiente === "gestor" && menuAtivo === "financeiro-cotista") return <FinanceiroCotista />;

    if (ambiente === "financeiro" && menuAtivo === "enviar-pagamento") return <EnviarPagamento />;
    if (ambiente === "financeiro" && menuAtivo === "recibos") return <EmissaoRecibo aoVoltar={() => selecionarMenu("overview")} />;
    if (ambiente === "financeiro" && menuAtivo === "despesas") return <RelatorioDespesaViagem aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "financeiro" && menuAtivo === "email") return <Emails />;
    if (ambiente === "gestor" && podeAcessarGestor && menuAtivo === "gestao-colaborador") return <GestaoColaborador />;
    if (ambiente === "gestor" && podeAcessarGestor && menuAtivo === "configuracoes") return <ConfiguracoesGestor />;
    if (menuAtivo === "recados" && ["gestor", "operacoes", "financeiro"].includes(ambiente)) return <Recados />;
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

  return <div className="app-noise flex min-h-[100dvh] bg-background"><Sidebar ambiente={ambiente} menuAtivo={menuAtivo} aberta={menuAberto} recolhida={sidebarRecolhida} aoFechar={() => setMenuAberto(false)} aoAlternarRecolhimento={() => setSidebarRecolhida((atual) => !atual)} aoSelecionar={selecionarMenu} /><div className="min-w-0 flex-1 bg-background md:pl-[76px]"><BarraSuperior ambiente={ambiente} podeAcessarGestor={podeAcessarGestor} tema={tema} aoTrocarAmbiente={trocarAmbiente} aoAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} aoAbrirMenu={() => setMenuAberto(true)} aoAbrirPerfil={abrirPerfil} aoAbrirMensagens={abrirMensagens} aoSair={sair} /><ScrollArea className="h-[calc(100dvh-68px)]"><main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-7 md:py-8">{renderConteudo()}</main></ScrollArea></div>{nomeColaborador && <WelcomeToast name={nomeColaborador} />}</div>;
}
