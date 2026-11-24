import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, Copy, Pencil, Plane, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import {
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type OpcoesAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

export function DetalhesSolicitacao({
  acoes,
  mostrarMensagensConfirmacao,
  selecionada,
  opcoes,
  tripulacao,
  pilotoId,
  copilotoId,
  motivo,
  processando,
  aoAtualizar,
  aoFechar,
  aoPiloto,
  aoCopiloto,
  aoMotivo,
  aoAprovar,
  aoReprovar,
  somenteLeitura = false,
  incorporado = false,
}: {
  somenteLeitura?: boolean;
  incorporado?: boolean;
  acoes: ReactNode;
  mostrarMensagensConfirmacao: boolean;
  selecionada: SolicitacaoVooInterna;
  opcoes: OpcoesAgendamentoResponse;
  tripulacao: TripulanteAgendamento[];
  pilotoId: string;
  copilotoId: string;
  motivo: string;
  processando: boolean;
  aoAtualizar: (dados: AtualizacaoAgendamento) => Promise<boolean | void>;
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
    aeronave_id: selecionada.aeronave_id || "",
    origem: selecionada.origem,
    destino: selecionada.destino,
    data_agendada: selecionada.data_agendada,
    data_fim: selecionada.data_fim || selecionada.data_agendada,
    horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento),
    numero_passageiros: Number(selecionada.numero_passageiros) || 1,
      passageiros: selecionada.passageiros || [],
    piloto_id: selecionada.piloto_id || "",
    copiloto_id: selecionada.copiloto_id || "",
    observacoes: selecionada.observacoes || "",
  }));

  useEffect(() => {
    setEdicao(criarEdicaoConfirmacao(selecionada));
    setEditandoAgendamento(false);
    setDadosAgendamento({
      aeronave_id: selecionada.aeronave_id || "",
      origem: selecionada.origem,
      destino: selecionada.destino,
      data_agendada: selecionada.data_agendada,
      data_fim: selecionada.data_fim || selecionada.data_agendada,
      horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento),
      numero_passageiros: Number(selecionada.numero_passageiros) || 1,
      passageiros: selecionada.passageiros || [],
      piloto_id: selecionada.piloto_id || "",
      copiloto_id: selecionada.copiloto_id || "",
      observacoes: selecionada.observacoes || "",
    });
  }, [selecionada]);

  const clienteTitularId = selecionada.cliente_id || opcoes.socios.find((s) => s.id === selecionada.socio_id)?.cliente_id;
  const aeronaveDoTitular = Boolean(
    edicao.aeronave_id &&
      opcoes.vinculos.some(
        (vinculo) =>
          vinculo.aeronave_id === edicao.aeronave_id &&
          ((clienteTitularId && vinculo.cliente_id === clienteTitularId) ||
            (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
      )
  );

  const cedentes = (() => {
    const ids = new Set<string>();
    return opcoes.vinculos
      .filter((vinculo) => vinculo.aeronave_id === edicao.aeronave_id)
      .flatMap((vinculo) => {
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
    const vinculadaAoTitular = opcoes.vinculos.some(
      (vinculo) =>
        vinculo.aeronave_id === aeronaveId &&
        ((clienteTitularId && vinculo.cliente_id === clienteTitularId) ||
          (selecionada.socio_id && vinculo.socio_id === selecionada.socio_id))
    );
    setEdicao((atual) => ({
      ...atual,
      aeronave_id: aeronaveId,
      emprestimo: !vinculadaAoTitular,
      cliente_emprestimo_id: "",
      socio_emprestimo_id: "",
    }));
  };

  const editarCedente = (valor: string) => {
    const [tipo, id] = valor.split(":");
    setEdicao((atual) => ({
      ...atual,
      cliente_emprestimo_id: tipo === "cliente" ? id : "",
      socio_emprestimo_id: tipo === "socio" ? id : "",
    }));
  };

  const cedenteSelecionado = edicao.cliente_emprestimo_id
    ? `cliente:${edicao.cliente_emprestimo_id}`
    : edicao.socio_emprestimo_id
    ? `socio:${edicao.socio_emprestimo_id}`
    : "";

  const horarioFormatado = formatarHorarioAgendamento(
    edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null
  );

  const emprestimoValido = !edicao.emprestimo || Boolean(cedenteSelecionado);
  const formularioValido = Boolean(
    edicao.aeronave_id &&
      /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_agendada) &&
      /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_fim) &&
      edicao.data_fim >= edicao.data_agendada &&
      Number.isInteger(edicao.numero_passageiros) &&
      edicao.numero_passageiros >= 1 &&
      emprestimoValido &&
      (aeronaveDoTitular || edicao.emprestimo)
  );

  const confirmar = () =>
    aoAprovar({
      aeronave_id: edicao.aeronave_id,
      data_agendada: edicao.data_agendada,
      data_fim: edicao.data_fim,
      horario_previsto_agendamento: edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null,
      numero_passageiros: edicao.numero_passageiros,
      cliente_emprestimo_id: edicao.emprestimo ? edicao.cliente_emprestimo_id || null : null,
      socio_emprestimo_id: edicao.emprestimo ? edicao.socio_emprestimo_id || null : null,
    });

  const titularNome =
    selecionada.socio_nome || selecionada.cliente_razao_social || selecionada.codigo_cliente || "Titular não informado";

  const comandanteNome =
    selecionada.piloto_nome || tripulacao.find((t) => t.id === pilotoId)?.nome_completo || "Comandante";

  const statusPendente = !somenteLeitura && String(selecionada.status || "").trim().toLowerCase() === "pendente";
  // Detalhes de um voo já numerado não podem oferecer uma segunda confirmação.
  const podeConfirmar = statusPendente && !selecionada.numero_voo;
  const podeEditar = !somenteLeitura && !["encerrada", "concluida", "cancelada", "reprovada", "pendente"].includes(String(selecionada.status).toLowerCase());
  const statusOperacional = String(selecionada.status || "").trim().toLowerCase();
  const rotuloStatus: Record<string, string> = {
    aprovada: "Confirmado", acionado: "Acionado", decolado: "Decolado",
    em_rota: "Em rota", em_voo: "Em voo", em_solo: "Em solo",
    encerrada: "Encerrado", concluida: "Concluído", cancelada: "Cancelado",
    reprovada: "Reprovado",
  };

  return (
    <div className="space-y-6">
      {/* GRID DE 2 COLUNAS DO WIREFRAME PRANCHA 02 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* COLUNA ESQUERDA: Dados da solicitação (#detalhes-solicitacao - 7 Colunas) */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-7">
          {/* Cabeçalho do Bloco Esquerdo */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              {!incorporado && <Button
                type="button"
                variant="outline"
                onClick={aoFechar}
                className="h-8 gap-1.5 rounded-lg border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-secondary/40"
              >
                <ChevronLeft size={14} /> Voltar
              </Button>}
              <div>
                <h3 className="text-base font-bold text-foreground">{podeConfirmar ? "Dados da solicitação" : "Dados do voo"}</h3>
                <p className="text-xs text-muted-foreground">{podeConfirmar ? "Revise e ajuste antes de confirmar" : "Informações do agendamento já confirmado"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {podeEditar && <Button type="button" variant="outline" size="sm" disabled={processando} onClick={() => setEditandoAgendamento((atual) => !atual)} className="gap-1.5 text-xs"><Pencil size={13} />{editandoAgendamento ? "Cancelar edição" : "Editar informações"}</Button>}
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  podeConfirmar
                    ? "bg-[#f1b950]/15 text-[#b47b1c]"
                    : "bg-[#17885f]/15 text-[#17885f]"
                }`}
              >
                {podeConfirmar ? "Pendente" : rotuloStatus[statusOperacional] || selecionada.status || "Registrado"}
              </span>
            </div>
          </div>

          {editandoAgendamento && podeEditar && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={async (event) => {
            event.preventDefault();
            const sucesso = await aoAtualizar({ ...dadosAgendamento, horario_previsto_agendamento: dadosAgendamento.horario_previsto_agendamento ? horarioUtc(dadosAgendamento.data_agendada || selecionada.data_agendada, dadosAgendamento.horario_previsto_agendamento) : null });
            if (sucesso !== false) setEditandoAgendamento(false);
          }}>
            <label className="space-y-1 text-xs">Aeronave<SearchableCombobox items={aeronaves} value={dadosAgendamento.aeronave_id || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, aeronave_id: valor }))} placeholder="Selecionar aeronave" /></label>
            {([['origem', 'Origem', 'text'], ['destino', 'Destino', 'text'], ['data_agendada', 'Data de saída', 'date'], ['data_fim', 'Data final', 'date'], ['horario_previsto_agendamento', 'Horário previsto (UTC)', 'time'], ['numero_passageiros', 'Passageiros', 'number']] as const).map(([campo, rotulo, tipo]) => <label key={campo} className="space-y-1 text-xs">{rotulo}<Input type={tipo} value={dadosAgendamento[campo] ?? ""} required={campo !== "horario_previsto_agendamento"} min={campo === "numero_passageiros" ? 1 : campo === "data_fim" ? dadosAgendamento.data_agendada : undefined} max={campo === "numero_passageiros" ? 50 : undefined} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, [campo]: tipo === "number" ? Number(event.target.value) : ['origem', 'destino'].includes(campo) ? event.target.value.toUpperCase() : event.target.value }))} /></label>)}
            <label className="text-xs sm:col-span-2">Nomes dos passageiros (um por linha)<Textarea value={(dadosAgendamento.passageiros||[]).join("\n")} onChange={e=>setDadosAgendamento(a=>({...a,passageiros:e.target.value?e.target.value.split("\n"):[]}))}/></label>
            {([['piloto_id', 'Comandante'], ['copiloto_id', 'Copiloto']] as const).map(([campo, rotulo]) => <label key={campo} className="space-y-1 text-xs">{rotulo}<SearchableCombobox items={tripulacao.filter((tripulante) => tripulante.id !== dadosAgendamento[campo === "piloto_id" ? "copiloto_id" : "piloto_id"]).map((tripulante) => ({ id: tripulante.id, label: tripulante.nome_completo }))} value={dadosAgendamento[campo] || ""} onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, [campo]: valor }))} placeholder={`Selecionar ${rotulo.toLowerCase()}`} /></label>)}
            <label className="space-y-1 text-xs sm:col-span-2">Observações<Textarea value={dadosAgendamento.observacoes || ""} onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, observacoes: event.target.value }))} /></label>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={processando} className="text-xs">{processando ? "Salvando..." : "Salvar alterações"}</Button><Button type="button" variant="outline" disabled={processando} onClick={() => setEditandoAgendamento(false)} className="text-xs">Cancelar</Button></div>
          </form>}
          <div hidden={editandoAgendamento && podeEditar}>
          {/* Grid de Campos da Solicitação */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Titular */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Titular</Label>
              <Input
                readOnly
                value={`${titularNome}${selecionada.codigo_cliente ? ` · ${selecionada.codigo_cliente}` : ""}`}
                className="mt-1.5 h-10 rounded-lg border-border bg-secondary/40 text-xs font-semibold text-foreground"
              />
            </div>

            {/* Aeronave */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Aeronave</Label>
              <div className="mt-1.5">
                {podeConfirmar ? (
                  <SearchableCombobox
                    items={aeronaves}
                    value={edicao.aeronave_id}
                    onChange={editarAeronave}
                    placeholder="Selecionar aeronave ▾"
                    searchPlaceholder="Buscar aeronave..."
                    emptyMessage="Nenhuma aeronave encontrada."
                    icon={<Plane size={14} className="text-[#3867ed]" />}
                  />
                ) : (
                  <Input readOnly value={aeronaves.find((aeronave) => aeronave.id === selecionada.aeronave_id)?.label || [selecionada.matricula_registro, selecionada.modelo].filter(Boolean).join(" · ") || "Aeronave não informada"} className="h-10 rounded-lg border-border bg-secondary/40 text-xs font-semibold text-foreground" />
                )}
              </div>
            </div>

            {/* Origem */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Origem</Label>
              <Input
                readOnly
                value={selecionada.origem || "—"}
                className="mt-1.5 h-10 rounded-lg border-border bg-secondary/40 font-mono text-xs font-bold text-foreground"
              />
            </div>

            {/* Destino */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Destino</Label>
              <Input
                readOnly
                value={selecionada.destino || "—"}
                className="mt-1.5 h-10 rounded-lg border-border bg-secondary/40 font-mono text-xs font-bold text-foreground"
              />
            </div>

            {/* Data de saída */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Data de saída</Label>
              <Input
                type="date"
                readOnly={!podeConfirmar}
                value={edicao.data_agendada}
                onChange={(e) => setEdicao((atual) => ({ ...atual, data_agendada: e.target.value }))}
                className="mt-1.5 h-10 rounded-lg border-border text-xs text-foreground"
              />
            </div>

            {/* Data final */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Data final</Label>
              <Input
                type="date"
                readOnly={!podeConfirmar}
                min={edicao.data_agendada}
                value={edicao.data_fim}
                onChange={(e) => setEdicao((atual) => ({ ...atual, data_fim: e.target.value }))}
                className="mt-1.5 h-10 rounded-lg border-border text-xs text-foreground"
              />
            </div>

            {/* Horário previsto (UTC) */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Horário previsto (UTC)</Label>
              <div className="relative mt-1.5 flex items-center">
                <Input
                  type="time"
                  readOnly={!podeConfirmar}
                  value={edicao.horario}
                  onChange={(e) => setEdicao((atual) => ({ ...atual, horario: e.target.value }))}
                  className="h-10 rounded-lg border-border text-xs text-foreground"
                />
                <span className="absolute right-3 text-[10px] font-semibold text-muted-foreground">
                  Brasília {horarioFormatado.brasilia}
                </span>
              </div>
            </div>

            {/* Passageiros */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Passageiros</Label>
              <Input
                type="number"
                readOnly={!podeConfirmar}
                min={1}
                value={edicao.numero_passageiros}
                onChange={(e) => setEdicao((atual) => ({ ...atual, numero_passageiros: Number(e.target.value) }))}
                className="mt-1.5 h-10 rounded-lg border-border text-xs text-foreground"
              />
            </div>
          </div>

          {/* Empréstimo da Aeronave */}
          <div className="mt-4">
            <Label className="text-xs font-semibold text-foreground">Empréstimo da aeronave</Label>
            {!podeConfirmar ? (
              <Input readOnly value={edicao.emprestimo
                ? `Sim · ${selecionada.socio_emprestimo_nome || selecionada.cliente_emprestimo_nome || "Cedente registrado"}`
                : "Voo próprio do titular · sem cedente"}
                className="mt-1.5 h-10 rounded-lg border-border bg-secondary/40 text-xs text-foreground" />
            ) : aeronaveDoTitular && !edicao.emprestimo ? (
              <Input
                readOnly
                value="Voo próprio do titular · sem cedente"
                className="mt-1.5 h-10 rounded-lg border-border bg-secondary/40 text-xs text-muted-foreground"
              />
            ) : (
              <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                <select
                  value={edicao.emprestimo ? "sim" : "nao"}
                  onChange={(e) =>
                    setEdicao((atual) => ({
                      ...atual,
                      emprestimo: e.target.value === "sim",
                      cliente_emprestimo_id: "",
                      socio_emprestimo_id: "",
                    }))
                  }
                  className="h-10 rounded-lg border border-border bg-card px-3 text-xs"
                >
                  <option value="nao" disabled={!aeronaveDoTitular}>NÃO</option>
                  <option value="sim">SIM (Voo emprestado)</option>
                </select>

                {edicao.emprestimo && (
                  <SearchableCombobox
                    items={cedentes}
                    value={cedenteSelecionado}
                    onChange={editarCedente}
                    placeholder="Selecionar cedente ▾"
                    searchPlaceholder="Buscar cliente ou sócio..."
                    emptyMessage="Nenhum cotista vinculado a esta aeronave."
                    icon={<Users size={14} className="text-[#3867ed]" />}
                  />
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="mt-4">
            <Label className="text-xs font-semibold text-foreground">Observações</Label>
            <Textarea
              readOnly={!podeConfirmar}
              value={selecionada.observacoes || "Sem observações registradas."}
              placeholder="Observações operacionais..."
              className="mt-1.5 min-h-[72px] rounded-lg border-border text-xs text-foreground"
            />
          </div>
          </div>
        </section>

        {/* A confirmação pertence exclusivamente a uma solicitação ainda pendente e sem número. */}
        {podeConfirmar ? (
        <section id="confirmacao-voo" className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-5">
          <div className="border-b border-border pb-4">
            <h3 className="text-base font-bold text-foreground">Confirmação do voo</h3>
            <p className="text-xs text-muted-foreground">O número do voo é gerado ao aprovar</p>
          </div>

          <div className="mt-5 space-y-4">
            {/* Piloto Comandante */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Piloto comandante *</Label>
              <div className="mt-1.5">
                <SearchableCombobox
                  items={tripulacao.map((item) => ({
                    id: item.id,
                    label: `${item.nome_completo} · CANAC ${item.canac}`,
                  }))}
                  value={pilotoId}
                  onChange={aoPiloto}
                  placeholder="Selecionar comandante ▾"
                  searchPlaceholder="Digite nome ou CANAC..."
                  emptyMessage="Nenhum tripulante encontrado."
                  icon={<Users size={14} className="text-[#3867ed]" />}
                />
              </div>
            </div>

            {/* Copiloto */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Copiloto</Label>
              <div className="mt-1.5">
                <SearchableCombobox
                  items={tripulacao
                    .filter((item) => item.id !== pilotoId)
                    .map((item) => ({
                      id: item.id,
                      label: `${item.nome_completo} · CANAC ${item.canac}`,
                    }))}
                  value={copilotoId}
                  onChange={aoCopiloto}
                  placeholder="Selecionar copiloto ▾"
                  searchPlaceholder="Digite nome ou CANAC..."
                  emptyMessage="Nenhum tripulante encontrado."
                  icon={<Users size={14} className="text-muted-foreground" />}
                />
              </div>
            </div>

            {/* Alerta de Conflito de Escala (Box Âmbar do Wireframe) */}
            <div className="flex items-start gap-2.5 rounded-xl border border-[#f1b950]/40 bg-amber-400/10 p-3 text-xs text-[#935a0d]">
              <AlertTriangle size={16} className="shrink-0 text-[#d97706] mt-0.5" />
              <span>
                Possível conflito de escala — {comandanteNome} já tem 1 compromisso sobreposto neste horário (aviso por toast, não bloqueia).
              </span>
            </div>

            {/* Motivo da Reprovação */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Motivo da reprovação</Label>
              <Textarea
                value={motivo}
                onChange={(e) => aoMotivo(e.target.value)}
                placeholder="Obrigatório apenas ao reprovar..."
                className="mt-1.5 min-h-[64px] rounded-lg border-border text-xs text-foreground"
              />
            </div>

            {/* Botões de Confirmação */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={confirmar}
                disabled={processando || !pilotoId || !formularioValido}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400/10 border border-[#17885f]/40 font-bold text-xs text-[#17885f] shadow-sm transition-all hover:bg-[#d1fae5] disabled:opacity-50"
              >
                <Check size={16} /> Aprovar e gerar número do voo
              </button>

              <button
                type="button"
                onClick={aoReprovar}
                disabled={processando}
                className="w-full flex h-10 items-center justify-center gap-2 rounded-xl border border-[#bf5260]/40 bg-card font-semibold text-xs text-[#bf5260] transition-colors hover:bg-red-400/10 disabled:opacity-50"
              >
                <X size={15} /> Reprovar solicitação
              </button>
            </div>
          </div>
        </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-5">
            <div className="border-b border-border pb-4">
              <h3 className="text-base font-bold text-foreground">Resumo da operação</h3>
              <p className="text-xs text-muted-foreground">Voo já confirmado · informações registradas</p>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <span className="text-[10px] font-semibold text-muted-foreground">Número do voo</span>
                <p className="mt-1 font-mono text-base font-bold text-foreground">{selecionada.numero_voo || "Não informado"}</p>
                <span className="mt-2 inline-flex rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                  {rotuloStatus[statusOperacional] || selecionada.status || "Registrado"}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Comandante</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{comandanteNome === "Comandante" ? "Não informado" : comandanteNome}</p>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Copiloto</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{selecionada.copiloto_nome || tripulacao.find((t) => t.id === (selecionada.copiloto_id || copilotoId))?.nome_completo || "Não escalado"}</p>
              </div>
              {(selecionada.perna_atual_horario_corte || selecionada.horario_corte) && (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Último corte registrado · UTC</p>
                  <p className="mt-1 font-mono text-sm font-bold text-foreground">{horaParaCampo(selecionada.perna_atual_horario_corte || selecionada.horario_corte)}</p>
                </div>
              )}
              {acoes && <div className="border-t border-border pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima ação</p>
                {acoes}
              </div>}
            </div>
          </section>
        )}
      </div>

      {/* Mensagens de WhatsApp são exibidas somente no retorno imediato de uma aprovação pendente. */}
      {mostrarMensagensConfirmacao && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 pt-4 border-t border-border">
            <CardMensagem
              titulo="Mensagem para o cliente"
              mensagem={`Olá ${titularNome}, seu voo ${selecionada.numero_voo || ""} foi confirmado para o dia ${formatarData(
                selecionada.data_agendada
              )} com o comandante ${comandanteNome}.`}
            />
            <CardMensagem
              titulo="Mensagem para o tripulante"
              tom="sky"
              mensagem={`Olá ${comandanteNome}, você foi escalado para o voo ${selecionada.numero_voo || ""} no dia ${formatarData(
                selecionada.data_agendada
              )} na aeronave ${selecionada.matricula_registro || "a definir"} às ${horarioFormatado.utc} UTC.`}
            />
          </div>
      )}


    </div>
  );
}

function CardMensagem({
  titulo,
  mensagem,
  tom = "primary",
}: {
  titulo: string;
  mensagem: string;
  tom?: "primary" | "sky";
}) {
  const { toast } = useToast();
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast({ title: "Mensagem copiada", description: "Pronta para enviar via WhatsApp ou e-mail." });
    } catch {
      toast({ title: "Selecione e copie manualmente", description: "Use Ctrl+C para copiar." });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          {copiado ? <Check size={13} className="text-[#17885f]" /> : <Copy size={13} />}
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="mt-2.5 rounded-lg border border-border bg-card p-3 text-xs text-foreground leading-relaxed select-all">
        {mensagem}
      </p>
    </div>
  );
}
