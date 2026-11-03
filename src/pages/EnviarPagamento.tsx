import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, HandCoins, History, Info, Landmark, Loader2, Mail, MapPin, Plus, Send, Smartphone, Users, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { HistoricoEnvios } from "@/components/envio-pagamento/historico/HistoricoEnvios";
import { usePaginaHistorico } from "@/components/envio-pagamento/historico/usePaginaHistorico";
import AnexosDinamicosField, { type AnexoLinha } from "@/components/ui/AnexosDinamicosField";
import logoShare from "@/assets/share-signature-logo.png";
import { registrarEmailEnvioPagamento, converterEnvioPagamento, buscarCentralEmail, buscarContasBancariasEmail, buscarEnviosPagamento, buscarMinhaAssinatura, buscarOpcoesEnvioPagamento, buscarOpcoesAnexosEnvioPagamento, buscarCotistasAeronave, criarEnvioPagamento, criarFornecedorCombustivel, criarFornecedorFavorito, enviarAnexoEnvioPagamento, enviarEmailCliente, buscarRascunhosEnvioPagamento, buscarRascunhoEnvioPagamento, excluirRascunhoEnvioPagamento, salvarRascunhoEnvioPagamento, type RascunhoEnvioPagamento, type DestinatarioRascunhoEnvio, type AssinaturaEmail, type ContaBancariaEmail, type ContatoEmail, type EnvioPagamento, type OpcaoEnvioPagamento, type OpcoesAnexosEnvioPagamento, type CotistaAeronave, buscarDespesasOrigemEnvio, type OrigemDespesaEnvio, type DespesaOrigemEnvio } from "@/lib/colaborador-api";
import { allocateCentavos, parseReaisToCentavos } from "@/lib/money";

type TipoEnvio = EnvioPagamento["tipo"];
type Categoria = "FOLHA DE PAGAMENTO" | "DESPESAS EMPRESA" | "DESPESAS EMPRESA-BANCO" | "DESPESAS PARTICULARES" | "IMPOSTOS" | "RECEITAS OPERACIONAIS" | "CAIXA CLIENTE" | "DESPESAS REEMBOLSÁVEIS" | "REEMBOLSOS ENTRADAS";
type Formulario = {
  descricao: string;
  valor: string;
  data_despesa: string;
  vencimento: string;
  periodicidade: "ÚNICO" | "EVENTUAL" | "MENSAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
  fornecedor: string;
  cliente_id: string;
  socio_id: string;
  cotista_ids: string[];
  fornecedor_id: string;
  categoria_id: string;
  categoria_nome: string;
  email_solicitado: boolean;
  aeronave_id: string;
  numero_voo: string;
  centro_custo: string;
  subcategoria_1: string;
  subcategoria_2: string;
  subcategoria_3: string;
  subcategoria_4: string;
  tipo_rateio: "FIXO" | "VARIAVEL POR VOO" | "VARIAVEL POR HORA" | "EXTRA";
  rateio_linhas: Array<{ cotista_id: string; percentual: string; valor_centavos?: number }>;
  observacoes: string;
  grupo_categoria: Categoria;
  tipo_despesa: "fixo" | "variável";
  pago_por: string;
  anexos: AnexoLinha[];
};
type OpcaoEnvio = {
  tipo: TipoEnvio;
  titulo: string;
  resumo: string;
  detalhe?: string;
  pagador: string;
  destino: string;
  regra: string;
  icon: typeof WalletCards;
  cor: string;
};
type ArquivoPersistidoEmail = { key: string; url: string; filename: string; content_type: string; cotista_id?: string };
type RateioDuplicado = { id: string; tabela: string; data_vencimento?: string | null; categoria_nome?: string | null; valor_total_centavos?: number; documento_url?: string | null; numero_nf?: string | null; numero_recibo?: string | null; numero_boleto?: string | null; numero_demonstrativo?: string | null; numero_voo?: string | null; url_nf?: string | null; url_recibo?: string | null; url_boleto?: string | null; url_demonstrativo?: string | null; url_doc?: string | null };

function anexoAplicaAoCotista(anexo: AnexoLinha, cotistaId: string) {
  return !anexo.cotista_id || anexo.cotista_id === cotistaId;
}

function notificarEnvioCliente(tipo: "success" | "error" | "warning", mensagem: string) {
  const opcoes = {
    duration: 5000,
    position: "top-center" as const,
    richColors: true,
    style: {
      position: "fixed" as const,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      margin: 0,
      zIndex: 10000,
    },
  };
  if (tipo === "success") toast.success(mensagem, opcoes);
  else if (tipo === "warning") toast.warning(mensagem, opcoes);
  else toast.error(mensagem, opcoes);
}

// Data local (evita virar o dia seguinte à noite por causa do UTC)
const hoje = () => new Date().toLocaleDateString("en-CA");
const inicial: Formulario = {
  descricao: "",
  valor: "",
  data_despesa: hoje(),
  vencimento: "",
  periodicidade: "ÚNICO",
  fornecedor: "",
  cliente_id: "",
  socio_id: "",
  cotista_ids: [],
  fornecedor_id: "",
  categoria_id: "",
  categoria_nome: "",
  email_solicitado: false,
  aeronave_id: "",
  numero_voo: "",
  centro_custo: "",
  subcategoria_1: "",
  subcategoria_2: "",
  subcategoria_3: "",
  subcategoria_4: "",
  tipo_rateio: "FIXO",
  rateio_linhas: [],
  observacoes: "",
  grupo_categoria: "DESPESAS EMPRESA",
  tipo_despesa: "variável",
  pago_por: "",
  anexos: [],
};

