import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Mail, UserRound } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { buscarPerfilColaborador, type PerfilColaboradorResponse } from "@/lib/colaborador-api";
import { menusPorAmbiente, nomesAmbiente, type Ambiente, type ItemMenu } from "@/types/navegacao";
import { LogoShare } from "@/components/layout/TopBar";
import { ScrollArea } from "@/components/ui/scroll-area";

const gruposFixos = ["Navegação principal", "Rotinas do departamento"];

type PropriedadesSidebar = {
  ambiente: Ambiente;
  menuAtivo: string;
  aberta: boolean;
  podeAcessarMenuGestor: boolean;
  aoFechar: () => void;
  aoSelecionar: (menu: string) => void;
};

function iniciaisDoNome(nome?: string | null) {
  return nome?.split(" ").filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "CO";
}

function itensDoAmbiente(ambiente: Ambiente, podeAcessarMenuGestor: boolean) {
  return menusPorAmbiente[ambiente].filter((item) => item.id !== "gestor" || podeAcessarMenuGestor).map((item) => ({ ...item, badge: undefined }));
}

function agruparMenus(itens: ItemMenu[]) {
  return [
    { title: gruposFixos[0], items: itens.slice(0, 1) },
    { title: gruposFixos[1], items: itens.slice(1) },
  ];
}

export function Sidebar({ ambiente, menuAtivo, aberta, podeAcessarMenuGestor, aoFechar, aoSelecionar }: PropriedadesSidebar) {
  const [gruposAbertos, setGruposAbertos] = useState(gruposFixos);
  const [dados, setDados] = useState<PerfilColaboradorResponse | null>(null);
  const itens = useMemo(() => itensDoAmbiente(ambiente, podeAcessarMenuGestor), [ambiente, podeAcessarMenuGestor]);
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

  const renderItem = (item: ItemMenu) => {
    const Icon = item.icon;
    const selecionado = menuAtivo === item.id;
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => selecionar(item.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left",
          "text-[11px] font-semibold transition-all",
          selecionado
            ? "border-[rgba(21,73,97,1)] bg-[rgba(7,24,54,1)] text-white shadow-md"
            : "border-transparent text-sidebar-foreground/70 hover:-translate-y-0.5 hover:border-sidebar-border hover:bg-[hsl(198,100%,18%)] hover:text-white",
        )}
      >
        <Icon size={item.id === "financeiro-cotista" ? 14 : 16} strokeWidth={selecionado ? 2.3 : 1.8} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
      <Sheet open={aberta} onOpenChange={(open) => !open && aoFechar()}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-1rem))] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <div className="safe-area-header flex items-center border-b border-sidebar-border px-6">
            <LogoShare />
            <span className="ml-auto rounded-md border border-sidebar-border px-2 py-1 font-mono text-[9px] text-sidebar-foreground/40">{nomesAmbiente[ambiente]}</span>
          </div>
          <ScrollArea className="h-[calc(100dvh-var(--app-header-height))]"><div className="p-4 pb-[calc(1rem+var(--safe-area-bottom))]">{renderMenuCompleto(false)}</div></ScrollArea>
        </SheetContent>
      </Sheet>
      <span className="sr-only"><Mail aria-hidden="true" />Dados do menu carregados do D1</span>
    </>
  );
}

type PropriedadesMenuSuperior = {
  ambiente: Ambiente;
  menuAtivo: string;
  podeAcessarMenuGestor: boolean;
  aoSelecionar: (menu: string) => void;
};

export function MenuSuperior({ ambiente, menuAtivo, podeAcessarMenuGestor, aoSelecionar }: PropriedadesMenuSuperior) {
  const itens = itensDoAmbiente(ambiente, podeAcessarMenuGestor);
  return (
    <nav aria-label="Menu do módulo" className="hidden shrink-0 overflow-x-auto border-b border-[rgba(26,34,34,0.87)] bg-sidebar px-7 py-2.5 md:block">
      <div className="flex w-max min-w-full gap-1.5">
        {itens.map((item) => {
          const Icon = item.icon;
          const selecionado = menuAtivo === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selecionado ? "page" : undefined}
              onClick={() => aoSelecionar(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[11px] font-semibold transition-all",
                selecionado
                  ? "border-[rgba(21,73,97,1)] bg-[rgba(7,24,54,1)] text-white shadow-md"
                  : "border-transparent text-sidebar-foreground/70 hover:border-sidebar-border hover:bg-[hsl(198,100%,18%)] hover:text-white",
              )}
            >
              <Icon size={15} strokeWidth={selecionado ? 2.3 : 1.8} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
