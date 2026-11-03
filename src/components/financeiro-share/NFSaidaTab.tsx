import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  TriangleAlert,
  Filter,
  Columns3,
  ListOrdered,
  RotateCcw,
  CalendarDays,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { EnviarEmailClienteDialog } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { ReciboSaidaPreviewModal } from "./ReciboSaidaPreviewModal";
import { normalizeReceiptForPdf } from "@/hooks/useReceiptPdfGenerator";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import { formatDate } from "@/lib/receiptUtils";
import { API_ORIGIN, getAuthToken } from "@/lib/api";
import { avisarAtualizacaoFinanceiro } from "@/lib/baixa-conciliada-api";
import * as nfSaidaApi from "@/lib/nfSaidaApi";
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

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emptyForm: FormState = {
  numero: "", cotista_aeronave_id: "", cliente_nome: "", cliente_cnpj: "", cliente_endereco: "", cliente_cidade: "", cliente_uf: "",
  aircraft_id: "", aeronave: "", categoria_receita_id: "", categoria: "",
  categoria_despesa_id: "", categoria_despesa_subcategoria: "",
  data_criacao: todayLocal(),
  data_vencimento: "", valor: "", descricao: "", status: "EM_ABERTO",
  arquivo_pdf_url: "",
};

interface BaixaFormState {
  data_pagamento: string;
  conta_bancaria: string;
  forma_pagamento: string;
  comprovante_url: string;
}

const emptyBaixaForm: BaixaFormState = {
  data_pagamento: todayLocal(),
  conta_bancaria: "",
  forma_pagamento: "PIX",
  comprovante_url: "",
};

const FORMAS_PAGAMENTO = ["PIX", "Transferência (TED/DOC)", "Boleto", "Dinheiro", "Cartão"];

const STATUS_OPCOES = [
  { value: "EM_ABERTO", label: "Em aberto" },
  { value: "PAGO", label: "Pago" },
];

/* ─────────────── categorias de despesa do cliente ─────────────── */

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
      options.push({ optionId: `${row.id}::0`, categoriaId: row.id, nome: row.nome, subcategoria: null, label: row.nome });
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
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(Number(year), Number(month) - 1, 1));
  return `${name.charAt(0).toLocaleUpperCase("pt-BR")}${name.slice(1)}`;
};
const monthLabel = (key: string) => (key === "sem-data" ? "Data não informada" : `${getMonthName(key)} de ${key.slice(0, 4)}`);
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

const paid = (status: string | null) => ["pago", "recebido"].includes((status || "").toLowerCase());
const pending = (status: string | null) =>
  ["em_aberto", "aberto", "pendente", "atrasado", "em_atraso"].includes((status || "").toLowerCase());
const isLate = (n: NFSaida) => pending(n.status) && !!n.data_vencimento && n.data_vencimento.slice(0, 10) < todayLocal();
const statusLabel = (n: NFSaida) => (paid(n.status) ? "Pago" : isLate(n) ? "Em atraso" : pending(n.status) ? "Em aberto" : n.status || "Não informado");
const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

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

function StatusBadge({ nota }: { nota: NFSaida }) {
  const state = paid(nota.status) ? "paid" : isLate(nota) ? "overdue" : pending(nota.status) ? "pending" : "neutral";
  return (
    <span className={`nf-badge ${state}`}>
      {state === "paid" ? <CheckCircle2 /> : state === "overdue" ? <TriangleAlert /> : <Clock />}
      {statusLabel(nota)}
    </span>
  );
}

/** Seletor inline (sem portal) para funcionar dentro do modal nativo. */
function SearchableCombobox({ items, value, onChange, placeholder, searchPlaceholder, emptyMessage }: {
  items: { id: string; label: string }[]; value: string; onChange: (id: string, label: string) => void;
  placeholder: string; searchPlaceholder: string; emptyMessage: string;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDetailsElement>(null);
  const selected = items.find((item) => item.id === value);
  const matches = items.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return (
    <details
      className="nf-picker"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          e.preventDefault(); e.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={placeholder}>{selected?.label || placeholder}<ChevronRight /></summary>
      <div className="nf-picker-panel">
        <input aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
        <div className="nf-picker-options">
          {matches.map((item) => (
            <button
              type="button" key={item.id} aria-pressed={item.id === value}
              onClick={() => {
                onChange(item.id, item.label); setQuery("");
                if (ref.current) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); }
              }}
            >
              {item.label}{item.id === value && <CheckCircle2 />}
            </button>
          ))}
          {!matches.length && <p>{emptyMessage}</p>}
        </div>
      </div>
    </details>
  );
}

