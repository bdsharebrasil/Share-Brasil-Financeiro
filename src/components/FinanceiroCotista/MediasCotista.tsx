import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Clock3, Gauge, Plane, Route, TrendingUp } from "lucide-react";
import type { MediasCotista as MediasCotistaData, MediasCotistaMensais } from "@/lib/financeiro-share-api";
import { formatarCentavos } from "@/lib/financeiro-share-api";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";

type Props = {
  mediasMensais: MediasCotistaMensais[];
  mediasPorCotista: Array<{ id: string; nome: string; total: number; media: number }>;
  totalAeronave: string;
  mediaMensal: string;
  mesesConsiderados: number;
};

function numero(valor: number, casas = 2) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function itensMedias(medias: MediasCotistaData) {
  return [
    { label: "Horas Voadas", valor: `${numero(medias.horas_voadas)} h`, detalhe: "Tempo total registrado", Icon: Clock3 },
    { label: "Total de Voos", valor: numero(medias.total_voos, 0), detalhe: "Diários de bordo", Icon: Plane },
    { label: "Total de Pousos", valor: numero(medias.total_pousos, 0), detalhe: "Pousos informados", Icon: Route },
    { label: "Custo por Hora", valor: formatarCentavos(medias.custo_por_hora_centavos), detalhe: "Custos de saída ÷ horas", Icon: Gauge },
    { label: "Dia mais Utilizado", valor: medias.dia_mais_utilizado || "Sem dados", detalhe: "Maior frequência de voos", Icon: CalendarDays },
    { label: "Média Mensal de horas voadas", valor: `${numero(medias.media_mensal_horas)} h`, detalhe: "Média dos meses com voo", Icon: TrendingUp },
    { label: "Custo médio por Voo", valor: formatarCentavos(medias.custo_medio_por_voo_centavos), detalhe: "Custos de saída ÷ voos", Icon: Gauge },
  ];
}

export function MediasCotista({ mediasMensais, mediasPorCotista, totalAeronave, mediaMensal, mesesConsiderados }: Props) {
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const podeRecolher = mediasMensais.length > 1;

  const alternarMes = (mes: string) => setRecolhidos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(mes)) proximo.delete(mes);
    else proximo.add(mes);
    return proximo;
  });

  return <div className="space-y-4">
    {mediasPorCotista.length > 0 && <div className="financeiro-panel overflow-hidden">
      <div className="financeiro-panel-header">
        <div>
          <p className="text-xs font-bold">Médias por cotista</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Rateio das saídas no período, dividido por {mesesConsiderados} mês(es)
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Total da aeronave</p>
          <p className="font-mono text-sm font-bold">{totalAeronave}</p>
          <p className="font-mono text-[10px] text-muted-foreground">Média mensal {mediaMensal}</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {mediasPorCotista.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
            <span className="font-medium">{item.nome}</span>
            <div className="flex gap-4 text-[10px]">
              <span className="text-muted-foreground">Total: {formatarCentavos(item.total)}</span>
              <span className="font-mono font-bold">Média mensal: {formatarCentavos(item.media)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>}
    {mediasMensais.length > 0 && <div className="space-y-3">
      <div><p className="text-sm font-bold">Detalhamento mensal</p><p className="mt-1 text-[10px] text-muted-foreground">Os indicadores abaixo estão separados por mês, dentro do período aplicado.</p></div>
      {mediasMensais.map((mensal) => {
        const recolhido = podeRecolher && recolhidos.has(mensal.mes);
        return <section key={mensal.mes} className="financeiro-panel p-4">
          <div className={`flex flex-wrap items-center justify-between gap-2 ${recolhido ? "" : "mb-3"}`}>
            {podeRecolher ? <button type="button" onClick={() => alternarMes(mensal.mes)} aria-expanded={!recolhido} className="flex min-w-0 items-center gap-2 text-left">
              <h3 className="text-xs font-bold capitalize">{rotuloMesCotista(mensal.mes)}</h3>
              {recolhido ? <ChevronDown size={14} className="shrink-0 text-muted-foreground" /> : <ChevronUp size={14} className="shrink-0 text-muted-foreground" />}
            </button> : <h3 className="text-xs font-bold capitalize">{rotuloMesCotista(mensal.mes)}</h3>}
            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[9px] font-semibold text-primary">{mensal.total_voos} voo(s)</span>
          </div>
          {!recolhido && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {itensMedias(mensal).map(({ label, valor, Icon }) => <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5"><span className="text-[9px] font-semibold text-muted-foreground">{label}</span><span className="flex items-center gap-2 text-right font-mono text-[11px] font-bold"><Icon size={13} className="shrink-0 text-primary" />{valor}</span></div>)}
          </div>}
        </section>;
      })}
    </div>}
  </div>;
}
