import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign, ClipboardCheck, FileText, HandCoins, Info, Loader2, Send, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { buscarEnviosPagamento, criarEnvioPagamento, type EnvioPagamento } from "@/lib/colaborador-api";

type TipoEnvio = EnvioPagamento["tipo"];
type Categoria = "FOLHA DE PAGAMENTO" | "DESPESAS EMPRESA" | "DESPESAS EMPRESA-BANCO" | "DESPESAS PARTICULARES" | "IMPOSTOS" | "RECEITAS OPERACIONAIS" | "CAIXA CLIENTE" | "DESPESAS REEMBOLSÁVEIS" | "REEMBOLSOS ENTRADAS";
type Formulario = {
  descricao: string;
  valor: string;
  data_despesa: string;
  vencimento: string;
  fornecedor: string;
  cliente_id: string;
  socio_id: string;
  aeronave_id: string;
  numero_voo: string;
  centro_custo: string;
  observacoes: string;
  grupo_categoria: Categoria;
  tipo_despesa: "fixo" | "variável";
  pago_diretamente: boolean;
  pago_por: string;
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
  faixa: string;
};

const hoje = () => new Date().toISOString().slice(0, 10);
const inicial: Formulario = {
  descricao: "",
  valor: "",
  data_despesa: hoje(),
  vencimento: "",
  fornecedor: "",
  cliente_id: "",
  socio_id: "",
  aeronave_id: "",
  numero_voo: "",
  centro_custo: "",
  observacoes: "",
  grupo_categoria: "DESPESAS EMPRESA",
  tipo_despesa: "variável",
  pago_diretamente: false,
  pago_por: "",
};

