import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, History, PieChart, Users } from "lucide-react";
import type { DiarioLancamento } from "@/lib/colaborador-api";

const hm = (value: number) => {
  const total = Math.round(Math.abs(value) * 60);
  return `${value < 0 ? "-" : ""}${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

type Saldo = { nome: string; emprestou: number; tomou: number };

export default function DiarioBancoHoras({ lancamentos, horasCotistas = [], horasEmprestadas = { horas_total: 0, quantidade: 0 } }: { lancamentos: DiarioLancamento[]; horasCotistas?: Array<{ cotista_id: string | null; cotista_nome: string; horas_voo: number }>; horasEmprestadas?: { horas_total: number; quantidade: number } }) {
  const emprestimos = useMemo(() => lancamentos.filter((entry) => Boolean(entry.voo_emprestado)), [lancamentos]);

  const saldos = useMemo(() => {
    const mapa = new Map<string, Saldo>();
    const somar = (nome: string, campo: "emprestou" | "tomou", horas: number) => {
      const atual = mapa.get(nome) || { nome, emprestou: 0, tomou: 0 };
      atual[campo] += horas;
      mapa.set(nome, atual);
    };
    for (const entry of emprestimos) {
      const horas = Number(entry.tempo_voo || 0);
      const emprestador = entry.socio_nome || entry.cliente_nome || "Não informado";
      const tomador = entry.socio_tomador_nome || entry.cliente_tomador_nome || "Não informado";
      somar(emprestador, "emprestou", horas);
      somar(tomador, "tomou", horas);
    }
    return [...mapa.values()].sort((a, b) => (b.emprestou - b.tomou) - (a.emprestou - a.tomou));
  }, [emprestimos]);

  const totalCotistas = horasCotistas.reduce((total, item) => total + Number(item.horas_voo || 0), 0);

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_18px_55px_rgba(0,0,0,.14)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-amber-300/10 p-2 text-amber-300"><History size={16} /></span>
            <div>
              <h2 className="text-sm font-bold text-white">Banco de horas · voos emprestados</h2>
              <p className="mt-0.5 text-xs text-slate-400">{horasEmprestadas.quantidade || emprestimos.length} empréstimo(s) · {hm(horasEmprestadas.horas_total || emprestimos.reduce((t, e) => t + Number(e.tempo_voo || 0), 0))} h no mês</p>
            </div>
          </div>
        </div>
        {!saldos.length ? (
          <p className="px-5 py-10 text-center text-xs text-slate-500">Nenhum voo emprestado registrado nesta competência.</p>
        ) : (
          <div className="divide-y divide-white/[.06]">
            {saldos.map((saldo) => {
              const balanco = saldo.emprestou - saldo.tomou;
              const positivo = balanco >= 0;
              return (
                <div key={saldo.nome} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${positivo ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}`}>
                      {positivo ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{saldo.nome}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Emprestou {hm(saldo.emprestou)} · Tomou {hm(saldo.tomou)}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-extrabold ${positivo ? "text-emerald-300" : "text-amber-300"}`}>{hm(balanco)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_18px_55px_rgba(0,0,0,.14)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><Users size={16} /></span>
            <div>
              <h2 className="text-sm font-bold text-white">Resumo por cotista</h2>
              <p className="mt-0.5 text-xs text-slate-400">{horasCotistas.length} cotista(s) · {hm(totalCotistas)} h voadas no mês</p>
            </div>
          </div>
          <PieChart size={15} className="text-slate-500" />
        </div>
        {!horasCotistas.length ? (
          <p className="px-5 py-10 text-center text-xs text-slate-500">Ainda não há horas vinculadas a cotistas neste mês.</p>
        ) : (
          <div className="space-y-3 p-5">
            {horasCotistas.map((item) => {
              const percentual = totalCotistas > 0 ? (Number(item.horas_voo || 0) / totalCotistas) * 100 : 0;
              return (
                <div key={item.cotista_id || item.cotista_nome}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-semibold text-slate-100">{item.cotista_nome}</span>
                    <span className="shrink-0 font-mono text-xs font-bold text-cyan-300">{hm(Number(item.horas_voo || 0))} <span className="text-slate-500">({percentual.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all" style={{ width: `${Math.min(100, percentual)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
