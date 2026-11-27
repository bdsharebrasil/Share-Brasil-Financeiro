import { LancamentosUnificados } from "./LancamentosUnificados";

export function AbaHolding() {
  return <div className="min-w-0 space-y-3">
    <LancamentosUnificados fluxo="TODOS" caixa="HOLDING" />
  </div>;
}