/** Seletor de meses (multi-seleção), inline. */
function MonthPicker({ selected, onToggle, onCurrent, onAll }: {
  selected: string[]; onToggle: (m: string) => void; onCurrent: () => void; onAll: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const reference = selected[selected.length - 1] || todayLocal().slice(0, 7);
  const [year, setYear] = useState(Number(reference.slice(0, 4)));
  useEffect(() => { setYear(Number(reference.slice(0, 4))); }, [reference]);
  const close = () => { if (ref.current) ref.current.open = false; };
  return (
    <details className="nf-menu" ref={ref} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <summary className="nf-btn"><CalendarDays /> Meses <ChevronDown /></summary>
      <div className="nf-menu-panel nf-month-panel">
        <div className="nf-year">
          <button type="button" className="nf-btn nf-btn-icon" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></button>
          <strong>{year}</strong>
          <button type="button" className="nf-btn nf-btn-icon" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}><ChevronRight /></button>
        </div>
        <div className="nf-month-grid" role="group" aria-label={`Meses de ${year}`}>
          {MESES_CURTOS.map((nome, i) => {
            const key = `${year}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button type="button" key={key} aria-pressed={selected.includes(key)} onClick={() => onToggle(key)}>{nome}</button>
            );
          })}
        </div>
        <div className="nf-menu-foot">
          <button type="button" className="nf-btn nf-btn-quiet" onClick={() => { onAll(); close(); }}>Todos</button>
          <button type="button" className="nf-btn" onClick={() => { onCurrent(); close(); }}>Mês atual</button>
        </div>
      </div>
    </details>
  );
}

export function Modal({ title, children, onClose, busy = false, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className={`nf-modal ${wide ? "wide" : ""}`} aria-label={title} aria-busy={busy} onCancel={(e) => { e.preventDefault(); if (!busy) closeRef.current(); }}>
      <header className="nf-modal-head">
        <div><span className="nf-eyebrow">SHARE • FINANCEIRO</span><h2>{title}</h2></div>
        <button className="nf-icon" aria-label="Fechar" disabled={busy} onClick={onClose}><X /></button>
      </header>
      <div className="nf-modal-body">{children}</div>
    </dialog>
  );
}

/* ─────────────────────────── colunas ─────────────────────────── */

type ColId = "data" | "numero" | "cotista" | "aeronave" | "vencimento" | "categoria" | "valor" | "status";
type SortState = { col: ColId; dir: "asc" | "desc" };

const COLUMNS: { id: ColId; title: string; width: number; numeric?: boolean; sort: (n: NFSaida) => string | number }[] = [
  { id: "data", title: "Emissão", width: 120, sort: (n) => n.data_criacao ?? "" },
  { id: "numero", title: "Número", width: 130, sort: (n) => n.numero ?? "" },
  { id: "cotista", title: "Cotista", width: 260, sort: (n) => n.cliente_nome ?? "" },
  { id: "aeronave", title: "Aeronave", width: 120, sort: (n) => n.aeronave ?? "" },
  { id: "vencimento", title: "Vencimento", width: 130, sort: (n) => n.data_vencimento ?? "" },
  { id: "categoria", title: "Categoria", width: 190, sort: (n) => n.categoria ?? "" },
  { id: "valor", title: "Valor", width: 140, numeric: true, sort: (n) => num(n.valor) },
  { id: "status", title: "Situação", width: 140, sort: (n) => statusLabel(n) },
];
const dateCell = (v: string | null | undefined) => (v ? formatDate(v.slice(0, 10)) : "—");
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab() {
  const [notas, setNotas] = useState<NFSaida[]>([]);
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cotistas, setCotistas] = useState<CotistaOpcao[]>([]);
  const [aeronaves, setAeronaves] = useState<{ id: string; matricula_registro: string }[]>([]);
  const [categoriasReceita, setCategoriasReceita] = useState<CategoriaOpcao[]>([]);
  const [despesaOptions, setDespesaOptions] = useState<DespesaOption[]>([]);
  const [contasBancarias, setContasBancarias] = useState<{ id: string; banco: string; numero_conta: string | null }[]>([]);
  const [documentType, setDocumentType] = useState<"nota" | "recibo">("nota");
  const [documentTab, setDocumentTab] = useState<"nota" | "recibo">("recibo");
  const [uploading, setUploading] = useState(false);

  // período: lista vazia = todos os meses
  const [meses, setMeses] = useState<string[]>([todayLocal().slice(0, 7)]);

  // filtros, ordenação, tabela
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "EM_ABERTO" | "PAGO">("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [sort, setSort] = useState<SortState>({ col: "data", dir: "desc" });
  const [ocultas, setOcultas] = useState<Set<ColId>>(() => new Set());
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  // dar baixa
  const [baixaTarget, setBaixaTarget] = useState<NFSaida | null>(null);
  const [baixaForm, setBaixaForm] = useState<BaixaFormState>(emptyBaixaForm);
  const [baixaSaving, setBaixaSaving] = useState(false);
  const [baixaUploading, setBaixaUploading] = useState(false);
  const [emailTarget, setEmailTarget] = useState<NFSaida | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailsEnviados, setEmailsEnviados] = useState<Set<string>>(new Set());
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
      const { notas: nfData, recibos: recData } = await nfSaidaApi.buscarNotasSaida();
      const merged = [...(nfData ?? []).map(mapNota), ...(recData ?? []).map(mapRecibo)].sort((a, b) =>
        (b.data_criacao ?? "").localeCompare(a.data_criacao ?? ""),
      );
      setNotas(merged);
      setEmailsEnviados((current) => new Set([
        ...current,
        ...merged.filter((nota) => Boolean(nota.email_enviado_em)).map((nota) => `${nota.origem}:${nota.id}`),
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

  const matriculaPorAeronave = useMemo(() => new Map(aeronaves.map((a) => [a.id, a.matricula_registro])), [aeronaves]);

  const totalRecibos = useMemo(() => notas.filter((d) => d.origem === "recibo_saida").length, [notas]);
  const totalNotas = notas.length - totalRecibos;
  const hasActiveFilters = !!searchTerm.trim() || !!dateFrom || !!dateTo || !!statusFilter || !!categoriaFilter;

  const abaNotas = useMemo(
    () => notas.filter((d) => (documentTab === "recibo" ? d.origem === "recibo_saida" : d.origem !== "recibo_saida")),
    [notas, documentTab],
  );
  const categorias = useMemo(
    () => [...new Set(abaNotas.map((n) => n.categoria || "Sem categoria"))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [abaNotas],
  );

  const scopedRows = useMemo(() => {
    let result = abaNotas;
    const termo = searchTerm.trim().toLowerCase();
    if (termo) result = result.filter((d) => [d.numero, d.cliente_nome, d.aeronave, d.descricao, d.categoria].some((v) => v?.toLowerCase().includes(termo)));
    if (dateFrom) result = result.filter((n) => (n.data_criacao ?? "").slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((n) => (n.data_criacao ?? "").slice(0, 10) <= dateTo);
    if (statusFilter) result = result.filter((n) => (statusFilter === "PAGO" ? paid(n.status) : pending(n.status)));
    if (categoriaFilter) result = result.filter((n) => (n.categoria || "Sem categoria") === categoriaFilter);
    if (meses.length) result = result.filter((n) => meses.includes(getMonthKey(n.data_criacao)));
    return result;
  }, [abaNotas, searchTerm, dateFrom, dateTo, statusFilter, categoriaFilter, meses]);

  const clearFilters = () => { setSearchTerm(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); setCategoriaFilter(""); };

  // ordenação preservando o agrupamento mensal
  const colunaOrdenada = COLUMNS.find((c) => c.id === sort.col);
  const ordered = useMemo(() => {
    const map = new Map<string, NFSaida[]>();
    scopedRows.forEach((n) => {
      const key = getMonthKey(n.data_criacao);
      map.set(key, [...(map.get(key) ?? []), n]);
    });
    const keys = [...map.keys()].sort((a, b) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return sort.col === "data" && sort.dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
    });
    return keys.flatMap((key) =>
      [...map.get(key)!].sort((a, b) => {
        const x = colunaOrdenada?.sort(a);
        const y = colunaOrdenada?.sort(b);
        if (x == null || x === "") return y == null || y === "" ? 0 : 1;
        if (y == null || y === "") return -1;
        const r = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return (sort.dir === "asc" ? r : -r) || collator.compare(a.id, b.id);
      }),
    );
  }, [scopedRows, sort, colunaOrdenada]);

  useEffect(() => {
    setPage(1); setExpandidos(new Set()); setSelecionados(new Set());
  }, [searchTerm, dateFrom, dateTo, statusFilter, categoriaFilter, sort, documentTab, meses, porPagina]);

  const pageCount = Math.max(1, Math.ceil(ordered.length / porPagina));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * porPagina;
  const pageRows = ordered.slice(startIndex, startIndex + porPagina);
  const pageGroups = useMemo(() => {
    const map = new Map<string, NFSaida[]>();
    pageRows.forEach((n) => {
      const key = getMonthKey(n.data_criacao);
      map.set(key, [...(map.get(key) ?? []), n]);
    });
    return [...map.entries()].map(([key, rows]) => ({ key, rows }));
  }, [pageRows]);

  const colunasVisiveis = COLUMNS.filter((c) => !ocultas.has(c.id));
  const colSpan = colunasVisiveis.length + 2;
  const larguraTabela = 44 + colunasVisiveis.reduce((t, c) => t + c.width, 0) + 210;

  const totals = useMemo(() => scopedRows.reduce((acc, n) => {
    const value = num(n.valor); acc.total += value;
    if (paid(n.status)) acc.paid += value;
    if (pending(n.status)) { acc.open += value; if (isLate(n)) { acc.overdue += value; acc.lateCount++; } }
    return acc;
  }, { total: 0, paid: 0, open: 0, overdue: 0, lateCount: 0 }), [scopedRows]);

  const selectedRows = useMemo(() => scopedRows.filter((n) => selecionados.has(`${n.origem}:${n.id}`)), [scopedRows, selecionados]);
  const selectedTotal = selectedRows.reduce((t, n) => t + num(n.valor), 0);
  const rowKey = (n: NFSaida) => `${n.origem}:${n.id}`;
  const allPageSelected = pageRows.length > 0 && pageRows.every((n) => selecionados.has(rowKey(n)));
  const allExpanded = pageRows.length > 0 && pageRows.every((n) => expandidos.has(rowKey(n)));
  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((cur) => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const toggleSort = (col: ColId) =>
    setSort((cur) => ({ col, dir: cur.col === col && cur.dir === "asc" ? "desc" : "asc" }));

  const toggleMes = (m: string) =>
    setMeses((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort()));
  const mesReferencia = meses[meses.length - 1] || todayLocal().slice(0, 7);
  const periodLabel = meses.length === 0 ? "Todos os períodos" : meses.length === 1 ? monthLabel(meses[0]) : `${meses.length} meses selecionados`;

  const selectedDespesaOptionId = useMemo(() => {
    if (!form.categoria_despesa_id && !editingId) return "";
    const match = despesaOptions.find((option) =>
      option.categoriaId === form.categoria_despesa_id &&
      (option.subcategoria ?? "") === (form.categoria_despesa_subcategoria ?? ""),
    );
    return match?.optionId ?? "";
  }, [despesaOptions, form.categoria_despesa_id, form.categoria_despesa_subcategoria, editingId]);

  const openNew = () => { notaIdempotencyKey.current = null; receiptCreated.current = null; setForm({ ...emptyForm, data_criacao: todayLocal() }); setEditingId(null); setDocumentType("nota"); setShowForm(true); };
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
      data_criacao: n.data_criacao?.slice(0, 10) || todayLocal(),
      data_vencimento: n.data_vencimento?.slice(0, 10) || "", valor: n.valor != null ? String(n.valor) : "",
      categoria_receita_id: "", categoria: n.categoria ?? "", descricao: n.descricao ?? "",
      status: paid(n.status) ? "PAGO" : "EM_ABERTO",
      categoria_despesa_id: "", categoria_despesa_subcategoria: "",
      arquivo_pdf_url: n.arquivo_pdf_url ?? "",
    });
    notaIdempotencyKey.current = null;
    setEditingId(n.id); setDocumentType("nota"); setShowForm(true);
  };
  const closeForm = () => { notaIdempotencyKey.current = null; setShowForm(false); setEditingId(null); setDocumentType("nota"); setForm({ ...emptyForm, data_criacao: todayLocal() }); };

  const selecionarCotista = (cotistaAeronaveId: string) => {
    const cotista = cotistas.find((c) => c.cotista_aeronave_id === cotistaAeronaveId);
    if (!cotista) { setForm((current) => ({ ...current, cotista_aeronave_id: "" })); return; }
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

  const save = async () => {
    if (documentType === "nota" && !form.numero.trim()) { setToast({ type: "err", text: "Informe o número da nota." }); return; }
    if (!form.cotista_aeronave_id) { setToast({ type: "err", text: "Selecione o cotista (cliente ou sócio)." }); return; }
    if (!form.categoria_receita_id && !editingId) { setToast({ type: "err", text: "Selecione a categoria." }); return; }
    if (!form.categoria_despesa_id && !editingId) { setToast({ type: "err", text: "Selecione a categoria de despesa do cliente (perna 'cliente' do lançamento)." }); return; }
    if (!form.data_criacao) { setToast({ type: "err", text: "Informe a data de emissão." }); return; }
    if (!Number.isFinite(Number(form.valor)) || !(Number(form.valor) > 0)) { setToast({ type: "err", text: "Informe um valor maior que zero." }); return; }
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
            status: form.status,
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

  /** Cria o recibo primeiro para o Worker atribuir a sequência oficial; só depois gera e salva o PDF. */
  const confirmReciboSave = async (previewBlob: Blob) => {
    if (!reciboPreview || reciboSavedUrl) return;
    const { descricaoServico, dataVencimentoFinal, categoriaDespesaId, categoriaDespesaSubcategoria } = reciboPreview.payload;
    if (mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true); setToast(null);
    try {
      if (!(previewBlob instanceof Blob)) throw new Error("Não foi possível obter o PDF do recibo para salvar.");

      const { recibo } = receiptCreated.current
        ? { recibo: receiptCreated.current }
        : await nfSaidaApi.criarReciboSaida({
            cotista_aeronave_id: form.cotista_aeronave_id, aeronave_id: form.aircraft_id,
            categoria_receita_id: form.categoria_receita_id, categoria_receita_nome: form.categoria,
            categoria_despesa_id: categoriaDespesaId, categoria_despesa_subcategoria: categoriaDespesaSubcategoria,
            data_emissao: form.data_criacao, data_vencimento: dataVencimentoFinal,
            valor_total: Number(form.valor) || 0, descricao_servico: descricaoServico, status: form.status,
          });
      if (!recibo?.id) throw new Error("O servidor não confirmou a criação do recibo de saída.");
      receiptCreated.current = recibo;
      const numeroRecibo = String(recibo.numero_recibo || "");
      if (!numeroRecibo) throw new Error("O servidor não retornou o número oficial do recibo de saída.");
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
    if (receiptCreated.current && !reciboSavedUrl) { setToast({ type: "err", text: "O recibo já foi criado. Tente salvar o PDF novamente antes de fechar." }); return; }
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
      await nfSaidaApi.excluirNotaOuReciboSaida(deleteId, target.origem === "recibo_saida" ? "recibo_saida" : "nf_saida");
      setToast({ type: "ok", text: target.origem === "recibo_saida" ? "Recibo de saída excluído." : "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { mutationLock.current = false; setDeleting(false); }
  };

  /* ─────────────── dar baixa ─────────────── */

  const openBaixa = (n: NFSaida) => { setBaixaTarget(n); setBaixaForm({ ...emptyBaixaForm, data_pagamento: todayLocal() }); };
  const closeBaixa = () => { setBaixaTarget(null); setBaixaForm({ ...emptyBaixaForm, data_pagamento: todayLocal() }); };

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
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBaixaSaving(true); setToast(null);
    try {
      await nfSaidaApi.darBaixaNotaOuReciboSaida(baixaTarget.id, {
        origem: baixaTarget.origem === "recibo_saida" ? "recibo_saida" : "nf_saida",
        data_pagamento: baixaForm.data_pagamento,
        conta_bancaria: contasBancarias.find((c) => c.id === baixaForm.conta_bancaria)?.banco || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
        pagamentos: [{
          tipo_pagador: baixaTarget.socio_id ? "HOLDING" : "COTISTA",
          pagador_cotista_id: baixaTarget.socio_id ? null : baixaTarget.cotista_aeronave_id,
          pagador_holding_id: baixaTarget.socio_id ? baixaTarget.holding_id ?? null : null,
          valor_centavos: Math.round(Number(baixaTarget.valor ?? 0) * 100),
          data_pagamento: baixaForm.data_pagamento,
          conta_bancaria_id: baixaForm.conta_bancaria || null,
          forma_pagamento: baixaForm.forma_pagamento || null,
          comprovante_url: baixaForm.comprovante_url || null,
        }],
      });
      setToast({ type: "ok", text: "Baixa registrada: receita da Share recebida e espelho financeiro atualizado." });
      closeBaixa();
      fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao dar baixa." });
    } finally { mutationLock.current = false; setBaixaSaving(false); }
  };

  const invalidPeriod = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const formBusy = saving || uploading;
  const formField = <K extends keyof FormState,>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const filtrosAtivos = [searchTerm.trim(), dateFrom || dateTo, statusFilter, categoriaFilter].filter(Boolean).length;

  const exportCsv = () => {
    const cell = (v: unknown) => { let value = String(v ?? ""); if (/^[=+@\-\t\r]/.test(value)) value = "'" + value; return `"${value.replace(/"/g, '""')}"`; };
    const rows = [
      ["Número", "Cotista", "Aeronave", "Emissão", "Vencimento", "Valor (BRL)", "Categoria", "Descrição", "Status"],
      ...scopedRows.map((n) => [n.numero, n.cliente_nome, n.aeronave, n.data_criacao?.slice(0, 10), n.data_vencimento?.slice(0, 10), num(n.valor).toFixed(2).replace(".", ","), n.categoria, n.descricao, n.status]),
    ];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `share-${documentTab}-${todayLocal()}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const actions = (n: NFSaida) => (
    <div className="nf-row-actions">
      <button className="nf-icon" title="Visualizar documento" aria-label={`Visualizar documento ${n.numero || ""}`} disabled={!n.arquivo_pdf_url} onClick={() => setPdfViewer({ url: n.arquivo_pdf_url!, title: n.numero || "Documento" })}><FileText /></button>
      <button className={`nf-icon ${emailsEnviados.has(rowKey(n)) ? "success" : ""}`} title={emailsEnviados.has(rowKey(n)) ? "E-mail enviado — enviar novamente" : "Enviar por e-mail"} aria-label={`Enviar ${n.numero || "documento"} por e-mail`} onClick={() => { setEmailTarget(n); setEmailOpen(true); }}><Mail /></button>
      {pending(n.status) && n.contas_areceber_id && <button className="nf-icon success" title="Registrar recebimento" aria-label={`Registrar recebimento de ${n.numero || "documento"}`} onClick={() => openBaixa(n)}><Banknote /></button>}
      {n.origem === "nf_saida" && <button className="nf-icon" title="Editar nota" aria-label={`Editar nota ${n.numero || ""}`} onClick={() => openEdit(n)}><Pencil /></button>}
      <button className="nf-icon danger" title="Excluir documento" aria-label={`Excluir documento ${n.numero || ""}`} onClick={() => setDeleteId(n.id)}><Trash2 /></button>
      <button className="nf-icon" aria-expanded={expandidos.has(rowKey(n))} aria-label={`${expandidos.has(rowKey(n)) ? "Ocultar" : "Ver"} detalhes: ${n.numero || "documento"}`} onClick={() => toggleSet(setExpandidos, rowKey(n))}>
        {expandidos.has(rowKey(n)) ? <ChevronUp /> : <ChevronDown />}
      </button>
    </div>
  );

  const renderCell = (col: ColId, n: NFSaida) => {
    switch (col) {
      case "data": return <span className="nf-date">{dateCell(n.data_criacao)}</span>;
      case "numero": return <span className="nf-cell-text nf-strong" title={n.numero || ""}>{n.numero || "Sem número"}</span>;
      case "cotista": return <span className="nf-cell-text" title={n.cliente_nome || ""}>{n.cliente_nome || "Cotista não informado"}</span>;
      case "aeronave": return <span className="nf-cell-text nf-mono">{n.aeronave || "—"}</span>;
      case "vencimento": return <span className={`nf-date ${isLate(n) ? "nf-late" : ""}`}>{dateCell(n.data_vencimento)}</span>;
      case "categoria": return <span className="nf-cell-text" title={n.categoria || ""}>{n.categoria || "Sem categoria"}</span>;
      case "valor": return <span className="nf-money">{formatBRL(num(n.valor))}</span>;
      case "status": return <StatusBadge nota={n} />;
    }
  };

  const feedback = toast && (
    <div role={toast.type === "err" ? "alert" : "status"} className={`nf-notice ${toast.type === "err" ? "error" : "success"}`}>
      <span>{toast.text}</span>
      <button type="button" className="nf-icon" aria-label="Dispensar mensagem" onClick={() => setToast(null)}><X /></button>
    </div>
  );

  const tituloPagina = documentTab === "recibo" ? "Recibos de saída" : "Notas fiscais de saída";

  return (
    <div className="nf-workspace">
      <style>{STYLES}</style>

      <div className="nf-breadcrumb"><span>Financeiro</span><ChevronRight /><span>Documentos de saída</span></div>

      <div className="nf-heading">
        <div>
          <p className="nf-eyebrow">FINANCEIRO / DOCUMENTOS DE SAÍDA</p>
          <h1>{tituloPagina}</h1>
        </div>
        <div className="nf-heading-total">
          <p className="nf-eyebrow">TOTAL NO FILTRO</p>
          <strong>{loading || loadError ? "—" : formatBRL(totals.total)}</strong>
        </div>
      </div>

      <div className="nf-segment" role="group" aria-label="Tipo de documento">
        {([["recibo", "Recibos", totalRecibos], ["nota", "Notas fiscais", totalNotas]] as const).map(([value, label, count]) => (
          <button key={value} aria-pressed={documentTab === value} className={documentTab === value ? "active" : ""} onClick={() => setDocumentTab(value)}>
            {label}<span>{count}</span>
          </button>
        ))}
      </div>

      {!showForm && !baixaTarget && !deleteId && feedback}

      <section className="nf-ledger" aria-label="Documentos">
        <div className="nf-toolbar">
          <div className="nf-toolbar-main">
            <div className="nf-toolbar-actions">
              <button type="button" className="nf-btn nf-btn-primary" onClick={documentTab === "recibo" ? openNewReceipt : openNew}>
                <Plus /> {documentTab === "recibo" ? "Emitir recibo" : "Nova nota"}
              </button>
              <button type="button" className="nf-btn" aria-expanded={showFilterPanel} aria-controls="nf-filtros" onClick={() => setShowFilterPanel((v) => !v)}>
                <Filter /> Filtrar{filtrosAtivos > 0 && <span className="nf-filter-count">{filtrosAtivos}</span>}
              </button>
              <span className="nf-separator" aria-hidden="true" />
              <button type="button" className="nf-btn nf-btn-quiet" disabled={loading || !pageRows.length} onClick={() => setExpandidos(allExpanded ? new Set() : new Set(pageRows.map(rowKey)))}>
                <ListOrdered /> {allExpanded ? "Recolher todas" : "Expandir todas"}
              </button>
              <details className="nf-menu">
                <summary className="nf-btn nf-btn-quiet"><Columns3 /> Colunas</summary>
                <div className="nf-menu-panel nf-columns-panel">
                  <p>Exibir colunas</p>
                  {COLUMNS.map((c) => (
                    <label key={c.id} className="nf-column-option">
                      <input type="checkbox" checked={!ocultas.has(c.id)} onChange={() => setOcultas((cur) => { const next = new Set(cur); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })} />
                      <span>{c.title}</span>
                    </label>
                  ))}
                  <button type="button" className="nf-btn nf-btn-quiet" onClick={() => setOcultas(new Set())}><RotateCcw /> Restaurar colunas</button>
                </div>
              </details>
              <button type="button" className="nf-btn nf-btn-quiet" disabled={loading} onClick={() => void fetchNotas()}><RefreshCw className={loading ? "nf-spin" : ""} /> Atualizar</button>
              <button type="button" className="nf-btn nf-btn-quiet" disabled={!scopedRows.length || loading || !!loadError} onClick={exportCsv}><Download /> CSV</button>
            </div>

            <div className="nf-period" role="group" aria-label="Navegar pelas competências">
              <MonthPicker selected={meses} onToggle={toggleMes} onCurrent={() => setMeses([todayLocal().slice(0, 7)])} onAll={() => setMeses([])} />
              <button type="button" className="nf-btn nf-btn-icon" aria-label="Mês anterior" onClick={() => setMeses([shiftMonth(mesReferencia, -1)])}><ChevronLeft /></button>
              <span className="nf-month" aria-live="polite">{periodLabel}</span>
              <button type="button" className="nf-btn nf-btn-icon" aria-label="Próximo mês" onClick={() => setMeses([shiftMonth(mesReferencia, 1)])}><ChevronRight /></button>
            </div>
          </div>

          {showFilterPanel && (
            <div id="nf-filtros" className="nf-filters">
              <label className="nf-search-field">
                <span className="nf-sr">Buscar documentos</span>
                <Search />
                <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar cotista, número, aeronave, descrição…" />
              </label>
              <label>Situação
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <option value="">Todas as situações</option>
                  {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label>Categoria
                <select value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)}>
                  <option value="">Todas as categorias</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Emissão a partir de<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} /></label>
              <label>Emissão até<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} /></label>
              <div className="nf-filters-foot">
                <button type="button" className="nf-text-btn" onClick={clearFilters}><X /> Limpar busca e filtros</button>
                {invalidPeriod && <p className="nf-error-text" role="alert">A data final deve ser igual ou posterior à inicial.</p>}
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <div className="nf-filter-status">
              <span role="status">{scopedRows.length} de {abaNotas.length} documentos · {formatBRL(totals.total)}</span>
              <button type="button" className="nf-text-btn" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
        </div>

        {selectedRows.length > 0 && (
          <div className="nf-selection">
            <span role="status">
              {selectedRows.length} {selectedRows.length === 1 ? "documento selecionado" : "documentos selecionados"} · Soma: <strong>{formatBRL(selectedTotal)}</strong>
            </span>
            <button type="button" className="nf-text-btn" onClick={() => setSelecionados(new Set())}><X /> Limpar seleção</button>
          </div>
        )}

        <div className="nf-scroll" role="region" aria-label="Tabela de documentos de saída. Role horizontalmente ou use as setas do teclado." tabIndex={0} aria-busy={loading}>
          <table className="nf-table" style={{ width: larguraTabela }}>
            <caption className="nf-sr">Documentos financeiros de saída agrupados por mês. Clique nos cabeçalhos para ordenar.</caption>
            <colgroup>
              <col style={{ width: 44 }} />
              {colunasVisiveis.map((c) => <col key={c.id} style={{ width: c.width }} />)}
              <col style={{ width: 210 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox" className="nf-checkbox"
                    aria-label="Selecionar todos os documentos desta página"
                    disabled={loading || !pageRows.length}
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = !allPageSelected && pageRows.some((n) => selecionados.has(rowKey(n))); }}
                    onChange={() => setSelecionados((cur) => { const next = new Set(cur); pageRows.forEach((n) => (allPageSelected ? next.delete(rowKey(n)) : next.add(rowKey(n)))); return next; })}
                  />
                </th>
                {colunasVisiveis.map((c) => (
                  <th key={c.id} scope="col" className={c.numeric ? "right" : ""} aria-sort={sort.col === c.id ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button type="button" className="nf-sort" data-active={sort.col === c.id} onClick={() => toggleSort(c.id)} title={`${c.title}: ordenar ${sort.col === c.id && sort.dir === "asc" ? "decrescente" : "crescente"}`}>
                      <span>{c.title}</span>
                      {sort.col !== c.id ? <ChevronsUpDown /> : sort.dir === "asc" ? <ChevronUp /> : <ChevronDown />}
                    </button>
                  </th>
                ))}
                <th scope="col" className="right"><span className="nf-th-plain">Ações</span></th>
              </tr>
            </thead>

            {loading ? (
              <tbody><tr><td colSpan={colSpan} className="nf-empty"><div role="status" className="nf-empty-row"><RefreshCw className="nf-spin" /> Carregando documentos…</div></td></tr></tbody>
            ) : loadError ? (
              <tbody><tr><td colSpan={colSpan} className="nf-empty"><div role="alert" className="nf-empty-col"><p><TriangleAlert /> {loadError}</p><button className="nf-btn" onClick={() => void fetchNotas()}>Tentar novamente</button></div></td></tr></tbody>
            ) : pageGroups.length ? (
              pageGroups.map(({ key, rows }) => (
                <tbody key={key}>
                  {meses.length !== 1 && (
                    <tr className="nf-month-row">
                      <th scope="rowgroup" colSpan={colSpan}>
                        <div className="nf-month-head">
                          <span><CalendarDays /> {monthLabel(key)} <em>{rows.length}</em></span>
                          <span>Subtotal <strong className="nf-mono">{formatBRL(rows.reduce((t, n) => t + num(n.valor), 0))}</strong></span>
                        </div>
                      </th>
                    </tr>
                  )}
                  {rows.map((n) => (
                    <Fragment key={rowKey(n)}>
                      <tr className="nf-row" data-selected={selecionados.has(rowKey(n))} data-expanded={expandidos.has(rowKey(n))}>
                        <td>
                          <input type="checkbox" className="nf-checkbox" aria-label={`Selecionar documento ${n.numero || ""}`} checked={selecionados.has(rowKey(n))} onChange={() => toggleSet(setSelecionados, rowKey(n))} />
                        </td>
                        {colunasVisiveis.map((c) => <td key={c.id} className={c.numeric ? "right" : ""}>{renderCell(c.id, n)}</td>)}
                        <td>{actions(n)}</td>
                      </tr>
                      {expandidos.has(rowKey(n)) && (
                        <tr>
                          <td colSpan={colSpan} className="nf-detail-cell">
                            <dl className="nf-detail">
                              <div><dt>Cotista</dt><dd>{n.cliente_nome || "Não informado"}</dd></div>
                              <div><dt>Documento do cotista</dt><dd>{n.cliente_cnpj || "—"}</dd></div>
                              <div><dt>Aeronave</dt><dd>{n.aeronave || "—"}</dd></div>
                              <div><dt>Categoria</dt><dd>{n.categoria || "Sem categoria"}</dd></div>
                              <div><dt>Emissão</dt><dd>{dateCell(n.data_criacao)}</dd></div>
                              <div><dt>Vencimento</dt><dd>{dateCell(n.data_vencimento)}</dd></div>
                              <div><dt>Valor</dt><dd className="nf-mono">{formatBRL(num(n.valor))}</dd></div>
                              <div><dt>E-mail</dt><dd>{emailsEnviados.has(rowKey(n)) ? "Enviado" : "Não enviado"}</dd></div>
                              <div className="wide"><dt>Descrição</dt><dd className="nf-wrap">{n.descricao || "Sem descrição"}</dd></div>
                              <div className="wide">
                                <dt>Documento</dt>
                                <dd>
                                  {n.arquivo_pdf_url
                                    ? <a href={resolveArquivoUrl(n.arquivo_pdf_url)} onClick={(e) => { e.preventDefault(); setPdfViewer({ url: n.arquivo_pdf_url!, title: n.numero || "Documento" }); }}>Visualizar {getFileNameFromUrl(n.arquivo_pdf_url)}</a>
                                    : "Nenhum arquivo vinculado"}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              ))
            ) : (
              <tbody>
                <tr><td colSpan={colSpan} className="nf-empty">
                  <div className="nf-empty-col">
                    <p>{hasActiveFilters ? "Nenhum documento corresponde aos filtros." : meses.length ? "Nenhum documento neste período." : "Nenhum documento emitido ainda."}</p>
                    <button className="nf-btn" onClick={hasActiveFilters ? clearFilters : documentTab === "recibo" ? openNewReceipt : openNew}>
                      {hasActiveFilters ? "Limpar filtros" : documentTab === "recibo" ? "Emitir recibo" : "Nova nota fiscal"}
                    </button>
                  </div>
                </td></tr>
              </tbody>
            )}
          </table>
        </div>

        <div className="nf-summary">
          <strong>TOTAL LISTADO ({loading ? 0 : scopedRows.length} itens){!loading && !loadError && ` · ${formatBRL(totals.total)}`}</strong>
          <div className="nf-summary-values" style={loading || loadError ? { visibility: "hidden" } : undefined} aria-hidden={loading || !!loadError}>
            <span>Recebido: <b className="positive">{formatBRL(totals.paid)}</b></span>
            <span>Em aberto: <b>{formatBRL(totals.open)}</b></span>
            <span>Vencido: <b className="negative">{formatBRL(totals.overdue)}</b> ({totals.lateCount})</span>
          </div>
        </div>

        <footer className="nf-pagination">
          <div className="nf-pagination-info">
            <span>{selectedRows.length} selecionados</span>
            <span>{loading ? 0 : scopedRows.length} registros</span>
            <label>
              <span className="nf-sr">Linhas por página</span>
              <select value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))}>
                {[10, 25, 50, 100].map((q) => <option key={q} value={q}>{q} linhas por página</option>)}
              </select>
            </label>
          </div>
          <nav aria-label="Paginação dos documentos" className="nf-pages">
            <span role="status" aria-live="polite">{loading ? "Carregando…" : `${ordered.length ? startIndex + 1 : 0}–${Math.min(startIndex + porPagina, ordered.length)} de ${ordered.length}`}</span>
            <button type="button" className="nf-btn nf-btn-icon" aria-label="Página anterior" disabled={loading || currentPage === 1} onClick={() => { setPage(currentPage - 1); setExpandidos(new Set()); }}><ChevronLeft /></button>
            <span>{currentPage} / {pageCount}</span>
            <button type="button" className="nf-btn nf-btn-icon" aria-label="Próxima página" disabled={loading || currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setExpandidos(new Set()); }}><ChevronRight /></button>
          </nav>
        </footer>
      </section>

      {/* ───────────── modais ───────────── */}

      {showForm && !reciboPreview && (
        <Modal title={editingId ? "Editar nota fiscal" : documentType === "recibo" ? "Emitir recibo de saída" : "Nova nota fiscal"} onClose={closeForm} busy={formBusy} wide>
          <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
            {feedback}
            {editingId && <p className="nf-info">Esta edição altera o documento. Os lançamentos financeiros já vinculados não são recalculados.</p>}
            <fieldset disabled={formBusy} className="nf-fieldset">
              <legend><span>01</span> Documento e cotista</legend>
              <div className="nf-form-grid">
                <label>Número {documentType === "nota" && "*"}<input required={documentType === "nota"} readOnly={documentType === "recibo"} value={documentType === "recibo" ? "Gerado ao finalizar" : form.numero} onChange={(e) => formField("numero", e.target.value)} /></label>
                <div className="nf-field span-2"><span>Cotista / aeronave *</span>
                  <SearchableCombobox items={cotistas.map((c) => ({ id: c.cotista_aeronave_id, label: `${c.nome} · ${matriculaPorAeronave.get(c.aeronave_id) || "Sem matrícula"}` }))} value={form.cotista_aeronave_id} onChange={selecionarCotista} placeholder="Selecione o cotista" searchPlaceholder="Buscar cotista..." emptyMessage="Nenhum cotista encontrado." />
                </div>
                <label>Aeronave<input readOnly value={form.aeronave} placeholder="Vinculada ao cotista" /></label>
                <label>Emissão *<input required type="date" value={form.data_criacao} onChange={(e) => formField("data_criacao", e.target.value)} /></label>
                <label>Vencimento<input type="date" value={form.data_vencimento} onChange={(e) => formField("data_vencimento", e.target.value)} /><small>Se vazio, utiliza a data de emissão.</small></label>
              </div>
            </fieldset>
            <fieldset disabled={formBusy} className="nf-fieldset">
              <legend><span>02</span> Valores e classificação</legend>
              <div className="nf-form-grid">
                <label>Valor (R$) *<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={form.valor} onChange={(e) => formField("valor", e.target.value)} placeholder="0,00" /></label>
                <div className="nf-field span-2"><span>Categoria de receita {editingId ? "" : "*"}</span>
                  <SearchableCombobox items={categoriasReceita.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_receita_id || form.categoria} onChange={(id, label) => setForm((current) => ({ ...current, categoria_receita_id: id, categoria: label }))} placeholder={form.categoria || "Selecione a categoria"} searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." />
                </div>
                {!editingId && (
                  <div className="nf-field span-2"><span>Categoria de despesa do cliente *</span>
                    <SearchableCombobox items={despesaOptions.map((o) => ({ id: o.optionId, label: o.label }))} value={selectedDespesaOptionId} onChange={(id) => { const option = despesaOptions.find((o) => o.optionId === id); setForm((current) => ({ ...current, categoria_despesa_id: option?.categoriaId || "", categoria_despesa_subcategoria: option?.subcategoria || "" })); }} placeholder="Selecione a classificação" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." />
                  </div>
                )}
                <label>Status<select value={form.status} onChange={(e) => formField("status", e.target.value as StatusDocumentoSaida)}>{STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                <label className="span-3">Descrição<textarea rows={3} value={form.descricao} onChange={(e) => formField("descricao", e.target.value)} placeholder="Descreva o serviço ou a cobrança…" /></label>
              </div>
            </fieldset>
            {documentType === "nota" && (
              <fieldset disabled={formBusy} className="nf-fieldset">
                <legend><span>03</span> Documento anexo</legend>
                <label className="nf-upload"><Upload />
                  <span><strong>{uploading ? "Enviando arquivo…" : form.arquivo_pdf_url ? getFileNameFromUrl(form.arquivo_pdf_url) : "Selecione o PDF ou imagem da nota"}</strong><small>PDF, PNG, JPG ou WebP • até 20 MB</small></span>
                  <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 20 * 1024 * 1024) setToast({ type: "err", text: "O arquivo deve ter até 20 MB." }); else void uploadDocument(file); } e.target.value = ""; }} />
                </label>
                {form.arquivo_pdf_url && <button type="button" className="nf-text-btn" onClick={() => formField("arquivo_pdf_url", "")}>Remover vínculo do anexo</button>}
              </fieldset>
            )}
            <footer className="nf-modal-footer">
              <button type="button" className="nf-btn" disabled={formBusy} onClick={closeForm}>Cancelar</button>
              <button className="nf-btn nf-btn-primary" disabled={formBusy} type="submit">
                {saving ? "Salvando…" : uploading ? "Enviando anexo…" : editingId ? "Salvar alterações" : documentType === "recibo" ? "Revisar recibo" : "Criar nota fiscal"}<ArrowUpRight />
              </button>
            </footer>
          </form>
        </Modal>
      )}

      <ReciboSaidaPreviewModal
        open={!!reciboPreview} data={reciboPreview?.pdfData ?? null} saving={saving} savedUrl={reciboSavedUrl}
        onClose={closeReciboPreview} onConfirm={confirmReciboSave}
        onError={(error) => setToast({ type: "err", text: error instanceof Error ? error.message : "Não foi possível gerar o PDF." })}
        onSendEmail={() => { if (emailTarget) setEmailOpen(true); }}
      />

      {pdfViewer && (
        <Modal title={pdfViewer.title} onClose={() => setPdfViewer(null)} wide>
          {isImageUrl(pdfViewer.url)
            ? <img className="nf-preview-image" src={resolveArquivoUrl(pdfViewer.url)} alt={pdfViewer.title} />
            : <iframe className="nf-pdf-frame" src={resolveArquivoUrl(pdfViewer.url)} title={pdfViewer.title} />}
          <footer className="nf-modal-footer">
            <button className="nf-btn" onClick={() => setPdfViewer(null)}>Fechar</button>
            <button className="nf-btn nf-btn-primary" disabled={pdfDownloading} onClick={() => void downloadPdf(pdfViewer.url, pdfViewer.title)}><Download />{pdfDownloading ? "Baixando…" : "Baixar arquivo"}</button>
          </footer>
        </Modal>
      )}

      {emailTarget && (
        <EnviarEmailClienteDialog
          open={emailOpen} onOpenChange={setEmailOpen}
          onSent={() => setEmailsEnviados((current) => new Set(current).add(`${emailTarget.origem}:${emailTarget.id}`))}
          assuntoSugerido={`${emailTarget.origem === "recibo_saida" ? "Recibo" : "Nota fiscal"} de saída ${emailTarget.numero || "sem número"} — ${emailTarget.cliente_nome || ""}`}
          mensagemSugerida={`Olá${emailTarget.cliente_nome ? ` ${emailTarget.cliente_nome}` : ""},\n\nSegue a documentação de saída emitida pela Share.\n\nNúmero: ${emailTarget.numero || "—"}\nValor: ${formatBRL(num(emailTarget.valor))}\n\nAtenciosamente,\nEquipe Share Brasil`}
          destinatarioInicial={emailTarget.cliente_email || ""}
          anexos={emailTarget.arquivo_pdf_url ? [{ id: `${emailTarget.origem}:${emailTarget.id}`, url: emailTarget.arquivo_pdf_url, label: emailTarget.origem === "recibo_saida" ? "Recibo de saída" : "Nota fiscal de saída", filename: getFileNameFromUrl(emailTarget.arquivo_pdf_url) }] : []}
        />
      )}

      {deleteId && (
        <Modal title="Excluir documento" onClose={() => setDeleteId(null)} busy={deleting}>
          {feedback}
          <div className="nf-confirm-icon"><Trash2 /></div>
          <p className="nf-dialog-copy">O documento, o PDF e os lançamentos financeiros vinculados serão removidos. Esta ação não pode ser desfeita.</p>
          <footer className="nf-modal-footer">
            <button className="nf-btn" disabled={deleting} onClick={() => setDeleteId(null)}>Manter documento</button>
            <button className="nf-btn destructive" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? "Excluindo…" : "Excluir documento"}</button>
          </footer>
        </Modal>
      )}

      {baixaTarget && (
        <Modal title="Registrar recebimento" onClose={closeBaixa} busy={baixaSaving || baixaUploading}>
          <form onSubmit={(e) => { e.preventDefault(); void confirmBaixa(); }}>
            {feedback}
            <div className="nf-payment-summary">
              <span>{baixaTarget.cliente_nome}<small>Documento {baixaTarget.numero || "sem número"}</small></span>
              <strong>{formatBRL(num(baixaTarget.valor))}</strong>
            </div>
            <p className="nf-info">Confirma o recebimento da Share e atualiza a despesa correspondente do cliente.</p>
            <fieldset className="nf-fieldset" disabled={baixaSaving || baixaUploading}>
              <div className="nf-form-grid two">
                <label>Data do pagamento *<input required type="date" value={baixaForm.data_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, data_pagamento: e.target.value })} /></label>
                <label>Forma de pagamento<select value={baixaForm.forma_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, forma_pagamento: e.target.value })}>{FORMAS_PAGAMENTO.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="span-2">Conta bancária<select value={baixaForm.conta_bancaria} onChange={(e) => setBaixaForm({ ...baixaForm, conta_bancaria: e.target.value })}><option value="">Selecione a conta</option>{contasBancarias.map((c) => <option key={c.id} value={c.id}>{c.banco}{c.numero_conta ? ` • ${c.numero_conta}` : ""}</option>)}</select></label>
                <label className="span-2">URL do comprovante<input value={baixaForm.comprovante_url} onChange={(e) => setBaixaForm({ ...baixaForm, comprovante_url: e.target.value })} placeholder="https://…" /></label>
                <label className="nf-upload span-2"><Upload />
                  <span><strong>{baixaUploading ? "Enviando…" : "Anexar comprovante"}</strong><small>PDF ou imagem • até 20 MB</small></span>
                  <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 20 * 1024 * 1024) setToast({ type: "err", text: "O comprovante deve ter até 20 MB." }); else void uploadComprovante(file); } e.target.value = ""; }} />
                </label>
              </div>
            </fieldset>
            <footer className="nf-modal-footer">
              <button type="button" className="nf-btn" disabled={baixaSaving || baixaUploading} onClick={closeBaixa}>Cancelar</button>
              <button type="submit" className="nf-btn nf-btn-primary" disabled={baixaSaving || baixaUploading}><CheckCircle2 />{baixaSaving ? "Registrando…" : "Confirmar recebimento"}</button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────── estilos ─────────────────────────── */

export const STYLES = `
.nf-workspace,.nf-modal{
  --bg-page:#0f1115;--bg-surface:#14171c;--bg-hover:#181c22;--bg-selected:#202630;
  --border:#232832;--text:#e6e8eb;--text-muted:#8b93a0;--accent:#1f8fd6;
  --success:#3fb27f;--danger:#f53228e0;--warning:#f3e141d3;
  --row-height:40px;--header-height:32px;--toolbar-height:36px;
  --font-mono:ui-monospace,SFMono-Regular,Consolas,monospace;
  color-scheme:dark;color:var(--text);font:13px/1.4 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums;
}
.nf-workspace *,.nf-workspace *::before,.nf-workspace *::after,.nf-modal *,.nf-modal *::before,.nf-modal *::after{box-sizing:border-box}
.nf-workspace{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px 16px;background:var(--bg-page);border:1px solid var(--border);border-radius:4px}
.nf-workspace h1,.nf-workspace h2,.nf-workspace h3,.nf-workspace p,.nf-modal h2,.nf-modal p{margin:0}
.nf-workspace button,.nf-modal button{font:inherit;cursor:pointer}
.nf-workspace button:disabled,.nf-modal button:disabled{opacity:.4;cursor:not-allowed}
.nf-workspace svg,.nf-modal svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.nf-workspace :focus-visible,.nf-modal :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.nf-workspace input,.nf-workspace select,.nf-modal input,.nf-modal select,.nf-modal textarea{font:inherit;min-width:0;width:100%;height:32px;border:1px solid var(--border);border-radius:4px;background:var(--bg-page);color:var(--text);padding:0 8px}
.nf-workspace input::placeholder,.nf-modal input::placeholder,.nf-modal textarea::placeholder{color:var(--text-muted)}
.nf-modal textarea{height:auto;min-height:84px;padding:8px;resize:vertical}
.nf-modal input[readonly]{background:var(--bg-hover);color:var(--text-muted)}
.nf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.nf-spin{animation:nf-rotate 1s linear infinite}@keyframes nf-rotate{to{transform:rotate(360deg)}}
.nf-mono{font-family:var(--font-mono)}.positive{color:var(--success)}.negative{color:var(--danger)}

/* cabeçalho */
.nf-breadcrumb{display:flex;align-items:center;gap:8px;min-height:24px;color:var(--text-muted);font-size:12px}
.nf-eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 3px;color:var(--text-muted);font-size:10px;font-weight:600;letter-spacing:.8px;text-transform:uppercase}
.nf-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px}
.nf-heading h1{font-size:18px;font-weight:600;line-height:24px}
.nf-heading-total{text-align:right;white-space:nowrap}.nf-heading-total strong{font:600 17px var(--font-mono)}
.nf-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent)}

