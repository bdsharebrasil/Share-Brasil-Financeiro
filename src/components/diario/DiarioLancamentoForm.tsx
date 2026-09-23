import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, Fuel, PlaneTakeoff, Save, Users, X } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import {
  buscarNumerosVooAeronave,
  type NumeroVooJornada,
  type NumeroVooPerna,
} from "@/lib/colaborador-api";
import { Button } from "@/components/ui/button";
import type {
  DiarioLancamento,
  DiarioOpcoesResponse,
} from "@/lib/colaborador-api";

const inputClass =
  "h-10 w-full rounded-xl border border-white/[.1] bg-white/[.04] px-3 text-xs text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-white/[.07] focus:ring-2 focus:ring-cyan-300/15";
const selectClass = `${inputClass} appearance-none [&>option]:bg-[#101722] [&>option]:text-slate-100`;
const naturezas = [
  "AE - Aérea/Regular",
  "CQ - Cheque",
  "EX - Executivo",
  "NR - Não remunerado",
  "RE - Retorno/Reposição",
  "PV - Privado",
  "SA - Serviço aéreo",
  "TN - Táxi aéreo",
  "TR - Traslado",
  "VT - Voo Teste",
];

type FormValues = Record<string, string | boolean>;

const formatDateShort = (value?: string | null) => {
  if (!value) return "sem data";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value;
};
const decimalToHoursMinutes = (value: string) => {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return "";
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
};
const hoursMinutesToDecimal = (value: string) => {
  const text = value.trim();
  if (!text) return "";
  const match = text.match(/^(\d+)(?::([0-5]\d))?$/);
  if (!match) return text;
  return (Number(match[1]) + Number(match[2] || 0) / 60).toFixed(2);
};
const checkinBeforeAc = (time?: string | null) => {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return "";
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const total = (hours * 60 + minutes - 30 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const timestampUtc = (data: string, hora: string) =>
  data && hora ? `${data}T${hora.length === 5 ? `${hora}:00` : hora}Z` : null;

const diferencaHoras = (inicio: string, fim: string) => {
  if (!inicio || !fim) return 0;
  const [inicioHora, inicioMinuto] = inicio.split(":").map(Number);
  const [fimHora, fimMinuto] = fim.split(":").map(Number);
  if (![inicioHora, inicioMinuto, fimHora, fimMinuto].every(Number.isFinite)) return 0;
  let minutos = fimHora * 60 + fimMinuto - (inicioHora * 60 + inicioMinuto);
  if (minutos < 0) minutos += 24 * 60;
  return minutos / 60;
};

const normalizarNumeroVoo = (value: unknown) =>
  String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();

function formFromEntry(
  entry: Partial<DiarioLancamento> | undefined,
  date: string,
  celula: number,
  sugestaoTrecho = "",
): FormValues {
  const natureza = entry?.natureza_voo || "PV - Privado";
  const rateioIgual =
    natureza === "TR - Traslado" || natureza === "VT - Voo Teste";
    return {
      data_registro: entry?.data_registro?.slice(0, 10) || date,
      numero_voo: entry?.numero_voo || "",
      jornada_id: (entry as any)?.jornada_id || "",
      perna_jornada_id: (entry as any)?.perna_jornada_id || "",
      acionamento_utc: entry?.acionamento_utc || timestampUtc(entry?.data_registro?.slice(0, 10) || date, entry?.tempo_ac?.slice(0, 5) || "") || "",
      decolagem_utc: entry?.decolagem_utc || timestampUtc(entry?.data_registro?.slice(0, 10) || date, entry?.tempo_dep?.slice(0, 5) || "") || "",
      pouso_utc: entry?.pouso_utc || timestampUtc(entry?.data_registro?.slice(0, 10) || date, entry?.tempo_pou?.slice(0, 5) || "") || "",
      corte_utc: entry?.corte_utc || timestampUtc(entry?.data_registro?.slice(0, 10) || date, entry?.tempo_cor?.slice(0, 5) || "") || "",
      natureza_voo: natureza,
      aerodromo_partida: entry?.aerodromo_partida || "",
      aerodromo_chegada: entry?.aerodromo_chegada || "",
      trecho: entry?.trecho || sugestaoTrecho,
      pic_canac: entry?.pic_canac || "",
      pic_nome: entry?.pic_nome || "",
      sic_canac: entry?.sic_canac || "",
      sic_nome: entry?.sic_nome || "",
    cliente_id: rateioIgual ? "" : entry?.cliente_id || "",
    holding_id: rateioIgual ? "" : entry?.holding_id || "",
    socio_id: rateioIgual ? "" : entry?.socio_id || "",
    voo_emprestado: Boolean(entry?.voo_emprestado),
    cliente_tomador_emprestimo_id: entry?.cliente_tomador_emprestimo_id || "",
    socio_tomador_emprestimo_id: entry?.socio_tomador_emprestimo_id || "",
    tripulacao_checkin_hora: checkinBeforeAc(entry?.tempo_ac),
    tempo_ac: entry?.tempo_ac?.slice(0, 5) || "",
    tempo_dep: entry?.tempo_dep?.slice(0, 5) || "",
    tempo_pou: entry?.tempo_pou?.slice(0, 5) || "",
    tempo_cor: entry?.tempo_cor?.slice(0, 5) || "",
    tempo_ifr: String(entry?.tempo_ifr ?? ""),
    tempo_voo: String(entry?.tempo_voo ?? ""),
    tempo_total: String(entry?.tempo_total ?? ""),
    horas_diurnas: String(entry?.horas_diurnas ?? ""),
    horas_noturnas: String(entry?.horas_noturnas ?? ""),
    horas_noturnas_manual: false,
    consumo_combustivel_voo: String((entry as any)?.consumo_combustivel_voo ?? ""),
    consumo_combustivel_total: String((entry as any)?.consumo_combustivel_total ?? ""),
    pousos_total: String(entry?.pousos_total ?? 1),
    distancia_nm: String(entry?.distancia_nm ?? ""),
    litros_combustivel_inicio_voo: String(
      entry?.litros_combustivel_inicio_voo ?? "",
    ),
    litros_combustivel_abastecido: String(
      entry?.litros_combustivel_abastecido ?? "",
    ),
    local_combustivel: entry?.local_combustivel || "",
    abastecido: Boolean((entry as any)?.abastecido || (entry as any)?.abastecimento_id),
    celula: String(entry?.celula ?? celula),
    diarias: String(entry?.diarias ?? "0"),
    passageiros: String(entry?.passageiros ?? 0),
    carga_kg: entry?.carga_kg || "",
    ocorrencias: entry?.ocorrencias || "",
    discrepancias: entry?.discrepancias || "",
    acoes_corretivas: entry?.acoes_corretivas || "",
    abastecimento_litros: "",
    abastecimento_data: date,
    abastecimento_cliente_id: "",
    abastecimento_socio_id: "",
    abastecimento_local: "",
    abastecimento_numero_comanda: "",
    abastecimento_numero_nf: "",
  };
}

export default function DiarioLancamentoForm({
  aeronaveId,
    consumoCombustivel,
  diarioMesId,
  opcoes,
  initialData,
  sugeridaCelula,
  sugestaoTrecho,
  temDiaria,
  onSubmit,
  onCancel,
  saving,
}: {
  aeronaveId: string;
    consumoCombustivel?: number | string | null;
  diarioMesId: string;
  opcoes: DiarioOpcoesResponse;
  initialData?: DiarioLancamento | null;
  sugeridaCelula: number;
  sugestaoTrecho?: string;
  temDiaria?: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormValues>(() =>
    formFromEntry(
      initialData || undefined,
      today,
      sugeridaCelula,
      sugestaoTrecho,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [voos, setVoos] = useState<Array<any>>([]);
  const [voosError, setVoosError] = useState("");
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState("");
  const [jornadaSelecionada, setJornadaSelecionada] = useState("");
  const [pernaSelecionada, setPernaSelecionada] = useState("");
  useEffect(() => {
    setVoosError("");
    void buscarNumerosVooAeronave(aeronaveId)
      .then((response) => setVoos(response.voos || []))
      .catch((cause) => {
        setVoos([]);
        setVoosError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os números de voo.",
        );
      });
  }, [aeronaveId]);
  useEffect(() => {
    const next = formFromEntry(
      initialData || undefined,
      today,
      sugeridaCelula,
      sugestaoTrecho,
    );
    setForm(next);
    setSolicitacaoSelecionada("");
    setJornadaSelecionada(String(next.jornada_id || ""));
    setPernaSelecionada(String(next.perna_jornada_id || ""));
    setError(null);
  }, [initialData, diarioMesId, sugeridaCelula, sugestaoTrecho]);
  useEffect(() => {
    if (!initialData?.numero_voo || solicitacaoSelecionada) return;
    const voo = voos.find(
      (item) =>
        normalizarNumeroVoo(item.numero_voo) ===
        normalizarNumeroVoo(initialData.numero_voo),
    );
    if (voo) setSolicitacaoSelecionada(voo.solicitacao_id);
  }, [initialData?.numero_voo, solicitacaoSelecionada, voos]);
  useEffect(() => {
    if (!solicitacaoSelecionada) {
      setSolicitacaoSelecionada(
        voos.find(
          (voo) =>
            normalizarNumeroVoo(voo.numero_voo) ===
            normalizarNumeroVoo(value("numero_voo")),
        )
          ?.solicitacao_id || "",
      );
    }
  }, [voos, solicitacaoSelecionada, form.numero_voo]);
  const setField = (key: string, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const value = (key: string) => String(form[key] ?? "");
  const atualizarCalculosManuais = (campo: string, valor: string) => {
    const tempos = {
      tempo_ac: value("tempo_ac"),
      tempo_dep: value("tempo_dep"),
      tempo_pou: value("tempo_pou"),
      tempo_cor: value("tempo_cor"),
      [campo]: valor,
    };
    const tempoVoo = diferencaHoras(tempos.tempo_dep, tempos.tempo_pou);
    const tempoTotal = diferencaHoras(tempos.tempo_ac, tempos.tempo_cor);
    const valores = {
      tempo_voo: tempoVoo,
      tempo_total: tempoTotal || tempoVoo,
      horas_diurnas: tempoVoo,
      horas_noturnas: 0,
      consumo_combustivel_voo: tempoVoo * Number(consumoCombustivel || 0),
      consumo_combustivel_total: (tempoTotal || tempoVoo) * Number(consumoCombustivel || 0),
    };
    Object.entries(valores).forEach(([chave, valorCalculado]) => setField(chave, valorCalculado.toFixed(2)));
  };
  const setTempoAc = (tempoAc: string) => {
    setField("tempo_ac", tempoAc);
    setField("tripulacao_checkin_hora", checkinBeforeAc(tempoAc));
    setField("acionamento_utc", timestampUtc(value("data_registro"), tempoAc) || "");
    if (!value("perna_jornada_id")) atualizarCalculosManuais("tempo_ac", tempoAc);
  };
  const alterarTempo = (campo: "tempo_ac" | "tempo_dep" | "tempo_pou" | "tempo_cor", valor: string) => {
    setField(campo, valor);
    if (campo === "tempo_ac") setField("tripulacao_checkin_hora", checkinBeforeAc(valor));
    const timestampCampo = { tempo_ac: "acionamento_utc", tempo_dep: "decolagem_utc", tempo_pou: "pouso_utc", tempo_cor: "corte_utc" }[campo];
    setField(timestampCampo, timestampUtc(value("data_registro"), valor) || "");
    if (!value("perna_jornada_id")) atualizarCalculosManuais(campo, valor);
  };
  const tripulacao = useMemo(
    () => opcoes.tripulantes,
    [opcoes.tripulantes],
  );
  const selecionarTripulante = (prefixo: "pic" | "sic", id: string, label: string) => {
    const tripulante = tripulacao.find((item) => item.canac === id);
    if (tripulante) {
      setField(`${prefixo}_canac`, tripulante.canac);
      setField(`${prefixo}_nome`, tripulante.nome_completo);
      return;
    }
    const partes = label.split(" · ");
    const canac = partes.length > 1 ? partes[partes.length - 1] : label;
    const nome = partes.length > 1 ? partes.slice(0, -1).join(" · ") : label;
    setField(`${prefixo}_canac`, canac);
    setField(`${prefixo}_nome`, nome);
  };
  const selectedPic = useMemo(
    () =>
      tripulacao.find(
        (tripulante) =>
          tripulante.canac?.toUpperCase() === value("pic_canac").toUpperCase(),
      ),
    [tripulacao, form.pic_canac],
  );
  const selectedSic = useMemo(
    () =>
      tripulacao.find(
        (tripulante) =>
          tripulante.canac?.toUpperCase() === value("sic_canac").toUpperCase(),
      ),
    [tripulacao, form.sic_canac],
  );
  const rateioIgual =
    value("natureza_voo") === "TR - Traslado" ||
    value("natureza_voo") === "VT - Voo Teste";
  const cotistaSelecionado = value("holding_id")
    ? `holding:${value("holding_id")}`
    : value("cliente_id");
  const vooSelecionado =
    voos.find((voo) => voo.solicitacao_id === solicitacaoSelecionada) ||
    voos.find(
      (voo) =>
        normalizarNumeroVoo(voo.numero_voo) ===
        normalizarNumeroVoo(value("numero_voo")),
    );
  const jornadas = (vooSelecionado?.jornadas || []) as NumeroVooJornada[];
  const jornada = jornadas.find(
    (item) => item.jornada_id === (jornadaSelecionada || value("jornada_id")),
  );
  const pernas = (jornada?.pernas || []) as NumeroVooPerna[];
  const pernasDisponiveis = pernas.filter(
    (item) => !item.lancamento_diario_id || item.perna_id === pernaSelecionada,
  );
  const perna = pernas.find((item) => item.perna_id === pernaSelecionada);
  const aerodromos = useMemo(
    () =>
      opcoes.aerodromos.map((aero) => ({
        id: aero.designativo,
        label: `${aero.designativo} · ${aero.nome}`,
      })),
    [opcoes.aerodromos],
  );
  const nomeAerodromo = (icao: string) =>
    opcoes.aerodromos.find((aero) => aero.designativo === icao)?.nome || icao;
  const atualizarAerodromo = (
    campo: "aerodromo_partida" | "aerodromo_chegada",
    icao: string,
  ) => {
    setField(campo, icao);
    const origem =
      campo === "aerodromo_partida" ? icao : value("aerodromo_partida");
    const destino =
      campo === "aerodromo_chegada" ? icao : value("aerodromo_chegada");
    if (origem && destino)
      setField(
        "trecho",
        `${nomeAerodromo(origem)} (${origem}) X ${nomeAerodromo(destino)} (${destino})`,
      );
  };
  const aplicarVoo = (solicitacaoId: string) => {
    const voo = voos.find((item) => item.solicitacao_id === solicitacaoId);
    if (!voo) return;
    setSolicitacaoSelecionada(solicitacaoId);
    setField("numero_voo", voo.numero_voo);
    setField("cliente_id", voo.cliente_id || "");
    setField("socio_id", voo.socio_id || "");
    setField("holding_id", "");
    setField("data_registro", voo.data_agendada?.slice(0, 10) || value("data_registro"));
    setField("aerodromo_partida", voo.origem || "");
    setField("aerodromo_chegada", voo.destino || "");
    if (voo.origem && voo.destino) {
      setField(
        "trecho",
        `${nomeAerodromo(voo.origem)} (${voo.origem}) X ${nomeAerodromo(voo.destino)} (${voo.destino})`,
      );
    }
    setField(
      "voo_emprestado",
      voo?.voo_emprestado === "sim" ||
        voo?.voo_emprestado === 1 ||
        voo?.voo_emprestado === true,
    );
    setField(
      "cliente_tomador_emprestimo_id",
      voo?.cliente_emprestimo_id || "",
    );
    setField(
      "socio_tomador_emprestimo_id",
      voo?.socio_emprestimo_id || "",
    );
    setField("pic_canac", voo?.pic_canac || "");
    setField("pic_nome", voo?.pic_nome || "");
    setField("sic_canac", voo?.sic_canac || "");
    setField("sic_nome", voo?.sic_nome || "");
    setField("jornada_id", "");
    setField("perna_jornada_id", "");
    setJornadaSelecionada("");
    setPernaSelecionada("");
  };
  const limparVinculoVoo = () => {
    setSolicitacaoSelecionada("");
    setJornadaSelecionada("");
    setPernaSelecionada("");
    setField("numero_voo", "");
    setField("jornada_id", "");
    setField("perna_jornada_id", "");
  };
  const aplicarPerna = (id: string) => {
    const item = pernasDisponiveis.find(
      (candidate) => candidate.perna_id === id,
    );
    if (!item) return;
    const selectedJornadaId = jornadaSelecionada || value("jornada_id");
    setPernaSelecionada(id);
    setJornadaSelecionada(selectedJornadaId);
    setField("jornada_id", selectedJornadaId);
    setField("perna_jornada_id", id);
    setField("aerodromo_partida", item.origem);
    setField("aerodromo_chegada", item.destino);
    setField(
      "trecho",
      `${nomeAerodromo(item.origem)} (${item.origem}) X ${nomeAerodromo(item.destino)} (${item.destino})`,
    );
    const hhmm = (iso: string | null) => (iso ? iso.slice(11, 16) : "");
    const tempoAc = hhmm(item.horario_ac);
    const tempoDep = hhmm(item.horario_dep);
    const tempoPou = hhmm(item.horario_pouso);
    const tempoCor = hhmm(item.horario_corte);
    setTempoAc(tempoAc);
    setField("tempo_dep", tempoDep);
    setField("tempo_pou", tempoPou);
    setField("tempo_cor", tempoCor);
    setField("acionamento_utc", item.horario_ac || "");
    setField("decolagem_utc", item.horario_dep || "");
    setField("pouso_utc", item.horario_pouso || "");
    setField("corte_utc", item.horario_corte || "");
    setField("passageiros", String(item.numero_passageiros ?? 0));
    setField("tempo_voo", Number(item.tempo_voo || 0).toFixed(2));
    setField("tempo_total", Number(item.tempo_total || 0).toFixed(2));
    setField("horas_diurnas", Number(item.horas_diurnas || 0).toFixed(2));
    setField("horas_noturnas", Number(item.horas_noturnas || 0).toFixed(2));
    setField("horas_noturnas_manual", false);
    setField("consumo_combustivel_voo", Number(item.consumo_combustivel_voo || 0).toFixed(2));
    setField("consumo_combustivel_total", Number(item.consumo_combustivel_total || 0).toFixed(2));
    setField("pousos_total", item.horario_pouso ? "1" : "0");
    setField("distancia_nm", String(item.distancia_nm || 0));
    setField(
      "data_registro",
      (item.horario_ac || jornada?.data || "").slice(0, 10),
    );
  };
  const clientesSocios = useMemo(
    () =>
      opcoes.socios.filter((socio) => {
        if (value("holding_id"))
          return socio.holding_id === value("holding_id");
        return !value("cliente_id") || socio.cliente_id === value("cliente_id");
      }),
    [opcoes.socios, form.cliente_id, form.holding_id],
  );

  const submit = async () => {
    setError(null);
    if (
      !value("data_registro") ||
      !value("aerodromo_partida") ||
      !value("aerodromo_chegada") ||
      !value("pic_canac") ||
      !value("natureza_voo")
    ) {
      setError("Informe data, origem, destino, PIC e natureza do voo.");
      return;
    }
    const number = (key: string) =>
      value(key) === "" ? 0 : Number(value(key));
    const payload: Record<string, unknown> = {
      diario_mes_id: diarioMesId,
      aeronave_id: aeronaveId,
      data_registro: value("data_registro"),
      numero_voo: value("numero_voo") || null,
      jornada_id: value("jornada_id") || null,
      perna_jornada_id: value("perna_jornada_id") || null,
      natureza_voo: value("natureza_voo"),
      aerodromo_partida: value("aerodromo_partida").toUpperCase(),
      aerodromo_chegada: value("aerodromo_chegada").toUpperCase(),
      trecho: value("trecho") || null,
      pic_canac: value("pic_canac").toUpperCase(),
      pic_nome: value("pic_nome") || selectedPic?.nome_completo || null,
      sic_canac: value("sic_canac").toUpperCase() || null,
      sic_nome: value("sic_nome") || selectedSic?.nome_completo || null,
      cliente_id: rateioIgual
        ? null
        : value("holding_id")
          ? null
          : value("cliente_id") || null,
      holding_id: rateioIgual ? null : value("holding_id") || null,
      socio_id: rateioIgual ? null : value("socio_id") || null,
      voo_emprestado: Boolean(form.voo_emprestado),
      cliente_tomador_emprestimo_id:
        value("cliente_tomador_emprestimo_id") || null,
      socio_tomador_emprestimo_id: value("socio_tomador_emprestimo_id") || null,
      tripulacao_checkin_hora: value("tripulacao_checkin_hora") || null,
      acionamento_utc: value("perna_jornada_id") ? (value("acionamento_utc") || timestampUtc(value("data_registro"), value("tempo_ac"))) : timestampUtc(value("data_registro"), value("tempo_ac")),
      decolagem_utc: value("perna_jornada_id") ? (value("decolagem_utc") || timestampUtc(value("data_registro"), value("tempo_dep"))) : timestampUtc(value("data_registro"), value("tempo_dep")),
      pouso_utc: value("perna_jornada_id") ? (value("pouso_utc") || timestampUtc(value("data_registro"), value("tempo_pou"))) : timestampUtc(value("data_registro"), value("tempo_pou")),
      corte_utc: value("perna_jornada_id") ? (value("corte_utc") || timestampUtc(value("data_registro"), value("tempo_cor"))) : timestampUtc(value("data_registro"), value("tempo_cor")),
      tempo_ifr: number("tempo_ifr"),
      ...(Boolean(form.horas_noturnas_manual) ? { horas_noturnas: number("horas_noturnas") } : {}),
      pousos_total: number("pousos_total"),
      distancia_nm: number("distancia_nm"),
      litros_combustivel_inicio_voo: number("litros_combustivel_inicio_voo"),
      litros_combustivel_abastecido: Boolean(form.abastecido) ? number("abastecimento_litros") : 0,
      local_combustivel: Boolean(form.abastecido) ? value("abastecimento_local") || null : null,
      abastecido: Boolean(form.abastecido),
      celula: number("celula"),
      diarias: temDiaria ? number("diarias") : null,
      passageiros: number("passageiros"),
      carga_kg: value("carga_kg") || null,
      ocorrencias: value("ocorrencias") || null,
      discrepancias: value("discrepancias") || null,
      acoes_corretivas: value("acoes_corretivas") || null,
      abastecimento:
        Boolean(form.abastecido) && number("abastecimento_litros") > 0
          ? {
              litros: number("abastecimento_litros"),
              data: value("abastecimento_data") || value("data_registro"),
              cliente_id: value("abastecimento_cliente_id") || null,
              socio_id: value("abastecimento_socio_id") || null,
              local:
                value("abastecimento_local") ||
                value("local_combustivel") ||
                value("aerodromo_partida"),
              trecho: `${value("aerodromo_partida").toUpperCase()} X ${value("aerodromo_chegada").toUpperCase()}`,
              numero_comanda: value("abastecimento_numero_comanda") || null,
              numero_nf: value("abastecimento_numero_nf") || null,
            }
          : null,
    };
    if (
      Object.values(payload).some(
        (item) => typeof item === "number" && !Number.isFinite(item as number),
      )
    ) {
      setError("Revise os campos numéricos do lançamento.");
      return;
    }
    await onSubmit(payload);
  };

  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[#101722] shadow-[0_24px_70px_rgba(0,0,0,.22)]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-cyan-400/[.07] blur-3xl" />
      <div className="relative flex items-start justify-between gap-3 border-b border-white/[.08] bg-[#0d1521] px-3 py-3 sm:items-center sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300">
            <BookOpen size={16} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">
              {initialData
                ? "Editar lançamento de voo"
                : "Novo lançamento de voo"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400"></p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/[.08] p-2 text-slate-400 transition-colors hover:border-white/[.2] hover:text-white"
        >
          <X size={15} />
        </button>
      </div>
      <div className="relative min-w-0 space-y-4 bg-[#02090f] p-3 sm:space-y-6 sm:p-5">
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200">
            {error}
          </div>
        )}
        {voosError && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-200">
            {voosError}
          </div>
        )}
        <FormSection icon={<PlaneTakeoff size={13} />} title="Voo e rota">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Data *">
              <input
                type="date"
                value={value("data_registro")}
                onChange={(e) => setField("data_registro", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Número do voo">
              <SearchableCombobox
                items={voos.map((voo) => ({
                  id: voo.solicitacao_id,
                  label: `${voo.numero_voo || "Voo sem número"} · ${formatDateShort(voo.data_agendada)}${voo.origem && voo.destino ? ` · ${voo.origem} → ${voo.destino}` : ""}`,
                }))}
                value={solicitacaoSelecionada || value("numero_voo")}
                selectedLabel={voos.find((voo) => voo.solicitacao_id === solicitacaoSelecionada)?.numero_voo || value("numero_voo")}
                onChange={(id) => {
                  if (!id) {
                    limparVinculoVoo();
                    return;
                  }
                  if (voos.some((voo) => voo.solicitacao_id === id)) {
                    aplicarVoo(id);
                    return;
                  }
                  const vooCorrespondente = voos.find(
                    (voo) =>
                      normalizarNumeroVoo(voo.numero_voo) ===
                      normalizarNumeroVoo(id),
                  );
                  if (vooCorrespondente) {
                    aplicarVoo(vooCorrespondente.solicitacao_id);
                    return;
                  }
                  // Um número digitado pode ser usado sem vínculo com uma solicitação.
                  setSolicitacaoSelecionada("");
                  setJornadaSelecionada("");
                  setPernaSelecionada("");
                  setField("numero_voo", id);
                  setField("jornada_id", "");
                  setField("perna_jornada_id", "");
                }}
                placeholder="Buscar número do voo"
                searchPlaceholder="Digite número, rota ou data..."
                emptyMessage="Nenhum voo encontrado. Digite para lançar manualmente ou selecione um voo."
                clearable
                allowFreeText
                wrapItemLabels
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Jornada (número e data)">
              <SearchableCombobox
                items={[...jornadas]
                  .sort((a, b) => Number(a.numero_jornada) - Number(b.numero_jornada))
                  .map((item) => ({
                  id: item.jornada_id,
                  label: `Jornada ${item.numero_jornada} · ${formatDateShort(item.data)} · ${item.status}`,
                  }))}
                value={jornadaSelecionada || value("jornada_id")}
                selectedLabel={(() => {
                  const selecionada = jornadas.find(
                    (item) => item.jornada_id === (jornadaSelecionada || value("jornada_id")),
                  );
                  return selecionada ? `Jornada ${selecionada.numero_jornada}` : "";
                })()}
                onChange={(id) => {
                  setJornadaSelecionada(id);
                  setPernaSelecionada("");
                  setField("jornada_id", id);
                  setField("perna_jornada_id", "");
                }}
                placeholder="Selecione a jornada"
                searchPlaceholder="Buscar jornada..."
                emptyMessage="Selecione um voo primeiro."
                wrapItemLabels
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Trecho da jornada">
              <SearchableCombobox
                items={pernasDisponiveis.map((item) => ({
                  id: item.perna_id,
                  label: `${item.numero}. ${item.origem} X ${item.destino}${item.lancamento_diario_id ? " · já lançada" : ""}`,
                }))}
                value={pernaSelecionada || value("perna_jornada_id")}
                onChange={(id) => aplicarPerna(id)}
                placeholder="Selecione o trecho"
                searchPlaceholder="Buscar nome ou ICAO..."
                emptyMessage="Selecione a jornada primeiro."
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Natureza *">
              <SearchableCombobox
                items={naturezas.map((natureza) => ({ id: natureza, label: natureza }))}
                value={value("natureza_voo")}
                onChange={(id) => {
                  const natureza = id;
                  setField("natureza_voo", natureza);
                  if (
                    natureza === "TR - Traslado" ||
                    natureza === "VT - Voo Teste"
                  ) {
                    setField("cliente_id", "");
                    setField("holding_id", "");
                    setField("socio_id", "");
                  }
                }}
                placeholder="Selecionar natureza"
                searchPlaceholder="Buscar natureza..."
                emptyMessage="Nenhuma natureza encontrada."
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Trecho">
              <input
                value={value("trecho")}
                onChange={(e) => setField("trecho", e.target.value)}
                placeholder="SBSP X SBGR"
                className={inputClass}
              />
            </Field>
            <Field label="Origem ICAO *">
              <SearchableCombobox
                items={aerodromos}
                value={value("aerodromo_partida")}
                onChange={(id) => atualizarAerodromo("aerodromo_partida", id)}
                placeholder="Selecionar aeródromo"
                searchPlaceholder="Buscar por nome ou ICAO..."
                emptyMessage="Nenhum aeródromo encontrado."
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Destino ICAO *">
              <SearchableCombobox
                items={aerodromos}
                value={value("aerodromo_chegada")}
                onChange={(id) => atualizarAerodromo("aerodromo_chegada", id)}
                placeholder="Selecionar aeródromo"
                searchPlaceholder="Buscar por nome ou ICAO..."
                emptyMessage="Nenhum aeródromo encontrado."
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Passageiros">
              <input
                type="number"
                min="0"
                value={value("passageiros")}
                onChange={(e) => setField("passageiros", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Carga (kg)">
              <input
                value={value("carga_kg")}
                onChange={(e) => setField("carga_kg", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {perna?.lancamento_diario_id && (
            <p className="mt-2 text-[10px] text-amber-300">
              Esta perna já possui lançamento no diário.
            </p>
          )}
        </FormSection>
        <FormSection icon={<Users size={13} />} title="Tripulação e cotista">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="PIC * · tripulação ">
              <SearchableCombobox
                items={tripulacao.map((tripulante) => ({
                  id: tripulante.canac,
                  label: `${tripulante.nome_completo} · ${tripulante.canac} · ${tripulante.origem}`,
                }))}
                value={value("pic_canac")}
                onChange={(id, label) => selecionarTripulante("pic", id, label)}
                placeholder="Selecionar ou digitar PIC"
                searchPlaceholder="Buscar ou digitar nome/CANAC..."
                emptyMessage="Nenhum tripulante encontrado."
                allowFreeText
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="SIC · tripulação ">
              <SearchableCombobox
                items={tripulacao.map((tripulante) => ({
                  id: tripulante.canac,
                  label: `${tripulante.nome_completo} · ${tripulante.canac} · ${tripulante.origem}`,
                }))}
                value={value("sic_canac")}
                onChange={(id, label) => selecionarTripulante("sic", id, label)}
                placeholder="Sem SIC ou digitar"
                searchPlaceholder="Buscar ou digitar nome/CANAC..."
                emptyMessage="Nenhum tripulante encontrado."
                allowFreeText
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            <Field label="Cliente">
              <SearchableCombobox
                items={[
                  ...opcoes.clientes.map((cliente) => ({
                    id: cliente.id,
                    label: `${cliente.nome || cliente.proprietario || "Sem nome"}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""}`,
                  })),
                  ...opcoes.holdings.map((holding) => ({
                    id: `holding:${holding.id}`,
                    label: `Holding · ${holding.nome}${holding.proprietario ? ` · ${holding.proprietario}` : ""}`,
                  })),
                ]}
                disabled={rateioIgual}
                value={rateioIgual ? "" : cotistaSelecionado}
                onChange={(selected) => {
                  if (selected.startsWith("holding:")) {
                    setField("holding_id", selected.slice(8));
                    setField("cliente_id", "");
                  } else {
                    setField("holding_id", "");
                    setField("cliente_id", selected);
                  }
                  setField("socio_id", "");
                }}
                placeholder={rateioIgual ? "Rateio igual entre cotistas" : "Selecionar cliente"}
                searchPlaceholder="Buscar cliente ..."
                emptyMessage="Nenhum cliente encontrado."
                className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
              />
            </Field>
            {value("holding_id") && !rateioIgual && (
              <Field label="Sócio cotista">
                <SearchableCombobox
                  items={clientesSocios.map((socio) => ({ id: socio.id, label: socio.nome }))}
                  value={value("socio_id")}
                  onChange={(id) => setField("socio_id", id)}
                  placeholder="Selecionar sócio"
                  searchPlaceholder="Buscar sócio..."
                  emptyMessage="Nenhum sócio encontrado"
                  className="h-10 rounded-xl border-white/[.1] bg-white/[.04] text-xs text-slate-100"
                />
              </Field>
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(form.voo_emprestado)}
              onChange={(e) => setField("voo_emprestado", e.target.checked)}
              className="h-4 w-4 rounded border-border bg-secondary accent-primary"
            />{" "}
            Voo emprestado
          </label>
          {Boolean(form.voo_emprestado) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Cliente tomador do empréstimo">
                <select
                  value={value("cliente_tomador_emprestimo_id")}
                  onChange={(e) => {
                    setField("cliente_tomador_emprestimo_id", e.target.value);
                    setField("socio_tomador_emprestimo_id", "");
                  }}
                  className={selectClass}
                >
                  <option value="">Selecionar cliente tomador</option>
                  {opcoes.clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome || cliente.proprietario || "Sem nome"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sócio tomador do empréstimo">
                <select
                  value={value("socio_tomador_emprestimo_id")}
                  onChange={(e) =>
                    setField("socio_tomador_emprestimo_id", e.target.value)
                  }
                  className={selectClass}
                >
                  <option value="">Selecionar sócio tomador</option>
                  {opcoes.socios.map((socio) => (
                    <option key={socio.id} value={socio.id}>
                      {socio.nome}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </FormSection>
        <FormSection
          icon={<TimerIcon />}
          title="Tempos operacionais (UTC/Zulu) e célula"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Horário de apresentação">
              <input
                type="time"
                value={value("tripulacao_checkin_hora")}
                readOnly
                className={`${inputClass} cursor-not-allowed opacity-80`}
              />
            </Field>
            <Field label="Tempo AC">
              <input
                type="time"
                value={value("tempo_ac")}
                onChange={(e) => setTempoAc(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Decolagem">
              <input
                type="time"
                value={value("tempo_dep")}
                onChange={(e) => alterarTempo("tempo_dep", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Pouso">
              <input
                type="time"
                value={value("tempo_pou")}
                onChange={(e) => alterarTempo("tempo_pou", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Corte">
              <input
                type="time"
                value={value("tempo_cor")}
                onChange={(e) => alterarTempo("tempo_cor", e.target.value)}
                className={inputClass}
              />
            </Field>
            <DurationField
              label="Tempo de voo (h)"
              value={value("tempo_voo")}
              readOnly
            />
            <DurationField
              label="Tempo total (h)"
              value={value("tempo_total")}
              readOnly
            />
            <DurationField
              label="Horas diurnas"
              value={value("horas_diurnas")}
              readOnly
            />
            <DurationField
              label="Horas noturnas"
              value={value("horas_noturnas")}
              onChange={(v) => {
                setField("horas_noturnas", v);
                setField("horas_noturnas_manual", true);
              }}
            />
            <DurationField
              label="Tempo IFR"
              value={value("tempo_ifr")}
              onChange={(v) => setField("tempo_ifr", v)}
            />
            <NumberField
              label="Pousos"
              value={value("pousos_total")}
              onChange={(v) => setField("pousos_total", v)}
              step="1"
            />
            <NumberField
              label="Passageiros"
              value={value("passageiros")}
              onChange={(v) => setField("passageiros", v)}
              step="1"
            />
            <NumberField
              label="Distância (NM)"
              value={value("distancia_nm")}
              onChange={(v) => setField("distancia_nm", v)}
              step="0.1"
            />
          </div>
        </FormSection>
        {temDiaria && (
          <FormSection icon={<BookOpen size={13} />} title="Diárias">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField
                label="Quantidade de diárias"
                value={value("diarias")}
                onChange={(v) => setField("diarias", v)}
                step="1"
              />
            </div>
          </FormSection>
        )}
        <FormSection
          icon={<Fuel size={13} />}
          title="Combustível e abastecimento"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Consumo de voo">
              <input
                value={value("consumo_combustivel_voo")}
                readOnly
                className={`${inputClass} cursor-not-allowed opacity-70`}
              />
            </Field>
            <Field label="Consumo total">
              <input
                value={value("consumo_combustivel_total")}
                readOnly
                className={`${inputClass} cursor-not-allowed opacity-70`}
              />
            </Field>
            <NumberField
              label="Litros no início"
              value={value("litros_combustivel_inicio_voo")}
              onChange={(v) => setField("litros_combustivel_inicio_voo", v)}
              step="0.01"
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(form.abastecido)}
              onChange={(e) => setField("abastecido", e.target.checked)}
              className="h-4 w-4 rounded border-border bg-secondary accent-primary"
            />
            Teve abastecimento?
          </label>
          {Boolean(form.abastecido) && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label="Litros abastecidos"
              value={value("abastecimento_litros")}
              onChange={(v) => setField("abastecimento_litros", v)}
              step="0.01"
            />
            <Field label="Local do abastecimento">
              <input
                value={value("abastecimento_local")}
                onChange={(e) => setField("abastecimento_local", e.target.value)}
                placeholder="ICAO / posto"
                className={inputClass}
              />
            </Field>
            <Field label="Data do abastecimento">
              <input
                type="date"
                value={value("abastecimento_data")}
                onChange={(e) => setField("abastecimento_data", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Pagador cliente">
              <select
                value={value("abastecimento_cliente_id")}
                onChange={(e) => {
                  setField("abastecimento_cliente_id", e.target.value);
                  setField("abastecimento_socio_id", "");
                }}
                className={selectClass}
              >
                <option value="">Cliente do voo anterior</option>
                {opcoes.clientes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome || item.proprietario || "Sem nome"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pagador sócio">
              <select
                value={value("abastecimento_socio_id")}
                onChange={(e) => {
                  setField("abastecimento_socio_id", e.target.value);
                  setField("abastecimento_cliente_id", "");
                }}
                className={selectClass}
              >
                <option value="">Sócio do voo anterior</option>
                {opcoes.socios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comanda">
              <input
                value={value("abastecimento_numero_comanda")}
                onChange={(e) =>
                  setField("abastecimento_numero_comanda", e.target.value)
                }
                className={inputClass}
              />
            </Field>
            <Field label="Nota fiscal">
              <input
                value={value("abastecimento_numero_nf")}
                onChange={(e) =>
                  setField("abastecimento_numero_nf", e.target.value)
                }
                className={inputClass}
              />
            </Field>
          </div>}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <TextField
              label="Ocorrências"
              value={value("ocorrencias")}
              onChange={(v) => setField("ocorrencias", v)}
            />
            <TextField
              label="Discrepâncias"
              value={value("discrepancias")}
              onChange={(v) => setField("discrepancias", v)}
            />
            <TextField
              label="Ações corretivas"
              value={value("acoes_corretivas")}
              onChange={(v) => setField("acoes_corretivas", v)}
            />
          </div>
        </FormSection>
        <div className="sticky bottom-0 -mx-3 -mb-3 flex flex-col-reverse items-stretch justify-end gap-2 border-t border-white/[.08] bg-[#0d1521]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:flex-row sm:items-center sm:px-5 sm:py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-9 w-full border-white/[.12] bg-white/[.03] text-xs text-slate-300 hover:bg-white/[.08] hover:text-white sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="h-9 w-full gap-2 rounded-lg bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 sm:w-auto"
          >
            <Save size={13} />
            {saving
              ? "Salvando..."
              : initialData
                ? "Atualizar lançamento"
                : "Registrar lançamento"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FormSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[.07] bg-[#0d1521]/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-cyan-300">
        <span>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  );
}
function DurationField({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Field label={`${label} ·`}>
      <input
        type="time"
        step="60"
        value={decimalToHoursMinutes(value)}
        readOnly={readOnly}
        onChange={(e) => onChange?.(hoursMinutesToDecimal(e.target.value))}
        className={readOnly ? `${inputClass} cursor-not-allowed opacity-70` : inputClass}
      />
    </Field>
  );
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[76px] w-full resize-y rounded-xl border border-white/[.1] bg-white/[.04] px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
        placeholder="Sem registro"
      />
    </Field>
  );
}
function TimerIcon() {
  return <span className="font-mono text-[11px]">T</span>;
}
