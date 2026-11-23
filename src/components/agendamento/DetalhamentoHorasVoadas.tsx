import { useMemo, useState } from "react";
import { Plane, Calendar, BarChart3 } from "lucide-react";
import type { HorasVoadasOperacionaisResponse } from "@/lib/colaborador-api";
import { consolidarHorasVoadas, formatarHorasVoadas } from "@/lib/horas-voadas-operacionais";

type Props = {
  dados: HorasVoadasOperacionaisResponse | null;
  carregando: boolean;
  erro: string | null;
  ano: number;
  mes: number;
};

type AbaDetalhamento = "aeronave" | "mes" | "dia" | "ano";

export function DetalhamentoHorasVoadas({ dados, carregando, erro, ano, mes }: Props) {
  const [aba, setAba] = useState<AbaDetalhamento>("aeronave");
  const resumo = useMemo(() => consolidarHorasVoadas(dados, ano, mes), [dados, ano, mes]);
  const pronto = Boolean(dados) && !carregando && !erro;
  const mesNome = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(ano, mes - 1, 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total acumulado · {mesNome}
          </span>
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {pronto ? formatarHorasVoadas(resumo.totalMes.minutos) : "—"}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center rounded-full bg-[#17885f]/10 px-2.5 py-1 text-[11px] font-bold text-[#17885f]">
            Aeronaves ativas
          </span>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {pronto ? `${resumo.totalMes.trechos} trechos registrados no mês` : "Consultando diário de bordo"}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 rounded-lg border border-border bg-secondary p-1 text-xs">
        {([
          ["aeronave", "Por Aeronave"],
          ["mes", "Por Mês"],
          ["dia", "Por Dia"],
          ["ano", "Por Ano"],
        ] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className={`flex-1 rounded-md py-1.5 text-center font-semibold transition-all ${
              aba === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div>
        {carregando ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Carregando horas reais do diário de bordo...</p>
        ) : erro || !dados ? (
          <p role="alert" className="py-10 text-center text-xs text-destructive">
            {erro || "Não foi possível consultar os dados do diário de bordo."}
          </p>
        ) : (
          <>
            {aba === "aeronave" && (
              <div className="space-y-3">
                {resumo.porAeronave.length ? resumo.porAeronave.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#3867ed]/10 text-[#3867ed]">
                        <Plane size={17} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-foreground">{item.matricula_registro}</strong>
                        <span className="block truncate text-[11px] text-muted-foreground">{item.modeloExibicao}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block font-mono text-sm font-bold text-foreground">
                        {formatarHorasVoadas(item.minutos)}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">{item.trechos} trechos no mês</span>
                    </div>
                  </div>
                )) : <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma aeronave ativa cadastrada.</p>}
              </div>
            )}

            {aba === "mes" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 border-b border-border pb-2 text-[11px] font-bold uppercase text-muted-foreground">
                  <span>Mês ({ano})</span><span className="text-center">Trechos</span><span className="text-right">Horas voadas</span>
                </div>
                {resumo.porMes.map((item) => (
                  <div key={item.mes} className="grid grid-cols-3 items-center rounded-lg py-2.5 text-xs hover:bg-secondary/40">
                    <span className="font-semibold text-foreground">{item.mes}</span>
                    <span className="text-center text-muted-foreground">{item.trechos}</span>
                    <span className="text-right font-mono font-bold text-foreground">{formatarHorasVoadas(item.minutos)}</span>
                  </div>
                ))}
              </div>
            )}

            {aba === "dia" && (
              <div className="space-y-2">
                {resumo.porDia.length ? resumo.porDia.map((item) => (
                  <div key={item.data} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">
                        {new Date(`${item.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-foreground">{formatarHorasVoadas(item.minutos)}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">({item.trechos} trechos)</span>
                    </div>
                  </div>
                )) : <p className="py-8 text-center text-xs text-muted-foreground">Nenhum lançamento de voo neste mês.</p>}
              </div>
            )}

            {aba === "ano" && (
              <div className="space-y-3">
                {resumo.porAno.map((item) => (
                  <div key={item.ano} className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 size={18} className="text-[#3867ed]" />
                      <div>
                        <strong className="block text-sm font-bold text-foreground">{item.ano}</strong>
                        <span className="text-[11px] text-muted-foreground">{item.trechos} trechos registrados</span>
                      </div>
                    </div>
                    <strong className="font-mono text-base font-bold text-foreground">{formatarHorasVoadas(item.minutos)}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