.nf-segment{display:inline-flex;align-self:flex-start;gap:2px;padding:2px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface)}
.nf-segment button{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border:0;border-radius:3px;background:transparent;color:var(--text-muted);font-size:12px;font-weight:600}
.nf-segment button.active{background:var(--bg-selected);color:var(--text)}
.nf-segment button span{padding:0 5px;border-radius:3px;background:rgba(255,255,255,.06);font-size:10px}

/* botões */
.nf-btn,.nf-modal .nf-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 10px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface);color:var(--text);font-size:12px;font-weight:500;white-space:nowrap;list-style:none}
.nf-btn::-webkit-details-marker,summary::-webkit-details-marker{display:none}
.nf-btn:hover:not(:disabled){background:var(--bg-hover)}
.nf-btn-primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.nf-btn-primary:hover:not(:disabled){background:var(--accent);filter:brightness(.92)}
.nf-btn-quiet{background:transparent;border-color:transparent;color:var(--text-muted)}
.nf-btn-icon{width:32px;padding:0}
.nf-btn.destructive{background:var(--danger);border-color:var(--danger);color:#fff}
.nf-separator{width:1px;height:20px;margin:0 2px;background:var(--border)}
.nf-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--text-muted);padding:0}
.nf-icon:hover:not(:disabled){background:var(--bg-hover);color:var(--text)}
.nf-icon.success{color:var(--success)}.nf-icon.danger{color:var(--danger)}
.nf-text-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 0;border:0;background:none;color:var(--accent);font-size:12px}

