import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calendar as CalendarIcon, Check, ChevronLeft, ClipboardList, Copy, Pencil, Plane, Trash2, Users, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import { CabecalhoSecao, EtiquetaStatus } from "@/components/dashboard/ComponentesDashboard";
import {
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type OpcoesAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
  type VooEmOperacao,
} from "@/lib/colaborador-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import AcompanhamentoVooAgendado from "@/components/agendamento/AcompanhamentoVooAgendado";
import JornadaVoo from "@/components/agendamento/JornadaVoo";
import PesoBalanceamentoFicha from "@/components/agendamento/PesoBalanceamentoFicha";

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function horarioUtc(data: string, hora?: string) {
  if (!hora) return undefined;
  const instante = new Date(`${data}T${hora}:00Z`);
  return Number.isFinite(instante.getTime()) ? instante.toISOString() : undefined;
}

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function tomStatus(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "aprovada") return "green";
  if (status === "acionado") return "amber";
  if (status === "decolado" || status === "em_voo" || status === "em_rota") return "blue";
  if (status === "em_solo") return "green";
  if (status === "reprovada" || status === "cancelada") return "red";
  if (status === "pendente") return "amber";
  return "neutral";
}

function statusLabel(status: string) {
  return ({ folga: "Folga", atestado_medico: "Atestado médico", treinamento: "Treinamento", acompanhando_manutencao: "Acompanhando manutenção", pendente: "Pendente", aprovada: "Aprovada", acionado: "Acionado", decolado: "Decolado", em_rota: "Decolado", em_voo: "Decolado", em_solo: "Em solo · pousado", encerrada: "Encerrada", reprovada: "Reprovada", cancelada: "Cancelada" } as Record<string, string>)[status] || status;
}

function formatarHorarioAgendamento(valor: string | null | undefined) {
  if (!valor) return { utc: "—", brasilia: "—" };
  const texto = String(valor).trim();
  const instante = /^\d{4}-\d{2}-\d{2}T/.test(texto) ? new Date(texto) : (() => {
    const partes = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!partes) return new Date(NaN);
    return new Date(Date.UTC(1970, 0, 1, Number(partes[1]), Number(partes[2]), Number(partes[3] || 0)));
  })();
  if (!Number.isFinite(instante.getTime())) return { utc: "—", brasilia: "—" };
  const utc = instante.toISOString().slice(11, 16);
  const brasilia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(instante);
  return { utc, brasilia };
}

function horaParaCampo(valor: string | null | undefined) {
  if (!valor) return "";
  const parte = String(valor).trim().match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  return parte ? `${parte[1].padStart(2, "0")}:${parte[2]}` : "";
}

