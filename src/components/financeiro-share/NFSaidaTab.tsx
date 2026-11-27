import { BaixaResumo } from "@/components/financeiro-design/BaixaResumo";
import "./nf-saida.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  Upload,
  Banknote,
  Search,
  Mail,
  ArrowLeft,
  ArrowUpRight, LayoutList, LayoutGrid, ChevronRight,
  TriangleAlert, Plane, CalendarDays, MoreVertical,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FolderCard from "@/components/ui/folder-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableCombobox as UiSearchableCombobox } from "@/components/ui/searchableCombobox";
import { Textarea } from "@/components/ui/textarea";
import {
  EnviarEmailClienteDialog,
} from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { ReciboSaidaPreviewModal } from "./ReciboSaidaPreviewModal";
import { normalizeReceiptForPdf } from "@/hooks/useReceiptPdfGenerator";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import { formatDate } from "@/lib/receiptUtils";
import { API_ORIGIN, getAuthToken } from "@/lib/api";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import * as nfSaidaApi from "@/lib/nfSaidaApi";
import { buscarContasAReceber, tipificarBlobDocumento } from "@/lib/financeiro-share-api";
import type {
  CategoriaDespesaOpcao,
  CategoriaOpcao,
  CotistaOpcao,
  DocumentoSaida,
  NotaOuReciboSaidaRow,
  StatusDocumentoSaida,
} from "@/lib/nfSaidaApi";

/* ─────────────────────────── types ─────────────────────────── */

type NFSaida = DocumentoSaida;

interface FormState {
  numero: string;
  cotista_aeronave_id: string;
  // preenchidos automaticamente ao selecionar o cotista (uso: exibição e PDF do recibo)
  cliente_nome: string;
  cliente_cnpj: string;
  cliente_endereco: string;
  cliente_cidade: string;
  cliente_uf: string;
  aircraft_id: string;
  aeronave: string;
  categoria_receita_id: string;
  categoria: string;
  categoria_despesa_id: string;
  categoria_despesa_subcategoria: string;
  data_criacao: string;
  data_vencimento: string;
  valor: string;
  descricao: string;
  status: StatusDocumentoSaida;
  arquivo_pdf_url: string;
}

const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const emptyForm: FormState = {
  numero: "", cotista_aeronave_id: "", cliente_nome: "", cliente_cnpj: "", cliente_endereco: "", cliente_cidade: "", cliente_uf: "",
  aircraft_id: "", aeronave: "", categoria_receita_id: "", categoria: "",
  categoria_despesa_id: "", categoria_despesa_subcategoria: "",
  data_criacao: todayLocal(),
  data_vencimento: "", valor: "", descricao: "", status: "EM_ABERTO",
  arquivo_pdf_url: "",
};

type SaidaPagamento = 'DGA_BRADESCO' | 'CONTA_COTISTA';

interface BaixaFormState {
  data_pagamento: string;
  conta_bancaria: string;
  forma_pagamento: string;
  comprovante_url: string;
  saida_pagamento: SaidaPagamento;
}

const emptyBaixaForm: BaixaFormState = {
  data_pagamento: todayLocal(),
  conta_bancaria: "",
  forma_pagamento: "PIX",
  comprovante_url: "",
  saida_pagamento: "DGA_BRADESCO",
};

const FORMAS_PAGAMENTO = ["PIX", "Transferência (TED/DOC)", "Boleto", "Dinheiro", "Cartão"];

const STATUS_OPCOES = [
  { value: "EM_ABERTO", label: "Em aberto" },
  { value: "PAGO", label: "Pago" },
];

/* ─────────────── categorias de despesa do cliente (categoria_movimentacao_cliente) ─────────────── */

interface DespesaOption {
  optionId: string;
  categoriaId: string;
  nome: string;
  subcategoria: string | null;
  label: string;
}

