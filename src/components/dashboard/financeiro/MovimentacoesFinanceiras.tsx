import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  MailCheck,
  MailX,
  Plane,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EstadoVazio,
  EtiquetaStatus,
  formatarMoeda,
} from "@/components/dashboard/ComponentesDashboard";
import { AeronavePasta } from "@/components/ui/aeronavepasta";

import {
  buscarMovimentacoesFinanceiras,
  type PastaMovimentacoesFinanceiras,
} from "@/lib/colaborador-api";

/* =========================================================
   TIPOS
========================================================= */

type Despesa =
  PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];
type Pasta = PastaMovimentacoesFinanceiras;
type Voo = Pasta["voos"][number];

/** Campos opcionais: a tela continua funcionando mesmo se a API
 *  devolver alguns deles com nomes diferentes. */
type DespesaExpandida = Despesa & {
  fornecedor?: string | null;
  cliente?: string | null;
  cliente_nome?: string | null;
  cotista?: string | null;
  status_email?: string | null;
  email_status?: string | null;
  email_enviado?: boolean | null;
};

type Tone = "green" | "amber" | "red" | "blue" | "violet" | "neutral";
type FiltroStatus = "todos" | "pago" | "aberto" | "cancelado";

/* =========================================================
   HELPERS
========================================================= */

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null | undefined) {
  return status ? status.replace(/_/g, " ") : "Sem status";
}

function statusTone(status: string | null | undefined): Tone {
  const value = (status || "").toLowerCase();
  if (["pago", "aprovado", "recebido", "reembolsado", "convertido"].includes(value)) return "green";
  if (["cancelado", "reprovado", "estorno"].includes(value)) return "red";
  if (["pendente", "em_aberto", "aguardando_reembolso"].includes(value)) return "amber";
  if (["enviado", "email_enviado"].includes(value)) return "blue";
  return "neutral";
}

const obterCliente = (d: DespesaExpandida) =>
  d.cliente || d.cliente_nome || d.cotista || "Não informado";

const obterFornecedor = (d: DespesaExpandida) => d.fornecedor || "—";

function obterStatusEmail(d: DespesaExpandida) {
  const status = d.status_email || d.email_status;

  if (status) {
    const n = status.toLowerCase().replace(/_/g, " ").trim();
    if (n === "enviado" || n === "sent") return { label: "Enviado", enviado: true };
    if (["não enviado", "nao enviado", "not sent"].includes(n)) return { label: "Não enviado", enviado: false };
    return { label: status.replace(/_/g, " "), enviado: false };
  }

  if (d.email_enviado === true) return { label: "Enviado", enviado: true };
  return { label: "Não enviado", enviado: false };
}

function classeCaixa(caixa: string | null | undefined) {
  const v = (caixa || "").toUpperCase();
  if (v === "SHARE")
    return "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400 dark:ring-emerald-500/25";
  if (v === "CLIENTE")
    return "bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-400 dark:ring-sky-500/25";
  return "bg-secondary text-muted-foreground ring-border";
}

function passaFiltro(d: DespesaExpandida, filtro: FiltroStatus) {
  if (filtro === "todos") return true;
  const tone = statusTone(d.status);
  if (filtro === "pago") return tone === "green";
  if (filtro === "aberto") return tone === "amber";
  return tone === "red";
}

const FILTROS: Array<{ id: FiltroStatus; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "pago", label: "Pagos" },
  { id: "aberto", label: "Em aberto" },
  { id: "cancelado", label: "Cancelados" },
];

/* =========================================================
   PEÇAS VISUAIS
========================================================= */

