import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  FolderOpen,
  Mail,
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
import { TabelaAbastecimentosPendentes } from "@/components/dashboard/financeiro/TabelaAbastecimentosPendentes";

import {
  buscarMovimentacoesFinanceiras,
  type AbastecimentoPendenteFinanceiro,
  type PastaMovimentacoesFinanceiras,
} from "@/lib/colaborador-api";
import ControleAbastecimento from "@/pages/ControleAbastecimento";

/* =========================================================
   TIPOS
========================================================= */

type Despesa =
  PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];

type Pasta = PastaMovimentacoesFinanceiras;
type Voo = Pasta["voos"][number];

/**
 * Campos extras opcionais.
 *
 * Isso permite que a tela continue funcionando mesmo se sua API
 * estiver retornando alguns desses campos com nomes diferentes.
 */
type DespesaExpandida = Despesa & {
  fornecedor?: string | null;
  fornecedor_nome?: string | null;

  status_email?: string | null;
  email_status?: string | null;
  email_enviado?: boolean | null;
};

/* =========================================================
   HELPERS
========================================================= */

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";

  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);

  return Number.isNaN(data.getTime())
    ? valor
    : data.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null | undefined) {
  return status
    ? status.replace(/_/g, " ")
    : "Sem status";
}

function statusTone(
  status: string | null | undefined,
): "green" | "amber" | "red" | "blue" | "violet" | "neutral" {
  const value = (status || "").toLowerCase();

  if (
    ["pago", "aprovado", "recebido", "reembolsado"].includes(value)
  ) {
    return "green";
  }

  if (
    ["cancelado", "reprovado", "estorno"].includes(value)
  ) {
    return "red";
  }

  if (
    ["pendente", "em_aberto", "aguardando_reembolso"].includes(value)
  ) {
    return "amber";
  }

  if (["enviado"].includes(value)) {
    return "blue";
  }

  return "neutral";
}

/**
 * Fornecedor.
 */
function obterFornecedor(despesa: DespesaExpandida) {
  return despesa.fornecedor || despesa.fornecedor_nome || "—";
}

/**
 * Status do e-mail.
 */
function obterStatusEmail(despesa: DespesaExpandida) {
  const status =
    despesa.status_email ||
    despesa.email_status;

  if (status) {
    const normalizado = status
      .toLowerCase()
      .replace(/_/g, " ")
      .trim();

    if (
      normalizado === "enviado" ||
      normalizado === "sent"
    ) {
      return {
        label: "Enviado",
        enviado: true,
      };
    }

    if (
      normalizado === "não enviado" ||
      normalizado === "nao enviado" ||
      normalizado === "not sent"
    ) {
      return {
        label: "Não enviado",
        enviado: false,
      };
    }

    return {
      label: status.replace(/_/g, " "),
      enviado: false,
    };
  }

  if (despesa.email_enviado === true) {
    return {
      label: "Enviado",
      enviado: true,
    };
  }

  if (despesa.email_enviado === false) {
    return {
      label: "Não enviado",
      enviado: false,
    };
  }

  return {
    label: "Não enviado",
    enviado: false,
  };
}

/* =========================================================
   TABELA
========================================================= */