function buildDespesaOptions(rows: CategoriaDespesaOpcao[]): DespesaOption[] {
  const options: DespesaOption[] = [];
  for (const row of rows) {
    const subcategorias = [row.subcategoria_1, row.subcategoria_2, row.subcategoria_3, row.subcategoria_4]
      .map((s) => (s ? s.trim() : s))
      .filter((s): s is string => !!s);

    if (subcategorias.length === 0) {
      options.push({
        optionId: `${row.id}::0`,
        categoriaId: row.id,
        nome: row.nome,
        subcategoria: null,
        label: row.nome,
      });
    } else {
      subcategorias.forEach((sub, index) => {
        options.push({
          optionId: `${row.id}::${index + 1}`,
          categoriaId: row.id,
          nome: row.nome,
          subcategoria: sub,
          label: `${row.nome} — ${sub}`,
        });
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/* ─────────────────────────── helpers ─────────────────────────── */

const num = (v: string | number | null | undefined) => Number(v) || 0;
const getMonthKey = (date: string | null | undefined) => {
  const month = date?.slice(0, 7);
  return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "sem-data";
};
const getMonthName = (yearMonth: string) => {
  const [year, month] = yearMonth.split("-");
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" })
    .format(new Date(Number(year), Number(month) - 1, 1));
  return `${name.charAt(0).toLocaleUpperCase("pt-BR")}${name.slice(1)}`;
};

const paid = (status: string | null) => ["pago", "recebido"].includes((status || "").toLowerCase());
const pending = (status: string | null) => ["em_aberto", "aberto", "pendente", "atrasado", "em_atraso"].includes((status || "").toLowerCase());

const getFileNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").pop() || "arquivo";
    return decodeURIComponent(segment);
  } catch {
    return "arquivo";
  }
};
const resolveArquivoUrl = (url: string) => {
  const resolved = new URL(url, API_ORIGIN || window.location.origin);
  return ["http:", "https:"].includes(resolved.protocol) ? resolved.href : "about:blank";
};

function ConteudoDocumento({ url, titulo }: { url: string; titulo: string }) {
  const [arquivo, setArquivo] = useState<{ href: string; imagem: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setArquivo(null);
    setErro(null);
    const alvo = resolveArquivoUrl(url);
    const headers = new Headers();
    const token = getAuthToken();
    if (token && new URL(alvo, window.location.origin).origin === new URL(API_ORIGIN || window.location.origin, window.location.origin).origin) headers.set("Authorization", `Bearer ${token}`);
    void fetch(alvo, { headers, credentials: "omit", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Documento indisponível (${response.status}).`);
        const blob = await tipificarBlobDocumento(await response.blob(), alvo);
        if (!blob.size) throw new Error("O documento está vazio.");
        objectUrl = URL.createObjectURL(blob);
        setArquivo({ href: objectUrl, imagem: blob.type.startsWith("image/") });
      })
      .catch((e: unknown) => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Não foi possível carregar o documento."); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (erro) return <p role="alert" className="nf-dialog-copy">{erro}</p>;
  if (!arquivo) return <p role="status" className="nf-dialog-copy">Carregando documento…</p>;
  return arquivo.imagem
    ? <img className="nf-preview-image" src={arquivo.href} alt={titulo} />
    : <iframe className="nf-pdf-frame" src={arquivo.href} title={titulo} />;
}

type SortBy = "data" | "nome";
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: string | null }) {
  const state = paid(status) ? "paid" : pending(status) ? "pending" : "neutral";
  return <span className={`nf-badge ${state}`}>{state === "paid" ? <CheckCircle2 /> : <Clock />}{state === "paid" ? "Pago" : state === "pending" ? "Em aberto" : status || "Não informado"}</span>;
}

function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string, label: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  return (
    <UiSearchableCombobox
      items={items.filter((item) => Boolean(item.id))}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      className="h-10 min-h-10 border-[var(--fin-border)] bg-[var(--fin-surface)] text-xs text-[var(--fin-text)]"
      wrapSelectedLabel
      wrapItemLabels
    />
  );
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
  pagamento = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  pagamento?: boolean;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={`nf-modal flex flex-col gap-0 overflow-hidden p-0 ${wide ? "wide !max-w-[850px]" : "!max-w-[550px]"} ${pagamento ? "despesas-theme baixa-dialog" : ""} [&>button:last-child]:hidden`}
        aria-busy={busy}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (busy || target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader
          className={`nf-modal-head flex-row items-center justify-between space-y-0 text-left ${pagamento ? "baixa-header" : ""}`}
        >
          <div>
            <span className={`nf-eyebrow ${pagamento ? "baixa-kicker" : ""}`}>
              {pagamento ? "Financeiro Share · Entrada" : "SHARE • FINANCEIRO"}
            </span>
            <DialogTitle className="mt-1 text-[20px] font-semibold tracking-[-0.025em]">
              {title}
            </DialogTitle>
          </div>
          <button
            type="button"
            className="nf-icon"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </DialogHeader>
        <div
          className={`nf-modal-body overflow-y-auto ${pagamento ? "baixa-body" : ""}`}
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab({ aoVoltar }: { aoVoltar: () => void }) {
  const [notas, setNotas] = useState<NFSaida[]>([]);
  const [view, setView] = useState<"list" | "folders">("folders");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const receiptCreated = useRef<NotaOuReciboSaidaRow | null>(null);
  const mutationLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const notaIdempotencyKey = useRef<string | null>(null);
  const baixaIdempotencyKey = useRef<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cotistas, setCotistas] = useState<CotistaOpcao[]>([]);
  const [aeronaves, setAeronaves] = useState<{ id: string; matricula_registro: string }[]>([]);
  const [categoriasReceita, setCategoriasReceita] = useState<CategoriaOpcao[]>([]);
  const [despesaOptions, setDespesaOptions] = useState<DespesaOption[]>([]);
  const [pagamentoInicial, setPagamentoInicial] = useState<BaixaFormState>({ ...emptyBaixaForm });
  const [comprovanteUploading, setComprovanteUploading] = useState(false);
  const [contasBancarias, setContasBancarias] = useState<{ id: string; banco: string; numero_conta: string | null }[]>([]);
  const [documentType, setDocumentType] = useState<"nota" | "recibo">("nota");
  const [documentTab, setDocumentTab] = useState<"nota" | "recibo">("recibo");
  const [uploading, setUploading] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  // filtros e ordenação
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "EM_ABERTO" | "PAGO">("");
  const [sortBy, setSortBy] = useState<SortBy>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // dar baixa
  const [baixaTarget, setBaixaTarget] = useState<NFSaida | null>(null);
  const [baixaForm, setBaixaForm] = useState<BaixaFormState>(emptyBaixaForm);
  const [baixaSaving, setBaixaSaving] = useState(false);
  const [baixaUploading, setBaixaUploading] = useState(false);
  const [emailTarget, setEmailTarget] = useState<NFSaida | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailsEnviados, setEmailsEnviados] = useState<Set<string>>(new Set());
  // prévia do recibo de saída (gerar PDF → salvar → enviar por e-mail)
  const [reciboPreview, setReciboPreview] = useState<{ pdfData: any; payload: any } | null>(null);
  const [reciboSavedUrl, setReciboSavedUrl] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const downloadPdf = async (url: string, title: string) => {
    setPdfDownloading(true);
    try {
      const headers = new Headers();
      const token = getAuthToken();
      if (token && new URL(resolveArquivoUrl(url), window.location.origin).origin === new URL(API_ORIGIN, window.location.origin).origin) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(resolveArquivoUrl(url), { headers, credentials: "omit" });
      if (!response.ok) throw new Error(`PDF indisponível (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = getFileNameFromUrl(url) || `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      setToast({ type: "err", text: error instanceof Error ? error.message : "Não foi possível baixar o PDF." });
    } finally {
      setPdfDownloading(false);
    }
  };

  const mapNota = (n: NotaOuReciboSaidaRow): NFSaida => ({
    id: n.id,
    origem: "nf_saida",
    numero: n.numero ?? null,
    cotista_aeronave_id: n.cotista_aeronave_id ?? null,
    cliente_id: n.cliente_id,
    socio_id: n.socio_id,
    holding_id: n.holding_id ?? null,
    cliente_nome: n.cliente_nome,
    cliente_cnpj: n.cliente_cnpj,
    cliente_endereco: n.cliente_endereco ?? null,
    cliente_cidade: n.cliente_cidade ?? null,
    cliente_uf: n.cliente_uf ?? null,
    cliente_email: n.cliente_email ?? null,
    data_criacao: n.data_criacao ?? null,
    data_vencimento: n.data_vencimento,
    valor: n.valor_total ?? n.valor ?? null,
    email_enviado_em: n.email_enviado_em ?? null,
    categoria: n.categoria ?? null,
    descricao: n.descricao ?? null,
    status: n.status,
    arquivo_pdf_url: n.arquivo_pdf_url ?? null,
    criado_em: n.criado_em,
    atualizado_em: n.atualizado_em,
    aeronave: n.aeronave_matricula ?? null,
    aircraft_id: n.aeronave_id,
    contas_areceber_id: n.contas_areceber_id,
  });

  const mapRecibo = (r: NotaOuReciboSaidaRow): NFSaida => ({
    id: r.id,
    origem: "recibo_saida",
    numero: r.numero_recibo ?? null,
    cotista_aeronave_id: r.cotista_id ?? null,
    cliente_id: r.cliente_id,
    socio_id: r.socio_id,
    holding_id: r.holding_id ?? null,
    cliente_nome: r.cliente_nome,
    cliente_cnpj: r.cliente_cnpj,
    cliente_endereco: r.cliente_endereco ?? null,
    cliente_cidade: r.cliente_cidade ?? null,
    cliente_uf: r.cliente_uf ?? null,
    cliente_email: r.cliente_email ?? null,
    data_criacao: r.data_emissao ?? null,
    data_vencimento: r.data_vencimento,
    valor: r.valor_total ?? null,
    categoria: r.nome_categoria ?? null,
    descricao: r.descricao_servico ?? null,
    status: r.status,
    arquivo_pdf_url: r.pdf_url ?? null,
    email_enviado_em: r.email_enviado_em ?? null,
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
    aeronave: r.aeronave_matricula ?? null,
    aircraft_id: r.aeronave_id,
    contas_areceber_id: r.contas_areceber_id,
  });

  const fetchNotas = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [{ notas: nfData, recibos: recData }, contasResult] = await Promise.all([
        nfSaidaApi.buscarNotasSaida(),
        buscarContasAReceber().then((contas) => ({ contas }), () => ({ contas: [] })),
      ]);
      const merged = [...(nfData ?? []).map(mapNota), ...(recData ?? []).map(mapRecibo)].sort((a, b) =>
        (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "")
      );
      setNotas(merged);
      const contasComEmail = contasResult.contas.filter((conta) => Boolean(conta.email_enviado_em));
      const contasPorId = new Set(contasComEmail.map((conta) => conta.id));
      const nfsComEmailNoLancamento = new Set(contasComEmail.map((conta) => conta.nfSaidaId).filter(Boolean));
      setEmailsEnviados((current) => new Set([
        ...current,
        ...merged
          .filter((nota) => Boolean(nota.email_enviado_em) || nfsComEmailNoLancamento.has(nota.id) || (nota.contas_areceber_id && contasPorId.has(nota.contas_areceber_id)))
          .map((nota) => `${nota.origem}:${nota.id}`),
      ]));
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar notas." });
      setLoadError(e.message || "Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const opcoes = await nfSaidaApi.buscarOpcoesNotasSaida();
        setCotistas(opcoes.cotistas || []);
        setAeronaves(opcoes.aeronaves || []);
        setCategoriasReceita(opcoes.categoriasReceita || []);
        setDespesaOptions(buildDespesaOptions(opcoes.categoriasDespesa || []));
        setContasBancarias(opcoes.contasBancarias || []);
      } catch (e: any) {
        setToast({ type: "err", text: e.message || "Erro ao carregar opções do formulário." });
      }
    };
    loadFormData();
  }, []);

  // mapa aeronave_id → matrícula, para exibir junto ao nome do cotista no combobox
  const matriculaPorAeronave = useMemo(
    () => new Map(aeronaves.map((a) => [a.id, a.matricula_registro])),
    [aeronaves],
  );

  const totalRecibos = useMemo(() => notas.filter((documento) => documento.origem === "recibo_saida").length, [notas]);
  const totalNotas = notas.length - totalRecibos;
  const hasActiveFilters = !!searchTerm.trim() || !!dateFrom || !!dateTo || !!statusFilter;

  const filteredNotas = useMemo(() => {
    let result = notas.filter((documento) => documentTab === "recibo" ? documento.origem === "recibo_saida" : documento.origem !== "recibo_saida");
    const termo = searchTerm.trim().toLowerCase();
    if (termo) result = result.filter((documento) => [documento.numero, documento.cliente_nome, documento.aeronave, documento.descricao, documento.categoria].some((value) => value?.toLowerCase().includes(termo)));
    if (dateFrom) result = result.filter((n) => (n.data_criacao ?? "").slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((n) => (n.data_criacao ?? "").slice(0, 10) <= dateTo);
    if (statusFilter) result = result.filter((n) => statusFilter === "PAGO" ? ["pago", "recebido"].includes((n.status ?? "").toLowerCase()) : pending(n.status));

    return result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "data") {
        cmp = (a.data_criacao ?? "").localeCompare(b.data_criacao ?? "");
      } else {
        cmp = (a.cliente_nome ?? "").localeCompare(b.cliente_nome ?? "", "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [notas, documentTab, searchTerm, dateFrom, dateTo, statusFilter, sortBy, sortDir]);

  const clearFilters = () => { setSearchTerm(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); };

  const selectedDespesaOptionId = useMemo(() => {
    if (!form.categoria_despesa_id && !editingId) return "";
    const match = despesaOptions.find((option) =>
      option.categoriaId === form.categoria_despesa_id &&
      (option.subcategoria ?? "") === (form.categoria_despesa_subcategoria ?? "")
    );
    return match?.optionId ?? "";
  }, [despesaOptions, form.categoria_despesa_id, form.categoria_despesa_subcategoria]);

  const openNew = () => { setPagamentoInicial({ ...emptyBaixaForm, data_pagamento: todayLocal() }); notaIdempotencyKey.current = null; receiptCreated.current = null; setForm({ ...emptyForm, data_criacao: todayLocal() }); setEditingId(null); setDocumentType("nota"); setShowForm(true); };
  const openNewReceipt = () => { notaIdempotencyKey.current = null; receiptCreated.current = null; setForm({ ...emptyForm, data_criacao: todayLocal() }); setEditingId(null); setDocumentType("recibo"); setShowForm(true); };
  const openEdit = (n: NFSaida) => {
    if (n.origem === "recibo_saida") {
      setToast({ type: "err", text: "Recibos de saída não são editáveis por aqui — exclua e emita novamente se necessário." });
      return;
    }
    setForm({
      numero: n.numero ?? "", cotista_aeronave_id: n.cotista_aeronave_id ?? "",
      cliente_nome: n.cliente_nome ?? "", cliente_cnpj: n.cliente_cnpj ?? "",
      cliente_endereco: n.cliente_endereco ?? "", cliente_cidade: n.cliente_cidade ?? "", cliente_uf: n.cliente_uf ?? "",
      aircraft_id: n.aircraft_id ?? "", aeronave: n.aeronave ?? "",
      data_criacao: n.data_criacao?.slice(0,10) || todayLocal(),
      data_vencimento: n.data_vencimento?.slice(0,10) || "", valor: n.valor != null ? String(n.valor) : "",
      categoria_receita_id: "", categoria: n.categoria ?? "", descricao: n.descricao ?? "", status: ["pago", "recebido"].includes((n.status ?? "").toLowerCase()) ? "PAGO" : "EM_ABERTO",
      categoria_despesa_id: "", categoria_despesa_subcategoria: "",
      arquivo_pdf_url: n.arquivo_pdf_url ?? "",
    });
    notaIdempotencyKey.current = null;
    setEditingId(n.id); setDocumentType("nota"); setShowForm(true);
  };
  const closeForm = () => { notaIdempotencyKey.current = null; setShowForm(false); setEditingId(null); setDocumentType("nota"); setForm({ ...emptyForm, data_criacao: todayLocal() }); };

  // Ao escolher o cotista, deriva automaticamente aeronave/cliente_nome/cliente_cnpj —
  // no D1 cada linha de cotista_aeronave já é o par (cliente ou sócio, aeronave).
  const selecionarCotista = (cotistaAeronaveId: string) => {
    const cotista = cotistas.find((c) => c.cotista_aeronave_id === cotistaAeronaveId);
    if (!cotista) {
      setForm((current) => ({ ...current, cotista_aeronave_id: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      cotista_aeronave_id: cotista.cotista_aeronave_id,
      aircraft_id: cotista.aeronave_id,
      aeronave: matriculaPorAeronave.get(cotista.aeronave_id) || "",
      cliente_nome: cotista.nome,
      cliente_cnpj: cotista.documento ? `${cotista.tipo_cotista === "socio_hold" ? "CPF" : "CNPJ"}: ${cotista.documento}` : "",
      cliente_endereco: cotista.endereco || "",
      cliente_cidade: cotista.cidade || "",
      cliente_uf: cotista.uf || "",
    }));
  };

  const uploadDocument = async (file: File) => {
    setUploading(true); setToast(null);
    try {
      const { url } = await nfSaidaApi.enviarAnexoDocumentoSaida(file);
      setForm((current) => ({ ...current, arquivo_pdf_url: url }));
      setToast({ type: "ok", text: "Arquivo enviado com sucesso." });
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao enviar arquivo." });
    } finally { setUploading(false); }
  };

  const cotistaSelecionado = cotistas.find(c => c.cotista_aeronave_id === form.cotista_aeronave_id);
  const pagamentoNaCriacao = documentType === "nota" && !editingId && form.status === "PAGO";

  const uploadComprovanteInicial = async (file: File) => {
    setComprovanteUploading(true); setToast(null);
    try {
      const { url } = await nfSaidaApi.enviarAnexoDocumentoSaida(file);
      setPagamentoInicial(current => ({ ...current, comprovante_url: url }));
    } catch (error: any) { setToast({ type: "err", text: error.message || "Erro ao enviar comprovante." }); }
    finally { setComprovanteUploading(false); }
  };

  const save = async () => {
    if (documentType === "nota" && !form.numero.trim()) { setToast({ type: "err", text: "Informe o número da nota." }); return; }
    if (!form.cotista_aeronave_id) { setToast({ type: "err", text: "Selecione o cotista (cliente ou sócio)." }); return; }
    if (!form.categoria_receita_id && !editingId) { setToast({ type: "err", text: "Selecione a categoria." }); return; }
    if (!form.categoria_despesa_id && !editingId) { setToast({ type: "err", text: "Selecione a categoria de despesa do cliente (perna 'cliente' do lançamento)." }); return; }
    if (!form.data_criacao) { setToast({ type: "err", text: "Informe a data de emissão." }); return; }
    if (!Number.isFinite(Number(form.valor)) || !(Number(form.valor) > 0)) { setToast({ type: "err", text: "Informe um valor maior que zero." }); return; }
    if (pagamentoNaCriacao && !pagamentoInicial.data_pagamento) { setToast({ type: "err", text: "Informe a data do pagamento." }); return; }
    if (pagamentoNaCriacao && !pagamentoInicial.conta_bancaria) { setToast({ type: "err", text: "Selecione a conta bancária do recebimento." }); return; }
    if (comprovanteUploading) return;
    if (mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true); setToast(null);
    try {
      const despesaSelecionada = despesaOptions.find((option) => option.optionId === selectedDespesaOptionId);
      const dataVencimentoFinal = form.data_vencimento || form.data_criacao;

      if (documentType === "recibo") {
        const descricaoServico = form.descricao.trim() || "Serviços aeronáuticos";

        const pdfData = await normalizeReceiptForPdf({
          receipt_number: "Será gerado ao finalizar",
          payer_name: form.cliente_nome.trim(),
          payer_document: form.cliente_cnpj.trim(),
          payer_address: form.cliente_endereco.trim(),
          payer_city: form.cliente_cidade.trim(),
          payer_state: form.cliente_uf.trim(),
          service_description: descricaoServico,
          receipt_type: "pagamento",
          issue_date: form.data_criacao,
          max_payment_date: dataVencimentoFinal,
          nome_categoria: form.categoria,
          valor: Number(form.valor) || 0,
        });

        setReciboPreview({
          pdfData,
          payload: {
            numero: "",
            descricaoServico,
            dataVencimentoFinal,
            categoriaDespesaId: despesaSelecionada?.categoriaId || form.categoria_despesa_id,
            categoriaDespesaSubcategoria: despesaSelecionada?.subcategoria ?? null,
          },
        });
        setReciboSavedUrl(null);
        return;
      } else {
        if (editingId) {
          await nfSaidaApi.atualizarNotaSaida(editingId, {
            numero: form.numero.trim(),
            cotista_aeronave_id: form.cotista_aeronave_id,
            aeronave_id: form.aircraft_id,
            data_emissao: form.data_criacao,
            data_vencimento: dataVencimentoFinal,
            valor_total: Number(form.valor) || 0,
            nome_categoria: form.categoria,
            descricao_servico: form.descricao.trim() || "Serviços aeronáuticos",
            arquivo_pdf_url: form.arquivo_pdf_url.trim() || null,
          });
          setToast({ type: "ok", text: "Nota fiscal atualizada. Os lançamentos financeiros vinculados permanecem com seus valores anteriores." });
        } else {
          notaIdempotencyKey.current ??= crypto.randomUUID();
          const { nota } = await nfSaidaApi.criarNotaSaida({
            numero: form.numero.trim(),
            cotista_aeronave_id: form.cotista_aeronave_id,
            aeronave_id: form.aircraft_id,
            categoria_receita_id: form.categoria_receita_id,
            categoria_receita_nome: form.categoria,
            categoria_id: despesaSelecionada?.categoriaId || form.categoria_despesa_id || null,
            subcategoria_1: despesaSelecionada?.subcategoria ?? null,
            data_emissao: form.data_criacao,
            data_vencimento: dataVencimentoFinal,
            valor_total: Number(form.valor) || 0,
            nome_categoria: form.categoria,
            descricao_servico: form.descricao.trim() || "Serviços aeronáuticos",
            status: form.status,
            arquivo_pdf_url: form.arquivo_pdf_url.trim() || null,
            idempotency_key: notaIdempotencyKey.current,
            ...(pagamentoNaCriacao ? {
              data_pagamento: pagamentoInicial.data_pagamento,
              conta_bancaria_id: pagamentoInicial.conta_bancaria,
              forma_pagamento: pagamentoInicial.forma_pagamento || null,
              comprovante_url: pagamentoInicial.comprovante_url || null,
              ...(cotistaSelecionado?.socio_id ? { saida_pagamento: pagamentoInicial.saida_pagamento } : {}),
            } : {}),
          });
          if (!nota?.id) throw new Error("O servidor não confirmou a gravação da nota fiscal.");
        }
        fetchNotas();
        avisarAtualizacaoFinanceiro();
      }
      closeForm();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { mutationLock.current = false; setSaving(false); }
  };

  /** Cria o recibo primeiro para que o Worker atribua a sequência oficial; só depois gera e salva o PDF. */
  const confirmReciboSave = async (previewBlob: Blob) => {
    if (!reciboPreview || reciboSavedUrl) return;
    const { descricaoServico, dataVencimentoFinal, categoriaDespesaId, categoriaDespesaSubcategoria } = reciboPreview.payload;
    if (mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true); setToast(null);
    try {
      if (!(previewBlob instanceof Blob)) {
        throw new Error("Não foi possível obter o PDF do recibo para salvar.");
      }

      const { recibo } = receiptCreated.current ? { recibo: receiptCreated.current } : await nfSaidaApi.criarReciboSaida({ cotista_aeronave_id: form.cotista_aeronave_id, aeronave_id: form.aircraft_id, categoria_receita_id: form.categoria_receita_id, categoria_receita_nome: form.categoria, categoria_despesa_id: categoriaDespesaId, categoria_despesa_subcategoria: categoriaDespesaSubcategoria, data_emissao: form.data_criacao, data_vencimento: dataVencimentoFinal, valor_total: Number(form.valor) || 0, descricao_servico: descricaoServico, status: form.status });
      if (!recibo?.id) throw new Error("O servidor não confirmou a criação do recibo de saída.");
      receiptCreated.current = recibo;
      const numeroRecibo = String(recibo.numero_recibo || "");
      if (!numeroRecibo) throw new Error("O servidor não retornou o número oficial do recibo de saída.");
      // O número só é atribuído pelo Worker após a criação. Regerar aqui
      // evita salvar um PDF com o placeholder "Será gerado ao finalizar".
      const pdfOficial = await gerarReciboPdf({
        numero: numeroRecibo,
        valor: Number(form.valor) || 0,
        descricao: descricaoServico,
        data: form.data_criacao,
        pagadorNome: form.cliente_nome.trim(),
        pagadorDocumento: form.cliente_cnpj.trim(),
        pagadorEndereco: form.cliente_endereco.trim(),
        pagadorCidade: form.cliente_cidade.trim(),
        pagadorUf: form.cliente_uf.trim(),
        emissorNome: "SHARE BRASIL SERVICOS AEROPORTUARIOS",
        emissorDocumento: "CNPJ: 30.898.549/0001-06",
      });
      const { url: reciboUrl } = await nfSaidaApi.enviarAnexoDocumentoSaida(pdfOficial, `${numeroRecibo}.pdf`, { origem: "recibo_saida", documentoId: recibo.id });
      if (!reciboUrl) throw new Error("O PDF foi gerado, mas o servidor não retornou o endereço do arquivo.");
      const atualizado = await nfSaidaApi.atualizarReciboSaida(recibo.id, { pdf_url: reciboUrl });
      setReciboSavedUrl(reciboUrl); setEmailTarget(mapRecibo(atualizado.recibo)); avisarAtualizacaoFinanceiro();
      setToast({ type: "ok", text: `Recibo ${numeroRecibo} salvo com PDF e lançamentos financeiros gerados.` }); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar o recibo." }); }
    finally { mutationLock.current = false; setSaving(false); }
  };
  const closeReciboPreview = () => {
    if (saving) return;
    if (receiptCreated.current && !reciboSavedUrl) { setToast({type: "err", text: "O recibo já foi criado. Tente salvar o PDF novamente antes de fechar."}); return; }
    receiptCreated.current = null;
    setReciboPreview(null);
    if (reciboSavedUrl) { setReciboSavedUrl(null); closeForm(); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    if (mutationLock.current) return;
    mutationLock.current = true;
    setDeleting(true);
    try {
      const target = notas.find((n) => n.id === deleteId && (documentTab === "recibo" ? n.origem === "recibo_saida" : n.origem === "nf_saida"));
      if (!target) throw new Error("Documento não encontrado. Atualize a lista e tente novamente.");
      await nfSaidaApi.excluirNotaOuReciboSaida(deleteId, target?.origem === "recibo_saida" ? "recibo_saida" : "nf_saida");
      setToast({ type: "ok", text: target?.origem === "recibo_saida" ? "Recibo de saída excluído." : "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { mutationLock.current = false; setDeleting(false); }
  };

  /* ─────────────── dar baixa (registrar recebimento) ─────────────── */


  const openBaixa = (n: NFSaida) => { baixaIdempotencyKey.current = crypto.randomUUID(); setBaixaTarget(n); setBaixaForm({ ...emptyBaixaForm, data_pagamento: todayLocal() }); };
  const closeBaixa = () => { baixaIdempotencyKey.current = null; setBaixaTarget(null); setBaixaForm({ ...emptyBaixaForm, data_pagamento: todayLocal() }); };

  const uploadComprovante = async (file: File) => {
    setBaixaUploading(true); setToast(null);
    try {
      const { url } = await nfSaidaApi.enviarAnexoDocumentoSaida(file);
      setBaixaForm((current) => ({ ...current, comprovante_url: url }));
      setToast({ type: "ok", text: "Comprovante enviado." });
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao enviar comprovante." });
    } finally { setBaixaUploading(false); }
  };

  const confirmBaixa = async () => {
    if (!baixaTarget?.contas_areceber_id) return;
    if (!baixaForm.data_pagamento) { setToast({ type: "err", text: "Informe a data do pagamento." }); return; }
    if (baixaTarget.socio_id && !baixaForm.saida_pagamento) { setToast({ type: "err", text: "Selecione a saída do pagamento." }); return; }
    if (!baixaForm.conta_bancaria) { setToast({ type: "err", text: "Selecione a conta bancária do recebimento." }); return; }
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBaixaSaving(true); setToast(null);
    try {
      const chavePagamento = baixaIdempotencyKey.current ?? crypto.randomUUID();
      baixaIdempotencyKey.current = chavePagamento;
      await nfSaidaApi.darBaixaNotaOuReciboSaida(baixaTarget.id, {
        origem: baixaTarget.origem === "recibo_saida" ? "recibo_saida" : "nf_saida",
        data_pagamento: baixaForm.data_pagamento,
        conta_bancaria: baixaForm.conta_bancaria,
        forma_pagamento: baixaForm.forma_pagamento || null,
        ...(baixaTarget.socio_id ? { saida_pagamento: baixaForm.saida_pagamento } : {}),
        comprovante_url: baixaForm.comprovante_url || null,
        pagamentos: [{
          idempotency_key: chavePagamento,
          tipo_pagador: baixaTarget.socio_id && baixaForm.saida_pagamento === "DGA_BRADESCO" ? "HOLDING" : "COTISTA",
          pagador_cotista_id: baixaTarget.socio_id && baixaForm.saida_pagamento === "DGA_BRADESCO" ? null : baixaTarget.cotista_aeronave_id,
          pagador_holding_id: baixaTarget.socio_id && baixaForm.saida_pagamento === "DGA_BRADESCO" ? baixaTarget.holding_id ?? null : null,
          ...(baixaTarget.socio_id ? { saida_pagamento: baixaForm.saida_pagamento } : {}),
          valor_centavos: Math.round(Number(baixaTarget.valor ?? 0) * 100),
          data_pagamento: baixaForm.data_pagamento,
          conta_bancaria_id: baixaForm.conta_bancaria || null,
          forma_pagamento: baixaForm.forma_pagamento || null,
          comprovante_url: baixaForm.comprovante_url || null,
        }],
      });

      setToast({ type: "ok", text: "Baixa registrada: receita da Share recebida e espelho financeiro atualizado." });
      closeBaixa();
      avisarAtualizacaoFinanceiro();
      fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao dar baixa." });
    } finally { mutationLock.current = false; setBaixaSaving(false); }
  };

  useEffect(() => { setPage(1); }, [searchTerm, dateFrom, dateTo, statusFilter, sortBy, sortDir, documentTab, mesSelecionado, view]);
  // Quantas linhas cabem na área da tabela (cabeçalho ≈ 30px, linha ≈ 44px): a página nunca precisa rolar.
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const calc = () => setPageSize(Math.max(4, Math.floor((el.clientHeight - 30) / 44)));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, mesSelecionado, loading, documentTab]);
  const scopedRows = useMemo(() => {
    return mesSelecionado ? filteredNotas.filter(n => getMonthKey(n.data_criacao) === mesSelecionado) : filteredNotas;
  }, [filteredNotas, mesSelecionado]);
  const groups = useMemo(() => {
    const map = new Map<string, NFSaida[]>();
    filteredNotas.forEach((nota) => {
      const key = getMonthKey(nota.data_criacao);
      map.set(key, [...(map.get(key) ?? []), nota]);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a === "sem-data" ? 1 : b === "sem-data" ? -1 : b.localeCompare(a))
      .map(([key, rows]) => {
        if (key === "sem-data") {
          return { key, ano: "Data não informada", mes: "Data não informada", rows };
        }
        const [ano, mes] = key.split("-");
        return {
          key,
          ano,
          mes: getMonthName(key),
          rows,
        };
      });
  }, [filteredNotas]);
  const heading = mesSelecionado
    ? mesSelecionado === "sem-data" ? "Data não informada" : `${getMonthName(mesSelecionado)} de ${mesSelecionado.slice(0, 4)}`
    : view === "folders" ? "Documentos por mês" : "Todos os documentos";
  const pageCount = Math.max(1, Math.ceil(scopedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = scopedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const invalidPeriod = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const formBusy = saving || uploading || comprovanteUploading;
  const formField = <K extends keyof FormState,>(key: K, value: FormState[K]) => setForm(current => ({...current, [key]: value}));
  const actions = (n: NFSaida) => <div className="nf-row-actions">
    <button className="nf-icon" title="Visualizar documento" aria-label={`Visualizar documento ${n.numero || ""}`} disabled={!n.arquivo_pdf_url} onClick={() => setPdfViewer({url: n.arquivo_pdf_url!, title: n.numero || "Documento"})}><FileText /></button>
    <button className={`nf-icon nf-email-action ${emailsEnviados.has(`${n.origem}:${n.id}`) ? "success" : ""}`} title={emailsEnviados.has(`${n.origem}:${n.id}`) ? "E-mail enviado — enviar novamente" : "Enviar por e-mail"} aria-label={`Enviar ${n.numero || "documento"} por e-mail`} onClick={() => {setEmailTarget(n); setEmailOpen(true);}}><Mail /><span>{emailsEnviados.has(`${n.origem}:${n.id}`) ? "Enviado" : "Enviar"}</span></button>
    {pending(n.status) && n.contas_areceber_id && <button className="nf-icon success" title="Registrar recebimento" aria-label={`Registrar recebimento de ${n.numero || "documento"}`} onClick={() => openBaixa(n)}><Banknote /></button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button className="nf-icon" title="Mais ações" aria-label={`Mais ações de ${n.numero || "documento"}`}><MoreVertical /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {n.origem === "nf_saida" && <DropdownMenuItem onSelect={() => openEdit(n)}><Pencil />Editar</DropdownMenuItem>}
        <DropdownMenuItem className="text-red-400 focus:text-red-400" onSelect={() => setDeleteId(n.id)}><Trash2 />Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
  const feedback = toast && <div role={toast.type === "err" ? "alert" : "status"} className={`nf-notice ${toast.type === "err" ? "error" : "success"}`}><span>{toast.text}</span><button type="button" className="nf-icon" aria-label="Dispensar mensagem" onClick={() => setToast(null)}><X /></button></div>;

  return <div className="nf-workspace">
    <style>{STYLES}</style>

    <header className="nf-header nf-documents-header">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={aoVoltar}
          className="size-8 shrink-0"
          aria-label="Voltar ao dashboard"
          title="Voltar ao dashboard"
        >
          <ArrowLeft size={16} />
        </Button>
        <div className="nf-eyebrow"><span className="nf-dot" /> FINANCEIRO / DOCUMENTOS DE SAÍDA</div>
      </div>
      <div className="nf-header-actions"><button className="nf-btn primary" onClick={documentTab === "recibo" ? openNewReceipt : openNew}><Plus />{documentTab === "recibo" ? "Emitir recibo" : "Nova nota fiscal"}</button></div>
    </header>
    {!showForm && !baixaTarget && !deleteId && feedback}
    <section className="nf-panel" aria-label="Documentos">
      <div className="nf-panel-top"><div className="nf-segment" aria-label="Tipo de documento">{([['recibo', 'Recibos', totalRecibos], ['nota', 'Notas fiscais', totalNotas]] as const).map(([value, label, count]) => <button key={value} aria-pressed={documentTab === value} className={documentTab === value ? "active" : ""} onClick={() => {setDocumentTab(value); setMesSelecionado(null);}}>{label}<span>{count}</span></button>)}</div>
      <div className="nf-toolbar">
        <label className="nf-search">
          <Search />
          <span className="nf-sr">Buscar documentos</span>
          <Input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar cotista, número, aeronave…" className="border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </label>
        <Select value={statusFilter || "__TODOS__"} onValueChange={(v) => setStatusFilter(v === "__TODOS__" ? "" : (v as typeof statusFilter))}>
          <SelectTrigger aria-label="Filtrar por status" className="h-8 text-xs">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__TODOS__">Todos os status</SelectItem>
            {STATUS_OPCOES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={`${sortBy}:${sortDir}`} onValueChange={(v) => { const [by, dir] = v.split(":") as [SortBy, SortDir]; setSortBy(by); setSortDir(dir); }}>
          <SelectTrigger aria-label="Ordenar documentos" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="data:desc">Mais recentes</SelectItem>
            <SelectItem value="data:asc">Mais antigos</SelectItem>
            <SelectItem value="nome:asc">Cotista: A–Z</SelectItem>
            <SelectItem value="nome:desc">Cotista: Z–A</SelectItem>
          </SelectContent>
        </Select>
        <button className={`nf-btn ${showFilterPanel ? "selected" : ""}`} aria-expanded={showFilterPanel} aria-controls="nf-period" onClick={() => setShowFilterPanel(!showFilterPanel)}><CalendarDays /> Período{(dateFrom || dateTo) && <span className="nf-dot" />}</button>
      </div></div>
      {showFilterPanel && <div id="nf-period" className="nf-period"><Field className="flex-1 min-w-[130px] gap-1.5"><FieldLabel className="text-[11px] text-muted-foreground">Emissão a partir de</FieldLabel><Input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></Field><Field className="flex-1 min-w-[130px] gap-1.5"><FieldLabel className="text-[11px] text-muted-foreground">Emissão até</FieldLabel><Input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></Field><button className="nf-btn subtle" onClick={() => {setDateFrom(''); setDateTo('');}}>Limpar período</button>{invalidPeriod && <p className="nf-error-text" role="alert">A data final deve ser igual ou posterior à inicial.</p>}</div>}
      <div className="nf-list-heading"><div><h2>{heading}</h2><p>{loading ? "Carregando…" : `${scopedRows.length} documentos encontrados`}{hasActiveFilters && <button className="nf-text-btn" onClick={clearFilters}>Limpar filtros</button>}</p></div><div className="nf-view-toggle"><button className={view === "list" ? "active" : ""} aria-label="Visualização em lista" aria-pressed={view === "list"} onClick={() => {setView('list'); setMesSelecionado(null);}}><LayoutList /></button><button className={view === "folders" ? "active" : ""} aria-label="Visualização por mês e ano" aria-pressed={view === "folders"} onClick={() => {setView('folders'); setMesSelecionado(null);}}><LayoutGrid /></button></div></div>
      {mesSelecionado && <div className="nf-back"><button className="nf-text-btn" onClick={() => setMesSelecionado(null)}><ArrowLeft /> Todos os meses</button></div>}
      {loading ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><h3>Carregando documentos</h3><p>Organizando suas informações financeiras.</p></div> : loadError ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível carregar</h3><p>{loadError}</p><button className="nf-btn" onClick={() => void fetchNotas()}>Tentar novamente</button></div> : !scopedRows.length ? <div className="nf-empty"><Search /><h3>{hasActiveFilters ? "Nenhum resultado encontrado" : "Seu arquivo começa aqui"}</h3><p>{hasActiveFilters ? "Ajuste a busca ou o período para encontrar seus documentos." : "Emita o primeiro documento para acompanhar os recebimentos."}</p><button className="nf-btn" onClick={hasActiveFilters ? clearFilters : documentTab === 'recibo' ? openNewReceipt : openNew}>{hasActiveFilters ? "Limpar filtros" : "Criar documento"}</button></div> : view === "folders" && !mesSelecionado ? <div className="nf-month-groups space-y-6">{[...new Set(groups.map(group => group.ano))].map(ano => <section className="nf-month-year space-y-3" key={ano}><h3 className="mx-[28px] text-center text-xs font-semibold uppercase tracking-[.1em] text-[rgba(195,210,216,1)]">{ano}</h3><div className="nf-folders">{groups.filter(group => group.ano === ano).map(group => <FolderCard key={group.key} name={group.mes} description={group.ano === "Data não informada" ? "Emissão desconhecida" : group.ano} count={group.rows.length} onClick={() => setMesSelecionado(group.key)} />)}</div></section>)}</div> : <>
        <div className="nf-table-wrap" ref={tableWrapRef}><table className="nf-table"><caption className="nf-sr">Documentos financeiros de saída</caption><thead><tr><th scope="col">Documento / cotista</th><th scope="col">Aeronave</th><th scope="col">Emissão / vencimento</th><th scope="col">Categoria</th><th scope="col" className="right">Valor</th><th scope="col">Status</th><th scope="col" className="right">Ações</th></tr></thead><tbody>{visibleRows.map(n => <tr key={`${n.origem}:${n.id}`}><td><div className="nf-doc-cell"><span className="nf-doc-icon"><FileText /></span><div><strong>{n.numero || 'Sem número'}</strong><span title={n.cliente_nome || ''}>{n.cliente_nome || 'Cotista não informado'}</span>{n.descricao && <small title={n.descricao}>{n.descricao}</small>}</div></div></td><td><span className="nf-aircraft"><Plane />{n.aeronave || '—'}</span></td><td><div className="nf-dates"><span>{n.data_criacao ? formatDate(n.data_criacao.slice(0,10)) : '—'}</span><small className={pending(n.status) && n.data_vencimento && n.data_vencimento.slice(0,10) < todayLocal() ? 'nf-late' : ''}>Venc. {n.data_vencimento ? formatDate(n.data_vencimento.slice(0,10)) : '—'}</small></div></td><td><span className="nf-category" title={n.categoria || ''}>{n.categoria || 'Sem categoria'}</span></td><td className="right nf-amount">{formatBRL(num(n.valor))}</td><td><StatusBadge status={n.status} /></td><td>{actions(n)}</td></tr>)}</tbody></table></div>
        <div className="nf-mobile-docs">{visibleRows.map(n => <article className="nf-mobile-doc" key={`${n.origem}:${n.id}`}><header><span className="nf-doc-icon"><FileText /></span><div><strong>{n.numero || 'Sem número'}</strong><small>{n.aeronave || 'Sem aeronave'}</small></div><StatusBadge status={n.status} /></header><h3>{n.cliente_nome || 'Cotista não informado'}</h3><p>{n.descricao || n.categoria || 'Sem descrição'}</p><dl><div><dt>Valor</dt><dd className="nf-amount">{formatBRL(num(n.valor))}</dd></div><div><dt>Emissão</dt><dd>{n.data_criacao ? formatDate(n.data_criacao.slice(0,10)) : '—'}</dd></div><div><dt>Vencimento</dt><dd>{n.data_vencimento ? formatDate(n.data_vencimento.slice(0,10)) : '—'}</dd></div></dl><footer><span className="nf-category">{n.categoria || 'Sem categoria'}</span>{actions(n)}</footer></article>)}</div>
        <footer className="nf-pagination"><span>Exibindo {scopedRows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, scopedRows.length)} de {scopedRows.length}</span><div><button className="nf-icon" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft /></button><span>{currentPage} / {pageCount}</span><button className="nf-icon" aria-label="Próxima página" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight /></button></div></footer>
      </>}
    </section>

    {showForm && !reciboPreview && <Modal title={editingId ? 'Editar nota fiscal' : documentType === 'recibo' ? 'Emitir recibo de saída' : 'Nova nota fiscal'} onClose={closeForm} busy={formBusy} wide>
      <form onSubmit={e => {e.preventDefault(); void save();}}>
        {feedback}
        {editingId && <p className="nf-info">Esta edição altera o documento. Os lançamentos financeiros já vinculados não são recalculados.</p>}
        <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>01</span> Documento e cotista</legend><div className="nf-form-grid">
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Número {documentType === 'nota' && '*'}</FieldLabel><Input required={documentType === 'nota'} readOnly={documentType === 'recibo'} value={documentType === 'recibo' ? 'Gerado ao finalizar' : form.numero} onChange={e => formField('numero', e.target.value)} className="h-10" /></Field>
          <Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Cotista / aeronave *</FieldLabel><SearchableCombobox items={cotistas.map(c => ({id: c.cotista_aeronave_id, label: `${c.nome} · ${matriculaPorAeronave.get(c.aeronave_id) || 'Sem matrícula'}`}))} value={form.cotista_aeronave_id} onChange={selecionarCotista} placeholder="Selecione o cotista" searchPlaceholder="Buscar cotista..." emptyMessage="Nenhum cotista encontrado." /></Field>
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Aeronave</FieldLabel><Input readOnly value={form.aeronave} placeholder="Vinculada ao cotista" className="h-10" /></Field>
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Emissão *</FieldLabel><Input required type="date" value={form.data_criacao} onChange={e => formField('data_criacao', e.target.value)} className="h-10" /></Field>
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Vencimento</FieldLabel><Input type="date" value={form.data_vencimento} onChange={e => formField('data_vencimento', e.target.value)} className="h-10" /><small className="text-[11px] text-muted-foreground">Se vazio, utiliza a data de emissão.</small></Field>
        </div></fieldset>
        <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>02</span> Valores e classificação</legend><div className="nf-form-grid">
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Valor (R$) *</FieldLabel><Input required type="number" inputMode="decimal" min="0.01" step="0.01" value={form.valor} onChange={e => formField('valor', e.target.value)} placeholder="0,00" className="h-10 tabular-nums" /></Field>
          <Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Categoria de receita {editingId ? '' : '*'}</FieldLabel><SearchableCombobox items={categoriasReceita.map(c => ({id:c.id, label:c.nome}))} value={form.categoria_receita_id || form.categoria} onChange={(id, label) => setForm(current => ({...current, categoria_receita_id:id, categoria:label}))} placeholder={form.categoria || "Selecione a categoria"} searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." /></Field>
          {!editingId && <Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Categoria de despesa do cliente *</FieldLabel><SearchableCombobox items={despesaOptions.map(o => ({id:o.optionId, label:o.label}))} value={selectedDespesaOptionId} onChange={id => {const option = despesaOptions.find(o => o.optionId === id); setForm(current => ({...current, categoria_despesa_id:option?.categoriaId || '', categoria_despesa_subcategoria:option?.subcategoria || ''}));}} placeholder="Selecione a classificação" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." /></Field>}
          <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Status</FieldLabel><Select disabled={!!editingId} value={form.status} onValueChange={v => formField('status', v as StatusDocumentoSaida)}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPCOES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field className="span-3 gap-1.5"><FieldLabel className="text-xs font-medium">Descrição</FieldLabel><Textarea rows={3} value={form.descricao} onChange={e => formField('descricao', e.target.value)} placeholder="Descreva o serviço ou a cobrança…" /></Field>
        </div></fieldset>
        {pagamentoNaCriacao && <fieldset disabled={formBusy} className="nf-fieldset">
          <legend><span>03</span> Dados do pagamento</legend>
          <p className="nf-info">A nota será criada com o recebimento da Share e a despesa do cotista quitados.</p>
          <div className="nf-form-grid two">
            <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Data do pagamento *</FieldLabel><Input required type="date" value={pagamentoInicial.data_pagamento} onChange={e => setPagamentoInicial(current => ({ ...current, data_pagamento: e.target.value }))} className="h-10" /></Field>
            <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Forma de pagamento</FieldLabel><Select value={pagamentoInicial.forma_pagamento} onValueChange={v => setPagamentoInicial(current => ({ ...current, forma_pagamento: v }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{FORMAS_PAGAMENTO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
            {cotistaSelecionado?.socio_id && <Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Saída do pagamento</FieldLabel><Select value={pagamentoInicial.saida_pagamento} onValueChange={v => setPagamentoInicial(current => ({ ...current, saida_pagamento: v as SaidaPagamento }))}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DGA_BRADESCO">DGA - BRADESCO</SelectItem><SelectItem value="CONTA_COTISTA">CONTA COTISTA</SelectItem></SelectContent></Select><small className="text-[11px] text-muted-foreground">DGA - BRADESCO: pago pela conta da holding. CONTA COTISTA: pago diretamente pelo cotista.</small></Field>}
            <Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Conta bancária do recebimento *</FieldLabel><Select value={pagamentoInicial.conta_bancaria || "__NONE__"} onValueChange={v => setPagamentoInicial(current => ({ ...current, conta_bancaria: v === "__NONE__" ? "" : v }))}><SelectTrigger className="h-10"><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent><SelectItem value="__NONE__">Selecione a conta</SelectItem>{contasBancarias.filter(c => Boolean(c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.banco}{c.numero_conta ? ` • ${c.numero_conta}` : ''}</SelectItem>)}</SelectContent></Select></Field>
            <label className="nf-upload span-2"><Upload /><span><strong>{comprovanteUploading ? 'Enviando comprovante…' : pagamentoInicial.comprovante_url ? getFileNameFromUrl(pagamentoInicial.comprovante_url) : 'Anexar comprovante de pagamento'}</strong><small>PDF, PNG, JPG ou WebP • até 20 MB</small></span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 20 * 1024 * 1024) setToast({ type: 'err', text: 'O comprovante deve ter até 20 MB.' }); else void uploadComprovanteInicial(file); } e.target.value = ''; }} /></label>
            {pagamentoInicial.comprovante_url && <button type="button" className="nf-text-btn" onClick={() => setPagamentoInicial(current => ({ ...current, comprovante_url: '' }))}>Remover comprovante</button>}
          </div>
        </fieldset>}
        {documentType === 'nota' && <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>{pagamentoNaCriacao ? '04' : '03'}</span> Documento anexo</legend><label className="nf-upload"><Upload /><span><strong>{uploading ? 'Enviando arquivo…' : form.arquivo_pdf_url ? getFileNameFromUrl(form.arquivo_pdf_url) : 'Selecione o PDF ou imagem da nota'}</strong><small>PDF, PNG, JPG ou WebP • até 20 MB</small></span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {const file = e.target.files?.[0]; if (file) {if (file.size > 20 * 1024 * 1024) setToast({type:'err',text:'O arquivo deve ter até 20 MB.'}); else void uploadDocument(file);} e.target.value='';}} /></label>{form.arquivo_pdf_url && <button type="button" className="nf-text-btn" onClick={() => formField('arquivo_pdf_url','')}>Remover vínculo do anexo</button>}</fieldset>}
        <footer className="nf-modal-footer"><button type="button" className="nf-btn" disabled={formBusy} onClick={closeForm}>Cancelar</button><button className="nf-btn primary" disabled={formBusy} type="submit">{saving ? 'Salvando…' : uploading ? 'Enviando anexo…' : editingId ? 'Salvar alterações' : documentType === 'recibo' ? 'Revisar recibo' : 'Criar nota fiscal'}<ArrowUpRight /></button></footer>
      </form>
    </Modal>}

    <ReciboSaidaPreviewModal open={!!reciboPreview} data={reciboPreview?.pdfData ?? null} saving={saving} savedUrl={reciboSavedUrl} onClose={closeReciboPreview} onConfirm={confirmReciboSave} onError={error => setToast({type:'err',text:error instanceof Error ? error.message : 'Não foi possível gerar o PDF.'})} onSendEmail={() => {if (emailTarget) setEmailOpen(true);}} />
    {pdfViewer && <Modal title={pdfViewer.title} onClose={() => setPdfViewer(null)} wide>
      <ConteudoDocumento url={pdfViewer.url} titulo={pdfViewer.title} />
      <footer className="nf-modal-footer"><button className="nf-btn" onClick={() => setPdfViewer(null)}>Fechar</button><button className="nf-btn primary" disabled={pdfDownloading} onClick={() => void downloadPdf(pdfViewer.url,pdfViewer.title)}><Download />{pdfDownloading ? 'Baixando…' : 'Baixar arquivo'}</button></footer>
    </Modal>}
    {emailTarget && <EnviarEmailClienteDialog open={emailOpen} onOpenChange={setEmailOpen} onSent={() => setEmailsEnviados(current => new Set(current).add(`${emailTarget.origem}:${emailTarget.id}`))} assuntoSugerido={`${emailTarget.origem === 'recibo_saida' ? 'Recibo' : 'Nota fiscal'} de saída ${emailTarget.numero || 'sem número'} — ${emailTarget.cliente_nome || ''}`} mensagemSugerida={`Olá${emailTarget.cliente_nome ? ` ${emailTarget.cliente_nome}` : ''},\n\nSegue a documentação de saída emitida pela Share.\n\nNúmero: ${emailTarget.numero || '—'}\nValor: ${formatBRL(num(emailTarget.valor))}\n\nAtenciosamente,\nEquipe Share Brasil`} destinatarioInicial={emailTarget.cliente_email || ''} referencias={[`${emailTarget.origem}:${emailTarget.id}`]} anexos={emailTarget.arquivo_pdf_url ? [{id:`${emailTarget.origem}:${emailTarget.id}`,url:emailTarget.arquivo_pdf_url,label:emailTarget.origem === 'recibo_saida' ? 'Recibo de saída' : 'Nota fiscal de saída',filename:getFileNameFromUrl(emailTarget.arquivo_pdf_url)}] : []} />}
    {deleteId && <Modal title="Excluir documento" onClose={() => setDeleteId(null)} busy={deleting}>{feedback}<div className="nf-confirm-icon"><Trash2 /></div><p className="nf-dialog-copy">O documento, o PDF e os lançamentos financeiros vinculados serão removidos. Esta ação não pode ser desfeita.</p><footer className="nf-modal-footer"><button className="nf-btn" disabled={deleting} onClick={() => setDeleteId(null)}>Manter documento</button><button className="nf-btn destructive" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Excluindo…' : 'Excluir documento'}</button></footer></Modal>}
    {baixaTarget && <Modal title="Registrar recebimento" onClose={closeBaixa} busy={baixaSaving || baixaUploading} pagamento>
      <form onSubmit={e => {e.preventDefault(); void confirmBaixa();}}>{feedback}<BaixaResumo descricao={baixaTarget.descricao || "Documento de saída"} detalhe={`${baixaTarget.cliente_nome || "Cliente"} · Documento ${baixaTarget.numero || "sem número"}`} valor={formatBRL(num(baixaTarget.valor))} rotuloValor="Valor do recebimento" vencimento={formatDate(baixaTarget.data_vencimento)} categoria={baixaTarget.categoria || "—"} situacao={baixaTarget.status || "Em aberto"}/><p className="nf-info">Confirma o recebimento da Share e atualiza a despesa correspondente do cliente.</p><fieldset className="nf-fieldset" disabled={baixaSaving || baixaUploading}><div className="nf-form-grid two"><Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Data do pagamento *</FieldLabel><Input required type="date" value={baixaForm.data_pagamento} onChange={e => setBaixaForm({...baixaForm,data_pagamento:e.target.value})} className="h-10" /></Field><Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Forma de pagamento</FieldLabel><Select value={baixaForm.forma_pagamento} onValueChange={v => setBaixaForm({...baixaForm,forma_pagamento:v})}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{FORMAS_PAGAMENTO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>{baixaTarget.socio_id && <Field className="gap-1.5"><FieldLabel className="text-xs font-medium">Saída do pagamento</FieldLabel><Select value={baixaForm.saida_pagamento} onValueChange={v => setBaixaForm({...baixaForm,saida_pagamento:v as SaidaPagamento})}><SelectTrigger aria-label="Saída do pagamento" className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DGA_BRADESCO">DGA - BRADESCO</SelectItem><SelectItem value="CONTA_COTISTA">CONTA COTISTA</SelectItem></SelectContent></Select><small className="text-[11px] text-muted-foreground">DGA - BRADESCO: pago pela conta da holding. CONTA COTISTA: pago diretamente pelo cotista.</small></Field>}<Field className="span-2 gap-1.5"><FieldLabel className="text-xs font-medium">Conta bancária</FieldLabel><Select value={baixaForm.conta_bancaria || "__NONE__"} onValueChange={v => setBaixaForm({...baixaForm,conta_bancaria:v === "__NONE__" ? "" : v})}><SelectTrigger className="h-10"><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent><SelectItem value="__NONE__">Selecione a conta</SelectItem>{contasBancarias.filter(c => Boolean(c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.banco}{c.numero_conta ? ` • ${c.numero_conta}` : ''}</SelectItem>)}</SelectContent></Select></Field><label className="nf-upload span-2"><Upload /><span><strong>{baixaUploading ? 'Enviando…' : baixaForm.comprovante_url ? getFileNameFromUrl(baixaForm.comprovante_url) : 'Anexar comprovante de pagamento'}</strong><small>PDF, PNG, JPG ou WebP • até 20 MB</small></span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {const file=e.target.files?.[0]; if(file) {if(file.size > 20 * 1024 * 1024) setToast({type:'err',text:'O comprovante deve ter até 20 MB.'}); else void uploadComprovante(file);} e.target.value='';}} /></label></div></fieldset><footer className="nf-modal-footer"><button type="button" className="nf-btn" disabled={baixaSaving || baixaUploading} onClick={closeBaixa}>Cancelar</button><button type="submit" className="nf-btn primary" disabled={baixaSaving || baixaUploading}><CheckCircle2 />{baixaSaving ? 'Registrando…' : 'Confirmar recebimento'}</button></footer></form>
    </Modal>}
  </div>;
}

export const STYLES = `
.nf-workspace,.nf-modal{--nf-bg:var(--light-surface, #0b1120);--nf-panel:var(--light-surface, #111b2d);--nf-line:var(--light-line, #25334a);--nf-muted:var(--light-muted, #9aaec8);--nf-text:var(--light-text, #edf4ff);--nf-blue:var(--light-info, #3478f6);--nf-cyan:#6cd7ee;color-scheme: var(--app-color-scheme, dark);color:var(--nf-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;letter-spacing:-.01em}
.nf-workspace *,.nf-modal *{box-sizing:border-box}.nf-workspace{container-type:inline-size;min-width:0;background:var(--nf-bg);padding:clamp(16px,2.5vw,28px);border:1px solid var(--light-line, #1b2c44);border-radius:16px}
.nf-workspace h1,.nf-workspace h2,.nf-workspace h3,.nf-workspace p,.nf-modal h2,.nf-modal p{margin:0}.nf-workspace button,.nf-modal button{font:inherit;cursor:pointer}.nf-workspace button:disabled,.nf-modal button:disabled{opacity:.42;cursor:not-allowed}.nf-workspace svg,.nf-modal svg{width:17px;height:17px;flex-shrink:0;stroke-width:1.7}.nf-workspace button,.nf-modal button{transition:background .18s,border-color .18s,transform .18s}.nf-workspace :focus-visible,.nf-modal :focus-visible{outline:2px solid #79dcf2;outline-offset:3px}
.nf-workspace input[type="search"],.nf-modal input:not([type="file"]),.nf-modal textarea{font:inherit;min-width:0;width:100%}
.nf-modal input[readonly]{background:var(--fin-soft, #172135);color:var(--fin-muted, #a6b8d1)}
.nf-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.nf-eyebrow{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.12em;font-weight:700;color:var(--fin-muted, #93b7e6)}.nf-dot{display:inline-block;background:var(--light-info-soft, #62cce4);width:6px;height:6px;border-radius:50%;flex-shrink:0}.nf-header-actions{display:flex;gap:10px;flex-shrink:0;align-items:center}.nf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:8px 14px;border:1px solid var(--nf-line);border-radius:8px;color:var(--fin-text, #dbe8fa);background:var(--fin-surface, #172238);font-size:12px!important;font-weight:600!important;white-space:nowrap}.nf-btn:hover{background:var(--fin-hover, #21314c);border-color:var(--fin-border, #3b526f)}.nf-btn.primary{background:var(--fin-primary, #0969a8);color:var(--app-primary-text, #fff);border-color:var(--fin-primary, #0969a8);box-shadow:none}.nf-btn.primary:hover{background:var(--fin-primary-hover, #07578c)}.nf-btn.subtle{background:transparent}.nf-btn.selected{border-color:var(--fin-accent, #4774ad);color:var(--fin-accent, #89caff);background:var(--fin-accent-soft, #162d4a)}.nf-btn.destructive{background:var(--light-danger-soft, #bc3545);border-color:var(--light-danger-line, #d34b5b);color:white}.nf-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;height:34px;width:34px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--fin-muted, #a4b7d1);padding:0}.nf-icon:hover{background:var(--fin-hover, #23334c);color:var(--fin-text, #fff);border-color:var(--fin-border, #354b6c)}.nf-icon.success{color:var(--light-success, #52dbad)}.nf-icon.danger{color:var(--light-danger, #ed8b98)}.nf-icon.danger:hover{background:var(--light-surface, #462233)}
.nf-workspace .nf-header.nf-documents-header{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.nf-workspace .nf-documents-header>:first-child{grid-column:1;grid-row:1}.nf-workspace .nf-documents-header .nf-header-actions{grid-column:2;grid-row:1;justify-self:center;width:auto}
.nf-workspace .nf-documents-header .nf-header-actions .nf-btn{justify-self:center}
.nf-panel{background:var(--fin-surface, #10192a);border:1px solid var(--nf-line);border-radius:12px;overflow:hidden}.nf-panel-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--nf-line);background-color:var(--fin-soft, #070a12)}.nf-segment{display:flex;gap:4px;padding:4px;border-radius:8px;background:var(--fin-soft, #0b1322);border:1px solid var(--nf-line)}.nf-segment button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:34px;border:0;border-radius:6px;background:transparent;color:var(--fin-muted, #a4b6cd);padding:6px 12px;font-size:12px;font-weight:600;white-space:nowrap}.nf-segment button.active{color:var(--app-primary-text, #fff);background:var(--fin-primary, #0969a8)}.nf-segment button span{font-size:11px;padding:1px 6px;border-radius:4px;background:color-mix(in srgb, currentColor 14%, transparent)}.nf-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) 160px 155px auto;gap:8px;align-items:center}
.nf-search{position:relative;display:flex;align-items:center;min-width:0;border:1px solid var(--nf-line);border-radius:6px;background:var(--fin-surface)}.nf-search svg{position:absolute;left:10px;color:var(--fin-muted, #8ea7c5);pointer-events:none}.nf-search input{padding-left:34px;font-size:12px;height:32px;min-height:32px;width:100%}.nf-period{display:flex;align-items:end;flex-wrap:wrap;gap:12px;padding:12px 16px;margin:8px 16px 0;background:var(--fin-soft);border:1px solid var(--nf-line);border-radius:8px}.nf-error-text{color:var(--fin-danger, #ffb3bd);font-size:12px;flex-basis:100%}.nf-list-heading{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;gap:12px}.nf-list-heading h2{font-size:15px;font-weight:600;overflow-wrap:anywhere}.nf-list-heading p{color:var(--nf-muted);font-size:11px;margin-top:2px}.nf-text-btn{display:inline-flex;align-items:center;gap:6px;color:var(--fin-accent, #8fc7ff);background:none;border:0;padding:4px 0;font-size:12px!important}.nf-list-heading .nf-text-btn{margin-left:12px;font-size:11px!important}.nf-view-toggle{display:flex;padding:3px;gap:3px;border:1px solid var(--nf-line);border-radius:8px;background:var(--fin-soft);flex-shrink:0}.nf-view-toggle button{width:30px;height:28px;display:grid;place-items:center;color:var(--fin-muted);background:none;border:0;border-radius:5px}.nf-view-toggle button.active{background:var(--fin-surface);color:var(--fin-accent)}.nf-back{padding:0 16px 10px}.nf-table-wrap{overflow-x:auto}.nf-table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}.nf-table thead{background:var(--fin-header);color:var(--fin-muted);font-size:11px;letter-spacing:.04em;text-transform:uppercase}.nf-table th{font-weight:600;padding:10px 12px;border-block:1px solid var(--nf-line)}.nf-table td{padding:10px 12px;border-bottom:1px solid var(--nf-line);vertical-align:middle}.nf-table tbody tr:hover{background:var(--fin-hover)}.nf-table tbody tr:last-child td{border-bottom:0}.nf-table .right{text-align:right}.nf-doc-cell{display:flex;gap:10px;align-items:center}.nf-doc-icon{display:grid;place-items:center;width:32px;height:36px;background:var(--fin-accent-soft);border:1px solid var(--nf-line);color:var(--fin-accent);border-radius:7px;flex-shrink:0}.nf-doc-cell strong{display:block;font-size:12px;font-weight:600;color:var(--fin-text)}.nf-doc-cell span:not(.nf-doc-icon){display:block;font-size:11px;color:var(--fin-muted);max-width:210px;overflow:hidden;text-overflow:ellipsis}.nf-doc-cell small{display:block;font-size:11px;color:var(--fin-muted);max-width:210px;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.nf-aircraft{display:inline-flex;align-items:center;gap:6px;color:var(--fin-accent);font-size:11px}.nf-aircraft svg{width:13px;height:13px}.nf-dates{display:grid;gap:3px;font-size:11px;color:var(--fin-text)}.nf-dates small{font-size:11px;color:var(--fin-muted)}.nf-dates .nf-late{color:var(--fin-danger)}.nf-category{display:inline-block;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;padding:3px 8px;border:1px solid var(--nf-line);background:var(--fin-accent-soft);color:var(--fin-accent);font-size:11px;border-radius:6px}.nf-amount{color:var(--fin-text);font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.nf-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--nf-line);border-radius:6px;overflow:hidden;padding:3px 8px;font-size:11px;white-space:nowrap;color:var(--fin-muted);background:var(--fin-soft)}.nf-badge svg{width:12px;height:12px}.nf-badge.paid{color:var(--fin-success);background:var(--fin-success-soft)}.nf-badge.pending{color:var(--fin-warning);background:var(--fin-warning-soft)}.nf-row-actions{display:flex;justify-content:flex-end;gap:2px}.nf-row-actions .nf-icon{width:30px;height:32px}.nf-row-actions svg{width:14px;height:14px}.nf-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;background:var(--fin-soft);border-top:1px solid var(--nf-line);font-size:11px;color:var(--fin-muted)}.nf-pagination>div{display:flex;align-items:center;gap:10px}.nf-pagination .nf-icon{border:1px solid var(--nf-line);width:28px;height:28px}.nf-empty{padding:48px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:var(--fin-muted)}.nf-empty>svg{width:32px;height:32px;color:var(--fin-accent)}.nf-empty h3{color:var(--fin-text);font-size:16px}.nf-empty p{max-width:420px;font-size:13px}.nf-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;padding:0 16px 16px}.nf-notice{border:1px solid var(--fin-line);background:var(--fin-success-soft);color:var(--fin-success);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}.nf-notice.error{background:var(--fin-danger-soft);color:var(--fin-danger)}.nf-notice span{overflow-wrap:anywhere}.nf-spin{animation:nf-rotate 1s linear infinite}@keyframes nf-rotate{to{transform:rotate(360deg)}}.nf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.nf-modal{background:var(--fin-surface, #111c2e);border:1px solid var(--nf-line);border-radius:14px}.nf-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--nf-line);background:var(--fin-soft)}.nf-modal-head .nf-eyebrow{font-size:11px}.nf-modal-body{padding:20px 22px}.nf-fieldset{border:0;padding:0;margin:0 0 20px;min-width:0}.nf-fieldset legend{padding:0;margin-bottom:14px;font-size:13px;font-weight:600}.nf-fieldset legend>span{font-size:11px;color:var(--fin-accent);margin-right:8px;border:1px solid var(--nf-line);background:var(--fin-accent-soft);border-radius:5px;padding:2px 6px}.nf-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.nf-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nf-form-grid .span-2{grid-column:span 2}.nf-form-grid .span-3{grid-column:span 3}.nf-modal-footer{display:flex;justify-content:flex-end;align-items:center;gap:10px;border-top:1px solid var(--nf-line);padding-top:16px;margin-top:18px}.nf-upload{display:flex!important;flex-direction:row!important;align-items:center;gap:14px;border:1px dashed var(--nf-line);border-radius:8px;background:var(--fin-soft);padding:14px;position:relative;cursor:pointer;overflow:hidden}.nf-upload:hover{border-color:var(--fin-accent)}.nf-upload:focus-within{outline:2px solid var(--fin-accent);outline-offset:2px}.nf-upload>svg{width:22px;height:22px;color:var(--fin-accent)}.nf-upload>span{display:grid;gap:3px;min-width:0}.nf-upload strong{font-size:12px;overflow-wrap:anywhere;color:var(--fin-text);font-weight:500}.nf-upload small{font-size:11px;color:var(--fin-muted)}.nf-upload input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}.nf-info{padding:11px 14px;background:var(--fin-accent-soft);border:1px solid var(--nf-line);border-radius:8px;font-size:12px;color:var(--fin-text);margin-bottom:18px!important}.nf-dialog-copy{font-size:14px;color:var(--fin-text)}.nf-confirm-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:10px;color:var(--fin-danger);background:var(--fin-danger-soft);margin-bottom:14px}.nf-confirm-icon svg{width:22px;height:22px}.nf-pdf-frame{width:100%;height:72dvh;min-height:320px;border:0;border-radius:8px;background:white}.nf-preview-image{display:block;max-width:100%;max-height:72dvh;object-fit:contain;margin:auto}
@container(max-width:1050px){.nf-header{align-items:flex-start;flex-direction:column;gap:14px}.nf-workspace .nf-header.nf-documents-header{grid-template-columns:minmax(0,1fr) auto}.nf-workspace .nf-documents-header .nf-header-actions{grid-column:2;grid-row:1}.nf-toolbar{grid-template-columns:minmax(180px,1fr) 145px 140px}.nf-toolbar>.nf-btn{grid-column:1/-1;justify-self:start}}
@container(max-width:760px){.nf-workspace .nf-header.nf-documents-header{grid-template-columns:minmax(0,1fr)}.nf-workspace .nf-documents-header .nf-header-actions{grid-column:1;grid-row:2;justify-self:center;width:auto}}
@container(max-width:760px){.nf-table-wrap{display:none}.nf-mobile-docs{display:grid;grid-template-columns:1fr;gap:10px;padding:0 14px 14px}.nf-mobile-doc{background:var(--fin-surface);border:1px solid var(--nf-line);border-radius:10px;padding:14px;min-width:0}.nf-mobile-doc header{display:flex;align-items:center;gap:8px;margin-bottom:12px}.nf-mobile-doc header>div{flex:1;min-width:0}.nf-mobile-doc header strong{display:block;font-size:12px;overflow-wrap:anywhere}.nf-mobile-doc header small{display:block;color:var(--fin-muted);font-size:11px}.nf-mobile-doc h3{font-size:13px;overflow-wrap:anywhere}.nf-mobile-doc p{font-size:11px;color:var(--fin-muted);margin-top:4px;overflow-wrap:anywhere}.nf-mobile-doc dl{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.nf-mobile-doc dl>div:first-child{flex-basis:100%}.nf-mobile-doc dt{font-size:11px;color:var(--fin-muted)}.nf-mobile-doc dd{margin:3px 0 0;font-size:12px}.nf-mobile-doc dd.nf-amount{font-size:19px}.nf-mobile-doc footer{border-top:1px solid var(--nf-line);padding-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}.nf-mobile-doc .nf-row-actions{margin-left:auto}.nf-toolbar{grid-template-columns:1fr 1fr}.nf-search{grid-column:1/-1}.nf-panel-top{padding:12px;flex-wrap:wrap}.nf-list-heading{padding:12px}}
@media(max-width:640px){.nf-form-grid,.nf-form-grid.two{grid-template-columns:1fr}.nf-form-grid .span-2,.nf-form-grid .span-3{grid-column:auto}.nf-modal-footer{flex-direction:column-reverse;align-items:stretch}}
@media(prefers-reduced-motion:reduce){.nf-workspace *,.nf-modal *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
