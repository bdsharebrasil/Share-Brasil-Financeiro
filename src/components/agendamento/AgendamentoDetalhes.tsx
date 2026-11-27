import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, Copy, Pencil, Plane, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type AlteracoesAgendamentoConfirmacao,
  type AtualizacaoAgendamento,
  type DisponibilidadeTripulacao,
  type EscalaAgendamento,
  type OpcoesAgendamentoResponse,
  type SolicitacaoVooInterna,
  type TripulanteAgendamento,
} from "@/lib/colaborador-api";
import { useToast } from "@/hooks/use-toast";
import { conflitosDoTripulante, montarBlocos } from "@/lib/escala-tempo";
import { edicaoEstruturalPermitida, pendenciasParaAprovar } from "@/components/agendamento/agendamentoFluxo";
import { ajustarPeriodoAoAlterarDataSaida } from "@/lib/agendamento-periodo";

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

function dataSomenteIso(valor: string | null | undefined) {
  const texto = String(valor || "").trim();
  const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function criarEdicaoConfirmacao(selecionada: SolicitacaoVooInterna): EdicaoConfirmacao {
  const inicio = dataSomenteIso(selecionada.data_agendada);
  const fimBruto = dataSomenteIso(selecionada.data_fim);
  return {
    aeronave_id: selecionada.aeronave_id || "",
    data_agendada: inicio,
    data_fim: fimBruto && fimBruto >= inicio ? fimBruto : inicio,
    horario: horaParaCampo(selecionada.horario_previsto_agendamento),
    numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    emprestimo: selecionada.voo_emprestado === "sim" || Boolean(selecionada.cliente_emprestimo_id || selecionada.socio_emprestimo_id),
    cliente_emprestimo_id: selecionada.cliente_emprestimo_id || "",
    socio_emprestimo_id: selecionada.socio_emprestimo_id || "",
  };
}

function criarDadosEdicao(selecionada: SolicitacaoVooInterna): AtualizacaoAgendamento {
  const inicio = dataSomenteIso(selecionada.data_agendada);
  const fimBruto = dataSomenteIso(selecionada.data_fim);
  return {
    aeronave_id: selecionada.aeronave_id || "",
    origem: selecionada.origem || "",
    destino: selecionada.destino || "",
    data_agendada: inicio,
    data_fim: fimBruto && fimBruto >= inicio ? fimBruto : inicio,
    horario_previsto_agendamento: horaParaCampo(selecionada.horario_previsto_agendamento),
    numero_passageiros: Number(selecionada.numero_passageiros) || 1,
    piloto_id: selecionada.piloto_id || "",
    copiloto_id: selecionada.copiloto_id || "",
    observacoes: selecionada.observacoes || "",
  };
}

function CampoLeitura({ rotulo, valor, mono = false }: { rotulo: string; valor: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/25 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</span>
      <span className={`mt-0.5 block text-xs font-semibold text-foreground ${mono ? "font-mono font-bold" : ""}`}>{valor}</span>
    </div>
  );
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
  escala = [],
  disponibilidades = [],
  iniciarRecusa = false,
  somenteLeitura = false,
  incorporado = false,
}: {
  escala?: EscalaAgendamento[];
  disponibilidades?: DisponibilidadeTripulacao[];
  iniciarRecusa?: boolean;
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
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(iniciarRecusa);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const [dadosAgendamento, setDadosAgendamento] = useState<AtualizacaoAgendamento>(() => criarDadosEdicao(selecionada));

  useEffect(() => {
    setEdicao(criarEdicaoConfirmacao(selecionada));
    setRecusando(iniciarRecusa);
    setDadosAgendamento(criarDadosEdicao(selecionada));
    setEditandoAgendamento(false);
    setErroEdicao(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selecionada.id,
    selecionada.atualizado_em,
    selecionada.status,
    selecionada.data_agendada,
    selecionada.data_fim,
    selecionada.horario_previsto_agendamento,
    selecionada.origem,
    selecionada.destino,
    selecionada.aeronave_id,
    selecionada.piloto_id,
    selecionada.copiloto_id,
    selecionada.numero_passageiros,
    selecionada.observacoes,
    iniciarRecusa,
  ]);

  useEffect(() => {
    if (recusando) motivoRef.current?.focus();
  }, [recusando]);

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

  const blocosEscala = useMemo(
    () => montarBlocos(escala.filter((voo) => voo.id !== selecionada.id), disponibilidades, tripulacao),
    [escala, disponibilidades, tripulacao, selecionada.id],
  );
  const janelaVoo = useMemo(() => {
    const [bloco] = montarBlocos([{
      id: selecionada.id, data_agendada: edicao.data_agendada, data_fim: edicao.data_fim || edicao.data_agendada, numero_voo: null,
      origem: selecionada.origem, destino: selecionada.destino,
      horario_previsto_agendamento: edicao.horario ? horarioUtc(edicao.data_agendada, edicao.horario) || null : null,
      piloto_id: "janela", piloto_nome: null, copiloto_id: null, copiloto_nome: null, status: "aprovada",
    }], [], []);
    return bloco ? { inicio: bloco.inicio, fim: bloco.fim } : null;
  }, [edicao.data_agendada, edicao.data_fim, edicao.horario, selecionada.id, selecionada.origem, selecionada.destino]);
  const conflitosDe = (tripulanteId: string) => (tripulanteId && janelaVoo ? conflitosDoTripulante(blocosEscala, tripulanteId, janelaVoo.inicio, janelaVoo.fim) : []);
  const nomeTripulante = (id: string) => tripulacao.find((t) => t.id === id)?.nome_completo || "Tripulante";
  const conflitosEscolhidos = [pilotoId, copilotoId].filter(Boolean).flatMap((id) => conflitosDe(id).map((bloco) => ({ nome: nomeTripulante(id), bloco })));
  const rotuloTripulante = (item: TripulanteAgendamento) => `${item.nome_completo} · CANAC ${item.canac}${conflitosDe(item.id).length ? " · conflito de escala" : ""}`;
  const pendenciasAprovacao = pendenciasParaAprovar({
    pilotoId,
    aeronaveId: edicao.aeronave_id,
    datasValidas: /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_agendada) && /^\d{4}-\d{2}-\d{2}$/.test(edicao.data_fim) && edicao.data_fim >= edicao.data_agendada,
    passageirosValidos: Number.isInteger(edicao.numero_passageiros) && edicao.numero_passageiros >= 1,
    emprestimoInformado: !edicao.aeronave_id || (emprestimoValido && (aeronaveDoTitular || edicao.emprestimo)),
  });

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
  const podeConfirmar = statusPendente && !selecionada.numero_voo;
  const estrutural = edicaoEstruturalPermitida(selecionada.status);
  const podeEditar = !somenteLeitura && !["encerrada", "concluida", "cancelada", "reprovada", "pendente"].includes(String(selecionada.status).toLowerCase());
  const statusOperacional = String(selecionada.status || "").trim().toLowerCase();
  const rotuloStatus: Record<string, string> = {
    aprovada: "Confirmado", acionado: "Acionado", decolado: "Decolado",
    em_rota: "Em rota", em_voo: "Em voo", em_solo: "Em solo",
    encerrada: "Encerrado", concluida: "Concluído", cancelada: "Cancelado",
    reprovada: "Reprovado",
  };

  const aeronaveLabel =
    aeronaves.find((a) => a.id === selecionada.aeronave_id)?.label ||
    [selecionada.matricula_registro, selecionada.modelo].filter(Boolean).join(" · ") ||
    "Aeronave não informada";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* COLUNA ESQUERDA: Dados da solicitação / voo (7 Colunas) */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              {!incorporado && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={aoFechar}
                  className="h-8 gap-1 rounded-lg border-border bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-secondary/40"
                >
                  <ChevronLeft size={14} /> Voltar
                </Button>
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">{podeConfirmar ? "Dados da solicitação" : "Dados do voo"}</h3>
                <p className="text-[11px] text-muted-foreground">{podeConfirmar ? "Revise e ajuste antes de confirmar" : "Informações registradas no agendamento"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {podeEditar && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={processando}
                  onClick={() => {
                    setErroEdicao(null);
                    setDadosAgendamento(criarDadosEdicao(selecionada));
                    setEditandoAgendamento((atual) => !atual);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Pencil size={12} />
                  {editandoAgendamento ? "Cancelar" : "Editar"}
                </Button>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  podeConfirmar
                    ? "bg-[#f1b950]/15 text-[#b47b1c]"
                    : "bg-[#17885f]/15 text-[#17885f]"
                }`}
              >
                {podeConfirmar ? "Pendente" : rotuloStatus[statusOperacional] || selecionada.status || "Registrado"}
              </span>
            </div>
          </div>

          {editandoAgendamento && podeEditar && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                setErroEdicao(null);
                const dataSaida = dataSomenteIso(dadosAgendamento.data_agendada) || dataSomenteIso(selecionada.data_agendada);
                const dataFimBruta = dataSomenteIso(dadosAgendamento.data_fim) || dataSaida;
                const dataFim = dataFimBruta >= dataSaida ? dataFimBruta : dataSaida;
                if (estrutural && (!dataSaida || !dataFim || dataFim < dataSaida)) {
                  setErroEdicao("Informe datas válidas (a data final não pode ser anterior à saída).");
                  return;
                }
                const payload: AtualizacaoAgendamento = {
                  numero_passageiros: Number(dadosAgendamento.numero_passageiros) || Number(selecionada.numero_passageiros) || 1,
                  piloto_id: dadosAgendamento.piloto_id || "",
                  copiloto_id: dadosAgendamento.copiloto_id || "",
                  observacoes: dadosAgendamento.observacoes || "",
                  ...(estrutural
                    ? {
                        aeronave_id: dadosAgendamento.aeronave_id || selecionada.aeronave_id || "",
                        origem: String(dadosAgendamento.origem || selecionada.origem || "").trim().toUpperCase(),
                        destino: String(dadosAgendamento.destino || selecionada.destino || "").trim().toUpperCase(),
                        data_agendada: dataSaida,
                        data_fim: dataFim,
                        horario_previsto_agendamento: dadosAgendamento.horario_previsto_agendamento
                          ? horarioUtc(dataSaida, dadosAgendamento.horario_previsto_agendamento) || null
                          : null,
                      }
                    : {}),
                };
                const sucesso = await aoAtualizar(payload);
                if (sucesso === true) {
                  setEditandoAgendamento(false);
                  setErroEdicao(null);
                } else {
                  setErroEdicao("Não foi possível salvar as alterações no servidor. Verifique a mensagem de aviso e tente novamente.");
                }
              }}
            >
              {erroEdicao && (
                <p role="alert" className="rounded-lg border border-red-500/35 bg-red-500/10 p-2.5 text-xs font-medium text-red-700 dark:text-red-300 sm:col-span-2">
                  {erroEdicao}
                </p>
              )}
              {!estrutural && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 sm:col-span-2">
                  Voo já iniciado: aeronave, rota, datas e horário previsto ficam bloqueados. Ajuste a tripulação, os passageiros e as observações aqui.
                </p>
              )}
              <label className="space-y-1 text-xs font-medium">
                Aeronave
                <SearchableCombobox
                  disabled={!estrutural}
                  items={aeronaves}
                  value={dadosAgendamento.aeronave_id || ""}
                  onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, aeronave_id: valor }))}
                  placeholder="Selecionar aeronave"
                />
              </label>
              {(
                [
                  ["origem", "Origem", "text"],
                  ["destino", "Destino", "text"],
                  ["data_agendada", "Data de saída", "date"],
                  ["data_fim", "Data final", "date"],
                  ["horario_previsto_agendamento", "Horário previsto (UTC)", "time"],
                  ["numero_passageiros", "Passageiros", "number"],
                ] as const
              ).map(([campo, rotulo, tipo]) => (
                <label key={campo} className="space-y-1 text-xs font-medium">
                  {rotulo}
                  <Input
                    type={tipo}
                    disabled={!estrutural && campo !== "numero_passageiros"}
                    value={dadosAgendamento[campo] ?? ""}
                    required={campo !== "horario_previsto_agendamento"}
                    min={campo === "numero_passageiros" ? 1 : campo === "data_fim" ? dadosAgendamento.data_agendada : undefined}
                    max={campo === "numero_passageiros" ? 50 : undefined}
                    onChange={(event) => {
                      const valor =
                        tipo === "number"
                          ? Number(event.target.value)
                          : ["origem", "destino"].includes(campo)
                            ? event.target.value.toUpperCase()
                            : event.target.value;
                      setDadosAgendamento((atual) =>
                        campo === "data_agendada"
                          ? { ...atual, ...ajustarPeriodoAoAlterarDataSaida(atual.data_agendada || "", atual.data_fim || atual.data_agendada || "", String(valor)) }
                          : { ...atual, [campo]: valor },
                      );
                    }}
                    className="h-9 text-xs"
                  />
                </label>
              ))}
              {(
                [
                  ["piloto_id", "Comandante"],
                  ["copiloto_id", "Copiloto"],
                ] as const
              ).map(([campo, rotulo]) => (
                <label key={campo} className="space-y-1 text-xs font-medium">
                  {rotulo}
                  <SearchableCombobox
                    items={tripulacao
                      .filter((tripulante) => tripulante.id !== dadosAgendamento[campo === "piloto_id" ? "copiloto_id" : "piloto_id"])
                      .map((tripulante) => ({ id: tripulante.id, label: tripulante.nome_completo }))}
                    value={dadosAgendamento[campo] || ""}
                    onChange={(valor) => setDadosAgendamento((atual) => ({ ...atual, [campo]: valor }))}
                    placeholder={`Selecionar ${rotulo.toLowerCase()}`}
                  />
                </label>
              ))}
              <label className="space-y-1 text-xs font-medium sm:col-span-2">
                Observações
                <Textarea
                  value={dadosAgendamento.observacoes || ""}
                  onChange={(event) => setDadosAgendamento((atual) => ({ ...atual, observacoes: event.target.value }))}
                  className="min-h-[60px] text-xs"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={processando} className="h-8 text-xs">
                  {processando ? "Salvando..." : "Salvar alterações"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={processando}
                  onClick={() => {
                    setDadosAgendamento(criarDadosEdicao(selecionada));
                    setErroEdicao(null);
                    setEditandoAgendamento(false);
                  }}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          <div hidden={editandoAgendamento && podeEditar} className="mt-4 space-y-3">
            {podeConfirmar ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoLeitura
                  rotulo="Titular"
                  valor={`${titularNome}${selecionada.codigo_cliente ? ` · ${selecionada.codigo_cliente}` : ""}`}
                />
                <div>
                  <Label className="text-[11px] font-semibold text-foreground">Aeronave</Label>
                  <div className="mt-1">
                    <SearchableCombobox
                      items={aeronaves}
                      value={edicao.aeronave_id}
                      onChange={editarAeronave}
                      placeholder="Selecionar aeronave ▾"
                      searchPlaceholder="Buscar aeronave..."
                      emptyMessage="Nenhuma aeronave encontrada."
                      icon={<Plane size={13} className="text-primary" />}
                    />
                  </div>
                </div>
                <CampoLeitura rotulo="Origem" valor={selecionada.origem || "—"} mono />
                <CampoLeitura rotulo="Destino" valor={selecionada.destino || "—"} mono />
                <div>
                  <Label className="text-[11px] font-semibold text-foreground">Data de saída</Label>
                  <Input
                    type="date"
                    value={edicao.data_agendada}
                    onChange={(e) => setEdicao((atual) => ({ ...atual, data_agendada: e.target.value }))}
                    className="mt-1 h-9 rounded-lg border-border text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground">Data final</Label>
                  <Input
                    type="date"
                    min={edicao.data_agendada}
                    value={edicao.data_fim}
                    onChange={(e) => setEdicao((atual) => ({ ...atual, data_fim: e.target.value }))}
                    className="mt-1 h-9 rounded-lg border-border text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground">Horário previsto (UTC)</Label>
                  <div className="relative mt-1 flex items-center">
                    <Input
                      type="time"
                      value={edicao.horario}
                      onChange={(e) => setEdicao((atual) => ({ ...atual, horario: e.target.value }))}
                      className="h-9 rounded-lg border-border text-xs"
                    />
                    <span className="absolute right-2.5 text-[10px] font-semibold text-muted-foreground">
                      BRT {horarioFormatado.brasilia}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground">Passageiros</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edicao.numero_passageiros}
                    onChange={(e) => setEdicao((atual) => ({ ...atual, numero_passageiros: Number(e.target.value) }))}
                    className="mt-1 h-9 rounded-lg border-border text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="col-span-2">
                  <CampoLeitura
                    rotulo="Titular"
                    valor={`${titularNome}${selecionada.codigo_cliente ? ` · ${selecionada.codigo_cliente}` : ""}`}
                  />
                </div>
                <div className="col-span-2">
                  <CampoLeitura rotulo="Aeronave" valor={aeronaveLabel} />
                </div>
                <CampoLeitura rotulo="Origem" valor={selecionada.origem || "—"} mono />
                <CampoLeitura rotulo="Destino" valor={selecionada.destino || "—"} mono />
                <CampoLeitura
                  rotulo="Período"
                  valor={
                    edicao.data_fim > edicao.data_agendada
                      ? `${formatarData(edicao.data_agendada)} a ${formatarData(edicao.data_fim)}`
                      : formatarData(edicao.data_agendada)
                  }
                />
                <CampoLeitura
                  rotulo="Previsto / Pax"
                  valor={`${horarioFormatado.utc}Z (${horarioFormatado.brasilia} BRT) · ${edicao.numero_passageiros} pax`}
                />
              </div>
            )}

            {/* Empréstimo da Aeronave */}
            {!podeConfirmar || (aeronaveDoTitular && !edicao.emprestimo) ? (
              <CampoLeitura
                rotulo="Empréstimo da aeronave"
                valor={
                  edicao.emprestimo
                    ? `Sim · ${selecionada.socio_emprestimo_nome || selecionada.cliente_emprestimo_nome || "Cedente registrado"}`
                    : "Voo próprio do titular · sem cedente"
                }
              />
            ) : (
              <div>
                <Label className="text-[11px] font-semibold text-foreground">Empréstimo da aeronave</Label>
                <div className="mt-1 grid gap-2.5 sm:grid-cols-2">
                  <Select
                    value={edicao.emprestimo ? "sim" : "nao"}
                    onValueChange={(val) =>
                      setEdicao((atual) => ({
                        ...atual,
                        emprestimo: val === "sim",
                        cliente_emprestimo_id: "",
                        socio_emprestimo_id: "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-lg border-border bg-card text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao" disabled={!aeronaveDoTitular}>Não (voo próprio)</SelectItem>
                      <SelectItem value="sim">Sim (voo emprestado)</SelectItem>
                    </SelectContent>
                  </Select>

                  {edicao.emprestimo && (
                    <SearchableCombobox
                      items={cedentes}
                      value={cedenteSelecionado}
                      onChange={editarCedente}
                      placeholder="Selecionar cedente ▾"
                      searchPlaceholder="Buscar cliente ou sócio..."
                      emptyMessage="Nenhum cotista vinculado a esta aeronave."
                      icon={<Users size={13} className="text-primary" />}
                    />
                  )}
                </div>
              </div>
            )}

            <CampoLeitura
              rotulo="Observações"
              valor={<span className="font-normal text-muted-foreground">{selecionada.observacoes || "Sem observações registradas."}</span>}
            />
          </div>
        </section>

        {/* COLUNA DIREITA: Confirmação ou Resumo (5 Colunas) */}
        {podeConfirmar ? (
          <section id="confirmacao-voo" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-5">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Confirmação do voo</h3>
              <p className="text-[11px] text-muted-foreground">O número do voo é gerado ao aprovar</p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-[11px] font-semibold text-foreground">Piloto comandante *</Label>
                <div className="mt-1">
                  <SearchableCombobox
                    items={tripulacao.map((item) => ({
                      id: item.id,
                      label: rotuloTripulante(item),
                    }))}
                    value={pilotoId}
                    onChange={aoPiloto}
                    placeholder="Selecionar comandante ▾"
                    searchPlaceholder="Digite nome ou CANAC..."
                    emptyMessage="Nenhum tripulante encontrado."
                    icon={<Users size={13} className="text-primary" />}
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground">Copiloto</Label>
                <div className="mt-1">
                  <SearchableCombobox
                    items={tripulacao
                      .filter((item) => item.id !== pilotoId)
                      .map((item) => ({
                        id: item.id,
                        label: rotuloTripulante(item),
                      }))}
                    value={copilotoId}
                    onChange={aoCopiloto}
                    placeholder="Selecionar copiloto ▾"
                    searchPlaceholder="Digite nome ou CANAC..."
                    emptyMessage="Nenhum tripulante encontrado."
                    icon={<Users size={13} className="text-muted-foreground" />}
                  />
                </div>
              </div>

              {conflitosEscolhidos.length > 0 ? (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#f1b950]/40 bg-amber-400/10 p-2.5 text-xs text-[#935a0d] dark:text-amber-300">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#d97706]" />
                  <div className="space-y-0.5">
                    <strong className="block">Possível conflito de escala</strong>
                    <ul className="list-disc pl-4">
                      {conflitosEscolhidos.map(({ nome, bloco }) => (
                        <li key={`${nome}-${bloco.id}`}>
                          {nome}: {bloco.titulo}
                          {bloco.detalhe ? ` (${bloco.detalhe})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : pilotoId ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={13} /> Sem conflitos de escala neste horário.
                </p>
              ) : null}

              {recusando ? (
                <div className="space-y-2 rounded-xl border border-[#bf5260]/30 bg-red-400/5 p-3">
                  <Label htmlFor="motivo-recusa" className="text-[11px] font-semibold text-foreground">Motivo da recusa *</Label>
                  <Textarea
                    id="motivo-recusa"
                    ref={motivoRef}
                    value={motivo}
                    onChange={(e) => aoMotivo(e.target.value)}
                    placeholder="Explique ao cliente por que o voo não pode ser feito..."
                    className="min-h-[64px] rounded-lg border-border text-xs text-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={aoReprovar}
                      disabled={processando || !motivo.trim()}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#bf5260] text-xs font-bold text-white transition-colors hover:bg-[#a8444f] disabled:opacity-50"
                    >
                      <X size={14} /> Confirmar recusa
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRecusando(false); aoMotivo(""); }}
                      disabled={processando}
                      className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {pendenciasAprovacao.length > 0 && (
                    <div className="rounded-xl border border-border bg-secondary/35 p-2.5 text-xs text-muted-foreground">
                      <strong className="block text-foreground">Para aprovar, falta:</strong>
                      <ul className="mt-1 list-disc pl-4">
                        {pendenciasAprovacao.map((pendencia) => (
                          <li key={pendencia}>{pendencia}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={processando || !pilotoId || !formularioValido}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#17885f]/40 bg-emerald-400/10 text-xs font-bold text-[#17885f] shadow-sm transition-all hover:bg-[#d1fae5] disabled:opacity-50 dark:hover:bg-emerald-400/20"
                  >
                    <Check size={15} /> {processando ? "Aprovando..." : "Aprovar e gerar número do voo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecusando(true)}
                    disabled={processando}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#bf5260]/40 bg-card text-xs font-semibold text-[#bf5260] transition-colors hover:bg-red-400/10 disabled:opacity-50"
                  >
                    <X size={14} /> Recusar solicitação
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:col-span-5">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Resumo da operação</h3>
              <p className="text-[11px] text-muted-foreground">Voo confirmado · tripulação e status</p>
            </div>
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Número do voo</span>
                  <p className="font-mono text-sm font-bold text-foreground">{selecionada.numero_voo || "Não informado"}</p>
                </div>
                <span className="inline-flex rounded-md border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {rotuloStatus[statusOperacional] || selecionada.status || "Registrado"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <CampoLeitura
                  rotulo="Comandante"
                  valor={comandanteNome === "Comandante" ? "Não informado" : comandanteNome}
                />
                <CampoLeitura
                  rotulo="Copiloto"
                  valor={selecionada.copiloto_nome || tripulacao.find((t) => t.id === (selecionada.copiloto_id || copilotoId))?.nome_completo || "Não escalado"}
                />
              </div>
              {(selecionada.perna_atual_horario_corte || selecionada.horario_corte) && (
                <CampoLeitura
                  rotulo="Último corte registrado · UTC"
                  valor={horaParaCampo(selecionada.perna_atual_horario_corte || selecionada.horario_corte)}
                  mono
                />
              )}
              {acoes && (
                <div className="border-t border-border pt-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima ação</p>
                  {acoes}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {mostrarMensagensConfirmacao && (
        <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 lg:grid-cols-2">
          <CardMensagem
            titulo="Mensagem para o cliente"
            mensagem={`Olá ${titularNome}, seu voo ${selecionada.numero_voo || ""} foi confirmado para o dia ${formatarData(
              selecionada.data_agendada
            )} com o comandante ${comandanteNome}.`}
          />
          <CardMensagem
            titulo="Mensagem para o tripulante"
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
}: {
  titulo: string;
  mensagem: string;
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
    <div className="rounded-xl border border-border bg-secondary/35 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{titulo}</span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[11px] font-semibold text-foreground hover:bg-secondary"
        >
          {copiado ? <Check size={12} className="text-[#17885f]" /> : <Copy size={12} />}
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="mt-2 rounded-lg border border-border bg-card p-2.5 text-xs leading-relaxed text-foreground select-all">
        {mensagem}
      </p>
    </div>
  );
}