import { useEffect, useState } from "react";
import { Bell, CloudSun, Clock3, Globe2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { nomesAmbiente, type Ambiente, type Tema } from "@/types/navegacao";
import { buscarContagemMensagensNaoLidas, buscarPerfilColaborador, carregarArquivoColaborador } from "@/lib/colaborador-api";

const AVATAR_PADRAO = "/icon.pilot.png";

export function LogoShare({ compacto = false }: { compacto?: boolean }) {
  return <div className={cn("flex items-center gap-3", compacto && "gap-0")} aria-label="Share Brasil">{!compacto && <div className="leading-none"><p className="text-[14px] font-extrabold tracking-[.22em] text-foreground">SHARE</p><p className="mt-1 text-[10px] font-semibold italic tracking-[.12em] text-primary">Brasil</p></div>}</div>;
}

export function BarraSuperior({ ambiente, tema, aoTrocarAmbiente, aoAlternarTema, aoAbrirMenu, aoAbrirPerfil }: { ambiente: Ambiente; tema: Tema; aoTrocarAmbiente: (ambiente: Ambiente) => void; aoAlternarTema: () => void; aoAbrirMenu: () => void; aoAbrirPerfil: () => void }) {
  const [horario, setHorario] = useState(new Date());
  const [avatar, setAvatar] = useState(AVATAR_PADRAO);
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setHorario(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ativo = true;
    void buscarContagemMensagensNaoLidas().then(({ unread }) => {
      if (ativo) setMensagensNaoLidas(unread);
    }).catch(() => {
      if (ativo) setMensagensNaoLidas(0);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    let objectUrl: string | null = null;
    void buscarPerfilColaborador().then(async (response) => {
      if (!ativo) return;
      if (!response.perfil.foto_url) {
        setAvatar(AVATAR_PADRAO);
        return;
      }
      const blob = await carregarArquivoColaborador("/api/colaborador/foto");
      if (!ativo) return;
      objectUrl = URL.createObjectURL(blob);
      setAvatar(objectUrl);
    }).catch(() => {
      if (ativo) setAvatar(AVATAR_PADRAO);
    });
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const horaLocal = horario.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const horaUtc = horario.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return <header className="sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-7" style={tema === "light" ? { backgroundColor: "rgb(20, 41, 63)" } : undefined}><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={aoAbrirMenu} aria-label="Abrir menu" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"><Menu size={20} /></button><div className="md:hidden"><LogoShare compacto /></div><div className="hidden min-w-0 items-center gap-1 rounded-xl border border-border bg-card/70 p-1 md:flex" style={tema === "light" ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}>{(["gestor", "operacoes", "financeiro"] as Ambiente[]).map((item) => <button type="button" key={item} onClick={() => aoTrocarAmbiente(item)} className={cn("rounded-lg px-3 py-2 text-[11px] font-bold transition-all", ambiente === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>{nomesAmbiente[item]}</button>)}</div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground lg:flex" title="Horário local do dispositivo"><Clock3 size={13} className="text-primary" /><span className="text-foreground">{horaLocal}</span><span className="text-primary/70">Local</span></div><div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 font-mono text-[10px] text-muted-foreground xl:flex" title="Horário Universal Coordenado"><Globe2 size={13} className="text-primary" /><span className="text-foreground">{horaUtc}</span><span className="text-primary/70">UTC</span></div><div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-2.5 py-2 text-[10px] text-muted-foreground 2xl:flex"><CloudSun size={14} className="text-[#f1c348]" /><span>São Paulo</span><strong className="font-mono text-foreground">22°C</strong></div><button type="button" aria-label="Abrir notificações" className="relative rounded-lg border border-transparent p-2 text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"><Bell size={17} />{mensagensNaoLidas > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f1c348]" />}</button><button type="button" onClick={aoAbrirPerfil} aria-label="Abrir meu perfil" className="ml-1 h-9 w-9 overflow-hidden rounded-lg bg-[#0b4a78] ring-2 ring-primary/10"><img src={avatar} alt="Avatar do perfil" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = AVATAR_PADRAO; }} /></button></div></header>;
}
