import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Briefcase, Building2 } from "lucide-react";
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
      className="group flex h-full min-h-40 w-full min-w-0 max-w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[22px] border border-[rgba(41,71,129,1)] bg-card px-[52px] py-4 text-center shadow-[0_0_6px_0_rgba(62,79,87,0.32)] transition motion-safe:hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:py-5"
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${item.tone}`}
      >
        <Icone size={23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="mx-auto flex min-w-0 w-full flex-col items-center justify-center space-y-1 [overflow-wrap:anywhere]">
        <span className="block text-sm font-bold leading-snug text-foreground">
          {item.label}
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {item.detail}
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
    <div className="route-enter box-border w-full min-w-0 max-w-full space-y-5 py-4 sm:py-6">
      <header
        className="min-w-0 rounded-2xl border border-primary/20 bg-cover bg-center p-4 shadow-sm sm:p-6"
        style={{ backgroundImage: `linear-gradient(rgba(5, 10, 20, 0.7), rgba(5, 10, 20, 0.7)), url(${aviationHero})` }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Portal do colaborador
        </p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
          {aba.label}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {aba.detail}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Áreas do portal"
        aria-orientation="horizontal"
        className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1"
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
              className={`flex min-h-12 min-w-0 flex-wrap items-center justify-center gap-2 whitespace-normal rounded-lg px-2 py-3 text-center text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 sm:text-sm ${
                selecionada
                  ? "border border-[#223c5d] bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              <Icone size={18} className="shrink-0" aria-hidden="true" />
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
          {/* A largura do pai define as colunas, mesmo com uma sidebar aberta. */}
          <div className="grid min-w-0 grid-cols-3 gap-[27px] mx-[39px] my-[-3px] px-[11px] py-[17px] justify-center items-center">
            {ATALHOS_POR_ABA[item.id].map((atalho) => (
              <CardAtalho
                key={atalho.menu}
                item={atalho}
                aoNavegar={aoNavegar}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
