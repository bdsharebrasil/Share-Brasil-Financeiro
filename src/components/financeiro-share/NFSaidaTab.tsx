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
  ArrowUpRight, LayoutList, LayoutGrid, FolderOpen, ChevronRight,
  Wallet, CircleDollarSign, TriangleAlert, Plane, CalendarDays,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import {
  EnviarEmailClienteDialog,
} from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { ReciboSaidaPreviewModal } from "./ReciboSaidaPreviewModal";
import { normalizeReceiptForPdf } from "@/hooks/useReceiptPdfGenerator";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import { formatDate } from "@/lib/receiptUtils";
import { API_ORIGIN, getAuthToken } from "@/lib/api";
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

const paid = (status: string | null) => ["pago", "recebido"].includes((status || "").toLowerCase());
const pending = (status: string | null) => ["em_aberto", "aberto", "pendente", "atrasado", "em_atraso"].includes((status || "").toLowerCase());
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

type SortBy = "data" | "nome";
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: string | null }) {
  const state = paid(status) ? "paid" : pending(status) ? "pending" : "neutral";
  return <span className={`nf-badge ${state}`}>{state === "paid" ? <CheckCircle2 /> : <Clock />}{state === "paid" ? "Pago" : state === "pending" ? "Em aberto" : status || "Não informado"}</span>;
}

/** Inline picker: no portal, so it remains usable inside the native modal. */
function SearchableCombobox({items, value, onChange, placeholder, searchPlaceholder, emptyMessage}: {
  items: {id:string; label:string}[]; value:string; onChange:(id:string,label:string)=>void; placeholder:string; searchPlaceholder:string; emptyMessage:string;
}) {
  const [query,setQuery] = useState("");
  const ref = useRef<HTMLDetailsElement>(null);
  const selected = items.find(item => item.id === value);
  const matches = items.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <details className="nf-picker" ref={ref} onKeyDown={e => {if(e.key === 'Escape' && ref.current?.open){e.preventDefault(); e.stopPropagation(); ref.current.open=false; ref.current.querySelector('summary')?.focus();}}}>
    <summary aria-label={placeholder}>{selected?.label || placeholder}<ChevronRight /></summary>
    <div className="nf-picker-panel"><input aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {if(e.key === 'Enter') e.preventDefault();}} />
      <div className="nf-picker-options">{matches.map(item => <button type="button" key={item.id} aria-pressed={item.id === value} onClick={() => {onChange(item.id,item.label); setQuery(''); if(ref.current){ref.current.open=false; ref.current.querySelector('summary')?.focus();}}}>{item.label}{item.id === value && <CheckCircle2 />}</button>)}{!matches.length && <p>{emptyMessage}</p>}</div>
    </div>
  </details>;
}

