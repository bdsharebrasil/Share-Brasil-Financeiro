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

export const cardAgenda =
  "rounded-[24px] border border-white/80 bg-white/95 shadow-[0_4px_20px_-4px_rgba(11,34,68,0.06)] dark:border-slate-800 dark:bg-[#111C30]";
export const subcardAgenda =
  "rounded-2xl bg-[#E8EEF6]/80 dark:bg-[#182640]";
export const botaoAgenda =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#1366D9] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F54B5] disabled:cursor-not-allowed disabled:opacity-50";
export const pillAgenda = (ativo: boolean) =>
  "rounded-full px-3.5 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 " +
  (ativo
    ? "bg-[#1366D9] text-white shadow-sm"
    : "bg-[#E8EEF6] text-[#142D52] hover:bg-[#DCE5F2] dark:bg-[#182640] dark:text-slate-300 dark:hover:bg-slate-700");

export function AgendamentoShell({
  area,
  title,
  detalhe,
  aoSelecionar,
  aoVoltar,
  aoFechar,
  children,
}: {
  area: AreaAgendamento;
  title?: string;
  detalhe: boolean;
  aoSelecionar: (area: AreaAgendamento) => void;
  aoVoltar: () => void;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const rotulo = title || areas.find((a) => a.id === area)?.label || "Agenda de Voos";

  return (
    <div className="min-w-0 rounded-[32px] bg-[#0B2244] p-2.5 text-[#0B2244] shadow-xl dark:bg-[#050B16] dark:text-slate-100 sm:p-4">
      <header className="flex flex-col-reverse gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        {/* Botão circular + Aba curva integrada ao corpo principal */}
        <div className="relative z-10 -mb-[1px] flex min-w-0 items-end">
          <button
            type="button"
            aria-label={detalhe ? "Voltar para a lista" : "Fechar agendamento"}
            onClick={detalhe ? aoVoltar : aoFechar}
            className="mb-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#0B2244] shadow-sm transition hover:bg-slate-50 active:scale-95 dark:bg-[#111C30] dark:text-slate-100 dark:hover:bg-[#182742]"
          >
            {detalhe ? <ArrowLeft size={18} strokeWidth={2.25} /> : <X size={18} strokeWidth={2.25} />}
          </button>

          <div className="ml-1.5 flex min-w-0 items-end">
            {/* Curva S esquerda (côncava na base + arredondada no topo) */}
            <svg
              aria-hidden="true"
              width="34"
              height="56"
              viewBox="0 0 34 56"
              className="-mr-[1px] block shrink-0 fill-[#F4F7FC] dark:fill-[#0B1322]"
            >
              <path d="M 0 56 C 18 56, 14 0, 34 0 L 34 56 Z" />
            </svg>

            {/* Miolo da aba com o título */}
            <div className="flex h-[56px] min-w-0 items-center bg-[#F4F7FC] px-2 dark:bg-[#0B1322]">
              <h1 className="truncate text-[20px] font-bold tracking-tight text-[#0B2244] dark:text-slate-100 sm:text-[22px]">
                {rotulo}
              </h1>
            </div>

            {/* Curva S direita (inclinação suave descendo para o container) */}
            <svg
              aria-hidden="true"
              width="68"
              height="56"
              viewBox="0 0 68 56"
              className="-ml-[1px] block shrink-0 fill-[#F4F7FC] dark:fill-[#0B1322]"
            >
              <path d="M 0 0 C 30 0, 34 56, 68 56 L 0 56 Z" />
            </svg>
          </div>
        </div>

        {/* Menu de navegação em pílulas (mantendo exatamente suas áreas e regras) */}
        <nav
          className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end lg:pb-2"
          aria-label="Seções de agendamento"
        >
          {areas.map(({ id, label, icon: Icon }) => {
            const ativo = area === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={ativo ? "page" : undefined}
                onClick={() => aoSelecionar(id)}
                className={
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition sm:text-[13px] " +
                  (ativo
                    ? "bg-white text-[#0B2244] shadow-sm dark:bg-[#182742] dark:text-white dark:ring-1 dark:ring-sky-400/40"
                    : "bg-[#D8E2F2] text-[#142D52] hover:bg-white/95 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15")
                }
              >
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="min-h-[420px] min-w-0 rounded-[28px] bg-[#F4F7FC] p-4 dark:bg-[#0B1322] sm:p-6">
        {children}
      </main>
    </div>
  );
}