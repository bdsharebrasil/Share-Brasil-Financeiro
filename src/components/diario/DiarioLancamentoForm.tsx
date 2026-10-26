import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Fuel,
  Loader2,
  PlaneTakeoff,
  Save,
  Users,
  X,
} from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import {
  buscarAbastecimentos,
  buscarNumerosVooAeronave,
  type Abastecimento,
  type DiarioLancamento,
  type DiarioOpcoesResponse,
  type NumeroVooJornada,
  type NumeroVooPerna,
} from "@/lib/colaborador-api";

type FormValues = Record<string, string | boolean>;

type Props = {
  aeronaveId: string;
  consumoCombustivel?: number | string | null;
  diarioMesId: string;
  opcoes: DiarioOpcoesResponse;
  initialData?: DiarioLancamento | null;
  sugestaoTrecho?: string;
  temDiaria?: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

type TimeField = "tempo_ac" | "tempo_dep" | "tempo_pou" | "tempo_cor";

type VooOpcao = {
  solicitacao_id: string;
  numero_voo?: string | null;
  data_agendada?: string | null;
  origem?: string | null;
  destino?: string | null;
  cliente_id?: string | null;
  socio_id?: string | null;
  voo_emprestado?: string | number | boolean | null;
  cliente_emprestimo_id?: string | null;
  socio_emprestimo_id?: string | null;
  pic_canac?: string | null;
  pic_nome?: string | null;
  sic_canac?: string | null;
  sic_nome?: string | null;
  jornadas?: NumeroVooJornada[] | null;
};

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

const inputClass = "db-input";

const comboClass =
  "db-combo h-12 w-full min-w-0 rounded-2xl border-white/10 " +
  "bg-white/[.04] text-left text-base font-normal text-slate-100";

const timeKeys: TimeField[] = [
  "tempo_ac",
  "tempo_dep",
  "tempo_pou",
  "tempo_cor",
];

const timestampKeys: Record<TimeField, string> = {
  tempo_ac: "acionamento_utc",
  tempo_dep: "decolagem_utc",
  tempo_pou: "pouso_utc",
  tempo_cor: "corte_utc",
};

const texto = (value: unknown) => String(value ?? "");

const valor = (form: FormValues, key: string) => texto(form[key]);

const normalizarNumeroVoo = (value: unknown) =>
  texto(value).trim().replace(/\s+/g, "").toUpperCase();

function formatDateShort(value?: string | null) {
  if (!value) return "Sem data";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}` : "Sem data";
}

function formatLitros(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Litros não informados";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? `${number.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })} L`
    : "Litros não informados";
}

function decimalToHoursMinutes(value: string) {
  if (!value.trim()) return "";

  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  const minutes = Math.max(0, Math.round(number * 60));

  return [
    String(Math.floor(minutes / 60)).padStart(2, "0"),
    String(minutes % 60).padStart(2, "0"),
  ].join(":");
}

function hoursMinutesToDecimal(value: string) {
  if (!value.trim()) return "";

  const match = value.trim().match(/^(\d{1,3})(?::([0-5]\d))?$/);
  if (!match) return null;

  return (Number(match[1]) + Number(match[2] || 0) / 60).toFixed(2);
}

function checkinBeforeAc(time?: string | null) {
  if (!time || !/^\d{2}:\d{2}/.test(time)) return "";

  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const total = (hours * 60 + minutes - 30 + 1440) % 1440;

  return [
    String(Math.floor(total / 60)).padStart(2, "0"),
    String(total % 60).padStart(2, "0"),
  ].join(":");
}

const timestampUtc = (data: string, hora: string) =>
  data && hora
    ? `${data}T${hora.length === 5 ? `${hora}:00` : hora}Z`
    : null;

function diferencaHoras(inicio: string, fim: string) {
  if (!inicio || !fim) return 0;

  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);

  if (![hi, mi, hf, mf].every(Number.isFinite)) return 0;

  let minutes = hf * 60 + mf - (hi * 60 + mi);
  if (minutes < 0) minutes += 1440;

  return minutes / 60;
}

/* Mantém as regras de cálculo utilizadas pelo componente original. */
function camposCalculadosDosTempos(
  form: FormValues,
  consumoCombustivel: Props["consumoCombustivel"],
): FormValues {
  const tempoVoo =
    valor(form, "tempo_dep") && valor(form, "tempo_pou")
      ? diferencaHoras(valor(form, "tempo_dep"), valor(form, "tempo_pou"))
      : null;

  const tempoTotal =
    valor(form, "tempo_ac") && valor(form, "tempo_cor")
      ? diferencaHoras(valor(form, "tempo_ac"), valor(form, "tempo_cor"))
      : null;

  const consumo = Number(consumoCombustivel || 0);
  const campos: FormValues = {};

  if (tempoVoo !== null) {
    campos.tempo_voo = tempoVoo.toFixed(2);
    campos.horas_diurnas = tempoVoo.toFixed(2);
    campos.consumo_combustivel_voo = (tempoVoo * consumo).toFixed(2);
  }

  if (tempoTotal !== null || tempoVoo !== null) {
    const total = tempoTotal ?? tempoVoo ?? 0;

    campos.tempo_total = total.toFixed(2);
    campos.consumo_combustivel_total = (total * consumo).toFixed(2);
  }

  if (tempoVoo !== null && !form.horas_noturnas_manual) {
    campos.horas_noturnas = "0.00";
  }

  return campos;
}

function formFromEntry(
  entry: Partial<DiarioLancamento> | undefined,
  date: string,
  sugestaoTrecho = "",
): FormValues {
  const extra = entry as
    | (Partial<DiarioLancamento> & Record<string, unknown>)
    | undefined;

  const natureza = entry?.natureza_voo || "PV - Privado";
  const rateioIgual =
    natureza === "TR - Traslado" || natureza === "VT - Voo Teste";

  const dataRegistro = entry?.data_registro?.slice(0, 10) || date;

  return {
    data_registro: dataRegistro,
    numero_voo: entry?.numero_voo || "",
    jornada_id: texto(extra?.jornada_id),
    perna_jornada_id: texto(extra?.perna_jornada_id),

    acionamento_utc:
      entry?.acionamento_utc ||
      timestampUtc(dataRegistro, entry?.tempo_ac?.slice(0, 5) || "") ||
      "",
    decolagem_utc:
      entry?.decolagem_utc ||
      timestampUtc(dataRegistro, entry?.tempo_dep?.slice(0, 5) || "") ||
      "",
    pouso_utc:
      entry?.pouso_utc ||
      timestampUtc(dataRegistro, entry?.tempo_pou?.slice(0, 5) || "") ||
      "",
    corte_utc:
      entry?.corte_utc ||
      timestampUtc(dataRegistro, entry?.tempo_cor?.slice(0, 5) || "") ||
      "",

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
    cliente_tomador_emprestimo_id:
      entry?.cliente_tomador_emprestimo_id || "",
    socio_tomador_emprestimo_id: entry?.socio_tomador_emprestimo_id || "",

    tripulacao_checkin_hora: checkinBeforeAc(entry?.tempo_ac),
    tempo_ac: entry?.tempo_ac?.slice(0, 5) || "",
    tempo_dep: entry?.tempo_dep?.slice(0, 5) || "",
    tempo_pou: entry?.tempo_pou?.slice(0, 5) || "",
    tempo_cor: entry?.tempo_cor?.slice(0, 5) || "",

    tempo_ifr: texto(entry?.tempo_ifr),
    tempo_voo: texto(entry?.tempo_voo),
    tempo_total: texto(entry?.tempo_total),
    horas_diurnas: texto(entry?.horas_diurnas),
    horas_noturnas: texto(entry?.horas_noturnas),
    horas_noturnas_manual: false,

    consumo_combustivel_voo: texto(extra?.consumo_combustivel_voo),
    consumo_combustivel_total: texto(extra?.consumo_combustivel_total),

    pousos_total: texto(entry?.pousos_total ?? 1),
    distancia_nm: texto(entry?.distancia_nm),
    passageiros: texto(entry?.passageiros ?? 0),
    carga_kg: texto(entry?.carga_kg),
    diarias: texto(entry?.diarias ?? 0),

    litros_combustivel_inicio_voo: texto(
      entry?.litros_combustivel_inicio_voo,
    ),
    litros_combustivel_abastecido: texto(
      entry?.litros_combustivel_abastecido,
    ),
    local_combustivel: entry?.local_combustivel || "",

    abastecido: Boolean(extra?.abastecido || extra?.abastecimento_id),
    abastecimento_id: texto(extra?.abastecimento_id),
    abastecimento_litros: texto(
      extra?.abastecimento_litros ??
        entry?.litros_combustivel_abastecido,
    ),
    abastecimento_data:
      texto(extra?.abastecimento_data).slice(0, 10) || dataRegistro,
    abastecimento_cliente_id: texto(extra?.abastecimento_cliente_id),
    abastecimento_socio_id: texto(extra?.abastecimento_socio_id),
    abastecimento_local:
      texto(extra?.abastecimento_local) || entry?.local_combustivel || "",
    abastecimento_numero_comanda: texto(
      extra?.abastecimento_numero_comanda,
    ),
    abastecimento_numero_nf: texto(extra?.abastecimento_numero_nf),

    ocorrencias: entry?.ocorrencias || "",
    discrepancias: entry?.discrepancias || "",
    acoes_corretivas: entry?.acoes_corretivas || "",
  };
}

function dadosAbastecimento(item: Abastecimento): FormValues {
  return {
    abastecimento_id: item.id,
    abastecimento_litros: texto(item.litros),
    abastecimento_local: item.local || "",
    abastecimento_data: item.data?.slice(0, 10) || "",
    abastecimento_cliente_id: item.cliente_id || "",
    abastecimento_socio_id: item.socio_id || "",
    abastecimento_numero_comanda: item.numero_comanda || "",
    abastecimento_numero_nf: item.numero_nf || "",
  };
}

function labelAbastecimento(item: Abastecimento) {
  return [
    formatDateShort(item.data),
    item.local || item.fornecedor_nome || "Local não informado",
    formatLitros(item.litros),
    item.numero_comanda ? `Comanda ${item.numero_comanda}` : "",
    item.numero_nf ? `NF ${item.numero_nf}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function DiarioLancamentoForm({
  aeronaveId,
  consumoCombustivel,
  diarioMesId,
  opcoes,
  initialData,
  sugestaoTrecho,
  temDiaria,
  onSubmit,
  onCancel,
  saving,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const submitLock = useRef(false);

  const [form, setForm] = useState<FormValues>(() =>
    formFromEntry(
      initialData || undefined,
      new Date().toISOString().slice(0, 10),
      sugestaoTrecho,
    ),
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [voos, setVoos] = useState<VooOpcao[]>([]);
  const [voosError, setVoosError] = useState("");
  const [voosLoading, setVoosLoading] = useState(true);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState("");

  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [abastecimentosError, setAbastecimentosError] = useState("");
  const [abastecimentosLoading, setAbastecimentosLoading] = useState(true);
  const [abastecimentosReload, setAbastecimentosReload] = useState(0);
  const [abastecimentoModo, setAbastecimentoModo] = useState<
    "existente" | "novo"
  >("existente");

  const busy = saving || submitting;
  const value = (key: string) => valor(form, key);

  const setField = (key: string, next: string | boolean) => {
    setForm((current) => ({ ...current, [key]: next }));
    setError(null);
  };

  useEffect(() => {
    setForm(
      formFromEntry(
        initialData || undefined,
        new Date().toISOString().slice(0, 10),
        sugestaoTrecho,
      ),
    );
    setSolicitacaoSelecionada("");
    setAbastecimentoModo("existente");
    setError(null);
  }, [initialData, diarioMesId, aeronaveId, sugestaoTrecho]);

  useEffect(() => {
    let active = true;

    setVoos([]);
    setVoosError("");
    setVoosLoading(true);

    void buscarNumerosVooAeronave(aeronaveId)
      .then((response) => {
        if (active) setVoos(response.voos || []);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        setVoosError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os voos.",
        );
      })
      .finally(() => {
        if (active) setVoosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [aeronaveId]);

  useEffect(() => {
    let active = true;

    setAbastecimentos([]);
    setAbastecimentosError("");
    setAbastecimentosLoading(true);

    void buscarAbastecimentos({ aeronave_id: aeronaveId })
      .then((response) => {
        if (active) {
          setAbastecimentos(response.abastecimentos || []);
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;

        setAbastecimentosError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os abastecimentos.",
        );
      })
      .finally(() => {
        if (active) setAbastecimentosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [aeronaveId, abastecimentosReload]);

  /* Recupera os dados do abastecimento já vinculado durante uma edição. */
  useEffect(() => {
    const entry = initialData as
      | (DiarioLancamento & { abastecimento_id?: string | null })
      | null
      | undefined;

    const linkedId = entry?.abastecimento_id;
    if (!linkedId) return;

    const item = abastecimentos.find((fuel) => fuel.id === linkedId);
    if (!item) return;

    setForm((current) =>
      valor(current, "abastecimento_id") === linkedId
        ? { ...current, ...dadosAbastecimento(item) }
        : current,
    );
  }, [abastecimentos, initialData]);

  useEffect(() => {
    if (solicitacaoSelecionada || !form.numero_voo) return;

    const item = voos.find(
      (voo) =>
        normalizarNumeroVoo(voo.numero_voo) ===
        normalizarNumeroVoo(form.numero_voo),
    );

    if (item) setSolicitacaoSelecionada(item.solicitacao_id);
  }, [voos, solicitacaoSelecionada, form.numero_voo]);

  const tripulacao = opcoes.tripulantes;

  const selectedPic = tripulacao.find(
    (item) =>
      texto(item.canac).toUpperCase() === value("pic_canac").toUpperCase(),
  );

  const selectedSic = tripulacao.find(
    (item) =>
      texto(item.canac).toUpperCase() === value("sic_canac").toUpperCase(),
  );

  const rateioIgual =
    value("natureza_voo") === "TR - Traslado" ||
    value("natureza_voo") === "VT - Voo Teste";

  const cotistaSelecionado = value("holding_id")
    ? `holding:${value("holding_id")}`
    : value("cliente_id");

  const vooSelecionado = useMemo(
    () =>
      voos.find(
        (voo) => voo.solicitacao_id === solicitacaoSelecionada,
      ) ||
      voos.find(
        (voo) =>
          normalizarNumeroVoo(voo.numero_voo) ===
          normalizarNumeroVoo(form.numero_voo),
      ),
    [voos, solicitacaoSelecionada, form.numero_voo],
  );

  const jornadas = useMemo(
    () => vooSelecionado?.jornadas || [],
    [vooSelecionado],
  );

  const jornada = jornadas.find(
    (item) => item.jornada_id === value("jornada_id"),
  );

  const pernas = useMemo(
    () => (jornada?.pernas || []) as NumeroVooPerna[],
    [jornada],
  );

  const pernasDisponiveis = useMemo(
    () =>
      pernas.filter(
        (item) =>
          !item.lancamento_diario_id ||
          item.perna_id === form.perna_jornada_id,
      ),
    [pernas, form.perna_jornada_id],
  );

  const perna = pernas.find(
    (item) => item.perna_id === value("perna_jornada_id"),
  );

  const aerodromos = useMemo(
    () =>
      opcoes.aerodromos.map((item) => ({
        id: item.designativo,
        label: `${item.designativo} · ${item.nome}`,
      })),
    [opcoes.aerodromos],
  );

  const montarTrecho = useCallback(
    (origem: string, destino: string) => {
      const nome = (icao: string) =>
        opcoes.aerodromos.find((item) => item.designativo === icao)
          ?.nome || icao;

      return `${nome(origem)} (${origem}) X ${nome(destino)} (${destino})`;
    },
    [opcoes.aerodromos],
  );

  const aplicarPerna = useCallback(
    (id: string) => {
      const item = pernasDisponiveis.find(
        (candidate) => candidate.perna_id === id,
      );
      if (!item) return;

      const hhmm = (iso?: string | null) =>
        iso ? iso.slice(11, 16) : "";

      setForm((current) => {
        const next: FormValues = {
          ...current,
          perna_jornada_id: id,
          aerodromo_partida: item.origem,
          aerodromo_chegada: item.destino,
          trecho: montarTrecho(item.origem, item.destino),
          tempo_ac: hhmm(item.horario_ac),
          tempo_dep: hhmm(item.horario_dep),
          tempo_pou: hhmm(item.horario_pouso),
          tempo_cor: hhmm(item.horario_corte),
          acionamento_utc: item.horario_ac || "",
          decolagem_utc: item.horario_dep || "",
          pouso_utc: item.horario_pouso || "",
          corte_utc: item.horario_corte || "",
          passageiros: texto(item.numero_passageiros ?? 0),
          horas_noturnas_manual: false,
          pousos_total: item.horario_pouso ? "1" : "0",
          distancia_nm: texto(item.distancia_nm || 0),
          data_registro:
            (item.horario_ac || jornada?.data || "").slice(0, 10) ||
            valor(current, "data_registro"),
        };

        const calculados = camposCalculadosDosTempos(
          next,
          consumoCombustivel,
        );

        const tempoVoo =
          Number(item.tempo_voo) > 0
            ? Number(item.tempo_voo)
            : Number(calculados.tempo_voo || 0);

        const tempoTotal =
          Number(item.tempo_total) > 0
            ? Number(item.tempo_total)
            : Number(calculados.tempo_total || tempoVoo);

        return {
          ...next,
          ...calculados,
          tempo_voo: tempoVoo.toFixed(2),
          tempo_total: tempoTotal.toFixed(2),
          horas_diurnas: Number(
            item.horas_diurnas ?? calculados.horas_diurnas ?? 0,
          ).toFixed(2),
          horas_noturnas: Number(item.horas_noturnas ?? 0).toFixed(2),
          consumo_combustivel_voo:
            Number(item.consumo_combustivel_voo) > 0
              ? Number(item.consumo_combustivel_voo).toFixed(2)
              : (tempoVoo * Number(consumoCombustivel || 0)).toFixed(2),
          consumo_combustivel_total:
            Number(item.consumo_combustivel_total) > 0
              ? Number(item.consumo_combustivel_total).toFixed(2)
              : (tempoTotal * Number(consumoCombustivel || 0)).toFixed(2),
        };
      });
    },
    [pernasDisponiveis, jornada?.data, consumoCombustivel, montarTrecho],
  );

  useEffect(() => {
    if (!solicitacaoSelecionada || form.jornada_id) return;
    if (jornadas.length !== 1) return;

    setForm((current) => ({
      ...current,
      jornada_id: jornadas[0].jornada_id,
    }));
  }, [solicitacaoSelecionada, form.jornada_id, jornadas]);

  useEffect(() => {
    if (!form.jornada_id || form.perna_jornada_id) return;
    if (pernasDisponiveis.length !== 1) return;

    aplicarPerna(pernasDisponiveis[0].perna_id);
  }, [
    form.jornada_id,
    form.perna_jornada_id,
    pernasDisponiveis,
    aplicarPerna,
  ]);

  const clientesSocios = useMemo(
    () =>
      opcoes.socios.filter((socio) =>
        form.holding_id
          ? socio.holding_id === form.holding_id
          : !form.cliente_id || socio.cliente_id === form.cliente_id,
      ),
    [opcoes.socios, form.cliente_id, form.holding_id],
  );

  const clientesItems = useMemo(
    () =>
      opcoes.clientes.map((item) => ({
        id: item.id,
        label: [
          item.nome || item.proprietario || "Sem nome",
          item.codigo_cliente,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [opcoes.clientes],
  );

  const sociosItems = useMemo(
    () =>
      opcoes.socios.map((item) => ({
        id: item.id,
        label: item.nome,
      })),
    [opcoes.socios],
  );

  const tripulantesItems = useMemo(
    () =>
      tripulacao.map((item) => ({
        id: item.canac,
        label: [
          item.nome_completo,
          item.canac,
          item.origem,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [tripulacao],
  );

  const abastecimentosDisponiveis = useMemo(
    () =>
      abastecimentos
        .filter(
          (item) =>
            !item.lancamento_diario_id ||
            item.id === form.abastecimento_id,
        )
        .sort((a, b) =>
          texto(b.data).localeCompare(texto(a.data)),
        ),
    [abastecimentos, form.abastecimento_id],
  );

  const abastecimentoSelecionado = abastecimentos.find(
    (item) => item.id === value("abastecimento_id"),
  );

  const alterarTempo = (campo: TimeField, nextValue: string) => {
    setForm((current) => {
      const next = { ...current, [campo]: nextValue };

      if (campo === "tempo_ac") {
        next.tripulacao_checkin_hora = checkinBeforeAc(nextValue);
      }

      next[timestampKeys[campo]] =
        timestampUtc(valor(next, "data_registro"), nextValue) || "";

      return {
        ...next,
        ...camposCalculadosDosTempos(next, consumoCombustivel),
      };
    });

    setError(null);
  };

  const atualizarAerodromo = (
    campo: "aerodromo_partida" | "aerodromo_chegada",
    icao: string,
  ) => {
    setForm((current) => {
      const next = { ...current, [campo]: icao };
      const origem = valor(next, "aerodromo_partida");
      const destino = valor(next, "aerodromo_chegada");

      if (origem && destino) {
        next.trecho = montarTrecho(origem, destino);
      }

      return next;
    });
  };

  const selecionarTripulante = (
    prefixo: "pic" | "sic",
    id: string,
    label: string,
  ) => {
    const item = tripulacao.find(
      (candidate) =>
        texto(candidate.canac).toUpperCase() === id.toUpperCase(),
    );

    const partes = (label || id).split(" · ");

    setForm((current) => ({
      ...current,
      [`${prefixo}_canac`]: item?.canac || partes[1] || id,
      [`${prefixo}_nome`]: item?.nome_completo || partes[0] || "",
    }));
  };

  const aplicarVoo = (id: string) => {
    const voo = voos.find((item) => item.solicitacao_id === id);
    if (!voo) return;

    setSolicitacaoSelecionada(id);

    setForm((current) => ({
      ...current,
      numero_voo: voo.numero_voo || "",
      cliente_id: voo.cliente_id || "",
      socio_id: voo.socio_id || "",
      holding_id: "",
      data_registro:
        voo.data_agendada?.slice(0, 10) ||
        valor(current, "data_registro"),
      aerodromo_partida: voo.origem || "",
      aerodromo_chegada: voo.destino || "",
      trecho:
        voo.origem && voo.destino
          ? montarTrecho(voo.origem, voo.destino)
          : valor(current, "trecho"),
      voo_emprestado:
        voo.voo_emprestado === "sim" ||
        voo.voo_emprestado === 1 ||
        voo.voo_emprestado === true,
      cliente_tomador_emprestimo_id:
        voo.cliente_emprestimo_id || "",
      socio_tomador_emprestimo_id: voo.socio_emprestimo_id || "",
      pic_canac: voo.pic_canac || "",
      pic_nome: voo.pic_nome || "",
      sic_canac: voo.sic_canac || "",
      sic_nome: voo.sic_nome || "",
      jornada_id: "",
      perna_jornada_id: "",
    }));
  };

  const selecionarNumeroVoo = (id: string) => {
    const voo =
      voos.find((item) => item.solicitacao_id === id) ||
      voos.find(
        (item) =>
          normalizarNumeroVoo(item.numero_voo) ===
          normalizarNumeroVoo(id),
      );

    if (voo) {
      aplicarVoo(voo.solicitacao_id);
      return;
    }

    setSolicitacaoSelecionada("");
    setForm((current) => ({
      ...current,
      numero_voo: id,
      jornada_id: "",
      perna_jornada_id: "",
    }));
  };

  const selecionarAbastecimento = (id: string) => {
    const item = abastecimentos.find((candidate) => candidate.id === id);

    if (!item) {
      setForm((current) => ({
        ...current,
        abastecimento_id: "",
        abastecimento_litros: "",
        abastecimento_local: "",
        abastecimento_data: valor(current, "data_registro"),
        abastecimento_cliente_id: "",
        abastecimento_socio_id: "",
        abastecimento_numero_comanda: "",
        abastecimento_numero_nf: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      ...dadosAbastecimento(item),
      abastecido: true,
    }));
  };

  const mudarModoAbastecimento = (modo: "existente" | "novo") => {
    if (modo === abastecimentoModo) return;

    selecionarAbastecimento("");
    setAbastecimentoModo(modo);
  };

  const navegar = (section: string) => {
    const target = rootRef.current?.querySelector<HTMLElement>(
      `[data-section="${section}"]`,
    );

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const mostrarErro = (message: string) => {
    setError(message);

    requestAnimationFrame(() => {
      const alert = rootRef.current?.querySelector<HTMLElement>(
        "[data-form-error]",
      );
      alert?.focus();
      alert?.scrollIntoView({ block: "nearest" });
    });
  };

  const submit = async () => {
    if (saving || submitLock.current) return;

    setError(null);

    if (
      !value("data_registro") ||
      !value("aerodromo_partida") ||
      !value("aerodromo_chegada") ||
      !value("pic_canac") ||
      !value("natureza_voo")
    ) {
      mostrarErro("Informe data, origem, destino, PIC e natureza do voo.");
      return;
    }

    const controls = rootRef.current?.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("input, textarea");

    if (controls) {
      for (const control of controls) {
        if (!control.checkValidity()) {
          control.reportValidity();
          control.focus();
          return;
        }
      }
    }

    const number = (key: string) =>
      value(key) === "" ? 0 : Number(value(key));

    if (Boolean(form.abastecido)) {
      if (
        abastecimentoModo === "existente" &&
        !value("abastecimento_id")
      ) {
        mostrarErro(
          "Selecione um abastecimento existente ou escolha Novo abastecimento.",
        );
        return;
      }

      if (
        abastecimentoModo === "novo" &&
        (!Number.isFinite(number("abastecimento_litros")) ||
          number("abastecimento_litros") <= 0)
      ) {
        mostrarErro("Informe uma quantidade de litros maior que zero.");
        return;
      }

      if (abastecimentosLoading && value("abastecimento_id")) {
        mostrarErro("Aguarde o carregamento do abastecimento vinculado.");
        return;
      }
    }

    /* Preserva os nomes e a estrutura esperados pelo backend. */
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
      socio_tomador_emprestimo_id:
        value("socio_tomador_emprestimo_id") || null,

      tripulacao_checkin_hora: value("tripulacao_checkin_hora") || null,
      acionamento_utc: timestampUtc(
        value("data_registro"),
        value("tempo_ac"),
      ),
      decolagem_utc: timestampUtc(
        value("data_registro"),
        value("tempo_dep"),
      ),
      pouso_utc: timestampUtc(
        value("data_registro"),
        value("tempo_pou"),
      ),
      corte_utc: timestampUtc(
        value("data_registro"),
        value("tempo_cor"),
      ),

      tempo_ifr: number("tempo_ifr"),
      horas_diurnas: number("horas_diurnas"),
      ...(Boolean(form.horas_noturnas_manual)
        ? { horas_noturnas: number("horas_noturnas") }
        : {}),
      pousos_total: number("pousos_total"),
      distancia_nm: number("distancia_nm"),
      litros_combustivel_inicio_voo: number(
        "litros_combustivel_inicio_voo",
      ),

      abastecimento_id: Boolean(form.abastecido)
        ? value("abastecimento_id") || null
        : null,
      litros_combustivel_abastecido: Boolean(form.abastecido)
        ? number("abastecimento_litros")
        : 0,
      local_combustivel: Boolean(form.abastecido)
        ? value("abastecimento_local") || null
        : null,
      abastecido: Boolean(form.abastecido),

      diarias: temDiaria ? number("diarias") : null,
      passageiros: number("passageiros"),
      carga_kg: value("carga_kg") || null,
      ocorrencias: value("ocorrencias") || null,
      discrepancias: value("discrepancias") || null,
      acoes_corretivas: value("acoes_corretivas") || null,

      abastecimento:
        Boolean(form.abastecido) &&
        !value("abastecimento_id") &&
        number("abastecimento_litros") > 0
          ? {
              litros: number("abastecimento_litros"),
              data:
                value("abastecimento_data") || value("data_registro"),
              cliente_id: value("abastecimento_cliente_id") || null,
              socio_id: value("abastecimento_socio_id") || null,
              local:
                value("abastecimento_local") ||
                value("local_combustivel") ||
                value("aerodromo_partida"),
              trecho:
                `${value("aerodromo_partida").toUpperCase()} X ` +
                value("aerodromo_chegada").toUpperCase(),
              numero_comanda:
                value("abastecimento_numero_comanda") || null,
              numero_nf: value("abastecimento_numero_nf") || null,
            }
          : null,
    };

    if (
      Object.values(payload).some(
        (item) => typeof item === "number" && !Number.isFinite(item),
      )
    ) {
      mostrarErro("Revise os campos numéricos do lançamento.");
      return;
    }

    submitLock.current = true;
    setSubmitting(true);

    try {
      await onSubmit(payload);
    } catch (cause: unknown) {
      mostrarErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o lançamento. Tente novamente.",
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const rotaPreenchida =
    Boolean(form.aerodromo_partida) &&
    Boolean(form.aerodromo_chegada) &&
    Boolean(form.data_registro) &&
    Boolean(form.natureza_voo);

  const temposPreenchidos = timeKeys.every((key) => Boolean(form[key]));

  const abastecimentoExistente =
    Boolean(form.abastecimento_id) &&
    abastecimentoModo === "existente";

  return (
    <section
      ref={rootRef}
      className="db-entry"
      aria-label={initialData ? "Editar lançamento de voo" : "Novo lançamento de voo"}
      aria-busy={busy}
    >
      <style>{styles}</style>

      <header className="db-header">
        <div className="db-heading">
          <div className="db-app-icon" aria-hidden="true">
            <BookOpen size={22} strokeWidth={1.6} />
          </div>

          <div>
            <p className="db-eyebrow">Operação aérea</p>
            <h2>{initialData ? "Editar lançamento" : "Novo lançamento"}</h2>
            <p className="db-subtitle">Diário de bordo digital</p>
          </div>
        </div>

        <button
          type="button"
          className="db-close"
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancelar e fechar lançamento"
        >
          <X size={19} />
        </button>
      </header>

      <div className="db-overview">
        <div className="db-route-preview">
          <div>
            <span className="db-caption">Origem</span>
            <strong>{value("aerodromo_partida") || "————"}</strong>
          </div>

          <div className="db-route-line" aria-hidden="true">
            <span />
            <PlaneTakeoff size={21} strokeWidth={1.6} />
            <span />
          </div>

          <div className="db-route-destination">
            <span className="db-caption">Destino</span>
            <strong>{value("aerodromo_chegada") || "————"}</strong>
          </div>
        </div>

        <div className="db-route-meta">
          <span>
            {value("numero_voo")
              ? `Voo ${value("numero_voo")}`
              : "Lançamento de voo"}
          </span>
          <span>{formatDateShort(value("data_registro"))}</span>
          <span className="db-utc-badge">UTC / Zulu</span>
        </div>
      </div>

      <nav className="db-nav" aria-label="Seções do lançamento">
        {[
          {
            key: "voo",
            label: "Voo e rota",
            ready: rotaPreenchida,
          },
          {
            key: "tripulacao",
            label: "Tripulação",
            ready: Boolean(form.pic_canac),
          },
          {
            key: "tempos",
            label: "Tempos",
            ready: temposPreenchidos,
          },
          {
            key: "combustivel",
            label: "Combustível",
            ready:
              !form.abastecido ||
              Boolean(form.abastecimento_id) ||
              Number(form.abastecimento_litros) > 0,
          },
        ].map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navegar(item.key)}
            disabled={busy}
            className="db-nav-item"
          >
            <span
              className={`db-nav-number ${item.ready ? "is-ready" : ""}`}
            >
              {item.ready ? <Check size={12} /> : index + 1}
            </span>
            <span>{item.label}</span>
            <ArrowRight size={13} className="db-nav-arrow" />
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="db-alert db-alert-error"
          role="alert"
          tabIndex={-1}
          data-form-error
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {voosError && (
        <div className="db-alert db-alert-warning" role="status">
          <AlertCircle size={18} />
          <span>
            {voosError} Você pode informar o número do voo manualmente.
          </span>
        </div>
      )}

      <fieldset disabled={busy} className="db-body">
        <FormSection
          section="voo"
          number="01"
          icon={<PlaneTakeoff size={19} />}
          title="Voo e rota"
          description="Identificação do voo e aeródromos da operação."
          badge="Dados do voo"
        >
          <div className="db-grid">
            <Field label="Data do voo" required>
              <input
                type="date"
                lang="pt-BR"
                required
                value={value("data_registro")}
                onChange={(event) =>
                  setField("data_registro", event.target.value)
                }
                className={inputClass}
              />
            </Field>

            <Field label="Número do voo">
              <SearchableCombobox
                items={voos.map((voo) => ({
                  id: voo.solicitacao_id,
                  label: [
                    voo.numero_voo || "Voo sem número",
                    formatDateShort(voo.data_agendada),
                    voo.origem && voo.destino
                      ? `${voo.origem} → ${voo.destino}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                value={solicitacaoSelecionada || value("numero_voo")}
                selectedLabel={
                  vooSelecionado?.numero_voo || value("numero_voo")
                }
                onChange={selecionarNumeroVoo}
                placeholder={
                  voosLoading ? "Carregando voos..." : "Buscar ou digitar"
                }
                searchPlaceholder="Número, rota ou data..."
                emptyMessage="Nenhum voo encontrado. Você pode digitar o número."
                clearable
                allowFreeText
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Jornada">
              <SearchableCombobox
                items={[...jornadas]
                  .sort(
                    (a, b) =>
                      Number(a.numero_jornada) - Number(b.numero_jornada),
                  )
                  .map((item) => ({
                    id: item.jornada_id,
                    label: [
                      `Jornada ${item.numero_jornada}`,
                      formatDateShort(item.data),
                      item.status,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                value={value("jornada_id")}
                selectedLabel={
                  jornada ? `Jornada ${jornada.numero_jornada}` : ""
                }
                onChange={(id) =>
                  setForm((current) => ({
                    ...current,
                    jornada_id: id,
                    perna_jornada_id: "",
                  }))
                }
                disabled={!jornadas.length}
                placeholder={
                  jornadas.length ? "Selecionar jornada" : "Selecione o voo"
                }
                searchPlaceholder="Buscar jornada ou data..."
                emptyMessage="Nenhuma jornada disponível."
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Trecho da jornada">
              <SearchableCombobox
                items={pernasDisponiveis.map((item) => ({
                  id: item.perna_id,
                  label:
                    `${item.numero}. ${item.origem} → ${item.destino}` +
                    (item.lancamento_diario_id ? " · já lançado" : ""),
                }))}
                value={value("perna_jornada_id")}
                onChange={aplicarPerna}
                disabled={!jornada}
                placeholder={jornada ? "Selecionar trecho" : "Selecione a jornada"}
                searchPlaceholder="Buscar trecho ou ICAO..."
                emptyMessage="Nenhum trecho disponível."
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Origem ICAO" required>
              <SearchableCombobox
                items={aerodromos}
                value={value("aerodromo_partida")}
                onChange={(id) =>
                  atualizarAerodromo("aerodromo_partida", id)
                }
                placeholder="Aeródromo de partida"
                searchPlaceholder="Buscar nome ou ICAO..."
                emptyMessage="Nenhum aeródromo encontrado."
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Destino ICAO" required>
              <SearchableCombobox
                items={aerodromos}
                value={value("aerodromo_chegada")}
                onChange={(id) =>
                  atualizarAerodromo("aerodromo_chegada", id)
                }
                placeholder="Aeródromo de chegada"
                searchPlaceholder="Buscar nome ou ICAO..."
                emptyMessage="Nenhum aeródromo encontrado."
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Natureza do voo" required>
              <SearchableCombobox
                items={naturezas.map((item) => ({
                  id: item,
                  label: item,
                }))}
                value={value("natureza_voo")}
                onChange={(id) =>
                  setForm((current) => ({
                    ...current,
                    natureza_voo: id,
                    ...(id === "TR - Traslado" || id === "VT - Voo Teste"
                      ? {
                          cliente_id: "",
                          holding_id: "",
                          socio_id: "",
                        }
                      : {}),
                  }))
                }
                placeholder="Selecionar natureza"
                searchPlaceholder="Buscar natureza..."
                emptyMessage="Nenhuma natureza encontrada."
                className={comboClass}
              />
            </Field>

            <Field label="Descrição do trecho">
              <input
                value={value("trecho")}
                onChange={(event) =>
                  setField("trecho", event.target.value)
                }
                placeholder="Descrição da rota"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="db-subgroup">
            <div className="db-grid db-grid-small">
              <NumberField
                label="Passageiros"
                value={value("passageiros")}
                onChange={(next) => setField("passageiros", next)}
                step="1"
              />
              <NumberField
                label="Carga"
                unit="kg"
                value={value("carga_kg")}
                onChange={(next) => setField("carga_kg", next)}
                step="0.01"
              />
              <NumberField
                label="Distância"
                unit="NM"
                value={value("distancia_nm")}
                onChange={(next) => setField("distancia_nm", next)}
                step="0.1"
              />
            </div>
          </div>

          {perna?.lancamento_diario_id && (
            <p className="db-note">
              Este trecho já possui um lançamento no diário.
            </p>
          )}
        </FormSection>

        <FormSection
          section="tripulacao"
          number="02"
          icon={<Users size={19} />}
          title="Tripulação e cotista"
          description="Responsáveis pela operação e identificação do cotista."
        >
          <div className="db-grid">
            <Field label="Comandante · PIC" required>
              <SearchableCombobox
                items={tripulantesItems}
                value={value("pic_canac")}
                selectedLabel={
                  [
                    value("pic_nome") || selectedPic?.nome_completo,
                    value("pic_canac"),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
                onChange={(id, label) =>
                  selecionarTripulante("pic", id, label)
                }
                placeholder="Selecionar ou digitar PIC"
                searchPlaceholder="Buscar nome ou CANAC..."
                emptyMessage="Nenhum tripulante encontrado."
                allowFreeText
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Copiloto · SIC">
              <SearchableCombobox
                items={tripulantesItems}
                value={value("sic_canac")}
                selectedLabel={
                  [
                    value("sic_nome") || selectedSic?.nome_completo,
                    value("sic_canac"),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }
                onChange={(id, label) =>
                  selecionarTripulante("sic", id, label)
                }
                placeholder="Selecionar ou digitar SIC"
                searchPlaceholder="Buscar nome ou CANAC..."
                emptyMessage="Nenhum tripulante encontrado."
                allowFreeText
                clearable
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            <Field label="Cliente / cotista">
              <SearchableCombobox
                items={[
                  ...clientesItems,
                  ...opcoes.holdings.map((item) => ({
                    id: `holding:${item.id}`,
                    label: [
                      `Holding · ${item.nome}`,
                      item.proprietario,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  })),
                ]}
                value={rateioIgual ? "" : cotistaSelecionado}
                disabled={rateioIgual}
                onChange={(id) =>
                  setForm((current) => ({
                    ...current,
                    holding_id: id.startsWith("holding:")
                      ? id.slice(8)
                      : "",
                    cliente_id: id.startsWith("holding:") ? "" : id,
                    socio_id: "",
                  }))
                }
                placeholder={
                  rateioIgual ? "Rateio igual entre cotistas" : "Selecionar cotista"
                }
                searchPlaceholder="Buscar cliente ou holding..."
                emptyMessage="Nenhum cotista encontrado."
                wrapItemLabels
                className={comboClass}
              />
            </Field>

            {Boolean(form.holding_id) && !rateioIgual && (
              <Field label="Sócio cotista">
                <SearchableCombobox
                  items={clientesSocios.map((item) => ({
                    id: item.id,
                    label: item.nome,
                  }))}
                  value={value("socio_id")}
                  onChange={(id) => setField("socio_id", id)}
                  placeholder="Selecionar sócio"
                  searchPlaceholder="Buscar sócio..."
                  emptyMessage="Nenhum sócio encontrado."
                  clearable
                  wrapItemLabels
                  className={comboClass}
                />
              </Field>
            )}
          </div>

          {rateioIgual && (
            <div className="db-inline-info">
              <Users size={16} />
              <span>Rateio igual entre cotistas para esta natureza de voo.</span>
            </div>
          )}

          <ToggleRow
            title="Voo emprestado"
            description="Identificar o cliente ou sócio tomador."
            checked={Boolean(form.voo_emprestado)}
            onChange={(checked) => setField("voo_emprestado", checked)}
          />

          {Boolean(form.voo_emprestado) && (
            <div className="db-grid db-reveal">
              <Field label="Cliente tomador">
                <SearchableCombobox
                  items={clientesItems}
                  value={value("cliente_tomador_emprestimo_id")}
                  onChange={(id) =>
                    setForm((current) => ({
                      ...current,
                      cliente_tomador_emprestimo_id: id,
                      socio_tomador_emprestimo_id: "",
                    }))
                  }
                  placeholder="Selecionar cliente"
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente encontrado."
                  clearable
                  wrapItemLabels
                  className={comboClass}
                />
              </Field>

              <Field label="Sócio tomador">
                <SearchableCombobox
                  items={sociosItems}
                  value={value("socio_tomador_emprestimo_id")}
                  onChange={(id) =>
                    setField("socio_tomador_emprestimo_id", id)
                  }
                  placeholder="Selecionar sócio"
                  searchPlaceholder="Buscar sócio..."
                  emptyMessage="Nenhum sócio encontrado."
                  clearable
                  wrapItemLabels
                  className={comboClass}
                />
              </Field>
            </div>
          )}
        </FormSection>

        <FormSection
          section="tempos"
          number="03"
          icon={<Clock size={19} />}
          title="Tempos operacionais"
          description="Registre os horários na sequência da operação."
          badge="UTC / Zulu"
        >
          <div className="db-time-grid">
            {[
              {
                key: "tripulacao_checkin_hora",
                label: "Apresentação",
                detail: "Tripulação",
              },
              { key: "tempo_ac", label: "Acionamento", detail: "AC" },
              { key: "tempo_dep", label: "Decolagem", detail: "DEP" },
              { key: "tempo_pou", label: "Pouso", detail: "POU" },
              { key: "tempo_cor", label: "Corte", detail: "COR" },
            ].map((item, index) => (
              <label className="db-time-card" key={item.key}>
                <span className="db-time-card-heading">
                  <span className="db-time-index">{index + 1}</span>
                  <span>{item.detail}</span>
                </span>
                <span className="db-time-label">{item.label}</span>
                <input
                  type="time"
                  step="60"
                  value={value(item.key)}
                  onChange={(event) =>
                    item.key === "tripulacao_checkin_hora"
                      ? setField(item.key, event.target.value)
                      : alterarTempo(
                          item.key as TimeField,
                          event.target.value,
                        )
                  }
                  aria-label={`${item.label} em UTC`}
                  className="db-time-input"
                />
              </label>
            ))}
          </div>

          <div className="db-duration-summary">
            <Metric
              label="Tempo de voo"
              value={decimalToHoursMinutes(value("tempo_voo")) || "—"}
              unit="h:min"
            />
            <Metric
              label="Tempo total"
              value={decimalToHoursMinutes(value("tempo_total")) || "—"}
              unit="h:min"
            />
            <Metric
              label="Horas diurnas"
              value={decimalToHoursMinutes(value("horas_diurnas")) || "—"}
              unit="h:min"
            />
          </div>

          <div className="db-grid">
            <DurationField
              label="Horas noturnas"
              value={value("horas_noturnas")}
              onChange={(next) =>
                setForm((current) => ({
                  ...current,
                  horas_noturnas: next,
                  horas_noturnas_manual: true,
                }))
              }
            />

            <DurationField
              label="Tempo IFR"
              value={value("tempo_ifr")}
              onChange={(next) => setField("tempo_ifr", next)}
            />

            <NumberField
              label="Quantidade de pousos"
              value={value("pousos_total")}
              onChange={(next) => setField("pousos_total", next)}
              step="1"
            />

            {temDiaria && (
              <NumberField
                label="Quantidade de diárias"
                value={value("diarias")}
                onChange={(next) => setField("diarias", next)}
                step="1"
              />
            )}
          </div>
        </FormSection>

        <FormSection
          section="combustivel"
          number="04"
          icon={<Fuel size={19} />}
          title="Combustível"
          description="Quantidade inicial, consumo e abastecimento da operação."
        >
          <div className="db-grid db-grid-small">
            <NumberField
              label="Combustível no início"
              unit="L"
              value={value("litros_combustivel_inicio_voo")}
              onChange={(next) =>
                setField("litros_combustivel_inicio_voo", next)
              }
              step="0.01"
            />

            <Field label="Consumo de voo" hint="Calculado">
              <div className="db-input-unit">
                <input
                  value={value("consumo_combustivel_voo")}
                  readOnly
                  placeholder="—"
                  className={inputClass}
                />
                <span>L</span>
              </div>
            </Field>

            <Field label="Consumo total" hint="Calculado">
              <div className="db-input-unit">
                <input
                  value={value("consumo_combustivel_total")}
                  readOnly
                  placeholder="—"
                  className={inputClass}
                />
                <span>L</span>
              </div>
            </Field>
          </div>

          <ToggleRow
            title="Houve abastecimento"
            description="Vincule um registro existente ou informe um novo."
            checked={Boolean(form.abastecido)}
            onChange={(checked) => setField("abastecido", checked)}
          />

          {Boolean(form.abastecido) && (
            <div className="db-fuel-panel db-reveal">
              <div className="db-segmented" role="group" aria-label="Abastecimento">
                <button
                  type="button"
                  aria-pressed={abastecimentoModo === "existente"}
                  className={
                    abastecimentoModo === "existente" ? "is-active" : ""
                  }
                  onClick={() => mudarModoAbastecimento("existente")}
                >
                  Vincular existente
                </button>
                <button
                  type="button"
                  aria-pressed={abastecimentoModo === "novo"}
                  className={
                    abastecimentoModo === "novo" ? "is-active" : ""
                  }
                  onClick={() => mudarModoAbastecimento("novo")}
                >
                  Novo abastecimento
                </button>
              </div>

              {abastecimentoModo === "existente" ? (
                <>
                  {abastecimentosError && (
                    <div className="db-alert db-alert-warning" role="status">
                      <AlertCircle size={17} />
                      <div>
                        <span>{abastecimentosError}</span>
                        <button
                          type="button"
                          className="db-text-button"
                          onClick={() =>
                            setAbastecimentosReload((current) => current + 1)
                          }
                        >
                          Tentar novamente
                        </button>
                      </div>
                    </div>
                  )}

                  <Field
                    label="Selecionar abastecimento"
                    hint={
                      abastecimentosLoading
                        ? "Carregando..."
                        : `${abastecimentosDisponiveis.length} disponíveis`
                    }
                  >
                    <SearchableCombobox
                      items={abastecimentosDisponiveis.map((item) => ({
                        id: item.id,
                        label: labelAbastecimento(item),
                      }))}
                      value={value("abastecimento_id")}
                      selectedLabel={
                        abastecimentoSelecionado
                          ? labelAbastecimento(abastecimentoSelecionado)
                          : value("abastecimento_id")
                            ? [
                                formatDateShort(value("abastecimento_data")),
                                value("abastecimento_local"),
                                formatLitros(value("abastecimento_litros")),
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : ""
                      }
                      onChange={selecionarAbastecimento}
                      disabled={abastecimentosLoading}
                      placeholder={
                        abastecimentosLoading
                          ? "Carregando abastecimentos..."
                          : "Buscar abastecimento"
                      }
                      searchPlaceholder="Data, local, fornecedor, litros ou comanda..."
                      emptyMessage="Nenhum abastecimento disponível para vincular."
                      clearable
                      wrapItemLabels
                      className={comboClass}
                    />
                  </Field>

                  {abastecimentoExistente && (
                    <div className="db-fuel-selected">
                      <div className="db-fuel-selected-top">
                        <span className="db-fuel-icon">
                          <Fuel size={20} />
                        </span>
                        <div className="db-fuel-selected-title">
                          <strong>
                            {value("abastecimento_local") ||
                              abastecimentoSelecionado?.fornecedor_nome ||
                              "Abastecimento selecionado"}
                          </strong>
                          <span>
                            {abastecimentoSelecionado?.fornecedor_nome ||
                              "Registro vinculado à operação"}
                          </span>
                        </div>
                        <span className="db-linked-badge">
                          <Check size={12} />
                          Vinculado
                        </span>
                      </div>

                      <div className="db-fuel-selected-data">
                        <Metric
                          label="Data"
                          value={formatDateShort(
                            value("abastecimento_data"),
                          )}
                        />
                        <Metric
                          label="Quantidade"
                          value={formatLitros(
                            value("abastecimento_litros"),
                          )}
                        />
                        <Metric
                          label="Comanda"
                          value={value("abastecimento_numero_comanda") || "—"}
                        />
                        <Metric
                          label="Nota fiscal"
                          value={value("abastecimento_numero_nf") || "—"}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="db-grid">
                  <NumberField
                    label="Litros abastecidos"
                    unit="L"
                    value={value("abastecimento_litros")}
                    onChange={(next) =>
                      setField("abastecimento_litros", next)
                    }
                    step="0.01"
                  />

                  <Field label="Data do abastecimento">
                    <input
                      type="date"
                      lang="pt-BR"
                      value={value("abastecimento_data")}
                      onChange={(event) =>
                        setField("abastecimento_data", event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Local do abastecimento">
                    <input
                      value={value("abastecimento_local")}
                      onChange={(event) =>
                        setField("abastecimento_local", event.target.value)
                      }
                      placeholder="ICAO ou posto"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Comanda">
                    <input
                      value={value("abastecimento_numero_comanda")}
                      onChange={(event) =>
                        setField(
                          "abastecimento_numero_comanda",
                          event.target.value,
                        )
                      }
                      placeholder="Número da comanda"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Nota fiscal">
                    <input
                      value={value("abastecimento_numero_nf")}
                      onChange={(event) =>
                        setField(
                          "abastecimento_numero_nf",
                          event.target.value,
                        )
                      }
                      placeholder="Número da nota"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Pagador · cliente">
                    <SearchableCombobox
                      items={clientesItems}
                      value={value("abastecimento_cliente_id")}
                      onChange={(id) =>
                        setForm((current) => ({
                          ...current,
                          abastecimento_cliente_id: id,
                          abastecimento_socio_id: "",
                        }))
                      }
                      placeholder="Cliente do voo anterior"
                      searchPlaceholder="Buscar cliente..."
                      emptyMessage="Nenhum cliente encontrado."
                      clearable
                      wrapItemLabels
                      className={comboClass}
                    />
                  </Field>

                  <Field label="Pagador · sócio">
                    <SearchableCombobox
                      items={sociosItems}
                      value={value("abastecimento_socio_id")}
                      onChange={(id) =>
                        setForm((current) => ({
                          ...current,
                          abastecimento_socio_id: id,
                          abastecimento_cliente_id: "",
                        }))
                      }
                      placeholder="Sócio do voo anterior"
                      searchPlaceholder="Buscar sócio..."
                      emptyMessage="Nenhum sócio encontrado."
                      clearable
                      wrapItemLabels
                      className={comboClass}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
        </FormSection>

        <FormSection
          section="registros"
          number="05"
          icon={<BookOpen size={19} />}
          title="Registros da operação"
          description="Ocorrências, discrepâncias e ações corretivas."
        >
          <div className="db-notes-grid">
            <TextField
              label="Ocorrências"
              value={value("ocorrencias")}
              onChange={(next) => setField("ocorrencias", next)}
              placeholder="Descreva as ocorrências do voo"
            />
            <TextField
              label="Discrepâncias"
              value={value("discrepancias")}
              onChange={(next) => setField("discrepancias", next)}
              placeholder="Descreva as discrepâncias identificadas"
            />
            <TextField
              label="Ações corretivas"
              value={value("acoes_corretivas")}
              onChange={(next) => setField("acoes_corretivas", next)}
              placeholder="Informe as ações realizadas"
            />
          </div>
        </FormSection>
      </fieldset>

      <footer className="db-footer">
        <div className="db-footer-info" aria-live="polite">
          <span className="db-footer-dot" />
          <span>
            {busy
              ? "Salvando lançamento..."
              : initialData
                ? "Edição do lançamento"
                : "Novo registro operacional"}
          </span>
        </div>

        <div className="db-footer-actions">
          <button
            type="button"
            className="db-button db-button-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="db-button db-button-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={18} className="db-spinner" />
            ) : (
              <Save size={18} />
            )}
            <span>
              {busy
                ? "Salvando..."
                : initialData
                  ? "Salvar alterações"
                  : "Registrar lançamento"}
            </span>
          </button>
        </div>
      </footer>
    </section>
  );
}

function FormSection({
  section,
  number,
  icon,
  title,
  description,
  badge,
  children,
}: {
  section: string;
  number: string;
  icon: ReactNode;
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="db-section"
      data-section={section}
      aria-label={title}
    >
      <header className="db-section-header">
        <div className="db-section-heading">
          <span className="db-section-icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <div className="db-section-title-row">
              <span className="db-section-number">{number}</span>
              <h3>{title}</h3>
            </div>
            {description && <p>{description}</p>}
          </div>
        </div>
        {badge && <span className="db-section-badge">{badge}</span>}
      </header>

      <div className="db-section-content">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="db-field">
      <span className="db-field-heading">
        <span className="db-field-label">
          {label}
          {required && <span className="db-required"> *</span>}
        </span>
        {hint && <span className="db-field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = "0.01",
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <div className={unit ? "db-input-unit" : undefined}>
        <input
          type="number"
          inputMode={step === "1" ? "numeric" : "decimal"}
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className={inputClass}
        />
        {unit && <span>{unit}</span>}
      </div>
    </Field>
  );
}

function DurationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const formatted = decimalToHoursMinutes(value);
  const [draft, setDraft] = useState(formatted);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(formatted);
    inputRef.current?.setCustomValidity("");
  }, [formatted]);

  const commit = (input: HTMLInputElement) => {
    const decimal = hoursMinutesToDecimal(draft);

    if (decimal === null) {
      input.setCustomValidity("Informe a duração em horas e minutos: HH:MM.");
      return;
    }

    input.setCustomValidity("");
    onChange(decimal);
    setDraft(decimalToHoursMinutes(decimal));
  };

  return (
    <Field label={label} hint="h:min">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder="00:00"
        aria-label={`${label} em horas e minutos`}
        className={inputClass}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 5);
          const next =
            digits.length > 2
              ? `${digits.slice(0, -2)}:${digits.slice(-2)}`
              : digits;

          setDraft(next);
          event.target.setCustomValidity("");

          const decimal = hoursMinutesToDecimal(next);

          if (decimal !== null && (next.includes(":") || !next)) {
            onChange(decimal);
          } else if (decimal === null) {
            event.target.setCustomValidity(
              "Informe uma duração válida em horas e minutos.",
            );
          }
        }}
        onBlur={(event) => commit(event.currentTarget)}
      />
    </Field>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="db-textarea"
      />
    </Field>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="db-toggle-row">
      <span className="db-toggle-copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>

      <span className="db-switch">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={title}
        />
        <span className="db-switch-track" />
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="db-metric">
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
    </div>
  );
}

const styles = `
.db-entry {
  --db-bg: #0b121c;
  --db-surface: #111c29;
  --db-input-bg: #172230;
  --db-border: rgba(195, 213, 235, .11);
  --db-text: #f1f5fa;
  --db-muted: #94a5b9;
  --db-accent: #7bc7ef;
  --db-focus: rgba(123, 199, 239, .18);
  container-name: diario;
  container-type: inline-size;
  position: relative;
  isolation: isolate;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid var(--db-border);
  border-radius: 24px;
  background: #050911;
  color: var(--db-text);
  color-scheme: dark;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 24px 70px rgba(0,0,0,.2);
}
.db-entry *, .db-entry *::before, .db-entry *::after {
  box-sizing: border-box;
}
.db-entry button, .db-entry input, .db-entry textarea {
  font: inherit;
}
.db-entry button {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.db-entry button:disabled {
  cursor: not-allowed;
  opacity: .5;
}
.db-entry button:focus-visible,
.db-entry input:focus-visible,
.db-entry textarea:focus-visible {
  outline: 2px solid var(--db-accent);
  outline-offset: 3px;
}
.db-entry p, .db-entry h2, .db-entry h3 {
  margin: 0;
}
.db-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0 20px;
}
.db-heading {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}
.db-app-icon {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(123,199,239,.2);
  border-radius: 16px;
  color: #b6e4ff;
  background: linear-gradient(145deg, #233c50, #142131);
}
.db-entry .db-eyebrow {
  margin-bottom: 4px;
  color: var(--db-accent);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .13em;
  text-transform: uppercase;
}
.db-entry h2 {
  font-size: 21px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -.65px;
}
.db-entry .db-subtitle {
  margin-top: 5px;
  color: var(--db-muted);
  font-size: 12px;
  line-height: 1.5;
}
.db-close {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--db-border);
  border-radius: 50%;
  background: rgba(255,255,255,.04);
  color: #b8c7d8;
  cursor: pointer;
}
.db-overview {
  min-width: 0;
  padding: 20px;
  border: 1px solid rgba(139,183,222,.14);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 50% 0, rgba(80,145,190,.13), transparent 75%),
    #111d2a;
}
.db-route-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.db-route-preview > div {
  min-width: 0;
}
.db-caption {
  display: block;
  margin-bottom: 6px;
  color: #9bb0c6;
  font-size: 11px;
}
.db-route-preview strong {
  font-size: clamp(23px, 6cqi, 34px);
  font-weight: 550;
  line-height: 1;
  letter-spacing: -.8px;
  overflow-wrap: anywhere;
}
.db-route-destination {
  text-align: right;
}
.db-route-line {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 260px;
  gap: 10px;
  color: var(--db-accent);
}
.db-route-line span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #46677f);
}
.db-route-line span:last-child {
  transform: rotate(180deg);
}
.db-route-line svg {
  flex-shrink: 0;
}
.db-route-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 19px;
  padding-top: 14px;
  border-top: 1px solid var(--db-border);
  color: #a9bbcd;
  font-size: 12px;
}
.db-utc-badge {
  margin-left: auto;
  padding: 4px 8px;
  border-radius: 7px;
  background: rgba(123,199,239,.09);
  color: #b7dff4;
  font-size: 10px;
  font-weight: 650;
}
.db-nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 16px 0 20px;
}
.db-nav-item {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 44px;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--db-border);
  border-radius: 12px;
  background: rgba(255,255,255,.025);
  color: #c9d6e4;
  font-size: 11px !important;
  text-align: left;
  cursor: pointer;
}
.db-nav-number {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  height: 22px;
  border-radius: 7px;
  background: #202d3c;
  color: #9aacc0;
  font-size: 10px;
}
.db-nav-number.is-ready {
  background: rgba(102,198,171,.13);
  color: #88d9bd;
}
.db-nav-arrow {
  margin-left: auto;
  flex-shrink: 0;
  color: #6c8096;
}
.db-body {
  display: grid;
  min-width: 0;
  width: 100%;
  gap: 16px;
  margin: 0;
  padding: 0;
  border: 0;
}
.db-section {
  min-width: 0;
  border: 1px solid var(--db-border);
  border-radius: 20px;
  background: var(--db-surface);
  scroll-margin-top: 20px;
}
.db-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid rgba(195,213,235,.07);
  background: rgba(2,17,34,1);
  border-radius: 18px;
  overflow: hidden;
}
.db-section:first-of-type > .db-section-header {
  margin-left: 0;
  margin-right: 0;
  padding-left: 25px;
  padding-right: 25px;
}
.db-section-heading {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 11px;
}
.db-section-icon {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  border-radius: 11px;
  background: rgba(123,199,239,.08);
  color: #a8d8f1;
}
.db-section-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 20px;
}
.db-section-number {
  color: #6e849b;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.db-entry h3 {
  color: #e6eef7;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -.15px;
}
.db-section-heading p {
  margin-top: 4px;
  max-width: 440px;
  color: var(--db-muted);
  font-size: 11px;
  line-height: 1.65;
}
.db-section-badge {
  padding: 5px 8px;
  border: 1px solid rgba(123,199,239,.14);
  border-radius: 7px;
  color: #9dbed5;
  font-size: 10px;
  white-space: nowrap;
}
.db-section-content {
  min-width: 0;
  padding: 18px;
}
.db-grid, .db-notes-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 17px 14px;
  min-width: 0;
}
.db-field {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  gap: 8px;
}
.db-field-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  min-width: 0;
  gap: 4px 8px;
}
.db-field-label {
  color: #c0cddd;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}
.db-required {
  color: #82c3e8;
}
.db-field-hint {
  color: #7f93a9;
  font-size: 10px;
  line-height: 1.4;
}
.db-entry .db-input,
.db-entry .db-combo,
.db-entry .db-textarea {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  border: 1px solid rgba(195,213,235,.12);
  border-radius: 13px;
  background: var(--db-input-bg);
  color: var(--db-text);
  font-size: 16px;
  font-weight: 400;
  box-shadow: 0 1px 0 rgba(255,255,255,.015) inset;
  transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.db-entry .db-input,
.db-entry .db-combo {
  height: 50px;
  min-height: 50px;
  padding: 0 13px;
}
.db-entry .db-combo {
  text-align: left;
}
.db-entry .db-combo > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-entry .db-combo svg {
  flex-shrink: 0;
}
.db-entry .db-input::placeholder,
.db-entry .db-textarea::placeholder {
  color: #718398;
  opacity: 1;
}
.db-entry .db-input:focus,
.db-entry .db-textarea:focus,
.db-entry .db-combo:focus-visible,
.db-entry .db-combo[data-state="open"] {
  outline: none;
  border-color: rgba(123,199,239,.65);
  background: #1a2a3b;
  box-shadow: 0 0 0 3px var(--db-focus);
}
.db-entry .db-input[readonly] {
  background: rgba(255,255,255,.025);
  color: #a7bbcf;
}
.db-entry input[type="date"],
.db-entry input[type="time"] {
  -webkit-appearance: none;
  appearance: none;
  min-width: 0;
}
.db-entry input::-webkit-date-and-time-value {
  min-height: 1.25em;
  text-align: left;
}
.db-entry input::-webkit-calendar-picker-indicator {
  opacity: .55;
  cursor: pointer;
}
.db-entry input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
.db-entry input::-webkit-inner-spin-button,
.db-entry input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.db-input-unit {
  position: relative;
  width: 100%;
  min-width: 0;
}
.db-input-unit .db-input {
  padding-right: 46px;
}
.db-input-unit > span {
  position: absolute;
  right: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: #7f94ab;
  font-size: 11px;
  pointer-events: none;
}
.db-subgroup {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(195,213,235,.08);
}
.db-note {
  margin-top: 14px !important;
  color: #e6c58c;
  font-size: 12px;
  line-height: 1.6;
}
.db-inline-info {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 11px;
  background: rgba(123,199,239,.06);
  color: #a5cbe0;
  font-size: 12px;
  line-height: 1.6;
}
.db-inline-info svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.db-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 68px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid rgba(195,213,235,.08);
  cursor: pointer;
}
.db-toggle-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.db-toggle-copy strong {
  color: #d9e3ef;
  font-size: 13px;
  font-weight: 550;
}
.db-toggle-copy > span {
  color: #8b9eb3;
  font-size: 11px;
  line-height: 1.6;
}
.db-switch {
  position: relative;
  display: block;
  flex: 0 0 50px;
  width: 50px;
  height: 32px;
}
.db-switch input {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.db-switch-track {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 99px;
  background: #344153;
  transition: background .2s ease;
}
.db-switch-track::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f8fafc;
  box-shadow: 0 2px 4px rgba(0,0,0,.24);
  transition: transform .2s ease;
}
.db-switch input:checked + .db-switch-track {
  background: #3c967c;
}
.db-switch input:checked + .db-switch-track::after {
  transform: translateX(18px);
}
.db-switch input:focus-visible + .db-switch-track {
  outline: 2px solid var(--db-accent);
  outline-offset: 4px;
}
.db-reveal {
  margin-top: 18px;
  animation: db-reveal .18s ease-out;
}
.db-time-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.db-time-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(105px, 1fr);
  align-items: center;
  gap: 4px 12px;
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--db-border);
  border-radius: 14px;
  background: rgba(255,255,255,.02);
}
.db-time-card-heading {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  color: #8fa5bd;
  font-size: 9px;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.db-time-index {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: rgba(123,199,239,.08);
  color: #a5c9e2;
  font-size: 9px;
}
.db-time-label {
  grid-column: 1;
  color: #c2d0df;
  font-size: 12px;
}
.db-entry .db-time-input {
  grid-column: 2;
  grid-row: 1 / 3;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 46px;
  padding: 0 10px;
  border: 1px solid var(--db-border);
  border-radius: 10px;
  background: var(--db-input-bg);
  color: #f1f7fc;
  font-size: 18px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.db-duration-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  margin: 18px 0 20px;
  padding: 16px;
  border: 1px solid rgba(123,199,239,.12);
  border-radius: 15px;
  background: rgba(123,199,239,.045);
}
.db-metric {
  display: grid;
  min-width: 0;
  gap: 7px;
}
.db-metric > span {
  color: #8fa5bd;
  font-size: 10px;
  line-height: 1.5;
}
.db-metric > strong {
  color: #dcebf7;
  font-size: 18px;
  font-weight: 550;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.db-metric small {
  margin-left: 6px;
  color: #8097ae;
  font-size: 10px;
  font-weight: 400;
}
.db-fuel-panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(123,199,239,.12);
  border-radius: 16px;
  background: #0d1824;
}
.db-segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  border: 1px solid rgba(195,213,235,.06);
  border-radius: 12px;
  background: #09121d;
}
.db-segmented button {
  min-width: 0;
  min-height: 44px;
  padding: 9px 6px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #8ea1b7;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
}
.db-segmented button.is-active {
  background: #223448;
  color: #e8f3fb;
  box-shadow: 0 2px 6px rgba(0,0,0,.15);
}
.db-fuel-selected {
  margin-top: 16px;
  padding: 15px;
  border: 1px solid rgba(112,193,167,.19);
  border-radius: 14px;
  background: rgba(80,155,131,.045);
}
.db-fuel-selected-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  gap: 10px;
}
.db-fuel-icon {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  height: 38px;
  border-radius: 11px;
  background: rgba(112,193,167,.1);
  color: #9ed9c5;
}
.db-fuel-selected-title {
  display: grid;
  flex: 1;
  min-width: 100px;
  gap: 4px;
}
.db-fuel-selected-title strong {
  color: #d8e9e3;
  font-size: 13px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.db-fuel-selected-title > span {
  color: #8aafa1;
  font-size: 10px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.db-linked-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 7px;
  border-radius: 7px;
  background: rgba(112,193,167,.08);
  color: #98cdb9;
  font-size: 9px;
}
.db-fuel-selected-data {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  margin-top: 15px;
  padding-top: 14px;
  border-top: 1px solid rgba(112,193,167,.1);
}
.db-fuel-selected-data .db-metric > strong {
  font-size: 14px;
}
.db-entry .db-textarea {
  display: block;
  min-height: 112px;
  padding: 13px;
  line-height: 1.65;
  resize: vertical;
}
.db-alert {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 10px;
  margin-bottom: 16px;
  padding: 13px 14px;
  border: 1px solid;
  border-radius: 13px;
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.db-alert > svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.db-alert-error {
  border-color: rgba(245,143,143,.24);
  background: rgba(195,76,76,.08);
  color: #f2b8b8;
}
.db-alert-warning {
  border-color: rgba(215,178,103,.24);
  background: rgba(190,144,51,.06);
  color: #dac69d;
}
.db-text-button {
  display: block;
  min-height: 36px;
  margin-top: 4px;
  padding: 5px 0;
  border: 0;
  background: transparent;
  color: #c3ddf2;
  font-size: 12px !important;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.db-footer {
  position: sticky;
  z-index: 10;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 13px 0 -22px;
  padding: 30px 28px;
  padding-bottom: max(30px, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--db-border);
  border-radius: 0 0 24px 24px;
  background: rgba(12,21,32,1);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}
.db-footer-info {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #8298af;
  font-size: 10px;
}
.db-footer-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6e9aaf;
}
.db-footer-actions {
  display: grid;
  grid-template-columns: minmax(78px, .65fr) minmax(0, 1.65fr);
  width: 100%;
  gap: 9px;
}
.db-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 48px;
  gap: 8px;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: 13px;
  font-size: 12px !important;
  font-weight: 600 !important;
  line-height: 1.4;
  cursor: pointer;
  transition: background .16s ease, transform .16s ease;
}
.db-button svg {
  flex-shrink: 0;
}
.db-button-primary {
  background: #b6dcf1;
  color: #102536;
  border-color: #c5e5f6;
  box-shadow: 0 3px 10px rgba(123,199,239,.08);
}
.db-button-secondary {
  border-color: var(--db-border);
  background: rgba(255,255,255,.025);
  color: #aebed0;
}
.db-spinner {
  animation: db-spin 1s linear infinite;
}
@container diario (min-width: 320px) {
  .db-duration-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .db-fuel-selected-data {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container diario (min-width: 460px) {
  .db-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .db-time-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .db-time-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 9px;
  }
  .db-time-card:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
  .db-time-label {
    font-size: 11px;
  }
}
@container diario (min-width: 680px) {
  .db-nav {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .db-grid-small {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .db-section-header,
  .db-section-content {
    padding: 22px;
  }
  .db-entry .db-input,
  .db-entry .db-combo,
  .db-entry .db-textarea {
    font-size: 14px;
  }
  .db-section-heading p {
    font-size: 12px;
  }
  .db-footer-actions {
    display: flex;
    width: auto;
    margin-left: auto;
  }
  .db-button {
    padding-left: 18px;
    padding-right: 18px;
    font-size: 13px !important;
  }
  .db-fuel-selected-data {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .db-segmented {
    max-width: 400px;
  }
}
@container diario (min-width: 880px) {
  .db-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .db-grid-small {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .db-time-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .db-time-card:last-child:nth-child(odd) {
    grid-column: auto;
  }
  .db-notes-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .db-fuel-panel .db-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (hover: hover) {
  .db-nav-item:hover,
  .db-close:hover,
  .db-button-secondary:hover {
    background: rgba(255,255,255,.065);
  }
  .db-button-primary:hover {
    background: #cbe8f8;
  }
}
@media (prefers-reduced-motion: reduce) {
  .db-entry *,
  .db-entry *::before,
  .db-entry *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
@keyframes db-spin {
  to { transform: rotate(360deg); }
}
@keyframes db-reveal {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
