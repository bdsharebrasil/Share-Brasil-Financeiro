import { useState, type FormEvent } from "react";
import { Calendar as CalendarIcon, Check, Plane, Plus, Search, Users, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { DayPicker, type DateRange } from "react-day-picker";

import { CabecalhoSecao } from "@/components/dashboard/ComponentesDashboard";
import { Button } from "@/components/ui/button";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import type { AerodromoOption } from "@/lib/flightplan-api";
import type { NovoAgendamento, OpcoesAgendamentoResponse, TripulanteAgendamento } from "@/lib/colaborador-api";

function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** O sistema trabalha em UTC, mas quem agenda pensa em Brasília: mostramos os dois. */
function horaBrasilia(data: string, hora?: string) {
  if (!data || !hora) return "";
  const instante = new Date(`${data}T${hora}:00Z`);
  if (!Number.isFinite(instante.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(instante);
}

export type FormularioAgendamentoProps = {
  /** Quando exibido dentro de um modal: sem borda/sombra própria e sem botão de fechar duplicado. */
  emDialogo?: boolean;
  novo: NovoAgendamento;
  opcoes: OpcoesAgendamentoResponse;
  titulares: { id: string; label: string }[];
  aerodromos: AerodromoOption[];
  aerodromosCarregando: boolean;
  tripulacao: TripulanteAgendamento[];
  atualizando: boolean;
  atualizar: <K extends keyof NovoAgendamento>(campo: K, valor: NovoAgendamento[K]) => void;
  aoCancelar: () => void;
  aoEnviar: (event: FormEvent<HTMLFormElement>) => void;
};

export function FormularioAgendamento({ emDialogo = false, novo, opcoes, titulares, aerodromos, aerodromosCarregando, tripulacao, atualizando, atualizar, aoCancelar, aoEnviar }: FormularioAgendamentoProps) {
  const aeronavesAtivas = opcoes.aeronaves.filter((aeronave) => ["ativa", "ativo", "active"].includes(String(aeronave.status || "").trim().toLowerCase()));
  const aeronaveSelecionada = aeronavesAtivas.find((aeronave) => aeronave.id === novo.aeronave_id);
  const titularSelecionado = novo.cliente_id ? `cliente:${novo.cliente_id}` : novo.socio_id ? `socio:${novo.socio_id}` : "";
  const clienteTitularId = novo.cliente_id || opcoes.socios.find((socio) => socio.id === novo.socio_id)?.cliente_id;
  const aeronaveDoTitular = Boolean(novo.aeronave_id && (novo.cliente_id || novo.socio_id) && opcoes.vinculos.some((vinculo) => vinculo.aeronave_id === novo.aeronave_id && ((clienteTitularId && vinculo.cliente_id === clienteTitularId) || (novo.socio_id && vinculo.socio_id === novo.socio_id))));
  const aeronaveEmprestada = Boolean(aeronaveSelecionada && titularSelecionado && !aeronaveDoTitular);
  const cedentes = (() => {
    const ids = new Set<string>();
    return opcoes.vinculos
      .filter((vinculo) => vinculo.aeronave_id === novo.aeronave_id)
      .flatMap((vinculo) => {
        const itens: { id: string; label: string }[] = [];
        if (vinculo.cliente_id) {
          const cliente = opcoes.clientes.find((item) => item.id === vinculo.cliente_id);
          const id = `cliente:${vinculo.cliente_id}`;
          if (cliente && !ids.has(id)) {
            ids.add(id);
            itens.push({ id, label: `${cliente.nome}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}` });
          }
        }
        if (vinculo.socio_id) {
          const socio = opcoes.socios.find((item) => item.id === vinculo.socio_id);
          const id = `socio:${vinculo.socio_id}`;
          if (socio && !ids.has(id)) {
            ids.add(id);
            itens.push({ id, label: socio.nome });
          }
        }
        return itens;
      });
  })();
  const mudarTitular = (valor: string) => {
    const [tipo, id] = valor.split(":");
    atualizar("cliente_id", tipo === "cliente" ? id : undefined);
    atualizar("socio_id", tipo === "socio" ? id : undefined);
    atualizar("aeronave_id", "");
    atualizar("cliente_emprestimo_id", undefined);
    atualizar("socio_emprestimo_id", undefined);
    atualizar("voo_emprestimo_confirmado", undefined);
  };
  const selecionarAeronave = (valor: string) => {
    atualizar("aeronave_id", valor);
    atualizar("cliente_emprestimo_id", undefined);
    atualizar("socio_emprestimo_id", undefined);
    atualizar("voo_emprestimo_confirmado", undefined);
  };
  const selecionarCedente = (valor: string) => {
    const [tipo, id] = valor.split(":");
    atualizar("cliente_emprestimo_id", tipo === "cliente" ? id : undefined);
    atualizar("socio_emprestimo_id", tipo === "socio" ? id : undefined);
    atualizar("voo_emprestimo_confirmado", true);
  };
  const quantidadePassageiros = Number(novo.numero_passageiros ?? 1);
  const nomesPassageiros = Array.from({ length: Number.isInteger(quantidadePassageiros) && quantidadePassageiros > 0 ? Math.min(quantidadePassageiros, 50) : 0 }, (_, indice) => novo.passageiros?.[indice] ?? "");
  const alterarQuantidadePassageiros = (quantidade: number) => {
    atualizar("numero_passageiros", quantidade);
    const tamanho = Number.isInteger(quantidade) && quantidade > 0 ? Math.min(quantidade, 50) : 0;
    atualizar("passageiros", Array.from({ length: tamanho }, (_, indice) => novo.passageiros?.[indice] ?? ""));
  };
  const alterarNomePassageiro = (indice: number, nome: string) => {
    const nomes = [...nomesPassageiros];
    nomes[indice] = nome;
    atualizar("passageiros", nomes);
  };
  const aerodromoItems = aerodromos.map((item) => ({ id: item.id, label: item.label }));
  const aeronaveItems = aeronavesAtivas.map((item) => ({ id: item.id, label: `${item.matricula_registro} · ${[item.fabricante, item.modelo].filter(Boolean).join(" ")}` }));

  return (
    <section className={emDialogo ? "agendamento-form overflow-visible" : "agendamento-form overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5"}>
      <CabecalhoSecao icon={<Plus size={15} />} title="Novo agendamento" detail="O número do voo é gerado somente após a confirmação" action={emDialogo ? undefined : <button type="button" onClick={aoCancelar} aria-label="Fechar novo agendamento" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} />
      <form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6 xl:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[11px]">Cliente / sócio</Label>
          <SearchableCombobox items={titulares} value={titularSelecionado} onChange={mudarTitular} placeholder="Selecione o cliente ou sócio" searchPlaceholder="Digite para buscar cliente ou sócio" emptyMessage="Nenhum cliente ou sócio encontrado." icon={<Users size={14} />} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[11px]">Aeronave</Label>
          <SearchableCombobox items={aeronaveItems} value={novo.aeronave_id} onChange={selecionarAeronave} placeholder={titularSelecionado ? "Selecione a aeronave" : "Escolha primeiro o cliente ou sócio"} searchPlaceholder="Digite matrícula, fabricante ou modelo" emptyMessage="Nenhuma aeronave ativa encontrada." icon={<Plane size={14} />} disabled={!titularSelecionado} />
        </div>
        {aeronaveEmprestada && <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 sm:col-span-2 xl:col-span-4">
          <div><p className="text-[11px] font-bold">Essa aeronave não está vinculada ao titular selecionado. Esse voo é emprestado?</p><p className="mt-1 text-[11px] text-muted-foreground">Confirme para registrar quem está cedendo a aeronave neste agendamento.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={novo.voo_emprestimo_confirmado === true ? "default" : "outline"} onClick={() => atualizar("voo_emprestimo_confirmado", true)} className="h-8 text-[11px]">Sim, é emprestado</Button>
            <Button type="button" variant={novo.voo_emprestimo_confirmado === false ? "default" : "outline"} onClick={() => { atualizar("voo_emprestimo_confirmado", false); atualizar("cliente_emprestimo_id", undefined); atualizar("socio_emprestimo_id", undefined); atualizar("aeronave_id", ""); }} className="h-8 text-[11px]">Não</Button>
          </div>
          {novo.voo_emprestimo_confirmado === true && <div className="space-y-1.5"><Label className="text-[11px]">Cliente ou sócio que está emprestando</Label><SearchableCombobox items={cedentes.filter((item) => item.id !== titularSelecionado)} value={novo.cliente_emprestimo_id ? `cliente:${novo.cliente_emprestimo_id}` : novo.socio_emprestimo_id ? `socio:${novo.socio_emprestimo_id}` : ""} onChange={selecionarCedente} placeholder="Selecione quem está emprestando" searchPlaceholder="Digite o nome do cedente" emptyMessage="Nenhum cotista vinculado a esta aeronave." icon={<Users size={14} />} /></div>}
        </div>}
        <div className="space-y-1.5"><Label className="text-[11px]">Origem</Label><SearchableCombobox items={aerodromoItems} value={novo.origem} onChange={(value) => atualizar("origem", value)} placeholder={aerodromosCarregando ? "Carregando aeródromos..." : "Selecione o aeródromo"} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div>
        <div className="space-y-1.5"><Label className="text-[11px]">Destino</Label><SearchableCombobox items={aerodromoItems} value={novo.destino} onChange={(value) => atualizar("destino", value)} placeholder={aerodromosCarregando ? "Carregando aeródromos..." : "Selecione o aeródromo"} searchPlaceholder="Buscar ICAO, nome ou cidade" emptyMessage="Nenhum aeródromo encontrado." icon={<Search size={14} />} disabled={aerodromosCarregando} /></div>
        <PeriodoAgendamento inicio={novo.data_agendada} fim={novo.data_fim} aoAlterarInicio={(valor) => atualizar("data_agendada", valor)} aoAlterarFim={(valor) => atualizar("data_fim", valor)} />
        <div className="space-y-1.5"><Label htmlFor="hora-agendamento" className="text-[11px]">Horário previsto (UTC)</Label><Input id="hora-agendamento" type="time" value={novo.horario_previsto_agendamento || ""} onChange={(event) => atualizar("horario_previsto_agendamento", event.target.value)} required className="h-10 text-xs" />{novo.horario_previsto_agendamento && <p className="text-[11px] text-muted-foreground">Em Brasília: <strong className="text-foreground">{horaBrasilia(novo.data_agendada, novo.horario_previsto_agendamento)}</strong></p>}</div>
        <div className="space-y-1.5"><Label htmlFor="passageiros-agendamento" className="text-[11px]">Passageiros</Label><Input id="passageiros-agendamento" type="number" min={1} max={50} step={1} value={novo.numero_passageiros ?? 1} onChange={(event) => alterarQuantidadePassageiros(Number(event.target.value))} className="h-10 text-xs" /></div>
        {nomesPassageiros.map((nome, indice) => <div key={indice} className="space-y-1.5"><Label htmlFor={`nome-passageiro-${indice}`} className="text-[11px]">Nome completo do passageiro {indice + 1}</Label><Input id={`nome-passageiro-${indice}`} value={nome} onChange={(event) => alterarNomePassageiro(indice, event.target.value)} autoComplete="name" minLength={3} maxLength={120} required className="h-10 text-xs" placeholder="Nome e sobrenome" /></div>)}
        <div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px]">Comandante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={novo.piloto_id || ""} onChange={(value) => atualizar("piloto_id", value)} placeholder="Definir depois" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label className="text-[11px]">SIC (segundo em comando) <span className="text-muted-foreground">(opcional)</span></Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac}` }))} value={novo.copiloto_id || ""} onChange={(value) => atualizar("copiloto_id", value)} placeholder="Sem copiloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div>
        <div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-agendamento" className="text-[11px]">Observações</Label><Textarea id="observacoes-agendamento" value={novo.observacoes || ""} onChange={(event) => atualizar("observacoes", event.target.value)} placeholder="Informações da trip, passageiros ou operação" className="min-h-16 text-xs" /></div>
        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="h-11 w-full rounded-xl text-xs sm:w-auto">Cancelar</Button><Button type="submit" disabled={atualizando} className="h-11 w-full gap-2 rounded-xl text-xs sm:w-auto">{atualizando ? "Salvando..." : "Salvar agendamento"}<Check size={14} /></Button></div>
      </form>
    </section>
  );
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

  return <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Período do voo</Label><div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"><Input aria-label="Data de início do voo" type="date" value={inicio} onChange={(event) => aoAlterarInicio(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><span className="text-[11px] text-muted-foreground">até</span><Input aria-label="Data de fim do voo" type="date" value={fim} min={inicio} onChange={(event) => aoAlterarFim(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover open={aberto} onOpenChange={aoAbrir}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário do período"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent align="end" sideOffset={8} collisionPadding={12} className="z-[70] w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(24rem,calc(100dvh-1.5rem))] overflow-y-auto p-3"><p className="mb-2 text-center text-xs font-semibold text-foreground">{aguardandoFim ? "Selecione a data de fim" : "Selecione a data de início"}</p><DayPicker locale={ptBR} mode="range" month={mesVisivel} onMonthChange={setMesVisivel} selected={aguardandoFim && inicioTemporario ? { from: inicioTemporario } : undefined} onSelect={selecionarIntervalo} showOutsideDays className="mx-auto" classNames={{ months: "flex justify-center", month: "space-y-3", caption: "relative flex items-center justify-center pt-1", caption_label: "text-xs font-semibold", nav: "flex items-center justify-between", nav_button: "h-7 w-7 rounded-md border border-border bg-background p-1 text-foreground hover:bg-accent", nav_button_previous: "absolute left-0", nav_button_next: "absolute right-0", table: "w-full border-collapse", head_row: "flex", head_cell: "w-9 rounded-md text-[11px] font-normal text-muted-foreground", row: "mt-1 flex w-full", cell: "relative h-9 w-9 p-0 text-center text-xs focus-within:relative focus-within:z-20", day: "h-9 w-9 rounded-md p-0 text-xs font-normal text-foreground hover:bg-accent", day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground", day_range_start: "rounded-l-md bg-primary text-primary-foreground", day_range_end: "rounded-r-md bg-primary text-primary-foreground", day_range_middle: "rounded-none bg-primary/15 text-foreground", day_today: "border border-primary/50", day_outside: "text-muted-foreground opacity-40", day_disabled: "text-muted-foreground opacity-30", day_hidden: "invisible" }} /></PopoverContent></Popover></div></div>;
}

function DataAgendamento({ valor, aoAlterar }: { valor: string; aoAlterar: (valor: string) => void }) {
  const selecionada = valor ? new Date(`${valor}T00:00:00`) : undefined;
  return <div className="space-y-1.5"><Label htmlFor="data-agendamento" className="text-[11px]">Data do voo</Label><div className="flex gap-2"><Input id="data-agendamento" type="date" value={valor} onChange={(event) => aoAlterar(event.target.value)} required className="h-10 min-w-0 flex-1 text-xs" /><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-10 shrink-0 border-border px-0" aria-label="Abrir calendário"><CalendarIcon size={15} /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><DateCalendar value={selecionada ?? null} onChange={(data) => aoAlterar(dataIso(data))} /></PopoverContent></Popover></div></div>;
}

export type DadosDisponibilidade = {
  tripulante_id: string;
  data_inicio: string;
  data_fim: string;
  status: "aviso" | "ferias" | "folga" | "atestado_medico" | "treinamento" | "acompanhando_manutencao" | "disponivel";
  observacoes: string;
};

type FormularioDisponibilidadeProps = {
  emDialogo?: boolean;
  dados: DadosDisponibilidade;
  tripulacao: TripulanteAgendamento[];
  atualizando: boolean;
  aoCancelar: () => void;
  aoEnviar: (event: FormEvent<HTMLFormElement>) => void;
  aoAlterar: (campo: keyof DadosDisponibilidade, valor: string) => void;
};

export function FormularioDisponibilidade({ emDialogo = false, dados, tripulacao, atualizando, aoCancelar, aoEnviar, aoAlterar }: FormularioDisponibilidadeProps) {
  return <section className={emDialogo ? "agendamento-form overflow-visible" : "agendamento-form overflow-visible rounded-2xl border border-primary/25 bg-card shadow-xl shadow-black/5"}>
    <CabecalhoSecao icon={<Users size={15} />} title="Criar escala" detail="Selecione o tripulante, período e status da escala" action={<button type="button" onClick={aoCancelar} aria-label="Fechar formulário de disponibilidade" className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X size={16} /></button>} />
    <form onSubmit={aoEnviar} className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6 xl:grid-cols-4">
      <div className="space-y-1.5 xl:col-span-2"><Label className="text-[11px]">Tripulante</Label><SearchableCombobox items={tripulacao.map((item) => ({ id: item.id, label: `${item.nome_completo} · CANAC ${item.canac} · ${item.origem === "freelancer" ? "Freelancer" : "Tripulação"}` }))} value={dados.tripulante_id} onChange={(valor) => aoAlterar("tripulante_id", valor)} placeholder="Selecione o piloto" searchPlaceholder="Digite o nome ou CANAC" emptyMessage="Nenhum tripulante encontrado." icon={<Users size={14} />} /></div>
      <div className="space-y-1.5"><Label htmlFor="status-disponibilidade" className="text-[11px]">Status</Label><Select value={dados.status} onValueChange={(value) => aoAlterar("status", value)}><SelectTrigger id="status-disponibilidade" className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aviso">Sob aviso</SelectItem><SelectItem value="ferias">Férias</SelectItem><SelectItem value="folga">Folga</SelectItem><SelectItem value="atestado_medico">Atestado médico</SelectItem><SelectItem value="treinamento">Treinamento</SelectItem><SelectItem value="acompanhando_manutencao">Acompanhando manutenção</SelectItem><SelectItem value="disponivel">Disponível</SelectItem></SelectContent></Select></div>
      <DataAgendamento valor={dados.data_inicio} aoAlterar={(valor) => aoAlterar("data_inicio", valor)} />
      <DataAgendamento valor={dados.data_fim} aoAlterar={(valor) => aoAlterar("data_fim", valor)} />
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="observacoes-disponibilidade" className="text-[11px]">Observações</Label><Textarea id="observacoes-disponibilidade" value={dados.observacoes} onChange={(event) => aoAlterar("observacoes", event.target.value)} placeholder="Observações da coordenação" className="min-h-16 text-xs" /></div>
      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 xl:col-span-4"><Button type="button" variant="outline" onClick={aoCancelar} className="text-xs">Cancelar</Button><Button type="submit" disabled={atualizando} className="text-xs">{atualizando ? "Salvando..." : "Salvar status"}</Button></div>
    </form>
  </section>;
}
