import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FolderOpen,
  MailCheck,
  MailX,
  Plane,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

type Despesa =
  PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];
type Pasta = PastaMovimentacoesFinanceiras;
type Voo = Pasta["voos"][number];

type DespesaExpandida = Despesa & {
  fornecedor?: string | null;
  cliente?: string | null;
  cliente_nome?: string | null;
  cotista?: string | null;
  status_email?: string | null;
  email_status?: string | null;
  email_enviado?: boolean | null;
};

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";

  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "Sem status";

  const normalizado = status.toLowerCase().replace(/_/g, " ");
  const labels: Record<string, string> = {
    pago: "Pago",
    aprovado: "Aprovado",
    recebido: "Recebido",
    reembolsado: "Reembolsado",
    cancelado: "Cancelado",
    reprovado: "Reprovado",
    estorno: "Estorno",
    pendente: "Pendente",
    "em aberto": "Em aberto",
    "aguardando reembolso": "Aguardando reembolso",
    enviado: "Enviado",
  };

  return labels[normalizado] || status.replace(/_/g, " ");
}

function statusTone(
  status: string | null | undefined,
): "green" | "amber" | "red" | "blue" | "violet" | "neutral" {
  const value = (status || "").toLowerCase();

  if (["pago", "aprovado", "recebido", "reembolsado"].includes(value)) {
    return "green";
  }

  if (["cancelado", "reprovado", "estorno"].includes(value)) {
    return "red";
  }

  if (["pendente", "em_aberto", "aguardando_reembolso"].includes(value)) {
    return "amber";
  }

  if (value === "enviado") return "blue";
  return "neutral";
}

function obterCliente(despesa: DespesaExpandida) {
  return (
    despesa.cliente ||
    despesa.cliente_nome ||
    despesa.cotista ||
    "Não informado"
  );
}

function obterFornecedor(despesa: DespesaExpandida) {
  return despesa.fornecedor || "—";
}

function obterStatusEmail(despesa: DespesaExpandida) {
  const status = despesa.status_email || despesa.email_status;

  if (status) {
    const normalizado = status.toLowerCase().replace(/_/g, " ").trim();

    if (normalizado === "enviado" || normalizado === "sent") {
      return { label: "Enviado", enviado: true };
    }

    if (
      normalizado === "não enviado" ||
      normalizado === "nao enviado" ||
      normalizado === "not sent"
    ) {
      return { label: "Não enviado", enviado: false };
    }

    return {
      label: status.replace(/_/g, " "),
      enviado: false,
    };
  }

  if (despesa.email_enviado === true) {
    return { label: "Enviado", enviado: true };
  }

  return { label: "Não enviado", enviado: false };
}

function tipoCaixaLabel(tipo: string | null | undefined) {
  const normalizado = tipo?.trim().toLowerCase().replace(/[_-]/g, " ");

  if (normalizado === "cliente") return "Cliente";
  if (
    normalizado === "share" ||
    normalizado === "share brasil" ||
    normalizado === "sharebrasil"
  ) {
    return "Share";
  }
  if (normalizado === "hold" || normalizado === "holding") return "Holding";

  return tipo || "—";
}

function tipoCaixaClass(tipo: string | null | undefined) {
  const normalizado = tipo?.trim().toLowerCase().replace(/[_-]/g, " ");

  if (normalizado === "cliente") {
    return "bg-blue-100 text-blue-700 ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20";
  }

  if (
    normalizado === "share" ||
    normalizado === "share brasil" ||
    normalizado === "sharebrasil"
  ) {
    return "bg-green-100 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20";
  }

  if (normalizado === "hold" || normalizado === "holding") {
    return "bg-amber-100 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20";
  }

  return "bg-muted/40 text-muted-foreground ring-border";
}