const opcoes: OpcaoEnvio[] = [
  {
    tipo: "share",
    titulo: "Envio de pagamento para o caixa Share",
    resumo: "Caixa Share",
    detalhe: "Despesa da própria Share (luz, compras, administrativo).",
    pagador: "Share Brasil",
    destino: "Caixa Share",
    regra: "Não gera rateio",
    icon: WalletCards,
    cor: "text-primary",
  },
  {
    tipo: "reembolso",
    titulo: "Envio despesa cliente com reembolso",
    resumo: "Share antecipa",
    detalhe: "A Share paga adiantado e cobra o reembolso.",
    pagador: "Share Brasil",
    destino: "Caixa Share + rateio",
    regra: "Cliente reembolsa depois",
    icon: HandCoins,
    cor: "text-amber-500",
  },
  {
    tipo: "cliente",
    titulo: "Envio cliente direto",
    resumo: "Cliente paga direto",
    detalhe: "Despesa paga pelo caixa do cliente.",
    pagador: "Cliente / sócio",
    destino: "Caixa Cliente + rateio",
    regra: "Pago diretamente",
    icon: Users,
    cor: "text-[#7ed321]",
  },
];
const periodicidades = ["ÚNICO", "EVENTUAL", "MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;

const normalizarStatus = (status?: string | null) => String(status || "").toLowerCase();
const statusChaveConvertido = (status?: string | null) => normalizarStatus(status) === "convertido";

function dataBr(valor?: string | null) {
  return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

function quantidadeAnexosFonte(item: any, origem: "recibos" | "relatorios" | "abastecimentos") {
  const quantidadeInformada = Number(item.quantidade_anexos || 0);
  if (quantidadeInformada > 0) return quantidadeInformada;
  if (origem === "abastecimentos") return [item.comanda_url, item.nota_url, item.boleto_url].filter(Boolean).length;
  return Number(Boolean(item.anexo_id && item.arquivo_url));
}

function formatarValor(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

function lerArrayPersistido(valor: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(valor)) return valor.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (typeof valor !== "string" || !valor.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function converterValor(valor: string) {
  return parseReaisToCentavos(valor) / 100;
}

function rateioProporcional(cotistaIds: string[], cotistas: CotistaAeronave[]) {
  // Usa o percentual_sociedade real da tabela cotista_aeronave, sem arredondar:
  // os centavos do rateio dependem da precisão integral do percentual.
  const percentuais = cotistaIds.map((id) => Number(cotistas.find((cotista) => cotista.id === id)?.percentual_sociedade || 0));
  const somaSociedade = percentuais.reduce((total, percentual) => total + percentual, 0);
  return cotistaIds.map((cotistaId, index) => ({
    cotista_id: cotistaId,
    percentual: somaSociedade > 0
      ? String(percentuais[index] / somaSociedade * 100)
      : String(100 / (cotistaIds.length || 1)),
  }));
}

export default function EnviarPagamento({ apenasCaixaShare = false }: { apenasCaixaShare?: boolean }) {
  const [tipo, setTipo] = useState<TipoEnvio | null>(null);
  const [form, setForm] = useState<Formulario>(inicial);
  const [envios, setEnvios] = useState<EnvioPagamento[]>([]);
  const [dadosOpcoes, setDadosOpcoes] = useState<OpcaoEnvioPagamento>({ fornecedores: [], fornecedores_combustivel: [], aeronaves: [], voos: [], categorias: [], categorias_cliente: [] });
  const [cotistas, setCotistas] = useState<CotistaAeronave[]>([]);
  const [origemDespesa, setOrigemDespesa] = useState<OrigemDespesaEnvio | "">("");
  const [vincularDespesaExistente, setVincularDespesaExistente] = useState(false);
  const [despesasOrigem, setDespesasOrigem] = useState<DespesaOrigemEnvio[]>([]);
  const [carregandoOrigem, setCarregandoOrigem] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [rascunhos, setRascunhos] = useState<RascunhoEnvioPagamento[]>([]);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const [chaveRascunho, setChaveRascunho] = useState<string | null>(null);
  const [statusSalvamento, setStatusSalvamento] = useState<"ocioso" | "salvando" | "salvo" | "erro">("ocioso");
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [restaurandoRascunho, setRestaurandoRascunho] = useState(false);
  const [envioEmRestauracaoId, setEnvioEmRestauracaoId] = useState<string | null>(null);
  const [rascunhoConcluido, setRascunhoConcluido] = useState(false);
  const [convertendoEnvioId, setConvertendoEnvioId] = useState<string | null>(null);
  const [rascunhoParaExcluir, setRascunhoParaExcluir] = useState<RascunhoEnvioPagamento | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [vincularAeronave, setVincularAeronave] = useState<boolean | null>(null);
  const [modoNumeroVooCliente, setModoNumeroVooCliente] = useState<"com_voo" | "sem_voo" | null>(null);
  const opcoesVisiveis = apenasCaixaShare ? opcoes.filter((opcao) => opcao.tipo !== "cliente") : opcoes;
  const { historico, abrirHistorico, fecharHistorico } = usePaginaHistorico();
  const [erroHistorico, setErroHistorico] = useState("");
  const [abrindoHistorico, setAbrindoHistorico] = useState(false);
  const [excluindoRascunhoId, setExcluindoRascunhoId] = useState<string | null>(null);
  const rascunhosVisiveis = useMemo(
    () => rascunhos.filter((item) => !["CONCLUIDO", "CANCELADO", "EXCLUIDO"].includes(item.status.toUpperCase()) && (!apenasCaixaShare || item.tipo_envio !== "cliente")),
    [rascunhos, apenasCaixaShare],
  );
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const anexos = form.anexos;
  const [fontesAnexos, setFontesAnexos] = useState<OpcoesAnexosEnvioPagamento>({ recibos: [], relatorios: [], abastecimentos: [] });
  const [dialogoAnexos, setDialogoAnexos] = useState(false);
  const [origemAnexo, setOrigemAnexo] = useState<"recibos" | "relatorios" | "abastecimentos">("recibos");
  const [dialogoFornecedor, setDialogoFornecedor] = useState(false);
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);
  const [buscaAnexo, setBuscaAnexo] = useState("");

  const [envioRecemCriado, setEnvioRecemCriado] = useState<EnvioPagamento | null>(null);
  const [envioConvertido, setEnvioConvertido] = useState(false);
  const [modalEmail, setModalEmail] = useState(false);
  const [rateiosDuplicados, setRateiosDuplicados] = useState<RateioDuplicado[]>([]);
  const confirmarDuplicidadeRef = useRef(false);
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [assinaturaEmail, setAssinaturaEmail] = useState<AssinaturaEmail | null>(null);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaEmail[]>([]);
  const [bancoSelecionado, setBancoSelecionado] = useState<ContaBancariaEmail | null>(null);
  const [buscaContato, setBuscaContato] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nomeDestinatario, setNomeDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoEmail, setCorpoEmail] = useState("");
  const [anexosSelecionados, setAnexosSelecionados] = useState<string[]>([]);
  const [arquivosNovos, setArquivosNovos] = useState<File[]>([]);
  const [arquivosPersistidos, setArquivosPersistidos] = useState<ArquivoPersistidoEmail[]>([]);
  const [anexosEnvioEmail, setAnexosEnvioEmail] = useState<AnexoLinha[]>([]);
  const [cotistasEmail, setCotistasEmail] = useState<CotistaAeronave[]>([]);
  const [emailsPorCotista, setEmailsPorCotista] = useState<Record<string, string>>({});
  const [rascunhosEmailPorCotista, setRascunhosEmailPorCotista] = useState<Record<string, { assunto: string; mensagem: string }>>({});
  const [emailsEnviados, setEmailsEnviados] = useState<string[]>([]);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState("");
  const [sucessoEmail, setSucessoEmail] = useState("");
  const [carregandoEmail, setCarregandoEmail] = useState(false);
  const [statusEmailCotista, setStatusEmailCotista] = useState<Record<string, string>>({});
  const chaveRascunhoRef = useRef<string | null>(null);
  const filaSalvamento = useRef<Promise<void>>(Promise.resolve());
  const rascunhosExcluidosRef = useRef(new Set<string>());

  const carregarOpcoes = async () => {
    try {
      const [dadosFinanceiros, fontes] = await Promise.all([buscarOpcoesEnvioPagamento(), buscarOpcoesAnexosEnvioPagamento()]);
      setDadosOpcoes(dadosFinanceiros);
      setFontesAnexos(fontes);
    } catch {
      setErro("Não foi possível carregar as opções financeiras.");
    }
  };

  const carregarCotistas = async (aeronaveId: string) => {
    if (!aeronaveId) {
      setCotistas([]);
      return;
    }
    try {
      const dados = await buscarCotistasAeronave(aeronaveId);
      setCotistas(dados.cotistas);
    } catch {
      setErro("Não foi possível carregar os cotistas da aeronave.");
    }
  };

  const carregar = async () => {
    setCarregando(true);
    setErroHistorico("");
    try {
      const [respostas, rascunhosResposta] = await Promise.all([
        apenasCaixaShare ? Promise.all([buscarEnviosPagamento("share"), buscarEnviosPagamento("reembolso")]) : Promise.all([buscarEnviosPagamento()]),
        buscarRascunhosEnvioPagamento(),
      ]);
      setEnvios(respostas.flatMap((resposta) => resposta.envios).sort((a, b) => (b.criado_em || "").localeCompare(a.criado_em || "")));
      setRascunhos(rascunhosResposta.rascunhos);
    } catch {
      setErroHistorico("Não foi possível carregar os envios de pagamento. Tente novamente.");
      setErro("Não foi possível carregar os envios de pagamento.");
    } finally {
      setCarregando(false);
    }
  };

  const garantirIdentidadeRascunho = () => {
    const id = rascunhoId || crypto.randomUUID();
    const chave = chaveRascunhoRef.current || chaveRascunho || crypto.randomUUID();
    chaveRascunhoRef.current = chave;
    if (!rascunhoId) setRascunhoId(id);
    if (!chaveRascunho) setChaveRascunho(chave);
    return { id, chave };
  };

  const construirDadosRascunho = (formAtual = form) => ({
    form: { ...formAtual, anexos: formAtual.anexos.map(({ file: _file, uploading: _uploading, ...anexo }) => anexo) },
    vincularAeronave,
    modoNumeroVooCliente,
    origemDespesa,
    vincularDespesaExistente,
    envioId: envioRecemCriado?.id || null,
    envioConvertido,
    assunto,
    corpoEmail,
    destinatario,
    nomeDestinatario,
    anexosSelecionados,
    anexosEnvioEmail: anexosEnvioEmail.map(({ file: _file, uploading: _uploading, ...anexo }) => anexo),
    arquivosPersistidos,
    cotistasEmail,
    emailsPorCotista,
    rascunhosEmailPorCotista,
    statusEmailCotista,
  });

  const persistirRascunho = async (opcoes: { dados?: Record<string, unknown>; envioId?: string | null; status?: string; etapa?: number } = {}) => {
    const tipoRascunho = tipo || envioRecemCriado?.tipo;
    if (!tipoRascunho) return;
    const { id, chave } = garantirIdentidadeRascunho();
    if (rascunhosExcluidosRef.current.has(id)) return;
    const statusRascunho = opcoes.status ?? (rascunhoConcluido ? "CONCLUIDO" : envioRecemCriado && envioRecemCriado.tipo !== "share" ? "EMAIL_PENDENTE" : "PREENCHIMENTO");
    setStatusSalvamento("salvando");
    const gravacao = filaSalvamento.current.then(async () => {
      if (rascunhosExcluidosRef.current.has(id)) return null;
      const resultado = await salvarRascunhoEnvioPagamento({
        id,
        tipo_envio: tipoRascunho,
        etapa_atual: opcoes.etapa ?? etapa,
        dados: opcoes.dados ?? construirDadosRascunho(),
        idempotency_key: chave,
        envio_id: opcoes.envioId === undefined ? envioRecemCriado?.id || null : opcoes.envioId,
        status: statusRascunho,
        destinatarios: cotistasEmail.filter((cotista) => anexosEnvioEmail.some((anexo) => anexoAplicaAoCotista(anexo, cotista.id))).map((cotista) => cotista.id),
      });
      return resultado;
    });
    filaSalvamento.current = gravacao.then(() => undefined, () => undefined);
    try {
      const resultado = await gravacao;
      if (!resultado) return;
      setStatusSalvamento("salvo");
      setSalvoEm(resultado.atualizado_em);
      setRascunhos((atuais) => {
        if (opcoes.status === "CONCLUIDO") return atuais.filter((rascunho) => rascunho.id !== id);
        const existente = atuais.find((rascunho) => rascunho.id === id);
        const atualizado: RascunhoEnvioPagamento = {
          id, tipo_envio: tipoRascunho, etapa_atual: opcoes.etapa ?? etapa,
          dados_json: JSON.stringify(opcoes.dados ?? construirDadosRascunho()), idempotency_key: chave,
          envio_id: opcoes.envioId === undefined ? envioRecemCriado?.id || null : opcoes.envioId,
          status: statusRascunho, atualizado_em: resultado.atualizado_em,
        };
        return [atualizado, ...atuais.filter((rascunho) => rascunho.id !== id && rascunho.status !== "CONCLUIDO")].map((rascunho) => existente?.id === rascunho.id ? atualizado : rascunho);
      });
    } catch (cause) {
      setStatusSalvamento("erro");
      throw cause;
    }
  };

  const abrirPaginaHistorico = async () => {
    if (abrindoHistorico || salvando || enviandoEmail || restaurandoRascunho) return;
    setAbrindoHistorico(true);
    try {
      if ((tipo || envioRecemCriado) && !rascunhoConcluido) await persistirRascunho();
      await filaSalvamento.current;
      abrirHistorico();
      void carregar();
    } catch {
      toast.error("Não foi possível salvar o preenchimento atual. Tente abrir o histórico novamente.");
    } finally {
      setAbrindoHistorico(false);
    }
  };

  const atualizarStatusLocal = (id: string, status: string) =>
    setEnvios((atual) => atual.map((envio) => (envio.id === id ? ({ ...envio, status } as EnvioPagamento) : envio)));

  const recuperarConversao = async (envio: EnvioPagamento) => {
    setConvertendoEnvioId(envio.id);
    try {
      await converterEnvioPagamento(envio.id);
      await carregar();
      toast.success("Rateio da despesa do cliente criado.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível criar o rateio da despesa.");
    } finally {
      setConvertendoEnvioId(null);
    }
  };

  const carregarContatosEmail = async () => {
    setCarregandoEmail(true);
    setErroEmail("");
    try {
      const [dados, assinatura, bancos] = await Promise.all([buscarCentralEmail(), buscarMinhaAssinatura(), buscarContasBancariasEmail()]);
      setContatos(dados.contatos);
      setAssinaturaEmail(assinatura);
      setContasBancarias(bancos.contas);
    } catch {
      setErroEmail("Não foi possível carregar os contatos de e-mail.");
    } finally {
      setCarregandoEmail(false);
    }
  };

  useEffect(() => { void carregar(); void carregarOpcoes(); }, []);

  const salvarAoSairRef = useRef<() => void>(() => undefined);
  salvarAoSairRef.current = () => {
    if ((!tipo && !envioRecemCriado) || rascunhoConcluido || restaurandoRascunho) return;
    void persistirRascunho().catch(() => toast.error("Não foi possível salvar o rascunho."));
  };
  useEffect(() => () => salvarAoSairRef.current(), []);

  useEffect(() => { void carregarCotistas(form.aeronave_id); }, [form.aeronave_id]);

  const selecionada = opcoes.find((opcao) => opcao.tipo === tipo) ?? null;
  const valorInformado = converterValor(form.valor);
  const valorCentavos = parseReaisToCentavos(form.valor);
  const uploadsPendentes = form.anexos.some((anexo) => anexo.uploading);
  const exigeCliente = tipo !== null && tipo !== "share";
  const cotistasSelecionados = cotistas.filter((c) => form.cotista_ids.includes(c.id));
  const categoriaSelecionada = dadosOpcoes.categorias_cliente.find((categoria) => categoria.id === form.categoria_id);
  const subcategorias = [categoriaSelecionada?.subcategoria_1, categoriaSelecionada?.subcategoria_2, categoriaSelecionada?.subcategoria_3, categoriaSelecionada?.subcategoria_4].filter((item): item is string => Boolean(item));
  const anexosEncontrados = useMemo(() => {
    const registros: any[] = origemAnexo === "recibos"
      ? fontesAnexos.recibos
      : origemAnexo === "relatorios"
        ? fontesAnexos.relatorios
        : fontesAnexos.abastecimentos;
    const termo = buscaAnexo.trim().toLowerCase();
    return registros
      .filter((item) => quantidadeAnexosFonte(item, origemAnexo) > 0)
      .filter((item) => !termo || JSON.stringify(item).toLowerCase().includes(termo));
  }, [buscaAnexo, fontesAnexos, origemAnexo]);
  const exigeDadosAeronave = exigeCliente || (tipo === "share" && vincularAeronave === true);
  const totalEtapas = 3;
  const progresso = ((etapa + 1) / (totalEtapas + 1)) * 100;
  const tituloEtapa = etapa === 1 ? (tipo === "share" && !exigeDadosAeronave ? "Vinculação da aeronave" : tipo === "cliente" ? "Aeronave, cotistas e valor" : "Aeronave, voo e rateio") : etapa === 2 ? "Dados da despesa" : "Revisão e envio";
  const alterar = (campo: keyof Formulario, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const alterarPercentual = (cotistaId: string, bruto: string) => setForm((atual) => {
    const percentual = bruto.replace(",", ".");
    const linhas = atual.cotista_ids.map((id) => id === cotistaId
      ? { cotista_id: id, percentual }
      : atual.rateio_linhas.find((linha) => linha.cotista_id === id) || { cotista_id: id, percentual: "0" });
    return { ...atual, rateio_linhas: linhas };
  });

  const atualizarSelecaoCotistas = (id: string) => setForm((atual) => {
    const todosSelecionados = atual.cotista_ids.length === cotistas.length && cotistas.length > 0;
    const ids = id === "__todos__"
      ? (todosSelecionados ? [] : cotistas.map((cotista) => cotista.id))
      : atual.cotista_ids.includes(id)
        ? atual.cotista_ids.filter((cotistaId) => cotistaId !== id)
        : [...atual.cotista_ids, id];
    const linhas = rateioProporcional(ids, cotistas);
    return { ...atual, cotista_ids: ids, rateio_linhas: linhas };
  });

  const montarRateioLinhas = () => {
    const linhas = form.rateio_linhas.map((linha) => ({
      cotista_id: linha.cotista_id,
      percentual: Number(linha.percentual) || 0,
      percentual_sociedade: Number(cotistas.find((cotista) => cotista.id === linha.cotista_id)?.percentual_sociedade || 0),
    })).filter((linha) => linha.percentual > 0);
    return allocateCentavos(valorCentavos, linhas.map((linha) => linha.percentual)).map((valor, index) => ({ ...linhas[index], valor_centavos: valor }));
  };
  const linhasAlocadas = montarRateioLinhas();

  const validarRateio = () => {
    if (!exigeCliente) return true;
    if (!form.aeronave_id) return false;
    const idsValidos = new Set(cotistas.map((cotista) => cotista.id));
    const linhas = montarRateioLinhas();
    const percentuaisInformados = form.rateio_linhas.map((linha) => Number(linha.percentual));
    const percentual = percentuaisInformados.reduce((total, item) => total + (Number.isFinite(item) ? item : 0), 0);
    const valor = linhas.reduce((total, linha) => total + linha.valor_centavos, 0);
    const anexosValidos = tipo !== "cliente" || form.anexos.every((anexo) => Boolean(anexo.cotista_id) && idsValidos.has(anexo.cotista_id!));
    const percentuaisValidos = percentuaisInformados.every((item) => Number.isFinite(item) && item >= 0 && item <= 100);
    return linhas.length > 0 && linhas.every((linha) => idsValidos.has(linha.cotista_id)) && percentuaisValidos && anexosValidos && Math.abs(percentual - 100) < 0.01 && valor === valorCentavos;
  };

  const contatosFiltrados = useMemo(() => {
    const termo = buscaContato.trim().toLowerCase();
    return !termo ? contatos : contatos.filter((item) => `${item.nome} ${item.email} ${item.tipo}`.toLowerCase().includes(termo));
  }, [buscaContato, contatos]);

  const montarCorpoEmail = (envio: EnvioPagamento) => {
    const linhas = [
      `Descrição: ${envio.descricao}`,
      `Valor: ${formatarValor(Number(envio.valor))}`,
      `Data da despesa: ${dataBr(envio.data_despesa)}`,
      envio.vencimento ? `Vencimento: ${dataBr(envio.vencimento)}` : "",
      envio.fornecedor ? `Fornecedor: ${envio.fornecedor}` : "",
      envio.cliente_id ? `Cliente: ${envio.cliente_id}` : "",
      envio.aeronave_id ? `Aeronave: ${envio.aeronave_id}` : "",
      envio.observacoes ? `Observações: ${envio.observacoes}` : "",
    ].filter(Boolean);
    return `Prezado(a),\n\nSegue solicitação de pagamento:\n\n${linhas.join("\n")}\n\nAtenciosamente,\nShare Brasil`;
  };

  const salvarNovoFornecedor = async (tipoFornecedor: "favorito" | "combustivel") => {
    const nome = form.fornecedor.trim();
    if (!nome || salvandoFornecedor) return;
    setSalvandoFornecedor(true);
    try {
      if (tipoFornecedor === "favorito") {
        const { item } = await criarFornecedorFavorito(nome);
        const label = String(item?.apelido || item?.nome_completo || nome);
        setDadosOpcoes((atual) => ({ ...atual, fornecedores: [{ id: String(item?.id), label }, ...atual.fornecedores] }));
        setForm((atual) => ({ ...atual, fornecedor_id: String(item?.id), fornecedor: label }));
        notificarEnvioCliente("success", "Fornecedor favorito salvo com sucesso.");
      } else {
        const { item } = await criarFornecedorCombustivel(nome);
        const nomeFornecedor = String(item?.nome_fornecedor || nome);
        setDadosOpcoes((atual) => ({ ...atual, fornecedores_combustivel: [{ ...(item ?? {}), id: String(item?.id), nome_fornecedor: nomeFornecedor }, ...atual.fornecedores_combustivel] }));
        setForm((atual) => ({ ...atual, fornecedor_id: String(item?.id), fornecedor: nomeFornecedor }));
        notificarEnvioCliente("success", "Fornecedor de combustível salvo com sucesso.");
      }
      setDialogoFornecedor(false);
    } catch (error) {
      notificarEnvioCliente("error", error instanceof Error ? error.message : "Erro ao salvar fornecedor.");
    } finally {
      setSalvandoFornecedor(false);
    }
  };

  const marcarModo = (novoTipo: TipoEnvio) => {
    setErro("");
    setMensagem("");
    if (tipo === novoTipo) {
      setTipo(null);
      setModoNumeroVooCliente(null);
      return;
    }
    setModoNumeroVooCliente(null);
    setTipo(novoTipo);
    const novoId = crypto.randomUUID();
    const novaChave = crypto.randomUUID();
    setRascunhoId(novoId);
    setChaveRascunho(novaChave);
    chaveRascunhoRef.current = novaChave;
    setStatusSalvamento("ocioso");
    setSalvoEm(null);
    setRascunhoConcluido(false);
    setVincularAeronave(novoTipo === "share" ? null : true);
    setForm({
      ...inicial,
      data_despesa: hoje(),
      grupo_categoria: novoTipo === "cliente" ? "CAIXA CLIENTE" : novoTipo === "reembolso" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA",
    });
  };

  const continuarRascunho = async (resumo: RascunhoEnvioPagamento) => {
    setRestaurandoRascunho(true);
    try {
      const { rascunho, destinatarios } = await buscarRascunhoEnvioPagamento(resumo.id);
      const dados = JSON.parse(rascunho.dados_json || "{}") as Record<string, any>;
      const formSalvo = dados.form as Formulario;
      if (!formSalvo) throw new Error("O formulário salvo está incompleto.");
      const envioId = String(dados.envioId || rascunho.envio_id || "") || null;
      let envioSalvo: EnvioPagamento | null = null;
      if (envioId) {
        const resposta = await buscarEnviosPagamento();
        envioSalvo = resposta.envios.find((envio) => envio.id === envioId) || null;
        if (!envioSalvo) throw new Error("A solicitação vinculada ao rascunho não foi encontrada.");
      }
      setTipo(rascunho.tipo_envio);
      setEtapa(rascunho.etapa_atual);
      setForm({ ...formSalvo, anexos: (formSalvo.anexos || []).map((anexo) => ({ ...anexo, file: null, uploading: false })) });
      setVincularAeronave(dados.vincularAeronave ?? null);
      setModoNumeroVooCliente(dados.modoNumeroVooCliente ?? null);
      setOrigemDespesa(dados.origemDespesa || "");
      setVincularDespesaExistente(dados.vincularDespesaExistente ?? Boolean(dados.origemDespesa));
      setEnvioRecemCriado(envioSalvo ? { ...envioSalvo, tipo: rascunho.tipo_envio } : null);
      setEnvioConvertido(Boolean(dados.envioConvertido));
      setAssunto(dados.assunto || "");
      setCorpoEmail(dados.corpoEmail || "");
      setDestinatario(dados.destinatario || "");
      setNomeDestinatario(dados.nomeDestinatario || "");
      setAnexosSelecionados(dados.anexosSelecionados || []);
      setAnexosEnvioEmail((dados.anexosEnvioEmail || []).map((anexo: AnexoLinha) => ({ ...anexo, file: null, uploading: false })));
      setArquivosPersistidos(dados.arquivosPersistidos || []);
      setArquivosNovos([]);
      const cotistasSalvos = dados.cotistasEmail || [];
      setCotistasEmail(cotistasSalvos);
      setCotistas(cotistasSalvos);
      setEmailsPorCotista(dados.emailsPorCotista || {});
      setRascunhosEmailPorCotista(dados.rascunhosEmailPorCotista || {});
      setStatusEmailCotista(Object.fromEntries(destinatarios.map((destinatario: DestinatarioRascunhoEnvio) => [destinatario.cotista_id, destinatario.status])));
      setEmailsEnviados(destinatarios.filter((destinatario: DestinatarioRascunhoEnvio) => destinatario.status === "ENVIADO").map((destinatario: DestinatarioRascunhoEnvio) => destinatario.cotista_id));
      setRascunhoConcluido(rascunho.status === "CONCLUIDO");
      setRascunhoId(rascunho.id);
      setChaveRascunho(rascunho.idempotency_key);
      chaveRascunhoRef.current = rascunho.idempotency_key;
      setSalvoEm(rascunho.atualizado_em);
      setStatusSalvamento("salvo");
      setErro("");
      setMensagem("");
      setVincularDespesaExistente(false);
      setOrigemDespesa("");
      setDespesasOrigem([]);
      setModalEmail(false);
      fecharHistorico();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível abrir o rascunho.");
    } finally {
      setRestaurandoRascunho(false);
    }
  };

  const excluirRascunho = async (rascunho: RascunhoEnvioPagamento) => {
    if (excluindoRascunhoId) return;
    setExcluindoRascunhoId(rascunho.id);
    rascunhosExcluidosRef.current.add(rascunho.id);
    try {
      await filaSalvamento.current;
      await excluirRascunhoEnvioPagamento(rascunho.id);
      setRascunhos((atuais) => atuais.filter((item) => item.id !== rascunho.id));
      if (rascunhoId === rascunho.id) {
        setTipo(null);
        setEnvioRecemCriado(null);
        setEnvioConvertido(false);
        setModalEmail(false);
        setRascunhoId(null);
        setChaveRascunho(null);
        chaveRascunhoRef.current = null;
        setRascunhoConcluido(false);
        setStatusSalvamento("ocioso");
      }
      setRascunhoParaExcluir(null);
      toast.success("Rascunho excluído.");
    } catch (cause) {
      rascunhosExcluidosRef.current.delete(rascunho.id);
      toast.error(cause instanceof Error ? cause.message : "Não foi possível excluir o rascunho.");
    } finally {
      setExcluindoRascunhoId(null);
    }
  };

  const retomarEnvioHistorico = async (envio: EnvioPagamento) => {
    if (envioEmRestauracaoId) return;
    setEnvioEmRestauracaoId(envio.id);
    try {
      const { rascunhos: rascunhosAtuais } = await buscarRascunhosEnvioPagamento();
      setRascunhos(rascunhosAtuais);
      const rascunho = rascunhosAtuais.find((item) => item.envio_id === envio.id && item.status.toUpperCase() !== "CONCLUIDO");
      if (rascunho) {
        await continuarRascunho(rascunho);
        return;
      }

      const registro = envio as EnvioPagamento & Record<string, unknown>;
      const rateioSalvo = lerArrayPersistido(registro.rateio_linhas_json ?? registro.rateio_linhas);
      const anexosSalvos = lerArrayPersistido(registro.anexos_json ?? registro.anexos);
      const cotistaIds = rateioSalvo.map((linha) => String(linha.cotista_id || "")).filter(Boolean);
      if (!cotistaIds.length && registro.cotista_aeronave_id) cotistaIds.push(String(registro.cotista_aeronave_id));
      const anexosRestaurados: AnexoLinha[] = anexosSalvos.map((anexo, index) => ({
        id: String(anexo.id || `anexo-${envio.id}-${index}`),
        tipo: String(anexo.tipo || "outro") as AnexoLinha["tipo"],
        numero: String(anexo.numero || ""),
        url: typeof anexo.url === "string" ? anexo.url : null,
        file: null,
        cotista_id: typeof anexo.cotista_id === "string" ? anexo.cotista_id : cotistaIds.length === 1 ? cotistaIds[0] : undefined,
        uploading: false,
      }));
      const valor = Number(envio.valor || 0);
      const dataDespesa = String(envio.data_despesa || hoje()).slice(0, 10);
      const formRestaurado: Formulario = {
        ...inicial,
        descricao: String(envio.descricao || ""),
        valor: Number.isFinite(valor) ? valor.toFixed(2).replace(".", ",") : "",
        data_despesa: dataDespesa,
        vencimento: String(envio.data_vencimento || envio.vencimento || "").slice(0, 10),
        periodicidade: String(envio.periodicidade || "ÚNICO") as Formulario["periodicidade"],
        fornecedor: String(envio.fornecedor || ""),
        cliente_id: String(registro.cliente_id || ""),
        socio_id: String(registro.socio_id || ""),
        cotista_ids: cotistaIds,
        fornecedor_id: String(envio.fornecedor_id || ""),
        categoria_id: String(envio.categoria_id || registro.categoria_cliente_id || ""),
        categoria_nome: String(envio.categoria_nome || ""),
        aeronave_id: String(envio.aeronave_id || ""),
        numero_voo: String(envio.numero_voo || ""),
        centro_custo: String(envio.centro_custo || ""),
        subcategoria_1: String(registro.subcategoria_1 || ""),
        subcategoria_2: String(registro.subcategoria_2 || ""),
        subcategoria_3: String(registro.subcategoria_3 || ""),
        subcategoria_4: String(registro.subcategoria_4 || ""),
        tipo_rateio: String(registro.tipo_rateio || "FIXO") as Formulario["tipo_rateio"],
        rateio_linhas: rateioSalvo.map((linha) => ({ cotista_id: String(linha.cotista_id || ""), percentual: String(Number(linha.percentual || 0)), valor_centavos: Number(linha.valor_centavos || 0) })),
        observacoes: String(envio.observacoes || ""),
        grupo_categoria: String(envio.grupo_categoria || (envio.tipo === "cliente" ? "CAIXA CLIENTE" : envio.tipo === "reembolso" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA")) as Categoria,
        tipo_despesa: envio.tipo_despesa === "fixo" ? "fixo" : "variável",
        pago_por: String(envio.pago_por || ""),
        anexos: anexosRestaurados,
      };

      setTipo(envio.tipo);
      setEtapa(Math.min(1, totalEtapas));
      setForm(formRestaurado);
      setVincularAeronave(Boolean(formRestaurado.aeronave_id));
      setModoNumeroVooCliente(envio.tipo === "cliente" ? (formRestaurado.numero_voo ? "com_voo" : "sem_voo") : null);
      setOrigemDespesa("");
      setEnvioRecemCriado(envio);
      setEnvioConvertido(Boolean(envio.lancamento_id) || statusChaveConvertido(envio.status));
      setRascunhoId(null);
      setChaveRascunho(null);
      chaveRascunhoRef.current = null;
      setRascunhoConcluido(false);
      setModalEmail(false);
      setAssunto(`Solicitação de pagamento — ${envio.descricao}`);
      setCorpoEmail(montarCorpoEmail(envio));
      setAnexosEnvioEmail(anexosRestaurados);
      setAnexosSelecionados(anexosRestaurados.map((anexo) => anexo.id));
      setCotistasEmail([]);
      setEmailsPorCotista({});
      setRascunhosEmailPorCotista({});
      setStatusEmailCotista({});
      setEmailsEnviados([]);
      setCotistas([]);
      setErro("");
      setMensagem("Dados do envio selecionado restaurados. Revise as etapas antes de continuar.");
      if (formRestaurado.aeronave_id) {
        const respostaCotistas = await buscarCotistasAeronave(formRestaurado.aeronave_id);
        setCotistas(respostaCotistas.cotistas);
        const idsSelecionados = new Set(cotistaIds);
        const cotistasSelecionadosSalvos = respostaCotistas.cotistas.filter((cotista) => idsSelecionados.has(cotista.id));
        setCotistasEmail(cotistasSelecionadosSalvos);
        setEmailsPorCotista(Object.fromEntries(cotistasSelecionadosSalvos.map((cotista) => [cotista.id, cotista.email || ""])));
        setRascunhosEmailPorCotista(Object.fromEntries(cotistasSelecionadosSalvos.map((cotista) => [cotista.id, { assunto: `Solicitação de pagamento — ${envio.descricao} — ${cotista.nome}`, mensagem: `Olá, ${cotista.nome}.\n\nEncaminho os documentos referentes à despesa “${envio.descricao}”.\n\nAtenciosamente, Share Brasil` }])));
      }
      fecharHistorico();
      toast.success("Envio pendente aberto com os dados salvos.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível retomar o envio pendente.");
    } finally {
      setEnvioEmRestauracaoId(null);
    }
  };

  const trocarModo = () => {
    setEtapa(0);
    setTipo(null);
    setModoNumeroVooCliente(null);
    setVincularAeronave(null);
    setVincularDespesaExistente(false);
    setOrigemDespesa("");
    setDespesasOrigem([]);
    setErro("");
  };

  const selecionarVoo = (numeroVoo: string) => {
    const voo = dadosOpcoes.voos.find((item) => item.numero_voo === numeroVoo);
    setForm((atual) => {
      const aeronaveMudou = Boolean(voo?.aeronave_id && voo.aeronave_id !== atual.aeronave_id);
      return {
        ...atual,
        numero_voo: numeroVoo,
        aeronave_id: voo?.aeronave_id || atual.aeronave_id,
        cotista_ids: aeronaveMudou ? [] : atual.cotista_ids,
        rateio_linhas: aeronaveMudou ? [] : atual.rateio_linhas,
      };
    });
  };

  const selecionarAeronaveCliente = (aeronaveId: string) => {
    setOrigemDespesa("");
    setDespesasOrigem([]);
    setCotistas([]);
    setModoNumeroVooCliente(null);
    setForm((atual) => ({ ...atual, aeronave_id: aeronaveId, numero_voo: "", cotista_ids: [], rateio_linhas: [], valor: "", fornecedor: "", fornecedor_id: "", categoria_id: "", categoria_nome: "", anexos: [] }));
  };

  const selecionarModoNumeroVooCliente = (modo: "com_voo" | "sem_voo") => {
    setModoNumeroVooCliente(modo);
    setOrigemDespesa("");
    setDespesasOrigem([]);
    setForm((atual) => ({ ...atual, numero_voo: "", cotista_ids: [], rateio_linhas: [], anexos: [] }));
    if (modo === "sem_voo" && form.aeronave_id) void carregarCotistas(form.aeronave_id);
    else setCotistas([]);
  };

  const selecionarVooCliente = async (numeroVoo: string) => {
    setOrigemDespesa("");
    setDespesasOrigem([]);
    setForm((atual) => ({ ...atual, numero_voo: numeroVoo, cotista_ids: [], rateio_linhas: [], valor: "", fornecedor: "", fornecedor_id: "", categoria_id: "", categoria_nome: "", anexos: [] }));
    if (!numeroVoo || !form.aeronave_id) return;
    try {
      const resposta = await buscarCotistasAeronave(form.aeronave_id);
      const cotistasVoo = resposta.cotistas;
      setCotistas(cotistasVoo);
      const cotistaIds = cotistasVoo.map((cotista) => cotista.id);
      setForm((atual) => ({ ...atual, cotista_ids: cotistaIds, rateio_linhas: rateioProporcional(cotistaIds, cotistasVoo) }));
    } catch {
      setErro("Não foi possível carregar os cotistas da aeronave.");
    }
  };

  const selecionarOrigemDespesa = async (origem: OrigemDespesaEnvio | "") => {
    setOrigemDespesa(origem);
    setDespesasOrigem([]);
    if (!origem || !form.aeronave_id) return;
    setCarregandoOrigem(true);
    try {
      const resposta = await buscarDespesasOrigemEnvio(form.aeronave_id, form.numero_voo || undefined, origem);
      setDespesasOrigem(resposta.registros);
      if (!resposta.registros.length) toast.info(`Não há despesas dessa origem para ${form.numero_voo ? "este voo e " : ""}esta aeronave.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível buscar as despesas da origem.");
    } finally {
      setCarregandoOrigem(false);
    }
  };

  const selecionarDespesaOrigem = (id: string) => {
    const item = despesasOrigem.find((despesa) => despesa.id === id);
    if (!item) return;
    const urls: Array<{ key: keyof DespesaOrigemEnvio; tipo: AnexoLinha["tipo"]; numero?: string | null }> = [
      { key: "url_demonstrativo", tipo: "demonstrativo" }, { key: "url_nf", tipo: "nf", numero: item.numero_nf },
      { key: "url_recibo", tipo: "recibo", numero: item.numero_recibo }, { key: "url_boleto", tipo: "boleto" }, { key: "url_doc", tipo: "outro" },
      { key: "comanda_url", tipo: "comanda", numero: item.numero_comanda }, { key: "nota_url", tipo: "nf", numero: item.numero_nf }, { key: "boleto_url", tipo: "boleto" },
      { key: "pdf_url", tipo: "demonstrativo", numero: item.numero_relatorio },
    ];
    const documentos: AnexoLinha[] = urls.flatMap(({ key, tipo: anexoTipo, numero }) => {
      const url = item[key];
      return typeof url === "string" && url ? [{ id: crypto.randomUUID(), tipo: anexoTipo, numero: numero || "", url, file: null }] : [];
    });
    const categoria = dadosOpcoes.categorias_cliente.find((opcao) => opcao.nome.toLocaleLowerCase() === String(item.grupo_categoria || item.categoria_nome || "").toLocaleLowerCase());
    const gruposValidos: Categoria[] = ["FOLHA DE PAGAMENTO", "DESPESAS EMPRESA", "DESPESAS EMPRESA-BANCO", "DESPESAS PARTICULARES", "IMPOSTOS", "RECEITAS OPERACIONAIS", "CAIXA CLIENTE", "DESPESAS REEMBOLSÁVEIS", "REEMBOLSOS ENTRADAS"];
    setForm((atual) => ({ ...atual, descricao: String(item.descricao || (origemDespesa === "ABASTECIMENTO" ? "Abastecimento" : origemDespesa === "RECIBOS" ? "Recibo" : "Despesa de viagem")), valor: item.valor == null ? atual.valor : Number(item.valor).toFixed(2).replace(".", ","), data_despesa: item.data_despesa?.slice(0, 10) || atual.data_despesa, fornecedor: item.fornecedor || atual.fornecedor, fornecedor_id: "", categoria_id: categoria?.id || atual.categoria_id, categoria_nome: categoria?.nome || item.categoria_nome || atual.categoria_nome, grupo_categoria: gruposValidos.includes(item.grupo_categoria as Categoria) ? item.grupo_categoria as Categoria : atual.grupo_categoria, anexos: documentos.length ? documentos : atual.anexos }));
  };

  const podeAvancar = () => {
    if (etapa === 0) return Boolean(tipo);
    if (etapa === 1) {
      const dadosDeRateioValidos = !exigeDadosAeronave || Boolean(form.aeronave_id && form.cotista_ids.length && (tipo === "share" || validarRateio()));
      const valorDiretoValido = tipo !== "cliente" || valorInformado > 0;
      const modoVooValido = (tipo !== "cliente" && tipo !== "reembolso") || Boolean(modoNumeroVooCliente);
      return (tipo !== "share" || vincularAeronave !== null) && dadosDeRateioValidos && valorDiretoValido && modoVooValido;
    }
    if (etapa === 2) return Boolean(form.descricao.trim() && valorInformado > 0 && (tipo === "share" ? Boolean(form.vencimento) : true));
    // Etapa final: revalida valor, rateio e vínculo dos anexos com os cotistas
    return valorInformado > 0 && validarRateio();
  };

  const proxima = async () => {
    setErro("");
    if (!podeAvancar()) {
      setErro(etapa === 0 ? "Marque um modo de solicitação para continuar." : etapa === 1 ? (tipo === "share" && vincularAeronave === null ? "Informe se deseja vincular uma aeronave à despesa." : (tipo === "cliente" || tipo === "reembolso") && !modoNumeroVooCliente ? "Selecione se a despesa terá número de voo." : tipo === "cliente" && form.aeronave_id && form.cotista_ids.length && valorInformado <= 0 ? "Informe o valor da despesa depois de selecionar a aeronave e os cotistas." : "Selecione a aeronave e pelo menos um cotista.") : "Informe descrição e valor da despesa.");
      return;
    }
    const proximaEtapa = Math.min(totalEtapas, etapa + 1);
    setEtapa(proximaEtapa);
    if (tipo) await persistirRascunho({ etapa: proximaEtapa }).catch(() => toast.error("Não foi possível salvar o rascunho."));
  };

  const anterior = async () => {
    setErro("");
    const etapaAnterior = Math.max(0, etapa - 1);
    setEtapa(etapaAnterior);
    if (tipo) await persistirRascunho({ etapa: etapaAnterior }).catch(() => toast.error("Não foi possível salvar o rascunho."));
  };

  const enviar = async () => {
    if (envioRecemCriado) {
      if (envioRecemCriado.tipo === "share") {
        toast.info("Esta solicitação já foi registrada e permanece pendente de aprovação. Nenhum novo envio foi criado.");
        return;
      }
      setModalEmail(true);
      if (!contatos.length) void carregarContatosEmail();
      return;
    }
    if (!tipo || !podeAvancar()) {
      setErro("Revise os campos obrigatórios antes de criar o lançamento. Anexos sem cotista selecionado serão compartilhados com todos os cotistas da aeronave.");
      return;
    }
    if (uploadsPendentes) {
      setErro("Aguarde a conclusão do envio de todos os anexos antes de programar a despesa.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const { id: idRascunho, chave: idempotency_key } = garantirIdentidadeRascunho();
      await persistirRascunho({ etapa: totalEtapas, status: "PREENCHIMENTO" });
      const payload = tipo === "share" ? {
        idempotency_key,
        tipo, descricao: form.descricao, valor_centavos: valorCentavos, data_despesa: form.data_despesa, data_vencimento: form.vencimento,
        fornecedor: form.fornecedor, fornecedor_id: form.fornecedor_id, categoria_id: form.categoria_id,
        categoria_nome: form.categoria_nome, grupo_categoria: "DESPESAS EMPRESA", periodicidade: form.periodicidade,
        aeronave_id: form.aeronave_id, ...(form.cotista_ids.length === 1 ? { cotista_aeronave_id: form.cotista_ids[0] } : {}),
        numero_voo: form.numero_voo, observacoes: form.observacoes, pago_por: form.pago_por || "share",
        anexos: form.anexos.map(({ id, tipo: anexoTipo, numero, url, cotista_id }) => ({ id, tipo: anexoTipo, numero, url, cotista_id })),
      } : {
        idempotency_key,
        tipo, descricao: form.descricao, valor_centavos: valorCentavos, data_despesa: form.data_despesa, data_vencimento: form.vencimento,
        cliente_id: "", socio_id: "", aeronave_id: form.aeronave_id, ...(form.cotista_ids.length === 1 ? { cotista_aeronave_id: form.cotista_ids[0] } : {}),
        numero_voo: form.numero_voo || null,
        fornecedor: form.fornecedor, fornecedor_id: form.fornecedor_id,
        categoria_id: form.categoria_id, categoria_cliente_id: tipo === "cliente" ? form.categoria_id : undefined, categoria_nome: form.categoria_nome, tipo_caixa: tipo === "cliente" ? "CLIENTE" : "SHARE", gera_rateio: exigeCliente, pago_diretamente: false,
        grupo_categoria: form.grupo_categoria, tipo_despesa: form.tipo_despesa,
        pago_por: tipo === "cliente" ? null : form.pago_por || "share", periodicidade: form.periodicidade,
        anexos: form.anexos.map(({ id, tipo: anexoTipo, numero, url, cotista_id }) => ({ id, tipo: anexoTipo, numero, url, cotista_id })),
        tipo_rateio: form.tipo_rateio,
        subcategoria_1: form.subcategoria_1,
        subcategoria_2: form.subcategoria_2,
        subcategoria_3: form.subcategoria_3,
        subcategoria_4: form.subcategoria_4,
        rateio_linhas: montarRateioLinhas(),
        ...(confirmarDuplicidadeRef.current ? { confirmar_duplicidade: true } : {}),
      };
      const registro = await criarEnvioPagamento(payload);
      confirmarDuplicidadeRef.current = false;
      setEnvios((atual) => [registro, ...atual]);
      setMensagem(exigeCliente ? "Solicitação registrada. Revise os destinatários e anexos por cotista." : "Lançamento criado corretamente em movimentações.");

      if (exigeCliente) {
        const cotistasParaEmail = form.anexos.some((anexo) => !anexo.cotista_id) ? cotistas : cotistasSelecionados;
        const emails = Object.fromEntries(cotistasParaEmail.map((cotista) => [
          cotista.id,
          cotista.email || contatos.find((contato) => contato.cliente_id === cotista.cliente_id)?.email || "",
        ]));
        const rascunhosEmail = Object.fromEntries(cotistasParaEmail.map((cotista) => [cotista.id, {
          assunto: `Documentos da despesa — ${form.descricao} — ${cotista.nome}`,
          mensagem: `Olá, ${cotista.nome}.\n\nEncaminho os documentos referentes à despesa “${form.descricao}”.\n\nAtenciosamente,\n${assinaturaEmail?.nome || "Share Brasil"}`,
        }]));
        setEnvioRecemCriado({ ...registro, tipo });
        setEnvioConvertido(false);
        setAssunto(`Solicitação de pagamento — ${registro.descricao}`);
        setCorpoEmail(montarCorpoEmail(registro));
        setAnexosSelecionados(form.anexos.map((anexo) => anexo.id).filter(Boolean));
        setArquivosNovos(form.anexos.map((anexo) => anexo.file).filter((arquivo): arquivo is File => Boolean(arquivo)));
        setAnexosEnvioEmail(form.anexos);
        setCotistasEmail(cotistasParaEmail);
        setEmailsPorCotista(emails);
        setRascunhosEmailPorCotista(rascunhosEmail);
        setEmailsEnviados([]);
        setStatusEmailCotista({});
        setDestinatario("");
        setNomeDestinatario("");
        setBancoSelecionado(null);
        const contatoInicial = contatos.find((c) => c.cliente_id === registro.cliente_id);
        if (contatoInicial) {
          setDestinatario(contatoInicial.email);
          setNomeDestinatario(contatoInicial.nome);
        }
        setModalEmail(true);
        if (contatos.length === 0) void carregarContatosEmail();
        await persistirRascunho({
          etapa: totalEtapas,
          envioId: registro.id,
          status: "EMAIL_PENDENTE",
          dados: {
            ...construirDadosRascunho(),
            envioId: registro.id,
            assunto: `Solicitação de pagamento — ${registro.descricao}`,
            corpoEmail: montarCorpoEmail(registro),
            anexosSelecionados: form.anexos.map((anexo) => anexo.id).filter(Boolean),
            anexosEnvioEmail: form.anexos.map(({ file: _file, uploading: _uploading, ...anexo }) => anexo),
            cotistasEmail: cotistasParaEmail,
            emailsPorCotista: emails,
            rascunhosEmailPorCotista: rascunhosEmail,
            statusEmailCotista: {},
          },
        });
      } else {
        await persistirRascunho({ etapa: totalEtapas, envioId: registro.id, status: "CONCLUIDO" });
      }

      setTipo(null);
      setEtapa(0);
    } catch (cause) {
      const duplicados = (cause as Error & { rateiosDuplicados?: RateioDuplicado[] }).rateiosDuplicados;
      if (duplicados?.length) {
        confirmarDuplicidadeRef.current = false;
        setRateiosDuplicados(duplicados);
        return;
      }
      confirmarDuplicidadeRef.current = false;
      setErro(cause instanceof Error ? cause.message : "Não foi possível criar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const fecharModalEmail = () => {
    setModalEmail(false);
    setErroEmail("");
    setSucessoEmail("");
  };

  const alternarAnexo = (id: string) => setAnexosSelecionados((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]);
  const adicionarArquivos = async (arquivos: File[]) => {
    try {
      const enviados = await Promise.all(arquivos.map(async (arquivo) => {
        const resultado = await enviarAnexoEnvioPagamento(arquivo, crypto.randomUUID());
        return { key: resultado.key, url: resultado.url, filename: arquivo.name, content_type: arquivo.type || "application/octet-stream" } satisfies ArquivoPersistidoEmail;
      }));
      setArquivosPersistidos((atuais) => [...atuais, ...enviados]);
      setArquivosNovos([]);
    } catch (cause) {
      setErroEmail(cause instanceof Error ? cause.message : "Não foi possível armazenar o anexo.");
    }
  };
  const removerArquivo = (index: number) => setArquivosNovos((atual) => atual.filter((_, i) => i !== index));
  const removerArquivoPersistido = (key: string) => setArquivosPersistidos((atuais) => atuais.filter((arquivo) => arquivo.key !== key));
  const selecionarFonteAnexo = (fonte: any) => {
    const cotistaIdPadrao = cotistasSelecionados.length === 1 ? cotistasSelecionados[0].id : undefined;
    const novos: AnexoLinha[] = origemAnexo === "recibos"
      ? (fonte.anexo_id && fonte.arquivo_url ? [{ id: `recibo:${fonte.anexo_id}`, tipo: "recibo", numero: fonte.numero_recibo || "", url: fonte.arquivo_url, file: null, cotista_id: cotistaIdPadrao }] : [])
      : origemAnexo === "relatorios"
        ? (fonte.anexo_id && fonte.arquivo_url ? [{ id: `relatorio_pdf:${fonte.anexo_id}`, tipo: "demonstrativo", numero: fonte.numero_relatorio || "", url: fonte.arquivo_url, file: null, cotista_id: cotistaIdPadrao }] : [])
        : (["comanda", "nota", "boleto"] as const)
          .filter((chave) => fonte[`${chave}_url`])
          .map((chave) => {
            const tipoAnexo = (chave === "nota" ? "nf" : chave) as AnexoLinha["tipo"];
            return {
              id: `abastecimento:${fonte.id}:${chave}`,
              tipo: tipoAnexo,
              numero: chave === "nota" ? fonte.numero_nf || "" : fonte.numero_comanda || fonte.numero_nf || "",
              url: fonte[`${chave}_url`],
              file: null,
              cotista_id: cotistaIdPadrao,
            } as AnexoLinha;
          });
    setForm((atual) => ({ ...atual, anexos: [...atual.anexos.filter((anexo) => !novos.some((novo) => novo.id === anexo.id)), ...novos] }));
    setDialogoAnexos(false);
    setBuscaAnexo("");
  };

  const dispararEmail = async (cotistaId?: string) => {
    const envioPorCotista = envioRecemCriado?.tipo === "cliente";
    const cotistaAlvo = envioPorCotista ? cotistasEmail.find((cotista) => cotista.id === cotistaId) : null;
    if (envioPorCotista && !cotistaAlvo) {
      setErroEmail("Selecione o cotista para este envio.");
      return;
    }
    const rascunhoCotista = cotistaAlvo ? rascunhosEmailPorCotista[cotistaAlvo.id] : null;
    const assuntoEnvio = rascunhoCotista?.assunto ?? assunto;
    const mensagemEnvio = rascunhoCotista?.mensagem ?? corpoEmail;
    if ((!envioPorCotista && !destinatario.trim()) || !assuntoEnvio.trim() || !mensagemEnvio.trim()) {
      setErroEmail("Informe destinatário, assunto e mensagem.");
      return;
    }
    setEnviandoEmail(true);
    setErroEmail("");
    setSucessoEmail("");
    const enviadosNestaSessao = new Set([...emailsEnviados, ...Object.entries(statusEmailCotista).filter(([, status]) => status === "ENVIADO").map(([id]) => id)]);
    const idRascunhoAtual = rascunhoId;
    const chaveRascunhoAtual = chaveRascunhoRef.current || chaveRascunho;
    let emailEnviadoNestaExecucao = false;
    try {
      const grupos = envioPorCotista
        ? [{ cotista: cotistaAlvo!, anexos: anexosEnvioEmail.filter((anexo) => anexoAplicaAoCotista(anexo, cotistaAlvo!.id) && anexosSelecionados.includes(anexo.id)) }]
        : [{ cotista: null, anexos: anexosEnvioEmail.filter((anexo) => anexosSelecionados.includes(anexo.id)) }];
      const gruposComAnexo = grupos.filter((grupo) => !envioPorCotista || grupo.anexos.length > 0);
      if (!gruposComAnexo.length) throw new Error("Selecione ao menos um documento para enviar a um cotista.");
      const email = (cotistaAlvo ? emailsPorCotista[cotistaAlvo.id] : destinatario).trim();
      if (!email) throw new Error(`Informe o e-mail de ${cotistaAlvo?.nome || "destino"}.`);
      if (envioPorCotista && envioRecemCriado && !envioConvertido) {
        await converterEnvioPagamento(envioRecemCriado.id);
        setEnvioConvertido(true);
        atualizarStatusLocal(envioRecemCriado.id, "CONVERTIDO");
      }
      for (const grupo of gruposComAnexo) {
        const chaveDestinatario = grupo.cotista?.id || "__principal__";
        if (enviadosNestaSessao.has(chaveDestinatario)) continue;
        setStatusEmailCotista((atual) => ({ ...atual, [chaveDestinatario]: "PROCESSANDO" }));
        await enviarEmailCliente({
          destinatarios: [email],
          assunto: assuntoEnvio.trim(),
          mensagem: mensagemEnvio.trim(),
          anexos: grupo.anexos.map((anexo) => anexo.id),
          referencias: envioRecemCriado ? [`envio_despesa:${envioRecemCriado.id}`] : undefined,
          rascunho_id: idRascunhoAtual || undefined,
          cotista_id: chaveDestinatario,
          idempotency_key: idRascunhoAtual && chaveRascunhoAtual ? `email:${idRascunhoAtual}:${chaveDestinatario}` : undefined,
          // No envio direto, os IDs são resolvidos no lançamento salvo. Reenviar
          // também os File locais ou persistidos anexaria cada documento duas vezes.
          arquivos: envioPorCotista ? [] : arquivosNovos,
          arquivos_persistidos: envioPorCotista ? [] : arquivosPersistidos.map(({ key, filename, content_type }) => ({ key, filename, content_type })),
          nome_destinatario: grupo.cotista?.nome || nomeDestinatario || undefined,
        });
        emailEnviadoNestaExecucao = true;
        enviadosNestaSessao.add(chaveDestinatario);
        setEmailsEnviados([...enviadosNestaSessao]);
        setStatusEmailCotista((atual) => ({ ...atual, [chaveDestinatario]: "ENVIADO" }));
      }
      const gruposSelecionados = envioPorCotista
        ? cotistasEmail.filter((cotista) => anexosEnvioEmail.some((anexo) => anexoAplicaAoCotista(anexo, cotista.id) && anexosSelecionados.includes(anexo.id)))
        : [];
      const todosEmailsCotistasEnviados = envioPorCotista && gruposSelecionados.length > 0 && gruposSelecionados.every((cotista) => enviadosNestaSessao.has(cotista.id));
      if (envioRecemCriado && (!envioPorCotista || todosEmailsCotistasEnviados)) {
        await registrarEmailEnvioPagamento(envioRecemCriado.id);
        if (envioRecemCriado.tipo === "reembolso") {
          await converterEnvioPagamento(envioRecemCriado.id);
          atualizarStatusLocal(envioRecemCriado.id, "CONVERTIDO");
        }
      }
      if (envioPorCotista && cotistaAlvo) {
        const todosConcluidos = gruposSelecionados.length > 0 && gruposSelecionados.every((cotista) => enviadosNestaSessao.has(cotista.id));
        if (todosConcluidos) setRascunhoConcluido(true);
        await persistirRascunho({ status: todosConcluidos ? "CONCLUIDO" : "EMAIL_PENDENTE", envioId: envioRecemCriado?.id });
        if (todosConcluidos) setRascunhos((atuais) => atuais.filter((rascunho) => rascunho.id !== idRascunhoAtual));
        if (todosConcluidos) {
          notificarEnvioCliente("success", `E-mail para ${cotistaAlvo.nome} enviado com sucesso. Todos os destinatários selecionados foram concluídos.`);
          fecharModalEmail();
        } else {
          setSucessoEmail(`E-mail para ${cotistaAlvo.nome} enviado. Ainda há destinatários pendentes.`);
        }
      } else {
        if (idRascunhoAtual) {
          setRascunhoConcluido(true);
          await persistirRascunho({ status: "CONCLUIDO", envioId: envioRecemCriado?.id });
          setRascunhos((atuais) => atuais.filter((rascunho) => rascunho.id !== idRascunhoAtual));
        }
        setSucessoEmail(envioRecemCriado?.tipo === "reembolso"
          ? "E-mail enviado. Lançamento e rateio criados."
          : "E-mail enviado com sucesso.");
        setMensagem("Lançamento criado e e-mail enviado ao cliente.");
        setTimeout(() => fecharModalEmail(), 1800);
      }
    } catch (cause) {
      setEmailsEnviados([...enviadosNestaSessao]);
      if (idRascunhoAtual) {
        try {
          const recuperado = await buscarRascunhoEnvioPagamento(idRascunhoAtual);
          setStatusEmailCotista(Object.fromEntries(recuperado.destinatarios.map((item) => [item.cotista_id, item.status])));
        } catch {
          setStatusEmailCotista((atual) => ({ ...atual, [cotistaId || "__principal__"]: "FALHOU" }));
        }
      } else {
        setStatusEmailCotista((atual) => ({ ...atual, [cotistaId || "__principal__"]: "FALHOU" }));
      }
      const mensagemErro = cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.";
      setErroEmail(mensagemErro);
      if (envioPorCotista) {
        if (emailEnviadoNestaExecucao) {
          notificarEnvioCliente("warning", `E-mail enviado para ${cotistaAlvo?.nome || "o cliente"}, mas não foi possível concluir a atualização do registro: ${mensagemErro}`);
        } else {
          notificarEnvioCliente("error", `Não foi possível enviar o e-mail${cotistaAlvo ? ` para ${cotistaAlvo.nome}` : ""}: ${mensagemErro}`);
        }
        fecharModalEmail();
      }
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className={`route-enter mx-auto min-h-[113px] min-w-0 w-full max-w-full ${historico ? "" : "space-y-3 px-3 py-2 sm:space-y-4 sm:px-4 sm:py-3 xl:max-w-[1280px]"}`}>
      {!historico && <>
      <header className="relative overflow-hidden rounded-2xl border border-[#1b2a3f] bg-[radial-gradient(ellipse_at_top_right,_rgba(56,189,248,.13),_transparent_48%),linear-gradient(135deg,#0b1422,#080d16_62%,#0b1523)] px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,.22)] sm:px-6 sm:py-4" style={{ backgroundColor: "rgb(16, 20, 39)" }}>
        <div className="relative z-10 max-w-3xl">
          <IndicadorPagina>Financeiro / Pagamentos</IndicadorPagina>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Programar pagamento</h1>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#1a2638] bg-[#060b14] shadow-[0_24px_60px_rgba(0,0,0,.42)]">
        <div className="flex items-center gap-3 border-b border-[#172235] bg-[#080e19] px-4 py-2.5 md:gap-5 md:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/[.09] text-primary"><ClipboardCheck size={15} /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-foreground">Fluxo de envio</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{etapa === 0 ? "Etapa 1 · Seleção do modo" : `Etapa ${etapa + 1} de ${totalEtapas + 1} · ${tituloEtapa}`}{statusSalvamento === "salvando" ? " · Salvando…" : statusSalvamento === "salvo" && salvoEm ? ` · Salvo às ${new Date(salvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : statusSalvamento === "erro" ? " · Falha ao salvar" : ""}</p>
          </div>
          <div
            className="ml-auto flex w-[38%] min-w-[90px] max-w-[440px] items-center"
            role="progressbar"
            aria-label={`Progresso: etapa ${etapa + 1}`}
            aria-valuenow={Math.round(progresso)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="block h-[3px] w-full bg-[#0d1727]"><span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${progresso}%` }} /></span>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-4 py-3 md:px-5 lg:py-2.5">
          {etapa === 0 && (
            <div className="flex flex-col gap-[12px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Modo da solicitação <sup className="text-primary">*</sup></p>
                <p className="mt-1 text-[11px] text-muted-foreground">Marque um modo. Para trocar, clique na opção ativa para desmarcá-la primeiro.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {opcoesVisiveis.map((opcao) => {
                  const ativo = tipo === opcao.tipo;
                  const Icon = opcao.icon;
                  return (
                    <button
                      type="button"
                      key={opcao.tipo}
                      onClick={() => marcarModo(opcao.tipo)}
                      aria-pressed={ativo}
                      className={`relative flex h-full w-full items-start gap-2 rounded-[10px] border px-3 py-2.5 pr-10 text-left transition-[background-color,border-color,box-shadow] xl:py-3 ${ativo ? "border-primary/65 bg-[#0d1a2d] shadow-[0_0_0_1px_hsl(var(--primary)/.12)]" : "border-[#182336] bg-[#070c15] hover:border-primary/35 hover:bg-[#0b1422]"}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}>
                        {ativo && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">{opcao.titulo}</span>
                        {opcao.detalhe && <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{opcao.detalhe}</span>}
                      </span>
                      <Icon size={16} aria-hidden="true" className={`absolute right-3 top-3 ${ativo ? opcao.cor : "text-muted-foreground"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {etapa > 0 && selecionada && (
            <div className="space-y-3 lg:space-y-2">
              <div className="rounded-sm border border-primary/30 bg-primary/[.07] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{selecionada.titulo}</span>
                  <button type="button" onClick={trocarModo} className="text-[11px] font-bold text-foreground underline-offset-4 hover:underline">Trocar modo</button>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{selecionada.detalhe}</p>
              </div>

              {etapa === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {tipo === "share" && <div className="rounded-sm border border-primary/25 bg-primary/[.05] p-3 sm:col-span-2">
                    <p className="text-[12px] font-bold text-foreground">Deseja vincular uma aeronave nessa despesa?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([true, false] as const).map((opcao) => <button key={String(opcao)} type="button" onClick={() => { setVincularAeronave(opcao); if (!opcao) { setForm((atual) => ({ ...atual, aeronave_id: "", cotista_ids: [], rateio_linhas: [], numero_voo: "" })); setCotistas([]); } }} className={`rounded-sm border px-4 py-2 text-[11px] font-bold transition-colors ${vincularAeronave === opcao ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>{opcao ? "Sim, vincular" : "Não, seguir sem aeronave"}</button>)}
                    </div>
                  </div>}
                  {exigeDadosAeronave && <>
                    {tipo === "cliente" || tipo === "reembolso" ? <>
                      <Campo label="Aeronave" obrigatorio><SearchableCombobox items={dadosOpcoes.aeronaves.map((a) => ({ id: a.id, label: `${a.matricula_registro} · ${a.modelo}` }))} value={form.aeronave_id} onChange={selecionarAeronaveCliente} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula ou modelo" emptyMessage="Nenhuma aeronave encontrada." /></Campo>
                      <Campo label="Vínculo com voo" obrigatorio><div className="flex flex-wrap gap-2">{([ ["com_voo", "Com número de voo"], ["sem_voo", "Sem número de voo"] ] as const).map(([modo, titulo]) => <button key={modo} type="button" aria-pressed={modoNumeroVooCliente === modo} onClick={() => selecionarModoNumeroVooCliente(modo)} className={`rounded-sm border px-3 py-2 text-[11px] font-bold transition-colors ${modoNumeroVooCliente === modo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>{titulo}</button>)}</div></Campo>
                      {modoNumeroVooCliente === "com_voo" && <Campo label="Número do voo" obrigatorio><SearchableCombobox items={dadosOpcoes.voos.filter((voo) => voo.aeronave_id === form.aeronave_id).map((voo) => { const aeronave = dadosOpcoes.aeronaves.find((item) => item.id === voo.aeronave_id); const rota = [voo.origem, voo.destino].filter(Boolean).join(" → "); const data = dataBr(voo.ultima_data); return { id: voo.numero_voo, label: [voo.numero_voo, aeronave?.matricula_registro, rota, data !== "—" ? data : ""].filter(Boolean).join("  ") }; })} value={form.numero_voo} onChange={selecionarVooCliente} placeholder="Selecione o voo" searchPlaceholder="Buscar número do voo, rota ou data" emptyMessage="Nenhum voo para esta aeronave." disabled={!form.aeronave_id} /></Campo>}
                      {modoNumeroVooCliente === "com_voo" && form.numero_voo && <Campo label="Cotista(s) da aeronave" obrigatorio><SearchableCombobox items={[{ id: "__todos__", label: "Todos os cotistas — ratear proporcionalmente" }, ...cotistas.map((c) => ({ id: c.id, label: `${c.nome} · ${Number(c.percentual_sociedade || 0).toFixed(2)}%${c.eh_holding ? " · Holding" : ""}` }))]} value={form.cotista_ids.length === cotistas.length && cotistas.length ? "__todos__" : form.cotista_ids.length ? "__selecionados__" : ""} selectedLabel={form.cotista_ids.length ? `${form.cotista_ids.length} cotista(s) selecionado(s)` : undefined} selectedValues={[...form.cotista_ids, ...(form.cotista_ids.length === cotistas.length && cotistas.length ? ["__todos__"] : [])]} onChange={atualizarSelecaoCotistas} placeholder="Selecione cotistas (adicione ou remova)" searchPlaceholder="Buscar cotista" disabled={!form.aeronave_id || !cotistas.length} emptyMessage="Nenhum cotista vinculado a esta aeronave." /></Campo>}
                      {modoNumeroVooCliente === "sem_voo" && <Campo label="Cotista(s) da aeronave" obrigatorio><SearchableCombobox items={[{ id: "__todos__", label: "Todos os cotistas — ratear proporcionalmente" }, ...cotistas.map((c) => ({ id: c.id, label: `${c.nome} · ${Number(c.percentual_sociedade || 0).toFixed(2)}%${c.eh_holding ? " · Holding" : ""}` }))]} value={form.cotista_ids.length === cotistas.length && cotistas.length ? "__todos__" : form.cotista_ids.length ? "__selecionados__" : ""} selectedLabel={form.cotista_ids.length ? `${form.cotista_ids.length} cotista(s) selecionado(s)` : undefined} selectedValues={[...form.cotista_ids, ...(form.cotista_ids.length === cotistas.length && cotistas.length ? ["__todos__"] : [])]} onChange={atualizarSelecaoCotistas} placeholder="Selecione um cotista ou todos" searchPlaceholder="Buscar cotista" disabled={!form.aeronave_id || !cotistas.length} emptyMessage="Nenhum cotista vinculado a esta aeronave." /></Campo>}
                    </> : <>
                      <Campo label="Número do voo" rotuloClassName="px-[6px]"><SearchableCombobox items={dadosOpcoes.voos.map((voo) => ({ id: voo.numero_voo, label: voo.numero_voo }))} value={form.numero_voo} onChange={(id) => selecionarVoo(id)} placeholder="Selecione ou busque o voo" searchPlaceholder="Buscar número do voo" emptyMessage="Nenhum voo encontrado em solicitações de reserva." allowFreeText /></Campo>
                      <Campo label="Aeronave" obrigatorio><SearchableCombobox items={dadosOpcoes.aeronaves.map((a) => ({ id: a.id, label: `${a.matricula_registro} · ${a.modelo}` }))} value={form.aeronave_id} onChange={(id) => { setForm((f) => ({ ...f, aeronave_id: id, cotista_ids: [], rateio_linhas: [] })); }} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula ou modelo" emptyMessage="Nenhuma aeronave encontrada." /></Campo>
                      <Campo label="Cotista(s) da aeronave" obrigatorio><SearchableCombobox items={[{ id: "__todos__", label: "Todos os cotistas — ratear proporcionalmente" }, ...cotistas.map((c) => ({ id: c.id, label: `${c.nome} · ${Number(c.percentual_sociedade || 0).toFixed(2)}%${c.eh_holding ? " · Holding" : ""}` }))]} value={form.cotista_ids.length === cotistas.length && cotistas.length ? "__todos__" : form.cotista_ids.length ? "__selecionados__" : ""} selectedLabel={form.cotista_ids.length ? `${form.cotista_ids.length} cotista(s) selecionado(s)` : undefined} selectedValues={[...form.cotista_ids, ...(form.cotista_ids.length === cotistas.length && cotistas.length ? ["__todos__"] : [])]} onChange={atualizarSelecaoCotistas} placeholder="Selecione cotistas (adicione mais de um)" searchPlaceholder="Buscar cotista" emptyMessage="Nenhum cotista vinculado a esta aeronave." disabled={!form.aeronave_id} /></Campo>
                    </>}
                    {form.cotista_ids.length > 0 && <>
                      <label className="sm:col-span-2 flex min-h-9 cursor-pointer items-center gap-2 text-[11px] font-semibold text-foreground">
                        <input type="checkbox" checked={vincularDespesaExistente} onChange={(event) => { const marcado = event.target.checked; setVincularDespesaExistente(marcado); if (!marcado) { setOrigemDespesa(""); setDespesasOrigem([]); } }} className="h-4 w-4 accent-primary" />
                        Deseja vincular uma despesa existente?
                      </label>
                      {vincularDespesaExistente && <Campo label="Origem da despesa" className="sm:col-span-2"><SearchableCombobox items={[{ id: "ABASTECIMENTO", label: "ABASTECIMENTOS" }, { id: "RECIBOS", label: "RECIBOS" }, { id: "RELATORIOS DE VIAGEM", label: "RELATÓRIO DE VIAGEM" }]} value={origemDespesa} onChange={(id) => void selecionarOrigemDespesa(id as OrigemDespesaEnvio | "")} placeholder="Selecione a origem da despesa" searchPlaceholder="Buscar recibos, abastecimentos ou relatório" /></Campo>}
                      {vincularDespesaExistente && origemDespesa && <Campo label="Despesa encontrada" className="sm:col-span-2"><SearchableCombobox items={despesasOrigem.map((item) => ({ id: item.id, label: [item.descricao || item.numero_recibo || item.numero_relatorio || origemDespesa, item.numero_voo ? `Voo ${item.numero_voo}` : "", item.data_despesa ? dataBr(item.data_despesa) : "", item.valor != null ? formatarValor(Number(item.valor)) : "", item.fornecedor].filter(Boolean).join(" · ") }))} value="" onChange={selecionarDespesaOrigem} placeholder={carregandoOrigem ? "Buscando despesas…" : "Selecione uma despesa para preencher o formulário"} searchPlaceholder="Buscar por descrição, data ou valor" emptyMessage="Nenhuma despesa encontrada para esta aeronave." disabled={carregandoOrigem || !despesasOrigem.length} /></Campo>}
                    </>}
                    {tipo === "cliente" && <Campo label="Valor da despesa" obrigatorio><input type="text" inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>}
                    {tipo !== "share" && <Campo label="Tipo de rateio" obrigatorio><SearchableCombobox items={["FIXO", "VARIAVEL POR VOO", "VARIAVEL POR HORA", "EXTRA"].map((item) => ({ id: item, label: item }))} value={form.tipo_rateio} onChange={(id) => alterar("tipo_rateio", id)} placeholder="Selecione o tipo de rateio" searchPlaceholder="Buscar tipo de rateio" /></Campo>}
                    {tipo !== "share" && cotistasSelecionados.length > 0 && <div className="rounded-sm border border-primary/25 bg-primary/[.05] p-4 sm:col-span-2"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-foreground">Rateio da despesa · {formatarValor(valorInformado)}</p><div className="mt-3 space-y-2">{cotistasSelecionados.map((cotista) => { const linha = form.rateio_linhas.find((item) => item.cotista_id === cotista.id); return <div key={cotista.id} className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2"><span className="truncate text-xs">{cotista.nome}</span><Input value={linha?.percentual ?? "0"} inputMode="decimal" onChange={(e) => alterarPercentual(cotista.id, e.target.value)} className="h-9 text-right" placeholder="%" /><span className="text-right text-xs text-muted-foreground">{formatarValor((linhasAlocadas.find((item) => item.cotista_id === cotista.id)?.valor_centavos ?? 0) / 100)}</span><button type="button" className="text-xs text-rose-500" onClick={() => atualizarSelecaoCotistas(cotista.id)} aria-label={`Retirar ${cotista.nome} do rateio`}>Retirar</button></div>; })}</div><p className={`mt-2 text-right text-[11px] font-bold ${Math.abs(form.rateio_linhas.reduce((s, l) => s + Number(l.percentual || 0), 0) - 100) < 0.01 ? "text-emerald-500" : "text-amber-500"}`}>Total: {form.rateio_linhas.reduce((s, l) => s + Number(l.percentual || 0), 0).toFixed(2)}%</p>{Math.abs(form.rateio_linhas.reduce((s, l) => s + Number(l.percentual || 0), 0) - 100) >= 0.01 && <p className="mt-1 text-right text-[10px] text-amber-600">Ajuste os percentuais para totalizar 100%.</p>}</div>}
                  </>}
                </div>
              )}
              {etapa === 2 && (
                <div className="space-y-3">
                  {tipo === "cliente" && <div role="status" className="rounded-sm border border-primary/25 bg-primary/[.05] p-4 sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[.12em] text-foreground">Resumo do rateio direto</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Aeronave, cotistas e valor foram informados na etapa anterior. A divisão segue os percentuais definidos.</p>
                    <p className="mt-2 text-xs font-semibold">Aeronave: {dadosOpcoes.aeronaves.find((aeronave) => aeronave.id === form.aeronave_id)?.matricula_registro || "Selecionada"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">{cotistasSelecionados.map((cotista) => {
                      const linha = form.rateio_linhas.find((item) => item.cotista_id === cotista.id);
                      return <span key={cotista.id} className="rounded-sm border border-border/70 bg-background/50 px-2 py-1 text-[10px] text-muted-foreground">{cotista.nome} · {Number(linha?.percentual || 0).toFixed(2)}%</span>;
                    })}</div>
                  </div>}
                  <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Descrição da despesa" obrigatorio className="sm:col-span-2"><input autoFocus value={form.descricao} onChange={(e) => alterar("descricao", e.target.value)} placeholder="Ex.: manutenção, imposto, combustível" className="campo" /></Campo>
                  {tipo !== "cliente" && <Campo label="Valor da despesa" obrigatorio><input type="text" inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>}
                  <Campo label="Vencimento" obrigatorio={tipo === "share"}><input type="date" value={form.vencimento} onChange={(e) => alterar("vencimento", e.target.value)} className="campo" /></Campo>
                  <Campo label="Fornecedor"><div className="flex items-center gap-2"><SearchableCombobox items={[...dadosOpcoes.fornecedores.map((f) => ({ id: f.id, label: f.label })), ...dadosOpcoes.fornecedores_combustivel.map((f) => { const registro = f as Record<string, unknown>; const id = String(registro.id ?? ""); const label = [String(registro.nome_fornecedor ?? ""), registro.nome_cidade ? String(registro.nome_cidade) : "", "Combustível"].filter(Boolean).join(" · "); return { id, label }; })]} value={form.fornecedor_id || form.fornecedor} onChange={(id, label) => { const cadastrado = dadosOpcoes.fornecedores.some((fornecedor) => fornecedor.id === id) || dadosOpcoes.fornecedores_combustivel.some((fornecedor) => String((fornecedor as Record<string, unknown>).id ?? "") === id); setForm((atual) => ({ ...atual, fornecedor_id: cadastrado ? id : "", fornecedor: label })); }} placeholder="Selecione ou digite o fornecedor" searchPlaceholder="Buscar fornecedor" emptyMessage="Nenhum fornecedor favorito encontrado." allowFreeText />{Boolean(form.fornecedor.trim()) && !form.fornecedor_id && <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-sm" onClick={() => setDialogoFornecedor(true)} aria-label="Adicionar fornecedor ao cadastro" title="Adicionar fornecedor ao cadastro">{salvandoFornecedor ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}</Button>}</div></Campo>
                  {tipo === "cliente" && <Campo label="Grupo categoria"><SearchableCombobox items={dadosOpcoes.categorias_cliente.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_id} onChange={(id, label) => setForm((atual) => ({ ...atual, categoria_id: id, categoria_nome: label, centro_custo: "", subcategoria_1: "", subcategoria_2: "", subcategoria_3: "", subcategoria_4: "" }))} placeholder="Selecione o grupo categoria" searchPlaceholder="Buscar grupo categoria" emptyMessage="Nenhum grupo categoria encontrado." /></Campo>}
                  {tipo === "reembolso" && <Campo label="Grupo categoria"><SearchableCombobox items={dadosOpcoes.categorias_cliente.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_id} onChange={(id, label) => setForm((atual) => ({ ...atual, categoria_id: id, categoria_nome: label, subcategoria_1: "", subcategoria_2: "", subcategoria_3: "", subcategoria_4: "" }))} placeholder="Selecione o grupo categoria" searchPlaceholder="Buscar grupo categoria" emptyMessage="Nenhum grupo categoria encontrado." /></Campo>}
                  {tipo === "share" && <Campo label="Grupo categoria"><SearchableCombobox items={dadosOpcoes.categorias.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_id} onChange={(id, label) => setForm((atual) => ({ ...atual, categoria_id: id, categoria_nome: label, grupo_categoria: "DESPESAS EMPRESA" }))} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria" emptyMessage="Nenhuma categoria de despesas empresa encontrada." /></Campo>}
                  {tipo !== "share" && subcategorias.length > 0 && <Campo label="Subcategoria"><SearchableCombobox items={subcategorias.map((subcategoria) => ({ id: subcategoria, label: subcategoria }))} value={[form.subcategoria_1, form.subcategoria_2, form.subcategoria_3, form.subcategoria_4].find(Boolean) || ""} onChange={(id) => { const nivel = (["subcategoria_1", "subcategoria_2", "subcategoria_3", "subcategoria_4"] as const).find((campo) => categoriaSelecionada?.[campo] === id); setForm((atual) => ({ ...atual, subcategoria_1: nivel === "subcategoria_1" ? id : "", subcategoria_2: nivel === "subcategoria_2" ? id : "", subcategoria_3: nivel === "subcategoria_3" ? id : "", subcategoria_4: nivel === "subcategoria_4" ? id : "" })); }} placeholder="Selecione a subcategoria" searchPlaceholder="Buscar subcategoria" /></Campo>}
                  {tipo !== "share" && <Campo label="Periodicidade"><SearchableCombobox items={periodicidades.map((item) => ({ id: item, label: item }))} value={form.periodicidade} onChange={(id) => alterar("periodicidade", id)} placeholder="Selecione a periodicidade" searchPlaceholder="Buscar periodicidade" /></Campo>}
                  <Campo label="Data de emissão" obrigatorio><input type="date" value={form.data_despesa} onChange={(e) => alterar("data_despesa", e.target.value)} className="campo" /></Campo>
                  </div>
                </div>
              )}
              {etapa === totalEtapas && (
                <div className="space-y-3">
                  <div className="rounded-sm border border-border bg-secondary/[.14] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Revisão antes do envio</p>
                      <strong className="rounded-sm bg-primary px-3 py-1.5 font-mono text-sm text-primary-foreground">{formatarValor(valorInformado)}</strong>
                    </div>
                    <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                      <Resumo label="Descrição" valor={form.descricao} />
                      <Resumo label="Natureza" valor={selecionada.titulo} />
                      <Resumo label="Pagador" valor={selecionada.pagador} />
                      <Resumo label="Destino" valor={selecionada.destino} />
                      <Resumo label="Categoria" valor={form.grupo_categoria} />
                      <Resumo label="Data de emissão" valor={dataBr(form.data_despesa)} />
                      <Resumo label="Vencimento" valor={dataBr(form.vencimento)} />
                      <Resumo label="Periodicidade" valor={form.periodicidade} />
                      <Resumo label="Anexos" valor={`${anexos.length} documento(s)`} />
                      <Resumo label="Rateio" valor={exigeCliente ? `${cotistasSelecionados.length} cotista(s)${cotistasSelecionados.some((c) => c.eh_holding) ? " · holding identificado" : ""}` : "Não se aplica"} />
                      {tipo === "cliente" && <Resumo label="Status do pagamento" valor="Pendente — em aberto para todos até a baixa" />}
                      {tipo === "reembolso" && <Resumo label="Pagamento direto" valor="Não — Share antecipou" />}
                    </div>
                  </div>
                  <Campo label="Observações"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} placeholder="Informações para o financeiro, rateio ou reembolso..." className="campo min-h-24 resize-y" /></Campo>
                  <div className="min-w-0 space-y-4 rounded-xl border border-border/70 bg-background/30 p-3 sm:p-4"><div><p className="text-[11px] font-semibold">Deseja vincular documentos à despesa?</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Os arquivos serão vinculados ao lançamento. Deixe “Todos os cotistas da aeronave” para compartilhar o anexo com todos no envio do e-mail.</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setDialogoAnexos(true)}>Selecionar arquivos</Button><Button type="button" size="sm" variant="ghost" onClick={() => setForm((atual) => ({ ...atual, anexos: [] }))}>Remover todos</Button></div>{anexos.length > 0 && <p className="mt-2 text-[10px] text-emerald-500">{anexos.length} anexo(s) vinculado(s).</p>}</div><AnexosDinamicosField anexos={anexos} onChange={(next) => setForm((atual) => ({ ...atual, anexos: next }))} storagePrefix="nf-boletos-clients" cotistas={tipo === "cliente" ? cotistas.map((cotista) => ({ id: cotista.id, label: `${cotista.nome} · ${cotista.id.slice(0, 8)}` })) : []} uploadFile={tipo === "cliente" ? async (arquivo, anexoId) => enviarAnexoEnvioPagamento(arquivo, anexoId) : undefined} /></div>
                  {uploadsPendentes && <p role="status" className="rounded-lg border border-primary/20 bg-primary/[.05] px-3 py-2 text-[11px] text-primary">Enviando anexos para armazenamento. A programação será liberada ao concluir.</p>}
                </div>
              )}
            </div>
          )}

          {erro && <div role="alert" className="mt-4 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
        </div>

        <div className="my-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#172235] bg-[#080e19] px-4 py-2.5 md:px-5">
          <div className="flex items-center gap-2">
            {etapa > 0 && <Button type="button" variant="ghost" onClick={anterior} disabled={salvando} className="h-9 gap-2 rounded-sm text-[11px]"><ArrowLeft size={14} /> Voltar</Button>}
            <Button type="button" variant="ghost" onClick={() => void abrirPaginaHistorico()} disabled={abrindoHistorico || salvando || enviandoEmail} className="h-9 gap-2 rounded-sm text-[11px] text-muted-foreground hover:bg-white/[.04] hover:text-foreground"><History size={14} /> Histórico</Button>
          </div>
          {etapa < totalEtapas ? (
            <Button type="button" onClick={proxima} disabled={salvando || (etapa === 0 && !tipo)} className="h-9 gap-2 rounded-sm px-5 text-[11px]">Continuar <ArrowRight size={14} /></Button>
          ) : (
            <Button type="button" onClick={enviar} disabled={salvando || uploadsPendentes || envioRecemCriado?.tipo === "share"} className="h-10 gap-2 rounded-lg px-5 text-xs font-semibold">{salvando || uploadsPendentes ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {uploadsPendentes ? "Enviando anexos…" : envioRecemCriado?.tipo === "share" ? "Aguardando aprovação" : envioRecemCriado ? "Continuar envio" : tipo === "share" ? "Criar lançamento" : "Programar pagamento"}</Button>
          )}
        </div>
      </section>

      </>}

      {historico && (
        <HistoricoEnvios
          envios={envios}
          rascunhos={rascunhosVisiveis}
          aeronaves={dadosOpcoes.aeronaves}
          carregando={carregando}
          erro={erroHistorico}
          onVoltar={fecharHistorico}
          onAtualizar={carregar}
          excluindoRascunhoId={excluindoRascunhoId}
          rotuloTipo={(tipo) => opcoes.find((opcao) => opcao.tipo === tipo)?.resumo ?? ""}
          restauracaoId={envioEmRestauracaoId}
          conversaoId={convertendoEnvioId}
          restaurandoRascunho={restaurandoRascunho}
          onAbrirPendente={retomarEnvioHistorico}
          onRecuperarConversao={recuperarConversao}
          onContinuarRascunho={continuarRascunho}
          onExcluirRascunho={setRascunhoParaExcluir}
        />
      )}

      <Dialog open={rascunhoParaExcluir !== null} onOpenChange={(open) => { if (!open && !excluindoRascunhoId) setRascunhoParaExcluir(null); }}>
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-md" onEscapeKeyDown={(event) => { if (excluindoRascunhoId) event.preventDefault(); }} onPointerDownOutside={(event) => { if (excluindoRascunhoId) event.preventDefault(); }}>
          <DialogHeader><DialogTitle className="text-base font-bold">Excluir rascunho?</DialogTitle><DialogDescription className="text-[11px]">Essa ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={Boolean(excluindoRascunhoId)} onClick={() => setRascunhoParaExcluir(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={Boolean(excluindoRascunhoId)} onClick={() => rascunhoParaExcluir && void excluirRascunho(rascunhoParaExcluir)}>{excluindoRascunhoId ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}{excluindoRascunhoId ? "Excluindo…" : "Excluir"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoAnexos} onOpenChange={setDialogoAnexos}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-base font-bold">Vincular anexo dos arquivos</DialogTitle><DialogDescription className="text-[11px]">Escolha a origem, pesquise o documento e selecione o registro. Somente os documentos selecionados serão vinculados ao lançamento.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <SearchableCombobox key={origemAnexo} items={[{ id: "recibos", label: "RECIBOS" }, { id: "relatorios", label: "RELATORIO DE VIAGEM" }, { id: "abastecimentos", label: "ABASTECIMENTOS" }]} value={origemAnexo} onChange={(id) => { setOrigemAnexo(id as typeof origemAnexo); setBuscaAnexo(""); }} placeholder="Escolha a origem do arquivo" searchPlaceholder="Buscar origem" />
            <Input value={buscaAnexo} onChange={(event) => setBuscaAnexo(event.target.value)} placeholder={origemAnexo === "abastecimentos" ? "Buscar por voo, trecho, cotista, data ou documento" : origemAnexo === "relatorios" ? "Buscar por número do voo ou número do relatório" : "Buscar por número do recibo"} className="campo" />
            <div key={origemAnexo} className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {anexosEncontrados.map((item: any) => {
                const texto = origemAnexo === "abastecimentos" ? `ABASTECIMENTO VOO ${item.numero_voo || "—"} TRECHO ${item.trecho || "—"} ${dataBr(item.data)} - ${item.cotista_nome || "Cotista não informado"}` : origemAnexo === "relatorios" ? `RELATORIO DESPESA DE VIAGEM VOO ${item.numero_voo || "—"} ${item.numero_relatorio || "—"} ${item.matricula_registro || ""}` : `RECIBO ${item.numero_recibo || "—"}`;
                const quantidade = quantidadeAnexosFonte(item, origemAnexo);
                const temAnexo = quantidade > 0;
                const tiposAnexos = origemAnexo === "abastecimentos"
                  ? [item.comanda_url && "Comanda", item.nota_url && "N.F.", item.boleto_url && "Boleto"].filter(Boolean).join(", ")
                  : item.nome_arquivo || "arquivo";
                return <button key={item.id} type="button" disabled={!temAnexo} onClick={() => selecionarFonteAnexo(item)} className="flex w-full items-center justify-between gap-3 rounded border border-border p-3 text-left text-[11px] hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{texto}</span><span className="mt-1 block text-[10px] text-muted-foreground">{temAnexo ? `${quantidade} anexo(s) disponível(is) · ${tiposAnexos}` : "Nenhum anexo disponível"}</span></span><span className="shrink-0 text-primary">Selecionar</span></button>;
              })}
              {!anexosEncontrados.length && <p className="py-8 text-center text-xs text-muted-foreground">Nenhum documento encontrado.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoFornecedor} onOpenChange={(open) => { if (!salvandoFornecedor) setDialogoFornecedor(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Adicionar fornecedor</DialogTitle>
            <DialogDescription className="text-[11px]">Deseja adicionar "{form.fornecedor.trim()}" — fornecedor favorito ou fornecedor de combustível?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" disabled={salvandoFornecedor} onClick={() => void salvarNovoFornecedor("favorito")}>Fornecedor favorito</Button>
            <Button type="button" variant="outline" disabled={salvandoFornecedor} onClick={() => void salvarNovoFornecedor("combustivel")}>Fornecedor de combustível</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rateiosDuplicados.length > 0} onOpenChange={(open) => { if (!open) { setRateiosDuplicados([]); confirmarDuplicidadeRef.current = false; } }}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Despesa já consta no rateio</DialogTitle><DialogDescription>Encontramos lançamento(s) com a mesma data de vencimento, categoria, valor total e números de documento/voo. Confira antes de continuar.</DialogDescription></DialogHeader>
          <div className="space-y-3">{rateiosDuplicados.map((rateio) => {
            const imagens = [rateio.documento_url, rateio.url_nf, rateio.url_recibo, rateio.url_boleto, rateio.url_demonstrativo, rateio.url_doc].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);
            return <section key={`${rateio.tabela}-${rateio.id}`} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">{rateio.categoria_nome || "Rateio"} · {formatarValor(Number(rateio.valor_total_centavos || 0) / 100)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rateio.tabela} · vencimento {dataBr(rateio.data_vencimento)} · documento {rateio.numero_nf || rateio.numero_recibo || rateio.numero_boleto || rateio.numero_demonstrativo || "—"} · voo {rateio.numero_voo || "—"}</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-primary">Ver lançamento e abrir resumo</summary><div className="mt-2 break-all text-xs">ID: {rateio.id}{imagens.length > 0 && <ul className="mt-2 list-inside list-disc">{imagens.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-primary underline">{/\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(url) && <img src={url} alt="Imagem do comprovante" className="my-2 max-h-40 max-w-full rounded border border-border object-contain" />}Abrir comprovante/imagem</a></li>)}</ul>}</div></details>
            </section>;
          })}</div>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setRateiosDuplicados([]); confirmarDuplicidadeRef.current = false; }}>Cancelar envio</Button><Button type="button" onClick={() => { setRateiosDuplicados([]); confirmarDuplicidadeRef.current = true; void enviar(); }}>Concluir envio mesmo assim</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={modalEmail} onOpenChange={(open) => { if (!open && !enviandoEmail) fecharModalEmail(); }}>
        <DialogContent
          className="
            flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl
            flex-col gap-0 overflow-hidden rounded-2xl
            border border-[#1a2638]
            bg-[#080e19]
            p-0
            shadow-[0_24px_70px_rgba(0,0,0,.45)]
            sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]
          "
        >
          <DialogHeader className="shrink-0 border-b border-[#172235] bg-[linear-gradient(135deg,#0b1422,#080e19)] px-4 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-14">
            <DialogTitle className="flex items-center gap-2 text-base font-bold tracking-tight"><Mail size={18} className="text-primary" /> Enviar solicitação por e-mail</DialogTitle>
            <DialogDescription className="max-w-xl text-[11px] leading-5 text-muted-foreground">{envioRecemCriado?.tipo === "cliente" ? "O rateio da despesa será criado antes do envio. Cada cotista receberá apenas os anexos selecionados para ele." : "Revise o e-mail, os anexos e o destinatário antes de enviar a solicitação."}</DialogDescription>
          </DialogHeader>

          {carregandoEmail ? (
            <div className="flex min-h-0 flex-1 items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                <div className="space-y-4 pb-1">
                  {erroEmail && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/[.07] p-3 text-[11px] leading-5 text-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] dark:text-red-200">{erroEmail}</div>}
                  {sucessoEmail && <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] p-3 text-[11px] leading-5 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,.02)] dark:text-emerald-200">{sucessoEmail}</div>}

                  {envioRecemCriado?.tipo === "cliente" ? (
                    <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.035] p-3 sm:p-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.1em] text-foreground">Destinatários e anexos por cotista</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Cada cotista receberá uma mensagem separada, somente com os documentos marcados abaixo.</p>
                      </div>
                      {cotistasEmail.map((cotista) => {
                        const anexosDoCotista = anexosEnvioEmail.filter((anexo) => anexoAplicaAoCotista(anexo, cotista.id));
                        if (!anexosDoCotista.length) return null;
                        const selecionados = anexosDoCotista.filter((anexo) => anexosSelecionados.includes(anexo.id)).length;
                        const rascunho = rascunhosEmailPorCotista[cotista.id] || { assunto: "", mensagem: "" };
                        const statusEmail = statusEmailCotista[cotista.id];
                        const emailEnviado = emailsEnviados.includes(cotista.id) || statusEmail === "ENVIADO";
                        const emailProcessando = statusEmail === "PROCESSANDO";
                        return (
                          <div key={cotista.id} className="min-w-0 space-y-3 rounded-xl border border-[#1a2638] bg-[#0b1220]/75 p-4 shadow-[0_12px_30px_rgba(0,0,0,.16)]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="min-w-0 truncate text-xs">{cotista.nome}</strong>
                              <span className={`text-[10px] ${emailEnviado ? "font-semibold text-emerald-500" : statusEmail === "FALHOU" ? "font-semibold text-red-500" : emailProcessando ? "font-semibold text-primary" : "text-muted-foreground"}`}>{emailEnviado ? "E-mail enviado" : statusEmail === "FALHOU" ? "Falha no envio · pode tentar novamente" : emailProcessando ? "Envio interrompido · retomar" : `${selecionados} de ${anexosDoCotista.length} anexo(s)`}</span>
                            </div>
                            <Input type="email" value={emailsPorCotista[cotista.id] || ""} onChange={(event) => setEmailsPorCotista((atual) => ({ ...atual, [cotista.id]: event.target.value }))} placeholder={`E-mail de ${cotista.nome}`} className="campo !h-10 !rounded-xl border-white/[.08] bg-[#080e19] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" aria-label={`E-mail de ${cotista.nome}`} disabled={emailEnviado} />
                            <div className="space-y-2">
                              {anexosDoCotista.map((anexo) => (
                                <label key={anexo.id} className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border border-white/[.07] bg-white/[.025] p-3 text-xs transition-all hover:border-primary/30 hover:bg-white/[.04]">
                                  <input type="checkbox" checked={anexosSelecionados.includes(anexo.id)} onChange={() => alternarAnexo(anexo.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" disabled={emailEnviado} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{anexo.file?.name || anexo.numero || anexo.url?.split("/").pop() || "Arquivo selecionado"}</span>
                                    <span className="mt-0.5 block text-[10px] uppercase text-muted-foreground">{anexo.tipo}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                            <div className="space-y-2 border-t border-[#172235] pt-4">
                              <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">
                                Assunto deste e-mail
                                <Input value={rascunho.assunto} onChange={(event) => setRascunhosEmailPorCotista((atual) => ({ ...atual, [cotista.id]: { ...(atual[cotista.id] || rascunho), assunto: event.target.value } }))} className="campo mt-1 !h-10 !rounded-xl border-white/[.08] bg-[#080e19] normal-case tracking-normal shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" disabled={emailEnviado} />
                              </label>
                              <label className="block space-y-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">
                                Mensagem para {cotista.nome}
                                <Textarea value={rascunho.mensagem} onChange={(event) => setRascunhosEmailPorCotista((atual) => ({ ...atual, [cotista.id]: { ...(atual[cotista.id] || rascunho), mensagem: event.target.value } }))} className="campo mt-1 min-h-28 !rounded-xl border-white/[.08] bg-[#080e19] resize-y normal-case tracking-normal shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" disabled={emailEnviado} />
                              </label>
                              <div className="flex justify-end">
                                <Button type="button" onClick={() => dispararEmail(cotista.id)} disabled={enviandoEmail || emailEnviado || !emailsPorCotista[cotista.id]?.trim() || selecionados === 0 || !rascunho.assunto.trim() || !rascunho.mensagem.trim()} className="h-9 gap-2 rounded-lg px-4 text-xs font-semibold">
                                  {enviandoEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                  {emailEnviado ? "E-mail enviado" : emailProcessando ? "Retomar envio" : `Enviar somente para ${cotista.nome}`}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {!cotistasEmail.some((cotista) => anexosEnvioEmail.some((anexo) => anexoAplicaAoCotista(anexo, cotista.id))) && <p className="rounded-lg border border-amber-500/25 bg-amber-500/[.06] p-3 text-[11px] text-amber-700 dark:text-amber-200">Adicione anexos para disponibilizá-los aos cotistas.</p>}
                    </section>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Destinatário</label>
                      <SeletorContatoEmail contatos={contatosFiltrados} busca={buscaContato} emailSelecionado={destinatario} onBusca={setBuscaContato} onSelecionar={(contato) => { setDestinatario(contato.email); setNomeDestinatario(contato.nome); }} />
                      <Input value={destinatario} onChange={(e) => { setDestinatario(e.target.value); setNomeDestinatario(""); }} placeholder="Ou digite um e-mail manualmente" type="email" className="campo !h-10 !rounded-xl border-white/[.08] bg-[#080e19] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" />
                    </div>
                  )}

                  {envioRecemCriado?.tipo !== "cliente" && <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Assunto</label>
                    <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="campo !h-10 !rounded-xl border-white/[.08] bg-[#080e19] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" />
                  </div>}

                  {envioRecemCriado?.tipo !== "cliente" && <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Mensagem</label>
                    <Textarea value={corpoEmail} onChange={(e) => setCorpoEmail(e.target.value)} className="campo min-h-32 !rounded-xl border-white/[.08] bg-[#080e19] resize-y shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" />
                  </div>}

                  {assinaturaEmail && <div className="rounded-xl border border-white/[.08] bg-white p-4 font-[Arial,sans-serif] text-[#333] shadow-[0_10px_28px_rgba(0,0,0,.18)]">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">Assinatura aplicada automaticamente</p>
                    <div className="flex items-center gap-3">
                      <img src={assinaturaEmail.logo_url || logoShare} alt="Share Brasil" className="h-auto w-16 shrink-0 object-contain" />
                      <div className="min-w-0 text-[11px] leading-4">
                        <strong className="block text-[14px] leading-4 text-black">{assinaturaEmail.nome}</strong>
                        {assinaturaEmail.cargo && <span className="block text-[10px] leading-3">{assinaturaEmail.cargo}</span>}
                        {assinaturaEmail.telefone && <span className="flex items-center gap-1"><Smartphone size={10} /> {assinaturaEmail.telefone}</span>}
                        {assinaturaEmail.endereco && <span className="flex items-start gap-1 text-[10px] leading-3"><MapPin size={11} className="mt-0.5 shrink-0" /> {assinaturaEmail.endereco}</span>}
                      </div>
                    </div>
                  </div>}

                  {envioRecemCriado?.tipo !== "cliente" && <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Anexos</label>
                    {arquivosPersistidos.length > 0 && <div className="space-y-1.5">{arquivosPersistidos.map((arquivo) => <div key={arquivo.key} className="flex items-center justify-between gap-3 rounded border border-border/70 px-3 py-2 text-[11px]"><span className="min-w-0 truncate">{arquivo.filename}</span><button type="button" onClick={() => removerArquivoPersistido(arquivo.key)} className="shrink-0 text-rose-500">Remover</button></div>)}</div>}
                    <AnexosEmail somenteArquivosLocais anexos={[]} selecionados={[]} onAlternar={() => undefined} arquivosNovos={arquivosNovos} onAdicionarArquivos={adicionarArquivos} onRemoverArquivo={removerArquivo} />
                  </div>}

                  {contasBancarias.length > 0 && <div className="rounded-xl border border-primary/20 bg-primary/[.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.02)]">
                    <div className="mb-2 flex items-center gap-2"><Landmark size={14} className="text-primary" /><p className="text-[10px] font-bold uppercase tracking-[.1em] text-foreground">Selecionar banco</p></div>
                    <div className="grid gap-2 sm:grid-cols-2">{contasBancarias.map((conta) => <button type="button" key={conta.id} onClick={() => setBancoSelecionado((atual) => atual?.id === conta.id ? null : conta)} className={`rounded-xl border p-3 text-left text-[10px] transition-all ${bancoSelecionado?.id === conta.id ? "border-primary/70 bg-primary/[.10] shadow-[0_0_0_1px_hsl(var(--primary)/.12)]" : "border-white/[.07] bg-white/[.025] hover:border-primary/45 hover:bg-white/[.04]"}`}><span className="block font-bold">{conta.banco}</span><span className="mt-1 block text-muted-foreground">{conta.tipo_conta || "Conta"} {conta.numero_conta || ""}</span></button>)}</div>
                    {bancoSelecionado && <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-300">Dados de {bancoSelecionado.banco} serão anexados ao email.</p>}
                  </div>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#172235] bg-[#080e19] px-4 py-3 sm:px-6 sm:py-4">
                <Button type="button" variant="ghost" onClick={fecharModalEmail} disabled={enviandoEmail} className="h-9 gap-2 rounded-xl px-3 text-[11px] text-muted-foreground hover:bg-white/[.04] hover:text-foreground"><X size={14} /> Cancelar</Button>
                {envioRecemCriado?.tipo !== "cliente" && <Button type="button" onClick={() => dispararEmail()} disabled={enviandoEmail || !destinatario.trim() || !assunto.trim() || !corpoEmail.trim()} className="h-10 w-full gap-2 rounded-lg px-5 text-xs font-semibold sm:w-auto">{enviandoEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar e-mail</Button>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", rotuloClassName = "", children }: { label: string; obrigatorio?: boolean; className?: string; rotuloClassName?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className={`mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground ${rotuloClassName}`}>{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div className="flex items-start justify-between gap-4 border-t border-border/60 py-2 text-[11px]"><span className="text-muted-foreground">{label}</span><strong className="text-right text-foreground">{valor || "—"}</strong></div>;
}
