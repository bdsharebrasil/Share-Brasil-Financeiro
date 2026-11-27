import type { ReactNode } from "react";
import { ArrowLeft, X, Plane, Users, History, Clock3, Radio } from "lucide-react";

export type AreaAgendamento = "agenda" | "escala" | "historico" | "horas" | "ao-vivo";
const areas = [
  { id: "agenda", label: "Agenda de Voos", icon: Plane },
  { id: "escala", label: "Escala", icon: Users },
  { id: "historico", label: "Histórico", icon: History },
  { id: "horas", label: "Horas Voadas", icon: Clock3 },
  { id: "ao-vivo", label: "Ao Vivo", icon: Radio },
] as const;

export const cardAgenda = "rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111C30]";
export const subcardAgenda = "rounded-xl bg-slate-100/90 dark:bg-[#182640]";
export const botaoAgenda = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D6CE0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1758B8] disabled:cursor-not-allowed disabled:opacity-50";
export const pillAgenda = (ativo: boolean) => "rounded-full px-3.5 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 " + (ativo ? "bg-[#1D6CE0] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#182640] dark:text-slate-300 dark:hover:bg-slate-700");

export function AgendamentoShell({ area, title, detalhe, aoSelecionar, aoVoltar, aoFechar, children }: {
  area: AreaAgendamento; title?: string; detalhe: boolean; aoSelecionar: (area: AreaAgendamento) => void;
  aoVoltar: () => void; aoFechar: () => void; children: ReactNode;
}) {
  const rotulo = title || areas.find(a => a.id === area)?.label || "Agenda de Voos";
  return (
    <div className="min-w-0 rounded-[28px] bg-[#0B1E3B] p-2 text-[#0F294A] dark:bg-[#050B16] dark:text-slate-100 sm:p-3">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-3 rounded-br-[32px] rounded-tl-[20px] bg-white px-4 py-2.5 dark:bg-[#111C30]">
          <button type="button" aria-label={detalhe ? "Voltar para a lista" : "Fechar agendamento"} onClick={detalhe ? aoVoltar : aoFechar} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-[#0F294A] hover:bg-slate-100 dark:border-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-800">
            {detalhe ? <ArrowLeft size={16} /> : <X size={16} />}
          </button>
          <h1 className="pr-4 text-lg font-bold tracking-tight text-[#0F294A] dark:text-slate-100">{rotulo}</h1>
        </div>
        <nav className="flex min-w-0 flex-wrap items-center gap-1.5 px-1" aria-label="Seções de agendamento">
          {areas.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={area === id ? "page" : undefined} onClick={() => aoSelecionar(id)}
              className={"inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition " + (area === id
                ? "bg-white text-[#0F294A] shadow-md dark:bg-[#182742] dark:text-white dark:ring-1 dark:ring-sky-400/40"
                : "bg-[#DCE5F2]/90 text-[#1E3A5F] hover:bg-white dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10")}>
              <Icon size={14} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
      </header>
      <main className="min-h-[420px] min-w-0 rounded-[28px] bg-[#F1F5F9] p-3 dark:border dark:border-slate-800/80 dark:bg-[#0B1322] sm:p-5">
        {children}
      </main>
    </div>
  );
}