/* ledger / toolbar */
.nf-ledger{display:flex;flex-direction:column;min-width:0}
.nf-toolbar{display:flex;flex-direction:column;gap:0;min-width:0}
.nf-toolbar-main{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 16px;min-height:var(--toolbar-height);padding-bottom:8px}
.nf-toolbar-actions{display:flex;flex:1 1 450px;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}
.nf-filter-count{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;padding:0 4px;border-radius:3px;background:rgba(31,143,214,.2);color:#78d0ff;font-size:10px}
.nf-period{display:flex;align-items:center;gap:4px;margin-left:auto}
.nf-month{min-width:140px;padding:0 8px;text-align:center;font-weight:600;line-height:30px;border-bottom:2px solid var(--accent);text-transform:capitalize}

/* menus inline */
.nf-menu{position:relative}
.nf-menu>summary{cursor:pointer}
.nf-menu-panel{position:absolute;z-index:20;top:calc(100% + 4px);left:0;min-width:240px;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface);box-shadow:0 8px 24px #0009}
.nf-period .nf-menu-panel{left:auto;right:0}
.nf-columns-panel{display:flex;flex-direction:column;gap:2px;max-height:min(420px,70dvh);overflow:auto}
.nf-columns-panel>p{padding:4px 6px;font-size:12px;font-weight:600}
.nf-column-option{display:flex;align-items:center;gap:8px;padding:6px;font-size:12px;cursor:pointer;border-radius:3px}
.nf-column-option:hover{background:var(--bg-hover)}
.nf-column-option input{width:auto;height:auto;accent-color:var(--accent)}
.nf-month-panel{width:260px}
.nf-year{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px}
.nf-year strong{min-width:44px;text-align:center}
.nf-month-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.nf-month-grid button{height:30px;border:1px solid var(--border);border-radius:4px;background:var(--bg-page);color:var(--text-muted);font-size:12px}
.nf-month-grid button:hover{background:var(--bg-hover)}
.nf-month-grid button[aria-pressed=true]{background:rgba(31,143,214,.2);border-color:var(--accent);color:#91dcff}
.nf-menu-foot{display:flex;justify-content:space-between;gap:8px;margin-top:10px}

/* filtros */
.nf-filters{display:flex;flex-wrap:wrap;gap:8px;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface)}
.nf-filters label{display:grid;flex:1 1 160px;gap:4px;color:var(--text-muted);font-size:11px}
.nf-search-field{position:relative;flex:2 1 320px!important}
.nf-search-field svg{position:absolute;left:10px;bottom:9px;color:var(--text-muted);pointer-events:none}
.nf-search-field input{padding-left:32px}
.nf-filters-foot{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.nf-error-text{color:var(--danger);font-size:12px}
.nf-filter-status{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;color:var(--text-muted);font-size:12px}
.nf-selection{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;margin-bottom:8px;border:1px solid var(--border);border-radius:4px;background:rgba(31,143,214,.1);font-size:12px}

/* tabela */
.nf-scroll{width:100%;min-width:0;max-height:68dvh;overflow:auto;border:1px solid var(--border);border-radius:4px;scrollbar-color:#637484 var(--bg-surface)}
.nf-scroll::-webkit-scrollbar{width:10px;height:10px}
.nf-scroll::-webkit-scrollbar-track{background:var(--bg-surface)}
.nf-scroll::-webkit-scrollbar-thumb{background:#637484;border:2px solid var(--bg-surface);border-radius:6px}
.nf-table{min-width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:12px;text-align:left}
.nf-table>thead>tr>th{position:sticky;top:0;z-index:3;height:var(--header-height);padding:0 14px;background:var(--bg-surface);border-bottom:1px solid var(--border);color:var(--text-muted);font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;vertical-align:middle}
.nf-table th.right,.nf-table td.right{text-align:right}
.nf-th-plain{display:block;padding:0}
.nf-sort{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;min-height:var(--header-height);padding:0;border:0;background:none;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left}
.nf-table th.right .nf-sort{flex-direction:row-reverse}
.nf-sort[data-active=true]{color:#70cfff}
.nf-sort svg{width:11px;height:11px;color:var(--text-muted)}
.nf-row{height:var(--row-height);background:var(--bg-page)}
.nf-row td{padding:0 14px;height:var(--row-height);border-bottom:1px solid var(--border);vertical-align:middle;background:inherit}
.nf-row:hover{background:var(--bg-hover)}
.nf-row[data-selected=true],.nf-row[data-expanded=true]{background:var(--bg-selected)}
.nf-table>thead>tr>th:first-child,.nf-row td:first-child{padding:0 8px;text-align:center}
.nf-checkbox{width:16px!important;height:16px!important;min-height:0!important;padding:0!important;accent-color:var(--accent);cursor:pointer}
.nf-cell-text{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nf-strong{font-weight:600}
.nf-date{white-space:nowrap}.nf-late{color:var(--warning)}
.nf-money{font:600 12px var(--font-mono);white-space:nowrap}
.nf-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:2px}
.nf-month-row th{padding:0 14px;height:30px;background:var(--bg-hover);border-bottom:1px solid var(--border);text-align:left}
.nf-month-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:600}
.nf-month-head>span{display:inline-flex;align-items:center;gap:8px}
.nf-month-head em{font-style:normal;font-weight:400;padding:0 6px;border-radius:3px;background:rgba(255,255,255,.06);color:var(--text-muted);font-size:11px}
.nf-month-head strong{font-weight:600}
.nf-empty{padding:40px 16px;text-align:center;color:var(--text-muted)}
.nf-empty-row{display:flex;align-items:center;gap:8px}
.nf-empty-col{display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.nf-empty-col p{display:flex;align-items:center;gap:8px}

/* badges */
.nf-badge{display:inline-flex;align-items:center;gap:5px;max-width:100%;height:20px;padding:0 6px;border-radius:3px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-muted);background:rgba(255,255,255,.06)}
.nf-badge svg{width:11px;height:11px}
.nf-badge.pending{color:var(--warning);background:rgba(212,167,44,.12)}
.nf-badge.overdue{color:var(--danger);background:rgba(229,83,75,.12)}
.nf-badge.paid{color:var(--success);background:rgba(63,178,127,.12)}

/* detalhe expandido */
.nf-detail-cell{padding:0!important;border-bottom:1px solid var(--border)}
.nf-detail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 24px;margin:0;padding:12px 16px 12px 40px;background:var(--bg-hover)}
.nf-detail>div{min-width:0}
.nf-detail dt{margin-bottom:3px;color:var(--text-muted);font-size:11px}
.nf-detail dd{margin:0;font-size:12px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nf-detail dd.nf-wrap{white-space:pre-wrap;overflow-wrap:anywhere}
.nf-detail .wide{grid-column:span 2}
.nf-detail a{color:var(--text);text-decoration:underline;text-underline-offset:3px;cursor:pointer}

/* rodapé */
.nf-summary{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 16px;min-height:36px;padding:0 12px;border:1px solid var(--border);border-top:0;background:var(--bg-hover);font-size:11px;font-weight:600}
.nf-summary strong{font-family:var(--font-mono);font-size:12px}
.nf-summary-values{display:flex;flex-wrap:wrap;gap:4px 16px;font-weight:400}
.nf-summary-values b{font:600 12px var(--font-mono)}
.nf-pagination{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;min-height:32px;padding:7px 0 0;color:var(--text-muted);font-size:12px}
.nf-pagination-info{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.nf-pagination select{width:auto;height:28px;padding:0 6px}
.nf-pages{display:flex;align-items:center;gap:6px;margin-left:auto}
.nf-pagination .nf-btn{height:28px;min-width:28px;padding:0 7px}

/* avisos */
.nf-notice{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;margin-bottom:8px;border:1px solid rgba(63,178,127,.35);border-radius:4px;background:rgba(63,178,127,.1);color:#9be6c6;font-size:12px}
.nf-notice.error{border-color:rgba(245,50,40,.4);background:rgba(245,50,40,.1);color:#ffb3ae}
.nf-notice span{overflow-wrap:anywhere}

/* seletor inline */
.nf-picker{position:relative;min-width:0;font-weight:400}
.nf-picker summary{display:flex;justify-content:space-between;align-items:center;gap:8px;list-style:none;min-height:32px;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-page);color:var(--text);cursor:pointer;font-size:12px;overflow-wrap:anywhere}
.nf-picker summary::-webkit-details-marker{display:none}
.nf-picker[open]>summary{border-color:var(--accent)}
.nf-picker-panel{margin-top:6px;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-surface)}
.nf-picker-options{display:flex;flex-direction:column;gap:2px;max-height:180px;margin-top:8px;overflow:auto}
.nf-picker-options button{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px;padding:6px 8px;border:0;border-radius:3px;background:transparent;color:var(--text);text-align:left;font-size:12px}
.nf-picker-options button:hover,.nf-picker-options button[aria-pressed=true]{background:var(--bg-selected)}
.nf-picker-options p{padding:8px;color:var(--text-muted);font-size:12px}

/* modal */
.nf-modal{padding:0;position:fixed;margin:auto;width:calc(100% - 32px);max-width:550px;max-height:calc(100dvh - 32px);background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;box-shadow:0 30px 100px #000a;overflow:auto}
.nf-modal.wide{max-width:850px}
.nf-modal::backdrop{background:#03060ccc}
.nf-modal-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);background:var(--bg-surface)}
.nf-modal-head h2{margin-top:3px;font-size:18px;font-weight:600}
.nf-modal-body{padding:18px 20px}
.nf-fieldset{min-width:0;margin:0 0 20px;padding:0;border:0}
.nf-fieldset legend{margin-bottom:12px;padding:0;font-size:13px;font-weight:600}
.nf-fieldset legend>span{margin-right:8px;padding:2px 6px;border:1px solid var(--border);border-radius:3px;background:var(--bg-hover);color:#8dbff9;font-size:10px}
.nf-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.nf-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.nf-form-grid label,.nf-field{display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--text-muted);font-size:11px}
.nf-form-grid small{color:var(--text-muted);font-size:10px}
.nf-form-grid .span-2{grid-column:span 2}.nf-form-grid .span-3{grid-column:span 3}
.nf-modal-footer{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
.nf-upload{display:flex!important;flex-direction:row!important;align-items:center;gap:12px;position:relative;overflow:hidden;padding:12px;border:1px dashed var(--border);border-radius:4px;background:var(--bg-page);cursor:pointer}
.nf-upload:hover{border-color:var(--accent);background:var(--bg-hover)}
.nf-upload>svg{width:22px;height:22px;color:var(--accent)}
.nf-upload>span{display:grid;gap:3px;min-width:0}
.nf-upload strong{font-size:12px;font-weight:500;color:var(--text);overflow-wrap:anywhere}
.nf-upload small{font-size:10px;color:var(--text-muted)}
.nf-upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.nf-info{margin-bottom:16px!important;padding:8px 12px;border:1px solid var(--border);border-radius:4px;background:var(--bg-hover);color:var(--text-muted);font-size:12px}
.nf-dialog-copy{color:var(--text-muted);font-size:13px}
.nf-confirm-icon{display:grid;place-items:center;width:40px;height:40px;margin-bottom:12px;border-radius:4px;background:rgba(245,50,40,.12);color:var(--danger)}
.nf-payment-summary{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-bottom:14px}
.nf-payment-summary span{font-weight:600;font-size:13px}
.nf-payment-summary small{display:block;margin-top:3px;font-weight:400;font-size:11px;color:var(--text-muted)}
.nf-payment-summary strong{font:600 20px var(--font-mono);color:var(--success)}
.nf-pdf-frame{display:block;width:100%;height:60dvh;min-height:260px;border:0;border-radius:4px;background:#fff}
.nf-preview-image{display:block;max-width:100%;max-height:65dvh;margin:auto;object-fit:contain}

@media(max-width:900px){.nf-detail{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.nf-workspace{padding:8px;gap:6px}.nf-period{margin-left:0;width:100%;justify-content:space-between}.nf-month{flex:1;min-width:0}.nf-toolbar-actions{flex-basis:100%}.nf-separator{display:none}.nf-scroll{max-height:65dvh}}
@media(max-width:640px){.nf-modal{width:calc(100% - 16px);max-height:calc(100dvh - 16px)}.nf-modal-head{padding:12px 14px}.nf-modal-body{padding:14px}.nf-form-grid,.nf-form-grid.two{grid-template-columns:1fr}.nf-form-grid .span-2,.nf-form-grid .span-3{grid-column:auto}.nf-modal-footer{flex-direction:column-reverse;align-items:stretch}.nf-modal input,.nf-modal select,.nf-modal textarea{font-size:16px}.nf-heading{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.nf-workspace *,.nf-modal *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{
  .nf-workspace,.nf-modal{--bg-page:#fff;--bg-surface:#fff;--bg-hover:#f2f2f2;--bg-selected:#f2f2f2;--border:#ccc;--text:#000;--text-muted:#444}
  .nf-toolbar,.nf-pagination,.nf-breadcrumb,.nf-segment,.nf-row-actions{display:none}
  .nf-scroll{max-height:none;overflow:visible}
}
`;