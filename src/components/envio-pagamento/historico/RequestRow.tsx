import { Mail, Plane, Send } from "lucide-react";
import type { EnvioPagamento } from "@/lib/colaborador-api";
import { formatarData, formatarMoeda } from "./status";
import { StatusBadge } from "./StatusBadge";

type RequestRowProps = {
  envio: EnvioPagamento;
  rotulo: string;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function RequestRow({ envio, rotulo, selected, onSelect }: RequestRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(envio.id)}
      aria-current={selected ? "true" : undefined}
      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors duration-150 ease-out ${
        selected ? "border-primary/40 bg-primary/[.07]" : "border-transparent hover:border-border hover:bg-secondary/40"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {envio.numero_voo ? <Plane className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <p className="truncate text-[11px] font-bold text-foreground">{envio.descricao}</p>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {envio.fornecedor || "Sem fornecedor"} · {rotulo} · venc. {formatarData(envio.vencimento)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
          {envio.tipo === "share" ? <Send className="h-3 w-3" aria-label="Enviado à Share" /> : null}
          {envio.email_enviado ? <Mail className="h-3 w-3" aria-label="E-mail enviado" /> : null}
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-foreground">{formatarMoeda(Number(envio.valor))}</span>
        <StatusBadge status={envio.status} />
      </div>
    </button>
  );
}
