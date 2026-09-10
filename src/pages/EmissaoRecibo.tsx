import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  History,
  Paperclip,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import HistoricoRecibos, {
  type FiltrosHistoricoRecibos,
} from "@/components/financeiro-share/HistoricoRecibos";
import ProgramarContaAPagarDialog from "@/components/financeiro-share/ProgramarContaAPagarDialog";
import { EnviarEmailClienteDialog } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import ImportarDemonstrativoIA from "@/components/dashboard/financeiro/ImportarDemonstrativoIA";
import { useToast } from "@/hooks/use-toast";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";
import { IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import {
  buscarOpcoesRecibos,
  buscarRecibos,
  carregarArquivoColaborador,
  cancelarRecibo,
  confirmarReembolsoRecibo,
  criarRecibo,
  enviarAnexoRecibo,
  enviarPdfRecibo,
  atualizarStatusRecibo,
  type OpcoesRecibos,
  type Recibo as ReciboFinanceiro,
} from "@/lib/colaborador-api";

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

  // pagador (coluna real da tabela)
  pagador_tipo: "empresa" | "cotista_aeronave";
  pagador_id: string;

  // recebedor (única coluna real é recebedor_nome)
  recebedor_nome: string;

  // --- Campos AUXILIARES DE UI, só para montar o PDF impresso.
  // Não existem na tabela `recibos` e NÃO são enviados no payload.
  recebedor_cpf_ui: string;
  recebedor_endereco_ui: string;
  recebedor_cidade_ui: string;
  recebedor_uf_ui: string;

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
};

const hoje = () => new Date().toISOString().slice(0, 10);

