import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Mail, UserRound } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { buscarPerfilColaborador, type PerfilColaboradorResponse } from "@/lib/colaborador-api";
import { menusPorAmbiente, nomesAmbiente, type Ambiente, type ItemMenu } from "@/types/navegacao";
import { LogoShare } from "@/components/layout/TopBar";

const gruposFixos = ["Navegação principal", "Rotinas do departamento"];

type PropriedadesSidebar = {
  ambiente: Ambiente;
  menuAtivo: string;
  aberta: boolean;
  recolhida: boolean;
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

export function Sidebar({ ambiente, menuAtivo, aberta, recolhida, aoFechar, aoAlternarRecolhimento, aoSelecionar }: PropriedadesSidebar) {
  const [gruposAbertos, setGruposAbertos] = useState(gruposFixos);
  const [dados, setDados] = useState<PerfilColaboradorResponse | null>(null);
  const itens = useMemo(() => menusPorAmbiente[ambiente].map((item) => ({ ...item, badge: undefined })), [ambiente]);
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
            ? "border-sidebar-primary bg-sidebar-primary/15 text-sidebar-primary"
            : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon size={compacto ? 18 : 16} strokeWidth={selecionado ? 2.3 : 1.8} />
        {!compacto && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {compacto && <span className="pointer-events-none absolute left-full z-[60] ml-3 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2.5 py-1 text-xs text-sidebar-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{item.label}</span>}
      </button>
    );
  };

  const renderMenuCompleto = (mostrarPerfil = true) => (
    <nav className="space-y-4">
      {mostrarPerfil && <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-extrabold text-primary"><img src={avatar} alt={`Foto de ${nome}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = "/icon.pilot.png"; }} /></div>
        <div className="min-w-0"><p className="truncate text-xs font-bold text-sidebar-foreground">{nome}</p><p className="mt-0.5 truncate text-[10px] text-sidebar-foreground/55">{funcao}</p><p className="mt-0.5 truncate text-[9px] text-sidebar-foreground/40">Dados sincronizados pelo D1</p></div>
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
      <div className="fixed left-[var(--safe-area-left)] top-[calc(68px+var(--safe-area-top))] z-30 hidden h-[calc(100dvh-68px-var(--safe-area-top))] w-[76px] flex-col items-center border-r border-sidebar-border bg-sidebar py-4 md:flex">
        {recolhida ? (
          <button type="button" aria-label="Expandir menu" onClick={aoAlternarRecolhimento} className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg hover:bg-sidebar-accent">
            <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <button type="button" aria-label="Recolher menu" onClick={aoAlternarRecolhimento} className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent">
              <ChevronLeft size={16} />
            </button>
            <nav className="flex w-full flex-col items-center gap-3 px-2">{itens.map((item) => renderItem(item, true))}</nav>
          </>
        )}
      </div>

      <Sheet open={aberta} onOpenChange={(open) => !open && aoFechar()}>
        <SheetContent side="left" className="w-80 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <div className="safe-area-header flex items-center border-b border-sidebar-border px-6">
            <LogoShare />
            <span className="ml-auto rounded-md border border-sidebar-border px-2 py-1 font-mono text-[9px] text-sidebar-foreground/40">{nomesAmbiente[ambiente]}</span>
          </div>
          <div className="h-[calc(100dvh-68px-var(--safe-area-top))] overflow-y-auto p-4 pb-[calc(1rem+var(--safe-area-bottom))]">{renderMenuCompleto(false)}</div>
        </SheetContent>
      </Sheet>
      <span className="sr-only"><Mail aria-hidden="true" />Dados do menu carregados do D1</span>
    </>
  );
}
