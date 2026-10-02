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



import {

  buscarMovimentacoesFinanceiras,

  type PastaMovimentacoesFinanceiras,

} from "@/lib/colaborador-api";



/* =========================================================

   TIPOS

\========================================================= */



type Despesa =

  PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];



type Pasta = PastaMovimentacoesFinanceiras;

type Voo = Pasta["voos"][number];



/*\*

 \* Campos extras opcionais.

 \*

 \* Isso permite que a tela continue funcionando mesmo se sua API

 \* estiver retornando alguns desses campos com nomes diferentes.

 */

type DespesaExpandida = Despesa & {

  fornecedor?: string | null;



  cliente?: string | null;

  cliente_nome?: string | null;

  cotista?: string | null;



  status_email?: string | null;

  email_status?: string | null;

  email_enviado?: boolean | null;

};



/* =========================================================

   HELPERS

\========================================================= */



function dataBruta(valor: string | null | undefined) {

  if (!valor) return "—";



  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);



  return Number.isNaN(data.getTime())

    ? valor

    : data.toLocaleDateString("pt-BR");

}



function statusLabel(status: string | null | undefined) {

  return status

    ? status.replace(/\_/g, " ")

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



/*\*

 \* Nome do cliente.

 \*

 \* Usa os nomes mais comuns que sua API pode devolver.

 */

function obterCliente(despesa: DespesaExpandida) {

  return (

    despesa.cliente ||

    despesa.cliente_nome ||

    despesa.cotista ||

    "Não informado"

  );

}



/*\*

 \* Fornecedor.

 */

function obterFornecedor(despesa: DespesaExpandida) {

  return despesa.fornecedor || "—";

}



/*\*

 \* Status do e-mail.

 */

function obterStatusEmail(despesa: DespesaExpandida) {

  const status =

    despesa.status_email ||

    despesa.email_status;



  if (status) {

    const normalizado = status

      .toLowerCase()

      .replace(/\_/g, " ")

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

      label: status.replace(/\_/g, " "),

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

\========================================================= */



function DespesasTabela({

  despesas,

}: {

  despesas: Despesa[];

}) {

  return (

    <div

      className="

        mx-auto flex w-full max-w-[1040px] min-w-0 flex-col

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



          largura fixa de 1000px:

          mantém as colunas legíveis quando a tabela estiver visível.



          colgroup:

          controla a proporção real de cada coluna.

        */}



        <table

          className="

            mx-auto w-[1000px]

            min-w-[1000px]

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

            <col className="w-[90px]" />



            {/* DESCRIÇÃO / FORNECEDOR */}

            <col className="w-[380px]" />



            {/* CLIENTE */}

            <col className="w-[82px]" />



            {/* CAIXA */}

            <col className="w-[82px]" />



            {/* VALOR */}

            <col className="w-[118px]" />



            {/* STATUS */}

            <col className="w-[110px]" />



            {/* E-MAIL */}

            <col className="w-[138px]" />

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

              <th className="whitespace-nowrap px-2.5 py-3.5">

                ID / Data

              </th>



              <th className="whitespace-nowrap px-2.5 py-3.5">

                Descrição / Fornecedor

              </th>



              <th className="whitespace-nowrap px-2.5 py-3.5">

                Cliente

              </th>



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



          {/* =================================================

              BODY

          ================================================= */}



          <tbody className="divide-y divide-border/60">

            {despesas.map((item) => {

              const despesa =

                item as DespesaExpandida;



              const cliente =

                obterCliente(despesa);



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



                  <td className="whitespace-nowrap px-2.5 py-3.5 align-middle">

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



                  <td className="px-2.5 py-3.5 align-middle">

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

                      CLIENTE

                  ========================================= */}



                  <td className="px-2.5 py-3.5 align-middle">

                    <div

                      title={cliente}

                      className="

                        truncate

                        font-medium

                        text-foreground

                      "

                    >

                      {cliente}

                    </div>

                  </td>



                  {/* =========================================

                      CAIXA

                  ========================================= */}



                  <td className="px-2.5 py-3.5 text-center align-middle">

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

                      px-2.5 py-3.5

                      text-right

                      align-middle

                      font-mono

                      font-semibold tabular-nums

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



                  <td className="px-2.5 py-3.5 text-center align-middle">

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



                  <td className="px-2.5 py-3.5 text-center align-middle">

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

          const cliente = obterCliente(despesa);

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



              <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)\_auto] items-center gap-2 border-t border-border/60 pt-2">

                <div className="min-w-0">

                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>

                  <p className="break-words text-[11px] font-medium text-foreground">{cliente}</p>

                </div>

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

\========================================================= */



export default function MovimentacoesFinanceiras({

  aoVoltar,

}: {

  aoVoltar: () => void;

}) {

  const [pastas, setPastas] =

    useState<Pasta[]>([]);



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

            voo.numero_voo ===

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



  const abrirVoo = (

    numero: string,

  ) => {

    setVooAberto(numero);



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



  /* =======================================================

     RENDER

  ======================================================= */



  return (

    <div className="route-enter mx-auto w-full max-w-[1180px] min-w-0 space-y-5">

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

            cotista e número de voo.

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



      {carregando ? (

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

              Abra uma pasta para consultar

              somente os voos e despesas daquele

              cotista.

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

                    key={

                      voo.numero_voo

                    }

                    label={`Voo ${voo.numero_voo}`}

                    count={

                      voo.quantidade

                    }

                    isOpen={false}

                    onClick={() =>

                      abrirVoo(

                        voo.numero_voo,

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

                Voo{" "}

                {

                  vooSelecionado.numero_voo

                }

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
