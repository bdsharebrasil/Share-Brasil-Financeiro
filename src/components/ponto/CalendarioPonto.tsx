import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dataPonto,
  type DiaPonto,
  type SolicitacaoPonto,
} from "@/lib/ponto-api";

const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarioPonto({
  mes,
  hoje,
  selecionado,
  dias,
  solicitacoes,
  mudarMes,
  selecionar,
}: {
  mes: string;
  hoje: string;
  selecionado: string | null;
  dias: DiaPonto[];
  solicitacoes: SolicitacaoPonto[];
  mudarMes: (mes: string) => void;
  selecionar: (dia: string) => void;
}) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const inicio = new Date(ano, numeroMes - 1, 1, 12);
  const quantidade = new Date(ano, numeroMes, 0, 12).getDate();
  const titulo = inicio.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const mudar = (direcao: number) => {
    const data = new Date(ano, numeroMes - 1 + direcao, 1, 12);
    mudarMes(
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const porData = new Map(dias.map((dia) => [dia.data, dia]));
  const comPedido = new Set(
    solicitacoes.map((pedido) => pedido.data_referencia),
  );
  const totalCelulas = Math.ceil((inicio.getDay() + quantidade) / 7) * 7;
  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-label="Calendário de ponto"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Mês anterior"
          onClick={() => mudar(-1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-sm font-semibold capitalize" aria-live="polite">
          {titulo}
        </h2>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Próximo mês"
          onClick={() => mudar(1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      <p className="mb-4 mt-2 text-xs text-muted-foreground">
        Escolha o dia para enviar sua solicitação.
      </p>
      <div className="grid grid-cols-7 gap-1">
        {semana.map((dia) => (
          <span
            key={dia}
            className="py-2 text-center text-[10px] font-medium text-muted-foreground"
          >
            {dia}
          </span>
        ))}
        {Array.from({ length: totalCelulas }, (_, indice) => {
          const dia = indice - inicio.getDay() + 1;
          if (dia < 1 || dia > quantidade)
            return <span key={indice} aria-hidden="true" />;
          const data = `${mes}-${String(dia).padStart(2, "0")}`;
          const ativo = selecionado === data;
          const registrado = Boolean(porData.get(data)?.linha?.entrada_hora);
          const pedido = comPedido.has(data);
          return (
            <button
              type="button"
              key={data}
              aria-label={`${dataPonto(data)}${registrado ? ", com marcação" : ""}${pedido ? ", com solicitação" : ""}`}
              aria-pressed={ativo}
              aria-current={data === hoje ? "date" : undefined}
              onClick={() => selecionar(data)}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ativo ? "border-primary bg-primary text-primary-foreground" : data === hoje ? "border-primary/40 bg-primary/5 text-foreground hover:bg-secondary" : "border-transparent text-foreground hover:bg-secondary"}`}
            >
              <span className="font-medium">{dia}</span>
              <span className="flex h-1 gap-1" aria-hidden="true">
                {registrado && (
                  <span
                    className={`h-1 w-1 rounded-full ${ativo ? "bg-primary-foreground" : "bg-emerald-500"}`}
                  />
                )}
                {pedido && (
                  <span
                    className={`h-1 w-1 rounded-full ${ativo ? "bg-primary-foreground" : "bg-primary"}`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Com marcação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Com solicitação
        </span>
      </div>
    </section>
  );
}
