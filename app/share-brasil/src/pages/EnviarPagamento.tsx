import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, HandCoins, History, Info, Loader2, Send, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function EnviarPagamento({ apenasCaixaShare = false }: { apenasCaixaShare?: boolean }) {
  const [tipo, setTipo] = useState<TipoEnvio | null>(null);
  const [form, setForm] = useState<Formulario>(inicial);
  const [envios, setEnvios] = useState<EnvioPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const opcoesVisiveis = apenasCaixaShare ? opcoes.filter((opcao) => opcao.tipo !== "cliente") : opcoes;
  const [historico, setHistorico] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

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

  useEffect(() => {
    void carregar();
  }, []);

  const selecionada = opcoes.find((opcao) => opcao.tipo === tipo) ?? null;
  const recentes = useMemo(() => envios.slice(0, 8), [envios]);
  const valorInformado = converterValor(form.valor);
  const exigeCliente = tipo !== null && tipo !== "share";
  const totalEtapas = exigeCliente ? 3 : 2;
  const tituloEtapa = etapa === 1 ? "Dados da despesa" : etapa === 2 && exigeCliente ? "Cliente e rateio" : "Revisão e envio";
  const alterar = (campo: keyof Formulario, valor: string | boolean) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const marcarModo = (novoTipo: TipoEnvio) => {
    setErro("");
    setMensagem("");
    if (tipo === novoTipo) {
      setTipo(null);
      return;
    }
    setTipo(novoTipo);
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
    setErro("");
  };

  const podeAvancar = () => {
    if (etapa === 0) return Boolean(tipo);
    if (etapa === 1) return Boolean(form.descricao.trim() && valorInformado > 0 && form.data_despesa);
    if (etapa === 2 && exigeCliente) return Boolean(form.cliente_id.trim());
    return true;
  };

  const proxima = () => {
    setErro("");
    if (!podeAvancar()) {
      setErro(etapa === 0 ? "Marque um modo de solicitação para continuar." : etapa === 1 ? "Informe descrição, valor e data da despesa." : "Informe o identificador do cliente para gerar o rateio obrigatório.");
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
      setForm({ ...inicial, data_despesa: hoje() });
      setTipo(null);
      setEtapa(0);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível criar o lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="route-enter mx-auto max-w-4xl space-y-5">
      <header>
        <IndicadorPagina>Financeiro / Enviar pagamento</IndicadorPagina>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-[-.04em] md:text-2xl"><Send className="text-primary" size={22} /> Enviar pagamento</h1>
        <p className="mt-1.5 max-w-2xl overflow-hidden text-[11px] leading-relaxed text-muted-foreground">Um fluxo único e guiado: escolha o modo, informe a despesa e envie. O modo define se o lançamento entra no caixa Share, no caixa Cliente ou no rateio.</p>
      </header>

      <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/20 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary"><ClipboardCheck size={15} /></span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em]">Solicitação de pagamento</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{etapa === 0 ? "Etapa 1 · Modo da solicitação" : `Etapa ${etapa + 1} de ${totalEtapas + 1} · ${tituloEtapa}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-1" aria-label={`Progresso: etapa ${etapa + 1}`}>
            {Array.from({ length: totalEtapas + 1 }, (_, index) => index).map((item) => (
              <span key={item} className={`h-[3px] w-9 transition-colors ${item <= etapa ? "bg-primary" : "bg-border"}`} aria-current={item === etapa ? "step" : undefined} />
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
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
                      className={`flex w-full items-start gap-3.5 rounded-sm border px-4 py-3.5 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/[.08]" : "border-border bg-secondary/[.12] hover:border-primary/35 hover:bg-secondary/25"}`}
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
                  <Campo label="Data da despesa" obrigatorio><input type="date" value={form.data_despesa} onChange={(e) => alterar("data_despesa", e.target.value)} className="campo" /></Campo>
                  <Campo label="Vencimento"><input type="date" value={form.vencimento} onChange={(e) => alterar("vencimento", e.target.value)} className="campo" /></Campo>
                  <Campo label="Fornecedor"><input value={form.fornecedor} onChange={(e) => alterar("fornecedor", e.target.value)} placeholder="Nome do fornecedor" className="campo" /></Campo>
                  <Campo label="Centro de custo"><input value={form.centro_custo} onChange={(e) => alterar("centro_custo", e.target.value)} placeholder="Ex.: Operações, administrativo" className="campo" /></Campo>
                  {tipo === "share" && (
                    <>
                      <Campo label="Grupo da categoria"><select value={form.grupo_categoria} onChange={(e) => alterar("grupo_categoria", e.target.value)} className="campo">{categoriasShare.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></Campo>
                      <Campo label="Tipo da despesa"><select value={form.tipo_despesa} onChange={(e) => alterar("tipo_despesa", e.target.value)} className="campo"><option value="fixo">Fixo</option><option value="variável">Variável</option></select></Campo>
                    </>
                  )}
                </div>
              )}

              {etapa === 2 && exigeCliente && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-sm border border-amber-400/25 bg-amber-400/[.07] p-3.5 text-[11px] leading-5 text-muted-foreground sm:col-span-2">
                    <Info size={15} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>{tipo === "cliente" ? "O lançamento será CAIXA CLIENTE e marcará pago_diretamente = true." : "A Share desembolsa agora no Caixa Share; o valor ficará pendente para reembolso no rateio."}</span>
                  </div>
                  <Campo label="Cliente (ID D1)" obrigatorio><input autoFocus value={form.cliente_id} onChange={(e) => alterar("cliente_id", e.target.value)} placeholder="Identificador do cliente" className="campo" /></Campo>
                  <Campo label="Sócio / holding"><input value={form.socio_id} onChange={(e) => alterar("socio_id", e.target.value)} placeholder="ID do sócio, quando aplicável" className="campo" /></Campo>
                  <Campo label="Quem pagou"><input value={form.pago_por} onChange={(e) => alterar("pago_por", e.target.value)} placeholder={tipo === "cliente" ? "ID do cliente ou sócio" : "share"} className="campo" /></Campo>
                  <Campo label="Aeronave"><input value={form.aeronave_id} onChange={(e) => alterar("aeronave_id", e.target.value)} placeholder="ID da aeronave" className="campo" /></Campo>
                  <Campo label="Número do voo"><input value={form.numero_voo} onChange={(e) => alterar("numero_voo", e.target.value)} placeholder="Ex.: SB-1234" className="campo" /></Campo>
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
                      <Resumo label="Data" valor={dataBr(form.data_despesa)} />
                      <Resumo label="Vencimento" valor={dataBr(form.vencimento)} />
                      <Resumo label="Rateio" valor={exigeCliente ? "Sim, obrigatório" : "Não se aplica"} />
                      {exigeCliente && <Resumo label="Pagamento direto" valor={tipo === "cliente" ? "Sim" : "Não — Share antecipou"} />}
                    </div>
                  </div>
                  <Campo label="Observações"><textarea value={form.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} placeholder="Informações para o financeiro, rateio ou reembolso..." className="campo min-h-24 resize-y" /></Campo>
                </div>
              )}
            </div>
          )}

          {erro && <div role="alert" className="mt-4 rounded-sm border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-600 dark:text-red-200">{erro}</div>}
          {mensagem && !erro && <div role="status" className="mt-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-200">{mensagem}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/15 px-5 py-3.5">
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
    </div>
  );
}

function Campo({ label, obrigatorio, className = "", children }: { label: string; obrigatorio?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.1em] text-muted-foreground">{label}{obrigatorio && <sup className="ml-1 text-primary">*</sup>}</span>{children}</label>;
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div className="flex items-start justify-between gap-4 border-t border-border/60 py-2 text-[11px]"><span className="text-muted-foreground">{label}</span><strong className="text-right text-foreground">{valor || "—"}</strong></div>;
}