const inicial = (): Formulario => ({
  tipo: null,
  natureza_despesa: "",
  colaborador_id: "",
  aeronave_id: "",
  pagador_tipo: "empresa",
  pagador_id: "",
  recebedor_nome: "",
  recebedor_cpf_ui: "",
  recebedor_endereco_ui: "",
  recebedor_cidade_ui: "",
  recebedor_uf_ui: "",
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
  const limpo = valor.trim();
  return (
    Number(
      limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo,
    ) || 0
  );
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
  return form.pagador_tipo === "cotista_aeronave" ? "cliente" : "share";
}

function caminhoPdfRecibo(recibo: ReciboFinanceiro) {
  if (recibo.pdf_anexo_id)
    return `/api/financeiro/recibos/anexos/${encodeURIComponent(recibo.pdf_anexo_id)}/arquivo`;
  const pdfPersistido = recibo.pdf_url || recibo.url_recibo;
  if (!pdfPersistido) return "";
  try {
    const url = new URL(pdfPersistido, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return pdfPersistido;
  }
}

// Gera o PDF a partir de um recibo já persistido. Usa apenas colunas reais
// da tabela (nome_pagador, documento_pagador, endereco_pagador,
// cidade_pagador, uf_pagador, recebedor_nome) — não depende de nenhum campo
// inexistente no banco.
async function gerarPdfRecibo(
  recibo: ReciboFinanceiro,
  colaborador?: OpcoesRecibos["colaboradores"][number],
) {
  const ehReembolso = recibo.tipo_recibo === "recibo_reembolso";
  const ehColaborador = recibo.tipo_recibo === "recibo_colaborador";
  const ehPagamento = recibo.tipo_recibo === "recibo_pagamento";

  const nomeColaborador =
    colaborador?.nome_completo || recibo.recebedor_nome || "";
  const documentoColaborador = colaborador?.cpf || "";

  const blob = await gerarReciboPdf({
    numero: recibo.numero_recibo,
    valor: Number(recibo.valor || 0) / 100,
    descricao: [
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
      ? undefined
      : recibo.documento_pagador
        ? `CNPJ/CPF: ${recibo.documento_pagador}`
        : null,
    pagadorEndereco: ehPagamento ? undefined : recibo.endereco_pagador,
    pagadorCidade: ehPagamento ? undefined : recibo.cidade_pagador,
    pagadorUf: ehPagamento ? undefined : recibo.uf_pagador,
  });

  return new File(
    [blob],
    `${String(recibo.numero_recibo || recibo.id).replace(/[^a-z0-9-]/gi, "-")}.pdf`,
    { type: "application/pdf" },
  );
}

export default function EmissaoRecibo({ aoVoltar }: { aoVoltar: () => void }) {
  const [form, setForm] = useState<Formulario>(inicial);
  const [opcoes, setOpcoes] = useState<OpcoesRecibos>({
    clientes: [],
    colaboradores: [],
    aeronaves: [],
    cotistas: [],
    categorias: [],
    categorias_cliente: [],
    recebedores: [],
  });
  const [recibos, setRecibos] = useState<ReciboFinanceiro[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"emissao" | "historico">("emissao");
  const [leitorDemonstrativoAberto, setLeitorDemonstrativoAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [previewAberta, setPreviewAberta] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
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
  const [modalEmail, setModalEmail] = useState(false);
  const { toast } = useToast();

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

  // Cotistas filtrados pela aeronave escolhida. Usado tanto no reembolso
  // (obrigatório) quanto, opcionalmente, como referência no pagamento.
  const cotistasDaAeronave = useMemo(
    () =>
      form.aeronave_id
        ? opcoes.cotistas.filter(
            (item) => item.aeronave_id === form.aeronave_id,
          )
        : [],
    [form.aeronave_id, opcoes.cotistas],
  );

  const valorReciboCentavos = Math.round(valorNumerico(form.valor) * 100);
  const tipoSelecionado = opcoesTipo.find((item) => item.id === form.tipo);
  const pagadorSelecionado = opcoes.cotistas.find(
    (item) => item.id === form.pagador_id,
  );
  const categoriaClienteSelecionada = opcoes.categorias_cliente.find(
    (item) => item.id === form.categoria_id,
  );
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
  };

  // Seleciona o cotista devedor no reembolso: preenche pagador_tipo/id e já
  // deixa os dados denormalizados prontos (nome/documento/endereço), que são
  // as colunas reais nome_pagador/documento_pagador/endereco_pagador/etc.
  const selecionarCotistaDevedor = (id: string) => {
    alterar("pagador_tipo", "cotista_aeronave");
    alterar("pagador_id", id);
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
                form.aeronave_id &&
                  form.pagador_id &&
                  form.pagador_tipo === "cotista_aeronave",
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
    let caminho = caminhoPdfRecibo(recibo);
    setErro("");
    setPdfAbrindoId(recibo.id);
    try {
      if (!caminho) {
        const colaborador = opcoes.colaboradores.find(
          (item) => item.id === recibo.colaborador_id,
        );
        const pdf = await gerarPdfRecibo(recibo, colaborador);
        const salvo = await enviarPdfRecibo(recibo.id, pdf);
        caminho = `/api/financeiro/recibos/anexos/${encodeURIComponent(salvo.anexo_id)}/arquivo`;
        setRecibos((atual) =>
          atual.map((item) =>
            item.id === recibo.id
              ? { ...item, pdf_anexo_id: salvo.anexo_id, pdf_url: salvo.pdf_url }
              : item,
          ),
        );
      }
      const blob = await carregarArquivoColaborador(caminho);
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return url;
      });
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
                pagador_tipo: "cotista_aeronave" as const,
                pagador_id: form.pagador_id,
                nome_pagador: pagadorSelecionado?.nome || "",
                documento_pagador:
                  pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "",
                endereco_pagador: pagadorSelecionado?.endereco || "",
                cidade_pagador: pagadorSelecionado?.cidade || "",
                uf_pagador: pagadorSelecionado?.uf || "",
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
                  pagador_tipo: "cotista_aeronave" as const,
                  pagador_id: form.pagador_id,
                  nome_pagador: pagadorSelecionado?.nome || "",
                  documento_pagador:
                    pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "",
                  endereco_pagador: pagadorSelecionado?.endereco || "",
                  cidade_pagador: pagadorSelecionado?.cidade || "",
                  uf_pagador: pagadorSelecionado?.uf || "",
                };

      // Recebedor conforme a regra fixa de cada tipo. Só existe a coluna
      // recebedor_nome — CPF/endereço do recebedor, quando coletados no
      // formulário (recibo_pagamento), servem só para montar o PDF, não são
      // persistidos.
      const recebedorNome =
        form.tipo === "recibo_reembolso"
          ? SHARE_NOME
          : form.tipo === "recibo_colaborador"
            ? colaboradorSelecionado?.nome_completo ||
              colaboradorSelecionado?.nome_exibicao ||
              ""
            : form.recebedor_nome.trim();

      // Payload enviado para criarRecibo — 1:1 com as colunas de `recibos`
      // que fazem sentido virem do cliente. numero_recibo, status,
      // lancamento_id, criado_por, criado_em e url_recibo são geridos pelo
      // backend e não são enviados aqui.
      const payload = {
        tipo_recibo: form.tipo,
        colaborador_id:
          form.tipo === "recibo_colaborador" ? form.colaborador_id : null,
        aeronave_id:
          form.tipo === "recibo_reembolso"
            ? form.aeronave_id
            : form.tipo === "recibo_colaborador" &&
                form.natureza_despesa === "aeronave"
              ? form.aeronave_id
              : null,
        rateado: false as const,
        ...dadosPagador,
        valor_centavos: valorReciboCentavos,
        descricao: form.descricao_servico.trim(),
        data_emissao: form.data_emissao,
        data_vencimento: form.data_vencimento || null,
        forma_pagamento:
          form.tipo === "recibo_pagamento"
            ? form.forma_pagamento || null
            : null,
        tipo_caixa: tipoCaixaPara(form),
        categoria_movimentacao_id: form.categoria_id,
        categoria_nome: form.categoria_nome || null,
        grupo_categoria:
          form.tipo === "recibo_colaborador"
            ? form.natureza_despesa === "aeronave"
              ? "DESPESAS REEMBOLSÁVEIS"
              : "DESPESAS EMPRESA"
            : null,
        recebedor_nome: recebedorNome,
        numero_documento_anexo: arquivo
          ? form.numero_documento_anexo.trim() || null
          : null,
        observacoes: form.observacoes.trim() || null,
      };

      const resposta = await criarRecibo(payload);

      setEstadoEmissao("CRIADO");
      setRecibos((atual) => [
        { ...resposta.recibo, status: "CRIADO" },
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
        const pdf = await gerarPdfRecibo(
          resposta.recibo,
          colaboradorSelecionado,
        );
        const pdfSalvo = await enviarPdfRecibo(resposta.recibo.id, pdf);
        resposta.recibo.pdf_url = pdfSalvo.pdf_url;
        resposta.recibo.pdf_anexo_id = pdfSalvo.anexo_id;
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
                ...resposta.recibo,
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

  const programarEmail = (recibo: ReciboFinanceiro) => {
    setReciboEmail(recibo);
    if (String(recibo.status).toUpperCase() === "EMAIL_ENVIADO") setReciboProgramacao(recibo);
    else setModalEmail(true);
  };

  const emailEnviado = async () => {
    if (!reciboEmail) return;
    try {
      await atualizarStatusRecibo(reciboEmail.id, "EMAIL_ENVIADO");
      const atualizado = { ...reciboEmail, status: "EMAIL_ENVIADO" as const };
      setRecibos((atual) => atual.map((item) => item.id === reciboEmail.id ? atualizado : item));
      setModalEmail(false);
      setReciboProgramacao(atualizado);
      toast({ title: "E-mail enviado", description: "O recibo foi marcado como enviado. Agora informe o rateio para programar as contas a pagar." });
    } catch (cause) {
      toast({ title: "E-mail enviado, mas status não atualizado", description: cause instanceof Error ? cause.message : "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="route-enter mx-auto max-w-6xl space-y-5">
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
        />
      )}

      <EnviarEmailClienteDialog
        open={modalEmail}
        onOpenChange={setModalEmail}
        onSent={() => void emailEnviado()}
        assuntoSugerido={reciboEmail ? `Recibo ${reciboEmail.numero_recibo}` : ""}
        mensagemSugerida={reciboEmail ? `Olá,\n\nSegue o recibo ${reciboEmail.numero_recibo} em anexo.` : ""}
        anexos={reciboEmail?.pdf_anexo_id ? [{ id: reciboEmail.pdf_anexo_id, label: `Recibo ${reciboEmail.numero_recibo}.pdf` }] : []}
      />
      <ProgramarContaAPagarDialog
        open={Boolean(reciboProgramacao)}
        recibo={reciboProgramacao}
        aeronaves={opcoes.aeronaves}
        categorias={opcoes.categorias_cliente}
        onOpenChange={(aberto) => { if (!aberto) setReciboProgramacao(null); }}
        onSaved={() => toast({ title: "Contas a pagar programadas", description: "O lançamento do recibo continua vinculado e o rateio foi gravado." })}
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
                    <Campo label="RECEBEDOR (nome)" obrigatorio>
                      <input
                        value={form.recebedor_nome}
                        onChange={(e) =>
                          alterar("recebedor_nome", e.target.value)
                        }
                        placeholder="Nome de quem vai receber"
                        className="campo"
                      />
                    </Campo>
                    {/* CPF/endereço do recebedor: só usados para o PDF
                        impresso, não existem como coluna em `recibos` e por
                        isso não entram no payload de criação. */}
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
                    <Campo label="Aeronave da despesa" obrigatorio>
                      <SearchableCombobox
                        items={opcoes.aeronaves.map((aeronave) => ({
                          id: aeronave.id,
                          label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}`,
                        }))}
                        value={form.aeronave_id}
                        onChange={(id) => {
                          alterar("aeronave_id", id);
                          alterar("pagador_id", "");
                          alterar("pagador_tipo", "empresa");
                        }}
                        placeholder="Selecione a aeronave"
                        searchPlaceholder="Buscar aeronave..."
                        emptyMessage="Nenhuma aeronave encontrada."
                      />
                    </Campo>
                    <Campo
                      label="Cotista devedor (quem vai pagar o reembolso)"
                      obrigatorio
                    >
                      <SearchableCombobox
                        items={cotistasDaAeronave.map((cotista) => ({
                          id: cotista.id,
                          label: `${cotista.nome}${cotista.codigo_cliente ? ` · ${cotista.codigo_cliente}` : ""}`,
                        }))}
                        value={form.pagador_id}
                        onChange={selecionarCotistaDevedor}
                        placeholder={
                          form.aeronave_id
                            ? "Selecione o cotista"
                            : "Selecione a aeronave primeiro"
                        }
                        searchPlaceholder="Buscar cotista..."
                        emptyMessage="Nenhum cotista encontrado para esta aeronave."
                      />
                    </Campo>
                    {form.pagador_id && (
                      <div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3 md:col-span-2">
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">
                          DADOS DO PAGADOR
                        </p>
                        <p className="mt-1 text-[11px] font-semibold">
                          {pagadorSelecionado?.nome || "Cotista"} ·{" "}
                          {pagadorSelecionado?.cnpj ||
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
                            alterar("pagador_tipo", "cotista_aeronave");
                            alterar("pagador_id", id);
                          }
                        }}
                        placeholder="Selecione o pagador"
                        searchPlaceholder="Buscar cotista..."
                        emptyMessage="Nenhum cotista encontrado."
                      />
                    </Campo>
                    <div className="rounded-sm border border-primary/30 bg-primary/[.06] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">
                        DADOS DO PAGADOR
                      </p>
                      <p className="mt-1 text-[11px] font-semibold">
                        {form.pagador_tipo === "cotista_aeronave"
                          ? `${pagadorSelecionado?.nome || "Cotista"} · ${pagadorSelecionado?.cnpj || pagadorSelecionado?.cpf || "Documento não informado"}`
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
                      }}
                      placeholder="Selecione a categoria cliente"
                      searchPlaceholder="Buscar categoria cliente..."
                      emptyMessage="Nenhuma categoria cliente cadastrada."
                    />
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
                    <Campo label="Categoria" obrigatorio>
                      <SearchableCombobox
                        items={opcoes.categorias.map((item) => ({
                          id: item.id,
                          label: item.nome,
                        }))}
                        value={form.categoria_id}
                        onChange={selecionaCategoria}
                        placeholder="Selecione a categoria"
                        searchPlaceholder="Buscar categoria..."
                        emptyMessage="Nenhuma categoria cadastrada."
                      />
                    </Campo>
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
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
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
          onCancel={() => setLeitorDemonstrativoAberto(false)}
          onCreated={async () => {
            await carregar();
            setLeitorDemonstrativoAberto(false);
            setAbaAtiva("historico");
          }}
        />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <p className="text-[11px] font-bold text-slate-700">
                Recibo — PDF
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  <ExternalLink size={13} /> Abrir em nova aba
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPdfPreviewUrl((atual) => {
                      if (atual) URL.revokeObjectURL(atual);
                      return "";
                    })
                  }
                  className="h-7 px-2 text-[10px]"
                >
                  Fechar
                </Button>
              </div>
            </div>
            <iframe
              src={pdfPreviewUrl}
              title="Pré-visualização do PDF"
              className="h-[80vh] w-full"
            />
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
