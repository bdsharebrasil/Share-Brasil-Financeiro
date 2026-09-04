import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, FileText, History, Loader2, Paperclip, Receipt, RotateCcw } from "lucide-react";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import HistoricoRecibos, { type FiltrosHistoricoRecibos } from "@/components/financeiro-share/HistoricoRecibos";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import {
  buscarOpcoesRecibos,
  buscarRecibos,
  carregarArquivoColaborador,
  cancelarRecibo,
  confirmarReembolsoRecibo,
  criarRecibo,
  enviarAnexoRecibo,
  enviarPdfRecibo,
  type CriarReciboPayload,
  type OpcoesRecibos,
  type Recibo as ReciboFinanceiro,
} from "@/lib/colaborador-api";

type TipoEmissao = "cliente_reembolsavel" | "colaborador" | "pagamento";
type Formulario = {
  tipo: TipoEmissao | null;
  natureza_despesa: "aeronave" | "empresa" | "";
  cliente_id: string;
  colaborador_id: string;
  recebedor_id: string;
  recebedor_nome: string;
  recebedor_cpf: string;
  numero_recibo: string;
  pagador_tipo: "share" | "cotista";
  pagador_cotista_id: string;
  aeronave_id: string;
  rateado: boolean;
  valor: string;
  descricao_servico: string;
  data_emissao: string;
  data_vencimento: string;
  forma_pagamento: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_nome_manual: string;
  numero_documento_anexo: string;
  observacoes: string;
  periodicidade: string;
  tipo_rateio: string;
  subcategoria_1: string;
  subcategoria_2: string;
  subcategoria_3: string;
  subcategoria_4: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial = (): Formulario => ({
  tipo: null,
  natureza_despesa: "",
  cliente_id: "",
  colaborador_id: "",
  recebedor_id: "",
  recebedor_nome: "",
  recebedor_cpf: "",
  numero_recibo: "",
  pagador_tipo: "share",
  pagador_cotista_id: "",
  aeronave_id: "",
  rateado: false,
  valor: "",
  descricao_servico: "",
  data_emissao: hoje(),
  data_vencimento: "",
  forma_pagamento: "",
  categoria_id: "",
  categoria_nome: "",
  categoria_nome_manual: "",
  numero_documento_anexo: "",
  observacoes: "",
  periodicidade: "ÚNICO",
  tipo_rateio: "FIXO",
  subcategoria_1: "",
  subcategoria_2: "",
  subcategoria_3: "",
  subcategoria_4: "",
});

const opcoesTipo: Array<{ id: TipoEmissao; titulo: string; detalhe: string; icon: typeof Receipt; cor: string; fundo: string }> = [
  { id: "cliente_reembolsavel", titulo: "Recibo de reembolso", detalhe: "Despesa antecipada pela Share para um cotista.", icon: RotateCcw, cor: "text-amber-500", fundo: "bg-amber-500/[.06]" },
  { id: "colaborador", titulo: "Recibo colaborador", detalhe: "Despesa da Share vinculada ao colaborador.", icon: Receipt, cor: "text-primary", fundo: "bg-primary/[.06]" },
  { id: "pagamento", titulo: "Recibo de pagamento", detalhe: "Lançamento simples, sem vínculo com cotista ou colaborador.", icon: FileText, cor: "text-sky-500", fundo: "bg-sky-500/[.06]" },
];
const CATEGORIA_OUTRO_ID = "111124d9-6111-4e11-a1f7-c7477e0fdb89";
const CATEGORIAS_EMPRESA = new Set([
  "88980acf-465f-4a16-8111-d8efaf28365b", "482a2993-28e9-417e-98f5-d00d03ada423",
  "28a599f4-d8de-4969-98aa-58452d49c92e", "0293e29f-526e-4be0-af2e-0e10e73e8a8f",
  "a4d8ed56-9bb2-47e1-93fa-2b786ff280b7", "09defc15-dced-408d-a975-092928374907",
  "82e24a46-a773-4b6e-b2ae-bfd41c04bc5d", CATEGORIA_OUTRO_ID,
]);

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function valorNumerico(valor: string) {
  const limpo = valor.trim();
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo) || 0;
}

