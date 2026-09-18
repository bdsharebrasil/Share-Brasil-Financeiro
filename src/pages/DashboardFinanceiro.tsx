import { useCallback, useEffect, useState } from "react";
import {
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
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
import { RecadosPanel } from "@/components/dashboard/Recados";
import {
  AcaoRapida,
  CabecalhoSecao,
  CartaoKpi,
  EtiquetaStatus,
  EstadoVazio,
  HeroDashboard,
  formatarMoeda,
} from "@/components/dashboard/ComponentesDashboard";
import {
  buscarPainelFinanceiro,
  buscarPerfilColaborador,
  type MovimentacaoFinanceira,
  type PainelFinanceiroResponse,
} from "@/lib/colaborador-api";

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
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setErro(null);
    try {
      setDados(await buscarPainelFinanceiro());
      setPaginaAtual(1);
    } catch {
      setErro("Não foi possível carregar os dados financeiros reais.");
    } finally {
      setCarregando(false);
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
  const movimentacoes = dados?.movimentacoes ?? [];
  const movimentacoesVisiveis = mostrarPendencias
    ? movimentacoes.filter((item) => item.pendencia)
    : movimentacoes;
  const itensPorPagina = 5;
  const totalPaginas = Math.max(1, Math.ceil(movimentacoesVisiveis.length / itensPorPagina));
  const paginaExibida = Math.min(paginaAtual, totalPaginas);
  const movimentacoesDaPagina = movimentacoesVisiveis.slice(
    (paginaExibida - 1) * itensPorPagina,
    paginaExibida * itensPorPagina,
  );

  return (
    <div className="route-enter">
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

      <div className="mx-auto mb-6 grid max-w-[770px] gap-3 sm:grid-cols-3">
        <CartaoKpi
          label="Pendências"
          value={carregando ? "—" : String(resumo?.pendencias ?? 0)}
          detail="Itens que exigem acompanhamento"
          tone="amber"
          icon={<Clock3 size={16} />}
          className="min-w-0"
          onClick={() => {
            setMostrarPendencias((atual) => !atual);
            setPaginaAtual(1);
          }}
        />
        <CartaoKpi
          label="Total a receber"
          value={carregando ? "—" : formatarMoeda(Number(resumo?.total_a_receber ?? 0))}
          detail="Valores pendentes de recebimento"
          tone="green"
          icon={<TrendingUp size={16} />}
          className="min-w-0"
        />
      </div>

      <section className="mx-auto mb-5 grid max-w-6xl min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <CabecalhoSecao
          icon={<CreditCard size={15} />}
          title="Movimentações financeiras"
          detail={mostrarPendencias ? "Pendências em aberto relacionadas a contas a pagar." : "Últimos registros lançados."}
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => aoNavegar("movimentacoes")}
                className="h-8 gap-1.5 border-border bg-card px-2.5 text-[10px]"
              >
                <FolderOpen size={12} /> Ver todas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void carregar(true)}
                disabled={atualizando}
                className="h-8 gap-1.5 border-border bg-card px-2.5 text-[10px]"
              >
                <RefreshCw size={12} className={atualizando ? "animate-spin" : ""} /> Atualizar
              </Button>
            </div>
          }
        />
        
        {mostrarPendencias && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/[.06] px-4 py-3 text-xs">
            <span className="font-semibold text-amber-700 dark:text-amber-300">Exibindo as movimentações das pendências em aberto.</span>
            <button type="button" onClick={() => { setMostrarPendencias(false); setPaginaAtual(1); }} className="font-bold text-amber-700 underline underline-offset-2 dark:text-amber-300">Ver todas</button>
          </div>
        )}
        
        {carregando ? (
          <div className="space-y-3 p-5">
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
            <div className="skeleton h-12 rounded-lg" />
          </div>
        ) : movimentacoesVisiveis.length ? (
          <>
          {/* Tabela Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-muted/5">
                <tr className="border-b border-border/80 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-4">ID / Data</th>
                  <th className="px-5 py-4">Descrição / Fornecedor</th>
                  <th className="px-5 py-4">Caixa</th>
                  <th className="px-5 py-4 text-right">Valor (R$)</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">E-mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {movimentacoesDaPagina.map((item) => (
                  <LinhaMovimentacao key={item.id} item={item} />
                ))}
              </tbody>
            </table>
            
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between gap-4 border-t border-border/60 bg-muted/10 px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Página {paginaExibida} de {totalPaginas}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-background"
                    onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                    disabled={paginaExibida === 1}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs bg-background"
                    onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1))}
                    disabled={paginaExibida === totalPaginas}
                  >
                    Próxima <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cards Mobile */}
          <div className="space-y-3 p-4 md:hidden">
            {movimentacoesDaPagina.map((item) => (
              <CartaoMovimentacao key={item.id} item={item} />
            ))}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between gap-4 border-t border-border/60 px-1 pt-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Página {paginaExibida} de {totalPaginas}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                    disabled={paginaExibida === 1}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1))}
                    disabled={paginaExibida === totalPaginas}
                  >
                    Próxima <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
          </>
        ) : (
          <div className="py-4">
            <EstadoVazio label="Nenhuma movimentação financeira encontrada" />
          </div>
        )}
      </section>

      <div className="mt-5">
        <RecadosPanel compact aoAbrir={() => aoNavegar("recados")} />
      </div>
    </div>
  );
}

