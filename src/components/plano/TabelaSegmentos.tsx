import { formatarCoordenada, formatarNumero, formatarProa, minutosParaHoraMinuto } from "@/lib/formato";
import type { Segmento } from "@/lib/tipos";

export function TabelaSegmentos({ segmentos }: { segmentos: Segmento[] }) {
  if (!segmentos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Informe ADEP e ADES com coordenadas cadastradas para calcular os segmentos.
      </p>
    );
  }

  return (
    <>
      {/* Tabela — telas médias e grandes */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Seq</th>
              <th className="py-2 pr-3">Ponto</th>
              <th className="py-2 pr-3">Coordenadas</th>
              <th className="py-2 pr-3 text-right">Dist. NM</th>
              <th className="py-2 pr-3 text-right">Dist. km</th>
              <th className="py-2 pr-3 text-right">Proa verdadeira</th>
              <th className="py-2 text-right">ETE</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {segmentos.map((s) => (
              <tr key={s.seq} className="border-b border-border/60">
                <td className="py-2 pr-3 text-muted-foreground">{s.seq}</td>
                <td className="py-2 pr-3 font-semibold text-foreground">{s.para}</td>
                <td className="py-2 pr-3 text-muted-foreground">{formatarCoordenada(s.lat, s.lon)}</td>
                <td className="py-2 pr-3 text-right">{formatarNumero(s.distanciaNM)}</td>
                <td className="py-2 pr-3 text-right">{formatarNumero(s.distanciaKm)}</td>
                <td className="py-2 pr-3 text-right">{s.seq === 1 ? "—" : formatarProa(s.proaVerdadeira)}</td>
                <td className="py-2 text-right">{minutosParaHoraMinuto(s.minutos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões — celular */}
      <ul className="space-y-2 md:hidden">
        {segmentos.map((s) => (
          <li key={s.seq} className="rounded-lg border border-border bg-background p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p className="truncate font-mono text-sm font-semibold text-foreground">
                {s.seq}. {s.de} → {s.para}
              </p>
              <span className="shrink-0 font-mono text-xs text-primary">{minutosParaHoraMinuto(s.minutos)}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatarCoordenada(s.lat, s.lon)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatarNumero(s.distanciaNM)} NM · {formatarNumero(s.distanciaKm)} km ·{" "}
              {s.seq === 1 ? "—" : `${formatarProa(s.proaVerdadeira)} verdadeira`}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Proas apresentadas são verdadeiras. A proa magnética só será exibida quando houver declinação de fonte
        confiável.
      </p>
    </>
  );
}
