import { CalendarDays, History, LayoutDashboard, Radio, Users, type LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

type AbaAgendamento = "cronograma" | "pendentes" | "aprovados" | "calendario" | "escala" | "voos-hoje" | "historico" | "horas-voadas";

type ItemAba = {
  id: AbaAgendamento;
  label: string;
  icon: LucideIcon;
  count?: number;
  live?: boolean;
};

// A visão inicial mostra somente as operações do dia; os KPIs concentram os filtros de status.
const itens: Omit<ItemAba, "count">[] = [
  { id: "cronograma", label: "Voos de hoje", icon: LayoutDashboard },
  { id: "calendario", label: "Agenda de voos", icon: CalendarDays },
  { id: "escala", label: "Escala da tripulação", icon: Users },
  { id: "historico", label: "Histórico de voos", icon: History },
];

type Props = {
  abaAtiva: AbaAgendamento;
  contagens: Partial<Record<AbaAgendamento, number>>;
  aoSelecionar: (aba: AbaAgendamento) => void;
};

function navegarPorTeclado(event: KeyboardEvent<HTMLButtonElement>, atual: AbaAgendamento, aoSelecionar: Props["aoSelecionar"]) {
  const teclasDeAvanco = ["ArrowRight", "ArrowDown"];
  const teclasDeRetorno = ["ArrowLeft", "ArrowUp"];
  if (![...teclasDeAvanco, ...teclasDeRetorno, "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const indice = itens.findIndex((item) => item.id === atual);
  const proximo = event.key === "Home"
    ? itens[0]
    : event.key === "End"
      ? itens[itens.length - 1]
      : teclasDeAvanco.includes(event.key)
        ? itens[(indice + 1) % itens.length]
        : itens[(indice - 1 + itens.length) % itens.length];
  document.getElementById(`agendamento-tab-${proximo.id}`)?.focus();
  aoSelecionar(proximo.id);
}

export default function AgendamentoNavigation({ abaAtiva, contagens, aoSelecionar }: Props) {
  return (
    <nav className="agendamento-segmented-nav flex items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm" role="tablist" aria-label="Seções do agendamento">
      {itens.map(({ id, label, icon: Icon, live }) => {
        const ativo = abaAtiva === id;
        const contagem = contagens[id];
        return (
          <button
            key={id}
            id={`agendamento-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={ativo}
            aria-controls={`agendamento-panel-${id}`}
            tabIndex={ativo ? 0 : -1}
            onClick={() => aoSelecionar(id)}
            onKeyDown={(event) => navegarPorTeclado(event, id, aoSelecionar)}
            className={`flex min-h-[38px] items-center gap-2 rounded-lg px-4 text-xs font-semibold transition-all ${
              ativo
                ? "bg-[#3867ed] text-white shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon size={16} aria-hidden="true" className={ativo ? "text-white" : "text-muted-foreground"} />
            <span>{label}</span>
            {live && contagem ? <span className="h-2 w-2 rounded-full bg-[#17885f] shadow-[0_0_0_2px_rgba(23,136,95,0.2)]" /> : null}
            {!live && typeof contagem === "number" && id === "historico" && contagem > 0 ? (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                ativo ? "bg-white/20 text-white" : "bg-secondary text-foreground"
              }`}>
                {contagem}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export type { AbaAgendamento };
