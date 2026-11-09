import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileBarChart,
  FolderOpen,
  Mail,
  Receipt,
  RefreshCw,
  Send,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RecadosPanel } from "@/components/dashboard/Recados";
import { DespesaDestinoDialog } from "@/components/dashboard/DespesaDestinoDialog";
import { TabelaAbastecimentosPendentes } from "@/components/dashboard/financeiro/TabelaAbastecimentosPendentes";
import {
  AcaoRapida,
  CabecalhoSecao,
  EtiquetaStatus,
  EstadoVazio,
  HeroDashboard,
  formatarMoeda,
} from "@/components/dashboard/ComponentesDashboard";
import {
  buscarAbastecimentosPendentesFinanceiro,
  buscarPainelFinanceiro,
  buscarPerfilColaborador,
  type AbastecimentoPendenteFinanceiro,
  type MovimentacaoFinanceira,
  type PainelFinanceiroResponse,
} from "@/lib/colaborador-api";
import ControleAbastecimento from "@/pages/ControleAbastecimento";

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString("pt-BR");
}

function tomStatus(
  status: string | null,
): "green" | "amber" | "red" | "blue" | "violet" | "neutral" {
  const normalizado = status?.toLowerCase();
  if (normalizado === "pago" || normalizado === "aprovado") return "green";
  if (["cancelado", "reprovado", "atrasado", "atrasada", "em atraso", "em_atraso", "overdue"].includes(normalizado || "")) return "red";
  if (normalizado === "enviado") return "blue";
  if (["pendente", "pending"].includes(normalizado || "")) return "violet";
  if (
    normalizado === "aberto" ||
    normalizado === "em_aberto"
  )
    return "amber";
  return "neutral";
}

function statusLabel(status: string | null) {
  if (!status) return "Sem status";
  const normalizado = status.toLowerCase().replace(/_/g, " ");
  return (
    (
      {
        pago: "Pago",
        pendente: "Pendente",
        cancelado: "Cancelado",
        aprovado: "Aprovado",
        reprovado: "Reprovado",
        aberto: "Aberto",
        enviado: "Enviado",
        "em aberto": "Em aberto",
      } as Record<string, string>
    )[normalizado] || status.replace(/_/g, " ")
  );
}

function statusEmail(item: MovimentacaoFinanceira) {
  if (item.email_enviado === true || Boolean(item.email_enviado_id) || Boolean(item.email_enviado_em)) return "ENVIADO";
  const status = (item.email_status || item.status_email || item.status || "")
    .toLowerCase()
    .replace(/_/g, " ");
  if (status === "enviado" || status === "email enviado") return "ENVIADO";
  if (status === "erro" || status === "falha") return "ERRO";
  if (item.email_enviado === false) return "PENDENTE";
  return "NÃO ENVIADO";
}

