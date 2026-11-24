import { useState } from "react";
import { Check, ChevronRight, ClipboardCheck, Clock3, FileText, Flag, Pencil, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PernaPlanejada, SolicitacaoVooInterna } from "@/lib/colaborador-api";
import { calcularProgressoChecklist, obterAcoesAgendamento } from "./agendamentoCardFlow";
import { etapasOperacao, type ProximaAcao } from "./agendamentoFluxo";
import { operacaoIniciada, rotuloOperacao } from "./operacoesPainelModel";
import ChecklistPreVoo from "./ChecklistPreVoo";
import JornadaVoo from "./JornadaVoo";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";

type Props = {
  item: SolicitacaoVooInterna;
  operacao: SolicitacaoVooInterna;
  aoAbrirAgendamento: (id: string) => void;
  aoAbrirPlano?: (id: string) => void;
  /** Abre/fecha a seção “Dados do voo” (onde o coordenador edita aeronave, tripulação, observações). */
  aoAlternarDados: () => void;
  processando: boolean;
  dadosVooAbertos: boolean;
  aoAtualizar: (status?: string) => Promise<void>;
  aoFinalizar: (item: SolicitacaoVooInterna) => void;
};

const AJUDA: Record<Exclude<ProximaAcao, null>, string> = {
  checklist: "Próximo passo: conclua o checklist pré-voo. Ele libera o início da operação.",
  iniciar: "Checklist concluído. Inicie a operação quando a tripulação acionar a aeronave.",
  horarios: "Operação em andamento. Registre acionamento, decolagem, pouso e corte (UTC) conforme forem acontecendo.",
  encerrar: "Todos os horários foram registrados. Encerre a operação para movê-la ao histórico.",
};

