import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Info,
  ImagePlus,
  Loader2,
  Plane,
  ReceiptText,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizarPagador,
  useCalculadoraRelatorio,
} from "@/hooks/useCalculadoraRelatorio";
import type {
  Despesa,
  FiltroDespesas,
} from "@/hooks/useCalculadoraRelatorio";

type TipoAcao = "aprovar" | "rejeitar" | null;

type Anexo = {
  id: string;
  relatorio_despesa_viagem_id?: string;
  indice_despesa?: number | string;
  nome_arquivo?: string | null;
  caminho_arquivo?: string | null;
  url_arquivo: string;
  tipo_arquivo?: string | null;
  tamanho_arquivo?: number | string | null;
  criado_em?: string | null;
};

type Relatorio = {
  id: string;
  numero_relatorio?: string | null;
  numero_voo?: string | null;
  aeronave_matricula?: string | null;
  matricula_aeronave?: string | null;
  rota?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  quantidade_dias?: number | null;
  nome_tripulante?: string | null;
  nome_tripulante_2?: string | null;
  despesas?: Despesa[] | string | null;
  anexos?: Anexo[] | null;
  status?: string | null;
  pdf_url?: string | null;
  status_aprovacao_tripulante?: string | null;
  status_aprovacao_tripulante_2?: string | null;
  aprovado_tripulante_em?: string | null;
  aprovado_tripulante_1_em?: string | null;
  aprovado_tripulante_2_em?: string | null;
  contas_apagar_tripulante_1_id?: string | null;
  contas_apagar_tripulante_2_id?: string | null;
  motivo_reprovacao_tripulante_1?: string | null;
  motivo_reprovacao_tripulante_2?: string | null;
  observacoes_aprovacao_tripulante?: string | null;
  observacoes_aprovacao_tripulante_2?: string | null;
};

type ApprovalData = {
  relatorio: Relatorio;
  resumo?: {
    total_a_receber?: number | string;
    cliente_pagou?: number | string;
    share_brasil_pagou?: number | string;
  };
  tripulante_pos: 1 | 2;
};

type ComprovanteSelecionado = Anexo & {
  indice: number;
  descricaoDespesa: string;
};

const ROTULOS_FILTRO: Record<Exclude<FiltroDespesas, "total">, string> = {
  tripulante: "Você",
  cliente: "Cliente",
  sharebrasil: "Share Brasil",
  outros: "Outras despesas",
};

