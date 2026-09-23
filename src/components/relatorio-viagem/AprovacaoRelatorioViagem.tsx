import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Info,
  Loader2,
  Plane,
  ReceiptText,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";

/*
  Página pública de aprovação de Relatório de Despesa de Viagem.

  Importante:
  - Não usa ScrollArea nem qualquer container com overflow-y próprio.
  - O scroll principal fica no documento/body, evitando a sensação de "trava"
    ao rolar no celular.
  - A barra de decisão fica fixa no rodapé apenas enquanto a aprovação estiver pendente.
  - O endpoint público atual já entrega r.anexos com indice_despesa e url_arquivo.
*/

type TipoAcao = "aprovar" | "rejeitar" | null;
type Pagador = "tripulante_1" | "tripulante_2" | "cliente" | "sharebrasil" | "outro";

type Despesa = {
  id?: string;
  data?: string;
  categoria?: string;
  descricao?: string;
  valor?: number | string;
  observacoes?: string;
  pago_por?: string;
  paid_by?: string;
};

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
  status_aprovacao_tripulante?: string | null;
  status_aprovacao_tripulante_2?: string | null;
  aprovado_tripulante_em?: string | null;
  aprovado_tripulante_1_em?: string | null;
  aprovado_tripulante_2_em?: string | null;
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

function moeda(valor: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor) || 0);
}

