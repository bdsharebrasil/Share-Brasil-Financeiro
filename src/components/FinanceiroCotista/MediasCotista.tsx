import { CalendarDays, Clock3, Gauge, Plane, Route, TrendingUp } from "lucide-react";
import type { MediasCotista as MediasCotistaData } from "@/lib/financeiro-share-api";
import { formatarCentavos } from "@/lib/financeiro-share-api";

type Props = { medias: MediasCotistaData | null };

function numero(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function MediasCotista({ medias }: Props) {
  const itens = medias ? [
    { label: "Horas Voadas", valor: `${numero(medias.horas_voadas)} h`, detalhe: "Tempo total registrado", Icon: Clock3 },
    { label: "Total de Voos", valor: numero(medias.total_voos, 0), detalhe: "Diários de bordo", Icon: Plane },
    { label: "Total de Pousos", valor: numero(medias.total_pousos, 0), detalhe: "Pousos informados", Icon: Route },
    { label: "Custo por Hora", valor: formatarCentavos(medias.custo_por_hora_centavos), detalhe: "Custos de saída ÷ horas", Icon: Gauge },
    { label: "Dia mais Utilizado", valor: medias.dia_mais_utilizado || "Sem dados", detalhe: "Maior frequência de voos", Icon: CalendarDays },
    { label: "Média Mensal de horas voadas", valor: `${numero(medias.media_mensal_horas)} h`, detalhe: "Média dos meses com voo", Icon: TrendingUp },
    { label: "Custo médio por Voo", valor: formatarCentavos(medias.custo_medio_por_voo_centavos), detalhe: "Custos de saída ÷ voos", Icon: Gauge },
  ] : [];

  return <div className="space-y-4">
    <div className="financeiro-panel p-5">
      <div className="mb-5">
        <p className="text-sm font-bold">Médias operacionais</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Indicadores calculados a partir dos diários de bordo e dos custos exibidos nesta aeronave.</p>
      </div>
      {medias ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {itens.map(({ label, valor, detalhe, Icon }) => <div key={label} className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><Icon size={15} className="shrink-0 text-primary" /></div>
          <p className="mt-3 break-words font-mono text-xl font-bold text-foreground">{valor}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{detalhe}</p>
        </div>)}
      </div> : <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-xs text-muted-foreground">Nenhuma média disponível para esta aeronave.</div>}
    </div>
  </div>;
}
