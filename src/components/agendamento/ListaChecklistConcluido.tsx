import { useEffect, useRef } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import {
  SECOES_CHECKLIST,
  type RespostasChecklist,
} from "./checklistStructure";

export default function ListaChecklistConcluido({
  respostas,
  alertas,
  nivelOleo,
  observacoes,
  necessitaAbastecer,
}: {
  respostas: RespostasChecklist;
  alertas: Record<string, string>;
  nivelOleo: string;
  observacoes: string;
  necessitaAbastecer: boolean;
}) {
  const inicio = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    inicio.current?.focus({ preventScroll: true });
    inicio.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, []);
  return (
    <div className="space-y-6 p-4 sm:p-5">
      <h3
        ref={inicio}
        tabIndex={-1}
        style={{
          scrollMarginTop: "calc(var(--app-header-height, 80px) + 16px)",
        }}
        className="rounded text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Checklist concluído — consulta completa
      </h3>
      {SECOES_CHECKLIST.map((secao) => (
        <section key={secao.id} aria-label={secao.titulo} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">{secao.titulo}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {secao.subtitulo}
            </p>
          </div>
          <ol className="space-y-2">
            {secao.itens.map((item) => {
              const status = respostas[item.id]?.status;
              const Icone =
                status === "feito"
                  ? Check
                  : status === "alerta"
                    ? AlertTriangle
                    : X;
              const rotulo =
                status === "feito"
                  ? "Feito"
                  : status === "alerta"
                    ? "Alerta"
                    : status === "nao_feito"
                      ? "Não feito"
                      : "Não informado";
              return (
                <li
                  key={item.id}
                  className={`rounded-xl border bg-background/50 p-3 sm:p-4 ${status === "feito" ? "border-emerald-200 dark:border-border/70" : "border-border/70"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm">{item.label}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${status === "feito" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : status === "alerta" ? "bg-amber-500/10 text-amber-900 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}
                    >
                      <Icone size={13} aria-hidden="true" />
                      {rotulo}
                    </span>
                  </div>
                  {item.tipo === "oleo" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Nível de óleo:{" "}
                      <strong className="text-foreground">
                        {nivelOleo || "Não informado"}
                      </strong>
                    </p>
                  )}
                  {status === "alerta" && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      Justificativa: {alertas[item.id] || "Não informada"}
                    </p>
                  )}
                  {respostas[item.id]?.observacao && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {respostas[item.id].observacao}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      <section className="rounded-xl border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Abastecimento</h4>
        <p className="mt-2 text-sm text-muted-foreground">
          {necessitaAbastecer
            ? "Abastecimento solicitado no checklist."
            : "Não necessita abastecimento."}
        </p>
      </section>
      <section className="rounded-xl border border-border p-4">
        <h4 className="text-sm font-semibold">Observações operacionais</h4>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {observacoes || "Sem observações."}
        </p>
      </section>
    </div>
  );
}