function BadgeCaixa({ valor, compacto = false }: { valor?: string | null; compacto?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md font-bold uppercase tracking-wide ring-1 ring-inset ${classeCaixa(valor)} ${compacto ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
        }`}
    >
      <span className="truncate">{valor || "—"}</span>
    </span>
  );
}

function StatusEmail({ enviado, label, tamanho = 12 }: { enviado: boolean; label: string; tamanho?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${enviado ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"
        }`}
    >
      {enviado ? <MailCheck size={tamanho} className="shrink-0" /> : <MailX size={tamanho} className="shrink-0" />}
      {label}
    </span>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{titulo}</p>
      <p className={`mt-1 truncate font-mono text-lg font-bold tabular-nums ${destaque || "text-foreground"}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

/* =========================================================
   TABELA
========================================================= */

function DespesasTabela({ despesas }: { despesas: Despesa[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");

  const lista = useMemo(() => despesas as DespesaExpandida[], [despesas]);

  const resumo = useMemo(() => {
    let total = 0;
    let pago = 0;
    let aberto = 0;
    let emails = 0;
    for (const d of lista) {
      const valor = Number(d.valor) || 0;
      const tone = statusTone(d.status);
      total += valor;
      if (tone === "green") pago += valor;
      if (tone === "amber") aberto += valor;
      if (obterStatusEmail(d).enviado) emails += 1;
    }
    return { total, pago, aberto, emails };
  }, [lista]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((d) => {
      if (!passaFiltro(d, filtro)) return false;
      if (!termo) return true;
      return [d.numero_doc, d.descricao, obterFornecedor(d), obterCliente(d), d.tipo_caixa, d.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [lista, busca, filtro]);

  const totalFiltrado = useMemo(
    () => filtradas.reduce((soma, d) => soma + (Number(d.valor) || 0), 0),
    [filtradas],
  );

  const filtrando = busca.trim() !== "" || filtro !== "todos";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Total do voo" valor={formatarMoeda(resumo.total)} detalhe={`${lista.length} ${lista.length === 1 ? "lançamento" : "lançamentos"}`} />
        <Indicador titulo="Pago" valor={formatarMoeda(resumo.pago)} destaque="text-emerald-500" />
        <Indicador titulo="Em aberto" valor={formatarMoeda(resumo.aberto)} destaque="text-amber-500" />
        <Indicador titulo="E-mails enviados" valor={`${resumo.emails} de ${lista.length}`} />
      </div>

      <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Barra de ferramentas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/10 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <h3 className="truncate text-sm font-semibold text-foreground md:text-base">Transações financeiras</h3>
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {filtrando ? `${filtradas.length} de ${lista.length}` : `${lista.length} ${lista.length === 1 ? "registro" : "registros"}`}
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Filtrar por status">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  aria-pressed={filtro === f.id}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${filtro === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar descrição, cliente, ID…"
                aria-label="Buscar nas transações"
                className="h-8 pl-8 pr-8 text-xs"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {!filtradas.length ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">Nenhuma transação encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou o filtro de status para ver mais resultados.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-8 text-xs"
              onClick={() => {
                setBusca("");
                setFiltro("todos");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop: sem scroll horizontal (larguras em %) */}
            <div className="hidden w-full lg:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>

                <thead className="bg-muted/5">
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    <th scope="col" className="px-3 py-3">ID / Data</th>
                    <th scope="col" className="px-3 py-3">Descrição / Fornecedor</th>
                    <th scope="col" className="px-3 py-3">Cliente</th>
                    <th scope="col" className="px-3 py-3">Caixa</th>
                    <th scope="col" className="px-3 py-3 text-right">Valor (R$)</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3">E-mail</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {filtradas.map((despesa) => {
                    const cliente = obterCliente(despesa);
                    const fornecedor = obterFornecedor(despesa);
                    const email = obterStatusEmail(despesa);

                    return (
                      <tr key={`${despesa.id}-${despesa.origem || "despesa"}`} className="transition-colors hover:bg-muted/20">
                        <td className="px-3 py-3 align-middle">
                          <div title={despesa.numero_doc || "Sem ID"} className="truncate font-semibold text-foreground">
                            {despesa.numero_doc || "Sem ID"}
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{dataBruta(despesa.data)}</div>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <div
                            title={despesa.descricao || "Despesa sem descrição"}
                            className="line-clamp-2 break-words font-semibold leading-snug text-foreground"
                          >
                            {despesa.descricao || "Despesa sem descrição"}
                          </div>
                          <div title={fornecedor} className="mt-0.5 truncate text-xs uppercase tracking-wide text-muted-foreground">
                            {fornecedor}
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <div title={cliente} className="truncate font-medium text-foreground">{cliente}</div>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <BadgeCaixa valor={despesa.tipo_caixa} />
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-right align-middle font-mono font-semibold tabular-nums text-foreground">
                          {formatarMoeda(Number(despesa.valor) || 0)}
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <EtiquetaStatus tone={statusTone(despesa.status)}>{statusLabel(despesa.status)}</EtiquetaStatus>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <StatusEmail enviado={email.enviado} label={email.label} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t border-border bg-muted/10">
                    <td colSpan={4} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {filtrando ? "Total filtrado" : "Total"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                      {formatarMoeda(totalFiltrado)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile / tablet: cartões */}
            <div className="grid w-full gap-3 p-3 lg:hidden">
              {filtradas.map((despesa) => {
                const cliente = obterCliente(despesa);
                const email = obterStatusEmail(despesa);

                return (
                  <article key={`${despesa.id}-${despesa.origem || "despesa"}`} className="min-w-0 rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-xs font-semibold text-foreground" title={despesa.descricao || "Despesa sem descrição"}>
                          {despesa.descricao || "Despesa sem descrição"}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground" title={obterFornecedor(despesa)}>
                          {obterFornecedor(despesa)} · {despesa.numero_doc || "Sem ID"} · {dataBruta(despesa.data)}
                        </p>
                      </div>
                      <p className="shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                        {formatarMoeda(Number(despesa.valor) || 0)}
                      </p>
                    </div>

                    <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border/60 pt-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
                        <p className="break-words text-[11px] font-medium text-foreground">{cliente}</p>
                      </div>
                      <div className="text-right">
                        <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Caixa</p>
                        <BadgeCaixa valor={despesa.tipo_caixa} compacto />
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2">
                      <EtiquetaStatus tone={statusTone(despesa.status)}>{statusLabel(despesa.status)}</EtiquetaStatus>
                      <StatusEmail enviado={email.enviado} label={email.label} />
                    </div>
                  </article>
                );
              })}

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-3 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{filtrando ? "Total filtrado" : "Total"}</span>
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">{formatarMoeda(totalFiltrado)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   PÁGINA
========================================================= */

export default function MovimentacoesFinanceiras({ aoVoltar }: { aoVoltar: () => void }) {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [pastaAberta, setPastaAberta] = useState<string | null>(null);
  const [vooAberto, setVooAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await buscarMovimentacoesFinanceiras();
      setPastas(resposta.pastas || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setErro("Não foi possível carregar as movimentações financeiras. Clique em Atualizar para tentar de novo.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const pastaSelecionada = useMemo(
    () => pastas.find((p) => p.id === pastaAberta) || null,
    [pastas, pastaAberta],
  );

  const vooSelecionado = useMemo(
    () => pastaSelecionada?.voos.find((v) => v.numero_voo === vooAberto) || null,
    [pastaSelecionada, vooAberto],
  );

  const subirTopo = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const abrirPasta = (id: string) => {
    setPastaAberta(id);
    setVooAberto(null);
    subirTopo();
  };

  const abrirVoo = (numero: string) => {
    setVooAberto(numero);
    subirTopo();
  };

  const voltar = () => {
    if (vooAberto) return setVooAberto(null);
    if (pastaAberta) return setPastaAberta(null);
    aoVoltar();
  };

  return (
    <div className="route-enter min-w-0 space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Navegação" className="flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-[.16em]">
            <span className="text-primary">Financeiro / Movimentações</span>
            {pastaSelecionada && (
              <>
                <ChevronRight size={11} className="text-muted-foreground" />
                <button type="button" onClick={() => setVooAberto(null)} className="max-w-[200px] truncate text-muted-foreground hover:text-foreground">
                  {pastaSelecionada.nome}
                </button>
              </>
            )}
            {vooSelecionado && (
              <>
                <ChevronRight size={11} className="text-muted-foreground" />
                <span className="text-foreground">Voo {vooSelecionado.numero_voo}</span>
              </>
            )}
          </nav>

          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Todas as movimentações financeiras</h1>
          <p className="mt-1 text-xs text-muted-foreground">Consulte despesas organizadas por cotista e número de voo.</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={voltar}>
            <ArrowLeft size={14} />
            Voltar
          </Button>
          <Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-300">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : !pastaSelecionada ? (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-bold">Pastas de cotistas</p>
            <p className="mt-1 text-xs text-muted-foreground">Abra uma pasta para consultar somente os voos e despesas daquele cotista.</p>
          </div>

          {!pastas.length ? (
            <EstadoVazio label="Nenhuma movimentação financeira encontrada" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastas.map((pasta) => (
                <AeronavePasta key={pasta.id} label={pasta.nome} count={pasta.quantidade} isOpen={false} onClick={() => abrirPasta(pasta.id)} />
              ))}
            </div>
          )}
        </section>
      ) : !vooSelecionado ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pasta do cotista</p>
              <h2 className="truncate text-xl font-extrabold tracking-tight">{pastaSelecionada.nome}</h2>
            </div>
          </div>

          {!pastaSelecionada.voos.length ? (
            <EstadoVazio label="Nenhum voo com despesas vinculadas" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastaSelecionada.voos.map((voo: Voo) => (
                <AeronavePasta key={voo.numero_voo} label={`Voo ${voo.numero_voo}`} count={voo.quantidade} isOpen={false} onClick={() => abrirVoo(voo.numero_voo)} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <Plane className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{pastaSelecionada.nome}</p>
              <h2 className="text-xl font-extrabold tracking-tight">Voo {vooSelecionado.numero_voo}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {vooSelecionado.quantidade} {vooSelecionado.quantidade === 1 ? "despesa vinculada" : "despesas vinculadas"}
              </p>
            </div>
          </div>

          <DespesasTabela despesas={vooSelecionado.despesas} />
        </section>
      )}
    </div>
  );
}