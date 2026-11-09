import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Fuel,
  Loader2,
  Plane,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import EtapasChecklist from "./EtapasChecklist";
import ListaChecklistConcluido from "./ListaChecklistConcluido";
import { Button } from "@/components/ui/button";
import {
  buscarAbastecimentoOpcoes,
  buscarChecklistPreVoo,
  enviarComandaAbastecimento,
  salvarChecklistPreVoo,
  type SolicitacaoVooInterna,
} from "@/lib/colaborador-api";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import AnexosDinamicos from "@/components/ui/AnexosDinamicos";
import {
  SECOES_CHECKLIST,
  type RespostasChecklist,
} from "./checklistStructure";
import PesoBalanceamentoFicha from "./PesoBalanceamentoFicha";

const card =
  "overflow-hidden rounded-[10px] border border-border/70 bg-card/90 shadow-lg shadow-black/5";
const input =
  "h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
const rascunhoKey = (id: string) => `share-prevoo-${id}`;
const respostasVazias: RespostasChecklist = {};
function dataVoo(valor?: string | null) {
  return valor
    ? new Date(valor).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Data não informada";
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[9px] font-bold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function ChecklistPreVoo({
  item,
  aoConcluir,
  aoAtualizarProgresso,
}: {
  item: SolicitacaoVooInterna;
  aoConcluir?: () => void | Promise<void>;
  aoAtualizarProgresso?: (progresso: number) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const [checklistConcluido, setChecklistConcluido] = useState(false);
  const [concluidoPor, setConcluidoPor] = useState("");
  const [alertas, setAlertas] = useState<Record<string, string>>({});
  const [nivelOleo, setNivelOleo] = useState("");
  const [respostas, setRespostas] =
    useState<RespostasChecklist>(respostasVazias);
  const [secaoAberta, setSecaoAberta] = useState(SECOES_CHECKLIST[0].id);
  const [necessitaAbastecer, setNecessitaAbastecer] = useState("");
  const [trechoManualAberto, setTrechoManualAberto] = useState(false);
  const [manualTrecho, setManualTrecho] = useState("");
  const [data, setData] = useState(hoje());
  const [fornecedorId, setFornecedorId] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [local, setLocal] = useState(item.origem || "");
  const [litros, setLitros] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [desconto, setDesconto] = useState("");
  const [comanda, setComanda] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [trechoId, setTrechoId] = useState("");
  const [trechoConfirmado, setTrechoConfirmado] = useState(false);
  const [trecho, setTrecho] = useState("");
  const [opcoes, setOpcoes] = useState<any>({ fornecedores: [], diarios: [] });
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const itens = useMemo(
    () => SECOES_CHECKLIST.flatMap((secao) => secao.itens),
    [],
  );
  const respondidos = itens.filter((i) => respostas[i.id]?.status).length;
  const feitos = itens.filter(
    (i) => respostas[i.id]?.status === "feito",
  ).length;
  const quantidadeAlertas = itens.filter(
    (i) => respostas[i.id]?.status === "alerta",
  ).length;
  const progresso = itens.length
    ? Math.round((respondidos / itens.length) * 100)
    : 0;
  const corChecklist =
    checklistConcluido || progresso === 100
      ? "#34d399"
      : progresso === 0
        ? "#facc15"
        : "#f87171";
  const total = Math.max(
    0,
    Number(litros || 0) * Number(valorUnitario || 0) - Number(desconto || 0),
  );
  const ultimo = opcoes.ultimo_trecho;
  const trechoTexto = ultimo
    ? `${ultimo.aerodromo_partida || "?"} X ${ultimo.aerodromo_chegada || "?"}`
    : "Nenhum trecho anterior encontrado";
  const temAlertasJustificados = !Object.entries(respostas).some(
    ([id, r]) => r?.status === "alerta" && !String(alertas[id] || "").trim(),
  );
  const oleoCompleto =
    !itens.some((i) => i.tipo === "oleo") || Boolean(nivelOleo.trim());
  const trechoValido = trechoConfirmado
    ? Boolean(trechoId)
    : Boolean(manualTrecho.trim());
  const combustivelCompleto =
    necessitaAbastecer !== "sim" ||
    (trechoValido &&
      Boolean(
        data &&
          tipoCombustivel &&
          local &&
          Number(litros) > 0 &&
          Number(valorUnitario) >= 0 &&
          fornecedorId,
      ));
  const completo =
    respondidos === itens.length &&
    temAlertasJustificados &&
    oleoCompleto &&
    combustivelCompleto;
  const pendencias = [
    respondidos < itens.length
      ? `Responda todos os itens (${respondidos}/${itens.length}).`
      : "",
    !temAlertasJustificados ? "Informe a justificativa de cada alerta." : "",
    !oleoCompleto ? "Informe o nível de óleo." : "",
    !combustivelCompleto ? "Complete os dados do abastecimento." : "",
  ].filter(Boolean);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(rascunhoKey(item.id));
      if (!raw) return;
      const d = JSON.parse(raw);
      setRespostas(d.respostas || {});
      setObservacoes(d.observacoes || "");
      setNecessitaAbastecer(d.necessitaAbastecer || "");
      setManualTrecho(d.manualTrecho || "");
      setAlertas(d.alertas || {});
      setNivelOleo(d.nivelOleo || "");
      setData(d.data || hoje());
      setFornecedorId(d.fornecedorId || "");
      setTipoCombustivel(d.tipoCombustivel || "");
      setLocal(d.local || item.origem || "");
      setLitros(d.litros || "");
      setValorUnitario(d.valorUnitario || "");
      setDesconto(d.desconto || "");
      setComanda(d.comanda || "");
      setTrechoId(d.trechoId || "");
      setTrechoConfirmado(Boolean(d.trechoConfirmado));
      setTrecho(d.trecho || "");
    } catch {
      /* ignora rascunho inválido */
    }
  }, [item.id, item.origem]);
  useEffect(() => {
    let ativo = true;
    void buscarChecklistPreVoo(item.id)
      .then((r: any) => {
        if (!ativo || !r) return;
        const concluido = r.status === "concluido";
        setChecklistConcluido(concluido);
        setConcluidoPor(
          concluido
            ? r.executado_por_nome || r.usuario_id || "usuário autenticado"
            : "",
        );
        setRespostas(r.itens || {});
        setAlertas(r.alertas || {});
        setNivelOleo(r.nivel_oleo || "");
        setObservacoes(r.observacoes || "");
        if (concluido)
          setNecessitaAbastecer(r.precisa_abastecer ? "sim" : "nao");
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [item.id]);
  useEffect(() => {
    aoAtualizarProgresso?.(progresso);
  }, [aoAtualizarProgresso, progresso]);
  useEffect(() => {
    if (!aberto || checklistConcluido) return;
    const t = window.setTimeout(
      () =>
        localStorage.setItem(
          rascunhoKey(item.id),
          JSON.stringify({
            respostas,
            alertas,
            nivelOleo,
            observacoes,
            necessitaAbastecer,
            data,
            fornecedorId,
            tipoCombustivel,
            trechoManualAberto,
            manualTrecho,
            local,
            litros,
            valorUnitario,
            desconto,
            comanda,
            trechoId,
            trechoConfirmado,
            trecho,
          }),
        ),
      250,
    );
    return () => window.clearTimeout(t);
  }, [
    aberto,
    checklistConcluido,
    item.id,
    respostas,
    alertas,
    nivelOleo,
    observacoes,
    necessitaAbastecer,
    data,
    fornecedorId,
    tipoCombustivel,
    trechoManualAberto,
    manualTrecho,
    local,
    litros,
    valorUnitario,
    desconto,
    comanda,
    trechoId,
    trechoConfirmado,
    trecho,
  ]);
  useEffect(() => {
    if (!aberto || necessitaAbastecer !== "sim") return;
    void buscarAbastecimentoOpcoes(item.aeronave_id)
      .then(setOpcoes)
      .catch(() => undefined);
  }, [aberto, necessitaAbastecer, item.aeronave_id]);
  useEffect(() => {
    if (
      opcoes.ultimo_trecho === undefined ||
      !trechoConfirmado ||
      trechoId === opcoes.ultimo_trecho?.id
    )
      return;
    setTrechoId("");
    setTrechoConfirmado(false);
    setTrecho("");
  }, [opcoes.ultimo_trecho, trechoConfirmado, trechoId]);
  const marcar = (id: string, status: "feito" | "alerta" | "nao_feito") => {
    setRespostas((atual) => ({
      ...atual,
      [id]: { status, observacao: atual[id]?.observacao },
    }));
  };
  const salvar = async (concluir: boolean) => {
    if (concluir && !completo) {
      setErro(pendencias.join(" "));
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const result = await salvarChecklistPreVoo(item.id, {
        itens: respostas,
        observacoes,
        status: concluir ? "concluido" : "rascunho",
        alertas,
        nivel_oleo: nivelOleo,
        abastecimento: {
          necessita_abastecer: necessitaAbastecer === "sim",
          data,
          fornecedor_id: fornecedorId,
          tipo_combustivel: tipoCombustivel,
          local,
          litros: Number(litros),
          valor_unitario: Number(valorUnitario),
          desconto: Number(desconto || 0),
          numero_comanda: comanda,
          trecho: trechoConfirmado ? trecho : manualTrecho,
          lancamento_diario_id: trechoConfirmado ? trechoId : undefined,
        },
      });
      if (arquivo && result.abastecimento_id)
        await enviarComandaAbastecimento(result.abastecimento_id, arquivo);
      if (concluir) {
        localStorage.removeItem(rascunhoKey(item.id));
        setChecklistConcluido(true);
        setConcluidoPor("usuário autenticado");
        setAberto(false);
        await aoConcluir?.();
      }
      setMensagem(
        concluir
          ? "Checklist concluído e abastecimento enviado ao financeiro."
          : "Rascunho salvo com segurança.",
      );
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o checklist.",
      );
    } finally {
      setSalvando(false);
    }
  };
  const fornecedores = (opcoes.fornecedores || []).map((f: any) => ({
    id: f.id,
    label: `${f.nome_fornecedor || f.nome_completo || f.apelido || "Fornecedor"}${f.nome_cidade ? ` · ${f.nome_cidade}` : ""}${f.codigo_icao ? ` · ${f.codigo_icao}` : ""}`,
  }));
  const [direcaoEtapa, setDirecaoEtapa] = useState(1);
  const [erroEtapa, setErroEtapa] = useState("");
  const validarEtapa = (id: string): string | null => {
    if (checklistConcluido) return null;
    const secao = SECOES_CHECKLIST.find((s) => s.id === id);
    if (secao) {
      const respondidosNaSecao = secao.itens.filter(
        (i) => respostas[i.id]?.status,
      ).length;
      if (respondidosNaSecao < secao.itens.length)
        return `Responda todos os itens de ${secao.titulo} (${respondidosNaSecao}/${secao.itens.length}).`;
      if (
        secao.itens.some(
          (i) =>
            respostas[i.id]?.status === "alerta" &&
            !String(alertas[i.id] || "").trim(),
        )
      )
        return "Informe a justificativa de cada alerta desta etapa.";
      if (secao.itens.some((i) => i.tipo === "oleo") && !nivelOleo.trim())
        return "Informe o nível de óleo antes de avançar.";
    }
    if (id === "abastecimento" && !combustivelCompleto)
      return "Complete os dados do abastecimento e confirme o trecho ou informe o trecho manual.";
    return null;
  };
  const titulosEtapas: Record<string, string> = {
    coordenacao: "Coordenação",
    despachante: "Check externo",
    interno: "Check interno",
    seguranca: "Segurança",
  };
  const etapas = [
    ...SECOES_CHECKLIST.map((s) => ({
      id: s.id,
      titulo: titulosEtapas[s.id] || s.titulo,
      descricao: s.titulo,
      concluida: validarEtapa(s.id) === null,
    })),
    {
      id: "abastecimento",
      titulo: "Abastecimento",
      concluida:
        checklistConcluido ||
        Boolean(necessitaAbastecer && combustivelCompleto),
    },
    {
      id: "revisao",
      titulo: "Revisão",
      descricao: "Revisão e conclusão",
      concluida: checklistConcluido,
    },
  ];
  const indiceEtapa = Math.max(
    0,
    etapas.findIndex((etapa) => etapa.id === secaoAberta),
  );
  const secaoAtual = SECOES_CHECKLIST.find((s) => s.id === secaoAberta);
  const mudarEtapa = (id: string) => {
    if (salvando) return;
    const destino = etapas.findIndex((etapa) => etapa.id === id);
    if (destino < 0) return;
    if (destino > indiceEtapa) {
      for (let i = 0; i < destino; i += 1) {
        const problema = validarEtapa(etapas[i].id);
        if (problema) {
          setDirecaoEtapa(i >= indiceEtapa ? 1 : -1);
          setSecaoAberta(etapas[i].id);
          setErroEtapa(problema);
          return;
        }
      }
    }
    setErroEtapa("");
    setDirecaoEtapa(destino >= indiceEtapa ? 1 : -1);
    setSecaoAberta(id);
  };
  return (
    <section
      className={`${card} ${checklistConcluido || progresso === 100 ? "border-emerald-400/50" : progresso === 0 ? "border-yellow-400/40" : "border-red-400/40"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/20 p-4 sm:p-5">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {checklistConcluido ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">
                    <ShieldCheck size={11} /> Concluído
                    {concluidoPor ? ` por ${concluidoPor}` : ""}
                  </span>
                ) : (
                  completo && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">
                      <ShieldCheck size={11} /> Completo
                    </span>
                  )
                )}
              </div>
              <h2 className="mt-2 text-base font-extrabold">
                Checklist pré-voo
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Plane size={12} className="text-primary" />{" "}
                  {item.numero_voo || "Voo aprovado"}
                </span>
                <span>
                  {item.origem} → {item.destino}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={11} /> {dataVoo(item.data_agendada)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="relative h-14 w-14 rounded-full"
              style={{
                background: `conic-gradient(${corChecklist} ${progresso}%, hsl(var(--muted)) ${progresso}%)`,
              }}
            >
              <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-card">
                <strong className="text-sm">{progresso}%</strong>
                <span className="text-[7px] uppercase text-muted-foreground">
                  feito
                </span>
              </div>
            </div>
            <div className="text-[10px]">
              <strong>
                {respondidos} de {itens.length} itens
              </strong>
              <p className="text-emerald-400">{feitos} OK</p>
              {pendencias[0] && (
                <p className="text-amber-400">{pendencias[0]}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={aberto ? "default" : "outline"}
            onClick={() => setAberto((v) => !v)}
            className="h-10 gap-2 rounded-xl border border-primary/30 bg-primary/10 text-xs text-primary hover:bg-primary/20"
          >
            {aberto
              ? "Fechar checklist"
              : checklistConcluido
                ? "Visualizar checklist"
                : "Abrir checklist"}
            <ChevronDown size={14} className={aberto ? "rotate-180" : ""} />
          </Button>
        </div>
      </div>
      {aberto && checklistConcluido && (
        <div className="px-4 pt-4 sm:px-5">
          <PesoBalanceamentoFicha item={item} />
        </div>
      )}
      {aberto && checklistConcluido && (
        <ListaChecklistConcluido
          respostas={respostas}
          alertas={alertas}
          nivelOleo={nivelOleo}
          observacoes={observacoes}
          necessitaAbastecer={necessitaAbastecer === "sim"}
        />
      )}
      {aberto && !checklistConcluido && (
        <div className="space-y-4 p-4 sm:p-5">
          <EtapasChecklist
            etapas={etapas}
            atual={secaoAberta}
            direcao={direcaoEtapa}
            desabilitado={salvando}
            aoSelecionar={mudarEtapa}
          >
            {erroEtapa && (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              >
                {erroEtapa}
              </p>
            )}
            <fieldset
              disabled={checklistConcluido || salvando}
              className="min-w-0 space-y-3"
            >
              {secaoAtual && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {secaoAtual.subtitulo}
                  </p>
                  <div className="grid gap-2">
                    {secaoAtual.itens.map((i) => {
                      const r = respostas[i.id];
                      return (
                        <div
                          key={i.id}
                          className={`flex flex-col justify-between gap-3 rounded-2xl border ${r?.status === "feito" ? "border-emerald-200 dark:border-border/70" : "border-border/70"} bg-background/50 p-3.5 shadow-sm sm:flex-row sm:items-center`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="flex items-start gap-2 text-[11px]">
                              <span
                                className={`mt-1 h-2 w-2 rounded-full ${r?.status === "feito" ? "bg-emerald-400" : r?.status === "alerta" ? "bg-amber-400" : r?.status === "nao_feito" ? "bg-red-400" : "bg-muted-foreground/30"}`}
                              />
                              {i.label}
                            </span>
                            {i.tipo === "oleo" && (
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={nivelOleo}
                                onChange={(e) => setNivelOleo(e.target.value)}
                                aria-label="Nível de óleo"
                                placeholder="Informe o nível de óleo"
                                className={`${input} mt-2 max-w-xs`}
                              />
                            )}
                            {r?.status === "alerta" && (
                              <textarea
                                value={alertas[i.id] || ""}
                                onChange={(e) =>
                                  setAlertas((atual) => ({
                                    ...atual,
                                    [i.id]: e.target.value,
                                  }))
                                }
                                aria-label={`Justificativa do alerta: ${i.label}`}
                                placeholder="Descreva o motivo do alerta"
                                className="mt-2 min-h-16 w-full rounded-lg border border-amber-400/40 bg-background p-2 text-xs"
                              />
                            )}
                          </div>
                          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[250px]">
                            <button
                              type="button"
                              aria-label={`Marcar ${i.label} como feito`}
                              onClick={() => marcar(i.id, "feito")}
                              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-semibold transition-colors ${r?.status === "feito" ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-border bg-background/50 text-muted-foreground hover:bg-secondary"}`}
                            >
                              <Check size={14} /> Feito
                            </button>
                            <button
                              type="button"
                              aria-label={`Marcar ${i.label} como alerta`}
                              onClick={() => marcar(i.id, "alerta")}
                              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-semibold transition-colors ${r?.status === "alerta" ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : "border-border bg-background/50 text-muted-foreground hover:bg-secondary"}`}
                            >
                              <AlertTriangle size={14} /> Alerta
                            </button>
                            <button
                              type="button"
                              aria-label={`Marcar ${i.label} como não feito`}
                              onClick={() => marcar(i.id, "nao_feito")}
                              className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-semibold transition-colors ${r?.status === "nao_feito" ? "border-red-400/50 bg-red-400/10 text-red-300" : "border-border bg-background/50 text-muted-foreground hover:bg-secondary"}`}
                            >
                              <X size={14} /> Não feito
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {secaoAberta === "abastecimento" && (
                <>
                  <div className="rounded-xl border border-border/70 bg-secondary/[.12] p-4">
                    <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Fuel size={16} className="text-primary" />
                      <div>
                        <h3 className="text-xs font-bold">
                          Necessita abastecer?
                        </h3>
                        <p className="text-[9px] text-muted-foreground">
                          Se sim, o abastecimento será criado com status “gerado
                          pré voo” no financeiro.
                        </p>
                      </div>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold sm:ml-auto">
                        <input
                          type="checkbox"
                          checked={necessitaAbastecer === "sim"}
                          onChange={(e) => {
                            setNecessitaAbastecer(
                              e.target.checked ? "sim" : "nao",
                            );
                            if (!e.target.checked) setTrechoConfirmado(false);
                          }}
                          className="h-4 w-4 accent-primary"
                        />
                        Necessita abastecer
                      </label>
                    </div>
                    {necessitaAbastecer === "sim" && (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <Campo label="Data">
                            <input
                              type="date"
                              value={data}
                              onChange={(e) => setData(e.target.value)}
                              className={input}
                            />
                          </Campo>
                          <Campo label="Fornecedor favorito">
                            <SearchableCombobox
                              items={fornecedores}
                              value={fornecedorId}
                              onChange={setFornecedorId}
                              placeholder="Selecione o fornecedor"
                              searchPlaceholder="Buscar fornecedor"
                              emptyMessage="Nenhum fornecedor favorito."
                            />
                          </Campo>
                          <Campo label="Tipo de combustível">
                            <select
                              value={tipoCombustivel}
                              onChange={(e) =>
                                setTipoCombustivel(e.target.value)
                              }
                              className={input}
                            >
                              <option value="">Selecione</option>
                              <option value="AVGAS">AVGAS</option>
                              <option value="JETA1">JETA1</option>
                            </select>
                          </Campo>
                          <Campo label="Local / aeródromo">
                            <SearchableCombobox
                              items={(opcoes.aerodromos || []).map(
                                (a: any) => ({
                                  id: a.id,
                                  label: `${a.designativo_icao || a.id} · ${a.nome || ""}`,
                                }),
                              )}
                              value={local}
                              onChange={setLocal}
                              placeholder="Selecione o aeródromo"
                              searchPlaceholder="Buscar ICAO ou nome"
                              emptyMessage="Nenhum aeródromo encontrado."
                            />
                          </Campo>
                          <Campo label="Litros">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={litros}
                              onChange={(e) => setLitros(e.target.value)}
                              className={input}
                            />
                          </Campo>
                          <Campo label="Valor unitário">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={valorUnitario}
                              onChange={(e) => setValorUnitario(e.target.value)}
                              className={input}
                            />
                          </Campo>
                          <Campo label="Desconto">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={desconto}
                              onChange={(e) => setDesconto(e.target.value)}
                              placeholder="Aplicar desconto"
                              className={input}
                            />
                          </Campo>
                          <Campo label="Valor total calculado">
                            <input
                              readOnly
                              value={total.toFixed(2)}
                              className={`${input} bg-muted/30`}
                            />
                          </Campo>
                          <Campo label="Número da comanda">
                            <input
                              value={comanda}
                              onChange={(e) => setComanda(e.target.value)}
                              className={input}
                            />
                          </Campo>
                          <AnexosDinamicos
                            file={arquivo}
                            onFileChange={setArquivo}
                            accept="image/*,.pdf"
                            label="Imagem da comanda"
                            description="PDF ou imagem"
                          />
                        </div>
                        {ultimo ? (
                          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[10px]">
                            O último trecho registrado para a aeronave{" "}
                            <strong>
                              {item.matricula_registro || "selecionada"}
                            </strong>{" "}
                            é <strong>{trechoTexto}</strong>, realizado por{" "}
                            <strong>
                              {ultimo.socio_nome ||
                                ultimo.cliente_nome ||
                                "cotista não identificado"}
                            </strong>
                            . Deseja confirmar esse trecho e vincular esse
                            cotista ao abastecimento?{" "}
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  trechoConfirmado ? "default" : "outline"
                                }
                                onClick={() => {
                                  setTrechoId(ultimo.id);
                                  setTrecho(
                                    `${ultimo.aerodromo_partida || "?"} X ${ultimo.aerodromo_chegada || "?"}`,
                                  );
                                  setTrechoConfirmado(true);
                                  setTrechoManualAberto(false);
                                }}
                              >
                                Confirmar trecho
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setTrechoId("");
                                  setTrechoConfirmado(false);
                                  setTrechoManualAberto(true);
                                }}
                              >
                                Não
                              </Button>
                            </div>
                            {trechoManualAberto && (
                              <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">
                                <Campo label="Trecho manual">
                                  <input
                                    value={manualTrecho}
                                    onChange={(e) =>
                                      setManualTrecho(e.target.value)
                                    }
                                    placeholder="Ex.: SBXX X SBYY"
                                    className={input}
                                  />
                                </Campo>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-[10px] text-amber-200">
                            <p>
                              Não há trecho anterior registrado para esta
                              aeronave. Informe o trecho manualmente para
                              concluir o abastecimento.
                            </p>
                            <div className="mt-2 max-w-sm">
                              <Campo label="Trecho manual">
                                <input
                                  value={manualTrecho}
                                  onChange={(e) => {
                                    setManualTrecho(e.target.value);
                                    setTrechoManualAberto(true);
                                  }}
                                  placeholder="Ex.: SBXX X SBYY"
                                  className={input}
                                />
                              </Campo>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
              {secaoAberta === "revisao" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Respondidos
                      </span>
                      <strong>
                        {respondidos}/{itens.length}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Feitos
                      </span>
                      <strong>{feitos}</strong>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Alertas
                      </span>
                      <strong>{quantidadeAlertas}</strong>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <span className="block text-xs text-muted-foreground">
                        Não feitos
                      </span>
                      <strong>
                        {respondidos - feitos - quantidadeAlertas}
                      </strong>
                    </div>
                  </div>
                  {pendencias.length > 0 && (
                    <ul className="list-inside list-disc rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
                      {pendencias.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {necessitaAbastecer === "sim"
                      ? `Abastecimento: ${litros || "0"} litros · total ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
                      : necessitaAbastecer === "nao"
                        ? "Não necessita abastecimento."
                        : "Abastecimento não informado."}
                  </p>

                  <textarea
                    aria-label="Observações operacionais"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações operacionais"
                    className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}
            </fieldset>
          </EtapasChecklist>
          {(mensagem || erro) && (
            <div
              role={erro ? "alert" : "status"}
              className={`rounded-xl border p-3 text-xs ${erro ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"}`}
            >
              {erro || mensagem}
            </div>
          )}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              disabled={indiceEtapa === 0 || salvando}
              onClick={() => mudarEtapa(etapas[indiceEtapa - 1].id)}
              className="h-11 gap-2"
            >
              <ChevronLeft size={15} /> Anterior
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {!checklistConcluido && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void salvar(false)}
                  disabled={salvando}
                  className="h-11 gap-2 text-xs"
                >
                  <Save size={13} /> Salvar rascunho
                </Button>
              )}
              {indiceEtapa < etapas.length - 1 ? (
                <Button
                  type="button"
                  disabled={salvando}
                  onClick={() => mudarEtapa(etapas[indiceEtapa + 1].id)}
                  className="h-11 gap-2"
                >
                  Próximo <ChevronRight size={15} />
                </Button>
              ) : (
                !checklistConcluido && (
                  <Button
                    type="button"
                    onClick={() => void salvar(true)}
                    disabled={salvando}
                    className="h-11 gap-2 text-xs"
                  >
                    {salvando ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}{" "}
                    Concluir checklist
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
