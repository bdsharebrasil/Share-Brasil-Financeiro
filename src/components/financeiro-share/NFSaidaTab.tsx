import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  DollarSign,
  Upload,
  ReceiptText,
  Banknote,
  Filter,
  SlidersHorizontal,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { FolderCard } from "@/components/ui/folder-card";
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

const emptyForm: FormState = {
  numero: "", cotista_aeronave_id: "", cliente_nome: "", cliente_cnpj: "", cliente_endereco: "", cliente_cidade: "", cliente_uf: "",
  aircraft_id: "", aeronave: "", categoria_receita_id: "", categoria: "",
  categoria_despesa_id: "", categoria_despesa_subcategoria: "",
  data_criacao: new Date().toISOString().slice(0, 10),
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
  data_pagamento: new Date().toISOString().slice(0, 10),
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
const resolveArquivoUrl = (url: string) => url.startsWith("/") ? `${API_ORIGIN}${url}` : url;

type SortBy = "data" | "nome";
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  if (["pago", "recebido"].includes(s)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
        style={{ background: "rgba(34,197,94,0.10)", color: "#4ade80", borderColor: "rgba(34,197,94,0.25)" }}>
        <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: "rgba(245,158,11,0.10)", color: "#fbbf24", borderColor: "rgba(245,158,11,0.25)" }}>
      <Clock className="h-3 w-3 mr-1" /> Em aberto
    </span>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

