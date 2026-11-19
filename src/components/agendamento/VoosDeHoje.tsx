import { useEffect, useState } from "react";
import { Clock3, MapPin, Plane, Radio, RefreshCw, Users } from "lucide-react";
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
  carregandoAoVivo: boolean;
  erroAoVivo: string | null;
  atualizadoAoVivo: string | null;
  visaoInicial?: "ao-vivo" | "prontos";
  aoSelecionar: (id: string) => void;
  aoIniciar: (item: SolicitacaoVooInterna) => void;
};

function horarioCurto(valor: string | null | undefined) {
  if (!valor) return "Horário a definir";
  const texto = valor.replace(" ", "T");
  const horario = texto.match(/(?:T|^)(\d{2}:\d{2})/)?.[1] || valor.slice(0, 5);
  return `${horario} UTC`;
}

function detalhe(label: string, valor: string, Icon: typeof Plane = Plane) {
  return <div className="agendamento-live-detail"><span><Icon size={13} aria-hidden="true" />{label}</span><strong>{valor}</strong></div>;
}

function statusRastreio(voo: VooEmOperacao) {
  if (voo.rastreio_status === "ao_vivo") return "Rastreio ao vivo";
  if (voo.rastreio_status === "atrasado") return "Sinal atrasado";
  if (voo.rastreio_status === "sem_sinal") return "Sem sinal";
  return "Rastreio indisponível";
}

