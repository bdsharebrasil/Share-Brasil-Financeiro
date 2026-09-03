import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, HandCoins, History, Info, Loader2, Mail, Send, Users, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { SeletorContatoEmail } from "@/components/email/SeletorContatoEmail";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import AnexosDinamicosField, { type AnexoLinha } from "@/components/ui/AnexosDinamicosField";
import { atualizarStatusEnvioPagamento, buscarCentralEmail, buscarEnviosPagamento, buscarOpcoesEnvioPagamento, buscarCotistasAeronave, criarEnvioPagamento, enviarEmailCliente, type AnexoEmail, type ContatoEmail, type EnvioPagamento, type OpcaoEnvioPagamento, type CotistaAeronave } from "@/lib/colaborador-api";

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
  observacoes: string;
  grupo_categoria: Categoria;
  tipo_despesa: "fixo" | "variável";
  pago_diretamente: boolean;
  pago_por: string;
  anexos: AnexoLinha[];
};
type OpcaoEnvio = {
  tipo: TipoEnvio;
  titulo: string;
  resumo: string;
  detalhe: string;
  pagador: string;
  destino: string;
  regra: string;
  icon: typeof WalletCards;
  cor: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
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
  observacoes: "",
  grupo_categoria: "DESPESAS EMPRESA",
  tipo_despesa: "variável",
  pago_diretamente: false,
  pago_por: "",
  anexos: [],
};

