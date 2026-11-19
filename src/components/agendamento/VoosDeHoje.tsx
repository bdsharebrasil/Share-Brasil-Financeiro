import { useMemo, useState } from "react";
import { Clock3, MapPin, Plane, Radio, Users } from "lucide-react";
import type { SolicitacaoVooInterna, VooEmOperacao } from "@/lib/colaborador-api";
import VooEmOperacaoMapa from "@/components/dashboard/operacoes/VooEmOperacaoMapa";

type Props = {
  voos: SolicitacaoVooInterna[];
  vooSelecionado: SolicitacaoVooInterna | null;
  nomesTripulantes: Map<string, string>;
  voosEmOperacao: VooEmOperacao[];
  carregando: boolean;
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
  visaoInicial?: "ao-vivo" | "prontos";
  aoSelecionar: (id: string) => void;
  aoIniciar: (item: SolicitacaoVooInterna) => void;
};

function dataBR(data?: string | null) {
  if (!data) return "Data não informada";
  const d = new Date(`${data.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? data : d.toLocaleDateString("pt-BR");
}

export default function VoosDeHoje({
  voos, voosEmOperacao, carregando, carregandoAoVivo, erroAoVivo,
  atualizadoAoVivo, aoIniciar,
}: Props) {
  const [vooSelecionadoId, setVooSelecionadoId] = useState("");
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const agendamentosHoje = useMemo(() => voos.filter((v) => v.data_agendada === hoje), [voos, hoje]);
  const voosReais = voosEmOperacao;
  const vooSelecionado = voosReais.find((v) => v.id === vooSelecionadoId) || voosReais[0] || null;
  const porId = new Map(voosReais.map((v) => [v.id, v]));
  const statusVoo = (status: string) => ({ em_voo: "Em voo", decolado: "Decolado", em_solo: "Em solo", acionado: "Acionado", aguardando: "Aguardando", encerrada: "Encerrada" }[status] || status);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Monitoramento ao vivo</h2>
          <p className="mt-1 text-xs text-muted-foreground">Posições e rotas recebidas do rastreio ADS-B · {atualizadoAoVivo ? `atualizado ${new Date(atualizadoAoVivo).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "aguardando atualização"}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17885f]/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-[#17885f]">
          <Radio size={13} /> {carregandoAoVivo ? "Consultando" : `${voosReais.length} ${voosReais.length === 1 ? "operação real" : "operações reais"}`}
        </span>
      </div>
      {erroAoVivo && <p role="status" className="border-b border-border px-5 py-3 text-xs text-amber-700">Não foi possível atualizar o rastreio: {erroAoVivo}</p>}
      <div className="grid min-h-[400px] grid-cols-1 lg:grid-cols-12">
        <div className="min-h-[320px] border-b border-border p-4 lg:col-span-7 lg:border-b-0 lg:border-r">
          {vooSelecionado ? <VooEmOperacaoMapa key={vooSelecionado.id} voo={vooSelecionado} historico={!vooSelecionado.rastreio || vooSelecionado.rastreio_status !== "ao_vivo"} /> : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <MapPin size={24} />
              <strong className="text-foreground">Sem posição de voo real disponível</strong>
              <span>O mapa será exibido quando houver posição ADS-B ou trilha registrada. Nenhuma aeronave é simulada.</span>
            </div>
          )}
        </div>
        <div className="space-y-3 p-4 lg:col-span-5">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Voos monitorados</h3><span className="text-xs text-muted-foreground">{voosReais.length}</span></div>
          {voosReais.length ? voosReais.map((flight) => (
            <button key={flight.id} type="button" onClick={() => setVooSelecionadoId(flight.id)} className={`w-full rounded-xl border p-3 text-left ${vooSelecionado?.id === flight.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}>
              <span className="flex items-center justify-between gap-2"><strong className="font-mono text-sm">{flight.numero_voo || "Voo sem número"}</strong><span className="text-[10px] text-emerald-700">{statusVoo(flight.status)}</span></span>
              <span className="mt-1 block text-xs text-muted-foreground">{flight.matricula_registro || "Matrícula indisponível"} · {flight.modelo || "Aeronave"} · {dataBR(flight.horario_previsto_agendamento)}</span>
              <span className="mt-2 flex items-center gap-1.5 text-xs"><Plane size={12} /> {flight.origem || "—"} → {flight.destino || "—"} <span className="ml-auto text-muted-foreground">{flight.rastreio_status === "ao_vivo" ? "Sinal ao vivo" : flight.rastreio_status.replaceAll("_", " ")}</span></span>
            </button>
          )) : <p className="rounded-lg bg-secondary/40 p-4 text-xs text-muted-foreground">Nenhum voo com rastreio ou histórico disponível neste momento.</p>}
          <div className="border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Agendamentos de hoje</h3><span className="text-xs text-muted-foreground">{agendamentosHoje.length}</span></div>
            {carregando ? <p className="text-xs text-muted-foreground">Carregando agendamentos…</p> : agendamentosHoje.length ? agendamentosHoje.map((item) => {
              const monitorado = porId.get(item.id);
              return <article key={item.id} className="mb-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2"><strong className="font-mono text-xs">{item.numero_voo || "Solicitação sem número"}</strong><span className="text-[10px] text-muted-foreground">{statusVoo(monitorado?.status || item.status)}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{dataBR(item.data_agendada)} · {item.origem} → {item.destino} · {item.matricula_registro || "Aeronave a definir"}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Users size={11}/>{item.piloto_nome || "Piloto não definido"}{item.copiloto_nome ? ` · ${item.copiloto_nome}` : ""}</p>
                {item.status === "aprovada" && item.checklist_status === "concluido" && <button type="button" onClick={() => aoIniciar(item)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Clock3 size={12}/>Abrir operação</button>}
              </article>;
            }) : <p className="text-xs text-muted-foreground">Nenhum agendamento encontrado para hoje.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
