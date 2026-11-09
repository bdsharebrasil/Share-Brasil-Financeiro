// Cores compartilhadas pelo cronograma, calendário e ações operacionais.
export const ACAO_CONCLUIDA = "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white dark:border-emerald-600 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800";
export const ACAO_HOVER_MOVIMENTO = "transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md";
export const ACAO_A_REALIZAR = "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60";

const VERDE = {
  borda: "border-[#62cc8e] dark:border-[#62cc8e]",
  evento: "border-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60",
  icone: "text-emerald-800 dark:text-emerald-300",
};
const AMARELO = {
  borda: "border-amber-500 dark:border-amber-400",
  evento: "border-amber-500 bg-amber-50 hover:bg-amber-100 dark:border-amber-400 dark:bg-amber-950/50 dark:hover:bg-amber-900/60",
  icone: "text-amber-800 dark:text-amber-300",
};
const AZUL = {
  borda: "border-sky-600 dark:border-sky-400",
  evento: "border-sky-600 bg-sky-50 hover:bg-sky-100 dark:border-sky-400 dark:bg-sky-950/50 dark:hover:bg-sky-900/60",
  icone: "text-sky-800 dark:text-sky-300",
};
const VERMELHO = {
  borda: "border-red-600 dark:border-red-400",
  evento: "border-red-600 bg-red-50 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/50 dark:hover:bg-red-900/60",
  icone: "text-red-800 dark:text-red-300",
};
const NEUTRO = {
  borda: "border-slate-500 dark:border-slate-400",
  evento: "border-slate-500 bg-slate-100 hover:bg-slate-200 dark:border-slate-400 dark:bg-slate-800/50 dark:hover:bg-slate-700/60",
  icone: "text-slate-700 dark:text-slate-300",
};

export function visualStatusAgendamento(status: string) {
  switch (String(status || "").trim().toLowerCase()) {
    case "aprovada": case "em_solo": case "encerrada": case "concluida": return VERDE;
    case "pendente": case "acionado": return AMARELO;
    case "decolado": case "em_voo": case "em_rota": return AZUL;
    case "cancelada": case "reprovada": return VERMELHO;
    default: return NEUTRO;
  }
}
