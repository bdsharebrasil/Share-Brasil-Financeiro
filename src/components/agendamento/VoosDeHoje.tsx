import { Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CabecalhoSecao, EstadoVazio } from "@/components/dashboard/ComponentesDashboard";
import AcompanhamentoVooAgendado from "@/components/agendamento/AcompanhamentoVooAgendado";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";

type Props = {
  voos: SolicitacaoVooInterna[];
  vooSelecionado: SolicitacaoVooInterna | null;
  nomesTripulantes: Map<string, string>;
  voosEmOperacao: VooEmOperacao[];
  carregando: boolean;
  aoSelecionar: (id: string) => void;
  aoIniciar: (item: SolicitacaoVooInterna) => void;
};

function horarioCurto(valor: string | null | undefined) {
  if (!valor) return "Horário a definir";
  const texto = valor.replace(" ", "T");
  const horario = texto.match(/(?:T|^)(\d{2}:\d{2})/)?.[1] || valor.slice(0, 5);
  return `${horario} UTC`;
}

function DetalheVoo({ label, valor }: { label: string; valor: string }) {
  return <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border/70 bg-secondary/25 p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">{valor}</p></div>;
}

export default function VoosDeHoje({ voos, vooSelecionado, nomesTripulantes, voosEmOperacao, carregando, aoSelecionar, aoIniciar }: Props) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card/75">
    <CabecalhoSecao icon={<Plane size={15} />} title={`Voos de hoje · ${voos.length}`} action={<span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300">CHECKLIST CONCLUÍDO</span>} />
    {carregando ? <div className="m-4 h-[340px] animate-pulse rounded-lg bg-secondary/40" /> : voos.length === 0 ? <EstadoVazio label="Nenhum voo aprovado com checklist concluído para hoje" /> : <div className="grid gap-4 p-3 lg:grid-cols-[minmax(230px,310px)_minmax(0,1fr)] lg:p-4">
      <aside className="space-y-2" aria-label="Lista de voos elegíveis para iniciar">
        {voos.map((voo) => {
          const ativo = vooSelecionado?.id === voo.id;
          return <button key={voo.id} type="button" aria-pressed={ativo} onClick={() => aoSelecionar(voo.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/10" : "border-border bg-background/35 hover:bg-secondary/40"}`}>
            <div className="flex items-start justify-between gap-2"><strong className="text-xs">{voo.numero_voo || "Voo confirmado"}</strong><span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">Pronto</span></div>
            <p className="mt-2 font-mono text-[11px]">{voo.origem} → {voo.destino}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{voo.matricula_registro || "Aeronave a definir"} · {horarioCurto(voo.horario_previsto_agendamento)}</p>
          </button>;
        })}
      </aside>
      {vooSelecionado && <div className="min-w-0 space-y-3">
        <AcompanhamentoVooAgendado key={vooSelecionado.id} item={vooSelecionado} voosEmOperacao={voosEmOperacao} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DetalheVoo label="Cotista" valor={vooSelecionado.socio_nome || vooSelecionado.cliente_razao_social || "—"} />
          <DetalheVoo label="Piloto" valor={vooSelecionado.piloto_nome || nomesTripulantes.get(vooSelecionado.piloto_id || "") || "—"} />
          <DetalheVoo label="Copiloto" valor={vooSelecionado.copiloto_nome || nomesTripulantes.get(vooSelecionado.copiloto_id || "") || "—"} />
          <DetalheVoo label="Passageiros" valor={String(vooSelecionado.numero_passageiros ?? "—")} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.04] p-3">
          <p className="text-[10px] text-muted-foreground">Checklist pré-voo concluído. Confira o mapa e inicie a jornada quando a tripulação estiver pronta.</p>
          <Button type="button" onClick={() => aoIniciar(vooSelecionado)} className="gap-2"><Plane size={14} /> Iniciar voo</Button>
        </div>
      </div>}
    </div>}
  </section>;
}