function moeda(valor: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function dataBr(valor: unknown) {
  const partes = String(valor || "").slice(0, 10).split("-");
  if (partes.length !== 3 || partes.some((item) => !item)) return "—";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataHoraBr(valor: unknown) {
  const normalizado = String(valor || "").trim().replace("T", " ");
  const [data, hora] = normalizado.split(" ");
  if (!data || !hora) return dataBr(valor);
  return `${dataBr(data)} às ${hora.slice(0, 5)}`;
}

function nomePagador(valor: unknown) {
  const pagador = normalizarPagador(valor);
  if (pagador === "cliente") return "Cliente";
  if (pagador === "sharebrasil") return "Share Brasil";
  if (pagador === "tripulante_2") return "Tripulante 2";
  if (pagador === "tripulante_1") return "Tripulante 1";
  return "Não informado";
}

function parseDespesas(valor: Relatorio["despesas"]): Despesa[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== "string") return [];
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function buscarAprovacaoPublica(token: string): Promise<ApprovalData> {
  const response = await fetch(
    `${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`,
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || json?.error || "Link inválido ou expirado.");
  }
  return json as ApprovalData;
}

function isImagem(anexo: Anexo) {
  return String(anexo.tipo_arquivo || "").toLowerCase().startsWith("image/");
}

function isPdf(anexo: Anexo) {
  return (
    String(anexo.tipo_arquivo || "").toLowerCase() === "application/pdf" ||
    String(anexo.nome_arquivo || "").toLowerCase().endsWith(".pdf")
  );
}

function statusLegivel(status: unknown) {
  const valor = String(status || "").toLowerCase();
  if (valor === "aprovado") return "Aprovado";
  if (valor === "reprovado" || valor === "rejeitado") return "Reprovado";
  if (valor === "nao_aplicavel") return "Não aplicável";
  return "Pendente";
}

function categoriaClasse(categoria: unknown) {
  const valor = String(categoria || "").toLowerCase();
  if (valor.includes("hosped")) {
    return "border-violet-400/20 bg-violet-400/10 text-violet-200";
  }
  if (valor.includes("aliment")) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  if (valor.includes("transport")) {
    return "border-sky-400/20 bg-sky-400/10 text-sky-200";
  }
  if (valor.includes("combust")) {
    return "border-slate-400/20 bg-slate-400/10 text-foreground dark:text-slate-200";
  }
  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-border dark:border-white/10 bg-card dark:bg-card shadow-[0_18px_60px_rgba(0,0,0,0.24)] ${className}`}
    >
      {children}
    </section>
  );
}

function TituloSecao({
  icon,
  titulo,
  subtitulo,
}: {
  icon: ReactNode;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border dark:border-white/10 px-4 py-4 sm:px-5">
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-sky-200">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold tracking-tight text-white sm:text-base">
          {titulo}
        </h2>
        {subtitulo ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-slate-400">
            {subtitulo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AprovacaoRelatorioViagem() {
  const token = useMemo(
    () => {
      const fragmento = window.location.hash.slice(1);
      const tokenDoFragmento = new URLSearchParams(fragmento).get("token") || fragmento;
      return new URLSearchParams(window.location.search).get("token") ||
        tokenDoFragmento ||
        window.location.pathname.split("/").filter(Boolean).pop() ||
        "";
    },
    [],
  );

  const [data, setData] = useState<ApprovalData | null>(null);
  const [mensagem, setMensagem] = useState("Carregando relatório...");
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [acao, setAcao] = useState<TipoAcao>(null);
  const [motivo, setMotivo] = useState("");
  const [imagemRejeicao, setImagemRejeicao] = useState<File | null>(null);
  const [imagemRejeicaoPreview, setImagemRejeicaoPreview] = useState("");
  const [chegouAoFim, setChegouAoFim] = useState(false);
  const [comprovanteSelecionado, setComprovanteSelecionado] =
    useState<ComprovanteSelecionado | null>(null);
  const [filtroDespesas, setFiltroDespesas] =
    useState<FiltroDespesas>("tripulante");
  const [filtrosRevisados, setFiltrosRevisados] = useState<FiltroDespesas[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (imagemRejeicaoPreview) URL.revokeObjectURL(imagemRejeicaoPreview);
  }, [imagemRejeicaoPreview]);
  useLayoutEffect(() => {
    /*
      A tela pública NÃO usa o ScrollArea do sistema.
      O body fica travado e existe um único viewport de rolagem:
      o container fixo abaixo.
      Isso elimina o problema de "puxar a tela e ela não descer".
    */
    const html = document.documentElement;
    const body = document.body;

    const anterior = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyOverscroll: body.style.overscrollBehaviorY,
      colorScheme: html.style.colorScheme,
      htmlDarkClass: html.classList.contains("dark"),
    };

    html.classList.add("dark");
    html.style.overflow = "hidden";
    html.style.height = "100%";
    html.style.colorScheme = "dark";

    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overscrollBehaviorY = "none";

    return () => {
      html.style.overflow = anterior.htmlOverflow;
      html.style.height = anterior.htmlHeight;
      html.style.colorScheme = anterior.colorScheme;
      html.classList.toggle("dark", anterior.htmlDarkClass);

      body.style.overflow = anterior.bodyOverflow;
      body.style.height = anterior.bodyHeight;
      body.style.overscrollBehaviorY = anterior.bodyOverscroll;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    setData(null);
    setErro(false);
    setChegouAoFim(false);
    setFiltrosRevisados([]);
    setFiltroDespesas("tripulante");
    setMensagem("Carregando relatório...");

    void buscarAprovacaoPublica(token)
      .then((json) => {
        if (!ativo) return;

        setData(json);
        setMensagem("");
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
        });
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(true);
        setMensagem(
          error instanceof Error
            ? error.message
            : "Link inválido ou expirado.",
        );
      });

    return () => {
      ativo = false;
    };
  }, [token]);

  const despesas = useMemo(
    () => parseDespesas(data?.relatorio?.despesas),
    [data?.relatorio?.despesas],
  );

  const anexos = useMemo(
    () =>
      Array.isArray(data?.relatorio?.anexos)
        ? data.relatorio.anexos
        : [],
    [data?.relatorio?.anexos],
  );

  const anexosPorDespesa = useMemo(() => {
    const mapa = new Map<number, Anexo[]>();

    anexos.forEach((anexo) => {
      const indice = Number(anexo.indice_despesa);
      if (!Number.isFinite(indice)) return;

      const lista = mapa.get(indice) || [];
      lista.push(anexo);
      mapa.set(indice, lista);
    });

    return mapa;
  }, [anexos]);

  const posicao = data?.tripulante_pos || 1;
  const relatorio = data?.relatorio;
  const nomeTripulante =
    posicao === 1
      ? relatorio?.nome_tripulante
      : relatorio?.nome_tripulante_2;

  const {
    despesasTripulante,
    despesasOutroTripulante,
    despesasCliente,
    despesasShare,
    despesasOutros,
    despesasOutras,
    totalGeral,
    totalTripulante,
    totalCliente,
    totalShare,
    totalOutros,
  } = useCalculadoraRelatorio(despesas, data?.resumo, posicao);

  const totalSelecionado = {
    total: totalGeral,
    tripulante: totalTripulante,
    cliente: totalCliente,
    sharebrasil: totalShare,
    outros: totalOutros,
  }[filtroDespesas];
  const tituloTotalSelecionado = {
    total: "Total da viagem",
    tripulante: "Seu total",
    cliente: "Total do cliente",
    sharebrasil: "Total Share Brasil",
    outros: "Total de outras despesas",
  }[filtroDespesas];

  const despesasFiltradas = useMemo(() => {
    switch (filtroDespesas) {
      case "total":
        return despesas;
      case "cliente":
        return despesasCliente;
      case "sharebrasil":
        return despesasShare;
      case "outros":
        return despesasOutras;
      case "tripulante":
      default:
        return despesasTripulante;
    }
  }, [
    despesasCliente,
    despesas,
    despesasOutras,
    despesasShare,
    despesasTripulante,
    filtroDespesas,
  ]);

  const filtroInfo = useMemo(() => {
    switch (filtroDespesas) {
      case "total":
        return {
          titulo: "Todas as despesas da viagem",
          subtitulo: `Total de todas as despesas: ${moeda(totalGeral)}`,
          vazio: "Nenhuma despesa neste relatório.",
          icon: <Plane size={18} />,
        };
      case "cliente":
        return {
          titulo: "Despesas pagas pelo cliente",
          subtitulo: `Total pago pelo cliente: ${moeda(totalCliente)}`,
          vazio: "Nenhuma despesa paga pelo cliente.",
          icon: <ReceiptText size={18} />,
        };
      case "sharebrasil":
        return {
          titulo: "Despesas pagas pela Share Brasil",
          subtitulo: `Total pago pela Share Brasil: ${moeda(totalShare)}`,
          vazio: "Nenhuma despesa paga pela Share Brasil.",
          icon: <ShieldCheck size={18} />,
        };
      case "outros":
        return {
          titulo: "Outras despesas",
          subtitulo: `Total: ${moeda(totalOutros)}`,
          vazio: "Nenhuma outra despesa no relatório.",
          icon: <Info size={18} />,
        };
      case "tripulante":
      default:
        return {
          titulo: `Suas despesas`,
          subtitulo: `Total pago por você: ${moeda(totalTripulante)}`,
          vazio: "Nenhuma despesa atribuída a você.",
          icon: <UserRound size={18} />,
        };
    }
  }, [filtroDespesas, totalCliente, totalGeral, totalOutros, totalShare, totalTripulante]);

  const filtrosDisponiveis = useMemo<FiltroDespesas[]>(() => {
    const disponiveis: FiltroDespesas[] = [];
    if (despesasTripulante.length) disponiveis.push("tripulante");
    if (despesasCliente.length) disponiveis.push("cliente");
    if (despesasShare.length) disponiveis.push("sharebrasil");
    if (despesasOutroTripulante.length || despesasOutros.length) {
      disponiveis.push("outros");
    }
    return disponiveis;
  }, [
    despesasCliente.length,
    despesasOutroTripulante.length,
    despesasOutros.length,
    despesasShare.length,
    despesasTripulante.length,
  ]);

  const relatorioRevisado = useMemo(
    () =>
      filtrosDisponiveis.length === 0 ||
      filtrosDisponiveis.every((filtro) => filtrosRevisados.includes(filtro)),
    [filtrosDisponiveis, filtrosRevisados],
  );
  const filtrosPendentes = filtrosDisponiveis.filter(
    (filtro) => !filtrosRevisados.includes(filtro),
  );

  const selecionarFiltro = (filtro: FiltroDespesas) => {
    setFiltroDespesas(filtro);
    setChegouAoFim(filtrosRevisados.includes(filtro));
    setMensagem("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const statusAtual = data
    ? String(
        posicao === 1
          ? data.relatorio.status_aprovacao_tripulante || ""
          : data.relatorio.status_aprovacao_tripulante_2 || "",
      ).toLowerCase()
    : "";

  const decisaoRegistrada =
    statusAtual === "aprovado" ||
    statusAtual === "reprovado" ||
    statusAtual === "rejeitado";

  const foiAprovado = statusAtual === "aprovado";
  const pagadorTripulanteAtual = posicao === 1 ? "tripulante_1" : "tripulante_2";
  const temDespesaReembolsavel = despesas.some(
    (despesa) =>
      normalizarPagador(despesa.pago_por || despesa.paid_by) === pagadorTripulanteAtual &&
      Math.round((Number(despesa.valor) || 0) * 100) > 0,
  );
  const contaPagarTripulanteId =
    posicao === 1
      ? relatorio?.contas_apagar_tripulante_1_id
      : relatorio?.contas_apagar_tripulante_2_id;
  const podeReprocessarFinanceiro =
    foiAprovado &&
    String(relatorio?.status || "").toLowerCase() === "aprovado" &&
    temDespesaReembolsavel &&
    !String(contaPagarTripulanteId || "").trim();
  const foiReprovado =
    statusAtual === "reprovado" || statusAtual === "rejeitado";

  const aprovadoEm =
    posicao === 1
      ? relatorio?.aprovado_tripulante_1_em ||
        relatorio?.aprovado_tripulante_em
      : relatorio?.aprovado_tripulante_2_em;

  const motivoRegistrado =
    posicao === 1
      ? relatorio?.motivo_reprovacao_tripulante_1 ||
        relatorio?.observacoes_aprovacao_tripulante
      : relatorio?.motivo_reprovacao_tripulante_2 ||
        relatorio?.observacoes_aprovacao_tripulante_2;
  const urlRelatorio = `${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}/pdf`;

  const verificarFimScroll = () => {
    const elemento = scrollRef.current;
    if (!elemento) return;

    const chegou =
      elemento.scrollTop + elemento.clientHeight >=
      elemento.scrollHeight - 48;

    if (chegou) {
      setChegouAoFim(true);
      setFiltrosRevisados((atual) =>
        atual.includes(filtroDespesas)
          ? atual
          : [...atual, filtroDespesas],
      );
    }
  };

  useEffect(() => {
    const elemento = scrollRef.current;
    if (!elemento) return;

    const frame = requestAnimationFrame(() => {
      const cabeNaTela =
        elemento.scrollHeight <= elemento.clientHeight + 48;

      if (!cabeNaTela) return;

      setChegouAoFim(true);
      setFiltrosRevisados((atual) =>
        atual.includes(filtroDespesas)
          ? atual
          : [...atual, filtroDespesas],
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [filtroDespesas, despesasFiltradas.length]);

  const decidir = async (aprovado: boolean) => {
    if (!data || (decisaoRegistrada && !(aprovado && podeReprocessarFinanceiro)) || enviando) return;

    if (!aprovado && !motivo.trim()) {
      setMensagem("Informe o motivo da rejeição antes de continuar.");
      return;
    }

    setEnviando(true);
    setMensagem("");

    try {
      const payload = new FormData();
      payload.append("aprovado", String(aprovado));
      payload.append("motivo", motivo.trim());
      if (!aprovado && imagemRejeicao) payload.append("anexo_rejeicao", imagemRejeicao, imagemRejeicao.name);
      const response = await fetch(
        `${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`,
        { method: "POST", body: payload },
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.message || json?.error || "Não foi possível registrar sua decisão.",
        );
      }

      setData((atual) =>
        atual
          ? {
              ...atual,
              relatorio: json.relatorio,
            }
          : atual,
      );

      setMensagem(
        aprovado
          ? "Sua aprovação foi registrada com sucesso."
          : "Sua rejeição foi registrada com sucesso.",
      );

      setMotivo("");
      setAcao(null);

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Não foi possível registrar sua decisão.";
      if (aprovado) {
        try {
          setData(await buscarAprovacaoPublica(token));
        } catch {
          // Mantém a mensagem original da decisão se a consulta de atualização também falhar.
        }
      }
      setMensagem(mensagemErro);
    } finally {
      setEnviando(false);
    }
  };

  const abrirComprovante = (
    anexo: Anexo,
    indice: number,
    descricaoDespesa: string,
  ) => {
    setComprovanteSelecionado({
      ...anexo,
      indice,
      descricaoDespesa,
    });
  };

  const renderDespesa = (despesa: Despesa, indice: number) => {
    const anexosDaDespesa = anexosPorDespesa.get(indice) || [];

    return (
      <div
        key={`${despesa.id || "despesa"}-${indice}`}
        className="border-b border-border dark:border-white/10 px-4 py-4 last:border-b-0 sm:px-5 sm:py-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${categoriaClasse(
                  despesa.categoria,
                )}`}
              >
                {despesa.categoria || "Outros"}
              </span>

              <span className="rounded-full border border-border dark:border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-muted-foreground dark:text-slate-400">
                {dataBr(despesa.data)}
              </span>
            </div>

            <p className="mt-3 break-words text-sm font-extrabold text-white">
              {despesa.descricao || "Despesa sem descrição"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">
              Pago por {nomePagador(despesa.pago_por || despesa.paid_by)}
            </p>

            {despesa.observacoes ? (
              <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">
                {despesa.observacoes}
              </p>
            ) : null}
          </div>

          <strong className="shrink-0 text-sm font-black text-white sm:text-base">
            {moeda(despesa.valor)}
          </strong>
        </div>

        {anexosDaDespesa.length ? (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Comprovantes
            </p>

            <div className="flex flex-wrap gap-2">
              {anexosDaDespesa.map((anexo) => (
                <button
                  key={anexo.id}
                  type="button"
                  onClick={() =>
                    abrirComprovante(
                      anexo,
                      indice,
                      despesa.descricao || "Despesa",
                    )
                  }
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-2xl border border-border dark:border-white/10 bg-white/[0.045] px-3 py-2 text-left text-xs font-bold text-foreground dark:text-slate-200 transition active:scale-[0.99] hover:border-sky-300/30 hover:bg-white/[0.07]"
                >
                  {isImagem(anexo) ? (
                    <FileImage
                      size={15}
                      className="shrink-0 text-sky-300"
                    />
                  ) : (
                    <FileText
                      size={15}
                      className="shrink-0 text-muted-foreground dark:text-slate-300"
                    />
                  )}

                  <span className="min-w-0 max-w-[190px] truncate">
                    {anexo.nome_arquivo || "Comprovante"}
                  </span>

                  <Eye size={14} className="shrink-0 text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  if (!data) {
    return (
      <main className="dark fixed inset-0 overflow-y-auto bg-[#060b14] text-white">
        <div className="flex min-h-dvh w-full items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-border dark:border-white/10 bg-card dark:bg-card p-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <img
              src="/logoshare.branco.png"
              alt="Share Brasil"
              className="mx-auto mb-6 h-12 w-auto object-contain"
            />

            <div
              className={`mx-auto grid size-12 place-items-center rounded-2xl ${
                erro
                  ? "bg-rose-400/10 text-rose-300"
                  : "bg-white/[0.06] text-sky-300"
              }`}
            >
              {erro ? (
                <XCircle size={23} />
              ) : (
                <Loader2 size={23} className="animate-spin" />
              )}
            </div>

            <h1 className="mt-5 text-lg font-extrabold">
              {erro
                ? "Não foi possível abrir o relatório"
                : "Carregando relatório"}
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground dark:text-slate-400">
              {mensagem}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        ref={scrollRef}
        onScroll={verificarFimScroll}
        className="dark fixed inset-0 z-10 overflow-y-auto overscroll-y-contain bg-[#060b14] text-white"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        <div className="mx-auto w-full max-w-4xl px-3 pb-44 pt-3 sm:px-6 sm:pb-48 sm:pt-6">
          <header className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border dark:border-white/10 bg-white/[0.04] sm:size-14">
              <img
                src="/logoshare.branco.png"
                alt="Share Brasil"
                className="max-h-8 w-auto object-contain sm:max-h-9"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-300 sm:text-[11px]">
                Share Brasil
              </p>

              <h1 className="truncate text-base font-extrabold tracking-tight text-white sm:text-xl">
                Aprovação de despesas
              </h1>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold ${
                decisaoRegistrada
                  ? foiAprovado
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : "border-rose-400/20 bg-rose-400/10 text-rose-200"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
              }`}
            >
              {statusLegivel(statusAtual)}
            </span>
          </header>

          {mensagem ? (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sky-300/15 bg-sky-300/[0.06] px-4 py-3 text-sm text-sky-100 sm:mb-5">
              <Info size={17} className="mt-0.5 shrink-0" />
              <p className="min-w-0 leading-relaxed">{mensagem}</p>
            </div>
          ) : null}

          <Cartao>
            <div className="border-b border-border dark:border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/[0.08] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-200">
                    <ShieldCheck size={13} />
                    Aprovação do relatório
                  </span>

                  <h2 className="mt-3 break-words text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                    Relatório {relatorio?.numero_relatorio || "—"}
                  </h2>

                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground dark:text-slate-400">
                    Use os cartões abaixo para revisar suas despesas, as do
                    cliente e as da Share Brasil separadamente. Os comprovantes
                    continuam junto de cada despesa.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 sm:min-w-[160px] sm:text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200/70">
                    {tituloTotalSelecionado}
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-100">
                    {moeda(totalSelecionado)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border dark:border-white/10 bg-white/[0.035] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Voo
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white">
                    <Plane size={14} className="text-sky-300" />
                    {relatorio?.numero_voo || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border dark:border-white/10 bg-white/[0.035] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Aeronave
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {relatorio?.aeronave_matricula ||
                      relatorio?.matricula_aeronave ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border dark:border-white/10 bg-white/[0.035] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Período
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {dataBr(relatorio?.data_inicio)} a{" "}
                    {dataBr(relatorio?.data_fim)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border dark:border-white/10 bg-white/[0.035] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tripulante
                  </p>
                  <p className="mt-1 break-words text-sm font-bold text-white">
                    {nomeTripulante || `Tripulante ${posicao}`}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-border dark:border-white/10 bg-white/[0.035] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Rota
                </p>
                <p className="mt-1 break-words text-sm font-bold text-white">
                  {relatorio?.rota || "—"}
                </p>
              </div>
              <a
                href={urlRelatorio}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-sky-300/25 bg-sky-300/[0.08] px-4 text-sm font-extrabold text-sky-100 transition hover:bg-sky-300/[0.14]"
              >
                <Eye size={17} />
                Visualizar relatório
                <ExternalLink size={14} className="text-sky-300" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => selecionarFiltro("total")}
                aria-pressed={filtroDespesas === "total"}
                className={`text-left p-4 transition hover:bg-white/[0.045] ${
                  filtroDespesas === "total"
                    ? "bg-sky-400/[0.10] ring-1 ring-inset ring-sky-300/25"
                    : "bg-card dark:bg-card"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Total da viagem
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {moeda(totalGeral)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {despesas.length} despesa(s)
                </p>
              </button>

              <button
                type="button"
                onClick={() => selecionarFiltro("tripulante")}
                className={`text-left p-4 transition hover:bg-white/[0.045] ${
                  filtroDespesas === "tripulante"
                    ? "bg-emerald-400/[0.10] ring-1 ring-inset ring-emerald-300/25"
                    : "bg-card dark:bg-card"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Você
                </p>
                <p className="mt-1 text-base font-black text-emerald-200">
                  {moeda(totalTripulante)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {despesasTripulante.length} despesa(s)
                </p>
              </button>

              <button
                type="button"
                onClick={() => selecionarFiltro("cliente")}
                className={`text-left p-4 transition hover:bg-white/[0.045] ${
                  filtroDespesas === "cliente"
                    ? "bg-sky-400/[0.10] ring-1 ring-inset ring-sky-300/25"
                    : "bg-card dark:bg-card"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Cliente
                </p>
                <p className="mt-1 text-base font-black text-sky-200">
                  {moeda(totalCliente)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {despesasCliente.length} despesa(s)
                </p>
              </button>

              <button
                type="button"
                onClick={() => selecionarFiltro("sharebrasil")}
                className={`text-left p-4 transition hover:bg-white/[0.045] ${
                  filtroDespesas === "sharebrasil"
                    ? "bg-white/[0.08] ring-1 ring-inset ring-white/15"
                    : "bg-card dark:bg-card"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Share Brasil
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {moeda(totalShare)}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {despesasShare.length} despesa(s)
                </p>
              </button>
            </div>

            {(despesasOutroTripulante.length || despesasOutros.length) ? (
              <div className="border-t border-border dark:border-white/10 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => selecionarFiltro("outros")}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${
                    filtroDespesas === "outros"
                      ? "border-amber-300/25 bg-amber-300/[0.08] text-amber-200"
                      : "border-border dark:border-white/10 bg-white/[0.03] text-muted-foreground dark:text-slate-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <Info size={14} />
                  Outras despesas ({despesasOutroTripulante.length + despesasOutros.length})
                </button>
              </div>
            ) : null}
          </Cartao>

          <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
            <Cartao>
              <TituloSecao
                icon={filtroInfo.icon}
                titulo={`${filtroInfo.titulo} (${despesasFiltradas.length})`}
                subtitulo={filtroInfo.subtitulo}
              />

              {despesasFiltradas.length ? (
                <div>
                  {despesasFiltradas.map((despesa) =>
                    renderDespesa(despesa, despesas.indexOf(despesa)),
                  )}
                </div>
              ) : (
                <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">
                  {filtroInfo.vazio}
                </p>
              )}
            </Cartao>

            {decisaoRegistrada ? (
              <Cartao
                className={
                  foiAprovado
                    ? "border-emerald-300/15 bg-emerald-300/[0.05]"
                    : "border-rose-300/15 bg-rose-300/[0.05]"
                }
              >
                <div className="flex items-start gap-3 px-4 py-5 sm:px-5">
                  {foiAprovado ? (
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-emerald-300"
                      size={23}
                    />
                  ) : (
                    <XCircle
                      className="mt-0.5 shrink-0 text-rose-300"
                      size={23}
                    />
                  )}

                  <div className="min-w-0">
                    <p
                      className={`text-base font-extrabold ${
                        foiAprovado
                          ? "text-emerald-200"
                          : "text-rose-200"
                      }`}
                    >
                      {foiAprovado
                        ? "Sua aprovação foi registrada"
                        : "Sua rejeição foi registrada"}
                    </p>

                    {foiAprovado && aprovadoEm ? (
                      <p className="mt-1 text-xs text-emerald-300/80">
                        Registrado em {dataHoraBr(aprovadoEm)}.
                      </p>
                    ) : null}

                    {foiReprovado && motivoRegistrado ? (
                      <p className="mt-2 break-words rounded-xl border border-border dark:border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-rose-100">
                        <strong>Motivo:</strong> {motivoRegistrado}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Este link não permite alterar uma decisão já registrada.
                    </p>
                  </div>
                </div>
              </Cartao>
            ) : null}
          </div>
        </div>
      </main>

      {!decisaoRegistrada || podeReprocessarFinanceiro ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border dark:border-white/10 bg-card dark:bg-popover/96 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-4xl px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[10px] font-extrabold uppercase tracking-wider">
              <span
                className={
                  chegouAoFim ? "text-emerald-300" : "text-amber-300"
                }
              >
                {relatorioRevisado
                  ? "Todos os grupos foram revisados"
                  : chegouAoFim
                    ? "Grupo atual revisado · os demais são opcionais"
                    : "A revisão dos grupos é opcional"}
              </span>

              <span className="text-muted-foreground dark:text-slate-400">{moeda(totalTripulante)}</span>
            </div>

            {!relatorioRevisado && !podeReprocessarFinanceiro ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1 text-[10px]">
                <span className="font-bold text-muted-foreground dark:text-slate-400">
                  Grupos não revisados (opcional):
                </span>
                {filtrosPendentes.map((filtro) =>
                  filtro === filtroDespesas ? (
                    <span
                      key={filtro}
                      className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 font-bold text-amber-200"
                    >
                      {ROTULOS_FILTRO[filtro]}
                    </span>
                  ) : (
                    <button
                      key={filtro}
                      type="button"
                      onClick={() => selecionarFiltro(filtro)}
                      className="rounded-full border border-sky-300/20 bg-sky-300/[0.06] px-2 py-1 font-bold text-sky-200 transition hover:bg-sky-300/[0.12]"
                    >
                      {ROTULOS_FILTRO[filtro]}
                    </button>
                  ),
                )}
              </div>
            ) : null}

            <div className={`grid gap-2.5 ${podeReprocessarFinanceiro ? "grid-cols-1" : "grid-cols-2"}`}>
              {!podeReprocessarFinanceiro ? <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  setMotivo("");
                  setImagemRejeicao(null);
                  setImagemRejeicaoPreview("");
                  setAcao("rejeitar");
                }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-white/[0.03] px-3 text-sm font-extrabold text-rose-200 transition active:scale-[0.99] disabled:opacity-50"
              >
                <X size={17} />
                Rejeitar
              </button> : null}

              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  setMotivo("");
                  setAcao("aprovar");
                }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 text-sm font-extrabold text-[#04120c] shadow-[0_8px_24px_rgba(16,185,129,0.22)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Check size={17} />
                {podeReprocessarFinanceiro ? "Tentar concluir aprovação" : "Aprovar relatório"}
              </button>
            </div>
          </div>
        </div>
      ) : foiAprovado ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border dark:border-white/10 bg-card dark:bg-popover/96 shadow-[0_-18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-4xl px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            <button
              type="button"
              disabled
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-3 text-sm font-extrabold text-emerald-200 disabled:cursor-default disabled:opacity-100"
            >
              <CheckCircle2 size={17} />
              RELATÓRIO APROVADO
            </button>
          </div>
        </div>
      ) : null}

      {acao ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl border border-border dark:border-white/10 bg-card dark:bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  Confirmação
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                  {acao === "aprovar"
                    ? podeReprocessarFinanceiro
                      ? "Tentar concluir aprovação?"
                      : "Aprovar este relatório?"
                    : "Rejeitar este relatório?"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setAcao(null)}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground dark:text-slate-300"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {acao === "aprovar" ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-emerald-300"
                    size={20}
                  />
                  <p className="text-sm leading-relaxed text-emerald-100">
                    {podeReprocessarFinanceiro ? (
                      "A aprovação já está registrada. Esta ação tenta concluir a sincronização financeira sem registrar uma nova decisão."
                    ) : (
                      <>
                        Você está confirmando a aprovação do relatório no valor
                        individual de <strong>{moeda(totalTripulante)}</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-4 text-xs leading-relaxed text-rose-100">
                  Para rejeitar, informe o que precisa ser corrigido no
                  relatório.
                </div>

                <Textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Ex.: Almoço de 19/09 informado com valor incorreto."
                  className="mt-3 min-h-28 resize-y rounded-2xl border-border dark:border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-500"
                  autoFocus
                />
                <div className="mt-3 rounded-2xl border border-border dark:border-white/10 bg-white/[0.03] p-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300/30 px-3 py-3 text-xs font-bold text-sky-200 hover:bg-sky-300/[0.06]">
                    <ImagePlus size={16} /> {imagemRejeicao ? "Trocar imagem" : "Anexar imagem para orientar o ajuste (opcional)"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                      const arquivo = event.target.files?.[0];
                      if (!arquivo) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
                        setMensagem("Selecione uma imagem JPG, PNG ou WebP de até 5 MB.");
                        event.target.value = "";
                        return;
                      }
                      setMensagem("");
                      setImagemRejeicao(arquivo);
                      setImagemRejeicaoPreview(URL.createObjectURL(arquivo));
                    }} />
                  </label>
                  {imagemRejeicao && <div className="mt-3 flex items-start gap-3"><img src={imagemRejeicaoPreview} alt="Prévia do anexo da rejeição" className="h-20 w-24 rounded-lg border border-border dark:border-white/10 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground dark:text-slate-200">{imagemRejeicao.name}</p><p className="mt-1 text-[10px] text-muted-foreground dark:text-slate-400">{(imagemRejeicao.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" onClick={() => { setImagemRejeicao(null); setImagemRejeicaoPreview(""); }} aria-label="Remover imagem" className="rounded-lg p-2 text-rose-300 hover:bg-rose-300/10"><Trash2 size={15} /></button></div>}
                  <p className="mt-2 text-[10px] text-slate-500">JPG, PNG ou WebP · máximo 5 MB. A imagem será anexada à notificação de rejeição.</p>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={enviando}
                onClick={() => setAcao(null)}
                className="min-h-12 rounded-2xl border border-border dark:border-white/10 bg-white/[0.03] px-3 text-sm font-extrabold text-foreground dark:text-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  enviando ||
                  (acao === "rejeitar" && !motivo.trim())
                }
                onClick={() => void decidir(acao === "aprovar")}
                className={`min-h-12 rounded-2xl px-3 text-sm font-extrabold ${
                  acao === "aprovar"
                    ? "bg-emerald-500 text-[#04120c]"
                    : "bg-rose-500 text-white"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {enviando ? (
                  <Loader2 className="mx-auto animate-spin" size={18} />
                ) : acao === "aprovar" ? (
                  podeReprocessarFinanceiro
                    ? "Tentar concluir aprovação"
                    : "Confirmar aprovação"
                ) : (
                  "Confirmar rejeição"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {comprovanteSelecionado ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border dark:border-white/10 bg-card dark:bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border dark:border-white/10 px-4 py-3 sm:px-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground dark:text-slate-300">
                {isImagem(comprovanteSelecionado) ? (
                  <FileImage size={17} />
                ) : (
                  <FileText size={17} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-white">
                  {comprovanteSelecionado.nome_arquivo || "Comprovante"}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {comprovanteSelecionado.descricaoDespesa}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setComprovanteSelecionado(null)}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-muted-foreground dark:text-slate-300"
                aria-label="Fechar comprovante"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-auto bg-card dark:bg-background p-2 sm:p-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {isImagem(comprovanteSelecionado) ? (
                <div className="flex min-h-[55dvh] items-center justify-center rounded-2xl bg-black/20 p-2 sm:p-4">
                  <img
                    src={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    alt={
                      comprovanteSelecionado.nome_arquivo || "Comprovante"
                    }
                    className="max-h-[78dvh] w-auto max-w-full rounded-xl object-contain"
                  />
                </div>
              ) : isPdf(comprovanteSelecionado) ? (
                <div className="flex min-h-[50dvh] flex-col items-center justify-center rounded-2xl bg-white/[0.03] p-6 text-center">
                  <FileText size={44} className="text-slate-600" />
                  <p className="mt-3 text-sm font-bold text-white">
                    Comprovante em PDF
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                    Abra o arquivo em uma nova guia para usar o leitor de PDF
                    do celular.
                  </p>

                  <a
                    href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 text-sm font-extrabold text-[#04111c]"
                  >
                    Abrir PDF
                    <ExternalLink size={15} />
                  </a>
                </div>
              ) : (
                <div className="flex min-h-[50dvh] flex-col items-center justify-center rounded-2xl bg-white/[0.03] p-6 text-center">
                  <FileText size={44} className="text-slate-600" />
                  <p className="mt-3 text-sm font-bold text-white">
                    Arquivo disponível
                  </p>

                  <a
                    href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 text-sm font-extrabold text-[#04111c]"
                  >
                    Abrir arquivo
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border dark:border-white/10 px-4 py-3 sm:px-5">
              <span className="truncate text-[11px] text-slate-500">
                Comprovante{" "}
                {comprovanteSelecionado.indice >= 0
                  ? comprovanteSelecionado.indice + 1
                  : ""}
              </span>

              <a
                href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border dark:border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-foreground dark:text-slate-200"
              >
                Abrir em nova guia
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