function DespesasTabela({
  despesas,
}: {
  despesas: Despesa[];
}) {
  return (
    <div
      className="
        flex w-full min-w-0 flex-col
        overflow-hidden
        rounded-xl
        border border-border
        bg-card
        shadow-sm
      "
    >
      {/* =====================================================
          CABEÇALHO DO BLOCO
      ===================================================== */}

      <div
        className="
          flex flex-wrap
          items-center
          justify-between
          gap-4
          border-b border-border
          bg-muted/10
          px-4 py-4
          sm:px-5
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <h3
            className="
              truncate
              text-sm font-semibold
              text-foreground
              md:text-base
            "
          >
            Transações Financeiras Recentes
          </h3>

          <span
            className="
              shrink-0
              rounded-full
              bg-secondary
              px-2.5 py-0.5
              text-xs font-medium
              text-secondary-foreground
            "
          >
            {despesas.length}{" "}
            {despesas.length === 1
              ? "registro"
              : "registros"}
          </span>
        </div>
      </div>

      {/* =====================================================
          ÁREA DE SCROLL
      ===================================================== */}

      <div className="hidden w-full max-w-full overflow-x-auto xl:block">
        {/*
          IMPORTANTE:

          table-fixed:
          impede que textos longos redimensionem outras colunas.

          min-w-[1115px]:
          mantém as colunas legíveis quando a tabela estiver visível.

          colgroup:
          controla a proporção real de cada coluna.
        */}

        <table
          className="
            w-full
            min-w-[965px]
            table-fixed
            border-collapse
            text-left
            text-sm
          "
        >
          {/* =================================================
              LARGURA DAS COLUNAS
          ================================================= */}

          <colgroup>
            {/* ID / DATA */}
            <col className="w-[150px]" />

            {/* DESCRIÇÃO / FORNECEDOR */}
            <col className="w-[300px]" />

            {/* CAIXA */}
            <col className="w-[110px]" />

            {/* VALOR */}
            <col className="w-[135px]" />

            {/* STATUS */}
            <col className="w-[130px]" />

            {/* E-MAIL */}
            <col className="w-[140px]" />
          </colgroup>

          {/* =================================================
              HEADER
          ================================================= */}

          <thead className="bg-muted/5">
            <tr
              className="
                border-b border-border
                text-[10px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-muted-foreground
              "
            >
              <th className="px-4 py-4">
                ID / Data
              </th>

              <th className="px-4 py-4">
                Descrição / Fornecedor
              </th>

              <th className="px-4 py-4">
                Caixa
              </th>

              <th className="px-4 py-4 text-right">
                Valor (R$)
              </th>

              <th className="px-4 py-4">
                Status
              </th>

              <th className="px-4 py-4">
                E-mail
              </th>
            </tr>
          </thead>

          {/* =================================================
              BODY
          ================================================= */}

          <tbody className="divide-y divide-border/60">
            {despesas.map((item) => {
              const despesa =
                item as DespesaExpandida;

              const fornecedor =
                obterFornecedor(despesa);

              const email =
                obterStatusEmail(despesa);

              return (
                <tr
                  key={`${despesa.id}-${despesa.origem || "despesa"}`}
                  className="
                    transition-colors
                    hover:bg-muted/20
                  "
                >
                  {/* =========================================
                      ID / DATA
                  ========================================= */}

                  <td className="px-4 py-4 align-middle">
                    <div className="min-w-0">
                      <div
                        title={
                          despesa.numero_doc ||
                          "Sem ID"
                        }
                        className="
                          truncate
                          whitespace-nowrap
                          font-semibold
                          text-foreground
                        "
                      >
                        {despesa.numero_doc ||
                          "Sem ID"}
                      </div>

                      <div
                        className="
                          mt-1
                          whitespace-nowrap
                          text-xs
                          text-muted-foreground
                        "
                      >
                        {dataBruta(
                          despesa.data,
                        )}
                      </div>
                    </div>
                  </td>

                  {/* =========================================
                      DESCRIÇÃO / FORNECEDOR
                  ========================================= */}

                  <td className="px-4 py-4 align-middle">
                    <div className="min-w-0">
                      <div
                        title={
                          despesa.descricao ||
                          "Despesa sem descrição"
                        }
                        className="
                          truncate
                          font-semibold
                          text-foreground
                        "
                      >
                        {despesa.descricao ||
                          "Despesa sem descrição"}
                      </div>

                      <div
                        title={fornecedor}
                        className="
                          mt-1
                          truncate
                          text-xs
                          uppercase
                          tracking-wide
                          text-muted-foreground
                        "
                      >
                        {fornecedor}
                      </div>
                    </div>
                  </td>

                  {/* =========================================
                      CAIXA
                  ========================================= */}

                  <td className="px-4 py-4 align-middle">
                    <span
                      className="
                        inline-flex
                        max-w-full
                        items-center
                        rounded-lg
                        bg-green-100
                        px-3 py-1.5
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-wide
                        text-green-700
                        ring-1
                        ring-inset
                        ring-green-600/20

                        dark:bg-green-500/10
                        dark:text-green-400
                        dark:ring-green-500/20
                      "
                    >
                      <span className="truncate">
                        {despesa.tipo_caixa ||
                          "—"}
                      </span>
                    </span>
                  </td>

                  {/* =========================================
                      VALOR
                  ========================================= */}

                  <td
                    className="
                      whitespace-nowrap
                      px-4 py-4
                      text-right
                      align-middle
                      font-mono
                      font-semibold
                      text-foreground
                    "
                  >
                    {formatarMoeda(
                      Number(
                        despesa.valor,
                      ) || 0,
                    )}
                  </td>

                  {/* =========================================
                      STATUS
                  ========================================= */}

                  <td className="px-4 py-4 align-middle">
                    <div className="min-w-0">
                      <EtiquetaStatus
                        tone={statusTone(
                          despesa.status,
                        )}
                      >
                        {statusLabel(
                          despesa.status,
                        )}
                      </EtiquetaStatus>
                    </div>
                  </td>

                  {/* =========================================
                      STATUS DO E-MAIL
                  ========================================= */}

                  <td className="px-4 py-4 align-middle">
                    <div
                      className={`
                        inline-flex
                        items-center
                        gap-1.5
                        whitespace-nowrap
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-wide

                        ${
                          email.enviado
                            ? "text-emerald-500"
                            : "text-slate-500 dark:text-slate-400"
                        }
                      `}
                    >
                      {email.enviado ? (
                        <MailCheck
                          size={13}
                          className="shrink-0"
                        />
                      ) : (
                        <MailX
                          size={13}
                          className="shrink-0"
                        />
                      )}

                      <span>
                        {email.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid w-full gap-3 p-3 xl:hidden">
        {despesas.map((item) => {
          const despesa = item as DespesaExpandida;
          const email = obterStatusEmail(despesa);

          return (
            <article key={`${despesa.id}-${despesa.origem || "despesa"}`} className="min-w-0 rounded-lg border border-border bg-card/50 p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground" title={despesa.descricao || "Despesa sem descrição"}>
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

              <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Caixa</p>
                  <span className="inline-flex max-w-full items-center rounded-lg bg-green-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                    <span className="truncate">{despesa.tipo_caixa || "—"}</span>
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{statusLabel(despesa.status)}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${email.enviado ? "text-emerald-500" : "text-slate-500 dark:text-slate-400"}`}>
                  {email.enviado ? <MailCheck size={12} /> : <MailX size={12} />}
                  {email.label}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   PÁGINA
========================================================= */

export default function MovimentacoesFinanceiras({
  aoVoltar,
}: {
  aoVoltar: () => void;
}) {
  const [pastas, setPastas] =
    useState<Pasta[]>([]);
  const [abastecimentosPendentes, setAbastecimentosPendentes] = useState<AbastecimentoPendenteFinanceiro[]>([]);
  const [abaSelecionada, setAbaSelecionada] = useState<"movimentacoes" | "abastecimentos_pendentes">("movimentacoes");
  const [abastecimentoEmEdicao, setAbastecimentoEmEdicao] = useState<string | null>(null);

  const [
    pastaAberta,
    setPastaAberta,
  ] = useState<string | null>(null);

  const [
    vooAberto,
    setVooAberto,
  ] = useState<string | null>(null);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [erro, setErro] =
    useState<string | null>(null);

  /* =======================================================
     CARREGAMENTO
  ======================================================= */

  const carregar = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const resposta =
        await buscarMovimentacoesFinanceiras();

      setPastas(
        resposta.pastas || [],
      );
      setAbastecimentosPendentes(resposta.abastecimentos_pendentes || []);
    } catch (error) {
      console.error(
        "Erro ao carregar movimentações:",
        error,
      );

      setErro(
        "Não foi possível carregar todas as movimentações financeiras.",
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  /* =======================================================
     PASTA SELECIONADA
  ======================================================= */

  const pastaSelecionada =
    useMemo(() => {
      return (
        pastas.find(
          (pasta) =>
            pasta.id ===
            pastaAberta,
        ) || null
      );
    }, [
      pastas,
      pastaAberta,
    ]);

  /* =======================================================
     VOO SELECIONADO
  ======================================================= */

  const vooSelecionado =
    useMemo(() => {
      return (
        pastaSelecionada?.voos.find(
          (voo) =>
          voo.id ===
            vooAberto,
        ) || null
      );
    }, [
      pastaSelecionada,
      vooAberto,
    ]);

  /* =======================================================
     AÇÕES
  ======================================================= */

  const abrirPasta = (
    id: string,
  ) => {
    setPastaAberta(id);
    setVooAberto(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const abrirVoo = (id: string) => {
    setVooAberto(id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

  const voltarDaEdicaoAbastecimento = () => {
    setAbastecimentoEmEdicao(null);
    setAbaSelecionada("abastecimentos_pendentes");
    void carregar();
  };

  if (abastecimentoEmEdicao) {
    return <ControleAbastecimento initialRecordId={abastecimentoEmEdicao} aoVoltar={voltarDaEdicaoAbastecimento} />;
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="route-enter min-w-0 space-y-5">
      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          flex flex-wrap
          items-start
          justify-between
          gap-3
        "
      >
        <div className="min-w-0">
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-[.16em]
              text-primary
            "
          >
            Financeiro / Movimentações
          </p>

          <h1
            className="
              mt-1
              text-2xl
              font-extrabold
              tracking-[-.04em]
              md:text-[30px]
            "
          >
            Todas as movimentações financeiras
          </h1>

          <p
            className="
              mt-1
              text-xs
              text-muted-foreground
            "
          >
            Consulte despesas organizadas por
            cotista, número de voo e período.
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
            onClick={() =>
              void carregar()
            }
            disabled={carregando}
          >
            <RefreshCw
              size={14}
              className={
                carregando
                  ? "animate-spin"
                  : ""
              }
            />

            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Abas de movimentações financeiras">
        <button type="button" role="tab" aria-selected={abaSelecionada === "movimentacoes"} onClick={() => setAbaSelecionada("movimentacoes")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${abaSelecionada === "movimentacoes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Movimentações</button>
        <button type="button" role="tab" aria-selected={abaSelecionada === "abastecimentos_pendentes"} onClick={() => setAbaSelecionada("abastecimentos_pendentes")} className={`rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${abaSelecionada === "abastecimentos_pendentes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Abastecimentos pendentes <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700">{abastecimentosPendentes.length}</span>
        </button>
      </div>

      {/* =================================================
          ERRO
      ================================================= */}

      {erro && (
        <div
          className="
            rounded-xl
            border border-red-500/25
            bg-red-500/10
            p-4
            text-xs
            text-red-600
          "
        >
          {erro}
        </div>
      )}

      {/* =================================================
          CONTEÚDO
      ================================================= */}

      {abaSelecionada === "abastecimentos_pendentes" ? (
        carregando ? (
          <div className="space-y-3"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-16 rounded-xl" /></div>
        ) : (
          <section className="space-y-4">
            <div><h2 className="text-sm font-bold">ABASTECIMENTOS PENDENTES</h2><p className="mt-1 text-xs text-muted-foreground">Registros gerados no checklist pré-voo que ainda precisam do número da nota fiscal e/ou do arquivo fiscal.</p></div>
            <TabelaAbastecimentosPendentes abastecimentos={abastecimentosPendentes} onEditar={setAbastecimentoEmEdicao} formatarData={dataBruta} />
          </section>
        )
      ) : carregando ? (
        /* -----------------------------------------------
           LOADING
        ----------------------------------------------- */

        <div className="space-y-3">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : !pastaSelecionada ? (
        /* -----------------------------------------------
           LISTAGEM DE PASTAS
        ----------------------------------------------- */

        <section className="space-y-4">
          <div>
            <p className="text-sm font-bold">
              Pastas de cotistas
            </p>

            <p
              className="
                mt-1
                text-xs
                text-muted-foreground
              "
            >
              Abra uma pasta para consultar os voos
              e despesas daquele cotista. Despesas
              sem número de voo são separadas por ano
              e mês.
            </p>
          </div>

          {!pastas.length ? (
            <EstadoVazio
              label="Nenhuma movimentação financeira encontrada"
            />
          ) : (
            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                lg:grid-cols-3
              "
            >
              {pastas.map(
                (pasta) => (
                  <AeronavePasta
                    key={pasta.id}
                    label={pasta.nome}
                    count={
                      pasta.quantidade
                    }
                    isOpen={false}
                    onClick={() =>
                      abrirPasta(
                        pasta.id,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      ) : !vooSelecionado ? (
        /* -----------------------------------------------
           LISTAGEM DE VOOS
        ----------------------------------------------- */

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="size-5 shrink-0 text-primary" />

            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Pasta do cotista
              </p>

              <h2
                className="
                  truncate
                  text-xl
                  font-extrabold
                  tracking-tight
                "
              >
                {
                  pastaSelecionada.nome
                }
              </h2>
            </div>
          </div>

          {!pastaSelecionada
            .voos.length ? (
            <EstadoVazio
              label="Nenhum voo com despesas vinculadas"
            />
          ) : (
            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                lg:grid-cols-3
              "
            >
              {pastaSelecionada.voos.map(
                (voo: Voo) => (
                  <AeronavePasta
                    key={voo.id}
                    label={voo.periodo ? `Sem número de voo · ${voo.periodo}` : `Voo ${voo.numero_voo}`}
                    count={
                      voo.quantidade
                    }
                    isOpen={false}
                    onClick={() =>
                      abrirVoo(
                        voo.id,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      ) : (
        /* -----------------------------------------------
           DESPESAS DO VOO
        ----------------------------------------------- */

        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <Plane className="size-5 shrink-0 text-primary" />

            <div className="min-w-0">
              <p
                className="
                  truncate
                  text-xs
                  text-muted-foreground
                "
              >
                {
                  pastaSelecionada.nome
                }
              </p>

              <h2
                className="
                  text-xl
                  font-extrabold
                  tracking-tight
                "
              >
                {vooSelecionado.periodo
                  ? `Sem número de voo · ${vooSelecionado.periodo}`
                  : `Voo ${vooSelecionado.numero_voo}`}
              </h2>

              <p
                className="
                  mt-1
                  text-xs
                  text-muted-foreground
                "
              >
                {
                  vooSelecionado.quantidade
                }{" "}
                {vooSelecionado.quantidade ===
                1
                  ? "despesa vinculada"
                  : "despesas vinculadas"}
              </p>
            </div>
          </div>

          <DespesasTabela
            despesas={
              vooSelecionado.despesas
            }
          />
        </section>
      )}
    </div>
  );
}