export function Modal({ title, children, onClose, busy = false, wide = false }: {title: string; children: React.ReactNode; onClose: () => void; busy?: boolean; wide?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`nf-modal ${wide ? "wide" : ""}`} aria-label={title} aria-busy={busy} onCancel={e => {e.preventDefault(); if (!busy) closeRef.current();}}>
    <header className="nf-modal-head"><div><span className="nf-eyebrow">SHARE • FINANCEIRO</span><h2>{title}</h2></div><button className="nf-icon" aria-label="Fechar" disabled={busy} onClick={onClose}><X /></button></header>
    <div className="nf-modal-body">{children}</div>
  </dialog>;
}

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab() {
  const [notas, setNotas] = useState<NFSaida[]>([]);
  const [view, setView] = useState<"list" | "folders">("list");
  const [page, setPage] = useState(1);
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
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);

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
      const { notas: nfData, recibos: recData } = await nfSaidaApi.buscarNotasSaida();
      const merged = [...(nfData ?? []).map(mapNota), ...(recData ?? []).map(mapRecibo)].sort((a, b) =>
        (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "")
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
          setToast({ type: "ok", text: "Nota fiscal criada e lançamentos financeiros gerados (contas a receber Share + despesa do cliente)." });
        }
        fetchNotas();
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
      setReciboSavedUrl(reciboUrl); setEmailTarget(mapRecibo(atualizado.recibo));
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
        conta_bancaria: contasBancarias.find(c => c.id === baixaForm.conta_bancaria)?.banco || null,
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

  useEffect(() => { setPage(1); }, [searchTerm, dateFrom, dateTo, statusFilter, sortBy, sortDir, documentTab, clienteSelecionado, view]);
  const scopedRows = useMemo(() => clienteSelecionado ? filteredNotas.filter(n => (n.cliente_nome || "Cotista não informado") === clienteSelecionado) : filteredNotas, [filteredNotas, clienteSelecionado]);
  const totals = useMemo(() => scopedRows.reduce((acc, n) => {
    const value = num(n.valor); acc.total += value;
    if (paid(n.status)) acc.paid += value;
    if (pending(n.status)) { acc.open += value; if (n.data_vencimento && n.data_vencimento.slice(0,10) < todayLocal()) { acc.overdue += value; acc.lateCount++; } }
    return acc;
  }, {total: 0, paid: 0, open: 0, overdue: 0, lateCount: 0}), [scopedRows]);
  const groups = useMemo(() => {
    const map = new Map<string, NFSaida[]>();
    filteredNotas.forEach(n => { const name = n.cliente_nome || "Cotista não informado"; map.set(name, [...(map.get(name) || []), n]); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filteredNotas]);
  const pageCount = Math.max(1, Math.ceil(scopedRows.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = scopedRows.slice((currentPage - 1) * 12, currentPage * 12);
  const invalidPeriod = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const formBusy = saving || uploading;
  const formField = <K extends keyof FormState,>(key: K, value: FormState[K]) => setForm(current => ({...current, [key]: value}));
  const exportCsv = () => {
    const cell = (v: unknown) => { let value = String(v ?? ""); if (/^[=+@\-\t\r]/.test(value)) value = "'" + value; return `"${value.replace(/"/g, '""')}"`; };
    const rows = [["Número", "Cotista", "Aeronave", "Emissão", "Vencimento", "Valor (BRL)", "Categoria", "Descrição", "Status"], ...scopedRows.map(n => [n.numero, n.cliente_nome, n.aeronave, n.data_criacao?.slice(0,10), n.data_vencimento?.slice(0,10), num(n.valor).toFixed(2).replace('.', ','), n.categoria, n.descricao, n.status])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(';')).join('\r\n')], {type: "text/csv;charset=utf-8;"}));
    const a = document.createElement("a"); a.href = url; a.download = `share-${documentTab}-${todayLocal()}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const actions = (n: NFSaida) => <div className="nf-row-actions">
    <button className="nf-icon" title="Visualizar documento" aria-label={`Visualizar documento ${n.numero || ""}`} disabled={!n.arquivo_pdf_url} onClick={() => setPdfViewer({url: n.arquivo_pdf_url!, title: n.numero || "Documento"})}><FileText /></button>
    <button className={`nf-icon ${emailsEnviados.has(`${n.origem}:${n.id}`) ? "success" : ""}`} title={emailsEnviados.has(`${n.origem}:${n.id}`) ? "E-mail enviado — enviar novamente" : "Enviar por e-mail"} aria-label={`Enviar ${n.numero || "documento"} por e-mail`} onClick={() => {setEmailTarget(n); setEmailOpen(true);}}><Mail /></button>
    {pending(n.status) && n.contas_areceber_id && <button className="nf-icon success" title="Registrar recebimento" aria-label={`Registrar recebimento de ${n.numero || "documento"}`} onClick={() => openBaixa(n)}><Banknote /></button>}
    {n.origem === "nf_saida" && <button className="nf-icon" title="Editar nota" aria-label={`Editar nota ${n.numero || ""}`} onClick={() => openEdit(n)}><Pencil /></button>}
    <button className="nf-icon danger" title="Excluir documento" aria-label={`Excluir documento ${n.numero || ""}`} onClick={() => setDeleteId(n.id)}><Trash2 /></button>
  </div>;
  const feedback = toast && <div role={toast.type === "err" ? "alert" : "status"} className={`nf-notice ${toast.type === "err" ? "error" : "success"}`}><span>{toast.text}</span><button type="button" className="nf-icon" aria-label="Dispensar mensagem" onClick={() => setToast(null)}><X /></button></div>;

  return <div className="nf-workspace">
    <style>{STYLES}</style>
    <header className="nf-header">
      <div><div className="nf-eyebrow"><span className="nf-dot" /> FINANCEIRO / DOCUMENTOS DE SAÍDA</div></div>
      <div className="nf-header-actions"><button className="nf-btn" disabled={loading} onClick={() => void fetchNotas()}><RefreshCw className={loading ? "nf-spin" : ""} /> Atualizar</button><button className="nf-btn primary" onClick={documentTab === "recibo" ? openNewReceipt : openNew}><Plus />{documentTab === "recibo" ? "Emitir recibo" : "Nova nota fiscal"}</button></div>
    </header>
    {!showForm && !baixaTarget && !deleteId && feedback}
    <section className="nf-stats" aria-label="Resumo dos documentos filtrados" aria-busy={loading}>
      {[
        {label: "Total emitido", value: totals.total, note: `${scopedRows.length} documentos no filtro`, icon: FileText, color: "blue"},
        {label: "Recebido", value: totals.paid, note: "Documentos pagos", icon: CircleDollarSign, color: "green"},
        {label: "Em aberto", value: totals.open, note: "Inclui valores vencidos", icon: Wallet, color: "cyan"},
        {label: "Vencido", value: totals.overdue, note: `${totals.lateCount} documentos aguardando baixa`, icon: TriangleAlert, color: "amber"},
      ].map(({label, value, note, icon: Icon, color}) => <article className={`nf-stat ${color}`} key={label}><div className="nf-stat-top"><span>{label}</span><Icon /></div><strong>{loading || loadError ? "—" : formatBRL(value)}</strong><small>{loading ? "Atualizando documentos…" : loadError ? "Dados indisponíveis" : note}</small></article>)}
    </section>
    <section className="nf-panel" aria-label="Documentos">
      <div className="nf-panel-top"><div className="nf-segment" aria-label="Tipo de documento">{([['recibo', 'Recibos', totalRecibos], ['nota', 'Notas fiscais', totalNotas]] as const).map(([value, label, count]) => <button key={value} aria-pressed={documentTab === value} className={documentTab === value ? "active" : ""} onClick={() => {setDocumentTab(value); setClienteSelecionado(null);}}>{label}<span>{count}</span></button>)}</div><button className="nf-btn subtle" disabled={!scopedRows.length || loading || !!loadError} onClick={exportCsv}><Download /> Exportar CSV</button></div>
      <div className="nf-toolbar"><label className="nf-search"><Search /><span className="nf-sr">Buscar documentos</span><input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar cotista, número, aeronave…" /></label><select aria-label="Filtrar por status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}><option value="">Todos os status</option>{STATUS_OPCOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select><select aria-label="Ordenar documentos" value={`${sortBy}:${sortDir}`} onChange={e => {const [by, dir] = e.target.value.split(':') as [SortBy, SortDir]; setSortBy(by); setSortDir(dir);}}><option value="data:desc">Mais recentes</option><option value="data:asc">Mais antigos</option><option value="nome:asc">Cotista: A–Z</option><option value="nome:desc">Cotista: Z–A</option></select><button className={`nf-btn ${showFilterPanel ? "selected" : ""}`} aria-expanded={showFilterPanel} aria-controls="nf-period" onClick={() => setShowFilterPanel(!showFilterPanel)}><CalendarDays /> Período{(dateFrom || dateTo) && <span className="nf-dot" />}</button></div>
      {showFilterPanel && <div id="nf-period" className="nf-period"><label>Emissão a partir de<input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></label><label>Emissão até<input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></label><button className="nf-btn subtle" onClick={() => {setDateFrom(''); setDateTo('');}}>Limpar período</button>{invalidPeriod && <p className="nf-error-text" role="alert">A data final deve ser igual ou posterior à inicial.</p>}</div>}
      <div className="nf-list-heading"><div><h2>{clienteSelecionado || (view === "folders" ? "Seus cotistas" : "Todos os documentos")}</h2><p>{loading ? "Carregando…" : `${scopedRows.length} documentos encontrados`}{hasActiveFilters && <button className="nf-text-btn" onClick={clearFilters}>Limpar filtros</button>}</p></div><div className="nf-view-toggle"><button className={view === "list" ? "active" : ""} aria-label="Visualização em lista" aria-pressed={view === "list"} onClick={() => {setView('list'); setClienteSelecionado(null);}}><LayoutList /></button><button className={view === "folders" ? "active" : ""} aria-label="Visualização por cotista" aria-pressed={view === "folders"} onClick={() => {setView('folders'); setClienteSelecionado(null);}}><LayoutGrid /></button></div></div>
      {clienteSelecionado && <div className="nf-back"><button className="nf-text-btn" onClick={() => setClienteSelecionado(null)}><ArrowLeft /> Todos os cotistas</button></div>}
      {loading ? <div className="nf-empty" role="status"><RefreshCw className="nf-spin" /><h3>Carregando documentos</h3><p>Organizando suas informações financeiras.</p></div> : loadError ? <div className="nf-empty" role="alert"><TriangleAlert /><h3>Não foi possível carregar</h3><p>{loadError}</p><button className="nf-btn" onClick={() => void fetchNotas()}>Tentar novamente</button></div> : !scopedRows.length ? <div className="nf-empty"><Search /><h3>{hasActiveFilters ? "Nenhum resultado encontrado" : "Seu arquivo começa aqui"}</h3><p>{hasActiveFilters ? "Ajuste a busca ou o período para encontrar seus documentos." : "Emita o primeiro documento para acompanhar os recebimentos."}</p><button className="nf-btn" onClick={hasActiveFilters ? clearFilters : documentTab === 'recibo' ? openNewReceipt : openNew}>{hasActiveFilters ? "Limpar filtros" : "Criar documento"}</button></div> : view === "folders" && !clienteSelecionado ? <div className="nf-folders">{groups.map(([name, rows]) => <button className="nf-folder" key={name} onClick={() => setClienteSelecionado(name)}><div className="nf-folder-top"><span className="nf-folder-icon"><FolderOpen /></span><ArrowUpRight /></div><h3>{name}</h3><p>{rows.length} documentos • {new Set(rows.map(n => n.data_criacao?.slice(0,4)).filter(Boolean)).size} ano(s)</p><div className="nf-folder-bottom"><strong>{formatBRL(rows.reduce((sum,n) => sum + num(n.valor),0))}</strong><span>{rows.filter(n => pending(n.status)).length} em aberto</span></div></button>)}</div> : <>
        <div className="nf-table-wrap"><table className="nf-table"><caption className="nf-sr">Documentos financeiros de saída</caption><thead><tr><th scope="col">Documento / cotista</th><th scope="col">Aeronave</th><th scope="col">Emissão / vencimento</th><th scope="col">Categoria</th><th scope="col" className="right">Valor</th><th scope="col">Status</th><th scope="col" className="right">Ações</th></tr></thead><tbody>{visibleRows.map(n => <tr key={`${n.origem}:${n.id}`}><td><div className="nf-doc-cell"><span className="nf-doc-icon"><FileText /></span><div><strong>{n.numero || 'Sem número'}</strong><span title={n.cliente_nome || ''}>{n.cliente_nome || 'Cotista não informado'}</span>{n.descricao && <small title={n.descricao}>{n.descricao}</small>}</div></div></td><td><span className="nf-aircraft"><Plane />{n.aeronave || '—'}</span></td><td><div className="nf-dates"><span>{n.data_criacao ? formatDate(n.data_criacao.slice(0,10)) : '—'}</span><small className={pending(n.status) && n.data_vencimento && n.data_vencimento.slice(0,10) < todayLocal() ? 'nf-late' : ''}>Venc. {n.data_vencimento ? formatDate(n.data_vencimento.slice(0,10)) : '—'}</small></div></td><td><span className="nf-category" title={n.categoria || ''}>{n.categoria || 'Sem categoria'}</span></td><td className="right nf-amount">{formatBRL(num(n.valor))}</td><td><StatusBadge status={n.status} /></td><td>{actions(n)}</td></tr>)}</tbody></table></div>
        <div className="nf-mobile-docs">{visibleRows.map(n => <article className="nf-mobile-doc" key={`${n.origem}:${n.id}`}><header><span className="nf-doc-icon"><FileText /></span><div><strong>{n.numero || 'Sem número'}</strong><small>{n.aeronave || 'Sem aeronave'}</small></div><StatusBadge status={n.status} /></header><h3>{n.cliente_nome || 'Cotista não informado'}</h3><p>{n.descricao || n.categoria || 'Sem descrição'}</p><dl><div><dt>Valor</dt><dd className="nf-amount">{formatBRL(num(n.valor))}</dd></div><div><dt>Emissão</dt><dd>{n.data_criacao ? formatDate(n.data_criacao.slice(0,10)) : '—'}</dd></div><div><dt>Vencimento</dt><dd>{n.data_vencimento ? formatDate(n.data_vencimento.slice(0,10)) : '—'}</dd></div></dl><footer><span className="nf-category">{n.categoria || 'Sem categoria'}</span>{actions(n)}</footer></article>)}</div>
        <footer className="nf-pagination"><span>Exibindo {(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, scopedRows.length)} de {scopedRows.length}</span><div><button className="nf-icon" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft /></button><span>{currentPage} / {pageCount}</span><button className="nf-icon" aria-label="Próxima página" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight /></button></div></footer>
      </>}
    </section>

    {showForm && !reciboPreview && <Modal title={editingId ? 'Editar nota fiscal' : documentType === 'recibo' ? 'Emitir recibo de saída' : 'Nova nota fiscal'} onClose={closeForm} busy={formBusy} wide>
      <form onSubmit={e => {e.preventDefault(); void save();}}>
        {feedback}
        {editingId && <p className="nf-info">Esta edição altera o documento. Os lançamentos financeiros já vinculados não são recalculados.</p>}
        <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>01</span> Documento e cotista</legend><div className="nf-form-grid">
          <label>Número {documentType === 'nota' && '*'}<input required={documentType === 'nota'} readOnly={documentType === 'recibo'} value={documentType === 'recibo' ? 'Gerado ao finalizar' : form.numero} onChange={e => formField('numero', e.target.value)} /></label>
          <div className="nf-field span-2"><span>Cotista / aeronave *</span><SearchableCombobox items={cotistas.map(c => ({id: c.cotista_aeronave_id, label: `${c.nome} · ${matriculaPorAeronave.get(c.aeronave_id) || 'Sem matrícula'}`}))} value={form.cotista_aeronave_id} onChange={selecionarCotista} placeholder="Selecione o cotista" searchPlaceholder="Buscar cotista..." emptyMessage="Nenhum cotista encontrado." /></div>
          <label>Aeronave<input readOnly value={form.aeronave} placeholder="Vinculada ao cotista" /></label><label>Emissão *<input required type="date" value={form.data_criacao} onChange={e => formField('data_criacao', e.target.value)} /></label><label>Vencimento<input type="date" value={form.data_vencimento} onChange={e => formField('data_vencimento', e.target.value)} /><small>Se vazio, utiliza a data de emissão.</small></label>
        </div></fieldset>
        <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>02</span> Valores e classificação</legend><div className="nf-form-grid">
          <label>Valor (R$) *<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={form.valor} onChange={e => formField('valor', e.target.value)} placeholder="0,00" /></label>
          <div className="nf-field span-2"><span>Categoria de receita {editingId ? '' : '*'}</span><SearchableCombobox items={categoriasReceita.map(c => ({id:c.id, label:c.nome}))} value={form.categoria_receita_id || form.categoria} onChange={(id, label) => setForm(current => ({...current, categoria_receita_id:id, categoria:label}))} placeholder={form.categoria || "Selecione a categoria"} searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." /></div>
          {!editingId && <div className="nf-field span-2"><span>Categoria de despesa do cliente *</span><SearchableCombobox items={despesaOptions.map(o => ({id:o.optionId, label:o.label}))} value={selectedDespesaOptionId} onChange={id => {const option = despesaOptions.find(o => o.optionId === id); setForm(current => ({...current, categoria_despesa_id:option?.categoriaId || '', categoria_despesa_subcategoria:option?.subcategoria || ''}));}} placeholder="Selecione a classificação" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria encontrada." /></div>}
          <label>Status<select value={form.status} onChange={e => formField('status',e.target.value as StatusDocumentoSaida)}>{STATUS_OPCOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="span-3">Descrição<textarea rows={3} value={form.descricao} onChange={e => formField('descricao', e.target.value)} placeholder="Descreva o serviço ou a cobrança…" /></label>
        </div></fieldset>
        {documentType === 'nota' && <fieldset disabled={formBusy} className="nf-fieldset"><legend><span>03</span> Documento anexo</legend><label className="nf-upload"><Upload /><span><strong>{uploading ? 'Enviando arquivo…' : form.arquivo_pdf_url ? getFileNameFromUrl(form.arquivo_pdf_url) : 'Selecione o PDF ou imagem da nota'}</strong><small>PDF, PNG, JPG ou WebP • até 20 MB</small></span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {const file = e.target.files?.[0]; if (file) {if (file.size > 20 * 1024 * 1024) setToast({type:'err',text:'O arquivo deve ter até 20 MB.'}); else void uploadDocument(file);} e.target.value='';}} /></label>{form.arquivo_pdf_url && <button type="button" className="nf-text-btn" onClick={() => formField('arquivo_pdf_url','')}>Remover vínculo do anexo</button>}</fieldset>}
        <footer className="nf-modal-footer"><button type="button" className="nf-btn" disabled={formBusy} onClick={closeForm}>Cancelar</button><button className="nf-btn primary" disabled={formBusy} type="submit">{saving ? 'Salvando…' : uploading ? 'Enviando anexo…' : editingId ? 'Salvar alterações' : documentType === 'recibo' ? 'Revisar recibo' : 'Criar nota fiscal'}<ArrowUpRight /></button></footer>
      </form>
    </Modal>}

    <ReciboSaidaPreviewModal open={!!reciboPreview} data={reciboPreview?.pdfData ?? null} saving={saving} savedUrl={reciboSavedUrl} onClose={closeReciboPreview} onConfirm={confirmReciboSave} onError={error => setToast({type:'err',text:error instanceof Error ? error.message : 'Não foi possível gerar o PDF.'})} onSendEmail={() => {if (emailTarget) setEmailOpen(true);}} />
    {pdfViewer && <Modal title={pdfViewer.title} onClose={() => setPdfViewer(null)} wide>
      {isImageUrl(pdfViewer.url) ? <img className="nf-preview-image" src={resolveArquivoUrl(pdfViewer.url)} alt={pdfViewer.title} /> : <iframe className="nf-pdf-frame" src={resolveArquivoUrl(pdfViewer.url)} title={pdfViewer.title} />}
      <footer className="nf-modal-footer"><button className="nf-btn" onClick={() => setPdfViewer(null)}>Fechar</button><button className="nf-btn primary" disabled={pdfDownloading} onClick={() => void downloadPdf(pdfViewer.url,pdfViewer.title)}><Download />{pdfDownloading ? 'Baixando…' : 'Baixar arquivo'}</button></footer>
    </Modal>}
    {emailTarget && <EnviarEmailClienteDialog open={emailOpen} onOpenChange={setEmailOpen} onSent={() => setEmailsEnviados(current => new Set(current).add(`${emailTarget.origem}:${emailTarget.id}`))} assuntoSugerido={`${emailTarget.origem === 'recibo_saida' ? 'Recibo' : 'Nota fiscal'} de saída ${emailTarget.numero || 'sem número'} — ${emailTarget.cliente_nome || ''}`} mensagemSugerida={`Olá${emailTarget.cliente_nome ? ` ${emailTarget.cliente_nome}` : ''},\n\nSegue a documentação de saída emitida pela Share.\n\nNúmero: ${emailTarget.numero || '—'}\nValor: ${formatBRL(num(emailTarget.valor))}\n\nAtenciosamente,\nEquipe Share Brasil`} destinatarioInicial={emailTarget.cliente_email || ''} anexos={emailTarget.arquivo_pdf_url ? [{id:`${emailTarget.origem}:${emailTarget.id}`,url:emailTarget.arquivo_pdf_url,label:emailTarget.origem === 'recibo_saida' ? 'Recibo de saída' : 'Nota fiscal de saída',filename:getFileNameFromUrl(emailTarget.arquivo_pdf_url)}] : []} />}
    {deleteId && <Modal title="Excluir documento" onClose={() => setDeleteId(null)} busy={deleting}>{feedback}<div className="nf-confirm-icon"><Trash2 /></div><p className="nf-dialog-copy">O documento, o PDF e os lançamentos financeiros vinculados serão removidos. Esta ação não pode ser desfeita.</p><footer className="nf-modal-footer"><button className="nf-btn" disabled={deleting} onClick={() => setDeleteId(null)}>Manter documento</button><button className="nf-btn destructive" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Excluindo…' : 'Excluir documento'}</button></footer></Modal>}
    {baixaTarget && <Modal title="Registrar recebimento" onClose={closeBaixa} busy={baixaSaving || baixaUploading}>
      <form onSubmit={e => {e.preventDefault(); void confirmBaixa();}}>{feedback}<div className="nf-payment-summary"><span>{baixaTarget.cliente_nome}<small>Documento {baixaTarget.numero || 'sem número'}</small></span><strong>{formatBRL(num(baixaTarget.valor))}</strong></div><p className="nf-info">Confirma o recebimento da Share e atualiza a despesa correspondente do cliente.</p><fieldset className="nf-fieldset" disabled={baixaSaving || baixaUploading}><div className="nf-form-grid two"><label>Data do pagamento *<input required type="date" value={baixaForm.data_pagamento} onChange={e => setBaixaForm({...baixaForm,data_pagamento:e.target.value})} /></label><label>Forma de pagamento<select value={baixaForm.forma_pagamento} onChange={e => setBaixaForm({...baixaForm,forma_pagamento:e.target.value})}>{FORMAS_PAGAMENTO.map(v => <option key={v}>{v}</option>)}</select></label><label className="span-2">Conta bancária<select value={baixaForm.conta_bancaria} onChange={e => setBaixaForm({...baixaForm,conta_bancaria:e.target.value})}><option value="">Selecione a conta</option>{contasBancarias.map(c => <option key={c.id} value={c.id}>{c.banco}{c.numero_conta ? ` • ${c.numero_conta}` : ''}</option>)}</select></label><label className="span-2">URL do comprovante<input value={baixaForm.comprovante_url} onChange={e => setBaixaForm({...baixaForm,comprovante_url:e.target.value})} placeholder="https://…" /></label><label className="nf-upload span-2"><Upload /><span><strong>{baixaUploading ? 'Enviando…' : 'Anexar comprovante'}</strong><small>PDF ou imagem • até 20 MB</small></span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => {const file=e.target.files?.[0]; if(file) {if(file.size > 20 * 1024 * 1024) setToast({type:'err',text:'O comprovante deve ter até 20 MB.'}); else void uploadComprovante(file);} e.target.value='';}} /></label></div></fieldset><footer className="nf-modal-footer"><button type="button" className="nf-btn" disabled={baixaSaving || baixaUploading} onClick={closeBaixa}>Cancelar</button><button type="submit" className="nf-btn primary" disabled={baixaSaving || baixaUploading}><CheckCircle2 />{baixaSaving ? 'Registrando…' : 'Confirmar recebimento'}</button></footer></form>
    </Modal>}
  </div>;
}

export const STYLES = `
.nf-picker{position:relative;min-width:0;font-weight:400}.nf-picker summary{display:flex;justify-content:space-between;align-items:center;gap:8px;list-style:none;padding:11px 12px;border:1px solid #25334a;background:#0c1525;border-radius:9px;min-height:44px;color:#e0ebf9;cursor:pointer;font-size:12px;overflow-wrap:anywhere}.nf-picker summary::-webkit-details-marker{display:none}.nf-picker[open]>summary{border-color:#699edc}.nf-picker-panel{padding:10px;background:#17253b;border:1px solid #3e5979;border-radius:9px;margin-top:7px}.nf-picker-options{max-height:180px;overflow:auto;margin-top:8px;display:flex;flex-direction:column;gap:3px}.nf-picker-options button{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;background:transparent;color:#cddcf0;border-radius:5px;padding:10px;text-align:left;font-size:12px!important;min-height:40px}.nf-picker-options button:hover,.nf-picker-options button[aria-pressed=true]{background:#28456b;color:white}.nf-picker-options p{padding:8px;color:#afc0d6;font-size:12px}

.nf-workspace,.nf-modal{--nf-bg:#0b1120;--nf-panel:#111b2d;--nf-line:#25334a;--nf-muted:#9aaec8;--nf-text:#edf4ff;--nf-blue:#3478f6;--nf-cyan:#6cd7ee;color-scheme:dark;color:var(--nf-text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;letter-spacing:-.01em}
.nf-workspace *,.nf-modal *{box-sizing:border-box}.nf-workspace{container-type:inline-size;min-width:0;background:radial-gradient(ellipse at 5% 0%,#112645 0%,transparent 42%),var(--nf-bg);padding:clamp(16px,3vw,40px);border:1px solid #1b2c44;border-radius:22px}
.nf-workspace h1,.nf-workspace h2,.nf-workspace h3,.nf-workspace p,.nf-modal h2,.nf-modal p{margin:0}.nf-workspace button,.nf-modal button{font:inherit;cursor:pointer}.nf-workspace button:disabled,.nf-modal button:disabled{opacity:.42;cursor:not-allowed}.nf-workspace svg,.nf-modal svg{width:17px;height:17px;flex-shrink:0;stroke-width:1.7}.nf-workspace button,.nf-modal button{transition:background .18s,border-color .18s,transform .18s}.nf-workspace :focus-visible,.nf-modal :focus-visible{outline:2px solid #79dcf2;outline-offset:3px}.nf-workspace input,.nf-workspace select,.nf-modal input,.nf-modal select,.nf-modal textarea{font:inherit;min-width:0;width:100%;min-height:44px;border:1px solid var(--nf-line);border-radius:9px;background:#0c1525;color:var(--nf-text);padding:10px 12px}.nf-workspace input::placeholder,.nf-modal input::placeholder,.nf-modal textarea::placeholder{color:#8196b2}.nf-modal input[readonly]{background:#172135;color:#a6b8d1}.nf-modal textarea{resize:vertical;min-height:90px}
.nf-header{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:28px}.nf-eyebrow{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.13em;font-weight:700;color:#93b7e6}.nf-dot{display:inline-block;background:#62cce4;width:6px;height:6px;border-radius:50%;flex-shrink:0}nf-header-actions{display:flex;gap:10px;flex-shrink:0}.nf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 15px;border:1px solid var(--nf-line);border-radius:9px;color:#dbe8fa;background:#172238;font-size:12px!important;font-weight:600!important;white-space:nowrap}.nf-btn:hover{background:#21314c;border-color:#3b526f}.nf-btn.primary{background:#09317a;color:#fff;border-color:#020f27;box-shadow:0 4px 16px #1265ed20}.nf-btn.primary:hover{background:#4289ff}.nf-btn.subtle{background:transparent}.nf-btn.selected{border-color:#4774ad;color:#89caff;background:#162d4a}.nf-btn.destructive{background:#bc3545;border-color:#d34b5b;color:white}.nf-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;height:36px;width:36px;border:1px solid transparent;border-radius:8px;background:transparent;color:#a4b7d1;padding:0}.nf-icon:hover{background:#23334c;color:white;border-color:#354b6c}.nf-icon.success{color:#52dbad}.nf-icon.danger{color:#ed8b98}.nf-icon.danger:hover{background:#462233}.nf-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;margin:8px 0 16px;padding:0 19px;font-weight:300;font-size:12px;line-height:16px}.nf-stat{background:linear-gradient(135deg,#152139,#101a2b);border:1px solid var(--nf-line);border-radius:13px;padding:19px;position:relative;overflow:hidden}.nf-stat:before{content:'';position:absolute;left:0;top:20px;bottom:20px;width:2px;background:var(--accent)}.nf-stat.blue{--accent:#659cff}.nf-stat.green{--accent:#51d8ac}.nf-stat.cyan{--accent:#6cd7ee}.nf-stat.amber{--accent:#ecc06a}.nf-stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}.nf-stat-top span{color:#b0c1d8;font-size:11px;font-weight:550}.nf-stat-top svg{color:var(--accent);width:19px;height:19px}.nf-stat strong{display:block;font-size:clamp(18px,1.8vw,27px);font-weight:650;letter-spacing:-.035em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.nf-stat small{display:block;margin-top:7px;color:#91a6c2;font-size:10px}.nf-panel{background:#10192a;border:1px solid var(--nf-line);border-radius:15px;overflow:hidden;box-shadow:0 12px 40px #00000015}.nf-panel-top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:19px 22px;border-bottom:1px solid var(--nf-line)}.nf-segment{display:flex;gap:4px;padding:4px;border-radius:10px;background:#0b1322;border:1px solid #253249}.nf-segment button{display:flex;align-items:center;justify-content:center;gap:10px;min-height:36px;border:0;border-radius:7px;background:transparent;color:#a4b6cd;padding:7px 14px;font-size:12px;font-weight:600}.nf-segment button.active{color:white;background:#2869e4;box-shadow:0 3px 8px #0002}.nf-segment button span{font-size:10px;padding:1px 6px;border-radius:4px;background:#ffffff10}.nf-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) 160px 155px auto;gap:10px;padding:20px 22px 10px}.nf-toolbar select{font-size:12px}.nf-search{position:relative;display:flex;align-items:center;min-width:0}.nf-search svg{position:absolute;left:13px;color:#8ea7c5}.nf-search input{padding-left:39px;font-size:12px}.nf-period{display:flex;align-items:end;flex-wrap:wrap;gap:12px;padding:14px 22px;margin:0 22px;background:#142037;border:1px solid #2a3f5f;border-radius:10px}.nf-period label{flex:1;min-width:130px;color:#b6c7de;font-size:11px}.nf-period input{margin-top:6px}.nf-error-text{color:#ffb3bd;font-size:12px;flex-basis:100%}.nf-list-heading{display:flex;justify-content:space-between;align-items:center;padding:19px 22px;gap:12px}.nf-list-heading h2{font-size:16px;font-weight:600;overflow-wrap:anywhere}.nf-list-heading p{color:var(--nf-muted);font-size:11px;margin-top:3px}.nf-text-btn{display:inline-flex;align-items:center;gap:6px;color:#8fc7ff;background:none;border:0;padding:4px 0;font-size:12px!important}.nf-list-heading .nf-text-btn{margin-left:12px;font-size:11px!important}.nf-view-toggle{display:flex;padding:3px;gap:3px;border:1px solid var(--nf-line);border-radius:8px;background:#0c1525;flex-shrink:0}.nf-view-toggle button{width:34px;height:32px;display:grid;place-items:center;color:#8fa6c3;background:none;border:0;border-radius:5px}.nf-view-toggle button.active{background:#243755;color:#98cbff}.nf-back{padding:0 22px 12px}.nf-table-wrap{overflow-x:auto}.nf-table{width:100%;border-collapse:collapse;text-align:left;font-size:12px;white-space:nowrap}.nf-table thead{background:#0d1728;color:#8fa8ca;font-size:9px;letter-spacing:.075em;text-transform:uppercase}.nf-table th{font-weight:600;padding:13px 16px;border-block:1px solid #24344c}.nf-table td{padding:17px 16px;border-bottom:1px solid #223047;vertical-align:middle}.nf-table tbody tr:nth-child(even){background:#14203466}.nf-table tbody tr:hover{background:#1a2b45}.nf-table tbody tr:last-child td{border-bottom:0}.nf-table .right{text-align:right}.nf-doc-cell{display:flex;gap:12px;align-items:center}.nf-doc-icon{display:grid;place-items:center;width:35px;height:40px;background:#20355780;border:1px solid #304a6d80;color:#78afff;border-radius:8px;flex-shrink:0}.nf-doc-cell strong{display:block;font-size:12px;font-weight:650;color:#e0ecff}.nf-doc-cell span:not(.nf-doc-icon){display:block;font-size:11px;color:#a9bdd7;max-width:210px;overflow:hidden;text-overflow:ellipsis}.nf-doc-cell small{display:block;font-size:10px;color:#90a5c0;max-width:210px;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.nf-aircraft{display:inline-flex;align-items:center;gap:6px;color:#9ec6f1;font-size:10px}.nf-aircraft svg{width:13px;height:13px}.nf-dates{display:grid;gap:4px;font-size:11px;color:#c7d7ee}.nf-dates small{font-size:10px;color:#8da4c2}.nf-dates .nf-late{color:#edbd6e}.nf-category{display:inline-block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;padding:4px 8px;border:1px solid #284158;background:#132d3d;color:#7ed0e5;font-size:9px;border-radius:10px}.nf-amount{color:#ecf5ff;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}.nf-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid #3e4e64;border-radius:12px;overflow:hidden;padding:4px 7px;font-size:10px;white-space:nowrap;color:#bbc9dc;background:#223047}.nf-badge svg{width:12px;height:12px}.nf-badge.paid{color:#5fe1b5;background:#10352e;border-color:#215145}.nf-badge.pending{color:#f3cb79;background:#372e1f;border-color:#55432a}.nf-row-actions{display:flex;justify-content:flex-end;gap:2px}.nf-row-actions .nf-icon{width:30px;height:34px}.nf-row-actions svg{width:14px;height:14px}.nf-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 22px;background:#0d1728;border-top:1px solid var(--nf-line);font-size:10px;color:#9cb0cb}.nf-pagination>div{display:flex;align-items:center;gap:12px}.nf-pagination .nf-icon{border:1px solid var(--nf-line);width:30px;height:30px}.nf-empty{padding:60px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:#a3b8d3}.nf-empty>svg{width:34px;height:34px;color:#629ce3}.nf-empty h3{color:#e5effc;font-size:17px}.nf-empty p{max-width:420px;font-size:13px}.nf-folders{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:0 22px 24px}.nf-folder{text-align:left;border:1px solid #2c405c;background:linear-gradient(140deg,#172942,#111d30);border-radius:12px;padding:19px;color:var(--nf-text);min-width:0}.nf-folder:hover{background:#1b304d;border-color:#5884b9;transform:translateY(-2px)}.nf-folder-top{display:flex;align-items:center;justify-content:space-between;color:#7399c8;margin-bottom:19px}.nf-folder-icon{padding:10px;background:#26466c55;border-radius:9px;display:grid;place-items:center;color:#8bc7ff}.nf-folder-icon svg{width:24px;height:24px}.nf-folder h3{font-size:14px;overflow-wrap:anywhere}.nf-folder p{font-size:11px;color:#93aac8;margin-top:5px}.nf-folder-bottom{display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid #2a3b53;margin-top:19px;padding-top:13px;flex-wrap:wrap}.nf-folder-bottom strong{font-size:16px;font-weight:600}.nf-folder-bottom>span{font-size:10px;color:#e3c58b}nf-mobile-docs{display:none}.nf-notice{border:1px solid #285547;background:#15342b;color:#a2edcf;border-radius:10px;padding:10px 14px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}.nf-notice.error{border-color:#6b3544;background:#3a202d;color:#ffc0c9}.nf-notice span{overflow-wrap:anywhere}.nf-spin{animation:nf-rotate 1s linear infinite}@keyframes nf-rotate{to{transform:rotate(360deg)}}.nf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.nf-modal{padding:0;position:fixed;margin:auto;width:calc(100% - 32px);max-width:550px;max-height:calc(100dvh - 32px);background:#111c2e;border:1px solid #3a506f;border-radius:16px;box-shadow:0 30px 100px #0008;overflow:auto}.nf-modal.wide{max-width:850px}.nf-modal::backdrop{background:#030a16c9;backdrop-filter:blur(7px)}.nf-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px;border-bottom:1px solid var(--nf-line);position:sticky;top:0;background:#111c2e;z-index:1}.nf-modal-head h2{font-size:21px;font-weight:650;margin-top:5px;letter-spacing:-.025em}.nf-modal-head .nf-eyebrow{font-size:9px}.nf-modal-body{padding:22px 24px}.nf-fieldset{border:0;padding:0;margin:0 0 24px;min-width:0}.nf-fieldset legend{padding:0;margin-bottom:16px;font-size:13px;font-weight:600}.nf-fieldset legend>span{font-size:10px;color:#8dbff9;margin-right:9px;border:1px solid #345277;background:#1b3450;border-radius:5px;padding:3px 6px}.nf-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.nf-form-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nf-form-grid label,.nf-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:11px;font-weight:550;color:#bacce3}.nf-form-grid small{font-size:10px;font-weight:400;color:#8fa7c5}.nf-form-grid .span-2{grid-column:span 2}.nf-form-grid .span-3{grid-column:span 3}.nf-field>button{min-height:44px;width:100%}.nf-modal-footer{display:flex;justify-content:flex-end;align-items:center;gap:10px;border-top:1px solid var(--nf-line);padding-top:19px;margin-top:22px}.nf-upload{display:flex!important;flex-direction:row!important;align-items:center;gap:14px;border:1px dashed #456181;border-radius:10px;background:#0e192a;padding:16px;position:relative;cursor:pointer;overflow:hidden}.nf-upload:hover{border-color:#7cafe6;background:#162842}.nf-upload:focus-within{outline:2px solid #79dcf2;outline-offset:3px}.nf-upload>svg{width:24px;height:24px;color:#82b9ee}.nf-upload>span{display:grid;gap:4px;min-width:0}.nf-upload strong{font-size:12px;overflow-wrap:anywhere;color:#d8e7fa;font-weight:500}.nf-upload small{font-size:10px;color:#91a9c7}.nf-upload input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}.nf-info{padding:12px 14px;background:#172e46;border:1px solid #2d4b69;border-radius:8px;font-size:12px;color:#bad2ee;margin-bottom:22px!important}.nf-dialog-copy{font-size:14px;color:#c2d0e3}.nf-confirm-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:12px;color:#ff91a1;background:#472438;margin-bottom:16px}.nf-confirm-icon svg{width:24px;height:24px}.nf-payment-summary{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px}.nf-payment-summary span{font-weight:600;font-size:14px}.nf-payment-summary small{display:block;font-weight:400;font-size:11px;color:#94aac5;margin-top:4px}.nf-payment-summary strong{font-size:24px;color:#75e2c4;font-weight:600}.nf-pdf-frame{width:100%;height:60dvh;min-height:260px;border:0;border-radius:8px;background:white}.nf-preview-image{display:block;max-width:100%;max-height:65dvh;object-fit:contain;margin:auto}
@container(max-width:1050px){.nf-header{align-items:flex-start;flex-direction:column;gap:18px}.nf-toolbar{grid-template-columns:minmax(180px,1fr) 145px 140px}.nf-toolbar>.nf-btn{grid-column:1/-1;justify-self:start}.nf-stats{gap:10px}.nf-stat{padding:16px}.nf-folders{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container(max-width:760px){.nf-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nf-table-wrap{display:none}.nf-mobile-docs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:0 18px 18px}.nf-mobile-doc{background:#142136;border:1px solid #2b3f5b;border-radius:11px;padding:15px;min-width:0}.nf-mobile-doc header{display:flex;align-items:center;gap:9px;margin-bottom:16px}.nf-mobile-doc header>div{flex:1;min-width:0}.nf-mobile-doc header strong{display:block;font-size:12px;overflow-wrap:anywhere}.nf-mobile-doc header small{display:block;color:#8faacc;font-size:10px}.nf-mobile-doc h3{font-size:13px;overflow-wrap:anywhere}.nf-mobile-doc p{font-size:11px;color:#9bb2cf;margin-top:5px;overflow-wrap:anywhere}.nf-mobile-doc dl{display:flex;flex-wrap:wrap;gap:15px;margin:18px 0}.nf-mobile-doc dl>div:first-child{flex-basis:100%}.nf-mobile-doc dt{font-size:10px;color:#9bb0cc}.nf-mobile-doc dd{margin:4px 0 0;font-size:12px}.nf-mobile-doc dd.nf-amount{font-size:21px}.nf-mobile-doc footer{border-top:1px solid #2a3c55;padding-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}.nf-mobile-doc .nf-row-actions{margin-left:auto}.nf-row-actions .nf-icon{width:36px;height:40px}.nf-toolbar{grid-template-columns:1fr 1fr}.nf-search{grid-column:1/-1}.nf-toolbar>.nf-btn{grid-column:auto;justify-self:stretch}.nf-toolbar>select:nth-of-type(2){grid-column:1}.nf-panel-top{padding:16px;flex-wrap:wrap}.nf-list-heading{padding:18px}.nf-stat strong{font-size:22px}}
@container(max-width:490px){.nf-header-actions{width:100%;display:grid;grid-template-columns:auto 1fr}nf-stats{gap:9px;margin-bottom:18px}.nf-stat{padding:14px 12px}.nf-stat-top{margin-bottom:10px}.nf-stat strong{font-size:19px}.nf-stat small{font-size:9px}.nf-stat-top span{font-size:10px}.nf-panel-top{gap:10px}.nf-segment{width:100%}.nf-segment button{flex:1;padding-inline:8px}.nf-panel-top>.nf-btn{margin-left:auto;min-height:36px;padding-block:6px}.nf-toolbar{padding:8px 14px}.nf-mobile-docs{grid-template-columns:1fr;padding:0 14px 16px}.nf-folders{grid-template-columns:1fr;padding:0 14px 16px}.nf-period{margin:8px 14px;padding:12px}.nf-pagination{padding:14px;flex-wrap:wrap}nf-list-heading .nf-text-btn{display:flex;margin:4px 0 0}}
@media(max-width:640px){.nf-workspace{border-radius:14px;padding:14px}.nf-modal{width:calc(100% - 16px);max-height:calc(100dvh - 16px);border-radius:13px}.nf-modal-head{padding:16px}.nf-modal-head h2{font-size:18px}.nf-modal-body{padding:16px}.nf-form-grid,.nf-form-grid.two{grid-template-columns:1fr}.nf-form-grid .span-2,.nf-form-grid .span-3{grid-column:auto}.nf-modal-footer{flex-direction:column-reverse;align-items:stretch}.nf-modal input,.nf-modal select,.nf-modal textarea,.nf-workspace input,.nf-workspace select{font-size:16px}.nf-modal .nf-btn{min-height:46px}.nf-modal .nf-icon{width:44px;height:44px}}
@media(prefers-reduced-motion:reduce){.nf-workspace *,.nf-modal *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
.nf-detail-row td{padding:0 16px 18px;white-space:normal;background:#0d1728}
.nf-detail-row:hover{background:#0d1728}
.nf-detail{display:grid;gap:18px;grid-template-columns:repeat(2,minmax(0,1fr));padding:16px;border:1px solid #223047;border-radius:11px;background:#111c2e;font-size:12px}
.nf-detail h3,.nf-mobile-doc .nf-detail h3{margin-bottom:10px;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#93b7e6}
.nf-detail p{display:flex;align-items:center;gap:8px;color:#c7d7ee;font-size:11px}
.nf-detail a{display:inline-flex;align-items:center;gap:8px;color:#9ec6f1;font-size:11px}
.nf-detail dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}
.nf-detail dt{font-size:10px;color:#90a5c0}
.nf-detail dd{margin:3px 0 0;font-weight:600;color:#e0ecff;overflow-wrap:anywhere}
.nf-detail-actions{grid-column:1/-1;display:flex;justify-content:flex-end;padding-top:12px;border-top:1px solid #223047}
.nf-mobile-doc.expanded{grid-column:1/-1}
.nf-mobile-doc .nf-detail{grid-template-columns:1fr;padding:12px}
.nf-mobile-doc .nf-detail dl{grid-template-columns:1fr}
`;