function PeriodoAgendamento({ inicio, fim, aoAlterarInicio, aoAlterarFim }: { inicio: string; fim: string; aoAlterarInicio: (valor: string) => void; aoAlterarFim: (valor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [aguardandoFim, setAguardandoFim] = useState(false);
  const [inicioTemporario, setInicioTemporario] = useState<Date>();
  const [mesVisivel, setMesVisivel] = useState(() => inicio ? new Date(`${inicio}T00:00:00`) : new Date());

  const aoAbrir = (novoEstado: boolean) => {
    setAberto(novoEstado);
    if (novoEstado) {
      setAguardandoFim(false);
      setInicioTemporario(undefined);
      setMesVisivel(inicio ? new Date(`${inicio}T00:00:00`) : new Date());
    }
  };

  const selecionarIntervalo = (intervalo: DateRange | undefined) => {
    if (!intervalo?.from) return;
    if (!aguardandoFim) {
      setInicioTemporario(intervalo.from);
      setAguardandoFim(true);
      return;
    }
    if (!intervalo.to) {
      setInicioTemporario(intervalo.from);
      return;
    }
    aoAlterarInicio(dataIso(intervalo.from));
    aoAlterarFim(dataIso(intervalo.to));
    aoAbrir(false);
  };

  return <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Período do voo</Label><div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><Input aria-label="Data de início do voo" type="date" value={inicio} onChange={(event) => aoAlterarInicio(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><span className="text-[10px] text-muted-foreground">até</span><Input aria-label="Data de fim do voo" type="date" value={fim} min={inicio} onChange={(event) => aoAlterarFim(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover open={aberto} onOpenChange={aoAbrir}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário do período"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[70] w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(24rem,calc(100dvh-1.5rem))] overflow-y-auto p-3"><p className="mb-2 text-center text-xs font-semibold text-foreground">{aguardandoFim ? "Selecione a data de fim" : "Selecione a data de início"}</p><DayPicker locale={ptBR} mode="range" month={mesVisivel} onMonthChange={setMesVisivel} selected={aguardandoFim && inicioTemporario ? { from: inicioTemporario } : undefined} onSelect={selecionarIntervalo} showOutsideDays className="mx-auto" classNames={{ months: "flex justify-center", month: "space-y-3", caption: "relative flex items-center justify-center pt-1", caption_label: "text-xs font-semibold", nav: "flex items-center justify-between", nav_button: "h-7 w-7 rounded-md border border-border bg-background p-1 text-foreground hover:bg-accent", nav_button_previous: "absolute left-0", nav_button_next: "absolute right-0", table: "w-full border-collapse", head_row: "flex", head_cell: "w-9 rounded-md text-[0.65rem] font-normal text-muted-foreground", row: "mt-1 flex w-full", cell: "relative h-9 w-9 p-0 text-center text-xs focus-within:relative focus-within:z-20", day: "h-9 w-9 rounded-md p-0 text-xs font-normal text-foreground hover:bg-accent", day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", day_range_start: "rounded-l-md bg-primary text-primary-foreground", day_range_end: "rounded-r-md bg-primary text-primary-foreground", day_range_middle: "rounded-none bg-primary/15 text-foreground", day_today: "border border-primary/50", day_outside: "text-muted-foreground opacity-40", day_disabled: "text-muted-foreground opacity-30", day_hidden: "invisible" }} /></PopoverContent></Popover></div></div>;
}

type EdicaoConfirmacao = {
  aeronave_id: string;
  data_agendada: string;
  data_fim: string;
  horario: string;
  numero_passageiros: number;
  emprestimo: boolean;
  cliente_emprestimo_id: string;
  socio_emprestimo_id: string;
};

function criarEdicaoConfirmacao(selecionada: SolicitacaoVooInterna): EdicaoConfirmacao {
  return {
    aeronave_id: selecionada.aeronave_id || "",
    data_agendada: selecionada.data_agendada,
    data_fim: selecionada.data_fim || selecionada.data_agendada,
    horario: horaParaCampo(selecionada.horario_previsto_agendamento),
    numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    emprestimo: selecionada.voo_emprestado === "sim" || Boolean(selecionada.cliente_emprestimo_id || selecionada.socio_emprestimo_id),
    cliente_emprestimo_id: selecionada.cliente_emprestimo_id || "",
    socio_emprestimo_id: selecionada.socio_emprestimo_id || "",
  };
}

export function DetalhesSolicitacao({ voosEmOperacao, acoes, aoExcluir, selecionada, opcoes, tripulacao, pilotoId, copilotoId, motivo, processando, aoAtualizar, aoFechar, aoPiloto, aoCopiloto, aoMotivo, aoAprovar, aoReprovar }: {
  voosEmOperacao: VooEmOperacao[];
  acoes: ReactNode;
  aoExcluir: () => void;
  selecionada: SolicitacaoVooInterna;
  opcoes: OpcoesAgendamentoResponse;
  tripulacao: TripulanteAgendamento[];
  pilotoId: string;
  copilotoId: string;
  motivo: string;
  processando: boolean;
  aoAtualizar: (dados: AtualizacaoAgendamento) => void;
  aoFechar: () => void;
  aoPiloto: (valor: string) => void;
  aoCopiloto: (valor: string) => void;
  aoMotivo: (valor: string) => void;
  aoAprovar: (alteracoes: AlteracoesAgendamentoConfirmacao) => void;
  aoReprovar: () => void;
}) {
  const [edicao, setEdicao] = useState<EdicaoConfirmacao>(() => criarEdicaoConfirmacao(selecionada));
  const [editandoAgendamento, setEditandoAgendamento] = useState(false);
  const [dadosAgendamento, setDadosAgendamento] = useState<AtualizacaoAgendamento>(() => ({
    aeronave_id: selecionada.aeronave_id || "", origem: selecionada.origem, destino: selecionada.destino,
    data_agendada: selecionada.data_agendada, data_fim: selecionada.data_fim || selecionada.data_agendada,
    horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento), numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    piloto_id: selecionada.piloto_id || "", copiloto_id: selecionada.copiloto_id || "",
  }));

  useEffect(() => {
    setEdicao(criarEdicaoConfirmacao(selecionada));
    setEditandoAgendamento(false);
    setDadosAgendamento({ aeronave_id: selecionada.aeronave_id || "", origem: selecionada.origem, destino: selecionada.destino, data_agendada: selecionada.data_agendada, data_fim: selecionada.data_fim || selecionada.data_agendada, horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento), numero_passageiros: Number(selecionada.numero_passageiros) || 1, piloto_id: selecionada.piloto_id || "", copiloto_id: selecionada.copiloto_id || "" });
  }, [selecionada]);

  const salvarEdicaoAgendamento = () => {
    if (!dadosAgendamento.origem || !dadosAgendamento.destino || !dadosAgendamento.data_agendada || !dadosAgendamento.data_fim || dadosAgendamento.data_fim < dadosAgendamento.data_agendada || !dadosAgendamento.aeronave_id) return;
    aoAtualizar({ ...dadosAgendamento, horario_previsto_agendamento: dadosAgendamento.horario_previsto_agendamento ? horarioUtc(dadosAgendamento.data_agendada, dadosAgendamento.horario_previsto_agendamento) : null });
    setEditandoAgendamento(false);
  };

  const clienteTitularId = selecionada.cliente_id || opcoes.socios.find((socio) => socio.id === selecionada.socio_id)?.cliente_id;
  const aeronaveDoTitular = Boolean(edicao.aeronave_id && opcoes.vinculos.some((vinculo) =>
    vinculo.aeronave_id === edicao.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
  ));

  const cedentes = (() => {
    const ids = new Set<string>();
    return opcoes.vinculos.filter((vinculo) => vinculo.aeronave_id === edicao.aeronave_id).flatMap((vinculo) => {
      const itens: { id: string; label: string }[] = [];
      if (vinculo.cliente_id) {
        const cliente = opcoes.clientes.find((item) => item.id === vinculo.cliente_id);
        const id = `cliente:${vinculo.cliente_id}`;
        if (cliente && id !== (selecionada.cliente_id ? `cliente:${selecionada.cliente_id}` : "") && !ids.has(id)) {
          ids.add(id);
          itens.push({ id, label: `${cliente.nome}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}` });
        }
      }
      if (vinculo.socio_id) {
        const socio = opcoes.socios.find((item) => item.id === vinculo.socio_id);
        const id = `socio:${vinculo.socio_id}`;
        if (socio && id !== (selecionada.socio_id ? `socio:${selecionada.socio_id}` : "") && !ids.has(id)) {
          ids.add(id);
          itens.push({ id, label: socio.nome });
        }
      }
      return itens;
    });
  })();

  const aeronaves = opcoes.aeronaves.map((aeronave) => ({
    id: aeronave.id,
    label: `${aeronave.matricula_registro} · ${[aeronave.fabricante, aeronave.modelo].filter(Boolean).join(" ")}`,
  }));

  const editarAeronave = (aeronaveId: string) => {
    const vinculadaAoTitular = opcoes.vinculos.some((vinculo) =>
      vinculo.aeronave_id === aeronaveId && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
    );
    setEdicao((atual) => ({ ...atual, aeronave_id: aeronaveId, emprestimo: !vinculadaAoTitular, cliente_emprestimo_id: "", socio_emprestimo_id: "" }));
  };

  const editarCedente = (valor: string) => {
    const [tipo, id] = valor.split(":");
    setEdicao((atual) => ({ ...atual, cliente_emprestimo_id: tipo === "cliente" ? id : "", socio_emprestimo_id: tipo === "socio" ? id : "" }));
  };

  const cedenteSelecionado = edicao.cliente_emprestimo_id ? `cliente:${edicao.cliente_emprestimo_id}` : edicao.socio_emprestimo_id ? `socio:${edicao.socio_emprestimo_id}` : "";
  const horarioFormatado = formatarHorarioAgendamento(edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null);
  const emprestimoValido = !edicao.emprestimo || Boolean(cedenteSelecionado);
  const formularioValido = Boolean(edicao.aeronave_id && /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_agendada) && /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_fim) && edicao.data_fim >= edicao.data_agendada && Number.isInteger(edicao.numero_passageiros) && edicao.numero_passageiros >= 1 && emprestimoValido && (aeronaveDoTitular || edicao.emprestimo));

  const confirmar = () => aoAprovar({
    aeronave_id: edicao.aeronave_id,
    data_agendada: edicao.data_agendada,
    data_fim: edicao.data_fim,
    horario_previsto_agendamento: edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null,
    numero_passageiros: edicao.numero_passageiros,
    cliente_emprestimo_id: edicao.emprestimo ? edicao.cliente_emprestimo_id || null : null,
    socio_emprestimo_id: edicao.emprestimo ? edicao.socio_emprestimo_id || null : null,
  });

  const horarioAtual = formatarHorarioAgendamento(selecionada.horario_previsto_agendamento);
  const emprestimoAtual = selecionada.voo_emprestado === "sim" ? `Sim · ${selecionada.cliente_emprestimo_nome || selecionada.socio_emprestimo_nome || "Cedente não informado"}` : "Não";

  return (
    <section id="detalhes-solicitacao" className="agendamento-detail overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5">
      <CabecalhoSecao
        icon={<ClipboardList size={15} />}
        title={`Voo ${selecionada.numero_voo || "aguardando confirmação"}`}
        tituloClassName="font-normal"
        detail={`${selecionada.origem} → ${selecionada.destino} · ${formatarData(selecionada.data_agendada)}`}
        action={<button type="button" onClick={aoFechar} aria-label="Voltar ao cronograma" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><ChevronLeft size={16} /> Voltar ao cronograma</button>}
      />
      <div className="space-y-6 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-5 sm:gap-4">
          <span className="rounded-lg border border-[rgba(0,44,105,1)] bg-[rgba(2,82,121,0.1)] px-3 py-2 font-mono text-lg font-bold text-[rgba(142,188,212,1)]">{selecionada.origem} → {selecionada.destino}</span>
          <EtiquetaStatus tone={tomStatus(selecionada.status)}>{statusLabel(selecionada.status)}</EtiquetaStatus>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <Button type="button" variant="outline" onClick={() => setEditandoAgendamento((atual) => !atual)} className="h-10 flex-1 gap-2 text-xs sm:flex-none"><Pencil size={13} /> {editandoAgendamento ? "Cancelar edição" : "Editar agendamento"}</Button>
            <button type="button" onClick={aoExcluir} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 sm:flex-none"><Trash2 size={14} /> Excluir agendamento</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2"><Detalhe label="Comandante (PIC)" valor={selecionada.piloto_nome || tripulacao.find((t) => t.id === selecionada.piloto_id)?.nome_completo || "A definir"} /><Detalhe label="Segundo em comando (SIC)" valor={selecionada.copiloto_nome || tripulacao.find((t) => t.id === selecionada.copiloto_id)?.nome_completo || "Não escalado"} /></div>
        {selecionada.observacoes && <div className="rounded-xl border border-border bg-muted/20 p-4"><h3 className="text-xs font-semibold">Observações da operação</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{selecionada.observacoes}</p></div>}
        {selecionada.status === "pendente" ? (
          // === VISÃO UNIFICADA DE CONFIRMAÇÃO ===
          <div className="space-y-6">
            {/* Informações fixas não editáveis nesta etapa */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Detalhe label="Cliente / sócio" valor={selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Não informado"} />
              <Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} />
              <Detalhe label="Status da solicitação" valor={statusLabel(selecionada.status)} />
              <Detalhe label="Rota" valor={`${selecionada.origem} → ${selecionada.destino}`} />
            </div>

            {/* Formulário de edição/confirmação */}
            <div id="confirmacao-voo" className="rounded-xl border border-border bg-secondary/15 p-4 sm:p-5">
              <div className="mb-5">
                <p className="text-sm font-bold text-foreground">Confirmar dados operacionais</p>
                <p className="mt-1 text-xs text-muted-foreground">Revise ou altere os dados do voo antes de aprovar. As mudanças serão salvas ao confirmar.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Aeronave</Label>
                  <SearchableCombobox items={aeronaves} value={edicao.aeronave_id} onChange={editarAeronave} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave cadastrada." icon={<Plane size={14} />} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emprestimo-agendamento" className="text-xs">ESSE VOO É UM EMPRESTIMO DA AERONAVE?</Label>
                  <select id="emprestimo-agendamento" value={edicao.emprestimo ? "sim" : "nao"} onChange={(event) => setEdicao((atual) => ({ ...atual, emprestimo: event.target.value === "sim", cliente_emprestimo_id: "", socio_emprestimo_id: "" }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs">
                    <option value="nao" disabled={!aeronaveDoTitular}>NÃO</option>
                    <option value="sim">SIM</option>
                  </select>
                </div>

                {edicao.emprestimo && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cedente</Label>
                    <SearchableCombobox items={cedentes} value={cedenteSelecionado} onChange={editarCedente} placeholder="Selecione quem empresta" searchPlaceholder="Buscar cliente ou sócio" emptyMessage="Nenhum cotista vinculado a esta aeronave." icon={<Users size={14} />} />
                  </div>
                )}

                <PeriodoAgendamento inicio={edicao.data_agendada} fim={edicao.data_fim} aoAlterarInicio={(valor) => setEdicao((atual) => ({ ...atual, data_agendada: valor }))} aoAlterarFim={(valor) => setEdicao((atual) => ({ ...atual, data_fim: valor }))} />

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="horario-confirmacao" className="text-xs">Horário Previsto (UTC)</Label>
                  <div className="flex items-center gap-3 rounded-md border border-input bg-background px-3">
                    <Input id="horario-confirmacao" type="time" value={edicao.horario} onChange={(event) => setEdicao((atual) => ({ ...atual, horario: event.target.value }))} className="h-10 w-auto border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0" />
                    <span className="border-l border-border pl-3 text-[10px] font-medium text-muted-foreground">
                      Brasília {horarioFormatado.brasilia}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="passageiros-confirmacao" className="text-xs">Passageiros</Label>
                  <Input id="passageiros-confirmacao" type="number" min={1} step={1} value={edicao.numero_passageiros} onChange={(event) => setEdicao((atual) => ({ ...atual, numero_passageiros: Number(event.target.value) }))} className="h-10 text-xs" />
                </div>
              </div>

              <div className="mt-6 space-y-4 border-t border-border/60 pt-5">
                <p className="text-xs font-bold text-foreground">Definição da Tripulação</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">PIC (Piloto em comando)</Label>
                    <SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={pilotoId} onChange={aoPiloto} placeholder="Selecione o comandante" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SIC (Segundo em comando) <span className="font-normal text-muted-foreground">(Opcional)</span></Label>
                    <SearchableCombobox items={tripulacao.filter((item) => item.id !== pilotoId).map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={copilotoId} onChange={aoCopiloto} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="motivo-reprovacao" className="text-xs">Motivo (apenas se for reprovar)</Label>
                  <Textarea id="motivo-reprovacao" value={motivo} onChange={(event) => aoMotivo(event.target.value)} placeholder="Justificativa para rejeição..." className="min-h-16 text-xs" />
                </div>

                <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:justify-end">
                  <Button type="button" onClick={aoReprovar} disabled={processando} variant="outline" className="h-11 w-full gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10 sm:w-auto">
                    <X size={14} /> Reprovar Solicitação
                  </Button>
                  <Button type="button" onClick={confirmar} disabled={processando || !pilotoId || !formularioValido} className="h-11 w-full gap-2 bg-[#2bbf8a] text-[#03150e] hover:bg-[#45d5a5] sm:w-auto">
                    <Check size={14} /> {processando ? "Salvando..." : "Salvar e Aprovar Voo"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // === VISÃO DE LEITURA (APROVADO / ENCERRADO) ===
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Detalhe label="Cliente / sócio" valor={selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Não informado"} />
              <Detalhe label="Aeronave" valor={`${selecionada.matricula_registro || "A definir"} · ${selecionada.modelo || "—"}`} />
              <Detalhe label="Horário / UTC" valor={`Brasília ${horarioAtual.brasilia} · UTC ${horarioAtual.utc}`} />
              <Detalhe label="Período" valor={`${formatarData(selecionada.data_agendada)}${selecionada.data_fim && selecionada.data_fim !== selecionada.data_agendada ? ` até ${formatarData(selecionada.data_fim)}` : ""}`} />
              <Detalhe label="Passageiros" valor={String(selecionada.numero_passageiros || 1)} />
              <Detalhe label="Número do voo" valor={selecionada.numero_voo || "Será gerado na confirmação"} />
              <Detalhe label="Status" valor={statusLabel(selecionada.status)} />
              <Detalhe label="Empréstimo" valor={emprestimoAtual} />
            </div>

            <div className="rounded-xl border border-border bg-secondary/15 p-4 sm:p-5">
              <p className="text-sm font-bold text-foreground">{selecionada.status === "encerrada" ? "Voo encerrado" : "Solicitação processada"}</p>
              {editandoAgendamento && <div className="mt-4 grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><Label className="text-[10px]">Origem</Label><Input value={dadosAgendamento.origem || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, origem: event.target.value.toUpperCase() }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Destino</Label><Input value={dadosAgendamento.destino || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, destino: event.target.value.toUpperCase() }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Data início</Label><Input type="date" value={dadosAgendamento.data_agendada || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, data_agendada: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Data fim</Label><Input type="date" value={dadosAgendamento.data_fim || ""} min={dadosAgendamento.data_agendada} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, data_fim: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Horário UTC</Label><Input type="time" value={typeof dadosAgendamento.horario_previsto_agendamento === "string" && dadosAgendamento.horario_previsto_agendamento.includes("T") ? horaParaCampo(dadosAgendamento.horario_previsto_agendamento) : dadosAgendamento.horario_previsto_agendamento || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, horario_previsto_agendamento: event.target.value }))} className="mt-1 h-9 text-xs" /></div>
                <div><Label className="text-[10px]">Passageiros</Label><Input type="number" min={1} value={dadosAgendamento.numero_passageiros || 1} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, numero_passageiros: Number(event.target.value) }))} className="mt-1 h-9 text-xs" /></div>
                <div className="lg:col-span-2"><Label className="text-[10px]">Aeronave</Label><SearchableCombobox items={opcoes.aeronaves.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${item.modelo || ""}` }))} value={dadosAgendamento.aeronave_id || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, aeronave_id: valor }))} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave" emptyMessage="Nenhuma aeronave encontrada." icon={<Plane size={14} />} /></div>
                <div className="lg:col-span-2"><Label className="text-[10px]">PIC</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · ${item.canac}` }))} value={dadosAgendamento.piloto_id || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, piloto_id: valor }))} placeholder="Selecione o comandante" searchPlaceholder="Buscar tripulante" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><Button type="button" onClick={salvarEdicaoAgendamento} disabled={processando} className="gap-2 text-xs"><Check size={13} /> Salvar alterações</Button><Button type="button" variant="outline" onClick={() => setEditandoAgendamento(false)} className="text-xs">Cancelar</Button></div>
              </div>}

              {selecionada.status === "aprovada" && (
                <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-2">
                  <CardMensagem
                    titulo="Mensagem para o cliente"
                    mensagem={`Olá ${selecionada.socio_nome || selecionada.cliente_razao_social || "Cotista"}, seu voo ${selecionada.numero_voo || ""} foi confirmado para o dia ${formatarData(selecionada.data_agendada)} com o tripulante ${selecionada.piloto_nome || tripulacao.find((tripulante) => tripulante.id === selecionada.piloto_id)?.nome_completo || "escalado"}.`}
                  />
                  <CardMensagem
                    titulo="Mensagem para o tripulante"
                    tom="sky"
                    mensagem={`Olá ${selecionada.piloto_nome || tripulacao.find((tripulante) => tripulante.id === selecionada.piloto_id)?.nome_completo || "tripulante escalado"}, você foi escalado para o voo - ${selecionada.numero_voo || ""}, no dia ${formatarData(selecionada.data_agendada)} na aeronave ${selecionada.matricula_registro || "a definir"} com o cotista ${selecionada.socio_nome || selecionada.cliente_razao_social || "não informado"} às ${horarioAtual.utc} UTC.`}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border bg-muted/20 p-4 sm:p-6"><h3 className="text-xs font-semibold">Ações do voo</h3>{acoes}</div>
      <div className="border-t border-border p-4 sm:p-5"><AcompanhamentoVooAgendado item={selecionada} voosEmOperacao={voosEmOperacao} /></div>
      {selecionada.status === "encerrada" && <div className="border-t border-border p-4 sm:p-5"><JornadaVoo key={selecionada.id} item={selecionada} /></div>}
    </section>
  );
}

/* Mensagens: API moderna de cópia, alternativa legada e seleção manual. */
function CardMensagem({ titulo, mensagem, tom = "primary" }: { titulo: string; mensagem: string; tom?: "primary" | "sky" }) {
  const { toast } = useToast();
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopiado(false);
    return () => { if (temporizador.current) clearTimeout(temporizador.current); };
  }, [mensagem]);

  const copiar = async () => {
    const elementoAtivo = document.activeElement;
    const rolagem = { x: window.scrollX, y: window.scrollY };
    let sucesso = false;
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(mensagem); sucesso = true; } catch { /* tenta a alternativa */ }
    }
    if (!sucesso && campo.current) {
      campo.current.focus({ preventScroll: true });
      campo.current.select();
      campo.current.setSelectionRange(0, mensagem.length);
      try { sucesso = document.execCommand("copy"); } catch { sucesso = false; }
    }
    if (!sucesso) {
      toast({ title: "Selecione e copie a mensagem", description: "Use Ctrl+C, ⌘C ou a opção Copiar do celular." });
      return;
    }
    if (elementoAtivo instanceof HTMLElement) elementoAtivo.focus({ preventScroll: true });
    window.scrollTo(rolagem.x, rolagem.y);
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 2200);
  };

  return <div className={cn("flex min-w-0 flex-col rounded-xl border p-4", tom === "sky" ? "border-sky-500/20 bg-sky-500/5" : "border-primary/20 bg-primary/5")}>
    <div className="flex items-start justify-between gap-3">
      <p className={cn("pt-2 text-[10px] font-bold uppercase tracking-wide", tom === "sky" ? "text-sky-600 dark:text-sky-300" : "text-primary")}>{titulo}</p>
      <button type="button" onClick={() => void copiar()} aria-label={copiado ? "Mensagem copiada" : `Copiar ${titulo.toLowerCase()}`} title={copiado ? "Copiado!" : "Copiar mensagem"} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {copiado ? <Check size={16} className="text-emerald-600 dark:text-emerald-300" /> : <Copy size={16} />}
      </button>
    </div>
    <textarea ref={campo} readOnly aria-label={titulo} value={mensagem} className="mt-3 min-h-28 w-full flex-1 resize-y rounded-lg border border-border bg-background/50 p-3 text-xs leading-relaxed text-foreground" />
    <p role="status" aria-live="polite" className="mt-2 min-h-4 text-[10px] text-emerald-700 dark:text-emerald-300">{copiado ? "Mensagem copiada!" : ""}</p>
  </div>;
}

// Bloco de informação da página de detalhes (altura mínima igual para alinhar o grid)
function Detalhe({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex min-h-[60px] flex-col justify-center rounded-lg border border-border/70 bg-secondary/25 p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-xs font-semibold text-foreground">{valor}</p>
    </div>
  );
}
