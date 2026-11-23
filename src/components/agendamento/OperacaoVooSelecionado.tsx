import { useState } from "react";
import { CalendarPlus, ClipboardCheck, Clock3, Flag, Plane, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "./agendamentoCardFlow";
import { operacaoIniciada, rotuloOperacao } from "./operacoesPainelModel";
import ChecklistPreVoo from "./ChecklistPreVoo";
import JornadaVoo from "./JornadaVoo";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";

type Props = {
  item: SolicitacaoVooInterna;
  processando: boolean;
  aoAtualizar: (status?: string) => Promise<void>;
  aoProximoDia: (item: SolicitacaoVooInterna) => void;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
};

export default function OperacaoVooSelecionado({ item, processando, aoAtualizar, aoProximoDia, aoFinalizar }: Props) {
  const [etapa, setEtapa] = useState<"resumo" | "checklist" | "jornada">(operacaoIniciada(item) ? "jornada" : "resumo");
  const [progressoLocal, setProgressoLocal] = useState<number | undefined>();
  const progresso = progressoLocal ?? calcularProgressoChecklist(item);
  const acoes = obterAcoesAgendamento(item, progresso, etapa === "checklist");
  const podeAbrirJornada = acoes.mostrarJornada || operacaoIniciada(item);

  return <section className="sb-operation-panel" aria-label="Controles do voo selecionado">
    <header className="sb-operation-heading">
      <div><p className="sb-eyebrow">Voo selecionado</p><h2><Plane size={18} /> {item.numero_voo || "Voo sem número"} <span>{item.matricula_registro || "Aeronave a definir"}</span></h2><p>{item.origem} → {item.destino} · {item.socio_nome || item.cliente_razao_social || "Titular não informado"}</p></div>
      <span className={`sb-pill ${operacaoIniciada(item) ? "live" : "confirmed"}`}>{rotuloOperacao(item.status)}</span>
    </header>
    <div className="sb-operation-actions" aria-label="Ações da operação">
      <Button type="button" variant="outline" aria-pressed={etapa === "checklist"} onClick={() => setEtapa("checklist")}><ClipboardCheck size={15} />{acoes.checklistConcluido ? "Ver checklist" : "Checklist pré-voo"}</Button>
      <Button type="button" disabled={!podeAbrirJornada} aria-pressed={etapa === "jornada"} onClick={() => setEtapa("jornada")}><Clock3 size={15} />{operacaoIniciada(item) ? "Horários e jornada" : "Iniciar operação"}</Button>
      {operacaoIniciada(item) && <>
        <Button type="button" variant="outline" disabled={processando} onClick={() => aoProximoDia(item)}><CalendarPlus size={15} />Agendar próximo dia</Button>
        <Button type="button" variant="outline" disabled={processando || !acoes.podeFinalizar} title={!acoes.podeFinalizar ? "Encerre a jornada antes de encerrar a operação." : undefined} onClick={() => aoFinalizar(item)}><Flag size={15} />Encerrar operação</Button>
      </>}
    </div>
    {!podeAbrirJornada && <p className="sb-operation-help">Conclua o checklist pré-voo para iniciar a operação e registrar os horários.</p>}
    {etapa === "checklist" && <div className="sb-operation-body"><ChecklistPreVoo item={item} aoAtualizarProgresso={setProgressoLocal} aoConcluir={async () => { await aoAtualizar(); }} /></div>}
    {etapa === "jornada" && podeAbrirJornada && <div className="sb-operation-body"><JornadaVoo item={item} modo="atualizar" permitirMapa={false} aoAtualizarAgendamento={aoAtualizar} aoFechar={() => setEtapa("resumo")} /></div>}
    <footer className="sb-weight-panel">
      <div><h3><Scale size={16} />Ficha de peso e balanceamento</h3><p>Consulte e preencha a ficha vinculada a este voo.</p></div>
      <PesoBalanceamentoFicha key={item.id} item={item} />
    </footer>
  </section>;
}