function StatusEmail({ despesa }: { despesa: DespesaExpandida }) {
  const email = obterStatusEmail(despesa);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${email.enviado
          ? "text-emerald-500"
          : "text-slate-500 dark:text-slate-400"
        }`}
    >
      {email.enviado ? (
        <MailCheck size={12} className="shrink-0" />
      ) : (
        <MailX size={12} className="shrink-0" />
      )}
      {email.label}
    </span>
  );
}

function DespesasTabela({ despesas }: { despesas: Despesa[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[1040px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/[0.06] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h3 className="truncate text-sm font-semibold text-foreground md:text-[15px]">
            Transações financeiras recentes
          </h3>
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
            {despesas.length} {despesas.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      </div>

      {/* Desktop / notebook */}
      <div className="hidden w-full max-w-full overflow-x-auto xl:block">
        <table className="mx-auto w-[1000px] min-w-[1000px] table-fixed border-collapse text-left text-[13px]">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[380px]" />
            <col className="w-[82px]" />
            <col className="w-[82px]" />
            <col className="w-[118px]" />
            <col className="w-[110px]" />
            <col className="w-[138px]" />
          </colgroup>

          <thead className="bg-muted/[0.035]">
            <tr className="border-b border-border/80 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              <th className="whitespace-nowrap px-2.5 py-3.5">ID / Data</th>
              <th className="whitespace-nowrap px-2.5 py-3.5">
                Descrição / Fornecedor
              </th>
              <th className="whitespace-nowrap px-2.5 py-3.5">Cliente</th>
              <th className="whitespace-nowrap px-2.5 py-3.5 text-center">
                Caixa
              </th>
              <th className="whitespace-nowrap px-2.5 py-3.5 text-right">
                Valor (R$)
              </th>
              <th className="whitespace-nowrap px-2.5 py-3.5 text-center">
                Status
              </th>
              <th className="whitespace-nowrap px-2.5 py-3.5 text-center">
                E-mail
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {despesas.map((item) => {
              const despesa = item as DespesaExpandida;
              const cliente = obterCliente(despesa);
              const fornecedor = obterFornecedor(despesa);

              return (
                <tr
                  key={`${despesa.id}-${despesa.origem || "despesa"}`}
                  className="transition-colors hover:bg-muted/[0.18]"
                >
                  <td className="whitespace-nowrap px-2.5 py-3.5 align-middle">
                    <div
                      className="truncate font-semibold text-foreground"
                      title={despesa.numero_doc || "Sem ID"}
                    >
                      {despesa.numero_doc || "Sem ID"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {dataBruta(despesa.data)}
                    </div>
                  </td>

                  <td className="px-2.5 py-3.5 align-middle">
                    <div
                      className="truncate font-semibold text-foreground"
                      title={despesa.descricao || "Despesa sem descrição"}
                    >
                      {despesa.descricao || "Despesa sem descrição"}
                    </div>
                    <div
                      className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                      title={fornecedor}
                    >
                      {fornecedor}
                    </div>
                  </td>

                  <td className="px-2.5 py-3.5 align-middle">
                    <div
                      className="truncate text-[12px] font-medium text-foreground"
                      title={cliente}
                    >
                      {cliente}
                    </div>
                  </td>

                  <td className="px-2.5 py-3.5 text-center align-middle">
                    <span
                      className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${tipoCaixaClass(
                        despesa.tipo_caixa,
                      )}`}
                    >
                      <span className="truncate">
                        {tipoCaixaLabel(despesa.tipo_caixa)}
                      </span>
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-2.5 py-3.5 text-right align-middle font-mono text-[12px] font-bold tabular-nums text-foreground">
                    {formatarMoeda(Number(despesa.valor) || 0)}
                  </td>

                  <td className="px-2.5 py-3.5 text-center align-middle">
                    <EtiquetaStatus tone={statusTone(despesa.status)}>
                      {statusLabel(despesa.status)}
                    </EtiquetaStatus>
                  </td>

                  <td className="px-2.5 py-3.5 text-center align-middle">
                    <StatusEmail despesa={despesa} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tablet / mobile */}
      <div className="grid w-full gap-2.5 p-3 xl:hidden sm:p-4">
        {despesas.map((item) => {
          const despesa = item as DespesaExpandida;
          const cliente = obterCliente(despesa);

          return (
            <article
              key={`${despesa.id}-${despesa.origem || "despesa"}`}
              className="min-w-0 rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-sm"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-xs font-semibold text-foreground"
                    title={despesa.descricao || "Despesa sem descrição"}
                  >
                    {despesa.descricao || "Despesa sem descrição"}
                  </p>
                  <p
                    className="mt-1 truncate text-[10px] text-muted-foreground"
                    title={obterFornecedor(despesa)}
                  >
                    {obterFornecedor(despesa)} · {despesa.numero_doc || "Sem ID"} ·{" "}
                    {dataBruta(despesa.data)}
                  </p>
                </div>

                <p className="shrink-0 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                  {formatarMoeda(Number(despesa.valor) || 0)}
                </p>
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-border/60 pt-2.5">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </p>
                  <p className="truncate text-[11px] font-medium text-foreground">
                    {cliente}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Caixa
                  </p>
                  <span
                    className={`mt-0.5 inline-flex max-w-full items-center rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${tipoCaixaClass(
                      despesa.tipo_caixa,
                    )}`}
                  >
                    <span className="truncate">
                      {tipoCaixaLabel(despesa.tipo_caixa)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-2.5">
                <EtiquetaStatus tone={statusTone(despesa.status)}>
                  {statusLabel(despesa.status)}
                </EtiquetaStatus>
                <StatusEmail despesa={despesa} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function MovimentacoesFinanceiras({
  aoVoltar,
}: {
  aoVoltar: () => void;
}) {
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
      setErro("Não foi possível carregar todas as movimentações financeiras.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const pastaSelecionada = useMemo(() => {
    return pastas.find((pasta) => pasta.id === pastaAberta) || null;
  }, [pastas, pastaAberta]);

  const vooSelecionado = useMemo(() => {
    return (
      pastaSelecionada?.voos.find((voo) => voo.numero_voo === vooAberto) || null
    );
  }, [pastaSelecionada, vooAberto]);

  const abrirPasta = (id: string) => {
    setPastaAberta(id);
    setVooAberto(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const abrirVoo = (numero: string) => {
    setVooAberto(numero);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const voltar = () => {
    if (vooAberto) {
      setVooAberto(null);
      return;
    }

    if (pastaAberta) {
      setPastaAberta(null);
      return;
    }

    aoVoltar();
  };

  return (
    <div className="route-enter mx-auto w-full max-w-[1180px] min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">
            Financeiro / Movimentações
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">
            Todas as movimentações financeiras
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Consulte despesas organizadas por cotista e número de voo.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 text-xs"
            onClick={voltar}
          >
            <ArrowLeft size={14} />
            Voltar
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 text-xs"
            onClick={() => void carregar()}
            disabled={carregando}
          >
            <RefreshCw
              size={14}
              className={carregando ? "animate-spin" : ""}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-600">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="space-y-3">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : !pastaSelecionada ? (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-bold">Pastas de cotistas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Abra uma pasta para consultar somente os voos e despesas daquele
              cotista.
            </p>
          </div>

          {!pastas.length ? (
            <EstadoVazio label="Nenhuma movimentação financeira encontrada" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastas.map((pasta) => (
                <AeronavePasta
                  key={pasta.id}
                  label={pasta.nome}
                  count={pasta.quantidade}
                  isOpen={false}
                  onClick={() => abrirPasta(pasta.id)}
                />
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
              <h2 className="truncate text-xl font-extrabold tracking-tight">
                {pastaSelecionada.nome}
              </h2>
            </div>
          </div>

          {!pastaSelecionada.voos.length ? (
            <EstadoVazio label="Nenhum voo com despesas vinculadas" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastaSelecionada.voos.map((voo: Voo) => (
                <AeronavePasta
                  key={voo.numero_voo}
                  label={`Voo ${voo.numero_voo}`}
                  count={voo.quantidade}
                  isOpen={false}
                  onClick={() => abrirVoo(voo.numero_voo)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <Plane className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {pastaSelecionada.nome}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight">
                Voo {vooSelecionado.numero_voo}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {vooSelecionado.quantidade}{" "}
                {vooSelecionado.quantidade === 1
                  ? "despesa vinculada"
                  : "despesas vinculadas"}
              </p>
            </div>
          </div>

          <DespesasTabela despesas={vooSelecionado.despesas} />
        </section>
      )}
    </div>
  );
}
