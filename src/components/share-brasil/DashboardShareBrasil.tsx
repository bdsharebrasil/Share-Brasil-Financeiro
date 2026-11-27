import "./atalhos-dashboard.css";
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

/* Grade compacta com espaçamento de 8 a 16px. */
const VARIAVEIS_GRID = {
  "--gap": "clamp(0.5rem, 1.5vw, 1rem)",
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
      className="menu-dashboard atalho-card group flex h-full aspect-[6/5] min-h-[112px] sm:min-h-[140px] w-full min-w-0 max-w-full flex-col items-center justify-center gap-[14px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm dark:bg-card/65 dark:text-card-foreground dark:shadow-none dark:hover:!border-[#308db8]  dark:hover:!text-[#f0f9ff] px-2 py-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${item.tone}`}
      >
        <Icone size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="mx-auto flex min-w-0 w-full flex-col items-center justify-center space-y-1 [overflow-wrap:break-word]">
        <span className="block text-xs font-bold leading-snug text-foreground sm:text-[13px]">
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
      <header className="hero-panel relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_36px_rgba(0,0,0,.18)] dark:border-white/10 sm:rounded-2xl">
        <img src={aviationHero} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,12,22,.94)_0%,rgba(5,12,22,.68)_45%,rgba(5,12,22,.28)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,12,22,.45)_0%,transparent_60%)]" />
        <div className="relative flex min-h-[84px] items-center justify-between gap-3 px-4 py-3 sm:min-h-[96px] sm:gap-6 sm:px-6 sm:py-4 md:px-8">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-[hsl(var(--sidebar-primary))]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="truncate">Portal do colaborador</span>
            </p>
            <h1 className="truncate text-xl font-extrabold leading-tight tracking-[-.02em] text-white sm:text-2xl md:text-[28px]">
              {aba.label}
            </h1>
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Áreas do portal"
        aria-orientation="horizontal"
        className="grid w-full min-w-0 grid-cols-2 gap-1.5 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-sm dark:bg-card/65 dark:shadow-none sm:mx-auto sm:max-w-xl"
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
              className={`aba-dashboard flex min-h-9 min-w-0 flex-wrap items-center justify-center gap-1.5 whitespace-normal overflow-hidden rounded-lg px-2 py-2 text-center text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-2 sm:px-4 sm:text-sm ${
                selecionada
                  ? "border border-primary bg-primary text-primary-foreground shadow-sm dark:border-[rgba(82,187,194,1)] dark:bg-[rgba(21,47,71,1)] dark:text-[rgba(185,246,232,1)] dark:shadow-none"
                  : "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:border-[rgba(20,106,168,0.65)] dark:hover:bg-white/5"
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
            <>
              <div className="atalhos-wrap mx-auto w-full max-w-[1200px]">
                <div
                  style={VARIAVEIS_GRID}
                  className="atalhos-grid atalhos-grid--6 grid w-full min-w-0 items-stretch gap-[var(--gap)] px-[7px] py-2"
                >
                  {ATALHOS_POR_ABA[item.id].map((atalho) => (
                    <CardAtalho
                      key={atalho.menu}
                      item={atalho}
                      aoNavegar={aoNavegar}
                    />
                  ))}
                </div>
              </div>
              <div className="mx-auto mt-4 w-full max-w-[1200px] sm:mt-6">
                <RecadosPanel compact aoAbrir={() => aoNavegar("recados")} />
              </div>
            </>
          ) : (
            /* Quatro atalhos da central, mantendo os cartões alinhados. */
            <div className="atalhos-wrap mx-auto w-full max-w-[800px]">
              <div
                style={VARIAVEIS_GRID}
                className="atalhos-grid atalhos-grid--4 grid w-full min-w-0 items-stretch gap-[var(--gap)] px-[7px] py-2"
              >
                {ATALHOS_POR_ABA[item.id].map((atalho) => (
                  <CardAtalho key={atalho.menu} item={atalho} aoNavegar={aoNavegar} />
                ))}
              </div>
            </div>
          )}

          {item.id === "minha-central" && (
            <div className="mx-auto mt-4 w-full max-w-[1200px] sm:mt-6">
              <RecadosPanel compact aoAbrir={() => aoNavegar("recados")} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
