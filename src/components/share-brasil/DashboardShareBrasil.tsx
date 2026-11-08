import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Briefcase, Building2 } from "lucide-react";
import { RecadosPanel } from "@/components/dashboard/Recados";
import {
  ABAS_DASHBOARD,
  ATALHOS_POR_ABA,
  type AbaDashboard,
  type AtalhoDashboard,
} from "./atalhos";
import aviationHero from "@/assets/aviation-hero1.jpg";

interface DashboardShareBrasilProps {
  aoNavegar: (menu: string) => void;
}

/* Espaçamento fluido: 8px em telas pequenas, até 48px (gap-12) em telas grandes */
const VARIAVEIS_GRID = {
  "--gap": "clamp(0.5rem, 3vw, 3rem)",
} as CSSProperties;

function CardAtalho({
  item,
  aoNavegar,
}: {
  item: AtalhoDashboard;
  aoNavegar: DashboardShareBrasilProps["aoNavegar"];
}) {
  const Icone = item.icon;

  return (
    <button
      type="button"
      onClick={() => aoNavegar(item.menu)}
      className="group flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-center justify-center gap-[14px] overflow-hidden rounded-[22px] border border-[rgba(41,71,129,1)] bg-card px-2 py-3 text-center shadow-[0_0_2px_0_rgba(62,79,87,0.32)] transition motion-safe:hover:-translate-y-0.5 hover:border-[rgba(26,77,112,0.655)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.tone}`}
      >
        <Icone size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="mx-auto flex min-w-0 w-full flex-col items-center justify-center space-y-1 [overflow-wrap:anywhere]">
        <span className="block text-xs font-bold leading-snug text-foreground sm:text-sm">
          {item.label}
        </span>
      </span>
    </button>
  );
}

export function DashboardShareBrasil({ aoNavegar }: DashboardShareBrasilProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaDashboard>("share-brasil");
  const id = useId();
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);
  const aba = ABAS_DASHBOARD.find((item) => item.id === abaAtiva)!;

  function navegarAbas(
    event: KeyboardEvent<HTMLButtonElement>,
    indice: number,
  ) {
    let proximo: number;

    switch (event.key) {
      case "ArrowRight":
        proximo = (indice + 1) % ABAS_DASHBOARD.length;
        break;
      case "ArrowLeft":
        proximo = (indice - 1 + ABAS_DASHBOARD.length) % ABAS_DASHBOARD.length;
        break;
      case "Home":
        proximo = 0;
        break;
      case "End":
        proximo = ABAS_DASHBOARD.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setAbaAtiva(ABAS_DASHBOARD[proximo].id);
    botoes.current[proximo]?.focus();
  }

  return (
    <div className="route-enter mx-auto box-border w-full min-w-0 max-w-[1600px] space-y-3 px-2 py-2 sm:space-y-4 sm:px-4 lg:px-6">
      <header
        className="min-w-0 rounded-2xl border border-white/10 bg-cover bg-center p-3 shadow-sm sm:p-5 lg:p-6"
        style={{
          backgroundImage: `linear-gradient(rgba(5, 10, 20, 0.7), rgba(5, 10, 20, 0.7)), url(${aviationHero})`,
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary sm:text-xs">
          Portal do colaborador
        </p>
        <h1 className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-white [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">
          {aba.label}
        </h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/75 [overflow-wrap:anywhere] sm:text-sm">
          {aba.detail}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Áreas do portal"
        aria-orientation="horizontal"
        className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 sm:mx-auto sm:max-w-xl"
      >
        {ABAS_DASHBOARD.map((item, indice) => {
          const selecionada = abaAtiva === item.id;
          const Icone = item.id === "share-brasil" ? Building2 : Briefcase;

          return (
            <button
              key={item.id}
              ref={(element) => {
                botoes.current[indice] = element;
              }}
              id={`${id}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={`${id}-painel-${item.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAbaAtiva(item.id)}
              onKeyDown={(event) => navegarAbas(event, indice)}
              className={`flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-1.5 whitespace-normal rounded-lg px-2 py-2 text-center text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-2 sm:px-4 sm:text-sm ${
                selecionada
                  ? "border border-[rgba(23,47,77,1)] bg-card text-primary"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              <Icone size={16} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {ABAS_DASHBOARD.map((item) => (
        <section
          key={item.id}
          id={`${id}-painel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${item.id}`}
          hidden={abaAtiva !== item.id}
          tabIndex={0}
          className="min-w-0 max-w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {item.id === "share-brasil" ? (
            /* Aba 1: sempre 3 colunas (3 em cima, 3 embaixo) */
            <div
              style={VARIAVEIS_GRID}
              className="mx-[clamp(0px,6vw,96px)] grid min-w-0 grid-cols-3 items-stretch gap-[var(--gap)] px-[7px] py-2"
            >
              {ATALHOS_POR_ABA[item.id].map((atalho) => (
                <CardAtalho
                  key={atalho.menu}
                  item={atalho}
                  aoNavegar={aoNavegar}
                />
              ))}
            </div>
          ) : (
            /* Aba 2: cards com o mesmo tamanho da aba 1, centralizados */
            <div
              style={VARIAVEIS_GRID}
              className="mx-[clamp(0px,6vw,96px)] flex min-w-0 flex-wrap items-stretch justify-center gap-[var(--gap)] px-[7px] py-2"
            >
              {ATALHOS_POR_ABA[item.id].map((atalho) => (
                <div
                  key={atalho.menu}
                  className="flex w-[calc((100%_-_2*var(--gap))/3)] min-w-0"
                >
                  <CardAtalho item={atalho} aoNavegar={aoNavegar} />
                </div>
              ))}
            </div>
          )}

          {item.id === "minha-central" && (
            <div className="mt-4 sm:mt-6">
              <RecadosPanel compact aoAbrir={() => aoNavegar("recados")} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
