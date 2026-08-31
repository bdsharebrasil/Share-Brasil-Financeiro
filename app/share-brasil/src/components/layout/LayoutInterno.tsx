import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Perfil from "@/pages/perfil";
import DashboardGestor from "@/pages/interno/DashboardGestor";
import DashboardOperacoes from "@/pages/interno/DashboardOperacoes";
import DashboardFinanceiro from "@/pages/interno/DashboardFinanceiro";
import ModuloInterno from "@/pages/interno/ModuloInterno";
import Agendamentos from "@/pages/interno/Agendamentos";
import Ferias from "@/pages/interno/Ferias";
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
    if (ambiente === "gestor" && menuAtivo === "ferias") return <Ferias />;
    if (menuAtivo !== "overview" && itemAtivo) return <ModuloInterno ambiente={ambiente} menu={itemAtivo} aoVoltar={() => setMenuAtivo("overview")} />;
    if (ambiente === "operacoes") return <DashboardOperacoes aoNavegar={selecionarMenu} />;
    if (ambiente === "financeiro") return <DashboardFinanceiro aoNavegar={selecionarMenu} />;
    return <DashboardGestor aoNavegar={selecionarMenu} />;
  };

  return <div className="app-noise flex min-h-[100dvh] bg-background"><Sidebar ambiente={ambiente} menuAtivo={menuAtivo} aberta={menuAberto} recolhida={sidebarRecolhida} aoFechar={() => setMenuAberto(false)} aoAlternarRecolhimento={() => setSidebarRecolhida((atual) => !atual)} aoSelecionar={selecionarMenu} /><div className="min-w-0 flex-1 md:pl-[76px]"><BarraSuperior ambiente={ambiente} tema={tema} aoTrocarAmbiente={trocarAmbiente} aoAlternarTema={() => setTema(tema === "dark" ? "light" : "dark")} aoAbrirMenu={() => setMenuAberto(true)} aoAbrirPerfil={abrirPerfil} /><main className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-7 md:py-8">{renderConteudo()}</main></div></div>;
}
