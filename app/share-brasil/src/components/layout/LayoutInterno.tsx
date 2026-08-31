import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Perfil from "@/pages/perfil";
import DashboardGestor from "@/pages/DashboardGestor";
import DashboardOperacoes from "@/pages/DashboardOperacoes";
import DashboardFinanceiro from "@/pages/DashboardFinanceiro";
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
import { DashboardShareBrasil, PontoShareBrasil, DocumentosShareBrasil, SenhasShareBrasil, ContatosClientesShareBrasil, TarefasShareBrasil } from "@/pages/ShareBrasil";
import { menusPorAmbiente, menuInicial, type Ambiente, type Tema } from "@/types/navegacao";
import { BarraSuperior } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";

export default function LayoutInterno() {
  const [ambiente, setAmbiente] = useState<Ambiente>("gestor");
  const [menuAtivo, setMenuAtivo] = useState("overview");
  const [tema, setTema] = useState<Tema>(() => (localStorage.getItem("share-brasil-theme") as Tema) || "dark");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);
  const navegar = useNavigate();

  useEffect(() => { document.documentElement.classList.toggle("dark", tema === "dark"); localStorage.setItem("share-brasil-theme", tema); }, [tema]);

  const itens = menusPorAmbiente[ambiente];
  const itemAtivo = useMemo(() => itens.find((item) => item.id === menuAtivo) ?? itens[0], [itens, menuAtivo]);
  const trocarAmbiente = (proximo: Ambiente) => { setAmbiente(proximo); setMenuAtivo(menuInicial(proximo)); setMenuAberto(false); };
  const selecionarMenu = (menu: string) => setMenuAtivo(menu);
  const abrirPerfil = () => setMenuAtivo("perfil");

  const renderConteudo = () => {
    if (menuAtivo === "perfil") return <Perfil tema={tema} onAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} />;
    if (ambiente === "operacoes" && menuAtivo === "agendamentos") return <Agendamentos />;
    if (ambiente === "operacoes" && menuAtivo === "plano-de-voo") return <PlanoDeVoo />;
    if (ambiente === "operacoes" && menuAtivo === "diario-de-bordo") return <DiarioBordo aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes" && menuAtivo === "tripulacao") return <GestaoTripulacao aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes" && menuAtivo === "abastecimentos") return <ControleAbastecimento aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "gestor" && menuAtivo === "ferias") return <Ferias />;
    if (menuAtivo === "recados" && ["gestor", "operacoes", "financeiro"].includes(ambiente)) return <Recados />;
    if (ambiente === "share-brasil" && menuAtivo === "ponto") return <PontoShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "documentos") return <DocumentosShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "senhas") return <SenhasShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "tarefas") return <TarefasShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "contatos-clientes") return <ContatosClientesShareBrasil />;
    if (ambiente === "share-brasil" && menuAtivo === "centro-treinamento") return <CentroTreinamento aoNavegar={selecionarMenu} />;
    if (ambiente === "share-brasil" && menuAtivo === "sala-reuniao") return <SalaReuniao />;
    if (ambiente === "share-brasil" && menuAtivo === "tutorial") return <CentroMateriais categoria="TUTORIAL" />;
    if (ambiente === "share-brasil" && menuAtivo === "treinamento") return <CentroMateriais categoria="TREINAMENTO" />;
    if (menuAtivo !== "overview" && itemAtivo) return <ModuloInterno ambiente={ambiente} menu={itemAtivo} aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes") return <DashboardOperacoes aoNavegar={selecionarMenu} />;
    if (ambiente === "financeiro") return <DashboardFinanceiro aoNavegar={selecionarMenu} />;
    if (ambiente === "share-brasil") return <DashboardShareBrasil aoNavegar={selecionarMenu} />;
    return <DashboardGestor aoNavegar={selecionarMenu} />;
  };

  return <div className="app-noise flex min-h-[100dvh] bg-background"><Sidebar ambiente={ambiente} menuAtivo={menuAtivo} aberta={menuAberto} recolhida={sidebarRecolhida} aoFechar={() => setMenuAberto(false)} aoAlternarRecolhimento={() => setSidebarRecolhida((atual) => !atual)} aoSelecionar={selecionarMenu} /><div className="min-w-0 flex-1 md:pl-[76px]" style={tema === "light" ? { backgroundColor: "rgb(20, 41, 63)" } : undefined}><BarraSuperior ambiente={ambiente} tema={tema} aoTrocarAmbiente={trocarAmbiente} aoAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} aoAbrirMenu={() => setMenuAberto(true)} aoAbrirPerfil={abrirPerfil} /><main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-7 md:py-8" style={tema === "light" ? { backgroundColor: "rgb(183, 197, 211)" } : undefined}>{renderConteudo()}</main></div></div>;
}
