import { ArrowRight, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import type { RascunhoEnvioPagamento } from "@/lib/colaborador-api";
import { lerDadosRascunho, progressoRascunho } from "@/lib/rascunho-envio";
import { Button } from "@/components/ui/button";

type RascunhosEmAndamentoProps = {
  rascunhos: RascunhoEnvioPagamento[];
  rotuloTipo: (tipo: RascunhoEnvioPagamento["tipo_envio"]) => string;
  restaurando: boolean;
  onContinuar: (rascunho: RascunhoEnvioPagamento) => void;
  onExcluir: (rascunho: RascunhoEnvioPagamento) => void;
};

export function RascunhosEmAndamento({ rascunhos, rotuloTipo, restaurando, onContinuar, onExcluir }: RascunhosEmAndamentoProps) {
  return (
    <section className="overflow-hidden rounded-sm border border-amber-400/30 bg-card/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold text-foreground">Rascunhos em andamento</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Confira o que já foi concluído antes de retomar.</p>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{rascunhos.length} registro(s)</span>
      </div>

      <div className="divide-y divide-border/60">
        {rascunhos.map((rascunho) => {
          const progresso = progressoRascunho(rascunho, lerDadosRascunho(rascunho.dados_json));
          const etapas = [
            ["Preenchimento", progresso.preenchimento],
            ["Programação", progresso.programacao],
            ["Rateio", progresso.rateio],
            ["E-mail", progresso.email],
          ] as const;

          return (
            <div key={rascunho.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-foreground">{progresso.descricao}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {rotuloTipo(rascunho.tipo_envio) || "Pagamento"} · atualizado{" "}
                  {new Date(rascunho.atualizado_em).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 text-[10px] sm:grid-cols-2 xl:grid-cols-4">
                  {etapas.map(([nome, valor]) => (
                    <div key={nome} className="flex min-w-0 items-center gap-1.5">
                      <CheckCircle2
                        size={12}
                        aria-hidden="true"
                        className={valor === "Concluído" || valor === "Não se aplica" || valor.startsWith("Concluído") ? "shrink-0 text-emerald-500" : "shrink-0 text-amber-500"}
                      />
                      <span className="truncate">
                        <strong>{nome}:</strong> {valor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-2 rounded-sm px-3 text-[10px]" disabled={restaurando} onClick={() => onContinuar(rascunho)}>
                  {restaurando ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                  {progresso.envioCriado ? "Continuar envio" : "Continuar preenchimento"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-2 rounded-sm px-3 text-[10px] text-rose-500 hover:text-rose-400" disabled={restaurando} onClick={() => onExcluir(rascunho)} aria-label="Excluir rascunho">
                  <Trash2 size={12} /> Excluir
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