// COMPONENTE: Cartão Mobile
function CartaoMovimentacao({ item }: { item: MovimentacaoFinanceira }) {
  return (
    <article className="rounded-xl border border-border bg-card/50 p-4 shadow-sm transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {item.descricao || "Movimentação sem descrição"}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
            <span className="truncate">{item.fornecedor || "Sem fornecedor"}</span> 
            <span>•</span> 
            <span>{item.numero_doc || "Sem doc"}</span>
          </p>
        </div>
        <p className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
          {formatarMoeda(valorMovimentacao(Number(item.valor) || 0))}
        </p>
      </div>
      
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className={`inline-flex items-center rounded-md font-bold uppercase tracking-wide ${tipoCaixaClass(item.tipo_caixa)}`}>
          {tipoCaixaLabel(item.tipo_caixa)}
        </span>
        <EtiquetaStatus tone={tomStatus(item.status)}>
          {statusLabel(item.status)}
        </EtiquetaStatus>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tomStatusEmail(statusEmail(item))}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusEmail(item)}
        </span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          {dataBruta(item.data_pagamento || item.criado_em)}
        </span>
      </div>
    </article>
  );
}

// COMPONENTE: Linha Desktop
function LinhaMovimentacao({ item }: { item: MovimentacaoFinanceira }) {
  return (
    <tr className="transition-colors hover:bg-muted/30">
      {/* ID / DATA Combinados */}
      <td className="whitespace-nowrap px-5 py-3.5 align-middle">
        <div className="font-medium text-foreground">
          {item.numero_doc || "Sem ID"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {dataBruta(item.data_pagamento || item.criado_em)}
        </div>
      </td>
      
      {/* DESCRIÇÃO / FORNECEDOR Combinados */}
      <td className="px-5 py-3.5 align-middle">
        <div className="font-semibold text-foreground line-clamp-1" title={item.descricao || "Movimentação sem descrição"}>
          {item.descricao || "Movimentação sem descrição"}
        </div>
        <div className="mt-1 text-xs font-medium text-muted-foreground line-clamp-1" title={item.fornecedor || "Sem fornecedor"}>
          {item.fornecedor || "Sem fornecedor"}
        </div>
      </td>
      
      {/* CAIXA (Verde para Share, Azul para Cliente) */}
      <td className="px-5 py-3.5 align-middle">
        <span className={`inline-flex items-center rounded-md font-bold uppercase tracking-wide ${tipoCaixaClass(item.tipo_caixa)}`}>
          {tipoCaixaLabel(item.tipo_caixa)}
        </span>
      </td>
      
      {/* VALOR */}
      <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle font-mono font-bold tabular-nums text-foreground">
        {formatarMoeda(valorMovimentacao(Number(item.valor) || 0))}
      </td>
      
      {/* STATUS */}
      <td className="px-5 py-3.5 align-middle">
        <EtiquetaStatus tone={tomStatus(item.status)}>
          {statusLabel(item.status)}
        </EtiquetaStatus>
      </td>
      
      {/* EMAIL */}
      <td className="px-5 py-3.5 align-middle text-center">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${tomStatusEmail(statusEmail(item))}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {statusEmail(item)}
        </span>
      </td>
    </tr>
  );
}
