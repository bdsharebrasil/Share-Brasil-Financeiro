import type { DiarioLancamento } from "@/lib/colaborador-api";
import { resumoConsumo } from "@/lib/diario-consumo";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const numero = (v: number | null, unidade: string) => v === null ? "Sem dados" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;
const dinheiro = (v: number | null) => v === null ? "Sem preço informado" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DiarioConsumo({ lancamentos, modo }: { lancamentos: DiarioLancamento[]; modo: "celula" | "tvoo" }) {
  const [consumoAberto, setConsumoAberto] = useState(false);
  const resumo = resumoConsumo(lancamentos, modo);
  const indicadores = [
    ["Consumo médio estimado", numero(resumo.media, "L/h")],
    ["Combustível estimado por hora", resumo.custoHora === null ? "Sem dados suficientes" : `${dinheiro(resumo.custoHora)}/h`],
    ["Preço médio do combustível", resumo.preco === null ? "Sem preço informado" : `${dinheiro(resumo.preco)}/L`],
    ["Consumo estimado no período", numero(resumo.consumo, "L")],
    ["Litros abastecidos", numero(resumo.abastecido, "L")],
  ];
  return <div>
    <section className="rounded-xl border border-amber-400/25 bg-card p-4 sm:p-5">
      <button type="button" aria-expanded={consumoAberto} onClick={() => setConsumoAberto((aberto) => !aberto)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-bold">Combustível e custo por hora</span>
          <span className="mt-1 block text-xs text-muted-foreground">Aeronave e mês selecionados · Base: {modo === "celula" ? "tempo total (acionamento ao corte)" : "tempo de voo (decolagem ao pouso)"} · {numero(resumo.horas, "h")}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${consumoAberto ? "rotate-180" : ""}`} />
      </button>
     
      {consumoAberto && (
        <div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {indicadores.map(([titulo, valor]) => (
              <div
                key={titulo}
                className="rounded-lg border border-border bg-muted/20 p-3"
              >
                <p className="text-xs text-muted-foreground">{titulo}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {valor}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Consumo estimado pelos lançamentos: litros ÷ horas. O preço médio é
            ponderado pelos litros com valor de compra informado. Custo por hora
            = L/h × R$/L, apenas combustível. Compras vinculadas aos voos deste
            diário; abastecimento não equivale a combustível consumido.
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Preço disponível para {numero(resumo.litrosPrecificados, "L")} dos
            abastecimentos. A média não mede o consumo real do tanque.
          </p>

          {resumo.semConsumo > 0 && (
            <p className="mt-2 text-xs text-amber-500">
              Média parcial: {resumo.semConsumo} lançamento(s) com horas e sem
              consumo positivo informado foram excluídos da média.
            </p>
          )}
        </div>
      )}
    </section>
  </div>;
}

export function DiarioDiscrepancias({ lancamentos, fechado, onEdit }: { lancamentos: DiarioLancamento[]; fechado: boolean; onEdit: (entry: DiarioLancamento) => void }) {
  const discrepancias = lancamentos.filter(l => l.discrepancias?.trim() || l.acoes_corretivas?.trim());
  return <div className="p-4 sm:p-5">
    <p className="text-xs text-muted-foreground">{discrepancias.length} lançamento(s) com discrepância ou ação corretiva neste mês.</p>
    {!fechado && <label className="mt-3 block text-xs">Registrar em um voo existente<select aria-label="Selecionar voo para registrar discrepância" value="" onChange={e => { const entry = lancamentos.find(l => l.id === e.target.value); if (entry) onEdit(entry); }} className="mt-1 block w-full rounded-md border border-input bg-background p-2"><option value="">Selecione o lançamento</option>{lancamentos.map(l => <option key={l.id} value={l.id}>#{l.numero_sequencial} · {l.data_registro.slice(0, 10)} · {l.aerodromo_partida} → {l.aerodromo_chegada}</option>)}</select><span className="mt-1 block text-muted-foreground">No formulário, preencha Discrepâncias e Ações corretivas e salve o lançamento.</span></label>}
    {!discrepancias.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma discrepância registrada neste mês.</p>}
    <div className="mt-3 space-y-3">{discrepancias.map(l => <article key={l.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">#{l.numero_sequencial} · {l.data_registro.slice(0, 10)} · {l.aerodromo_partida} → {l.aerodromo_chegada}</p>{!fechado && <Button variant="outline" size="sm" onClick={() => onEdit(l)}>Editar registro</Button>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{l.discrepancias || "Discrepância não informada."}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">Ação corretiva: {l.acoes_corretivas || "Não registrada."}</p></article>)}</div>
  </div>;
}