function caminhoPdfRecibo(recibo: ReciboFinanceiro) {
  if (recibo.pdf_anexo_id) return `/api/financeiro/recibos/anexos/${encodeURIComponent(recibo.pdf_anexo_id)}/arquivo`;
  if (!recibo.pdf_url) return "";
  try {
    const url = new URL(recibo.pdf_url, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return recibo.pdf_url;
  }
}

async function gerarPdfRecibo(recibo: ReciboFinanceiro, colaborador?: OpcoesRecibos["colaboradores"][number]) {
  const ehPagamento = recibo.tipo_recibo === "pagamento" || recibo.beneficiario_tipo === "colaborador" || recibo.beneficiario_tipo === "freelancer";
  const nomeRecebedor = colaborador?.nome_completo || recibo.recebedor_nome || "";
  const documentoRecebedor = colaborador?.cpf || recibo.recebedor_cpf || "";
  const blob = await gerarReciboPdf({
    numero: recibo.numero_recibo,
    valor: Number(recibo.valor || 0),
    descricao: [recibo.descricao_servico, recibo.observacoes].filter(Boolean).join("\n\n"),
    data: recibo.data_emissao,
    rotuloPagador: ehPagamento ? "RECEBEDOR" : "PAGADOR",
    pagadorNome: ehPagamento ? nomeRecebedor || "—" : recibo.nome_pagador || "—",
    pagadorDocumento: ehPagamento
      ? documentoRecebedor ? `CPF: ${documentoRecebedor}` : null
      : recibo.documento_pagador ? `CNPJ/CPF: ${recibo.documento_pagador}` : null,
    pagadorLinhas: ehPagamento ? [] : [recibo.endereco_pagador, [recibo.cidade_pagador, recibo.uf_pagador].filter(Boolean).join(" - ")],
  });
  return new File([blob], `${recibo.numero_recibo.replace(/[^a-z0-9-]/gi, "-")}.pdf`, { type: "application/pdf" });
}

export default function EmissaoRecibo({ aoVoltar }: { aoVoltar: () => void }) {
  const [form, setForm] = useState<Formulario>(inicial);
  const [opcoes, setOpcoes] = useState<OpcoesRecibos>({ clientes: [], colaboradores: [], aeronaves: [], cotistas: [], categorias: [], categorias_cliente: [], recebedores: [] });
  const [recibos, setRecibos] = useState<ReciboFinanceiro[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"emissao" | "historico">("emissao");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [previewAberta, setPreviewAberta] = useState(false);
  const [rateioPercentuais, setRateioPercentuais] = useState<Record<string, string>>({});
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPreviewNumero, setPdfPreviewNumero] = useState("");
  const [pdfAbrindoId, setPdfAbrindoId] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [dadosOpcoes, dadosRecibos] = await Promise.all([buscarOpcoesRecibos(), buscarRecibos()]);
      setOpcoes({
        ...dadosOpcoes,
        aeronaves: Array.isArray(dadosOpcoes.aeronaves) ? dadosOpcoes.aeronaves : [],
        recebedores: Array.isArray(dadosOpcoes.recebedores) ? dadosOpcoes.recebedores : [],
      });
      setRecibos(dadosRecibos.recibos);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível carregar os dados de emissão.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const buscarHistorico = async (filtros: FiltrosHistoricoRecibos) => {
    setCarregando(true);
    setErro("");
    try {
      const dados = await buscarRecibos(filtros);
      setRecibos(dados.recibos);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível buscar os recibos.");
    } finally {
      setCarregando(false);
    }
  };

  const cotistas = useMemo(() => form.aeronave_id ? opcoes.cotistas.filter((item) => item.aeronave_id === form.aeronave_id) : [], [form.aeronave_id, opcoes.cotistas]);
  const totalRateio = cotistas.reduce((total, item) => total + Number(item.percentual_sociedade || 0), 0);
  const rateioPagamentoAtivo = form.tipo === "pagamento" && form.pagador_tipo === "cotista" && form.rateado;
  const totalPercentualRateio = rateioPagamentoAtivo ? cotistas.reduce((total, item) => total + (Number(rateioPercentuais[item.id] || 0) || 0), 0) : totalRateio;
  const rateioLinhasPagamento = rateioPagamentoAtivo ? cotistas.map((item) => ({ cotista_id: item.id, percentual: Number(rateioPercentuais[item.id] || 0) })).filter((item) => item.percentual > 0) : [];
  const tipoSelecionado = opcoesTipo.find((item) => item.id === form.tipo);
  const pagadorSelecionado = opcoes.cotistas.find((item) => item.id === form.pagador_cotista_id);
  const categoriaClienteSelecionada = opcoes.categorias_cliente.find((item) => item.id === form.categoria_id);
  const colaboradorSelecionado = opcoes.colaboradores.find((item) => item.id === form.colaborador_id);
  const recebedorItems = useMemo(() => opcoes.recebedores.map((recebedor) => ({
    id: recebedor.id,
    label: [recebedor.nome, recebedor.cpf && `CPF: ${recebedor.cpf}`, recebedor.email, recebedor.telefone, recebedor.canac && `CANAC: ${recebedor.canac}`, recebedor.origem === "tripulacao_freelancer" ? "Freelancer" : "Colaborador"].filter(Boolean).join(" · "),
  })), [opcoes.recebedores]);
  const mostrarMetadadosPagamento = form.tipo === "pagamento" && form.pagador_tipo === "cotista";
  const subcategoriasDisponiveis = categoriaClienteSelecionada ? [categoriaClienteSelecionada.subcategoria_1, categoriaClienteSelecionada.subcategoria_2, categoriaClienteSelecionada.subcategoria_3, categoriaClienteSelecionada.subcategoria_4].flatMap((valor) => String(valor || "").split(",")).map((valor) => valor.trim()).filter(Boolean).filter((valor, indice, lista) => lista.indexOf(valor) === indice) : [];
  const arquivoPreviewUrl = useMemo(() => arquivo ? URL.createObjectURL(arquivo) : "", [arquivo]);

  useEffect(() => () => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
  }, [pdfPreviewUrl]);

  useEffect(() => () => {
    if (arquivoPreviewUrl) URL.revokeObjectURL(arquivoPreviewUrl);
  }, [arquivoPreviewUrl]);

  const alterar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const selecionarTipo = (tipo: TipoEmissao) => {
    setErro("");
    setMensagem("");
    const proximo = tipo === form.tipo ? null : tipo;
    setForm({ ...inicial(), tipo: proximo });
    setRateioPercentuais({});
    setArquivo(null);
  };

  const selecionaCategoria = (id: string, nome: string) => {
    alterar("categoria_id", id);
    alterar("categoria_nome", nome);
  };

  const categoriaValida = form.tipo !== "colaborador" || Boolean(
    form.natureza_despesa && form.categoria_id &&
    (form.natureza_despesa === "aeronave" ? form.aeronave_id : CATEGORIAS_EMPRESA.has(form.categoria_id)) &&
    (form.categoria_id !== CATEGORIA_OUTRO_ID || form.categoria_nome_manual.trim()),
  );
  const podeEmitir = Boolean(
    form.tipo && form.descricao_servico.trim() && valorNumerico(form.valor) > 0 && categoriaValida &&
    (form.tipo === "colaborador" ? form.colaborador_id : form.tipo === "pagamento" ? form.recebedor_nome.trim() && form.categoria_id && (form.pagador_tipo === "share" || form.pagador_cotista_id) && (!rateioPagamentoAtivo || (form.aeronave_id && rateioLinhasPagamento.length > 0 && Math.abs(totalPercentualRateio - 100) < 0.01)) : (form.rateado ? form.aeronave_id : form.cliente_id)),
  );

  const fecharPdfPreview = () => {
    setPdfPreviewUrl((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return "";
    });
    setPdfPreviewNumero("");
  };

  const visualizarPdf = async (recibo: ReciboFinanceiro) => {
    let caminho = caminhoPdfRecibo(recibo);
    setErro("");
    setPdfAbrindoId(recibo.id);
    try {
      if (!caminho) {
        const colaborador = opcoes.colaboradores.find((item) => item.id === recibo.colaborador_id);
        const pdf = await gerarPdfRecibo(recibo, colaborador);
        const salvo = await enviarPdfRecibo(recibo.id, pdf);
        caminho = `/api/financeiro/recibos/anexos/${encodeURIComponent(salvo.anexo_id)}/arquivo`;
        setRecibos((atual) => atual.map((item) => item.id === recibo.id ? { ...item, pdf_anexo_id: salvo.anexo_id, pdf_url: salvo.pdf_url } : item));
      }
      const blob = await carregarArquivoColaborador(caminho);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
      setPdfPreviewNumero(recibo.numero_recibo);
    } catch (cause) {
      setErro(cause instanceof Error ? `Não foi possível abrir o PDF: ${cause.message}` : "Não foi possível abrir o PDF.");
    } finally {
      setPdfAbrindoId(null);
    }
  };


  const abrirPreview = () => {
    if (!podeEmitir || !form.tipo) {
      setErro("Preencha os campos obrigatórios antes de visualizar o recibo.");
      return;
    }
    setErro("");
    setPreviewAberta(true);
  };

  const emitir = async () => {
    if (!podeEmitir || !form.tipo) {
      setErro("Preencha os campos obrigatórios antes de emitir o recibo.");
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const payload: CriarReciboPayload = {
        tipo_recibo: form.tipo,
        beneficiario_tipo: form.tipo === "colaborador" ? "colaborador" : form.tipo === "pagamento" ? (form.recebedor_id.startsWith("freelancer:") ? "freelancer" : "fornecedor") : "cliente",
        numero_recibo: form.numero_recibo.trim() || null,
        reembolsavel: form.tipo === "cliente_reembolsavel",
        rateado: (form.tipo === "cliente_reembolsavel" || form.tipo === "pagamento") && form.rateado,
        aeronave_id: form.rateado ? form.aeronave_id || null : form.tipo === "pagamento" ? null : form.aeronave_id || null,
        cliente_id: form.tipo === "cliente_reembolsavel" ? form.cliente_id || null : null,
        colaborador_id: form.tipo === "colaborador" ? form.colaborador_id : null,
        recebedor_id: form.tipo === "pagamento" ? form.recebedor_id || null : null,
        recebedor_nome: form.tipo === "pagamento" ? form.recebedor_nome.trim() : null,
        recebedor_cpf: form.tipo === "pagamento" ? form.recebedor_cpf.trim() || null : null,
        pagador_tipo: form.tipo === "pagamento" ? form.pagador_tipo : "share",
        pagador_cotista_id: form.tipo === "pagamento" && form.pagador_tipo === "cotista" ? form.pagador_cotista_id : null,
        valor: valorNumerico(form.valor),
        descricao_servico: form.descricao_servico.trim(),
        data_emissao: form.data_emissao,
        data_vencimento: form.tipo === "pagamento" ? null : form.data_vencimento || null,
        forma_pagamento: form.tipo === "pagamento" ? form.forma_pagamento || null : null,
        categoria_movimentacao_id: form.tipo === "colaborador" || form.tipo === "pagamento" ? form.categoria_id : null,
        categoria_nome_manual: form.tipo === "colaborador" ? form.categoria_nome_manual.trim() || null : null,
        natureza_despesa: form.tipo === "colaborador" ? form.natureza_despesa : null,
        grupo_categoria: form.tipo === "colaborador" ? (form.natureza_despesa === "aeronave" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA") : null,
        anexo_id: null,
        numero_documento_anexo: arquivo ? form.numero_documento_anexo.trim() || null : null,
        observacoes: form.observacoes.trim() || null,
        periodicidade: mostrarMetadadosPagamento ? form.periodicidade || null : null,
        tipo_rateio: mostrarMetadadosPagamento ? form.tipo_rateio || null : null,
        subcategoria_1: mostrarMetadadosPagamento ? form.subcategoria_1 || null : null,
        subcategoria_2: mostrarMetadadosPagamento ? form.subcategoria_2 || null : null,
        subcategoria_3: mostrarMetadadosPagamento ? form.subcategoria_3 || null : null,
        subcategoria_4: mostrarMetadadosPagamento ? form.subcategoria_4 || null : null,
        rateio_linhas: rateioPagamentoAtivo ? rateioLinhasPagamento : undefined,
      };
      const resposta = await criarRecibo(payload);
      setForm(inicial());
      setArquivo(null);
      setPreviewAberta(false);
      let avisoAnexo = "";
      if (arquivo) {
        try {
          const anexo = await enviarAnexoRecibo(arquivo, resposta.recibo.id);
          resposta.recibo.anexo_id = anexo.id;
        } catch (anexoError) {
          avisoAnexo = ` O recibo foi criado, mas o anexo não pôde ser salvo${anexoError instanceof Error ? `: ${anexoError.message}` : "."}`;
        }
      }
      let avisoPdf = "";
      try {
        const pdf = await gerarPdfRecibo(resposta.recibo, colaboradorSelecionado);
        const pdfSalvo = await enviarPdfRecibo(resposta.recibo.id, pdf);
        resposta.recibo.pdf_url = pdfSalvo.pdf_url;
        resposta.recibo.pdf_anexo_id = pdfSalvo.anexo_id;
      } catch (pdfError) {
        avisoPdf = ` O recibo foi criado, mas o PDF não pôde ser salvo${pdfError instanceof Error ? `: ${pdfError.message}` : "."}`;
      }
      setRecibos((atual) => [resposta.recibo, ...atual]);
      setMensagem(`Recibo ${resposta.recibo.numero_recibo} emitido com sucesso${resposta.rateio_ids.length ? ` e ${resposta.rateio_ids.length} rateio(s) gerado(s)` : ""}.${avisoAnexo}${avisoPdf}`);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível emitir o recibo.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReembolso = async (id: string) => {
    setErro("");
    try {
      await confirmarReembolsoRecibo(id);
      setRecibos((atual) => atual.map((item) => item.id === id ? { ...item, status: "reembolsado" } : item));
      setMensagem("Reembolso confirmado e entrada criada no caixa Share.");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível confirmar o reembolso.");
    }
  };

  const cancelar = async (id: string) => {
    setErro("");
    try {
      await cancelarRecibo(id);
      setRecibos((atual) => atual.map((item) => item.id === id ? { ...item, status: "cancelado" } : item));
      setMensagem("Recibo cancelado corretamente.");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível cancelar o recibo.");
    }
  };

  return (
    <div className="route-enter mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <IndicadorPagina>Financeiro / Emissão de recibo</IndicadorPagina>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-.04em] md:text-2xl"><Receipt className="text-primary" size={22} /> Emissão de recibo</h1>
          <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">Emita novos documentos ou consulte o arquivo mensal de recibos já emitidos.</p>
        </div>
        <Button type="button" variant="outline" onClick={aoVoltar} className="h-9 gap-2 rounded-sm text-[11px]"><ArrowLeft size={14} /> Voltar ao financeiro</Button>
      </header>

      <nav aria-label="Seção de recibos" className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
        <button type="button" onClick={() => setAbaAtiva("emissao")} aria-current={abaAtiva === "emissao" ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${abaAtiva === "emissao" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><Receipt size={14} /> Emitir recibo</button>
        <button type="button" onClick={() => setAbaAtiva("historico")} aria-current={abaAtiva === "historico" ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${abaAtiva === "historico" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><History size={14} /> Histórico de recibos</button>
      </nav>

      {abaAtiva === "emissao" && <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
        <div className="border-b border-border bg-secondary/20 px-5 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em]">Tipo de emissão <sup className="text-primary">*</sup></p>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {opcoesTipo.map((opcao) => {
            const ativo = form.tipo === opcao.id;
            const Icon = opcao.icon;
            return <button key={opcao.id} type="button" onClick={() => selecionarTipo(opcao.id)} aria-pressed={ativo} className={`group flex min-h-[116px] items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${ativo ? `border-primary/60 ${opcao.fundo} shadow-md` : "border-border bg-secondary/[.12] hover:border-primary/35"}`}><span className={`mt-0.5 grid h-5 w-5 place-content-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}>{ativo && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold">{opcao.titulo}</span><span className="mt-1 block text-[10px] leading-5 text-muted-foreground">{opcao.detalhe}</span></span><Icon className={ativo ? opcao.cor : "text-muted-foreground/60"} size={18} /></button>;
          })}
        </div>

        {form.tipo && <div className="border-t border-border px-5 py-5">
          <div className="mb-5 flex items-center gap-2 rounded-sm border border-primary/25 bg-primary/[.06] px-3.5 py-2.5 text-[11px]"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><strong>{tipoSelecionado?.titulo}</strong></div>
          <div className="grid gap-4 md:grid-cols-2">
            {form.tipo === "pagamento" ? <><Campo label="RECEBEDOR" obrigatorio><SearchableCombobox items={recebedorItems} value={form.recebedor_id} onChange={(id, label) => { const recebedor = opcoes.recebedores.find((item) => item.id === id); alterar("recebedor_id", id); alterar("recebedor_nome", recebedor?.nome || label); alterar("recebedor_cpf", recebedor?.cpf || ""); }} placeholder="Selecione o recebedor" searchPlaceholder="Buscar por nome, CPF, e-mail..." emptyMessage="Nenhum recebedor encontrado." allowFreeText /></Campo><Campo label="CPF do recebedor"><input value={form.recebedor_cpf} onChange={(e) => alterar("recebedor_cpf", e.target.value)} placeholder="000.000.000-00" inputMode="numeric" className="campo" /></Campo></> : form.tipo !== "colaborador" ? <Campo label="Cliente" obrigatorio><select value={form.cliente_id} onChange={(e) => alterar("cliente_id", e.target.value)} className="campo"><option value="">Selecione o cliente</option>{opcoes.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.razao_social}</option>)}</select></Campo> : <Campo label="RECEBEDOR" obrigatorio><select value={form.colaborador_id} onChange={(e) => alterar("colaborador_id", e.target.value)} className="campo"><option value="">Selecione o colaborador</option>{opcoes.colaboradores.map((colaborador) => <option key={colaborador.id} value={colaborador.id}>{colaborador.nome_exibicao || colaborador.nome_completo}</option>)}</select></Campo>}
            <Campo label="Data" obrigatorio><input type="date" value={form.data_emissao} onChange={(e) => alterar("data_emissao", e.target.value)} className="campo" /></Campo>
            <Campo label="Código do recibo"><input value={form.numero_recibo} onChange={(e) => alterar("numero_recibo", e.target.value)} placeholder="Gerado automaticamente se ficar em branco" className="campo font-mono" /></Campo>
            {form.tipo === "pagamento" && <><Campo label="Pagador" obrigatorio><SearchableCombobox items={[{ id: "share", label: "Share Brasil" }, ...opcoes.cotistas.map((cotista) => ({ id: cotista.id, label: `${cotista.nome}${cotista.codigo_cliente ? ` · ${cotista.codigo_cliente}` : ""}` }))]} value={form.pagador_tipo === "share" ? "share" : form.pagador_cotista_id} onChange={(id) => { if (id === "share") { alterar("pagador_tipo", "share"); alterar("pagador_cotista_id", ""); } else { const cotista = opcoes.cotistas.find((item) => item.id === id); alterar("pagador_tipo", "cotista"); alterar("pagador_cotista_id", id); alterar("categoria_id", ""); if (cotista) alterar("recebedor_nome", form.recebedor_nome); } }} placeholder="Selecione o pagador" searchPlaceholder="Buscar cotista..." emptyMessage="Nenhum cotista encontrado." /></Campo><div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">DADOS DO PAGADOR</p><p className="mt-1 text-[11px] font-semibold">{form.pagador_tipo === "cotista" ? `${pagadorSelecionado?.nome || "Cotista"} · ${pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "Documento não informado"}` : "Share Brasil"}</p></div></>}
            <Campo label={form.tipo === "pagamento" ? "Descrição" : "Descrição do serviço"} obrigatorio className="md:col-span-2"><input value={form.descricao_servico} onChange={(e) => alterar("descricao_servico", e.target.value)} placeholder={form.tipo === "pagamento" ? "Descrição do pagamento" : "Ex.: Reembolso de despesas operacionais"} className="campo" /></Campo>
            <Campo label="Valor" obrigatorio><input inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>
            {form.tipo !== "pagamento" && <Campo label="Vencimento"><input type="date" value={form.data_vencimento} onChange={(e) => alterar("data_vencimento", e.target.value)} className="campo" /></Campo>}
            {form.tipo === "pagamento" && <Campo label="Forma de pagamento" obrigatorio><select value={form.forma_pagamento} onChange={(e) => alterar("forma_pagamento", e.target.value)} className="campo"><option value="">Selecione</option><option>PIX</option><option>Transferência bancária</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option></select></Campo>}
            {form.tipo === "pagamento" && mostrarMetadadosPagamento && <><Campo label="Periodicidade" obrigatorio><SearchableCombobox items={["ÚNICO", "EVENTUAL", "MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].map((item) => ({ id: item, label: item }))} value={form.periodicidade} onChange={(id) => alterar("periodicidade", id)} placeholder="Selecione a periodicidade" searchPlaceholder="Buscar periodicidade..." emptyMessage="Nenhuma periodicidade encontrada." /></Campo><Campo label="Tipo de rateio" obrigatorio><SearchableCombobox items={["FIXO", "VARIAVEL POR VOO", "VARIAVEL POR HORA", "EXTRA"].map((item) => ({ id: item, label: item }))} value={form.tipo_rateio} onChange={(id) => alterar("tipo_rateio", id)} placeholder="Buscar tipo..." emptyMessage="Nenhum tipo encontrado." /></Campo><Campo label="Grupo categoria" obrigatorio><SearchableCombobox items={opcoes.categorias_cliente.map((item) => ({ id: item.id, label: item.nome }))} value={form.categoria_id} onChange={(id) => { const categoria = opcoes.categorias_cliente.find((item) => item.id === id); alterar("categoria_id", id); alterar("categoria_nome", categoria?.nome || ""); alterar("subcategoria_1", ""); alterar("subcategoria_2", ""); alterar("subcategoria_3", ""); alterar("subcategoria_4", ""); }} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria cadastrada." /></Campo>{subcategoriasDisponiveis.length > 0 && <Campo label="Subcategoria"><SearchableCombobox items={subcategoriasDisponiveis.map((item) => ({ id: item, label: item }))} value={form.subcategoria_1} onChange={(id) => alterar("subcategoria_1", id)} placeholder="Selecione a subcategoria" searchPlaceholder="Buscar subcategoria..." emptyMessage="Nenhuma subcategoria encontrada." /></Campo>}</>}
            {form.tipo === "pagamento" && form.pagador_tipo === "cotista" && <div className="md:col-span-2 rounded-xl border border-primary/25 bg-primary/[.05] p-4">
              <div className="flex items-start gap-3"><Checkbox checked={form.rateado} onCheckedChange={(checked) => { const ativo = checked === true; alterar("rateado", ativo); if (!ativo) { alterar("aeronave_id", ""); setRateioPercentuais({}); } }} /><span><span className="block text-[11px] font-bold">Ratear entre os cotistas da aeronave?</span><span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">Selecione uma aeronave e informe a porcentagem de cada cotista. O total precisa fechar em 100%.</span></span></div>
              {form.rateado && <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2"><Campo label="Aeronave" obrigatorio><select value={form.aeronave_id} onChange={(event) => { const id = event.target.value; alterar("aeronave_id", id); setRateioPercentuais(Object.fromEntries(opcoes.cotistas.filter((item) => item.aeronave_id === id).map((item) => [item.id, String(item.percentual_sociedade || "")] ))); }} className="campo"><option value="">Selecione a aeronave</option>{opcoes.aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}{aeronave.modelo ? " · " + aeronave.modelo : ""}</option>)}</select></Campo><div className="rounded-xl border border-border bg-background/30 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Cotistas e percentuais</p>{cotistas.length ? <div className="mt-2 space-y-2">{cotistas.map((cotista) => <label key={cotista.id} className="flex items-center justify-between gap-3 text-[11px]"><span className="min-w-0 truncate">{cotista.nome}</span><span className="flex items-center gap-1"><input inputMode="decimal" value={rateioPercentuais[cotista.id] ?? ""} onChange={(event) => setRateioPercentuais((atual) => ({ ...atual, [cotista.id]: event.target.value }))} className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-right font-mono text-[11px] outline-none focus:border-primary" /><span className="text-[10px] text-muted-foreground">%</span></span></label>)}</div> : <p className="mt-2 text-[10px] text-amber-500">Selecione uma aeronave para carregar os cotistas.</p>}<p className={`mt-3 border-t border-border pt-2 text-[10px] ${Math.abs(totalPercentualRateio - 100) < 0.01 ? "text-emerald-500" : "text-amber-500"}`}>Total informado: {totalPercentualRateio}%</p></div></div>}
            </div>}
            {form.tipo === "colaborador" && <>
              <Campo label="Tipo de despesa" obrigatorio><select value={form.natureza_despesa} onChange={(e) => { const natureza = e.target.value as Formulario["natureza_despesa"]; alterar("natureza_despesa", natureza); alterar("categoria_id", ""); alterar("categoria_nome", ""); alterar("categoria_nome_manual", ""); alterar("aeronave_id", ""); }} className="campo"><option value="">Selecione o tipo</option><option value="aeronave">Despesa aeronave</option><option value="empresa">Despesa empresa</option></select></Campo>
              {form.natureza_despesa === "aeronave" && <><Campo label="Categoria" obrigatorio><SearchableCombobox items={opcoes.categorias.filter((item) => item.grupo_categoria.toUpperCase() === "DESPESAS REEMBOLSÁVEIS").map((item) => ({ id: item.id, label: item.nome }))} value={form.categoria_id} onChange={selecionaCategoria} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma despesa reembolsável encontrada." /></Campo><Campo label="Aeronave" obrigatorio><SearchableCombobox items={opcoes.aeronaves.map((aeronave) => ({ id: aeronave.id, label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}` }))} value={form.aeronave_id} onChange={(id) => alterar("aeronave_id", id)} placeholder="Selecione a aeronave" searchPlaceholder="Buscar aeronave..." emptyMessage="Nenhuma aeronave encontrada." /></Campo></>}
              {form.natureza_despesa === "empresa" && <Campo label="Categoria" obrigatorio><SearchableCombobox items={opcoes.categorias.filter((item) => CATEGORIAS_EMPRESA.has(item.id)).map((item) => ({ id: item.id, label: item.nome }))} value={form.categoria_id} onChange={selecionaCategoria} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." emptyMessage="Nenhuma categoria disponível." /></Campo>}
              {form.natureza_despesa === "empresa" && form.categoria_id === CATEGORIA_OUTRO_ID && <Campo label="Descrição da categoria" obrigatorio className="md:col-span-2"><input value={form.categoria_nome_manual} onChange={(e) => alterar("categoria_nome_manual", e.target.value)} placeholder="Informe a despesa" className="campo" /></Campo>}
            </>}
            <div className="md:col-span-2"><Campo label="Anexo (opcional)"><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="campo file:mr-3 file:rounded-sm file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-primary" /></Campo>{arquivo && <div className="mt-2 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-secondary/[.12] p-3 text-[11px]"><Paperclip size={14} className="text-primary" /><span className="max-w-[260px] truncate font-medium">{arquivo.name}</span><a href={arquivoPreviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><ExternalLink size={13} /> Visualizar</a><Button type="button" variant="ghost" onClick={() => { setArquivo(null); alterar("numero_documento_anexo", ""); }} className="ml-auto h-7 px-2 text-[10px]">Remover</Button></div>}{arquivo && <div className="mt-3 max-w-sm"><Campo label="Número do documento do anexo"><input value={form.numero_documento_anexo} onChange={(e) => alterar("numero_documento_anexo", e.target.value)} placeholder="Ex.: NF 12345, boleto 987..." className="campo" /></Campo></div>}</div>
            <Campo label="Observações" className="md:col-span-2"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} className="campo min-h-20 resize-y" placeholder="Informações complementares do recibo" /></Campo>
          </div>

          {form.tipo !== "colaborador" && form.tipo !== "pagamento" && <div className="mt-5 rounded-sm border border-border bg-secondary/[.12] p-4">
            <label className="flex cursor-pointer items-start gap-3"><Checkbox checked={form.rateado} onCheckedChange={(checked) => alterar("rateado", checked === true)} /><span><span className="block text-[11px] font-bold">Ratear entre cotistas da aeronave</span><span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">Cria as linhas de rateio usando os percentuais cadastrados para a aeronave.</span></span></label>
            {form.rateado && <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2"><Campo label="Aeronave" obrigatorio><select value={form.aeronave_id} onChange={(e) => alterar("aeronave_id", e.target.value)} className="campo"><option value="">Selecione a aeronave</option>{opcoes.aeronaves.map((aeronave) => <option key={aeronave.id} value={aeronave.id}>{aeronave.matricula_registro}{aeronave.modelo ? ` · ${aeronave.modelo}` : ""}</option>)}</select></Campo><div className="rounded-sm border border-border bg-background/30 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Prévia do rateio</p>{form.aeronave_id ? cotistas.length ? <><div className="mt-2 space-y-1.5">{cotistas.map((cotista) => <p key={cotista.id} className="flex justify-between gap-3 text-[11px]"><span className="truncate">{cotista.nome}</span><strong className="font-mono">{cotista.percentual_sociedade}%</strong></p>)}</div><p className={`mt-2 border-t border-border pt-2 text-[10px] ${totalRateio === 100 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>Total cadastrado: {totalRateio}%</p></> : <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">Não há cotistas cadastrados para esta aeronave.</p> : <p className="mt-2 text-[10px] text-muted-foreground">Selecione uma aeronave para consultar os cotistas.</p>}</div></div>}
          </div>}

          {erro && <div role="alert" className="mt-5 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-5 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4"><Button type="button" onClick={abrirPreview} disabled={salvando || !podeEmitir} className="h-9 gap-2 rounded-sm px-5 text-[11px]"><FileText size={14} /> Pré-visualizar recibo</Button></div>
        </div>}
      </section>}

      {abaAtiva === "emissao" && previewAberta && form.tipo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-sm bg-white p-6 text-slate-800 shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"><img src={logoShare} alt="Share Brasil" className="h-20 w-40 object-contain object-center p-1" /><div className="text-center"><h2 className="text-2xl font-black tracking-wide underline">RECIBO</h2><p className="mt-1 text-[10px] text-slate-500">Pré-visualização antes da finalização</p></div><div className="text-right"><p className="text-[10px] font-bold">Número do recibo</p><p className="font-mono text-[11px] font-bold text-slate-500">{form.numero_recibo.trim() || "Será gerado ao finalizar"}</p><p className="mt-2 border-2 border-slate-800 px-4 py-2 text-lg font-black">{moeda(valorNumerico(form.valor))}</p></div></div><div className="grid gap-6 border-b border-slate-300 py-6 text-xs md:grid-cols-2">{form.tipo === "pagamento" && form.pagador_tipo === "cotista" ? <><div><p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Recebedor</p><strong>{form.recebedor_nome || "Recebedor não informado"}</strong><p>CPF: {form.recebedor_cpf || "Não informado"}</p></div><div><p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Pagador</p><strong>{pagadorSelecionado?.nome || "Cotista"}</strong><p>{pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "Documento não informado"}</p><p>{pagadorSelecionado?.endereco || "Endereço não informado"}</p><p>{[pagadorSelecionado?.cidade, pagadorSelecionado?.uf].filter(Boolean).join(" - ")}</p></div></> : <><div><p className="mb-1 text-[9px] font-bold uppercase text-slate-500">{form.tipo === "colaborador" ? "Pagador" : "Emissor"}</p><strong>SHARE BRASIL SERVIÇOS AERONÁUTICOS</strong><p>CNPJ: 30.898.549/0001-06</p><p>Av. Presidente Arthur Bernardes, 1457</p><p>Várzea Grande - 78125-100</p></div><div><p className="mb-1 text-[9px] font-bold uppercase text-slate-500">{form.tipo === "colaborador" ? "Recebedor" : form.tipo === "pagamento" ? "Recebedor" : "Pagador"}</p><strong>{form.tipo === "colaborador" ? (colaboradorSelecionado?.nome_completo || "Colaborador") : form.tipo === "pagamento" ? (form.recebedor_nome || "Recebedor") : (pagadorSelecionado?.nome || "SHARE BRASIL")}</strong><p>{form.tipo === "colaborador" ? `CPF: ${colaboradorSelecionado?.cpf || "não informado"}` : form.tipo === "pagamento" ? "" : (pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "CNPJ: 30.898.549/0001-06")}</p><p>{form.tipo === "colaborador" ? "" : form.tipo === "pagamento" ? "" : (pagadorSelecionado?.endereco || "Av. Presidente Arthur Bernardes, 1457")}</p><p>{form.tipo === "colaborador" || form.tipo === "pagamento" ? "" : ([pagadorSelecionado?.cidade, pagadorSelecionado?.uf].filter(Boolean).join(" - ") || "Várzea Grande - MT")}</p></div></>}</div>{(() => { const temDoc = Boolean(form.numero_documento_anexo); const cols = temDoc ? "grid-cols-[1fr_130px_100px]" : "grid-cols-[1fr_100px]"; return <div className="overflow-hidden border border-slate-300 text-xs"><div className={`grid ${cols} bg-slate-200 p-2 font-bold`}><span>Descrição do Serviço</span>{temDoc && <span>Nº Documento</span>}<span>Valor</span></div><div className={`grid ${cols} p-3`}><span>{form.descricao_servico}</span>{temDoc && <span>{form.numero_documento_anexo}</span>}<strong>{moeda(valorNumerico(form.valor))}</strong></div></div>; })()}<>{form.tipo !== "pagamento" && form.tipo !== "colaborador" && <div className="mt-5 border border-slate-200 p-3 text-xs"><p className="mb-2 text-[9px] font-bold uppercase text-slate-500">Dados do recibo</p><p>Categoria: {categoriaClienteSelecionada?.nome || form.categoria_nome || "—"}</p>{form.tipo !== "colaborador" && mostrarMetadadosPagamento && <><p>Periodicidade: {form.periodicidade} · Tipo de rateio: {form.tipo_rateio}</p>{[form.subcategoria_1, form.subcategoria_2, form.subcategoria_3, form.subcategoria_4].filter(Boolean).length > 0 && <p>{[form.subcategoria_1, form.subcategoria_2, form.subcategoria_3, form.subcategoria_4].filter(Boolean).join(" · ")}</p>}</>}</div>}</><>{form.observacoes && <div className="mt-5 border border-slate-200 p-3 text-xs"><p className="mb-2 text-[9px] font-bold uppercase text-slate-500">Observações</p><p className="whitespace-pre-wrap">{form.observacoes}</p></div>}<div className="mt-5 border-t border-slate-200 pt-4 text-center"><img src={assinaturaRecibo} alt="Assinatura" className="mx-auto h-12 w-auto" /><p className="text-xs font-semibold">Rolffe de Lima Erbe</p><p className="text-[10px] text-slate-500">Gestor Responsável</p></div></><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPreviewAberta(false)} className="h-9 text-xs">Voltar e editar</Button><Button type="button" onClick={emitir} disabled={salvando} className="h-9 text-xs">{salvando ? "Salvando..." : "Confirmar e finalizar recibo"}</Button></div></div></div>}

      {abaAtiva === "historico" && <HistoricoRecibos recibos={recibos} carregando={carregando} onBuscar={buscarHistorico} onConfirmarReembolso={confirmarReembolso} onCancelar={cancelar} onVisualizarPdf={visualizarPdf} pdfAbrindoId={pdfAbrindoId} />}
      {pdfPreviewUrl && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"><div className="flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">PDF do recibo</p><h2 className="truncate font-mono text-sm font-bold">{pdfPreviewNumero}</h2></div><Button type="button" variant="outline" onClick={fecharPdfPreview} className="h-8 gap-1.5 rounded-lg px-3 text-[10px]"><ArrowLeft size={13} /> Fechar</Button></div><iframe title={`PDF do recibo ${pdfPreviewNumero}`} src={pdfPreviewUrl} className="min-h-0 flex-1 bg-slate-100" /></div></div>}
      {carregando && abaAtiva === "emissao" && <p className="sr-only">Carregando dados de emissão</p>}
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}
