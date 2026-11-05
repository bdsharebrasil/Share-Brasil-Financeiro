import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileText,
  History,
  Paperclip,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Download,
  X,
} from "lucide-react";
import {
  anexarArquivoAoReciboPdf,
  gerarReciboPdf,
  numeroPaginasPdf,
} from "@/lib/reciboPdf";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { useFornecedores } from "@/hooks/useFornecedores";
import HistoricoRecibos, {
  type FiltrosHistoricoRecibos,
} from "@/components/financeiro-share/HistoricoRecibos";
import ProgramarContaAPagarDialog, { type RateioDiretoPayload } from "@/components/financeiro-share/ProgramarContaAPagarDialog";
import { EnviarEmailClienteDialog } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import ImportarDemonstrativoIA from "@/components/dashboard/financeiro/ImportarDemonstrativoIA";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";
import { IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import {
  buscarOpcoesRecibos,
  buscarRecibos,
  buscarNumerosVooAeronave,
  carregarArquivoColaborador,
  cancelarRecibo,
  reativarRecibo,
  confirmarReembolsoRecibo,
  criarRecibo,
  enviarAnexoRecibo,
  enviarPdfRecibo,
  enviarDespesaRateioRecibo,
  atualizarStatusRecibo,
  criarFornecedorCombustivel,
  criarContatoShare,
  type OpcoesRecibos,
  type NumeroVooOpcao,
  type Recibo as ReciboFinanceiro,
} from "@/lib/colaborador-api";
import { parseReaisToCentavos } from "@/lib/money";

// ---------------------------------------------------------------------------
// Dados fixos da Share (usados como emissor/recebedor/pagador conforme o
// tipo). Mesmos valores já usados no restante do sistema.
// ---------------------------------------------------------------------------
const SHARE_NOME = "SHARE BRASIL SERVICOS AEROPORTUARIOS";
const SHARE_DOCUMENTO = "30.898.549/0001-06";
const SHARE_ENDERECO = "AV. PRES. ARTHUR BERNARDES, 1457";
const SHARE_CIDADE = "VÁRZEA GRANDE";
const SHARE_UF = "MT";
const PAGADOR_ID_EMPRESA = "empresa"; // placeholder textual: pagador_id é NOT NULL na tabela e não referencia FK.

type TipoEmissao =
  | "recibo_reembolso"
  | "recibo_colaborador"
  | "recibo_pagamento";

// -----------------------------------------------------------------------
// Formulário: contém SOMENTE os campos que existem na tabela `recibos`,
// mais alguns campos auxiliares de UI (marcados abaixo) que ajudam a montar
// o PDF mas NUNCA são enviados no payload de criação do recibo.
// -----------------------------------------------------------------------
type Formulario = {
  tipo: TipoEmissao | null;

  // recibo_colaborador
  natureza_despesa: "aeronave" | "empresa" | "";
  colaborador_id: string;

  // recibo_reembolso / recibo_colaborador(aeronave)
  aeronave_id: string;
  abastecimentos_id: string;

  // pagador (coluna real da tabela)
  pagador_tipo: "empresa" | "cotista_aeronave" | "cliente";
  pagador_id: string;

  // recebedor e fornecedor selecionado
  recebedor_nome: string;
  fornecedor_id: string;
  fornecedor_nome: string;

  // Campos de UI usados no PDF e enviados ao backend para persistência.
  recebedor_cpf_ui: string;
  recebedor_endereco_ui: string;
  recebedor_cidade_ui: string;
  recebedor_uf_ui: string;

  valor: string;
  descricao_servico: string;
  data_emissao: string;
  data_vencimento: string;
  forma_pagamento: string;
  numero_voo: string;

  categoria_id: string;
  categoria_nome: string;
  categoria_despesa_subcategoria: string;
  categoria_nome_manual: string;

  numero_documento_anexo: string;
  observacoes: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);

const inicial = (): Formulario => ({
  tipo: null,
  natureza_despesa: "",
  colaborador_id: "",
  aeronave_id: "",
  abastecimentos_id: "",
  pagador_tipo: "empresa",
  pagador_id: "",
  recebedor_nome: "",
  fornecedor_id: "",
  fornecedor_nome: "",
  recebedor_cpf_ui: "",
  recebedor_endereco_ui: "",
  recebedor_cidade_ui: "",
  recebedor_uf_ui: "",
  valor: "",
  descricao_servico: "",
  data_emissao: hoje(),
  data_vencimento: "",
  forma_pagamento: "",
  numero_voo: "",
  categoria_id: "",
  categoria_nome: "",
  categoria_despesa_subcategoria: "",
  categoria_nome_manual: "",
  numero_documento_anexo: "",
  observacoes: "",
});

const opcoesTipo: Array<{
  id: TipoEmissao;
  titulo: string;
  detalhe: string;
  icon: typeof Receipt;
  cor: string;
  fundo: string;
}> = [
  {
    id: "recibo_reembolso",
    titulo: "Recibo de reembolso",
    detalhe: "Despesa antecipada pela Share para um cotista.",
    icon: RotateCcw,
    cor: "text-amber-500",
    fundo: "bg-amber-500/[.06]",
  },
  {
    id: "recibo_colaborador",
    titulo: "Recibo colaborador",
    detalhe: "Despesa da Share vinculada ao colaborador.",
    icon: Receipt,
    cor: "text-primary",
    fundo: "bg-primary/[.06]",
  },
  {
    id: "recibo_pagamento",
    titulo: "Recibo de pagamento",
    detalhe: "Lançamento simples, sem vínculo com cotista ou colaborador.",
    icon: FileText,
    cor: "text-sky-500",
    fundo: "bg-sky-500/[.06]",
  },
];

const CATEGORIA_OUTRO_ID = "111124d9-6111-4e11-a1f7-c7477e0fdb89";
const CATEGORIAS_EMPRESA = new Set([
  "88980acf-465f-4a16-8111-d8efaf28365b",
  "482a2993-28e9-417e-98f5-d00d03ada423",
  "28a599f4-d8de-4969-98aa-58452d49c92e",
  "0293e29f-526e-4be0-af2e-0e10e73e8a8f",
  "a4d8ed56-9bb2-47e1-93fa-2b786ff280b7",
  "09defc15-dced-408d-a975-092928374907",
  "82e24a46-a773-4b6e-b2ae-bfd41c04bc5d",
  CATEGORIA_OUTRO_ID,
]);

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function valorNumerico(valor: string) {
  return parseReaisToCentavos(valor) / 100;
}

function dataPorExtenso(valor: string) {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(data.getTime())) return "";
  const texto = data.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Várzea Grande, ${texto}`;
}

// Determina tipo_caixa (coluna obrigatória da tabela) a partir da regra de
// negócio de cada tipo de recibo.
function tipoCaixaPara(form: Formulario): "share" | "cliente" | "holding" {
  if (form.tipo === "recibo_colaborador") return "share";
  if (form.tipo === "recibo_reembolso") return "cliente";
  // recibo_pagamento: segue quem está pagando
  return form.pagador_tipo === "cotista_aeronave" || form.pagador_tipo === "cliente" ? "cliente" : "share";
}

function caminhoPdfRecibo(recibo: ReciboFinanceiro) {
  if (recibo.pdf_anexo_id)
    return `/api/financeiro/recibos/anexos/${encodeURIComponent(recibo.pdf_anexo_id)}/arquivo`;
  const pdfPersistido = recibo.pdf_url || recibo.url_recibo;
  return pdfPersistido
    ? `/api/financeiro/recibos/${encodeURIComponent(recibo.id)}/pdf/arquivo`
    : "";
}

// Gera o PDF a partir de um recibo já persistido. Usa apenas colunas reais
// da tabela (nome_pagador, documento_pagador, endereco_pagador,
// cidade_pagador, uf_pagador e os dados persistidos do recebedor).
async function gerarPdfRecibo(
  recibo: ReciboFinanceiro,
  colaborador?: OpcoesRecibos["colaboradores"][number],
  aeronaves: OpcoesRecibos["aeronaves"] = [],
) {
  const ehReembolso = recibo.tipo_recibo === "recibo_reembolso";
  const ehColaborador = recibo.tipo_recibo === "recibo_colaborador";
  const ehPagamento = recibo.tipo_recibo === "recibo_pagamento";

  const nomeColaborador =
    colaborador?.nome_completo || recibo.recebedor_nome || "";
  const documentoColaborador = colaborador?.cpf || "";
  const matriculaAeronave = aeronaves.find(
    (aeronave) => aeronave.id === recibo.aeronave_id,
  )?.matricula_registro;

  const blob = await gerarReciboPdf({
    numero: recibo.numero_recibo,
    valor: Number(recibo.valor || 0) / 100,
    descricao: [
      matriculaAeronave ? `Aeronave: ${matriculaAeronave}` : null,
      recibo.descricao,
      recibo.numero_documento_anexo
        ? `Documento anexo: ${recibo.numero_documento_anexo}`
        : null,
      recibo.observacoes,
    ]
      .filter(Boolean)
      .join("\n\n"),
    data: recibo.data_emissao,

    // recibo_reembolso: Share é a recebedora, cotista é o pagador.
    // recibo_colaborador: colaborador é o recebedor, Share é a pagadora.
    // recibo_pagamento: quem pagou (nome_pagador) é o emissor/pagador,
    //   quem recebeu (recebedor_nome) fica do outro lado.
    rotuloEmissor: ehPagamento ? "PAGADOR" : "RECEBEDOR",
    emissorNome: ehPagamento
      ? recibo.nome_pagador || "—"
      : ehColaborador
        ? nomeColaborador || "—"
        : SHARE_NOME,
    emissorDocumento: ehPagamento
      ? recibo.documento_pagador
        ? `CNPJ/CPF: ${recibo.documento_pagador}`
        : undefined
      : ehColaborador
        ? documentoColaborador
          ? `CPF: ${documentoColaborador}`
          : undefined
        : `CNPJ: ${SHARE_DOCUMENTO}`,
    emissorLinhas: ehReembolso
      ? [SHARE_ENDERECO, `${SHARE_CIDADE} - ${SHARE_UF}`]
      : undefined,

    rotuloPagador: ehPagamento ? "RECEBEDOR" : "PAGADOR",
    pagadorNome: ehPagamento
      ? recibo.recebedor_nome || "—"
      : recibo.nome_pagador || "—",
    pagadorDocumento: ehPagamento
      ? recibo.recebedor_cpf
        ? `CPF/CNPJ: ${recibo.recebedor_cpf}`
        : undefined
      : recibo.documento_pagador
        ? `CNPJ/CPF: ${recibo.documento_pagador}`
        : null,
    pagadorEndereco: ehPagamento ? recibo.recebedor_endereco : recibo.endereco_pagador,
    pagadorCidade: ehPagamento ? recibo.recebedor_cidade : recibo.cidade_pagador,
    pagadorUf: ehPagamento ? recibo.recebedor_uf : recibo.uf_pagador,
  });

  return new File(
    [blob],
    `${String(recibo.numero_recibo || recibo.id).replace(/[^a-z0-9-]/gi, "-")}.pdf`,
    { type: "application/pdf" },
  );
}

export default function EmissaoRecibo({ aoVoltar }: { aoVoltar: () => void }) {
  const { data: fornecedores = [], refetch: refetchFornecedores } = useFornecedores({ includeHotels: true });
  const [form, setForm] = useState<Formulario>(inicial);
  const [opcoes, setOpcoes] = useState<OpcoesRecibos>({
    clientes: [],
    colaboradores: [],
    aeronaves: [],
    cotistas: [],
    categorias: [],
    categorias_cliente: [],
    abastecimentos: [],
    fornecedores: [],
    recebedores: [],
  });
  const [recibos, setRecibos] = useState<ReciboFinanceiro[]>([]);
  const [voosDisponiveis, setVoosDisponiveis] = useState<NumeroVooOpcao[]>([]);
  const [vooSelecionadoId, setVooSelecionadoId] = useState("");
  const [carregandoVoos, setCarregandoVoos] = useState(false);
  const [erroVoos, setErroVoos] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"emissao" | "historico" | "rateio">("emissao");
  const [leitorDemonstrativoAberto, setLeitorDemonstrativoAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [previewAberta, setPreviewAberta] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPreviewNome, setPdfPreviewNome] = useState("recibo.pdf");
  const [reciboPdfPreview, setReciboPdfPreview] = useState<ReciboFinanceiro | null>(null);
  const [pdfAbrindoId, setPdfAbrindoId] = useState<string | null>(null);
  const [estadoEmissao, setEstadoEmissao] = useState<
    | "CRIADO"
    | "ANEXO_PENDENTE"
    | "PDF_PENDENTE"
    | "EMITIDO"
    | "ERRO_ANEXO"
    | "ERRO_PDF"
    | null
  >(null);
  const [reciboEmail, setReciboEmail] = useState<ReciboFinanceiro | null>(null);
  const [reciboProgramacao, setReciboProgramacao] = useState<ReciboFinanceiro | null>(null);
  const [reciboRateio, setReciboRateio] = useState<ReciboFinanceiro | null>(null);
  const [rateioAposEmail, setRateioAposEmail] = useState<{ recibo: ReciboFinanceiro; payload: RateioDiretoPayload } | null>(null);
  const [modalEmail, setModalEmail] = useState(false);
  const [cadastroFornecedorAberto, setCadastroFornecedorAberto] = useState(false);
  const [tipoNovoFornecedor, setTipoNovoFornecedor] = useState<"share" | "combustivel">("share");
  const [novoFornecedorDocumento, setNovoFornecedorDocumento] = useState("");
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const mostrarFeedback = (tipo: "sucesso" | "erro", texto: string) => {
    setFeedback({ tipo, texto });
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      const [dadosOpcoes, dadosRecibos] = await Promise.all([
        buscarOpcoesRecibos(),
        buscarRecibos(),
      ]);
      setOpcoes({
        ...dadosOpcoes,
        aeronaves: Array.isArray(dadosOpcoes.aeronaves)
          ? dadosOpcoes.aeronaves
          : [],
        abastecimentos: Array.isArray(dadosOpcoes.abastecimentos)
          ? dadosOpcoes.abastecimentos
          : [],
        recebedores: Array.isArray(dadosOpcoes.recebedores)
          ? dadosOpcoes.recebedores
          : [],
      });
      setRecibos(dadosRecibos.recibos);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados de emissão.",
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    if (!["recibo_reembolso", "recibo_pagamento"].includes(form.tipo || "") || !form.aeronave_id) {
      setVoosDisponiveis([]);
      setVooSelecionadoId("");
      setErroVoos("");
      setCarregandoVoos(false);
      return;
    }

    let ativo = true;
    setVoosDisponiveis([]);
    setVooSelecionadoId("");
    setErroVoos("");
    setCarregandoVoos(true);

    void buscarNumerosVooAeronave(form.aeronave_id)
      .then((resposta) => {
        if (ativo) setVoosDisponiveis(resposta.voos || []);
      })
      .catch((cause: unknown) => {
        if (ativo) {
          setErroVoos(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os voos da aeronave.",
          );
        }
      })
      .finally(() => {
        if (ativo) setCarregandoVoos(false);
      });

    return () => {
      ativo = false;
    };
  }, [form.tipo, form.aeronave_id]);

  const buscarHistorico = async (filtros: FiltrosHistoricoRecibos) => {
    setCarregando(true);
    setErro("");
    try {
      const dados = await buscarRecibos(filtros);
      setRecibos(dados.recibos);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível buscar os recibos.",
      );
    } finally {
      setCarregando(false);
    }
  };

  // Cotistas filtrados pela aeronave. No reembolso, a aeronave é a origem da
  // despesa, mas o devedor pode ser qualquer cotista cadastrado quando houve
  // uso emprestado da aeronave.
  const cotistasDaAeronave = useMemo(
    () =>
      form.aeronave_id
        ? opcoes.cotistas.filter(
            (item) => item.aeronave_id === form.aeronave_id,
          )
        : [],
    [form.aeronave_id, opcoes.cotistas],
  );
  const clientesSemCotista = useMemo(() => {
    const clienteIdsCotistas = new Set(
      opcoes.cotistas
        .map((cotista) => cotista.cliente_id)
        .filter((id): id is string => Boolean(id)),
    );
    return opcoes.clientes.filter((cliente) => !clienteIdsCotistas.has(cliente.id));
  }, [opcoes.clientes, opcoes.cotistas]);

  const valorReciboCentavos = Math.round(valorNumerico(form.valor) * 100);
  const tipoSelecionado = opcoesTipo.find((item) => item.id === form.tipo);
  const pagadorSelecionado = opcoes.cotistas.find(
    (item) => item.id === form.pagador_id,
  );
  const clientePagadorSelecionado = opcoes.clientes.find(
    (item) => item.id === form.pagador_id,
  );
  const categoriaClienteSelecionada = opcoes.categorias_cliente.find(
    (item) => item.id === form.categoria_id,
  );
  const subcategoriasCliente = [
    categoriaClienteSelecionada?.subcategoria_1,
    categoriaClienteSelecionada?.subcategoria_2,
    categoriaClienteSelecionada?.subcategoria_3,
    categoriaClienteSelecionada?.subcategoria_4,
  ].filter((item): item is string => Boolean(item?.trim()));
  const colaboradorSelecionado = opcoes.colaboradores.find(
    (item) => item.id === form.colaborador_id,
  );

  useEffect(
    () => () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    },
    [pdfPreviewUrl],
  );

  const alterar = <K extends keyof Formulario>(
    campo: K,
    valor: Formulario[K],
  ) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const fornecedoresCombobox = useMemo(
    () => fornecedores.map((item) => {
      const idOriginal = item.id.slice(item.origem.length + 1);
      const registro = opcoes.fornecedores.find((fornecedor) => fornecedor.id === idOriginal);
      return {
        id: item.id,
        label: [item.nome, registro?.documento || registro?.cnpj ? `Documento: ${registro.documento || registro.cnpj}` : ""].filter(Boolean).join(" · "),
      };
    }),
    [fornecedores, opcoes.fornecedores],
  );
  const selecionarFornecedor = (id: string, label: string) => {
    const fornecedor = fornecedores.find((item) => item.id === id);
    const registro = opcoes.fornecedores.find((item) => item.id === fornecedor?.id.slice(fornecedor.origem.length + 1));
    const nome = fornecedor?.nome || label;
    alterar("fornecedor_id", fornecedor ? fornecedor.id.slice(fornecedor.origem.length + 1) : "");
    alterar("fornecedor_nome", nome);
    alterar("recebedor_nome", nome);
    alterar("recebedor_cpf_ui", registro?.documento || registro?.cnpj || "");
  };
  const cadastrarFornecedor = async () => {
    const nome = form.fornecedor_nome.trim() || form.recebedor_nome.trim();
    if (!nome) return;
    setSalvandoFornecedor(true);
    try {
      const resposta = tipoNovoFornecedor === "combustivel"
        ? await criarFornecedorCombustivel(nome)
        : await criarContatoShare({ nome, razao_social: nome, cnpj: novoFornecedorDocumento.trim() || null, categoria_tipo: "FORNECEDOR" });
      const id = String((resposta as { item?: { id?: string }; id?: string }).item?.id || (resposta as { id?: string }).id || "");
      const origem = tipoNovoFornecedor === "combustivel" ? "combustivel" : "agenda";
      const fornecedoresAtualizados = await refetchFornecedores();
      const fornecedor = fornecedoresAtualizados.data?.find((item) => item.id === `${origem}:${id}`);
      alterar("fornecedor_id", fornecedor ? fornecedor.id.slice(fornecedor.origem.length + 1) : id);
      alterar("fornecedor_nome", nome);
      alterar("recebedor_nome", nome);
      alterar("recebedor_cpf_ui", novoFornecedorDocumento.trim());
      setCadastroFornecedorAberto(false);
      setNovoFornecedorDocumento("");
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível cadastrar o fornecedor.");
    } finally {
      setSalvandoFornecedor(false);
    }
  };

  const selecionarTipo = (tipo: TipoEmissao) => {
    setErro("");
    setMensagem("");
    const proximo = tipo === form.tipo ? null : tipo;
    setForm({ ...inicial(), tipo: proximo });
    setArquivo(null);
  };

  const selecionaCategoria = (id: string, nome: string) => {
    alterar("categoria_id", id);
    alterar("categoria_nome", nome);
    alterar("categoria_despesa_subcategoria", "");
  };

  // Seleciona o cotista devedor no reembolso: preenche pagador_tipo/id e já
  // deixa os dados denormalizados prontos (nome/documento/endereço), que são
  // as colunas reais nome_pagador/documento_pagador/endereco_pagador/etc.
  const selecionarCotistaDevedor = (id: string) => {
    alterar("pagador_tipo", "cotista_aeronave");
    alterar("pagador_id", id);
  };

  const selecionarClienteDevedor = (id: string) => {
    alterar("pagador_tipo", "cliente");
    alterar("pagador_id", id);
  };

  const selecionarAbastecimento = (abastecimentosId: string) => {
    alterar("abastecimentos_id", abastecimentosId);
    const abastecimento = opcoes.abastecimentos.find(
      (item) => item.id === abastecimentosId,
    );
    if (!abastecimento) return;

    if (form.aeronave_id && form.aeronave_id !== abastecimento.aeronave_id) {
      alterar("pagador_id", "");
      alterar("pagador_tipo", "empresa");
    }
    alterar("aeronave_id", abastecimento.aeronave_id);
    alterar(
      "valor",
      Number(abastecimento.valor_total || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  };

  const categoriaValida =
    form.tipo === "recibo_reembolso"
      ? Boolean(form.categoria_id && form.categoria_nome)
      : form.tipo === "recibo_colaborador"
        ? Boolean(
            form.natureza_despesa &&
              form.categoria_id &&
              (form.natureza_despesa === "aeronave"
                ? form.aeronave_id
                : CATEGORIAS_EMPRESA.has(form.categoria_id)) &&
              (form.categoria_id !== CATEGORIA_OUTRO_ID ||
                form.categoria_nome_manual.trim()),
          )
        : form.tipo === "recibo_pagamento"
          ? Boolean(
              form.categoria_id &&
                form.categoria_nome &&
                (subcategoriasCliente.length === 0 || form.categoria_despesa_subcategoria),
            )
          : Boolean(form.categoria_id && form.categoria_nome);

  // Regra fixa por tipo:
  // - recibo_colaborador: recebedor = colaborador; pagador é sempre a Share.
  // - recibo_pagamento: pagador pode ser Share OU cotista; recebedor é texto livre.
  // - recibo_reembolso: recebedor é SEMPRE a Share; pagador é SEMPRE o cotista
  //   devedor, vinculado a uma aeronave (a despesa é da aeronave).
  const podeEmitir = Boolean(
    form.tipo &&
      form.descricao_servico.trim() &&
      valorReciboCentavos > 0 &&
      categoriaValida &&
      (form.tipo === "recibo_colaborador"
        ? form.colaborador_id
        : form.tipo === "recibo_pagamento"
          ? form.recebedor_nome.trim() &&
            (form.pagador_tipo === "empresa" || form.pagador_id)
          : form.tipo === "recibo_reembolso"
            ? Boolean(
                form.pagador_id &&
                  (form.pagador_tipo === "cotista_aeronave" ||
                    form.pagador_tipo === "cliente"),
              )
            : false),
  );

  const abrirPreview = () => {
    if (!podeEmitir || !form.tipo) {
      setErro("Preencha os campos obrigatórios antes de visualizar o recibo.");
      return;
    }
    setErro("");
    setPreviewAberta(true);
  };

  const visualizarPdf = async (recibo: ReciboFinanceiro) => {
    setReciboPdfPreview(null);
    let caminho = caminhoPdfRecibo(recibo);
    setErro("");
    setPdfAbrindoId(recibo.id);
    try {
      // Nunca regenere um PDF já persistido. Ele pode conter o comprovante
      // anexado como páginas adicionais; regenerá-lo aqui descartaria essas
      // páginas e substituiria o arquivo correto por um recibo de uma página.
      if (!caminho) {
        const colaborador = opcoes.colaboradores.find(
          (item) => item.id === recibo.colaborador_id,
        );
        const pdf = await gerarPdfRecibo(recibo, colaborador, opcoes.aeronaves);
        const salvo = await enviarPdfRecibo(recibo.id, pdf);
        caminho = `/api/financeiro/recibos/anexos/${encodeURIComponent(salvo.anexo_id)}/arquivo`;
        setRecibos((atual) =>
          atual.map((item) =>
            item.id === recibo.id
              ? { ...item, pdf_anexo_id: salvo.anexo_id, pdf_url: salvo.pdf_url }
              : item,
          ),
        );
      } else if (recibo.tipo_recibo === "recibo_reembolso") {
        // Corrige recibos emitidos antes desta proteção: o PDF final pode ter
        // sido sobrescrito durante a visualização, embora o ORIGINAL continue
        // salvo no R2. Só recompõe quando o PDF persistido ainda tem uma página.
        const pdfAtual = await carregarArquivoColaborador(caminho);
        if (await numeroPaginasPdf(pdfAtual) === 1) {
          try {
            const original = await carregarArquivoColaborador(
              `/api/financeiro/recibos/${encodeURIComponent(recibo.id)}/anexo-original`,
            );
            const extensaoOriginal = original.type === "application/pdf"
              ? "pdf"
              : original.type.split("/")[1] || "bin";
            const anexoOriginal = new File(
              [original],
              `comprovante-original.${extensaoOriginal}`,
              { type: original.type || "application/octet-stream" },
            );
            const pdfCorrigido = await anexarArquivoAoReciboPdf(
              pdfAtual,
              anexoOriginal,
            );
            const salvo = await enviarPdfRecibo(recibo.id, pdfCorrigido);
            caminho = `/api/financeiro/recibos/anexos/${encodeURIComponent(salvo.anexo_id)}/arquivo`;
            setRecibos((atual) =>
              atual.map((item) =>
                item.id === recibo.id
                  ? { ...item, pdf_anexo_id: salvo.anexo_id, pdf_url: salvo.pdf_url }
                  : item,
              ),
            );
          } catch {
            // Se não houver comprovante original, mantém o PDF existente.
          }
        }
      }
      const blob = await carregarArquivoColaborador(caminho);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
      setPdfPreviewNome(
        `${String(recibo.numero_recibo || recibo.id).replace(/[^a-z0-9-]/gi, "-")}.pdf`,
      );
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? `Não foi possível abrir o PDF: ${cause.message}`
          : "Não foi possível abrir o PDF.",
      );
    } finally {
      setPdfAbrindoId(null);
    }
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
      // Dados denormalizados do pagador conforme a regra fixa de cada tipo.
      // ATENÇÃO: os únicos campos abaixo são os que existem de fato nas
      // colunas nome_pagador / documento_pagador / endereco_pagador /
      // cidade_pagador / uf_pagador da tabela `recibos`.
      const dadosPagador =
        form.tipo === "recibo_colaborador"
          ? {
              pagador_tipo: "empresa" as const,
              pagador_id: PAGADOR_ID_EMPRESA,
              nome_pagador: SHARE_NOME,
              documento_pagador: SHARE_DOCUMENTO,
              endereco_pagador: SHARE_ENDERECO,
              cidade_pagador: SHARE_CIDADE,
              uf_pagador: SHARE_UF,
            }
          : form.tipo === "recibo_reembolso"
            ? {
                pagador_tipo: form.pagador_tipo as "cotista_aeronave" | "cliente",
                pagador_id: form.pagador_id,
                nome_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.razao_social || "" : pagadorSelecionado?.nome || "",
                documento_pagador:
                  form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.cnpj || "" : pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "",
                endereco_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.endereco || "" : pagadorSelecionado?.endereco || "",
                cidade_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.cidade || "" : pagadorSelecionado?.cidade || "",
                uf_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.uf || "" : pagadorSelecionado?.uf || "",
              }
            : form.pagador_tipo === "empresa"
              ? {
                  pagador_tipo: "empresa" as const,
                  pagador_id: PAGADOR_ID_EMPRESA,
                  nome_pagador: SHARE_NOME,
                  documento_pagador: SHARE_DOCUMENTO,
                  endereco_pagador: SHARE_ENDERECO,
                  cidade_pagador: SHARE_CIDADE,
                  uf_pagador: SHARE_UF,
                }
              : {
                  pagador_tipo: form.pagador_tipo as "cotista_aeronave" | "cliente",
                  pagador_id: form.pagador_id,
                  nome_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.razao_social || "" : pagadorSelecionado?.nome || "",
                  documento_pagador:
                    form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.cnpj || "" : pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "",
                  endereco_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.endereco || "" : pagadorSelecionado?.endereco || "",
                  cidade_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.cidade || "" : pagadorSelecionado?.cidade || "",
                  uf_pagador: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.uf || "" : pagadorSelecionado?.uf || "",
                };

      // Recebedor conforme a regra fixa de cada tipo. Os dados do recebedor
      // são persistidos para que o PDF possa ser regenerado sem perder nome
      // ou documento.
      const recebedorNome =
        form.tipo === "recibo_reembolso"
          ? SHARE_NOME
          : form.tipo === "recibo_colaborador"
            ? colaboradorSelecionado?.nome_completo ||
              colaboradorSelecionado?.nome_exibicao ||
              ""
            : form.recebedor_nome.trim();

      // categoria_despesa_subcategoria é uma entrada para o backend aplicar
      // nas tabelas financeiras relacionadas; não é uma coluna de `recibos`.
      // Os campos numero_recibo, status, lancamento_id, criado_por, criado_em
      // e url_recibo são geridos pelo backend.
      const payload = {
        tipo_recibo: form.tipo,
        colaborador_id:
          form.tipo === "recibo_colaborador" ? form.colaborador_id : null,
        aeronave_id:
          form.tipo === "recibo_reembolso"
            ? form.aeronave_id || null
            : form.tipo === "recibo_pagamento"
              ? form.aeronave_id || null
            : form.tipo === "recibo_colaborador" &&
                form.natureza_despesa === "aeronave"
              ? form.aeronave_id
              : null,
        abastecimentos_id:
          form.tipo === "recibo_reembolso"
            ? form.abastecimentos_id || null
            : null,
        rateado: false as const,
        ...dadosPagador,
        cliente_id: form.pagador_tipo === "cliente" ? form.pagador_id : null,
        codigo_cliente: form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.codigo_cliente || null : null,
        valor_centavos: valorReciboCentavos,
        descricao: form.descricao_servico.trim(),
        data_emissao: form.data_emissao,
        data_vencimento: form.data_vencimento || null,
        forma_pagamento:
          form.tipo === "recibo_pagamento"
            ? form.forma_pagamento || null
            : null,
        numero_voo: vooSelecionadoId || null,
        tipo_caixa: tipoCaixaPara(form),
        categoria_movimentacao_id: form.categoria_id,
        categoria_nome: form.categoria_nome || null,
        categoria_despesa_subcategoria:
          form.tipo === "recibo_pagamento" || form.tipo === "recibo_reembolso"
            ? form.categoria_despesa_subcategoria || null
            : null,
        fornecedor_id: form.fornecedor_id || null,
        fornecedor_nome: form.fornecedor_nome || form.recebedor_nome.trim() || null,
        grupo_categoria:
          form.tipo === "recibo_colaborador"
            ? form.natureza_despesa === "aeronave"
              ? "DESPESAS REEMBOLSÁVEIS"
              : "DESPESAS EMPRESA"
            : null,
        recebedor_nome: recebedorNome,
        recebedor_cpf:
          form.tipo === "recibo_pagamento"
            ? form.recebedor_cpf_ui.trim() || null
            : form.tipo === "recibo_colaborador"
              ? colaboradorSelecionado?.cpf || null
              : SHARE_DOCUMENTO,
        numero_documento_anexo: form.numero_documento_anexo.trim() || null,
        observacoes: form.observacoes.trim() || null,
      };

      const resposta = await criarRecibo(payload);
      const reciboCriado: ReciboFinanceiro = resposta.recibo;

      setEstadoEmissao("CRIADO");
      setRecibos((atual) => [
        { ...reciboCriado, status: "CRIADO" },
        ...atual,
      ]);

      let avisoAnexo = "";
      if (arquivo) {
        setEstadoEmissao("ANEXO_PENDENTE");
        await atualizarStatusRecibo(resposta.recibo.id, "ANEXO_PENDENTE").catch(
          () => undefined,
        );
        try {
          await enviarAnexoRecibo(arquivo, resposta.recibo.id);
        } catch (anexoError) {
          setEstadoEmissao("ERRO_ANEXO");
          await atualizarStatusRecibo(resposta.recibo.id, "ERRO_ANEXO").catch(
            () => undefined,
          );
          avisoAnexo = ` O recibo foi criado, mas o anexo não pôde ser salvo${anexoError instanceof Error ? `: ${anexoError.message}` : "."}`;
        }
      }

      let avisoPdf = "";
      try {
        setEstadoEmissao("PDF_PENDENTE");
        let pdf = await gerarPdfRecibo(
          resposta.recibo,
          colaboradorSelecionado,
          opcoes.aeronaves,
        );
        if (arquivo) {
          pdf = await anexarArquivoAoReciboPdf(pdf, arquivo);
        }
        const pdfSalvo = await enviarPdfRecibo(resposta.recibo.id, pdf);
        resposta.recibo.pdf_url = pdfSalvo.pdf_url;
        resposta.recibo.pdf_anexo_id = pdfSalvo.anexo_id;
        setReciboPdfPreview({
          ...reciboCriado,
          pdf_url: pdfSalvo.pdf_url,
          pdf_anexo_id: pdfSalvo.anexo_id,
        });
        // O upload terminou com sucesso. Mostra imediatamente o mesmo arquivo
        // salvo, sem exigir que o usuário abra o histórico para encontrá-lo.
        const previewUrl = URL.createObjectURL(pdf);
        setPdfPreviewUrl((atual) => {
          if (atual) URL.revokeObjectURL(atual);
          return previewUrl;
        });
        setPdfPreviewNome(
          `${String(resposta.recibo.numero_recibo || resposta.recibo.id).replace(/[^a-z0-9-]/gi, "-")}.pdf`,
        );
      } catch (pdfError) {
        setEstadoEmissao("ERRO_PDF");
        await atualizarStatusRecibo(resposta.recibo.id, "ERRO_PDF").catch(
          () => undefined,
        );
        avisoPdf = ` O recibo foi criado, mas o PDF não pôde ser salvo${pdfError instanceof Error ? `: ${pdfError.message}` : "."}`;
      }

      if (!avisoAnexo && !avisoPdf) setEstadoEmissao("EMITIDO");
      setRecibos((atual) =>
        atual.map((item) =>
          item.id === resposta.recibo.id
            ? {
              ...reciboCriado,
                status: avisoAnexo
                  ? "ERRO_ANEXO"
                  : avisoPdf
                    ? "ERRO_PDF"
                    : "EMITIDO",
              }
            : item,
        ),
      );

      setMensagem(
        `Recibo ${resposta.recibo.numero_recibo} — estado ${avisoAnexo ? "ERRO_ANEXO" : avisoPdf ? "ERRO_PDF" : "EMITIDO"}.${avisoAnexo}${avisoPdf}`,
      );

      setForm(inicial());
      setArquivo(null);
      setPreviewAberta(false);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível emitir o recibo.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const confirmarReembolso = async (id: string) => {
    setErro("");
    try {
      await confirmarReembolsoRecibo(id);
      setRecibos((atual) =>
        atual.map((item) =>
          item.id === id ? { ...item, status: "EMITIDO" } : item,
        ),
      );
      setMensagem(
        "Programação de reembolso criada: lançamento Cliente, conta a receber e rateio esperado.",
      );
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível confirmar o reembolso.",
      );
    }
  };

  const cancelar = async (id: string) => {
    setErro("");
    try {
      await cancelarRecibo(id);
      setRecibos((atual) =>
        atual.map((item) =>
          item.id === id ? { ...item, status: "CANCELADO" } : item,
        ),
      );
      setMensagem("Recibo cancelado corretamente.");
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cancelar o recibo.",
      );
    }
  };

  const reativar = async (id: string, justificativa: string) => {
    await reativarRecibo(id, justificativa);
    await buscarHistorico({});
    setMensagem("Recibo reativado corretamente.");
  };

  const voltarAoHistorico = () => {
    setReciboRateio(null);
    setRateioAposEmail(null);
    setAbaAtiva("historico");
  };

  const programarEmail = (recibo: ReciboFinanceiro) => {
    if (recibo.tipo_recibo === "recibo_pagamento") {
      setReciboRateio(recibo);
      setAbaAtiva("rateio");
      return;
    }
    setReciboEmail(recibo);
    if (String(recibo.status).toUpperCase() === "EMAIL_ENVIADO") setReciboProgramacao(recibo);
    else setModalEmail(true);
  };

  const fecharPdfPreview = () => {
    setPdfPreviewUrl((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return "";
    });
    setReciboPdfPreview(null);
  };

  const continuarFluxoPdf = () => {
    if (!reciboPdfPreview) return;
    const recibo = reciboPdfPreview;
    fecharPdfPreview();
    programarEmail(recibo);
  };

  const emailEnviado = async () => {
    if (!reciboEmail) return;
    const recibo = reciboEmail;
    const rateioPendente = rateioAposEmail?.recibo.id === recibo.id ? rateioAposEmail : null;
    let erroStatus: unknown = null;
    try {
      await atualizarStatusRecibo(recibo.id, "EMAIL_ENVIADO");
    } catch (cause) {
      if (!rateioPendente) throw cause;
      erroStatus = cause;
    }
    try {
      if (rateioPendente) {
        await enviarDespesaRateioRecibo(recibo.id, rateioPendente.payload);
        setRateioAposEmail(null);
      }
      const atualizado = { ...recibo, status: erroStatus ? recibo.status : "EMAIL_ENVIADO" as const };
      setRecibos((atual) => atual.map((item) => item.id === recibo.id ? { ...atualizado, despesa_programada: Boolean(rateioPendente) || item.despesa_programada } : item));
      setModalEmail(false);
      setReciboProgramacao(null);
      if (rateioPendente) voltarAoHistorico();
      if (erroStatus) {
        mostrarFeedback(
          "erro",
          rateioPendente
            ? "EMAIL ENVIADO E RATEIO CRIADO, MAS O STATUS DO RECIBO NÃO FOI ATUALIZADO"
            : erroStatus instanceof Error
              ? erroStatus.message
              : "Não foi possível atualizar o status do e-mail.",
        );
        return;
      }
      if (rateioPendente) {
        mostrarFeedback("sucesso", "EMAIL ENVIADO E RATEIO CRIADO COM SUCESSO");
      } else {
        setReciboProgramacao(atualizado);
        mostrarFeedback("sucesso", "EMAIL ENVIADO COM SUCESSO");
      }
    } catch (cause) {
      if (rateioPendente) {
        setModalEmail(false);
        voltarAoHistorico();
      }
      mostrarFeedback(
        "erro",
        rateioPendente
          ? `EMAIL ENVIADO, MAS O RATEIO NÃO FOI GRAVADO: ${cause instanceof Error ? cause.message : "falha ao criar despesa/rateio"}`
          : cause instanceof Error
            ? cause.message
            : "Não foi possível atualizar o status do e-mail.",
      );
    }
  };

  return (
    <div className="route-enter mx-auto max-w-6xl space-y-5">
      {feedback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]" role="status" aria-live="polite">
          <div className={`flex w-full max-w-md items-center gap-4 rounded-2xl border px-6 py-5 text-center shadow-2xl animate-in zoom-in-95 duration-200 ${feedback.tipo === "sucesso" ? "border-emerald-400/40 bg-emerald-950/95 text-emerald-50" : "border-red-400/40 bg-red-950/95 text-red-50"}`}>
            {feedback.tipo === "sucesso" ? <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-300" /> : <XCircle className="h-8 w-8 shrink-0 text-red-300" />}
            <p className="flex-1 text-sm font-extrabold tracking-[.08em]">{feedback.texto}</p>
          </div>
        </div>
      )}
      {abaAtiva !== "rateio" && (
      <>
      <header className="flex flex-wrap items-start justify-between gap-5 md:gap-6">
        <div className="min-w-0">
          <IndicadorPagina>Financeiro / Emissão de recibo</IndicadorPagina>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold leading-tight tracking-[-.035em] sm:text-3xl md:text-4xl">
            <Receipt className="h-6 w-6 shrink-0 text-primary md:h-7 md:w-7" size={26} /> Emissão de recibo
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            Emita novos documentos ou consulte o arquivo mensal de recibos já
            emitidos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={aoVoltar}
          className="h-9 gap-2 rounded-sm text-[11px]"
        >
          <ArrowLeft size={14} /> Voltar ao financeiro
        </Button>
      </header>

      <nav
        aria-label="Seção de recibos"
        className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm"
      >
        <button
          type="button"
          onClick={() => setAbaAtiva("emissao")}
          aria-current={abaAtiva === "emissao" ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${abaAtiva === "emissao" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          <Receipt size={14} /> Emitir recibo
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("historico")}
          aria-current={abaAtiva === "historico" ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${abaAtiva === "historico" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          <History size={14} /> Histórico de recibos
        </button>
      </nav>
      </>
      )}

      {abaAtiva === "historico" && (
        <HistoricoRecibos
          recibos={recibos}
          carregando={carregando}
          onBuscar={buscarHistorico}
          onVisualizarPdf={visualizarPdf}
          pdfAbrindoId={pdfAbrindoId}
          onConfirmarReembolso={confirmarReembolso}
          onProgramarEmail={programarEmail}
          onCancelar={cancelar}
          onReativar={reativar}
        />
      )}

      <EnviarEmailClienteDialog
        open={modalEmail}
        onOpenChange={(aberto) => {
          setModalEmail(aberto);
          if (!aberto && rateioAposEmail) setRateioAposEmail(null);
        }}
        onSent={() => void emailEnviado()}
        assuntoSugerido={reciboEmail ? `Recibo ${reciboEmail.numero_recibo}` : ""}
        mensagemSugerida={reciboEmail ? `Olá,\n\nSegue o recibo ${reciboEmail.numero_recibo} em anexo.` : ""}
        anexos={reciboEmail && (reciboEmail.pdf_anexo_id || reciboEmail.pdf_url || reciboEmail.url_recibo)
          ? [{
              // Recibos legados/gerados pela IA podem não trazer pdf_anexo_id
              // na resposta, embora o PDF esteja disponível em url_recibo.
              // O backend resolve recibo:<id> para o anexo PDF relacionado.
              id: `recibo:${reciboEmail.pdf_anexo_id || reciboEmail.id}`,
              label: `Recibo ${reciboEmail.numero_recibo}.pdf`,
            }]
          : []}
        referencias={reciboEmail ? [`recibo:${reciboEmail.id}`] : []}
      />
      <ProgramarContaAPagarDialog
        open={Boolean(reciboProgramacao || reciboRateio)}
        recibo={reciboRateio ?? reciboProgramacao}
        aeronaves={opcoes.aeronaves}
        categorias={opcoes.categorias_cliente}
        onRequestEmail={(recibo, payload) => {
          setRateioAposEmail({ recibo, payload });
          setReciboEmail(recibo);
          setModalEmail(true);
        }}
        onOpenChange={(aberto) => {
          if (aberto) return;
          if (reciboRateio) voltarAoHistorico();
          else setReciboProgramacao(null);
        }}
        onSaved={() => {
          const alvo = reciboRateio ?? reciboProgramacao;
          if (alvo) {
            setRecibos((atual) => atual.map((item) => item.id === alvo.id ? { ...item, despesa_programada: true } : item));
          }
          mostrarFeedback("sucesso", "SUA PROGRAMAÇÃO FOI CONCLUIDA");
        }}
      />

      {abaAtiva === "emissao" && !leitorDemonstrativoAberto && (
        <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
          <div className="border-b border-border bg-secondary/20 px-5 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[.16em]">
              Tipo de emissão <sup className="text-primary">*</sup>
            </p>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-4">
            {opcoesTipo.map((opcao) => {
              const ativo = form.tipo === opcao.id;
              const Icon = opcao.icon;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => selecionarTipo(opcao.id)}
                  aria-pressed={ativo}
                  className={`group flex min-h-[116px] items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${ativo ? `border-primary/60 ${opcao.fundo} shadow-md` : "border-border bg-secondary/[.12] hover:border-primary/35"}`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 place-content-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}
                  >
                    {ativo && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold">
                      {opcao.titulo}
                    </span>
                    <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
                      {opcao.detalhe}
                    </span>
                  </span>
                  <Icon
                    className={ativo ? opcao.cor : "text-muted-foreground/60"}
                    size={18}
                  />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setLeitorDemonstrativoAberto(true);
                setErro("");
                setMensagem("");
              }}
              className="group flex min-h-[116px] items-start gap-3 rounded-xl border border-primary/35 bg-primary/[.045] p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
            >
              <span className="mt-0.5 grid h-5 w-5 place-content-center rounded-full border border-primary/50">
                <span className="h-2.5 w-2.5 rounded-full bg-primary/75" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold">Ler Demonstrativo</span>
                <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">Importe INFRAERO ou DECEA, confira os voos e gere os recibos por cotista.</span>
              </span>
              <FileText className="text-primary" size={18} />
            </button>
          </div>

          {form.tipo && (
            <div className="border-t border-border px-5 py-5">
              <div className="mb-5 flex items-center gap-2 rounded-sm border border-primary/25 bg-primary/[.06] px-3.5 py-2.5 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <strong>{tipoSelecionado?.titulo}</strong>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {form.tipo === "recibo_pagamento" && (
                  <>
                    <Campo label="Aeronave (opcional)">
                      <SearchableCombobox
                        items={opcoes.aeronaves.map((aeronave) => ({
                          id: aeronave.id,
                          label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}`,
                        }))}
                        value={form.aeronave_id}
                        onChange={(id) => {
                          alterar("aeronave_id", id);
                          alterar("numero_voo", "");
                          setVooSelecionadoId("");
                        }}
                        placeholder="Selecione a aeronave"
                        searchPlaceholder="Buscar aeronave..."
                        emptyMessage="Nenhuma aeronave encontrada."
                      />
                    </Campo>
                    <Campo label="Número do voo (opcional)">
                      <SearchableCombobox
                        items={voosDisponiveis.map((voo) => ({
                          id: voo.solicitacao_id,
                          label: [
                            voo.numero_voo || "Voo sem número",
                            voo.data_agendada
                              ? new Date(`${voo.data_agendada.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
                              : "",
                            voo.origem && voo.destino
                              ? `${voo.origem} → ${voo.destino}`
                              : "",
                          ].filter(Boolean).join(" · "),
                        }))}
                        value={vooSelecionadoId}
                        selectedLabel={voosDisponiveis.find((voo) => voo.solicitacao_id === vooSelecionadoId)?.numero_voo || form.numero_voo}
                        onChange={(id) => {
                          const voo = voosDisponiveis.find((item) => item.solicitacao_id === id);
                          setVooSelecionadoId(id);
                          alterar("numero_voo", voo?.numero_voo || "");
                        }}
                        placeholder={
                          carregandoVoos
                            ? "Carregando voos..."
                            : form.aeronave_id
                              ? "Selecione ou busque um voo"
                              : "Selecione a aeronave primeiro"
                        }
                        searchPlaceholder="Buscar número, rota ou data..."
                        emptyMessage="Nenhum voo encontrado para esta aeronave."
                        disabled={!form.aeronave_id || carregandoVoos}
                        clearable
                      />
                      {erroVoos && <p className="mt-1 text-xs text-destructive">{erroVoos}</p>}
                    </Campo>
                    <Campo label="RECEBEDOR (nome)" obrigatorio>
                      <div className="flex gap-2">
                        <SearchableCombobox
                          items={fornecedoresCombobox}
                          value={form.fornecedor_id || form.fornecedor_nome || form.recebedor_nome}
                          selectedLabel={form.fornecedor_nome || form.recebedor_nome}
                          onChange={selecionarFornecedor}
                          placeholder="Buscar fornecedor por nome ou documento"
                          searchPlaceholder="Nome, CNPJ ou documento..."
                          emptyMessage="Nenhum fornecedor encontrado. Digite para usar somente neste recibo."
                          allowFreeText
                        />
                        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { setTipoNovoFornecedor("share"); setCadastroFornecedorAberto(true); }} disabled={!form.recebedor_nome.trim() && !form.fornecedor_nome.trim()} title="Registrar novo fornecedor">Registrar</Button>
                      </div>
                    </Campo>
                    {/* Documento usado no PDF e persistido para regeneração. */}
                    <Campo label="CPF do recebedor (só para o PDF)">
                      <input
                        value={form.recebedor_cpf_ui}
                        onChange={(e) =>
                          alterar("recebedor_cpf_ui", e.target.value)
                        }
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className="campo"
                      />
                    </Campo>
                  </>
                )}

                {form.tipo === "recibo_reembolso" && (
                  <>
                    <div className="rounded-sm border border-sky-400/30 bg-sky-400/[.06] p-3 md:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-sky-600">
                        Recebedor (fixo)
                      </p>
                      <p className="mt-1 text-[11px] font-semibold">
                        {SHARE_NOME} · CNPJ: {SHARE_DOCUMENTO}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        No reembolso, quem recebe é sempre a Share — a
                        despesa foi antecipada por ela.
                      </p>
                    </div>
                    <Campo label="Aeronave da despesa">
                      <SearchableCombobox
                        items={opcoes.aeronaves.map((aeronave) => ({
                          id: aeronave.id,
                          label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}`,
                        }))}
                        value={form.aeronave_id}
                        onChange={(id) => {
                          alterar("abastecimentos_id", "");
                          alterar("aeronave_id", id);
                          alterar("numero_voo", "");
                          setVooSelecionadoId("");
                          alterar("pagador_id", "");
                          alterar("pagador_tipo", "empresa");
                        }}
                        placeholder="Selecione a aeronave"
                        searchPlaceholder="Buscar aeronave..."
                        emptyMessage="Nenhuma aeronave encontrada."
                      />
                    </Campo>
                    <Campo label="Número do voo (opcional)">
                      <SearchableCombobox
                        items={voosDisponiveis.map((voo) => ({
                          id: voo.solicitacao_id,
                          label: [
                            voo.numero_voo || "Voo sem número",
                            voo.data_agendada
                              ? new Date(`${voo.data_agendada.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
                              : "",
                            voo.origem && voo.destino
                              ? `${voo.origem} → ${voo.destino}`
                              : "",
                          ].filter(Boolean).join(" · "),
                        }))}
                        value={vooSelecionadoId}
                        selectedLabel={voosDisponiveis.find((voo) => voo.solicitacao_id === vooSelecionadoId)?.numero_voo || form.numero_voo}
                        onChange={(id) => {
                          const voo = voosDisponiveis.find((item) => item.solicitacao_id === id);
                          setVooSelecionadoId(id);
                          alterar("numero_voo", voo?.numero_voo || "");
                        }}
                        placeholder={
                          carregandoVoos
                            ? "Carregando voos..."
                            : form.aeronave_id
                              ? "Selecione ou busque um voo"
                              : "Selecione a aeronave primeiro"
                        }
                        searchPlaceholder="Buscar número, rota ou data..."
                        emptyMessage="Nenhum voo encontrado para esta aeronave."
                        disabled={!form.aeronave_id || carregandoVoos}
                        clearable
                      />
                      {erroVoos && <p className="mt-1 text-xs text-destructive">{erroVoos}</p>}
                    </Campo>
                    <Campo label="Abastecimento vinculado (opcional)">
                      <SearchableCombobox
                        items={[
                          { id: "__sem_abastecimento__", label: "Sem vínculo com abastecimento" },
                          ...opcoes.abastecimentos
                            .filter((item) => !form.aeronave_id || item.aeronave_id === form.aeronave_id)
                            .map((item) => {
                              const data = item.data
                                ? new Date(`${item.data.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
                                : "Data não informada";
                              return {
                                id: item.id,
                                label: [
                                  data,
                                  item.matricula_registro || "Aeronave",
                                  item.tipo_combustivel,
                                  item.numero_comanda ? `Comanda ${item.numero_comanda}` : null,
                                  item.numero_nf ? `NF ${item.numero_nf}` : null,
                                  moeda(Number(item.valor_total || 0)),
                                ].filter(Boolean).join(" · "),
                              };
                            }),
                        ]}
                        value={form.abastecimentos_id || "__sem_abastecimento__"}
                        onChange={(id) => selecionarAbastecimento(id === "__sem_abastecimento__" ? "" : id)}
                        placeholder="Selecione um abastecimento"
                        searchPlaceholder="Buscar por comanda, nota ou aeronave..."
                        emptyMessage="Nenhum abastecimento disponível para esta aeronave."
                      />
                    </Campo>
                    <Campo
                      label="Cotista devedor (quem vai pagar o reembolso)"
                      obrigatorio
                    >
                      <SearchableCombobox
                        items={[
                          ...(form.aeronave_id ? cotistasDaAeronave : opcoes.cotistas),
                          ...clientesSemCotista,
                        ].map((pagador) => ({
                          id: pagador.id,
                          label: "razao_social" in pagador
                            ? `${pagador.razao_social}${pagador.codigo_cliente ? ` · ${pagador.codigo_cliente}` : ""} · Cliente`
                            : `${pagador.nome}${pagador.codigo_cliente ? ` · ${pagador.codigo_cliente}` : ""}`,
                        }))}
                        value={form.pagador_id}
                        onChange={(id) => clientesSemCotista.some((cliente) => cliente.id === id)
                          ? selecionarClienteDevedor(id)
                          : selecionarCotistaDevedor(id)}
                        placeholder={
                          "Selecione cliente ou cotista"
                        }
                        searchPlaceholder="Buscar cotista..."
                        emptyMessage={
                          form.tipo === "recibo_reembolso"
                            ? "Nenhum cliente ou cotista encontrado."
                            : "Nenhum cotista encontrado para esta aeronave."
                        }
                      />
                    </Campo>
                    {form.pagador_id && (
                      <div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3 md:col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">
                          DADOS DO PAGADOR
                        </p>
                        <p className="mt-1 text-[11px] font-semibold">
                          {form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.razao_social : pagadorSelecionado?.nome || "Pagador"} ·{" "}
                          {form.pagador_tipo === "cliente" ? clientePagadorSelecionado?.cnpj : pagadorSelecionado?.cnpj ||
                            pagadorSelecionado?.cpf ||
                            "Documento não informado"}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {form.tipo === "recibo_colaborador" && (
                  <Campo label="RECEBEDOR (colaborador)" obrigatorio>
                    <select
                      value={form.colaborador_id}
                      onChange={(e) =>
                        alterar("colaborador_id", e.target.value)
                      }
                      className="campo"
                    >
                      <option value="">Selecione o colaborador</option>
                      {opcoes.colaboradores.map((colaborador) => (
                        <option key={colaborador.id} value={colaborador.id}>
                          {colaborador.nome_exibicao ||
                            colaborador.nome_completo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                )}

                <Campo label="Data" obrigatorio>
                  <input
                    type="date"
                    value={form.data_emissao}
                    onChange={(e) => alterar("data_emissao", e.target.value)}
                    className="campo"
                  />
                </Campo>
                <Campo label="Número do recibo">
                  <input
                    value="Gerado automaticamente"
                    readOnly
                    aria-readonly="true"
                    className="campo font-mono text-muted-foreground"
                  />
                </Campo>

                {form.tipo === "recibo_pagamento" && (
                  <>
                    <Campo label="Pagador" obrigatorio>
                      <SearchableCombobox
                        items={[
                          { id: "empresa", label: "Share Brasil" },
                          ...opcoes.cotistas.map((cotista) => ({
                            id: cotista.id,
                            label: `${cotista.nome}${cotista.codigo_cliente ? ` · ${cotista.codigo_cliente}` : ""}`,
                          })),
                          ...clientesSemCotista.map((cliente) => ({
                            id: cliente.id,
                            label: `${cliente.razao_social}${cliente.codigo_cliente ? ` · ${cliente.codigo_cliente}` : ""} · Cliente`,
                          })),
                        ]}
                        value={
                          form.pagador_tipo === "empresa"
                            ? "empresa"
                            : form.pagador_id
                        }
                        onChange={(id) => {
                          if (id === "empresa") {
                            alterar("pagador_tipo", "empresa");
                            alterar("pagador_id", "");
                          } else {
                            alterar("pagador_tipo", clientesSemCotista.some((cliente) => cliente.id === id) ? "cliente" : "cotista_aeronave");
                            alterar("pagador_id", id);
                          }
                        }}
                        placeholder="Selecione o pagador"
                        searchPlaceholder="Buscar cliente ou cotista..."
                        emptyMessage="Nenhum cliente ou cotista encontrado."
                      />
                    </Campo>
                    <div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">
                        DADOS DO PAGADOR
                      </p>
                      <p className="mt-1 text-[11px] font-semibold">
                        {form.pagador_tipo === "cotista_aeronave"
                          ? `${pagadorSelecionado?.nome || "Cotista"} · ${pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "Documento não informado"}`
                          : form.pagador_tipo === "cliente"
                            ? `${clientePagadorSelecionado?.razao_social || "Cliente"} · ${clientePagadorSelecionado?.cnpj || "Documento não informado"}`
                          : "Share Brasil"}
                      </p>
                    </div>
                  </>
                )}

                <Campo
                  label={
                    form.tipo === "recibo_pagamento"
                      ? "Descrição"
                      : "Descrição do serviço"
                  }
                  obrigatorio
                  className="md:col-span-2"
                >
                  <input
                    value={form.descricao_servico}
                    onChange={(e) =>
                      alterar("descricao_servico", e.target.value)
                    }
                    placeholder={
                      form.tipo === "recibo_pagamento"
                        ? "Descrição do pagamento"
                        : "Ex.: Reembolso de despesas operacionais"
                    }
                    className="campo"
                  />
                </Campo>
                <Campo label="Valor" obrigatorio>
                  <input
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => alterar("valor", e.target.value)}
                    placeholder="0,00"
                    className="campo font-mono"
                  />
                </Campo>
                <Campo
                  label="Vencimento"
                  obrigatorio={form.tipo === "recibo_pagamento"}
                >
                  <input
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) =>
                      alterar("data_vencimento", e.target.value)
                    }
                    className="campo"
                  />
                </Campo>

                {form.tipo === "recibo_reembolso" && (
                  <Campo label="Categoria cliente" obrigatorio>
                    <SearchableCombobox
                      items={opcoes.categorias_cliente.map((item) => ({
                        id: item.id,
                        label: item.nome,
                      }))}
                      value={form.categoria_id}
                      onChange={(id) => {
                        const categoria = opcoes.categorias_cliente.find(
                          (item) => item.id === id,
                        );
                        alterar("categoria_id", id);
                        alterar("categoria_nome", categoria?.nome || "");
                        alterar("categoria_despesa_subcategoria", "");
                      }}
                      placeholder="Selecione a categoria cliente"
                      searchPlaceholder="Buscar categoria cliente..."
                      emptyMessage="Nenhuma categoria cliente cadastrada."
                    />
                  </Campo>
                )}

                {form.tipo === "recibo_reembolso" && subcategoriasCliente.length > 0 && (
                  <Campo label="Subcategoria cliente">
                    <select
                      value={form.categoria_despesa_subcategoria}
                      onChange={(e) => alterar("categoria_despesa_subcategoria", e.target.value)}
                      className="campo"
                    >
                      <option value="">Selecione a subcategoria</option>
                      {subcategoriasCliente.map((subcategoria) => (
                        <option key={subcategoria} value={subcategoria}>{subcategoria}</option>
                      ))}
                    </select>
                  </Campo>
                )}

                {form.tipo === "recibo_pagamento" && (
                  <>
                    <Campo label="Forma de pagamento" obrigatorio>
                      <select
                        value={form.forma_pagamento}
                        onChange={(e) =>
                          alterar("forma_pagamento", e.target.value)
                        }
                        className="campo"
                      >
                        <option value="">Selecione</option>
                        <option>PIX</option>
                        <option>Transferência bancária</option>
                        <option>Boleto</option>
                        <option>Cartão</option>
                        <option>Dinheiro</option>
                      </select>
                    </Campo>
                    <Campo label="Categoria movimentação cliente" obrigatorio>
                      <SearchableCombobox
                        items={opcoes.categorias_cliente.map((item) => ({
                          id: item.id,
                          label: item.nome,
                        }))}
                        value={form.categoria_id}
                        onChange={selecionaCategoria}
                        placeholder="Selecione a categoria cliente"
                        searchPlaceholder="Buscar categoria cliente..."
                        emptyMessage="Nenhuma categoria cliente cadastrada."
                      />
                    </Campo>
                    {subcategoriasCliente.length > 0 && (
                      <Campo label="Subcategoria cliente" obrigatorio>
                        <select
                          value={form.categoria_despesa_subcategoria}
                          onChange={(e) => alterar("categoria_despesa_subcategoria", e.target.value)}
                          className="campo"
                        >
                          <option value="">Selecione a subcategoria</option>
                          {subcategoriasCliente.map((subcategoria) => (
                            <option key={subcategoria} value={subcategoria}>{subcategoria}</option>
                          ))}
                        </select>
                      </Campo>
                    )}
                  </>
                )}

                {form.tipo === "recibo_colaborador" && (
                  <>
                    <Campo label="Tipo de despesa" obrigatorio>
                      <select
                        value={form.natureza_despesa}
                        onChange={(e) => {
                          const natureza = e.target
                            .value as Formulario["natureza_despesa"];
                          alterar("natureza_despesa", natureza);
                          alterar("categoria_id", "");
                          alterar("categoria_nome", "");
                          alterar("categoria_nome_manual", "");
                          alterar("aeronave_id", "");
                        }}
                        className="campo"
                      >
                        <option value="">Selecione o tipo</option>
                        <option value="aeronave">Despesa aeronave</option>
                        <option value="empresa">Despesa empresa</option>
                      </select>
                    </Campo>
                    {form.natureza_despesa === "aeronave" && (
                      <>
                        <Campo label="Categoria" obrigatorio>
                          <SearchableCombobox
                            items={opcoes.categorias
                              .filter(
                                (item) =>
                                  item.grupo_categoria.toUpperCase() ===
                                  "DESPESAS REEMBOLSÁVEIS",
                              )
                              .map((item) => ({
                                id: item.id,
                                label: item.nome,
                              }))}
                            value={form.categoria_id}
                            onChange={selecionaCategoria}
                            placeholder="Selecione a categoria"
                            searchPlaceholder="Buscar categoria..."
                            emptyMessage="Nenhuma despesa reembolsável encontrada."
                          />
                        </Campo>
                        <Campo label="Aeronave" obrigatorio>
                          <SearchableCombobox
                            items={opcoes.aeronaves.map((aeronave) => ({
                              id: aeronave.id,
                              label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}`,
                            }))}
                            value={form.aeronave_id}
                            onChange={(id) => alterar("aeronave_id", id)}
                            placeholder="Selecione a aeronave"
                            searchPlaceholder="Buscar aeronave..."
                            emptyMessage="Nenhuma aeronave encontrada."
                          />
                        </Campo>
                      </>
                    )}
                    {form.natureza_despesa === "empresa" && (
                      <Campo label="Categoria" obrigatorio>
                        <SearchableCombobox
                          items={opcoes.categorias
                            .filter((item) => CATEGORIAS_EMPRESA.has(item.id))
                            .map((item) => ({ id: item.id, label: item.nome }))}
                          value={form.categoria_id}
                          onChange={selecionaCategoria}
                          placeholder="Selecione a categoria"
                          searchPlaceholder="Buscar categoria..."
                          emptyMessage="Nenhuma categoria disponível."
                        />
                      </Campo>
                    )}
                    {form.natureza_despesa === "empresa" &&
                      form.categoria_id === CATEGORIA_OUTRO_ID && (
                        <Campo
                          label="Descrição da categoria"
                          obrigatorio
                          className="md:col-span-2"
                        >
                          <input
                            value={form.categoria_nome_manual}
                            onChange={(e) =>
                              alterar("categoria_nome_manual", e.target.value)
                            }
                            placeholder="Informe a despesa"
                            className="campo"
                          />
                        </Campo>
                      )}
                  </>
                )}

                <div className="md:col-span-2">
                  <Campo label="Anexo (opcional)">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                      className="campo file:mr-3 file:rounded-sm file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-bold file:text-primary"
                    />
                  </Campo>
                  {arquivo && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-sm border border-border bg-secondary/[.12] p-3 text-[11px]">
                      <Paperclip size={14} className="text-primary" />
                      <span className="max-w-[260px] truncate font-medium">
                        {arquivo.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setArquivo(null);
                          alterar("numero_documento_anexo", "");
                        }}
                        className="ml-auto h-7 px-2 text-[10px]"
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                  {arquivo && (
                    <div className="mt-3 max-w-sm">
                      <Campo label="Número do documento do anexo">
                        <input
                          value={form.numero_documento_anexo}
                          onChange={(e) =>
                            alterar("numero_documento_anexo", e.target.value)
                          }
                          placeholder="Ex.: NF 12345, boleto 987..."
                          className="campo"
                        />
                      </Campo>
                    </div>
                  )}
                </div>
                <Campo label="Observações" className="md:col-span-2">
                  <textarea
                    value={form.observacoes}
                    onChange={(e) => alterar("observacoes", e.target.value)}
                    className="campo min-h-20 resize-y"
                    placeholder="Informações complementares do recibo"
                  />
                </Campo>
              </div>

              {erro && (
                <div
                  role="alert"
                  className="mt-5 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200"
                >
                  {erro}
                </div>
              )}
              {mensagem && !erro && (
                <div
                  role="status"
                  className="mt-5 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200"
                >
                  {mensagem}
                  {estadoEmissao ? ` [${estadoEmissao}]` : ""}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  onClick={abrirPreview}
                  disabled={salvando || !podeEmitir}
                  className="h-9 gap-2 rounded-sm px-5 text-[11px]"
                >
                  <FileText size={14} /> Pré-visualizar recibo
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {abaAtiva === "emissao" && leitorDemonstrativoAberto && (
        <ImportarDemonstrativoIA
          opcoes={opcoes}
          dataVencimento={form.data_vencimento}
          onCancel={() => setLeitorDemonstrativoAberto(false)}
          onCreated={async () => {
            await carregar();
            setLeitorDemonstrativoAberto(false);
            setAbaAtiva("historico");
          }}
        />
      )}

      {cadastroFornecedorAberto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl">
            <h2 className="text-base font-bold">Registrar fornecedor</h2>
            <p className="mt-1 text-xs text-muted-foreground">Escolha onde salvar ou use apenas neste recibo fechando esta janela.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold">Tipo de fornecedor
                <select value={tipoNovoFornecedor} onChange={(event) => setTipoNovoFornecedor(event.target.value as "share" | "combustivel")} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-xs">
                  <option value="share">Fornecedor Share (agenda_contatos_fornecedores)</option>
                  <option value="combustivel">Fornecedor de combustível</option>
                </select>
              </label>
              <label className="block text-xs font-semibold">Nome<input value={form.fornecedor_nome || form.recebedor_nome} onChange={(event) => { alterar("fornecedor_nome", event.target.value); alterar("recebedor_nome", event.target.value); }} className="campo mt-1" /></label>
              <label className="block text-xs font-semibold">CNPJ ou documento (opcional)<input value={novoFornecedorDocumento} onChange={(event) => { setNovoFornecedorDocumento(event.target.value); alterar("recebedor_cpf_ui", event.target.value); }} className="campo mt-1" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCadastroFornecedorAberto(false)} disabled={salvandoFornecedor}>Somente neste recibo</Button><Button type="button" onClick={() => void cadastrarFornecedor()} disabled={salvandoFornecedor || !(form.fornecedor_nome || form.recebedor_nome).trim()}>{salvandoFornecedor ? "Salvando..." : "Salvar fornecedor"}</Button></div>
          </div>
        </div>
      )}
      {abaAtiva === "emissao" && previewAberta && form.tipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-sm bg-white p-6 text-slate-800 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <img
                src={logoShare}
                alt="Share Brasil"
                className="h-20 w-40 object-contain object-center p-1"
              />
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-wide underline">
                  RECIBO
                </h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  Pré-visualização antes da finalização
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold">Número do recibo</p>
                <p className="font-mono text-[11px] font-bold text-slate-500">
                  Será gerado ao finalizar
                </p>
                <p className="mt-2 border-2 border-slate-800 px-4 py-2 text-lg font-black">
                  {moeda(valorNumerico(form.valor))}
                </p>
              </div>
            </div>

            <div className="grid gap-6 border-b border-slate-300 py-6 text-xs md:grid-cols-2">
              {/* Lado esquerdo: quem RECEBE */}
              <div>
                <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">
                  Recebedor
                </p>
                {form.tipo === "recibo_pagamento" ? (
                  <>
                    <strong>
                      {form.recebedor_nome || "Recebedor não informado"}
                    </strong>
                    <p>CPF: {form.recebedor_cpf_ui || "Não informado"}</p>
                  </>
                ) : form.tipo === "recibo_colaborador" ? (
                  <>
                    <strong>
                      {colaboradorSelecionado?.nome_completo || "Colaborador"}
                    </strong>
                    <p>CPF: {colaboradorSelecionado?.cpf || "não informado"}</p>
                  </>
                ) : (
                  <>
                    <strong>{SHARE_NOME}</strong>
                    <p>CNPJ: {SHARE_DOCUMENTO}</p>
                    <p>{SHARE_ENDERECO}</p>
                    <p>
                      {SHARE_CIDADE} - {SHARE_UF}
                    </p>
                  </>
                )}
              </div>

              {/* Lado direito: quem PAGA */}
              <div>
                <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">
                  Pagador
                </p>
                {form.tipo === "recibo_colaborador" ? (
                  <>
                    <strong>{SHARE_NOME}</strong>
                    <p>CNPJ: {SHARE_DOCUMENTO}</p>
                    <p>{SHARE_ENDERECO}</p>
                    <p>
                      {SHARE_CIDADE} - {SHARE_UF}
                    </p>
                  </>
                ) : form.pagador_tipo === "cotista_aeronave" ? (
                  <>
                    <strong>{pagadorSelecionado?.nome || "Cotista"}</strong>
                    <p>
                      {pagadorSelecionado?.cnpj ||
                        pagadorSelecionado?.cpf ||
                        "Documento não informado"}
                    </p>
                    <p>
                      {pagadorSelecionado?.endereco || "Endereço não informado"}
                    </p>
                    <p>
                      {[pagadorSelecionado?.cidade, pagadorSelecionado?.uf]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </>
                ) : form.pagador_tipo === "cliente" ? (
                  <>
                    <strong>
                      {clientePagadorSelecionado?.razao_social || "Cliente"}
                    </strong>
                    <p>
                      {clientePagadorSelecionado?.cnpj ||
                        "Documento não informado"}
                    </p>
                    <p>
                      {clientePagadorSelecionado?.endereco ||
                        "Endereço não informado"}
                    </p>
                    <p>
                      {[clientePagadorSelecionado?.cidade, clientePagadorSelecionado?.uf]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </>
                ) : (
                  <>
                    <strong>{SHARE_NOME}</strong>
                    <p>CNPJ: {SHARE_DOCUMENTO}</p>
                  </>
                )}
              </div>
            </div>

            {(() => {
              const temDoc = Boolean(form.numero_documento_anexo);
              const cols = temDoc
                ? "grid-cols-[1fr_130px_100px]"
                : "grid-cols-[1fr_100px]";
              return (
                <div className="overflow-hidden border border-slate-300 text-xs">
                  <div className={`grid ${cols} bg-slate-200 p-2 font-bold`}>
                    <span>Descrição do Serviço</span>
                    {temDoc && <span>Nº Documento</span>}
                    <span>Valor</span>
                  </div>
                  <div className={`grid ${cols} p-3`}>
                    <span>{form.descricao_servico}</span>
                    {temDoc && <span>{form.numero_documento_anexo}</span>}
                    <strong>{moeda(valorNumerico(form.valor))}</strong>
                  </div>
                </div>
              );
            })()}

            {form.observacoes && (
              <div className="mt-5 border border-slate-200 p-3 text-xs">
                <p className="mb-2 text-[9px] font-bold uppercase text-slate-500">
                  Observações
                </p>
                <p className="whitespace-pre-wrap">{form.observacoes}</p>
              </div>
            )}

            <div className="mt-5 border-t border-slate-200 pt-4 text-center">
              <p className="mb-4 text-[9px] font-semibold italic leading-relaxed text-slate-600">
                Este recibo é emitido em caráter condicional, sendo sua
                validade e eficácia jurídica condicionadas à regular
                compensação do valor total
              </p>
              <p className="mb-2 text-[10px] text-slate-600">
                {dataPorExtenso(form.data_emissao)}
              </p>
              <img
                src={assinaturaRecibo}
                alt="Assinatura"
                className="mx-auto h-12 w-auto"
              />
              <p className="text-xs font-semibold">Rolffe de Lima Erbe</p>
              <p className="text-[10px] text-slate-500">Gestor Responsável</p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewAberta(false)}
                className="h-9 text-xs"
              >
                Voltar e editar
              </Button>
              <Button
                type="button"
                onClick={emitir}
                disabled={salvando}
                className="h-9 text-xs"
              >
                {salvando ? "Salvando..." : "Confirmar e emitir"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pdfPreviewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-1 backdrop-blur-md sm:p-4">
          <div className="flex h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl ring-1 ring-black/30 sm:h-[min(760px,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900/95 px-3 py-2.5 text-white backdrop-blur sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold tracking-wide">
                  Pré-visualização do recibo
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">
                  {pdfPreviewNome}
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:bg-white/10 sm:inline-flex"
                >
                  <ExternalLink size={13} /> Abrir em nova aba
                </a>
                <a
                  href={pdfPreviewUrl}
                  download={pdfPreviewNome}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                >
                  <Download size={13} /> Salvar PDF
                </a>
                <Button
                  type="button"
                  variant="outline"
                  onClick={fecharPdfPreview}
                  className="h-9 gap-1.5 border-white/15 bg-white/5 px-3 text-[11px] font-bold text-white hover:bg-white/10 hover:text-white"
                >
                  <X size={14} /> Fechar
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-950/90 p-1 sm:p-3">
              <iframe
                src={pdfPreviewUrl}
                title="Pré-visualização do PDF"
                className="h-full min-h-0 w-full rounded-xl bg-white shadow-xl"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-900 px-3 py-2 sm:px-5">
              <p className="hidden text-[11px] text-slate-400 sm:block">
                {reciboPdfPreview ? "PDF salvo. Continue para o envio e rateio." : "Pré-visualização do recibo"}
              </p>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fecharPdfPreview}
                  className="h-9 gap-1.5 border-white/15 bg-white/5 px-3 text-[11px] font-bold text-white hover:bg-white/10 hover:text-white"
                >
                  <X size={14} /> Fechar
                </Button>
                {reciboPdfPreview && (
                  <Button
                    type="button"
                    onClick={continuarFluxoPdf}
                    className="h-9 gap-1.5 px-3 text-[11px] font-bold"
                  >
                    Continuar para envio e rateio <ArrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  obrigatorio,
  className,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-[11px] ${className || ""}`}>
      <span className="mb-1 flex items-center gap-1 font-bold text-muted-foreground">
        {label} {obrigatorio && <sup className="text-primary">*</sup>}
      </span>
      {children}
    </label>
  );
}