function dataBr(valor: unknown) {
  const partes = String(valor || "").slice(0, 10).split("-");
  if (partes.length !== 3 || !partes[0] || !partes[1] || !partes[2]) return "—";
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataHoraBr(valor: unknown) {
  const normalizado = String(valor || "").trim().replace("T", " ");
  const [data, hora] = normalizado.split(" ");
  if (!data || !hora) return dataBr(valor);
  return `${dataBr(data)} às ${hora.slice(0, 5)}`;
}

function normalizarPagador(valor: unknown): Pagador {
  const normalizado = String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  if (normalizado === "cliente" || normalizado === "client") return "cliente";
  if (["share", "sharebrasil", "share_brasil"].includes(normalizado)) return "sharebrasil";
  if (["tripulante_2", "tripulante2"].includes(normalizado)) return "tripulante_2";
  if (["tripulante_1", "tripulante1"].includes(normalizado)) return "tripulante_1";
  return "outro";
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

function tamanhoArquivo(valor: unknown) {
  const bytes = Number(valor);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImagem(anexo: Anexo) {
  return String(anexo.tipo_arquivo || "").toLowerCase().startsWith("image/");
}

function isPdf(anexo: Anexo) {
  return String(anexo.tipo_arquivo || "").toLowerCase() === "application/pdf" ||
    String(anexo.nome_arquivo || "").toLowerCase().endsWith(".pdf");
}

function statusLegivel(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "aprovado") return "Aprovado";
  if (value === "reprovado" || value === "rejeitado") return "Reprovado";
  if (value === "nao_aplicavel") return "Não aplicável";
  return "Pendente";
}

function classeCategoria(categoria: unknown) {
  const valor = String(categoria || "").toLowerCase();
  if (valor.includes("hosped")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (valor.includes("aliment")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (valor.includes("transport")) return "bg-sky-50 text-sky-700 border-sky-200";
  if (valor.includes("combust")) return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.07)] ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default function AprovacaoRelatorioViagem() {
  const token = useMemo(
    () =>
      new URLSearchParams(window.location.search).get("token") ||
      window.location.pathname.split("/").filter(Boolean).pop() ||
      "",
    [],
  );

  const [data, setData] = useState<ApprovalData | null>(null);
  const [mensagem, setMensagem] = useState("Carregando relatório...");
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [acao, setAcao] = useState<TipoAcao>(null);
  const [motivo, setMotivo] = useState("");
  const [comprovanteSelecionado, setComprovanteSelecionado] = useState<ComprovanteSelecionado | null>(null);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({
    suas: true,
    cliente: false,
    share: false,
    comprovantes: false,
  });

  useEffect(() => {
    // Esta página é pública e deve usar apenas o scroll do documento.
    // Assim não existe um segundo viewport prendendo a rolagem do celular.
    const htmlAnterior = document.documentElement.style.overflowY;
    const bodyAnterior = document.body.style.overflowY;
    document.documentElement.style.overflowY = "auto";
    document.body.style.overflowY = "auto";

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    let ativo = true;
    void fetch(`${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || "Link inválido ou expirado.");
        if (!ativo) return;
        setData(json as ApprovalData);
        setMensagem("");
        setErro(false);
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(true);
        setMensagem(error instanceof Error ? error.message : "Link inválido ou expirado.");
      });

    return () => {
      ativo = false;
      document.documentElement.style.overflowY = htmlAnterior;
      document.body.style.overflowY = bodyAnterior;
    };
  }, [token]);

  const despesas = useMemo(() => parseDespesas(data?.relatorio?.despesas), [data?.relatorio?.despesas]);
  const anexos = useMemo(() => (Array.isArray(data?.relatorio?.anexos) ? data!.relatorio.anexos! : []), [data?.relatorio?.anexos]);

  const resumo = data?.resumo || {};
  const posicao = data?.tripulante_pos || 1;
  const nomeTripulante = posicao === 1 ? data?.relatorio?.nome_tripulante : data?.relatorio?.nome_tripulante_2;
  const pagadorTripulante: Pagador = posicao === 1 ? "tripulante_1" : "tripulante_2";

  const despesasTripulante = useMemo(
    () => despesas.filter((item) => normalizarPagador(item.pago_por || item.paid_by) === pagadorTripulante),
    [despesas, pagadorTripulante],
  );

  const despesasCliente = useMemo(
    () => despesas.filter((item) => normalizarPagador(item.pago_por || item.paid_by) === "cliente"),
    [despesas],
  );

  const despesasShare = useMemo(
    () => despesas.filter((item) => normalizarPagador(item.pago_por || item.paid_by) === "sharebrasil"),
    [despesas],
  );

  const totalGeral = useMemo(
    () => despesas.reduce((total, item) => total + (Number(item.valor) || 0), 0),
    [despesas],
  );

  const totalTripulante = Number(resumo.total_a_receber) || despesasTripulante.reduce((total, item) => total + (Number(item.valor) || 0), 0);
  const totalCliente = Number(resumo.cliente_pagou) || despesasCliente.reduce((total, item) => total + (Number(item.valor) || 0), 0);
  const totalShare = Number(resumo.share_brasil_pagou) || despesasShare.reduce((total, item) => total + (Number(item.valor) || 0), 0);

  const anexosPorDespesa = useMemo(() => {
    const mapa = new Map<number, Anexo[]>();
    anexos.forEach((anexo) => {
      const indice = Number(anexo.indice_despesa);
      if (!Number.isFinite(indice)) return;
      const atuais = mapa.get(indice) || [];
      atuais.push(anexo);
      mapa.set(indice, atuais);
    });
    return mapa;
  }, [anexos]);

  const statusAtual = data
    ? String(
        posicao === 1
          ? data.relatorio.status_aprovacao_tripulante || ""
          : data.relatorio.status_aprovacao_tripulante_2 || "",
      ).toLowerCase()
    : "";

  const decisaoRegistrada = statusAtual === "aprovado" || statusAtual === "reprovado" || statusAtual === "rejeitado";
  const foiAprovado = statusAtual === "aprovado";
  const foiReprovado = statusAtual === "reprovado" || statusAtual === "rejeitado";

  const aprovadoEm =
    posicao === 1
      ? data?.relatorio.aprovado_tripulante_1_em || data?.relatorio.aprovado_tripulante_em
      : data?.relatorio.aprovado_tripulante_2_em;

  const motivoRegistrado =
    posicao === 1
      ? data?.relatorio.motivo_reprovacao_tripulante_1 || data?.relatorio.observacoes_aprovacao_tripulante
      : data?.relatorio.motivo_reprovacao_tripulante_2 || data?.relatorio.observacoes_aprovacao_tripulante_2;

  const alternar = (chave: string) => {
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));
  };

  const decidir = async (aprovado: boolean) => {
    if (!data || decisaoRegistrada || enviando) return;
    if (!aprovado && !motivo.trim()) {
      setMensagem("Informe o motivo da rejeição antes de continuar.");
      return;
    }

    setEnviando(true);
    setMensagem("");

    try {
      const response = await fetch(
        `${API_BASE}/api/public/relatorios-despesa-viagem/aprovacao/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aprovado, motivo: motivo.trim() }),
        },
      );

      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Não foi possível registrar sua decisão.");

      setData((atual) => (atual ? { ...atual, relatorio: json.relatorio } : atual));
      setMensagem(aprovado ? "Sua aprovação foi registrada com sucesso." : "Sua rejeição foi registrada com sucesso.");
      setMotivo("");
      setAcao(null);
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível registrar sua decisão.");
    } finally {
      setEnviando(false);
    }
  };

  if (!data) {
    return (
      <main className="min-h-dvh bg-[#f5f7fa] px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-xl items-center justify-center">
          <Card className="w-full p-6 text-center sm:p-8">
            <img src="/logo.share.png" alt="Share Brasil" className="mx-auto mb-6 h-12 w-auto object-contain" />
            <div className={`mx-auto grid size-12 place-items-center rounded-2xl ${erro ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
              {erro ? <XCircle size={23} /> : <Loader2 size={23} className="animate-spin" />}
            </div>
            <h1 className="mt-5 text-lg font-extrabold">{erro ? "Não foi possível abrir o relatório" : "Carregando relatório"}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{mensagem}</p>
          </Card>
        </div>
      </main>
    );
  }

  const relatorio = data.relatorio;

  return (
    <main className="min-h-dvh overflow-visible bg-[#f5f7fa] pb-36 text-slate-900 sm:pb-40">
      <div className="mx-auto w-full max-w-3xl px-3 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-6">
        <header className="sticky top-0 z-30 -mx-3 mb-4 border-b border-slate-200/80 bg-[#f5f7fa]/95 px-3 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:mb-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="flex items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm sm:size-14">
              <img src="/logo.share.png" alt="Share Brasil" className="max-h-8 w-auto object-contain sm:max-h-9" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#2f6c93] sm:text-[11px]">Share Brasil</p>
              <h1 className="truncate text-base font-extrabold tracking-tight text-slate-950 sm:text-xl">Aprovação de despesas</h1>
            </div>
            <span className={`hidden rounded-full border px-3 py-1.5 text-[11px] font-bold sm:inline-flex ${decisaoRegistrada ? (foiAprovado ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700") : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              {statusLegivel(statusAtual)}
            </span>
          </div>
        </header>

        {mensagem ? (
          <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm sm:mb-5 ${mensagem.includes("sucesso") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <Info size={17} className="mt-0.5 shrink-0" />
            <p className="min-w-0 leading-relaxed">{mensagem}</p>
          </div>
        ) : null}

        <Card className="overflow-hidden border-slate-200">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#2f6c93]">
                  <ShieldCheck size={13} /> Revisão do tripulante
                </span>
                <h2 className="mt-3 break-words text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                  Relatório {relatorio.numero_relatorio || "—"}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Confira todas as despesas da viagem antes de aprovar.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seu total</p>
                <p className="mt-0.5 text-xl font-black tracking-tight text-slate-950">{moeda(totalTripulante)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Voo</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><Plane size={14} />{relatorio.numero_voo || "—"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aeronave</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{relatorio.aeronave_matricula || relatorio.matricula_aeronave || "—"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Período</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{dataBr(relatorio.data_inicio)} → {dataBr(relatorio.data_fim)}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-start gap-2.5">
                <UserRound size={17} className="mt-0.5 shrink-0 text-[#2f6c93]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tripulante</p>
                  <p className="mt-0.5 break-words text-sm font-bold text-slate-800">{nomeTripulante || `Tripulante ${posicao}`}</p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">Rota: {relatorio.rota || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            <div className="bg-white p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total da viagem</p>
              <p className="mt-1 text-base font-black text-slate-900">{moeda(totalGeral)}</p>
            </div>
            <div className="bg-white p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Você</p>
              <p className="mt-1 text-base font-black text-emerald-700">{moeda(totalTripulante)}</p>
            </div>
            <div className="bg-white p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente</p>
              <p className="mt-1 text-base font-black text-sky-700">{moeda(totalCliente)}</p>
            </div>
            <div className="bg-white p-3.5 sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Share Brasil</p>
              <p className="mt-1 text-base font-black text-slate-800">{moeda(totalShare)}</p>
            </div>
          </div>
        </Card>

        <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
          <Card className="overflow-hidden">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
              onClick={() => alternar("suas")}
              aria-expanded={abertos.suas}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserRound size={18} /></span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold text-slate-900">Suas despesas</strong>
                  <span className="block text-xs text-slate-500">{despesasTripulante.length} lançamento(s) · {moeda(totalTripulante)}</span>
                </span>
              </span>
              {abertos.suas ? <ChevronUp size={18} className="shrink-0 text-slate-400" /> : <ChevronDown size={18} className="shrink-0 text-slate-400" />}
            </button>
            {abertos.suas ? (
              <div className="border-t border-slate-100">
                {despesasTripulante.map((despesa) => {
                  const indice = despesas.indexOf(despesa);
                  const anexosDaDespesa = anexosPorDespesa.get(indice) || [];
                  return (
                    <div key={`${despesa.id || "despesa"}-${indice}`} className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold ${classeCategoria(despesa.categoria)}`}>{despesa.categoria || "Outros"}</span>
                            {anexosDaDespesa.length ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500"><ReceiptText size={11} />{anexosDaDespesa.length} comprovante(s)</span> : null}
                          </div>
                          <p className="mt-2 break-words text-sm font-bold text-slate-900">{despesa.descricao || "Despesa sem descrição"}</p>
                          <p className="mt-1 text-xs text-slate-500">{dataBr(despesa.data)} · Pago por {nomePagador(despesa.pago_por || despesa.paid_by)}</p>
                          {despesa.observacoes ? <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">{despesa.observacoes}</p> : null}
                        </div>
                        <strong className="shrink-0 text-sm font-black text-slate-900 sm:text-base">{moeda(despesa.valor)}</strong>
                      </div>
                      {anexosDaDespesa.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {anexosDaDespesa.map((anexo) => (
                            <button
                              key={anexo.id}
                              type="button"
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm active:scale-[.99]"
                              onClick={() => setComprovanteSelecionado({ ...anexo, indice, descricaoDespesa: despesa.descricao || "Despesa" })}
                            >
                              {isImagem(anexo) ? <FileImage size={15} className="text-[#2f6c93]" /> : <FileText size={15} className="text-slate-500" />}
                              <span className="max-w-[170px] truncate">{anexo.nome_arquivo || "Comprovante"}</span>
                              <Eye size={14} className="text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!despesasTripulante.length ? <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">Nenhuma despesa atribuída a você.</p> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
              onClick={() => alternar("cliente")}
              aria-expanded={abertos.cliente}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><CircleDollarSign size={18} /></span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold text-slate-900">Despesas pagas pelo cliente</strong>
                  <span className="block text-xs text-slate-500">{despesasCliente.length} lançamento(s) · {moeda(totalCliente)}</span>
                </span>
              </span>
              {abertos.cliente ? <ChevronUp size={18} className="shrink-0 text-slate-400" /> : <ChevronDown size={18} className="shrink-0 text-slate-400" />}
            </button>
            {abertos.cliente ? (
              <div className="border-t border-slate-100">
                {despesasCliente.map((despesa) => {
                  const indice = despesas.indexOf(despesa);
                  const anexosDaDespesa = anexosPorDespesa.get(indice) || [];
                  return (
                    <div key={`${despesa.id || "cliente"}-${indice}`} className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-extrabold ${classeCategoria(despesa.categoria)}`}>{despesa.categoria || "Outros"}</span>
                          <p className="mt-2 break-words text-sm font-bold text-slate-900">{despesa.descricao || "Despesa sem descrição"}</p>
                          <p className="mt-1 text-xs text-slate-500">{dataBr(despesa.data)} · Pago por Cliente</p>
                        </div>
                        <strong className="shrink-0 text-sm font-black text-slate-900 sm:text-base">{moeda(despesa.valor)}</strong>
                      </div>
                      {anexosDaDespesa.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {anexosDaDespesa.map((anexo) => (
                            <button
                              key={anexo.id}
                              type="button"
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm"
                              onClick={() => setComprovanteSelecionado({ ...anexo, indice, descricaoDespesa: despesa.descricao || "Despesa" })}
                            >
                              {isImagem(anexo) ? <FileImage size={15} className="text-[#2f6c93]" /> : <FileText size={15} className="text-slate-500" />}
                              <span className="max-w-[170px] truncate">{anexo.nome_arquivo || "Comprovante"}</span>
                              <Eye size={14} className="text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!despesasCliente.length ? <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">Nenhuma despesa paga pelo cliente.</p> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
              onClick={() => alternar("share")}
              aria-expanded={abertos.share}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck size={18} /></span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold text-slate-900">Despesas pagas pela Share Brasil</strong>
                  <span className="block text-xs text-slate-500">{despesasShare.length} lançamento(s) · {moeda(totalShare)}</span>
                </span>
              </span>
              {abertos.share ? <ChevronUp size={18} className="shrink-0 text-slate-400" /> : <ChevronDown size={18} className="shrink-0 text-slate-400" />}
            </button>
            {abertos.share ? (
              <div className="border-t border-slate-100">
                {despesasShare.map((despesa) => {
                  const indice = despesas.indexOf(despesa);
                  const anexosDaDespesa = anexosPorDespesa.get(indice) || [];
                  return (
                    <div key={`${despesa.id || "share"}-${indice}`} className="border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-extrabold ${classeCategoria(despesa.categoria)}`}>{despesa.categoria || "Outros"}</span>
                          <p className="mt-2 break-words text-sm font-bold text-slate-900">{despesa.descricao || "Despesa sem descrição"}</p>
                          <p className="mt-1 text-xs text-slate-500">{dataBr(despesa.data)} · Pago por Share Brasil</p>
                        </div>
                        <strong className="shrink-0 text-sm font-black text-slate-900 sm:text-base">{moeda(despesa.valor)}</strong>
                      </div>
                      {anexosDaDespesa.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {anexosDaDespesa.map((anexo) => (
                            <button
                              key={anexo.id}
                              type="button"
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm"
                              onClick={() => setComprovanteSelecionado({ ...anexo, indice, descricaoDespesa: despesa.descricao || "Despesa" })}
                            >
                              {isImagem(anexo) ? <FileImage size={15} className="text-[#2f6c93]" /> : <FileText size={15} className="text-slate-500" />}
                              <span className="max-w-[170px] truncate">{anexo.nome_arquivo || "Comprovante"}</span>
                              <Eye size={14} className="text-slate-400" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!despesasShare.length ? <p className="px-4 py-5 text-sm text-slate-500 sm:px-5">Nenhuma despesa paga pela Share Brasil.</p> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <button
              type="button"
              className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
              onClick={() => alternar("comprovantes")}
              aria-expanded={abertos.comprovantes}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2f6c93]"><ReceiptText size={18} /></span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold text-slate-900">Comprovantes da viagem</strong>
                  <span className="block text-xs text-slate-500">{anexos.length} arquivo(s) disponível(is)</span>
                </span>
              </span>
              {abertos.comprovantes ? <ChevronUp size={18} className="shrink-0 text-slate-400" /> : <ChevronDown size={18} className="shrink-0 text-slate-400" />}
            </button>
            {abertos.comprovantes ? (
              <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                {anexos.length ? (
                  <div className="grid gap-2">
                    {anexos.map((anexo) => {
                      const indice = Number(anexo.indice_despesa);
                      const despesa = Number.isFinite(indice) ? despesas[indice] : undefined;
                      const descricao = despesa?.descricao || "Comprovante da viagem";
                      return (
                        <div key={anexo.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm">
                            {isImagem(anexo) ? <FileImage size={18} /> : <FileText size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-800">{anexo.nome_arquivo || "Comprovante"}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{descricao}{tamanhoArquivo(anexo.tamanho_arquivo) ? ` · ${tamanhoArquivo(anexo.tamanho_arquivo)}` : ""}</p>
                          </div>
                          <button
                            type="button"
                            className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
                            onClick={() => setComprovanteSelecionado({ ...anexo, indice: Number.isFinite(indice) ? indice : -1, descricaoDespesa: descricao })}
                            aria-label={`Visualizar ${anexo.nome_arquivo || "comprovante"}`}
                          >
                            <Eye size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center">
                    <ReceiptText className="mx-auto text-slate-300" size={28} />
                    <p className="mt-2 text-sm font-bold text-slate-700">Nenhum comprovante anexado</p>
                    <p className="mt-1 text-xs text-slate-500">Não há arquivos disponíveis para este relatório.</p>
                  </div>
                )}
              </div>
            ) : null}
          </Card>

          <Card className="border-blue-100 bg-blue-50/40 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 shrink-0 text-[#2f6c93]" size={18} />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">Antes de aprovar</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">Revise suas despesas, os valores pagos pelo cliente e pela Share Brasil e os comprovantes anexados.</p>
              </div>
            </div>
          </Card>

          {decisaoRegistrada ? (
            <Card className={foiAprovado ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"}>
              <div className="flex items-start gap-3 p-4 sm:p-5">
                {foiAprovado ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} /> : <XCircle className="mt-0.5 shrink-0 text-rose-600" size={22} />}
                <div className="min-w-0">
                  <p className={`text-base font-extrabold ${foiAprovado ? "text-emerald-800" : "text-rose-800"}`}>
                    {foiAprovado ? "Sua aprovação foi registrada" : "Sua rejeição foi registrada"}
                  </p>
                  {foiAprovado && aprovadoEm ? <p className="mt-1 text-xs text-emerald-700">Registrado em {dataHoraBr(aprovadoEm)}.</p> : null}
                  {foiReprovado && motivoRegistrado ? <p className="mt-2 break-words rounded-xl border border-white/70 bg-white/60 p-3 text-xs leading-relaxed text-rose-800"><strong>Motivo:</strong> {motivoRegistrado}</p> : null}
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">Este link não permite alterar a decisão já registrada.</p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {!decisaoRegistrada ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-12px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-3xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Decisão do tripulante {posicao}</span>
              <span>{moeda(totalTripulante)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1.4fr]">
              <button
                type="button"
                disabled={enviando}
                onClick={() => { setMotivo(""); setAcao("rejeitar"); }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 text-sm font-extrabold text-rose-700 shadow-sm transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={17} />
                Rejeitar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => { setMotivo(""); setAcao("aprovar"); }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(5,150,105,0.28)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={17} />
                Aprovar despesas
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {acao ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Confirmação</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">{acao === "aprovar" ? "Aprovar este relatório?" : "Rejeitar este relatório?"}</h2>
              </div>
              <button type="button" onClick={() => setAcao(null)} className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {acao === "aprovar" ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                  <p className="text-sm leading-relaxed text-emerald-900">Você está confirmando a aprovação das suas despesas no valor de <strong>{moeda(totalTripulante)}</strong>.</p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs leading-relaxed text-rose-800">
                  Para rejeitar, informe o que precisa ser corrigido no relatório.
                </div>
                <Textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  placeholder="Ex.: Almoço de 19/09 informado com valor incorreto."
                  className="mt-3 min-h-28 resize-y rounded-2xl border-slate-200 bg-white text-sm text-slate-900"
                  autoFocus
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={enviando}
                onClick={() => setAcao(null)}
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando || (acao === "rejeitar" && !motivo.trim())}
                onClick={() => void decidir(acao === "aprovar")}
                className={`min-h-12 rounded-2xl px-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50 ${acao === "aprovar" ? "bg-emerald-600" : "bg-rose-600"}`}
              >
                {enviando ? <Loader2 className="mx-auto animate-spin" size={18} /> : acao === "aprovar" ? "Confirmar aprovação" : "Confirmar rejeição"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {comprovanteSelecionado ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                {isImagem(comprovanteSelecionado) ? <FileImage size={17} /> : <FileText size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-slate-900">{comprovanteSelecionado.nome_arquivo || "Comprovante"}</p>
                <p className="truncate text-[11px] text-slate-500">{comprovanteSelecionado.descricaoDespesa}</p>
              </div>
              <button
                type="button"
                onClick={() => setComprovanteSelecionado(null)}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                aria-label="Fechar comprovante"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2 sm:p-4">
              {isImagem(comprovanteSelecionado) ? (
                <div className="flex min-h-[50dvh] items-center justify-center rounded-2xl bg-white p-2 sm:p-4">
                  <img
                    src={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    alt={comprovanteSelecionado.nome_arquivo || "Comprovante"}
                    className="max-h-[78dvh] w-auto max-w-full rounded-xl object-contain"
                  />
                </div>
              ) : isPdf(comprovanteSelecionado) ? (
                <div className="flex min-h-[45dvh] flex-col items-center justify-center rounded-2xl bg-white p-6 text-center">
                  <FileText size={42} className="text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-800">Comprovante em PDF</p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">Abra o arquivo em uma nova guia para visualizar no leitor de PDF do seu celular.</p>
                  <a
                    href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2f6c93] px-4 text-sm font-extrabold text-white"
                  >
                    Abrir PDF <ExternalLink size={15} />
                  </a>
                </div>
              ) : (
                <div className="flex min-h-[45dvh] flex-col items-center justify-center rounded-2xl bg-white p-6 text-center">
                  <FileText size={42} className="text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-800">Arquivo disponível</p>
                  <a
                    href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2f6c93] px-4 text-sm font-extrabold text-white"
                  >
                    Abrir arquivo <ArrowLeft size={15} className="rotate-180" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <span className="truncate text-[11px] text-slate-400">Comprovante {comprovanteSelecionado.indice >= 0 ? comprovanteSelecionado.indice + 1 : ""}</span>
              <a
                href={`${API_BASE}${comprovanteSelecionado.url_arquivo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700"
              >
                Abrir em nova guia <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
