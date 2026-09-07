import { ArrowUpRight, BookOpen, GraduationCap, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";

const areas = [
  { id: "sala-reuniao", title: "Sala de reunião", status: "Ao vivo", description: "Reúna a equipe em uma sala virtual com vídeo, compartilhamento de tela, lousa colaborativa e chat.", icon: Video, tone: "border-emerald-400/40 bg-emerald-400/[.06]" },
  { id: "treinamento", title: "Treinamento", status: "Disponível", description: "Organize trilhas de capacitação, conteúdos, materiais e processos de desenvolvimento da equipe.", icon: GraduationCap, tone: "border-violet-400/45 bg-violet-400/[.06]" },
  { id: "tutorial", title: "Tutorial", status: "Disponível", description: "Consulte vídeos, PDFs e páginas HTML com instruções do sistema e dicas para os usuários.", icon: BookOpen, tone: "border-sky-400/45 bg-sky-400/[.06]" },
] as const;

export default function CentroTreinamento({ aoNavegar }: { aoNavegar: (menu: string) => void }) {
  return <div className="route-enter space-y-6">
    <div><IndicadorPagina>Share Brasil / Centro de Treinamento</IndicadorPagina><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Centro de Treinamento</h1><p className="mt-1.5 text-xs text-muted-foreground">Acesse os recursos disponíveis para a equipe.</p></div>
    <div className="grid gap-4 md:grid-cols-3">
      {areas.map(({ id, title, status, description, icon: Icon, tone }) => <section key={id} className={`flex min-h-[250px] flex-col rounded-xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${tone}`}>
        <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Icon size={20} /></div><span className="rounded-full border border-border bg-background/30 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{status}</span></div>
        <h2 className="mt-7 text-xl font-extrabold tracking-[-.03em]">{title}</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>
        <Button type="button" variant="link" onClick={() => aoNavegar(id)} className="mt-auto justify-start gap-1 px-0 pt-5 text-xs font-bold text-primary">Acessar área <ArrowUpRight size={14} /></Button>
      </section>)}
    </div>
  </div>;
}