const opcoes: OpcaoEnvio[] = [
  {
    tipo: "share",
    titulo: "Envio de pagamento para o caixa Share",
    resumo: "Caixa Share",
    detalhe: "Despesa da própria Share (luz, compras, administrativo). Gera apenas contas a pagar no caixa Share.",
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
    detalhe: "A Share paga adiantado e cobra o reembolso do cliente após a baixa.",
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
    detalhe: "Despesa paga diretamente pelo cliente. Não passa pelo caixa Share, apenas rateio de despesas.",
    pagador: "Cliente / sócio",
    destino: "Caixa Cliente + rateio",
    regra: "Pago diretamente",
    icon: Users,
    cor: "text-violet-400",
  },
];
const periodicidades = ["ÚNICO", "EVENTUAL", "MENSAL", "BIMESTRAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
const statusEnvio: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-400/10 text-amber-600 dark:text-amber-300" },
  pago: { label: "Pago", className: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", className: "bg-red-400/10 text-red-700 dark:text-red-300" },
  enviado: { label: "Enviado", className: "bg-sky-400/10 text-sky-700 dark:text-sky-300" },
};

function dataBr(valor?: string | null) {
  return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

function formatarValor(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

function converterValor(valor: string) {
  const limpo = valor.trim();
  if (!limpo) return 0;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo) || 0;
}

export default function EnviarPagamento({ apenasCaixaShare = false }: { apenasCaixaShare?: boolean }) {
  const [tipo, setTipo] = useState<TipoEnvio | null>(null);
  const [form, setForm] = useState<Formulario>(inicial);
  const [envios, setEnvios] = useState<EnvioPagamento[]>([]);
  const [dadosOpcoes, setDadosOpcoes] = useState<OpcaoEnvioPagamento>({ fornecedores: [], aeronaves: [], voos: [], categorias: [] });
  const [cotistas, setCotistas] = useState<CotistaAeronave[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [vincularAeronave, setVincularAeronave] = useState<boolean | null>(null);
  const opcoesVisiveis = apenasCaixaShare ? opcoes.filter((opcao) => opcao.tipo !== "cliente") : opcoes;
  const [historico, setHistorico] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const anexos = form.anexos;

  const [envioRecemCriado, setEnvioRecemCriado] = useState<EnvioPagamento | null>(null);
  const [enviarEmailAposCriar, setEnviarEmailAposCriar] = useState(false);
  const [modalEmail, setModalEmail] = useState(false);
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [anexosEmail, setAnexosEmail] = useState<AnexoEmail[]>([]);
  const [buscaContato, setBuscaContato] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nomeDestinatario, setNomeDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoEmail, setCorpoEmail] = useState("");
  const [anexosSelecionados, setAnexosSelecionados] = useState<string[]>([]);
  const [arquivosNovos, setArquivosNovos] = useState<File[]>([]);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState("");
  const [sucessoEmail, setSucessoEmail] = useState("");
  const [carregandoEmail, setCarregandoEmail] = useState(false);

  const carregarOpcoes = async () => { try { setDadosOpcoes(await buscarOpcoesEnvioPagamento()); } catch { setErro("Não foi possível carregar as opções financeiras."); } };

  const carregarCotistas = async (aeronaveId: string) => { if (!aeronaveId) { setCotistas([]); return; } try { const dados = await buscarCotistasAeronave(aeronaveId); setCotistas(dados.cotistas); } catch { setErro("Não foi possível carregar os cotistas da aeronave."); } };

  const carregar = async () => {
    setCarregando(true);
    try {
      const respostas = apenasCaixaShare
        ? await Promise.all([buscarEnviosPagamento("share"), buscarEnviosPagamento("reembolso")])
        : [await buscarEnviosPagamento()];
      setEnvios(respostas.flatMap((resposta) => resposta.envios).sort((a, b) => b.criado_em.localeCompare(a.criado_em)));
    } catch {
      setErro("Não foi possível carregar os envios de pagamento.");
    } finally {
      setCarregando(false);
    }
  };

  const carregarContatosEmail = async () => {
    setCarregandoEmail(true);
    setErroEmail("");
    try {
      const dados = await buscarCentralEmail();
      setContatos(dados.contatos);
      setAnexosEmail(dados.anexos);
    } catch {
      setErroEmail("Não foi possível carregar os contatos de e-mail.");
    } finally {
      setCarregandoEmail(false);
    }
  };

  useEffect(() => { void carregar(); void carregarOpcoes(); }, []);

  useEffect(() => { void carregarCotistas(form.aeronave_id); }, [form.aeronave_id]);

  const selecionada = opcoes.find((opcao) => opcao.tipo === tipo) ?? null;
  const recentes = useMemo(() => envios.slice(0, 8), [envios]);
  const valorInformado = converterValor(form.valor);
  const exigeCliente = tipo !== null && tipo !== "share";
  const cotistasSelecionados = cotistas.filter((c) => form.cotista_ids.includes(c.id));
  const exigeDadosAeronave = exigeCliente || (tipo === "share" && vincularAeronave === true);
  const totalEtapas = exigeDadosAeronave ? 3 : 2;
  const tituloEtapa = etapa === 1 ? "Dados da despesa" : etapa === 2 && exigeDadosAeronave ? (tipo === "share" ? "Aeronave e voo" : "Cliente e rateio") : "Revisão e envio";
  const alterar = (campo: keyof Formulario, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));

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

  const marcarModo = (novoTipo: TipoEnvio) => {
    setErro("");
    setMensagem("");
    if (tipo === novoTipo) {
      setTipo(null);
      return;
    }
    setTipo(novoTipo);
    setVincularAeronave(novoTipo === "share" ? null : true);
    setForm({
      ...inicial,
      data_despesa: hoje(),
      grupo_categoria: novoTipo === "cliente" ? "CAIXA CLIENTE" : novoTipo === "reembolso" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA",
      pago_diretamente: novoTipo === "cliente",
    });
  };

  const trocarModo = () => {
    setEtapa(0);
    setTipo(null);
    setVincularAeronave(null);
    setErro("");
  };

  const podeAvancar = () => {
    if (etapa === 0) return Boolean(tipo);
    if (etapa === 1) return Boolean(form.descricao.trim() && valorInformado > 0 && (tipo === "share" ? form.vencimento : form.data_despesa) && (tipo !== "share" || vincularAeronave !== null));
    if (etapa === 2 && exigeDadosAeronave) return Boolean(form.aeronave_id && form.cotista_ids.length);
    return true;
  };

  const proxima = () => {
    setErro("");
    if (!podeAvancar()) {
      setErro(etapa === 0 ? "Marque um modo de solicitação para continuar." : etapa === 1 ? (tipo === "share" ? (vincularAeronave === null ? "Informe se deseja vincular uma aeronave à despesa." : "Informe descrição, valor e prazo de pagamento.") : "Informe descrição, valor e data da despesa.") : "Selecione a aeronave e pelo menos um cotista.");
      return;
    }
    setEtapa((atual) => Math.min(totalEtapas, atual + 1));
  };

  const anterior = () => {
    setErro("");
    setEtapa((atual) => Math.max(0, atual - 1));
  };

  const enviar = async () => {
    if (!tipo || !podeAvancar()) {
      setErro("Revise os campos obrigatórios antes de criar o lançamento.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const payload = tipo === "share" ? {
        tipo, descricao: form.descricao, valor: valorInformado, vencimento: form.vencimento,
        fornecedor: form.fornecedor, fornecedor_id: form.fornecedor_id, categoria_id: form.categoria_id,
        categoria_nome: form.categoria_nome, grupo_categoria: "DESPESAS EMPRESA", periodicidade: form.periodicidade,
        aeronave_id: form.aeronave_id, cotista_id: form.cotista_ids[0] || "", cotista_ids: form.cotista_ids,
        numero_voo: form.numero_voo, observacoes: form.observacoes, pago_por: form.pago_por || "share",
        anexos: form.anexos.map(({ id, tipo: anexoTipo, numero, url }) => ({ id, tipo: anexoTipo, numero, url })),
      } : {
        ...form, tipo, cliente_id: "", socio_id: "", cotista_id: form.cotista_ids[0] || "", valor: valorInformado,
        tipo_caixa: "share", gera_rateio: exigeCliente, pago_diretamente: tipo === "cliente",
        grupo_categoria: form.grupo_categoria, tipo_despesa: form.tipo_despesa,
        pago_por: form.pago_por || (tipo === "cliente" ? form.cliente_id : "share"), periodicidade: form.periodicidade,
        anexos: form.anexos.map(({ id, tipo: anexoTipo, numero, url }) => ({ id, tipo: anexoTipo, numero, url })),
      };
      const registro = await criarEnvioPagamento(payload);
      setEnvios((atual) => [registro, ...atual]);
      if (exigeCliente && !enviarEmailAposCriar) {
        const atualizado = await atualizarStatusEnvioPagamento(registro.id, "email_nao_enviado");
        setEnvios((atual) => atual.map((e) => e.id === registro.id ? { ...e, ...atualizado } : e));
      }
      setMensagem(exigeCliente && !enviarEmailAposCriar ? "Lançamento criado. E-mail marcado como não enviado; a programação está liberada." : "Lançamento criado corretamente em movimentações.");

      if (enviarEmailAposCriar) {
        setEnvioRecemCriado(registro);
        setAssunto(`Solicitação de pagamento — ${registro.descricao}`);
        setCorpoEmail(montarCorpoEmail(registro));
        const contatoInicial = contatos.find((c) => c.cliente_id === registro.cliente_id);
        if (contatoInicial) {
          setDestinatario(contatoInicial.email);
          setNomeDestinatario(contatoInicial.nome);
        }
        setModalEmail(true);
        if (contatos.length === 0) void carregarContatosEmail();
      }

      setForm({ ...inicial, data_despesa: hoje() });
      setTipo(null);
      setEtapa(0);
      setEnviarEmailAposCriar(false);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível criar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const fecharModalEmail = () => {
    setModalEmail(false);
    setDestinatario("");
    setNomeDestinatario("");
    setAssunto("");
    setCorpoEmail("");
    setAnexosSelecionados([]);
    setArquivosNovos([]);
    setErroEmail("");
    setSucessoEmail("");
    setEnvioRecemCriado(null);
  };

  const alternarAnexo = (id: string) => setAnexosSelecionados((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]);
  const adicionarArquivos = (arquivos: File[]) => setArquivosNovos((atual) => [...atual, ...arquivos]);
  const removerArquivo = (index: number) => setArquivosNovos((atual) => atual.filter((_, i) => i !== index));

  const anexosFiltrados = useMemo(() => {
    if (!envioRecemCriado?.cliente_id) return anexosEmail;
    return anexosEmail.filter((a) => {
      if (a.origem === "recibo") return true;
      return true;
    });
  }, [anexosEmail, envioRecemCriado]);

  const dispararEmail = async () => {
    if (!destinatario.trim() || !assunto.trim() || !corpoEmail.trim()) {
      setErroEmail("Informe destinatário, assunto e mensagem.");
      return;
    }
    setEnviandoEmail(true);
    setErroEmail("");
    setSucessoEmail("");
    try {
      const emailResult = await enviarEmailCliente({
        destinatarios: [destinatario.trim()],
        assunto: assunto.trim(),
        mensagem: corpoEmail.trim(),
        anexos: anexosSelecionados,
        arquivos: arquivosNovos,
        nome_destinatario: nomeDestinatario || undefined,
      });
      if (envioRecemCriado) {
        try {
          await atualizarStatusEnvioPagamento(envioRecemCriado.id, "email_enviado");
          setEnvios((atual) => atual.map((e) => e.id === envioRecemCriado.id ? { ...e, status: "enviado" } : e));
        } catch { /* status update is best-effort */ }
      }
      setSucessoEmail(`E-mail enviado com sucesso para ${destinatario.trim()}.`);
      setMensagem("Lançamento criado e e-mail enviado ao cliente.");
      setTimeout(() => fecharModalEmail(), 1800);
    } catch (cause) {
      setErroEmail(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className="route-enter mx-auto max-w-[900px] space-y-5">
      <header>
        <IndicadorPagina>Financeiro / Enviar pagamento</IndicadorPagina>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-.04em] md:text-2xl"><Send className="text-primary" size={22} /> Fluxo de envio</h1>
        <p className="mt-1.5 max-w-2xl overflow-hidden text-[11px] leading-relaxed text-muted-foreground">Um fluxo único e guiado: escolha o modo, informe a despesa e envie. O modo define se o lançamento entra no caixa Share, no caixa Cliente ou no rateio.</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card/45 shadow-[0_18px_50px_rgba(0,0,0,.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/10 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary"><ClipboardCheck size={15} /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em]">Fluxo de envio</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{etapa === 0 ? "Etapa 1 · Seleção do modo" : `Etapa ${etapa + 1} de ${totalEtapas + 1} · ${tituloEtapa}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-1" aria-label={`Progresso: etapa ${etapa + 1}`}>
            {Array.from({ length: totalEtapas + 1 }, (_, index) => index).map((item) => (
              <span key={item} className={`h-[3px] w-9 transition-colors ${item <= etapa ? "bg-primary" : "bg-border"}`} aria-current={item === etapa ? "step" : undefined} />
            ))}
          </div>
        </div>

        <div className="px-5 py-6 md:px-6">
          {etapa === 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Modo da solicitação <sup className="text-primary">*</sup></p>
                <p className="mt-1 text-[11px] text-muted-foreground">Marque um modo. Para trocar, clique na opção ativa para desmarcá-la primeiro.</p>
              </div>
              <div className="space-y-2.5">
                {opcoesVisiveis.map((opcao) => {
                  const ativo = tipo === opcao.tipo;
                  const Icon = opcao.icon;
                  return (
                    <button
                      type="button"
                      key={opcao.tipo}
                      onClick={() => marcarModo(opcao.tipo)}
                      aria-pressed={ativo}
                      className={`flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/[.08]" : "border-border/80 bg-background/35 hover:border-primary/35 hover:bg-secondary/25"}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${ativo ? "border-primary" : "border-muted-foreground/50"}`}>
                        {ativo && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">{opcao.titulo}</span>
                        <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{opcao.detalhe}</span>
                      </span>
                      <Icon size={16} className={`mt-0.5 shrink-0 ${ativo ? opcao.cor : "text-muted-foreground/60"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {etapa > 0 && selecionada && (
            <div className="space-y-5">
              <div className="rounded-sm border border-primary/30 bg-primary/[.07] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{selecionada.titulo}</span>
                  <button type="button" onClick={trocarModo} className="text-[11px] font-bold text-foreground underline-offset-4 hover:underline">Trocar modo</button>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{selecionada.detalhe}</p>
              </div>

              {etapa === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Descrição da despesa" obrigatorio className="sm:col-span-2"><input autoFocus value={form.descricao} onChange={(e) => alterar("descricao", e.target.value)} placeholder="Ex.: manutenção, imposto, combustível" className="campo" /></Campo>
                  <Campo label="Valor da despesa" obrigatorio><input type="text" inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo>
                  {tipo !== "share" && <Campo label="Data da despesa" obrigatorio><input type="date" value={form.data_despesa} onChange={(e) => alterar("data_despesa", e.target.value)} className="campo" /></Campo>}
                  <Campo label="Vencimento"><input type="date" value={form.vencimento} onChange={(e) => alterar("vencimento", e.target.value)} className="campo" /></Campo>
                  <Campo label="Fornecedor"><SearchableCombobox items={dadosOpcoes.fornecedores.map((f) => ({ id: f.id, label: f.label }))} value={form.fornecedor_id} onChange={(id, label) => { alterar("fornecedor_id", id); alterar("fornecedor", label); }} placeholder="Selecione ou busque fornecedor favorito" searchPlaceholder="Buscar fornecedor" emptyMessage="Nenhum fornecedor favorito encontrado." allowFreeText /></Campo>
                  {tipo !== "share" && <Campo label="Centro de custo"><SearchableCombobox items={dadosOpcoes.categorias.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_id} onChange={(id, label) => { alterar("categoria_id", id); alterar("categoria_nome", label); alterar("centro_custo", id); }} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria" emptyMessage="Nenhuma categoria encontrada." /></Campo>}
                  {tipo === "share" && (
                    <>
                      <Campo label="Grupo categoria · DESPESAS EMPRESA"><SearchableCombobox items={dadosOpcoes.categorias.map((c) => ({ id: c.id, label: c.nome }))} value={form.categoria_id} onChange={(id, label) => { alterar("categoria_id", id); alterar("categoria_nome", label); alterar("grupo_categoria", "DESPESAS EMPRESA"); }} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria" emptyMessage="Nenhuma categoria de despesas empresa encontrada." /></Campo>
                      <Campo label="Periodicidade"><SearchableCombobox items={periodicidades.map((item) => ({ id: item, label: item }))} value={form.periodicidade} onChange={(id) => alterar("periodicidade", id)} placeholder="Selecione a periodicidade" searchPlaceholder="Buscar periodicidade" /></Campo>
                      <div className="rounded-sm border border-primary/25 bg-primary/[.05] p-4 sm:col-span-2">
                        <p className="text-[12px] font-bold text-foreground">Deseja vincular uma aeronave nessa despesa?</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {([true, false] as const).map((opcao) => <button key={String(opcao)} type="button" onClick={() => { setVincularAeronave(opcao); if (!opcao) { setForm((atual) => ({ ...atual, aeronave_id: "", cotista_id: "", cotista_ids: [], numero_voo: "" })); setCotistas([]); } }} className={`rounded-sm border px-4 py-2 text-[11px] font-bold transition-colors ${vincularAeronave === opcao ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>{opcao ? "Sim, vincular" : "Não, seguir sem aeronave"}</button>)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {etapa === 2 && exigeDadosAeronave && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-sm border border-amber-400/25 bg-amber-400/[.07] p-3.5 text-[11px] leading-5 text-muted-foreground sm:col-span-2">
                    <Info size={15} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>{tipo === "share" ? "Vincule a despesa a uma aeronave e selecione um ou todos os cotistas para identificação." : tipo === "cliente" ? "O lançamento será CAIXA CLIENTE e marcará pago_diretamente = true." : "A Share desembolsa agora no Caixa Share; o valor ficará pendente para reembolso no rateio."}</span>
                  </div>
                  <Campo label="Aeronave" obrigatorio><SearchableCombobox items={dadosOpcoes.aeronaves.map((a) => ({ id: a.id, label: `${a.matricula_registro} · ${a.modelo}` }))} value={form.aeronave_id} onChange={(id) => { alterar("aeronave_id", id); alterar("cotista_ids", "" as never); setForm((f) => ({ ...f, aeronave_id: id, cotista_ids: [] })); }} placeholder="Selecione a aeronave" searchPlaceholder="Buscar matrícula ou modelo" emptyMessage="Nenhuma aeronave encontrada." /></Campo>
                  <Campo label="Cotista(s) da aeronave" obrigatorio><SearchableCombobox items={[{ id: "__todos__", label: "Todos os cotistas — ratear proporcionalmente" }, ...cotistas.map((c) => ({ id: c.id, label: `${c.nome} · ${Number(c.percentual_sociedade || 0).toFixed(2)}%${c.eh_holding ? " · Holding" : ""}` }))]} value={form.cotista_ids.length === cotistas.length && cotistas.length ? "__todos__" : form.cotista_ids[0] || ""} onChange={(id) => setForm((f) => ({ ...f, cotista_ids: id === "__todos__" ? cotistas.map((c) => c.id) : [id] }))} placeholder="Selecione um ou todos" searchPlaceholder="Buscar cotista" emptyMessage="Nenhum cotista vinculado a esta aeronave." disabled={!form.aeronave_id} /></Campo>
                  {tipo !== "share" && <Campo label="Quem pagou"><input value={form.pago_por} onChange={(e) => alterar("pago_por", e.target.value)} placeholder={tipo === "cliente" ? "Cotista selecionado" : "SHARE"} className="campo" /></Campo>}
                  <Campo label="Número do voo"><SearchableCombobox items={dadosOpcoes.voos.map((voo) => ({ id: voo.numero_voo, label: voo.numero_voo }))} value={form.numero_voo} onChange={(id) => alterar("numero_voo", id)} placeholder="Selecione ou busque o voo" searchPlaceholder="Buscar número do voo" emptyMessage="Nenhum voo encontrado em solicitações de reserva." allowFreeText /></Campo>
                </div>
              )}

              {etapa === totalEtapas && (
                <div className="space-y-4">
                  <div className="rounded-sm border border-border bg-secondary/[.14] p-4">
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
                      {tipo !== "share" && <Resumo label="Data" valor={dataBr(form.data_despesa)} />}
                      <Resumo label="Vencimento" valor={dataBr(form.vencimento)} />
                      <Resumo label="Periodicidade" valor={form.periodicidade} />
                      <Resumo label="Anexos" valor={`${anexos.length} documento(s)`} />
                      <Resumo label="Rateio" valor={exigeCliente ? `${cotistasSelecionados.length} cotista(s)${cotistasSelecionados.some((c) => c.eh_holding) ? " · holding identificado" : ""}` : "Não se aplica"} />
                      {exigeCliente && <Resumo label="Pagamento direto" valor={tipo === "cliente" ? "Sim" : "Não — Share antecipou"} />}
                    </div>
                  </div>
                  <Campo label="Observações"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} placeholder="Informações para o financeiro, rateio ou reembolso..." className="campo min-h-24 resize-y" /></Campo>
                  <AnexosDinamicosField anexos={anexos} onChange={(next) => setForm((atual) => ({ ...atual, anexos: next }))} storagePrefix="envio-pagamento-anexos" />

                  {tipo !== "share" && <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-sky-400/30 bg-sky-400/[.06] px-4 py-3.5 transition-colors hover:bg-sky-400/[.1]">
                    <input type="checkbox" checked={enviarEmailAposCriar} onChange={(e) => {
                      setEnviarEmailAposCriar(e.target.checked);
                      if (e.target.checked && contatos.length === 0) void carregarContatosEmail();
    }} className="h-4 w-4 rounded border-border accent-primary" />
                    <span className="flex items-center gap-2 text-[12px] font-bold text-foreground"><Mail size={15} className="text-sky-500" /> Enviar solicitação por e-mail ao cliente após criar o lançamento</span>
                  </label>}
                </div>
              )}
            </div>
          )}

          {erro && <div role="alert" className="mt-4 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-secondary/10 px-5 py-3.5">
          <div className="flex items-center gap-2">
            {etapa > 0 && <Button type="button" variant="ghost" onClick={anterior} disabled={salvando} className="h-9 gap-2 rounded-sm text-[11px]"><ArrowLeft size={14} /> Voltar</Button>}
            <Button type="button" variant="ghost" onClick={() => setHistorico((atual) => !atual)} className="h-9 gap-2 rounded-sm text-[11px] text-muted-foreground"><History size={14} /> Histórico de programação</Button>
          </div>
          {etapa < totalEtapas ? (
            <Button type="button" onClick={proxima} disabled={salvando || (etapa === 0 && !tipo)} className="h-9 gap-2 rounded-sm px-5 text-[11px]">Continuar <ArrowRight size={14} /></Button>
          ) : (
            <Button type="button" onClick={enviar} disabled={salvando} className="h-9 gap-2 rounded-sm px-5 text-[11px]">{salvando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Criar lançamento</Button>
          )}
        </div>
      </section>

      {historico && (
        <section className="overflow-hidden rounded-sm border border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[.16em]">Histórico de programação</p>
            <span className="text-[10px] text-muted-foreground">{envios.length} registro(s)</span>
          </div>
          {carregando ? (
            <div className="space-y-2 p-4"><div className="skeleton h-9 rounded-sm" /><div className="skeleton h-9 rounded-sm" /></div>
          ) : recentes.length ? (
            <div className="divide-y divide-border/60">
              {recentes.map((envio) => {
                const status = statusEnvio[envio.status] || { label: envio.status || "Enviado", className: "bg-secondary text-muted-foreground" };
                return (
                  <div key={envio.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold">{envio.descricao}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{opcoes.find((o) => o.tipo === envio.tipo)?.resumo} · {dataBr(envio.criado_em)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="font-mono text-[11px]">{formatarValor(Number(envio.valor))}</strong>
                      <span className={`rounded-sm px-2 py-1 text-[9px] font-bold ${status.className}`}>{status.label}</span>
                      {(envio.status === "email_enviado" || envio.status === "email_nao_enviado" || envio.tipo === "share") && <Button type="button" size="sm" variant="outline" className="h-7 rounded-sm px-2 text-[9px]" onClick={() => setMensagem("Pagamento liberado para programação no módulo financeiro.")}>Programar pagamento</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-6 text-center text-[11px] text-muted-foreground">Nenhum lançamento enviado ainda.</p>
          )}
        </section>
      )}

      <Dialog open={modalEmail} onOpenChange={(open) => { if (!open && !enviandoEmail) fecharModalEmail(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold"><Mail size={18} className="text-primary" /> Enviar solicitação por e-mail</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">Revise o e-mail e envie ao cliente. Após o envio, a solicitação será marcada como "Enviado".</DialogDescription>
          </DialogHeader>

          {carregandoEmail ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {erroEmail && <div role="alert" className="rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erroEmail}</div>}
              {sucessoEmail && <div role="status" className="rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{sucessoEmail}</div>}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Destinatário</label>
                <SeletorContatoEmail contatos={contatosFiltrados} busca={buscaContato} emailSelecionado={destinatario} onBusca={setBuscaContato} onSelecionar={(contato) => { setDestinatario(contato.email); setNomeDestinatario(contato.nome); }} />
                <Input value={destinatario} onChange={(e) => { setDestinatario(e.target.value); setNomeDestinatario(""); }} placeholder="Ou digite um e-mail manualmente" type="email" className="campo" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Assunto</label>
                <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} className="campo" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Mensagem</label>
                <Textarea value={corpoEmail} onChange={(e) => setCorpoEmail(e.target.value)} className="campo min-h-32 resize-y" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">Anexos</label>
                <AnexosEmail anexos={anexosFiltrados} selecionados={anexosSelecionados} onAlternar={alternarAnexo} arquivosNovos={arquivosNovos} onAdicionarArquivos={adicionarArquivos} onRemoverArquivo={removerArquivo} />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={fecharModalEmail} disabled={enviandoEmail} className="h-9 gap-2 rounded-sm text-[11px]"><X size={14} /> Cancelar</Button>
                <Button type="button" onClick={dispararEmail} disabled={enviandoEmail || !destinatario.trim() || !assunto.trim() || !corpoEmail.trim()} className="h-9 gap-2 rounded-sm px-5 text-[11px]">{enviandoEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar e-mail</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div className="flex items-start justify-between gap-4 border-t border-border/60 py-2 text-[11px]"><span className="text-muted-foreground">{label}</span><strong className="text-right text-foreground">{valor || "—"}</strong></div>;
}