export default function OperacaoVooSelecionado({ item, operacao, aoAbrirAgendamento, aoAbrirPlano, processando, dadosVooAbertos, aoAlternarDados, aoAtualizar, aoFinalizar }: Props) {
  const [etapa, setEtapa] = useState<"resumo" | "checklist" | "jornada">(operacaoIniciada(item) ? "jornada" : "resumo");
  const [progressoLocal, setProgressoLocal] = useState<number | undefined>();
  const progresso = progressoLocal ?? calcularProgressoChecklist(item);
  const acoes = obterAcoesAgendamento(item, progresso, etapa === "checklist");
  const agendamento: PernaPlanejada | undefined = item.solicitacao_origem_id
    ? operacao.pernas_planejadas?.find(perna => perna.id === item.id)
    : undefined;
  const iniciada = operacaoIniciada(item);
  const podeAbrirJornada = acoes.mostrarJornada || iniciada;
  const { etapas, proxima } = etapasOperacao({
    checklistConcluido: acoes.checklistConcluido,
    operacaoIniciada: iniciada,
    jornadaEncerrada: Number(item.jornadas_encerradas || 0) > 0,
    podeEncerrar: acoes.podeFinalizar,
  });

  const abrirChecklist = () => setEtapa("checklist");
  const abrirJornada = () => setEtapa("jornada");
  const rotuloChecklist = acoes.checklistConcluido ? "Ver checklist" : progresso > 0 ? "Continuar checklist" : "Iniciar checklist pré-voo";

  // Uma única ação principal por momento: quem opera sabe sempre qual é o próximo clique.
  const principal: { id: Exclude<ProximaAcao, null>; rotulo: string; icone: typeof Plane; aoClicar: () => void; desabilitado?: boolean } | null = agendamento || !proxima ? null : ({
    checklist: { id: "checklist", rotulo: rotuloChecklist, icone: ClipboardCheck, aoClicar: abrirChecklist },
    iniciar: { id: "iniciar", rotulo: "Iniciar operação", icone: Plane, aoClicar: abrirJornada, desabilitado: !podeAbrirJornada },
    horarios: { id: "horarios", rotulo: "Registrar horários", icone: Clock3, aoClicar: abrirJornada },
    encerrar: { id: "encerrar", rotulo: "Encerrar operação", icone: Flag, aoClicar: () => aoFinalizar(item), desabilitado: processando || !acoes.podeFinalizar },
  } as const)[proxima];
  const IconePrincipal = principal?.icone;

  return <section className="sb-operation-panel" aria-label="Controles do voo selecionado">
    <header className="sb-operation-heading">
      <div><p className="sb-eyebrow">Voo selecionado</p><h2><Plane size={18} /> {item.numero_voo || "Voo sem número"} <span>{item.matricula_registro || "Aeronave a definir"}</span></h2><p>{item.origem} → {item.destino} · {item.socio_nome || item.cliente_razao_social || "Titular não informado"}</p></div>
      <span className={`sb-pill ${iniciada ? "live" : "confirmed"}`}>{rotuloOperacao(item.status)}</span>
    </header>

    {!agendamento && (
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 px-[18px] pt-4" aria-label="Etapas da operação">
        {etapas.map((passo, indice) => (
          <li key={passo.id} className="flex items-center gap-1.5" aria-current={passo.estado === "atual" ? "step" : undefined}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${passo.estado === "feita" ? "bg-emerald-600 text-white" : passo.estado === "atual" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {passo.estado === "feita" ? <Check size={12} /> : indice + 1}
            </span>
            <span className={`text-[11px] ${passo.estado === "atual" ? "font-bold text-foreground" : passo.estado === "feita" ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-medium text-muted-foreground"}`}>{passo.rotulo}</span>
            {indice < etapas.length - 1 && <ChevronRight size={12} className="mx-1 text-muted-foreground/50" />}
          </li>
        ))}
      </ol>
    )}

    <div className="sb-operation-actions" aria-label="Ações da operação">
      {principal && IconePrincipal && (
        <Button type="button" size="lg" disabled={principal.desabilitado} onClick={principal.aoClicar} className="gap-2 text-xs font-bold">
          <IconePrincipal size={16} />{principal.rotulo}
        </Button>
      )}
      {/* Ferramentas de apoio: sempre à mão, nunca escondidas atrás de outra seção. */}
      {(agendamento || proxima !== "checklist") && (
        <Button type="button" variant="outline" aria-pressed={etapa === "checklist"} onClick={abrirChecklist}><ClipboardCheck size={15} />{agendamento ? "Checklist pré-voo" : acoes.checklistConcluido ? "Ver checklist" : "Checklist"}</Button>
      )}
      {aoAbrirPlano && <Button type="button" variant="outline" onClick={() => aoAbrirPlano(item.id)}><FileText size={15} />Plano de voo</Button>}
      {acoes.checklistConcluido && <PesoBalanceamentoFicha key={item.id} item={item} rotuloBotao="Peso e balanceamento" />}
      {agendamento && <Button type="button" disabled={!podeAbrirJornada} aria-pressed={etapa === "jornada"} onClick={abrirJornada}><Clock3 size={15} />Registrar horários</Button>}
      {!agendamento && proxima !== "horarios" && iniciada && <Button type="button" variant="outline" aria-pressed={etapa === "jornada"} onClick={abrirJornada}><Clock3 size={15} />Horários e jornada</Button>}
      <Button type="button" variant="outline" aria-pressed={dadosVooAbertos} onClick={aoAlternarDados} className="ml-auto"><Pencil size={15} />{dadosVooAbertos ? "Fechar dados do voo" : "Dados do voo"}</Button>
    </div>
    {!agendamento && proxima && <p className="sb-operation-help" role="status">{AJUDA[proxima]}</p>}
    {agendamento && !podeAbrirJornada && <p className="sb-operation-help">Conclua o checklist pré-voo para registrar os horários desta perna.</p>}

    {etapa === "checklist" && <div className="sb-operation-body"><ChecklistPreVoo item={item} aoAtualizarProgresso={setProgressoLocal} aoConcluir={async () => { await aoAtualizar(); }} /></div>}
    {etapa === "jornada" && podeAbrirJornada && <div className="sb-operation-body"><JornadaVoo item={operacao} agendamentoSelecionado={agendamento} aoAbrirAgendamento={aoAbrirAgendamento} modo="atualizar" permitirMapa={false} aoAtualizarAgendamento={aoAtualizar} aoFechar={() => setEtapa("resumo")} /></div>}
  </section>;
}