export default function VoosDeHoje({ voos, vooSelecionado, nomesTripulantes, voosEmOperacao, carregando, carregandoAoVivo, erroAoVivo, atualizadoAoVivo, visaoInicial = "ao-vivo", aoSelecionar, aoIniciar }: Props) {
  const [visao, setVisao] = useState<"ao-vivo" | "prontos">(visaoInicial);
  const [vooAoVivoId, setVooAoVivoId] = useState("");
  const vooAoVivo = voosEmOperacao.find((item) => item.id === vooAoVivoId) || voosEmOperacao[0] || null;
  const agendamentoAoVivo = vooAoVivo ? voos.find((item) => item.id === vooAoVivo.id) : null;

  useEffect(() => {
    if (!voosEmOperacao.some((item) => item.id === vooAoVivoId)) setVooAoVivoId(voosEmOperacao[0]?.id || "");
  }, [voosEmOperacao, vooAoVivoId]);

  const horarioAtualizacao = atualizadoAoVivo ? new Date(atualizadoAoVivo).toISOString().slice(11, 16) : null;

  return <section className="agendamento-live-board" aria-label="Monitoramento operacional de voos">
    <CabecalhoSecao icon={<Radio size={16} />} title="Monitoramento operacional" detail="Rastreio de voos ativos e partidas liberadas" action={<span className={`agendamento-live-status ${voosEmOperacao.length ? "is-live" : ""}`} role="status"><span className="agendamento-live-status-dot" />{carregandoAoVivo ? "Atualizando" : `${voosEmOperacao.length} em operação`}</span>} />

    <div className="agendamento-live-switch" role="tablist" aria-label="Visualização operacional">
      <button id="agendamento-live-tab-operacao" type="button" role="tab" aria-selected={visao === "ao-vivo"} aria-controls="agendamento-live-panel-operacao" onClick={() => setVisao("ao-vivo")} className={visao === "ao-vivo" ? "is-active" : ""}><Radio size={15} /> Em operação <span>{voosEmOperacao.length}</span></button>
      <button id="agendamento-live-tab-prontos" type="button" role="tab" aria-selected={visao === "prontos"} aria-controls="agendamento-live-panel-prontos" onClick={() => setVisao("prontos")} className={visao === "prontos" ? "is-active" : ""}><Plane size={15} /> Prontos para iniciar <span>{voos.length}</span></button>
    </div>

    {visao === "ao-vivo" ? <div id="agendamento-live-panel-operacao" role="tabpanel" aria-labelledby="agendamento-live-tab-operacao" className="agendamento-live-content">
      {erroAoVivo && <div className="agendamento-error" role="alert">Não foi possível atualizar o rastreio: {erroAoVivo}</div>}
      {carregandoAoVivo && voosEmOperacao.length === 0 ? <div className="agendamento-live-skeleton" role="status"><RefreshCw size={17} className="animate-spin" /> Carregando voos em operação…</div> : voosEmOperacao.length === 0 ? <EstadoVazio label="Não há voos com rastreio ativo neste momento" /> : <div className="agendamento-live-layout">
        <aside className="agendamento-live-list" aria-label="Voos com rastreio ativo">
          {voosEmOperacao.map((voo) => <button key={voo.id} type="button" aria-pressed={vooAoVivo?.id === voo.id} onClick={() => setVooAoVivoId(voo.id)} className={`agendamento-live-flight${vooAoVivo?.id === voo.id ? " is-selected" : ""}`}>
            <span className="agendamento-live-flight-icon"><Plane size={16} /></span>
            <span className="agendamento-live-flight-info"><strong>{voo.numero_voo || "Voo em operação"}</strong><small>{voo.matricula_registro || voo.modelo || "Aeronave não informada"}</small><span>{voo.origem || "—"} → {voo.destino || "—"}</span></span>
            <span className={`agendamento-live-flight-badge${voo.rastreio_status === "ao_vivo" ? " is-live" : ""}`}><i />{statusRastreio(voo)}</span>
          </button>)}
        </aside>
        {vooAoVivo && <div className="agendamento-live-detail-panel">
          <div className="agendamento-live-flight-heading"><div><p className="agendamento-eyebrow">Acompanhamento de voo</p><h3>{vooAoVivo.numero_voo || "Voo em operação"}</h3><p>{vooAoVivo.origem || "—"} <span>→</span> {vooAoVivo.destino || "—"}</p></div><span className={`agendamento-live-flight-badge${vooAoVivo.rastreio_status === "ao_vivo" ? " is-live" : ""}`}><i />{statusRastreio(vooAoVivo)}</span></div>
          <div className="agendamento-live-details">
            {detalhe("Aeronave", [vooAoVivo.matricula_registro, vooAoVivo.modelo].filter(Boolean).join(" · ") || "—", Plane)}
            {detalhe("Tripulação", [vooAoVivo.piloto_nome, vooAoVivo.copiloto_nome].filter(Boolean).join(" · ") || "A definir", Users)}
            {detalhe("Última posição", vooAoVivo.rastreio ? `${vooAoVivo.rastreio.lat.toFixed(3)}, ${vooAoVivo.rastreio.lon.toFixed(3)}` : "Aguardando posição ADS-B", MapPin)}
            {detalhe("Atualização", horarioAtualizacao ? `${horarioAtualizacao} UTC` : "Aguardando atualização", Clock3)}
          </div>
          {agendamentoAoVivo ? <AcompanhamentoVooAgendado key={agendamentoAoVivo.id} item={agendamentoAoVivo} voosEmOperacao={voosEmOperacao} secao="mapa" /> : <div className="agendamento-live-map-empty">O registro do agendamento não está disponível para mostrar o mapa deste voo.</div>}
        </div>}
      </div>}
    </div> : <div id="agendamento-live-panel-prontos" role="tabpanel" aria-labelledby="agendamento-live-tab-prontos" className="agendamento-ready-panel">
      {carregando ? <div className="m-4 h-[300px] animate-pulse rounded-lg bg-secondary/40" /> : voos.length === 0 ? <EstadoVazio label="Nenhum voo aprovado com checklist concluído para hoje" /> : <div className="agendamento-ready-layout">
        <aside className="agendamento-ready-list" aria-label="Lista de voos elegíveis para iniciar">
          {voos.map((voo) => {
            const ativo = vooSelecionado?.id === voo.id;
            return <button key={voo.id} type="button" aria-pressed={ativo} onClick={() => aoSelecionar(voo.id)} className={`agendamento-ready-flight${ativo ? " is-selected" : ""}`}>
              <div><strong>{voo.numero_voo || "Voo confirmado"}</strong><span>Pronto</span></div>
              <p>{voo.origem} → {voo.destino}</p>
              <small>{voo.matricula_registro || "Aeronave a definir"} · {horarioCurto(voo.horario_previsto_agendamento)}</small>
            </button>;
          })}
        </aside>
        {vooSelecionado && <div className="agendamento-ready-detail">
          <AcompanhamentoVooAgendado key={vooSelecionado.id} item={vooSelecionado} voosEmOperacao={voosEmOperacao} />
          <div className="agendamento-ready-facts">
            <div><span>Cotista</span><strong>{vooSelecionado.socio_nome || vooSelecionado.cliente_razao_social || "—"}</strong></div>
            <div><span>Comandante</span><strong>{vooSelecionado.piloto_nome || nomesTripulantes.get(vooSelecionado.piloto_id || "") || "—"}</strong></div>
            <div><span>Copiloto</span><strong>{vooSelecionado.copiloto_nome || nomesTripulantes.get(vooSelecionado.copiloto_id || "") || "—"}</strong></div>
            <div><span>Passageiros</span><strong>{String(vooSelecionado.numero_passageiros ?? "—")}</strong></div>
          </div>
          <div className="agendamento-ready-action"><p>Checklist pré-voo concluído. Confira a rota e inicie a jornada quando a tripulação estiver pronta.</p><Button type="button" onClick={() => aoIniciar(vooSelecionado)} className="gap-2"><Plane size={14} /> Iniciar voo</Button></div>
        </div>}
      </div>}
    </div>}
  </section>;
}
