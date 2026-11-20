import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { buscarPerfilColaborador, type PerfilColaboradorResponse } from "@/lib/colaborador-api";
import { menusPorAmbiente, nomesAmbiente, type Ambiente, type ItemMenu } from "@/types/navegacao";
import { LogoShare } from "@/components/layout/TopBar";
import { ScrollArea } from "@/components/ui/scroll-area";
import "./sidebar-aba.css";

const gruposFixos = ["Navegação principal", "Rotinas do departamento"];

type PropriedadesSidebar = {
  ambiente: Ambiente;
  menuAtivo: string;
  aberta: boolean;
  recolhida: boolean;
  podeAcessarMenuGestor: boolean;
  aoFechar: () => void;
  aoAlternarRecolhimento: () => void;
  aoSelecionar: (menu: string) => void;
};

function iniciaisDoNome(nome?: string | null) {
  return nome?.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "CO";
}

function agruparMenus(itens: ItemMenu[]) {
  return [
    { title: gruposFixos[0], items: itens.slice(0, 1) },
    { title: gruposFixos[1], items: itens.slice(1) },
  ];
}

export function Sidebar({ ambiente, menuAtivo, aberta, recolhida, podeAcessarMenuGestor, aoFechar, aoAlternarRecolhimento, aoSelecionar }: PropriedadesSidebar) {
  const [gruposAbertos, setGruposAbertos] = useState(gruposFixos);
  const [dados, setDados] = useState<PerfilColaboradorResponse | null>(null);
  const itens = useMemo(() => menusPorAmbiente[ambiente].filter((item) => item.id !== "gestor" || podeAcessarMenuGestor).map((item) => ({ ...item, badge: undefined })), [ambiente, podeAcessarMenuGestor]);
  const grupos = useMemo(() => agruparMenus(itens), [itens]);

  useEffect(() => {
    let ativo = true;
    void buscarPerfilColaborador().then((response) => {
      if (ativo) setDados(response);
    }).catch(() => {
      if (ativo) setDados(null);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => { setGruposAbertos(gruposFixos); }, [ambiente]);

  const selecionar = (id: string) => {
    aoSelecionar(id);
    aoFechar();
  };

  const nome = dados?.perfil.nome_exibicao || dados?.perfil.nome_completo || "Colaborador";
  const funcao = dados?.funcoes?.[0]?.funcao || dados?.perfil.tipo_user || "Colaborador";
  const avatar = dados?.perfil.foto_url || "/icon.pilot.png";

  const renderItem = (item: ItemMenu, compacto = false) => {
    const Icon = item.icon;
    const selecionado = menuAtivo === item.id;
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => selecionar(item.id)}
        title={compacto ? item.label : undefined}
        className={cn(
          compacto
            ? "group relative flex h-10 w-10 items-center justify-center rounded-full border"
            : "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left",
          "text-[11px] font-semibold transition-all",
          selecionado
            ? "border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-transparent text-sidebar-foreground/70 hover:-translate-y-0.5 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon size={item.id === "financeiro-cotista" ? (compacto ? 16 : 14) : (compacto ? 18 : 16)} strokeWidth={selecionado ? 2.3 : 1.8} />
        {!compacto && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {compacto && <span className="pointer-events-none absolute left-full z-[60] ml-3 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2.5 py-1 text-xs text-sidebar-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{item.label}</span>}
      </button>
    );
  };

  const renderItemDesktop = (item: ItemMenu) => {
    const Icon = item.icon;
    const selecionado = menuAtivo === item.id;
    const tamanho = item.id === "financeiro-cotista" ? (recolhida ? 16 : 14) : (recolhida ? 18 : 16);
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => selecionar(item.id)}
        aria-current={selecionado ? "page" : undefined}
        aria-label={recolhida ? item.label : undefined}
        className={cn("sb-tab", recolhida && "sb-tab--rail")}
      >
        <Icon size={tamanho} strokeWidth={selecionado ? 2.3 : 1.8} />
        {recolhida ? <span className="sb-tab-tip">{item.label}</span> : <span className="sb-tab-label">{item.label}</span>}
      </button>
    );
  };

  const renderMenuCompleto = (mostrarPerfil = true) => (
    <nav className="space-y-4">
      {mostrarPerfil && <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-extrabold text-primary"><img src={avatar} alt={`Foto de ${nome}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/icon.pilot.png"; }} /></div>
        <div className="min-w-0"><p className="truncate text-xs font-bold text-sidebar-foreground">{nome}</p><p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/55">{funcao}</p></div>
      </div>}
      {grupos.map((grupo) => (
        <Collapsible
          key={grupo.title}
          open={gruposAbertos.includes(grupo.title)}
          onOpenChange={() => setGruposAbertos((atual) => atual.includes(grupo.title) ? atual.filter((item) => item !== grupo.title) : [...atual, grupo.title])}
          className="rounded-xl border border-sidebar-border bg-sidebar-accent/25"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3.5 py-3 text-left text-[10px] font-bold uppercase tracking-[.12em] text-sidebar-foreground/60">
            <span>{grupo.title}</span>
            {gruposAbertos.includes(grupo.title) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 px-2 pb-2">
            {grupo.items.map((item) => renderItem(item))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );

  return (
    <>
      <div className="app-sidebar fixed bottom-0 left-[var(--safe-area-left)] top-[var(--app-header-height)] z-30 hidden w-[var(--sidebar-w,76px)] flex-col bg-[rgb(7,17,25)] py-4 md:flex">
        <div className={cn("flex items-center gap-3 px-3", !recolhida && "pl-4")} title={recolhida ? nome : undefined}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-extrabold text-primary"><img src={avatar} alt={`Foto de ${nome}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/icon.pilot.png"; }} /></div>
          {!recolhida && <div className="min-w-0"><p className="truncate text-xs font-bold text-sidebar-foreground">{nome}</p><p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/55">{funcao}</p></div>}
        </div>
        <nav aria-label="Menu principal" className={cn("sb-nav flex-1", !recolhida && "sb-nav--scroll")}>{itens.map(renderItemDesktop)}</nav>
        <div className="sb-footer">
          <button type="button" aria-label={recolhida ? "Expandir menu" : "Recolher menu"} title={recolhida ? "Expandir menu" : undefined} onClick={aoAlternarRecolhimento} className={cn("sb-toggle", recolhida && "sb-toggle--rail")}>
            {recolhida ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Recolher menu</span></>}
          </button>
        </div>
      </div>

      <Sheet open={aberta} onOpenChange={(open) => !open && aoFechar()}>
        <SheetContent side="left" className="app-sidebar-drawer w-[min(20rem,calc(100vw-1rem))] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <div className="safe-area-header flex items-center border-b border-sidebar-border px-6">
            <LogoShare inversa />
            <span className="ml-auto rounded-md border border-sidebar-border px-2 py-1 font-mono text-[9px] text-sidebar-foreground/40">{nomesAmbiente[ambiente]}</span>
          </div>
          <ScrollArea className="h-[calc(100dvh-var(--app-header-height))]"><div className="p-4 pb-[calc(1rem+var(--safe-area-bottom))]">{renderMenuCompleto(false)}</div></ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}