export default function NFSaidaTab() {
  const [notas, setNotas] = useState<NFSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [cotistas, setCotistas] = useState<CotistaOpcao[]>([]);
  const [aeronaves, setAeronaves] = useState<{ id: string; matricula_registro: string }[]>([]);
  const [categoriasReceita, setCategoriasReceita] = useState<CategoriaOpcao[]>([]);
  const [despesaOptions, setDespesaOptions] = useState<DespesaOption[]>([]);
  const [contasBancarias, setContasBancarias] = useState<{ id: string; banco: string; numero_conta: string | null }[]>([]);
  const [documentType, setDocumentType] = useState<"nota" | "recibo">("nota");
  const [uploading, setUploading] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState<string | null>(null);

  // filtros e ordenação
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
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
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(resolveArquivoUrl(url), { headers, credentials: "omit" });
      if (!response.ok) throw new Error(`PDF indisponível (${response.status})`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = getFileNameFromUrl(url) || `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
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
    cliente_nome: n.cliente_nome,
    cliente_cnpj: n.cliente_cnpj,
    cliente_endereco: n.cliente_endereco ?? null,
    cliente_cidade: n.cliente_cidade ?? null,
    cliente_uf: n.cliente_uf ?? null,
    cliente_email: n.cliente_email ?? null,
    data_criacao: n.data_criacao ?? null,
    data_vencimento: n.data_vencimento,
    valor: n.valor ?? null,
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
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
    aeronave: r.aeronave_matricula ?? null,
    aircraft_id: r.aeronave_id,
    contas_areceber_id: r.contas_areceber_id,
  });

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const { notas: nfData, recibos: recData } = await nfSaidaApi.buscarNotasSaida();
      const merged = [...(nfData ?? []).map(mapNota), ...(recData ?? []).map(mapRecibo)].sort((a, b) =>
        (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "")
      );
      setNotas(merged);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao carregar notas." });
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

  const summary = useMemo(() => {
    const total = notas.length;
    const totalPendente = notas
      .filter((n) => ["pendente", "em_aberto", "aberto", "atrasado", "em_atraso"].includes((n.status ?? "").toLowerCase()))
      .reduce((s, n) => s + num(n.valor), 0);
    const totalRecebido = notas
      .filter((n) => ["pago", "recebido"].includes((n.status ?? "").toLowerCase()))
      .reduce((s, n) => s + num(n.valor), 0);
    return { total, totalPendente, totalRecebido };
  }, [notas]);

  const hasActiveFilters = !!dateFrom || !!dateTo || !!statusFilter;

  const filteredNotas = useMemo(() => {
    let result = notas;
    if (dateFrom) result = result.filter((n) => (n.data_criacao ?? "") >= dateFrom);
    if (dateTo) result = result.filter((n) => (n.data_criacao ?? "") <= dateTo);
    if (statusFilter) result = result.filter((n) => statusFilter === "PAGO" ? ["pago", "recebido"].includes((n.status ?? "").toLowerCase()) : ["em_aberto", "aberto", "pendente"].includes((n.status ?? "").toLowerCase()));

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "data") {
        cmp = (a.data_criacao ?? "").localeCompare(b.data_criacao ?? "");
      } else {
        cmp = (a.cliente_nome ?? "").localeCompare(b.cliente_nome ?? "", "pt-BR");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [notas, dateFrom, dateTo, statusFilter, sortBy, sortDir]);

  const selecionarCliente = (clientName: string) => {
    setClienteSelecionado(clientName);
    setAnoSelecionado(null);
  };

  const voltarParaClientes = () => {
    setClienteSelecionado(null);
    setAnoSelecionado(null);
  };

  const selecionarAno = (year: string) => setAnoSelecionado(year);
  const voltarParaAnos = () => setAnoSelecionado(null);

  // Agrupamento hierárquico: cotista/cliente → ano → notas (nome já vem resolvido do servidor).
  const groupedNotas = useMemo(() => {
    const groups: Record<string, Record<string, NFSaida[]>> = {};

    filteredNotas.forEach((n) => {
      const cotistaNome = n.cliente_nome || "Cotista não informado";
      const ano = n.data_criacao?.slice(0, 4) || "Sem ano";
      groups[cotistaNome] ||= {};
      groups[cotistaNome][ano] ||= [];
      groups[cotistaNome][ano].push(n);
    });

    Object.values(groups).forEach((anos) => Object.values(anos).forEach((items) => items.sort((a, b) => {
      const aPendente = ["pendente", "em_aberto", "aberto"].includes((a.status || "").toLowerCase());
      const bPendente = ["pendente", "em_aberto", "aberto"].includes((b.status || "").toLowerCase());
      if (aPendente !== bPendente) return aPendente ? -1 : 1;
      return (b.data_criacao ?? "").localeCompare(a.data_criacao ?? "");
    })));

    return groups;
  }, [filteredNotas]);

  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter(""); };

  const gruposVisiveis = useMemo(() => Object.entries(groupedNotas), [groupedNotas]);
  const anosDoCliente = clienteSelecionado ? groupedNotas[clienteSelecionado] ?? {} : {};
  const registrosDoAno = clienteSelecionado && anoSelecionado ? anosDoCliente[anoSelecionado] ?? [] : [];

  const selectedDespesaOptionId = useMemo(() => {
    if (!form.categoria_despesa_id) return "";
    const match = despesaOptions.find((option) =>
      option.categoriaId === form.categoria_despesa_id &&
      (option.subcategoria ?? "") === (form.categoria_despesa_subcategoria ?? "")
    );
    return match?.optionId ?? "";
  }, [despesaOptions, form.categoria_despesa_id, form.categoria_despesa_subcategoria]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDocumentType("nota"); setShowForm(true); };
  const openNewReceipt = () => { setForm(emptyForm); setEditingId(null); setDocumentType("recibo"); setShowForm(true); };
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
      data_criacao: n.data_criacao ?? new Date().toISOString().slice(0, 10),
      data_vencimento: n.data_vencimento ?? "", valor: n.valor != null ? String(n.valor) : "",
      categoria_receita_id: "", categoria: n.categoria ?? "", descricao: n.descricao ?? "", status: ["pago", "recebido"].includes((n.status ?? "").toLowerCase()) ? "PAGO" : "EM_ABERTO",
      categoria_despesa_id: "", categoria_despesa_subcategoria: "",
      arquivo_pdf_url: n.arquivo_pdf_url ?? "",
    });
    setEditingId(n.id); setDocumentType("nota"); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setDocumentType("nota"); setForm(emptyForm); };

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
    if (!form.categoria_despesa_id) { setToast({ type: "err", text: "Selecione a categoria de despesa do cliente (perna 'cliente' do lançamento)." }); return; }
    if (!(Number(form.valor) > 0)) { setToast({ type: "err", text: "Informe um valor maior que zero." }); return; }
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
          const { nota } = await nfSaidaApi.atualizarNotaSaida(editingId, {
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
          setToast({ type: "ok", text: "Nota fiscal atualizada. (Lançamentos financeiros já existentes não são recalculados na edição — avise se precisar ajustar valor/categoria de uma nota já sincronizada.)" });
        } else {
          await nfSaidaApi.criarNotaSaida({
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
          });
          setToast({ type: "ok", text: "Nota fiscal criada e lançamentos financeiros gerados (contas a receber Share + despesa do cliente)." });
        }
        fetchNotas();
      }
      closeForm();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar." });
    } finally { setSaving(false); }
  };

  /** Cria o recibo primeiro para que o Worker atribua a sequência oficial; só depois gera e salva o PDF. */
  const confirmReciboSave = async (previewBlob: Blob) => {
    if (!reciboPreview || reciboSavedUrl) return;
    const { descricaoServico, dataVencimentoFinal, categoriaDespesaId, categoriaDespesaSubcategoria } = reciboPreview.payload;
    setSaving(true); setToast(null);
    try {
      if (!(previewBlob instanceof Blob)) {
        throw new Error("Não foi possível obter o PDF do recibo para salvar.");
      }

      const { recibo } = await nfSaidaApi.criarReciboSaida({ cotista_aeronave_id: form.cotista_aeronave_id, aeronave_id: form.aircraft_id, categoria_receita_id: form.categoria_receita_id, categoria_receita_nome: form.categoria, categoria_despesa_id: categoriaDespesaId, categoria_despesa_subcategoria: categoriaDespesaSubcategoria, data_emissao: form.data_criacao, data_vencimento: dataVencimentoFinal, valor_total: Number(form.valor) || 0, descricao_servico: descricaoServico, status: form.status });
      const numeroRecibo = String(recibo.numero_recibo || "");
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
      const atualizado = await nfSaidaApi.atualizarReciboSaida(recibo.id, { pdf_url: reciboUrl });
      setReciboSavedUrl(reciboUrl); setEmailTarget(mapRecibo(atualizado.recibo));
      setToast({ type: "ok", text: `Recibo ${numeroRecibo} salvo com PDF e lançamentos financeiros gerados.` }); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao salvar o recibo." }); }
    finally { setSaving(false); }
  };
  const closeReciboPreview = () => {
    setReciboPreview(null);
    if (reciboSavedUrl) { setReciboSavedUrl(null); closeForm(); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const target = notas.find((n) => n.id === deleteId);
      await nfSaidaApi.excluirNotaOuReciboSaida(deleteId, target?.origem === "recibo_saida" ? "recibo_saida" : "nf_saida");
      setToast({ type: "ok", text: target?.origem === "recibo_saida" ? "Recibo de saída excluído." : "Nota fiscal excluída." });
      setDeleteId(null); fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao excluir." });
    } finally { setDeleting(false); }
  };

  /* ─────────────── dar baixa (registrar recebimento) ─────────────── */

  const openEmail = (n: NFSaida) => {
    setEmailTarget(n);
    setEmailOpen(true);
  };

  const openBaixa = (n: NFSaida) => { setBaixaTarget(n); setBaixaForm(emptyBaixaForm); };
  const closeBaixa = () => { setBaixaTarget(null); setBaixaForm(emptyBaixaForm); };

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
    setBaixaSaving(true); setToast(null);
    try {
      await nfSaidaApi.darBaixaNotaOuReciboSaida(baixaTarget.id, {
        origem: baixaTarget.origem === "recibo_saida" ? "recibo_saida" : "nf_saida",
        data_pagamento: baixaForm.data_pagamento,
        conta_bancaria: baixaForm.conta_bancaria || null,
        forma_pagamento: baixaForm.forma_pagamento || null,
        comprovante_url: baixaForm.comprovante_url || null,
      });

      setToast({ type: "ok", text: "Baixa registrada: receita da Share recebida e despesa do cliente quitada." });
      closeBaixa();
      fetchNotas();
    } catch (e: any) { setToast({ type: "err", text: e.message || "Erro ao dar baixa." });
    } finally { setBaixaSaving(false); }
  };

  const inputCls = "border border-border bg-background/70 text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 w-full";
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Notas Fiscais de Saída</h2>
          <p className="text-xs text-muted-foreground">Notas fiscais emitidas para clientes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchNotas} className="border border-border bg-card/70 text-foreground hover:bg-card-secondary rounded-lg px-3 py-2 text-sm inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={openNew} className="text-slate-950 rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-2" style={{ background: "#06b6d4" }}>
            <Plus className="h-4 w-4" /> Nova Nota
          </button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Total Notas", value: String(summary.total), icon: FileText, color: "#38bdf8" },
          { label: "Total em Aberto", value: formatBRL(summary.totalPendente), icon: Clock, color: "#fbbf24" },
          { label: "Total Recebido", value: formatBRL(summary.totalRecebido), icon: DollarSign, color: "#4ade80" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl p-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </div>
              <div className="text-lg font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="rounded-lg px-4 py-2 text-sm border"
          style={{ background: toast.type === "ok" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            color: toast.type === "ok" ? "#4ade80" : "#f87171",
            borderColor: toast.type === "ok" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)" }}>
          {toast.text}
        </div>
      )}

      {/* inline form */}
      {showForm && (
        <div className="rounded-2xl p-5 space-y-4" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-foreground">{editingId ? "Editar Nota Fiscal" : documentType === "recibo" ? "Novo Recibo de Saída" : "Nova Nota Fiscal"}</h3>
              {!editingId && documentType === "nota" && <button onClick={openNewReceipt} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"><ReceiptText className="h-3.5 w-3.5" /> Novo Recibo</button>}
              {!editingId && documentType === "recibo" && <button type="button" onClick={openNew} className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"><ArrowLeft className="h-3.5 w-3.5" /> Voltar para Nota Fiscal</button>}
            </div>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>{documentType === "recibo" ? "Número do recibo" : "Número *"}</label>
              {documentType === "recibo" ? <p className={`${inputCls} text-muted-foreground`}>Gerado automaticamente: código do cotista-número/ano</p> : <input className={inputCls} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />}</div>
            <div className="md:col-span-2"><label className={labelCls}>Cotista (cliente ou sócio) *</label>
              <SearchableCombobox
                items={cotistas.map((c) => ({
                  id: c.cotista_aeronave_id,
                  label: `${c.nome} · ${matriculaPorAeronave.get(c.aeronave_id) || "?"}${c.documento ? ` · ${c.documento}` : ""}`,
                }))}
                value={form.cotista_aeronave_id}
                onChange={(id) => selecionarCotista(id)}
                placeholder="Selecione o cotista"
                searchPlaceholder="Buscar cliente ou sócio..."
                emptyMessage="Nenhum cotista encontrado."
              />
            </div>
            <div><label className={labelCls}>Aeronave</label>
              <input className={inputCls} value={form.aeronave} readOnly placeholder="Definida pelo cotista" /></div>
            <div><label className={labelCls}>Data Emissão</label>
              <input type="date" className={inputCls} value={form.data_criacao} onChange={(e) => setForm({ ...form, data_criacao: e.target.value })} /></div>
            <div><label className={labelCls}>Data Vencimento</label>
              <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
            <div><label className={labelCls}>Valor (R$)</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><label className={labelCls}>Categoria (Receita Share) *</label>
              <SearchableCombobox items={categoriasReceita.map((categoria) => ({ id: categoria.id, label: categoria.nome }))} value={form.categoria_receita_id || form.categoria} onChange={(id, label) => setForm({ ...form, categoria_receita_id: id, categoria: label })} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria permitida encontrada." />
            </div>
            <div><label className={labelCls}>Categoria de Despesa (Cliente) *</label>
              <SearchableCombobox
                items={despesaOptions.map((option) => ({ id: option.optionId, label: option.label }))}
                value={selectedDespesaOptionId}
                onChange={(optionId) => {
                  const option = despesaOptions.find((item) => item.optionId === optionId);
                  setForm({
                    ...form,
                    categoria_despesa_id: option?.categoriaId ?? "",
                    categoria_despesa_subcategoria: option?.subcategoria ?? "",
                  });
                }}
                placeholder="Como isso entra no caixa do cliente"
                searchPlaceholder="Buscar categoria de despesa..."
                emptyMessage="Nenhuma categoria de despesa encontrada."
              />
            </div>
            <div><label className={labelCls}>Status</label>
                <select className={inputCls + " cursor-pointer"} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusDocumentoSaida })}>
                {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
            <div className="md:col-span-3"><label className={labelCls}>Descrição</label>
              <textarea className={inputCls} rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            {documentType === "nota" && (
              <div className="md:col-span-3">
                <label className={labelCls}>PDF ou imagem</label>
                {form.arquivo_pdf_url ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background/70 p-3">
                    {isImageUrl(form.arquivo_pdf_url) ? (
                      <img src={form.arquivo_pdf_url} alt="Pré-visualização" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{getFileNameFromUrl(form.arquivo_pdf_url)}</p>
                      <button type="button" onClick={() => setPdfViewer({ url: form.arquivo_pdf_url, title: getFileNameFromUrl(form.arquivo_pdf_url) })} className="text-left text-xs text-cyan-400 hover:text-cyan-300">Abrir arquivo</button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-xs text-foreground hover:bg-card-secondary">
                        <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Trocar"}
                        <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file); e.target.value = ""; }} />
                      </label>
                      <button type="button" onClick={() => setForm({ ...form, arquivo_pdf_url: "" })} className="rounded-lg border border-red-900/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-900/40">
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground hover:border-cyan-400/50 hover:text-foreground">
                    <Upload className="h-5 w-5" />
                    {uploading ? "Enviando..." : "Clique para enviar PDF ou imagem"}
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeForm} className="border border-border bg-card/70 text-foreground hover:bg-card-secondary rounded-lg px-4 py-2 text-sm">Cancelar</button>
            <button onClick={save} disabled={saving} className="text-slate-950 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "#06b6d4" }}>
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : documentType === "recibo" ? "Criar Recibo" : "Criar Nota"}
            </button>
          </div>
        </div>
      )}

      {/* filtros e ordenação */}
      <div className="rounded-2xl" style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowFilterPanel(!showFilterPanel); setShowSortMenu(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-background/70 ${showFilterPanel ? "border-cyan-400/40 text-cyan-300" : "border-border text-foreground hover:bg-card-secondary"}`}>
              <Filter className="h-3.5 w-3.5" /> Filtros{hasActiveFilters ? " •" : ""}
            </button>
            <div className="relative">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterPanel(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-background/70 ${showSortMenu ? "border-cyan-400/40 text-cyan-300" : "border-border text-foreground hover:bg-card-secondary"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ordenar
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-card shadow-xl py-1">
                    {([
                      { by: "data" as const, dir: "desc" as const, label: "Data — Mais recente" },
                      { by: "data" as const, dir: "asc" as const, label: "Data — Mais antiga" },
                      { by: "nome" as const, dir: "asc" as const, label: "Cliente — A a Z" },
                      { by: "nome" as const, dir: "desc" as const, label: "Cliente — Z a A" },
                    ]).map((opt) => {
                      const active = sortBy === opt.by && sortDir === opt.dir;
                      return (
                        <button
                          key={`${opt.by}-${opt.dir}`}
                          onClick={() => { setSortBy(opt.by); setSortDir(opt.dir); setShowSortMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-xs ${active ? "text-cyan-300 bg-cyan-500/10" : "text-foreground hover:bg-card-secondary"}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">{filteredNotas.length} de {notas.length} nota(s)</span>
        </div>
        {showFilterPanel && (
          <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.4)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Data De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-border bg-card-secondary/60 px-3 py-1.5 text-xs text-foreground outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Data Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-border bg-card-secondary/60 px-3 py-1.5 text-xs text-foreground outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full rounded-lg border border-border bg-card-secondary/60 px-3 py-1.5 text-xs text-foreground outline-none focus:border-cyan-400">
                  <option value="">Todos</option>
                  {STATUS_OPCOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">Limpar filtros</button>
            )}
          </div>
        )}
      </div>

      {/* Navegação hierárquica: cotista → ano → tabela de lançamentos. */}
      {loading ? (
        <div className="rounded-2xl border border-border/70 bg-card/40 px-6 py-14 text-center text-sm text-muted-foreground">Carregando documentos...</div>
      ) : filteredNotas.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card/40 p-12 text-center text-sm text-muted-foreground">
          {hasActiveFilters ? "Nenhum documento encontrado para os filtros aplicados." : "Nenhuma nota fiscal ou recibo cadastrado."}
        </div>
      ) : !clienteSelecionado ? (
        <section className="rounded-2xl border border-border/70 bg-card/35 p-5 shadow-sm md:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Arquivo financeiro</p><h2 className="mt-1 text-xl font-black tracking-tight">Cotistas</h2><p className="mt-1 text-xs text-muted-foreground">Abra uma pasta para consultar os lançamentos por ano.</p></div>
            <span className="rounded-full border border-primary/20 bg-primary/[.07] px-3 py-1.5 text-[10px] font-bold text-primary">{gruposVisiveis.length} cotista(s)</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gruposVisiveis.sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([nome, anos]) => (
              <FolderCard key={nome} name={nome} description="Notas e recibos de saída" count={Object.values(anos).reduce((total, items) => total + items.length, 0)} onClick={() => selecionarCliente(nome)} />
            ))}
          </div>
        </section>
      ) : !anoSelecionado ? (
        <section className="rounded-2xl border border-border/70 bg-card/35 p-5 shadow-sm md:p-7">
          <button type="button" onClick={voltarParaClientes} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar para cotistas</button>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Pasta do cotista</p><h2 className="mt-1 text-2xl font-black tracking-tight">{clienteSelecionado}</h2><p className="mt-1 text-xs text-muted-foreground">Selecione o ano para abrir os lançamentos.</p></div><span className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-bold text-muted-foreground">{Object.values(anosDoCliente).reduce((total, items) => total + items.length, 0)} documento(s)</span></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(anosDoCliente).sort(([a], [b]) => b.localeCompare(a)).map(([ano, itens]) => (
              <FolderCard key={ano} name={ano} description="Lançamentos emitidos neste ano" count={itens.length} onClick={() => selecionarAno(ano)} />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border/70 bg-card/35 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 md:px-7"><div><button type="button" onClick={voltarParaAnos} className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar para anos</button><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Lançamentos do cotista</p><h2 className="mt-1 text-xl font-black">{clienteSelecionado} <span className="text-muted-foreground">/ {anoSelecionado}</span></h2></div><span className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] font-bold text-muted-foreground">{registrosDoAno.length} lançamento(s)</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-xs"><thead><tr className="border-b border-border/70 bg-secondary/30 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Número</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Aeronave</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Nome categoria</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">PDF</th><th className="px-4 py-3 text-center">E-mail</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>
              {registrosDoAno.map((n) => { const status = String(n.status || "").toLowerCase(); const isPendente = ["pendente", "em_aberto", "aberto", "atrasado", "em_atraso"].includes(status); return <tr key={n.id} className="border-b border-border/50 transition-colors hover:bg-primary/[.035]">
                <td className="px-4 py-3 font-mono text-[11px] font-bold text-foreground">{n.numero || "—"}</td><td className="px-4 py-3 font-medium text-muted-foreground">{n.cliente_nome || "—"}</td><td className="px-4 py-3 text-muted-foreground">{n.aeronave || "—"}</td><td className="px-4 py-3 text-muted-foreground">{n.data_criacao ? formatDate(n.data_criacao) : "—"}</td><td className="px-4 py-3 text-muted-foreground">{n.data_vencimento ? formatDate(n.data_vencimento) : "—"}</td><td className="px-4 py-3 text-right font-bold text-foreground">{formatBRL(num(n.valor))}</td><td className="max-w-[190px] truncate px-4 py-3 text-muted-foreground" title={n.categoria || ""}>{n.categoria || "—"}</td><td className="px-4 py-3"><StatusBadge status={n.status} /></td><td className="px-4 py-3 text-center">{n.arquivo_pdf_url ? <button type="button" onClick={() => setPdfViewer({ url: n.arquivo_pdf_url!, title: n.numero || "Documento de saída" })} title="Abrir PDF" className="inline-flex rounded-lg border border-primary/20 bg-primary/[.07] p-2 text-primary hover:bg-primary/15"><FileText className="h-3.5 w-3.5" /></button> : <span className="text-muted-foreground">—</span>}</td><td className="px-4 py-3 text-center"><button type="button" title={emailsEnviados.has(n.id) ? "E-mail enviado" : "Enviar por e-mail"} onClick={() => { setEmailTarget(n); setEmailOpen(true); }} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold ${emailsEnviados.has(n.id) ? "border-emerald-400/25 bg-emerald-400/[.08] text-emerald-500" : "border-primary/25 bg-primary/[.07] text-primary hover:bg-primary/15"}`}><Mail className="h-3.5 w-3.5" /> {emailsEnviados.has(n.id) ? "Enviado" : "Enviar"}</button></td><td className="px-4 py-3"><div className="flex justify-end gap-1.5">{isPendente && n.contas_areceber_id && <button type="button" title="Dar baixa" onClick={() => openBaixa(n)} className="rounded-lg border border-emerald-400/25 bg-emerald-400/[.08] p-2 text-emerald-500 hover:bg-emerald-400/15"><Banknote className="h-3.5 w-3.5" /></button>}{n.origem === "nf_saida" && <button type="button" title="Editar" onClick={() => openEdit(n)} className="rounded-lg border border-border bg-card/70 p-2 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>}<button type="button" title="Excluir" onClick={() => setDeleteId(n.id)} className="rounded-lg border border-red-400/25 bg-red-400/[.06] p-2 text-red-500 hover:bg-red-400/15"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
              </tr>; })}
            </tbody></table>
          </div>
        </section>
      )}

      <ReciboSaidaPreviewModal
        open={!!reciboPreview}
        data={reciboPreview?.pdfData ?? null}
        saving={saving}
        savedUrl={reciboSavedUrl}
        onClose={closeReciboPreview}
        onConfirm={confirmReciboSave}
        onSendEmail={() => {
          if (emailTarget) {
            setEmailOpen(true);
          }
        }}
      />

      {pdfViewer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="truncate text-sm font-bold">{pdfViewer.title}</h3>
              <button type="button" onClick={() => setPdfViewer(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar visualização"><X className="h-4 w-4" /></button>
            </div>
            <iframe src={resolveArquivoUrl(pdfViewer.url)} title={pdfViewer.title} className="min-h-0 flex-1 bg-white" />
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={() => setPdfViewer(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Fechar</button>
              <button type="button" onClick={() => void downloadPdf(pdfViewer.url, pdfViewer.title)} disabled={pdfDownloading} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Download className="h-4 w-4" /> {pdfDownloading ? "Baixando..." : "Baixar PDF"}</button>
            </div>
          </div>
        </div>
      )}

      {emailTarget && (
        <EnviarEmailClienteDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          onSent={() => setEmailsEnviados((atual) => new Set(atual).add(emailTarget.id))}
          assuntoSugerido={`${emailTarget.origem === "recibo_saida" ? "Recibo" : "Nota Fiscal"} de saída ${emailTarget.numero || "sem número"}${emailTarget.cliente_nome ? ` — ${emailTarget.cliente_nome}` : ""}`}
          mensagemSugerida={`Olá${emailTarget.cliente_nome ? ` ${emailTarget.cliente_nome}` : ""},\n\nSegue a documentação referente ao ${emailTarget.origem === "recibo_saida" ? "recibo" : "documento fiscal"} de saída emitido pela Share.\n\nNúmero: ${emailTarget.numero || "—"}\nValor: ${formatBRL(num(emailTarget.valor))}\nData de emissão: ${emailTarget.data_criacao ? formatDate(emailTarget.data_criacao) : "—"}\n\nOs documentos estão disponíveis nos links abaixo.\n\nAtenciosamente,\nEquipe Share Brasil`}
          destinatarioInicial={emailTarget.cliente_email || ""}
          anexos={emailTarget.arquivo_pdf_url ? [{ id: `${emailTarget.origem === "recibo_saida" ? "recibo_saida" : "nf_saida"}:${emailTarget.id}`, url: emailTarget.arquivo_pdf_url, label: emailTarget.origem === "recibo_saida" ? "Recibo de saída" : "Nota fiscal de saída", filename: getFileNameFromUrl(emailTarget.arquivo_pdf_url) }] : []}
        />
      )}

      {/* delete modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center"><Trash2 className="h-5 w-5 text-red-400" /></div>
              <h3 className="text-base font-bold text-foreground">Excluir documento de saída</h3>
            </div>
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este documento de saída? O recibo/nota, o PDF e os lançamentos financeiros vinculados serão removidos.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteId(null)} className="border border-border bg-card/70 text-foreground hover:bg-card-secondary rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#dc2626" }}>
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* dar baixa modal */}
      {baixaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-950/50 flex items-center justify-center"><Banknote className="h-5 w-5 text-emerald-400" /></div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Dar baixa</h3>
                  <p className="text-xs text-muted-foreground">Nota {baixaTarget.numero} · {baixaTarget.cliente_nome} · {formatBRL(num(baixaTarget.valor))}</p>
                </div>
              </div>
              <button onClick={closeBaixa} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Isso marca a receita da Share como recebida e a despesa correspondente do cliente como paga.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Data do Pagamento *</label>
                <input type="date" className={inputCls} value={baixaForm.data_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, data_pagamento: e.target.value })} /></div>
              <div><label className={labelCls}>Forma de Pagamento</label>
                <select className={inputCls + " cursor-pointer"} value={baixaForm.forma_pagamento} onChange={(e) => setBaixaForm({ ...baixaForm, forma_pagamento: e.target.value })}>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                </select></div>
              <div className="sm:col-span-2"><label className={labelCls}>Banco</label>
                <input list="bancos-share-list" className={inputCls} value={baixaForm.conta_bancaria} onChange={(e) => setBaixaForm({ ...baixaForm, conta_bancaria: e.target.value })} placeholder="Ex: Banco do Brasil - Conta 12345-6" />
                <datalist id="bancos-share-list">
                  {contasBancarias.map((b) => (
                    <option key={b.id} value={`${b.banco}${b.numero_conta ? " - " + b.numero_conta : ""}`} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2"><label className={labelCls}>Comprovante</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className={inputCls} value={baixaForm.comprovante_url} onChange={(e) => setBaixaForm({ ...baixaForm, comprovante_url: e.target.value })} placeholder="URL do comprovante" />
                  <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 text-sm text-foreground hover:bg-card-secondary">
                    <Upload className="h-4 w-4" /> {baixaUploading ? "Enviando..." : "Anexar"}
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={baixaUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadComprovante(file); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeBaixa} className="border border-border bg-card/70 text-foreground hover:bg-card-secondary rounded-lg px-4 py-2 text-sm">Cancelar</button>
              <button onClick={confirmBaixa} disabled={baixaSaving} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" style={{ background: "#4ade80" }}>
                {baixaSaving ? "Registrando..." : "Confirmar Baixa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