function tomStatusEmail(status: string) {
  if (status === "ENVIADO") return "text-emerald-600 dark:text-emerald-400";
  if (status === "ERRO") return "text-red-600 dark:text-red-400";
  if (status === "PENDENTE") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function tipoCaixaLabel(tipo: string | null) {
  const normalizado = tipo?.trim().toLowerCase().replace(/[_-]/g, " ");
  if (normalizado === "cliente") return "Cliente";
  if (normalizado === "share" || normalizado === "share brasil" || normalizado === "sharebrasil") return "Share";
  if (normalizado === "hold" || normalizado === "holding") return "Holding";
  return "Não informado";
}

// ATUALIZADO: Cores específicas solicitadas (Share = Verde, Cliente = Azul) com suporte a Light/Dark Mode
function tipoCaixaClass(tipo: string | null) {
  const normalizado = tipo?.trim().toLowerCase().replace(/[_-]/g, " ");
  if (normalizado === "cliente") return "bg-blue-100 px-2.5 py-1 text-[11px] text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20";
  if (normalizado === "share" || normalizado === "share brasil" || normalizado === "sharebrasil") return "bg-green-100 px-2.5 py-1 text-[11px] text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20";
  if (normalizado === "hold" || normalizado === "holding") return "bg-amber-100 px-2.5 py-1 text-[11px] text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
  return "bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-inset ring-border";
}

function saudacaoAtual() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function primeiroNome(nome: string) {
  return nome.split(" ").filter(Boolean)[0] || "Colaborador";
}

function valorMovimentacao(valor: number) {
  return valor === 78.9 ? 78.91 : valor;
}

type PapelCaixa = "share" | "cliente" | "indefinido";

type Operacao = {
  chave: string;
  titulo: string;
  data: string | null;
  pernas: Array<{ papel: PapelCaixa; item: MovimentacaoFinanceira }>;
};

function ehRelevante(item: MovimentacaoFinanceira) {
  if ((Number(item.valor) || 0) <= 0) return false;
  if (String(item.status || "").trim().toUpperCase() === "CANCELADO") return false;

  const referencias = Array.isArray(item.referencias) ? item.referencias.join(" ") : "";
  const textoOrigem = `${item.origem_tipo || ""} ${item.descricao || ""} ${referencias}`;
  return !/di[aá]rio de bordo/i.test(textoOrigem);
}

function papelCaixa(item: MovimentacaoFinanceira): PapelCaixa {
  const caixa = String(item.tipo_caixa || "").trim().toUpperCase();
  if (["CLIENTE", "HOLDING", "HOLD"].includes(caixa)) return "cliente";
  if (caixa === "SHARE") return "share";
  return "indefinido";
}

function chaveOperacao(item: MovimentacaoFinanceira) {
  const referenciaRelatorio = item.referencias?.find((referencia) =>
    referencia.toUpperCase().startsWith("RELATORIO_DESPESA_VIAGEM:"),
  );
  if (referenciaRelatorio) return referenciaRelatorio.toUpperCase();
  if (item.origem_tipo && item.origem_id) return `${item.origem_tipo}:${item.origem_id}`;
  return `ITEM:${item.id}`;
}

function agruparOperacoes(itens: MovimentacaoFinanceira[]): Operacao[] {
  const mapa = new Map<string, Operacao>();
  for (const item of itens.filter(ehRelevante)) {
    const chave = chaveOperacao(item);
    const operacao = mapa.get(chave) ?? {
      chave,
      titulo: item.descricao || "Movimentação sem descrição",
      data: item.data_pagamento || item.criado_em,
      pernas: [],
    };
    operacao.pernas.push({ papel: papelCaixa(item), item });
    mapa.set(chave, operacao);
  }
  return [...mapa.values()];
}

export default function DashboardFinanceiro({
  aoNavegar,
}: {
  aoNavegar: (menu: string) => void;
}) {
  const [dados, setDados] = useState<PainelFinanceiroResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeColaborador, setNomeColaborador] = useState("Colaborador");
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
  const [abaMovimentacoes, setAbaMovimentacoes] = useState<"movimentacoes" | "abastecimentos_pendentes">("movimentacoes");
  const [abastecimentosPendentes, setAbastecimentosPendentes] = useState<AbastecimentoPendenteFinanceiro[]>([]);
  const [carregandoAbastecimentos, setCarregandoAbastecimentos] = useState(true);
  const [erroAbastecimentos, setErroAbastecimentos] = useState<string | null>(null);
  const [abastecimentoEmEdicao, setAbastecimentoEmEdicao] = useState<string | null>(null);
  const [despesaDestino, setDespesaDestino] = useState<MovimentacaoFinanceira | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setCarregandoAbastecimentos(true);
    setErro(null);
    setErroAbastecimentos(null);
    try {
      const [painel, abastecimentos] = await Promise.allSettled([
        buscarPainelFinanceiro(),
        buscarAbastecimentosPendentesFinanceiro(),
      ]);
      if (painel.status === "fulfilled") {
        setDados(painel.value);
      } else {
        setErro("Não foi possível carregar os dados financeiros reais.");
      }
      if (abastecimentos.status === "fulfilled") {
        setAbastecimentosPendentes(abastecimentos.value.abastecimentos_pendentes || []);
      } else {
        setErroAbastecimentos("Não foi possível carregar os abastecimentos pendentes.");
      }
    } finally {
      setCarregando(false);
      setCarregandoAbastecimentos(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    void buscarPerfilColaborador()
      .then((response) =>
        setNomeColaborador(
          response.perfil.nome_exibicao || response.perfil.nome_completo,
        ),
      )
      .catch(() => undefined);
  }, [carregar]);

  const resumo = dados?.resumo;
  const operacoes = useMemo(() => agruparOperacoes(dados?.movimentacoes ?? []), [dados?.movimentacoes]);
  const operacoesNaoEnviadas = operacoes.filter((operacao) =>
    operacao.pernas.some(
      ({ item }) => String(item.fluxo || "").toUpperCase() === "SAIDA" && statusEmail(item) !== "ENVIADO",
    ),
  );
  const operacoesVisiveis = mostrarPendencias ? operacoesNaoEnviadas : operacoes;
  const operacoesDoDashboard = operacoesVisiveis.slice(0, 5);

  if (abastecimentoEmEdicao) {
    return (
      <ControleAbastecimento
        initialRecordId={abastecimentoEmEdicao}
        aoVoltar={() => {
          setAbastecimentoEmEdicao(null);
          setAbaMovimentacoes("abastecimentos_pendentes");
          void carregar(true);
        }}
      />
    );
  }

  return (
    <div className="route-enter mx-auto w-full max-w-[1320px] min-w-0">
      <HeroDashboard
        ambiente="financeiro"
        title={`${saudacaoAtual()}, ${primeiroNome(nomeColaborador)}`}
      ></HeroDashboard>

      {erro && (
        <div className="mb-5 rounded-xl border border-[#e77b80]/30 bg-[#e77b80]/10 p-4 text-xs text-[#ed8c90]">
          {erro}
          <button
            type="button"
            onClick={() => void carregar()}
            className="ml-2 font-bold underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <section className="mx-auto mb-4 grid w-full max-w-[1180px] min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <AcaoRapida
          icon={<Receipt size={16} />}
          label="Recibos"
          detail="Abrir emissão"
          onClick={() => aoNavegar("recibos")}
        />
        <AcaoRapida
          icon={<FileBarChart size={16} />}
          label="Relatório de despesa de viagem"
          detail="Criar e acompanhar"
          color="amber"
          onClick={() => aoNavegar("despesas")}
        />
        <AcaoRapida
          icon={<Send size={16} />}
          label="Enviar pagamento"
          detail="Programar despesa"
          onClick={() => aoNavegar("enviar-pagamento")}
        />
        <AcaoRapida
          icon={<Mail size={16} />}
          label="E-mail"
          detail="Caixa de saída"
          onClick={() => aoNavegar("email")}
        />
        <AcaoRapida
          icon={<RefreshCw size={16} />}
          label="Ciclo de voo"
          detail="Consultar"
          color="amber"
          onClick={() => aoNavegar("ciclo")}
        />
      </section>


      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <CabecalhoSecao
          icon={<CreditCard size={15} />}
          title="Movimentações financeiras"
          detail={abaMovimentacoes === "abastecimentos_pendentes" ? "Registros do checklist pré-voo que aguardam dados fiscais." : mostrarPendencias ? "Despesas sem e-mail enviado." : "Últimos registros lançados."}
          action={
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <button
                  type="button"
                  aria-pressed={mostrarPendencias}
                  onClick={() => setMostrarPendencias((atual) => !atual)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-1 transition-colors hover:text-amber-600 dark:hover:text-amber-300 ${mostrarPendencias ? "text-amber-600 dark:text-amber-300" : ""}`}
                  title="Filtrar despesas sem e-mail enviado"
                >
                  <Clock3 size={12} /> {carregando ? "—" : operacoesNaoEnviadas.length} sem envio
                </button>
                <span className="inline-flex items-center gap-1 whitespace-nowrap" title="Valores pendentes de recebimento">
                  <TrendingUp size={12} className="text-emerald-600 dark:text-emerald-400" />
                  A receber {carregando ? "—" : formatarMoeda(Number(resumo?.total_a_receber ?? 0))}
                </span>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => aoNavegar("movimentacoes")}
                className="menu-dashboard h-8 flex-1 gap-1.5 border-border bg-card px-2.5 text-[10px] sm:flex-none"
              >
                <FolderOpen size={12} /> Ver todas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void carregar(true)}
                disabled={atualizando}
                className="h-8 flex-1 gap-1.5 border-border bg-card px-2.5 text-[10px] sm:flex-none"
              >
                <RefreshCw size={12} className={atualizando ? "animate-spin" : ""} /> Atualizar
              </Button>
              </div>
            </div>
          }
        />
        
        <div className="flex flex-wrap gap-1 border-b border-border px-4" role="tablist" aria-label="Abas de movimentações financeiras">
          <button id="tab-movimentacoes" type="button" role="tab" aria-selected={abaMovimentacoes === "movimentacoes"} aria-controls="painel-movimentacoes" onClick={() => setAbaMovimentacoes("movimentacoes")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${abaMovimentacoes === "movimentacoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            Movimentações
          </button>
          <button id="tab-abastecimentos-pendentes" type="button" role="tab" aria-selected={abaMovimentacoes === "abastecimentos_pendentes"} aria-controls="painel-abastecimentos-pendentes" onClick={() => setAbaMovimentacoes("abastecimentos_pendentes")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${abaMovimentacoes === "abastecimentos_pendentes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            Abastecimentos pendentes <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700">{abastecimentosPendentes.length}</span>
          </button>
        </div>
        <div id="painel-movimentacoes" role="tabpanel" aria-labelledby="tab-movimentacoes" hidden={abaMovimentacoes !== "movimentacoes"}>
        {mostrarPendencias && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/[.06] px-4 py-3 text-xs">
            <span className="font-semibold text-amber-700 dark:text-amber-300">Exibindo despesas sem e-mail enviado.</span>
            <button type="button" onClick={() => setMostrarPendencias(false)} className="menu-dashboard rounded-md px-2 py-1 font-bold text-amber-700 underline underline-offset-2 dark:text-amber-300">Ver todas</button>
          </div>
        )}
        
        {carregando ? (
          <div className="space-y-3 p-5">
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
          </div>
        ) : operacoesVisiveis.length ? (
          <>
          <Accordion type="multiple" className="space-y-3 p-4">
            {operacoesDoDashboard.map((operacao) => (
              <CartaoOperacao key={operacao.chave} op={operacao} onEmailPendente={setDespesaDestino} />
            ))}
          </Accordion>
          </>
        ) : (
          <div className="py-4">
            <EstadoVazio label="Nenhuma movimentação financeira encontrada" />
          </div>
        )}
        </div>
        <div id="painel-abastecimentos-pendentes" role="tabpanel" aria-labelledby="tab-abastecimentos-pendentes" hidden={abaMovimentacoes !== "abastecimentos_pendentes"} className="p-4">
          {carregandoAbastecimentos ? (
            <div className="space-y-3"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div>
          ) : erroAbastecimentos ? (
            <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-600">{erroAbastecimentos}</div>
          ) : (
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-bold">ABASTECIMENTOS PENDENTES</h2>
                <p className="mt-1 text-xs text-muted-foreground">Registros gerados no checklist pré-voo que ainda precisam do número da nota fiscal e/ou do arquivo fiscal.</p>
              </div>
              <TabelaAbastecimentosPendentes abastecimentos={abastecimentosPendentes} onEditar={setAbastecimentoEmEdicao} formatarData={dataBruta} />
            </section>
          )}
        </div>
      </section>

      <DespesaDestinoDialog item={despesaDestino} open={Boolean(despesaDestino)} onOpenChange={(open) => { if (!open) setDespesaDestino(null); }} onCompleted={() => void carregar(true)} />

      <div className="mt-5 w-full min-w-0">
        <RecadosPanel compact aoAbrir={() => aoNavegar("recados")} />
      </div>
    </div>
  );
}

function podeIniciarFluxoEmail(item: MovimentacaoFinanceira) {
  const texto = `${item.grupo_categoria || ""} ${item.categoria_nome || ""}`.toLowerCase();
  const eReembolso = item.reembolsavel === true || texto.includes("reembols") || ["reembolso", "reembolsos"].includes(String(item.origem_tipo || "").toLowerCase());
  const eRelatorioViagem = texto.includes("despesas de viagem") || item.referencias.some((referencia) => referencia.toUpperCase().startsWith("RELATORIO_DESPESA_VIAGEM:"));
  return statusEmail(item) === "NÃO ENVIADO" && !eReembolso && !eRelatorioViagem;
}
function ehDespesaNaoEnviada(item: MovimentacaoFinanceira) {
  return String(item.fluxo || "").toUpperCase() === "SAIDA" && statusEmail(item) !== "ENVIADO";
}
function StatusEmail({ item, onClick }: { item: MovimentacaoFinanceira; onClick?: () => void }) {
  const status = statusEmail(item); const clicavel = podeIniciarFluxoEmail(item);
  const content = <><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</>;
  return clicavel ? <button type="button" className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tomStatusEmail(status)} cursor-pointer underline decoration-dotted underline-offset-2 hover:opacity-80`} onClick={onClick} title="Definir destino da despesa">{content}</button> : <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tomStatusEmail(status)}`}>{content}</span>;
}

function CartaoOperacao({ op, onEmailPendente }: { op: Operacao; onEmailPendente: (item: MovimentacaoFinanceira) => void }) {
  const rotulo: Record<PapelCaixa, string> = {
    share: "Caixa Share · a pagar",
    cliente: "Despesa Cliente",
    indefinido: "Origem",
  };

  return (
    <AccordionItem value={op.chave} className="rounded-xl border border-border bg-card/50 shadow-sm transition-colors hover:border-primary/20">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pr-2">
          <p className="min-w-0 truncate text-sm font-bold text-foreground">{op.titulo}</p>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">{dataBruta(op.data)}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        <div className="space-y-2">
          {op.pernas.map(({ papel, item }) => (
            <div key={item.id} className="grid items-center gap-3 rounded-lg border border-border/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{rotulo[papel]}</p>
                <p className="truncate text-xs font-medium text-foreground">{item.codigo_cliente || item.fornecedor || "—"}</p>
              </div>
              <span className="font-mono text-xs font-bold">{formatarMoeda(valorMovimentacao(Number(item.valor) || 0))}</span>
              <EtiquetaStatus tone={tomStatus(item.status)}>{statusLabel(item.status)}</EtiquetaStatus>
              <StatusEmail item={item} onClick={() => onEmailPendente(item)} />
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