const opcoes: OpcaoEnvio[] = [
  {
    tipo: "share",
    titulo: "Despesa da Share",
    resumo: "Caixa Share",
    detalhe: "Despesas próprias da empresa, como folha, impostos, banco e fornecedores.",
    pagador: "Share Brasil",
    destino: "Caixa Share",
    regra: "Não gera rateio de cliente",
    icon: WalletCards,
    cor: "text-primary",
    faixa: "from-primary/[.16] to-primary/[.03]",
  },
  {
    tipo: "reembolso",
    titulo: "Despesa reembolsável",
    resumo: "Share antecipa",
    detalhe: "A Share paga agora e mantém o valor pendente para reembolso do cliente.",
    pagador: "Share Brasil",
    destino: "Caixa Share + rateio",
    regra: "Cliente reembolsa depois",
    icon: HandCoins,
    cor: "text-amber-600 dark:text-amber-300",
    faixa: "from-amber-500/[.16] to-amber-500/[.03]",
  },
  {
    tipo: "cliente",
    titulo: "Despesa do cliente",
    resumo: "Cliente paga direto",
    detalhe: "O cliente pagou sem intermediação da Share e a despesa entra no rateio obrigatório.",
    pagador: "Cliente / sócio",
    destino: "Caixa Cliente + rateio",
    regra: "Pago diretamente",
    icon: Users,
    cor: "text-emerald-600 dark:text-emerald-300",
    faixa: "from-emerald-500/[.16] to-emerald-500/[.03]",
  },
];
const categoriasShare: Categoria[] = ["FOLHA DE PAGAMENTO", "DESPESAS EMPRESA", "DESPESAS EMPRESA-BANCO", "DESPESAS PARTICULARES", "IMPOSTOS", "RECEITAS OPERACIONAIS"];
const statusEnvio: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-400/10 text-amber-600 dark:text-amber-300" },
  pago: { label: "Pago", className: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", className: "bg-red-400/10 text-red-700 dark:text-red-300" },
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

export default function EnviarPagamento() {
  const [tipo, setTipo] = useState<TipoEnvio>("share");
  const [form, setForm] = useState<Formulario>(inicial);
  const [envios, setEnvios] = useState<EnvioPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const resposta = await buscarEnviosPagamento();
      setEnvios(resposta.envios);
    } catch {
      setErro("Não foi possível carregar os envios de pagamento.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const selecionada = opcoes.find((opcao) => opcao.tipo === tipo) || opcoes[0];
  const recentes = useMemo(() => envios.slice(0, 8), [envios]);
  const valorInformado = converterValor(form.valor);
  const exigeCliente = tipo !== "share";
  const totalEtapas = exigeCliente ? 4 : 3;
  const tituloEtapa = etapa === 1 ? "confirme o fluxo" : etapa === 2 ? "dados básicos" : etapa === 3 && exigeCliente ? "cliente e rateio" : "revisão final";
  const alterar = (campo: keyof Formulario, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const selecionarTipo = (novoTipo: TipoEnvio) => {
    setTipo(novoTipo);
    setForm((atual) => ({
      ...atual,
      grupo_categoria: novoTipo === "cliente" ? "CAIXA CLIENTE" : novoTipo === "reembolso" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA",
      pago_diretamente: novoTipo === "cliente",
      pago_por: novoTipo === "share" ? "" : atual.pago_por,
      cliente_id: novoTipo === "share" ? "" : atual.cliente_id,
      socio_id: novoTipo === "share" ? "" : atual.socio_id,
    }));
    setErro("");
  };

  const abrir = (novoTipo: TipoEnvio) => {
    setTipo(novoTipo);
    setForm({
      ...inicial,
      grupo_categoria: novoTipo === "cliente" ? "CAIXA CLIENTE" : novoTipo === "reembolso" ? "DESPESAS REEMBOLSÁVEIS" : "DESPESAS EMPRESA",
      pago_diretamente: novoTipo === "cliente",
    });
    setEtapa(1);
    setMensagem("");
    setErro("");
    setAberto(true);
  };

  const fechar = () => {
    if (!salvando) setAberto(false);
  };

  const podeAvancar = () => {
    if (etapa === 1) return true;
    if (etapa === 2) return Boolean(form.descricao.trim() && valorInformado > 0 && form.data_despesa);
    if (etapa === 3 && exigeCliente) return Boolean(form.cliente_id.trim());
    return true;
  };

  const proxima = () => {
    setErro("");
    if (!podeAvancar()) {
      setErro(etapa === 2 ? "Informe descrição, valor e data da despesa para continuar." : "Informe o identificador do cliente para gerar o rateio obrigatório.");
      return;
    }
    setEtapa((atual) => Math.min(totalEtapas, atual + 1));
  };

  const anterior = () => {
    setErro("");
    setEtapa((atual) => Math.max(1, atual - 1));
  };

  const enviar = async () => {
    if (!podeAvancar()) {
      setErro("Revise os campos obrigatórios antes de criar o lançamento.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const registro = await criarEnvioPagamento({
        ...form,
        tipo,
        valor: valorInformado,
        tipo_caixa: tipo === "cliente" ? "cliente" : "share",
        gera_rateio: exigeCliente,
        pago_diretamente: tipo === "cliente",
        grupo_categoria: form.grupo_categoria,
        tipo_despesa: tipo === "share" ? form.tipo_despesa : null,
        pago_por: form.pago_por || (tipo === "cliente" ? form.cliente_id : "share"),
      });
      setEnvios((atual) => [registro, ...atual]);
      setMensagem("Lançamento criado corretamente em movimentações.");
      setAberto(false);
      setForm({ ...inicial, data_despesa: hoje() });
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível criar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const IconSelecionada = selecionada.icon;

  return (
    <div className="route-enter space-y-6">
      <header>
        <IndicadorPagina>Financeiro / Enviar pagamento</IndicadorPagina>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><Send className="text-primary" size={26} /> Enviar pagamento</h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">Um fluxo guiado para registrar cada despesa na origem correta, sem misturar Caixa Share, Caixa Cliente e rateio.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[.06] px-3 py-2 text-[10px] font-semibold text-muted-foreground"><ClipboardCheck size={14} className="text-primary" /> Movimentações + rateio</div>
        </div>
      </header>

      <section aria-labelledby="opcoes-envio">
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Escolha a intenção</p><h2 id="opcoes-envio" className="mt-1 text-base font-extrabold tracking-tight">Qual regra se aplica a este pagamento?</h2></div><span className="hidden text-[10px] text-muted-foreground sm:block">A escolha define o destino do lançamento</span></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {opcoes.map((opcao) => {
            const Icon = opcao.icon;
            return (
              <button type="button" key={opcao.tipo} onClick={() => abrir(opcao.tipo)} className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br ${opcao.faixa} bg-card/80 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg active:scale-[.99]`}>
                <div className="flex items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-background/70 ${opcao.cor}`}><Icon size={20} /></span><ArrowRight size={17} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div>
                <p className="mt-5 text-sm font-extrabold">{opcao.titulo}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">{opcao.resumo}</p><p className="mt-2 min-h-10 text-[11px] leading-5 text-muted-foreground">{opcao.detalhe}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3"><Mini label="Pagador" value={opcao.pagador} /><Mini label="Destino" value={opcao.destino} /></div>
                <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-foreground">Começar lançamento <ArrowRight size={12} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[.12] via-card to-card p-6"><CircleDollarSign size={22} className="text-primary" /><h2 className="mt-4 text-base font-extrabold">Uma regra simples para não errar</h2><p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">Toda despesa nasce em <strong className="text-foreground">movimentações</strong>. Quando pertence a um cliente, o sistema cria também o registro obrigatório em <strong className="text-foreground">rateio_despesas</strong>. O caixa indica de onde o dinheiro sai agora; não define a natureza da despesa.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Regra titulo="Caixa Share" texto="Empresa e antecipações" icon={<WalletCards size={15} />} /><Regra titulo="Caixa Cliente" texto="Pagamento direto" icon={<Users size={15} />} /><Regra titulo="Rateio" texto="Toda despesa de cliente" icon={<ClipboardCheck size={15} />} /></div></div>
        <aside className="overflow-hidden rounded-2xl border border-border bg-card/75"><div className="flex items-center justify-between border-b border-border/70 p-4"><div><h2 className="text-xs font-extrabold">Últimos lançamentos</h2><p className="mt-1 text-[9px] text-muted-foreground">Registros enviados para conferência</p></div><FileText size={16} className="text-primary" /></div>{carregando ? <div className="space-y-2 p-4"><div className="skeleton h-10 rounded-lg" /><div className="skeleton h-10 rounded-lg" /></div> : recentes.length ? <div className="divide-y divide-border/60">{recentes.map((envio) => { const status = statusEnvio[envio.status] || { label: envio.status || "Enviado", className: "bg-secondary text-muted-foreground" }; return <div key={envio.id} className="p-3"><div className="flex items-start justify-between gap-2"><p className="truncate text-[10px] font-bold">{envio.descricao}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-bold ${status.className}`}>{status.label}</span></div><div className="mt-1 flex justify-between gap-3 text-[9px] text-muted-foreground"><span>{opcoes.find((o) => o.tipo === envio.tipo)?.resumo}</span><strong className="text-foreground">{formatarValor(Number(envio.valor))}</strong></div><p className="mt-1 text-[9px] text-muted-foreground">{dataBr(envio.criado_em)}</p></div>; })}</div> : <div className="p-6 text-center text-[10px] text-muted-foreground">Nenhum lançamento enviado ainda.</div>}</aside>
      </section>

      {(mensagem || erro) && <div role="status" className={`rounded-xl border p-3 text-xs ${erro ? "border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200"}`}>{erro || mensagem}</div>}

      <Dialog open={aberto} onOpenChange={(valor) => !valor && fechar()}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border-border/80 bg-card p-0">
          <DialogHeader className="border-b border-border/70 bg-secondary/25 px-6 py-5 md:px-7">
            <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ${selecionada.cor}`}><IconSelecionada size={19} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-base">{selecionada.titulo}</DialogTitle><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{selecionada.resumo}</span></div><DialogDescription className="mt-1 text-xs">Etapa {etapa} de {totalEtapas} · {tituloEtapa}</DialogDescription></div></div>
            <div className="mt-5 flex items-center gap-1.5" aria-label={`Progresso: etapa ${etapa} de ${totalEtapas}`}>{Array.from({ length: totalEtapas }, (_, index) => index + 1).map((item) => <span key={item} className={`h-1.5 flex-1 rounded-full transition-colors ${item <= etapa ? "bg-primary" : "bg-border"}`} aria-current={item === etapa ? "step" : undefined} />)}</div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-6 md:px-7">
            {etapa === 1 && <div className="space-y-5"><div className={`rounded-2xl border border-primary/20 bg-gradient-to-br ${selecionada.faixa} p-5`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Fluxo selecionado</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">{selecionada.titulo}</h2><p className="mt-2 max-w-lg text-xs leading-5 text-muted-foreground">{selecionada.detalhe}</p></div><span className="shrink-0 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-[10px] font-semibold text-muted-foreground">Selecione outra regra abaixo</span></div><div className="mt-5 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-3"><Mini label="Quem paga" value={selecionada.pagador} /><Mini label="Onde registra" value={selecionada.destino} /><Mini label="Regra" value={selecionada.regra} /></div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Precisa usar outra regra?</p><div className="grid gap-2 sm:grid-cols-3">{opcoes.map((opcao) => <button type="button" key={opcao.tipo} onClick={() => selecionarTipo(opcao.tipo)} className={`rounded-xl border p-3 text-left transition ${tipo === opcao.tipo ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}><div className="flex items-center gap-2"><opcao.icon size={15} className={opcao.cor} /><span className="text-[11px] font-bold">{opcao.titulo}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{opcao.resumo}</p></button>)}</div></div><div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-xs font-bold">A partir daqui, o fluxo muda de verdade</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{exigeCliente ? "Na próxima etapa você informa a despesa e, depois, o cliente que receberá o rateio." : "Você informará a despesa e irá direto para a revisão. Este caminho não cria rateio de cliente."}</p></div></div></div>}

            {etapa === 2 && <div className="space-y-5"><Intro numero="2" titulo="Dados básicos da despesa" texto="Comece pelo que o financeiro precisa para registrar o lançamento com precisão." /><div className="grid gap-4 sm:grid-cols-2"><Campo label="Descrição da despesa" obrigatorio className="sm:col-span-2"><input autoFocus value={form.descricao} onChange={(e) => alterar("descricao", e.target.value)} placeholder="Ex.: manutenção, imposto, combustível" className="campo" /></Campo><Campo label="Valor da despesa" obrigatorio><input type="text" inputMode="decimal" value={form.valor} onChange={(e) => alterar("valor", e.target.value)} placeholder="0,00" className="campo font-mono" /></Campo><Campo label="Data da despesa" obrigatorio><input type="date" value={form.data_despesa} onChange={(e) => alterar("data_despesa", e.target.value)} className="campo" /></Campo><Campo label="Vencimento"><input type="date" value={form.vencimento} onChange={(e) => alterar("vencimento", e.target.value)} className="campo" /></Campo><Campo label="Fornecedor"><input value={form.fornecedor} onChange={(e) => alterar("fornecedor", e.target.value)} placeholder="Nome do fornecedor" className="campo" /></Campo><Campo label="Centro de custo"><input value={form.centro_custo} onChange={(e) => alterar("centro_custo", e.target.value)} placeholder="Ex.: Operações, administrativo" className="campo" /></Campo>{tipo === "share" && <><Campo label="Grupo da categoria"><select value={form.grupo_categoria} onChange={(e) => alterar("grupo_categoria", e.target.value)} className="campo">{categoriasShare.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></Campo><Campo label="Tipo da despesa"><select value={form.tipo_despesa} onChange={(e) => alterar("tipo_despesa", e.target.value)} className="campo"><option value="fixo">Fixo</option><option value="variável">Variável</option></select></Campo></>}</div></div>}

            {etapa === 3 && exigeCliente && <div className="space-y-5"><Intro numero="3" titulo={tipo === "cliente" ? "Identifique o cliente do lançamento" : "Defina quem receberá o reembolso"} texto={tipo === "cliente" ? "O cliente é obrigatório para criar o rateio e registrar que o pagamento foi direto." : "O cliente é obrigatório para que a antecipação da Share fique vinculada ao reembolso."} /><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[.07] p-4 text-xs leading-5 text-muted-foreground"><Info size={16} className="mt-0.5 shrink-0 text-amber-500" /><span>{tipo === "cliente" ? "O lançamento será CAIXA CLIENTE e marcará pago_diretamente = true." : "A Share desembolsa agora no Caixa Share; o valor ficará pendente para reembolso no rateio."}</span></div><Campo label="Cliente (ID D1)" obrigatorio><input autoFocus value={form.cliente_id} onChange={(e) => alterar("cliente_id", e.target.value)} placeholder="Identificador do cliente" className="campo" /></Campo><Campo label="Sócio / holding"><input value={form.socio_id} onChange={(e) => alterar("socio_id", e.target.value)} placeholder="ID do sócio, quando aplicável" className="campo" /></Campo><Campo label="Quem pagou"><input value={form.pago_por} onChange={(e) => alterar("pago_por", e.target.value)} placeholder={tipo === "cliente" ? "ID do cliente ou sócio" : "share"} className="campo" /></Campo><Campo label="Aeronave"><input value={form.aeronave_id} onChange={(e) => alterar("aeronave_id", e.target.value)} placeholder="ID da aeronave" className="campo" /></Campo><Campo label="Número do voo"><input value={form.numero_voo} onChange={(e) => alterar("numero_voo", e.target.value)} placeholder="Ex.: SB-1234" className="campo" /></Campo></div></div>}

            {etapa === totalEtapas && <div className="space-y-5"><div className="rounded-2xl border border-primary/20 bg-primary/[.06] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Revisão antes do envio</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">Confira o que será registrado</h2></div><strong className="rounded-xl bg-primary px-3 py-2 font-mono text-sm text-primary-foreground">{formatarValor(valorInformado)}</strong></div><div className="mt-5 grid gap-4 border-t border-primary/15 pt-4 sm:grid-cols-2"><Resumo label="Natureza" valor={selecionada.titulo} /><Resumo label="Pagador" valor={selecionada.pagador} /><Resumo label="Destino" valor={selecionada.destino} /><Resumo label="Categoria" valor={form.grupo_categoria} /><Resumo label="Data" valor={dataBr(form.data_despesa)} /><Resumo label="Vencimento" valor={dataBr(form.vencimento)} /><Resumo label="Rateio" valor={exigeCliente ? "Sim, obrigatório" : "Não se aplica"} />{exigeCliente && <Resumo label="Pagamento direto" valor={tipo === "cliente" ? "Sim" : "Não — Share antecipou"} />} </div></div><Campo label="Observações"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} placeholder="Informações para o financeiro, rateio ou reembolso..." className="campo min-h-24 resize-y py-2" /></Campo><div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4"><ClipboardCheck size={16} className="mt-0.5 shrink-0 text-primary" /><p className="text-[11px] leading-5 text-muted-foreground">Ao enviar, o lançamento será criado em <strong className="text-foreground">movimentações</strong>{exigeCliente ? " e seu rateio obrigatório será vinculado ao cliente informado." : "."}</p></div></div>}

            {erro && <div role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-600 dark:text-red-200">{erro}</div>}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-6 py-4 md:px-7"><Button type="button" variant="ghost" onClick={etapa === 1 ? fechar : anterior} disabled={salvando} className="gap-2 text-xs">{etapa === 1 ? "Cancelar" : <><ArrowLeft size={14} /> Voltar</>}</Button>{etapa < totalEtapas ? <Button type="button" onClick={proxima} disabled={salvando} className="gap-2 text-xs">Continuar para {etapa === 1 ? "dados básicos" : etapa === 2 && exigeCliente ? "cliente e rateio" : "revisão"} <ArrowRight size={14} /></Button> : <Button type="button" onClick={enviar} disabled={salvando} className="gap-2 text-xs">{salvando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Criar lançamento</Button>}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 truncate text-[11px] font-semibold text-foreground" title={value}>{value}</p></div>;
}

function Intro({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">{numero}. próximo passo</p><h2 className="mt-2 text-xl font-extrabold tracking-tight">{titulo}</h2><p className="mt-1.5 max-w-xl text-xs leading-5 text-muted-foreground">{texto}</p></div>;
}

function Regra({ titulo, texto, icon }: { titulo: string; texto: string; icon: ReactNode }) {
  return <div className="rounded-xl border border-border/70 bg-background/40 p-3"><div className="flex items-center gap-2 text-xs font-bold text-foreground">{icon}{titulo}</div><p className="mt-1 text-[10px] text-muted-foreground">{texto}</p></div>;
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-3 text-xs"><span className="text-muted-foreground">{label}</span><strong className="text-right text-foreground">{valor || "—"}</strong></div>;
}
