import { useState } from "react";
import { LancamentosUnificados } from "./LancamentosUnificados";
import { AbaMovimentosHolding } from "./AbaMovimentosHolding";

type Visao = "entrada" | "saida" | "pendencias";

const VISOES: Array<{ id: Visao; rotulo: string }> = [
  { id: "entrada", rotulo: "Entrada" },
  { id: "saida", rotulo: "Saída" },
  { id: "pendencias", rotulo: "Pendências de pagamento" },
];

export function AbaHolding() {
  const [visao, setVisao] = useState<Visao>("entrada");

  return <div className="min-w-0 space-y-3">
    <nav className="flex flex-wrap gap-1 px-1" aria-label="Visões da holding">
      {VISOES.map((item) => <button key={item.id} type="button" aria-pressed={visao === item.id} onClick={() => setVisao(item.id)}
        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${visao === item.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
        {item.rotulo}
      </button>)}
    </nav>
    {visao === "entrada" && <LancamentosUnificados key="holding-entrada" fluxo="ENTRADA" caixa="HOLDING" />}
    {visao === "saida" && <LancamentosUnificados key="holding-saida" fluxo="SAIDA" caixa="HOLDING" />}
    {visao === "pendencias" && <AbaMovimentosHolding />}
  </div>;
}
