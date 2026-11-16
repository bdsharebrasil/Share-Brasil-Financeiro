import {
  type EspelhoPonto as DadosEspelho,
  horasPonto,
  rotulosPonto,
  dataPonto,
} from "@/lib/ponto-api";
import { Button } from "@/components/ui/button";
const campos = ["entrada_hora", "inicio_almoco", "fim_almoco", "saida_hora"];
export function EtiquetaPonto({ valor }: { valor: string }) {
  const pendente =
    /PENDENTE|INCOMPLETA|ATRASO|AUSENCIA|INSUFICIENTE|NAO_REGISTRADA|INCONSISTENTES|DUPLICADOS/.test(
      valor,
    );
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[10px] ${pendente ? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-border bg-secondary/40 text-muted-foreground"}`}
    >
      {rotulosPonto[valor] || valor.replace(/_/g, " ")}
    </span>
  );
}
export function exportarEspelhoPonto(dados: DadosEspelho) {
  const csv = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const linhas = [
    [
      "Competência",
      dados.competencia,
      "Colaborador",
      dados.user_id,
      "Situação",
      dados.fechamento?.status || "EM_CONFERENCIA",
    ],
    [
      "Data",
      "Entrada original",
      "Intervalo original",
      "Retorno original",
      "Saída original",
      "Entrada tratada",
      "Intervalo tratado",
      "Retorno tratado",
      "Saída tratada",
      "Previsto",
      "Trabalhado",
      "Extra aprovada",
      "Extra pendente",
      "Noturno reduzido",
      "Sobreaviso equivalente",
      "Banco provisório",
      "Ocorrências",
    ],
    ...dados.dias.map((d) => [
      d.data,
      ...campos.map((c) => d.original?.[c] || ""),
      ...campos.map((c) => d.linha?.[c] || ""),
      horasPonto(d.previstos_min),
      horasPonto(d.trabalhados_min),
      horasPonto(d.extras_aprovadas_min),
      horasPonto(d.extras_pendentes_min),
      horasPonto(d.noturnos_reduzidos_min),
      horasPonto(d.sobreaviso_equivalente_min),
      horasPonto(d.banco_min),
      d.alertas.map((a) => rotulosPonto[a] || a).join(" / "),
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(["\ufeff", linhas.map((l) => l.map(csv).join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `espelho-ponto-${dados.competencia}-${dados.user_id.replace(/[^a-z0-9-]/gi, "")}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function EspelhoPonto({
  dados,
  conferir,
}: {
  dados: DadosEspelho;
  conferir?: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">
            Espelho de ponto ·{" "}
            {dados.competencia.split("-").reverse().join("/")}
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Horários no fuso de cada jornada. Correções aprovadas preservam o
            registro original.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EtiquetaPonto valor={dados.fechamento?.status || "EM_CONFERENCIA"} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarEspelhoPonto(dados)}
          >
            Exportar espelho
          </Button>
          {conferir && !dados.congelado && (
            <Button size="sm" onClick={conferir}>
              Conferir meu espelho
            </Button>
          )}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/35 text-muted-foreground">
            <tr>
              {[
                "Dia / escala",
                "Entrada",
                "Intervalo",
                "Saída",
                "Previsto",
                "Trabalhado",
                "Extra",
                "Ocorrências",
              ].map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {dados.dias.map((d) => (
              <tr key={d.data}>
                <td className="px-3 py-3">
                  <span className="font-medium">{dataPonto(d.data)}</span>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {d.escala
                      ? d.escala.tipo === "FOLGA"
                        ? "Folga"
                        : `${d.escala.entrada}–${d.escala.saida}${d.escala.tipo === "SOBREAVISO" ? " · sobreaviso" : ""}`
                      : "Sem escala"}
                  </p>
                </td>
                <td className="px-3 font-mono">
                  {d.linha?.entrada_hora || "—"}
                  {d.original?.entrada_hora !== d.linha?.entrada_hora && (
                    <span
                      className="ml-1 text-primary"
                      title={`Original: ${d.original?.entrada_hora || "não registrado"}`}
                    >
                      *
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 font-mono">
                  {d.linha?.inicio_almoco || "—"} → {d.linha?.fim_almoco || "—"}
                </td>
                <td className="px-3 font-mono">{d.linha?.saida_hora || "—"}</td>
                <td className="px-3 font-mono">
                  {horasPonto(d.previstos_min)}
                </td>
                <td className="px-3 font-mono">
                  {horasPonto(d.trabalhados_min)}
                </td>
                <td className="px-3 font-mono">{horasPonto(d.extras_min)}</td>
                <td className="min-w-48 px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {d.alertas.map((a) => (
                      <EtiquetaPonto key={a} valor={a} />
                    ))}
                    {!d.alertas.length && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border p-3 text-[10px] text-muted-foreground">
        * Horário tratado mediante aprovação. Totais em HH:MM. Banco do mês é
        provisório até o fechamento; saldo oficial inclui somente movimentos de
        competências fechadas.
      </p>
    </section>
  );
}
