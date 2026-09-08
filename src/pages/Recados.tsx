import { Bell } from "lucide-react";
import { RecadosPanel } from "@/components/dashboard/Recados";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";

export default function Recados() {
  return <div className="route-enter space-y-5"><div><IndicadorPagina>Comunicação interna</IndicadorPagina><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Bell size={21} /></span><div><h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Recados</h1><p className="mt-1 text-xs text-muted-foreground">Publique mensagens para todos ou direcione um recado para um departamento.</p></div></div></div><RecadosPanel /></div>;
}
