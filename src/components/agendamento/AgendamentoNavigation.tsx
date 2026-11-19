import { CalendarDays, Clock3, History, LayoutDashboard, Radio, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { KeyboardEvent } from "react";

type AbaAgendamento = "cronograma" | "pendentes" | "aprovados" | "calendario" | "escala" | "voos-hoje" | "historico";

type ItemAba = {
  id: AbaAgendamento;
  label: string;
  icon: LucideIcon;
  count?: number;
  live?: boolean;
};

const itens: Omit<ItemAba, "count">[] = [
  { id: "cronograma", label: "Visão geral", icon: LayoutDashboard },
  { id: "pendentes", label: "Pendentes", icon: Clock3 },
  { id: "aprovados", label: "Aprovados", icon: ShieldCheck },
  { id: "calendario", label: "Agenda de voos", icon: CalendarDays },
  { id: "escala", label: "Escala da tripulação", icon: Users },
  { id: "voos-hoje", label: "Ao vivo", icon: Radio, live: true },
  { id: "historico", label: "Histórico", icon: History },
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
    <nav className="agendamento-tabs" role="tablist" aria-label="Seções do agendamento">
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
            className={`agendamento-tab${ativo ? " is-active" : ""}`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="agendamento-tab-label">{label}</span>
            {live && contagem ? <span className="agendamento-live-indicator" aria-label={`${contagem} voos em operação`} /> : null}
            {!live && typeof contagem === "number" && (id === "pendentes" || id === "aprovados" || id === "historico") ? (
              <span className="agendamento-tab-count" aria-label={`${contagem} registros`}>{contagem}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export type { AbaAgendamento };
