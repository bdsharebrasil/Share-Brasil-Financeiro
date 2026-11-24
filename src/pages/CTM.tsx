import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Boxes,
  CalendarClock,
  ClipboardList,
  Droplet,
  FileCheck2,
  FileText,
  Gauge,
  History,
  Layers3,
  LayoutGrid,
  Plane,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Cadastro,
  Custos,
  GraficoCustos,
  Previsoes,
  Reportes,
  useReportesCtm,
} from "@/components/dashboard/operacoes/ctm/Coordenacao";
import CtmPesoBalanceamento from "@/components/dashboard/operacoes/ctm/ctm_pesoebalanceamento/CtmPesoBalanceamento";
import CtmDocumentosAeronave from "@/components/dashboard/operacoes/ctm/CtmDocumentosAeronave";
import { buscarCtmDashboard, colaboradorRequest } from "@/lib/colaborador-api";

const secoes = [
  {
    nome: "Painel",
    itens: [
      { id: "overview", nome: "Visão geral", icon: LayoutGrid },
      { id: "reportes", nome: "Reportes da tripulação", icon: BellRing },
      { id: "previsoes", nome: "Previsões e vencimentos", icon: CalendarClock },
    ],
  },
  {
    nome: "Manutenção",
    itens: [
      { id: "oas", nome: "Ordens de serviço", icon: ClipboardList, novo: "Nova ordem de serviço" },
      { id: "ras", nome: "Relatórios de serviço", icon: History, novo: "Novo RAS" },
      { id: "programa", nome: "Programa de manutenção", icon: Gauge, novo: "Novo item do programa" },
      { id: "componentes", nome: "Componentes", icon: Layers3, novo: "Novo componente" },
      { id: "pecas", nome: "Peças trocadas", icon: Boxes, novo: "Registrar troca de peça" },
      { id: "oleo", nome: "Análise de óleo", icon: Droplet, novo: "Nova análise de óleo" },
    ],
  },
  {
    nome: "Aeronave e custos",
    itens: [
      { id: "peso", nome: "Peso e balanceamento", icon: Scale },
      { id: "diretrizes", nome: "Diretrizes AD/SB", icon: ShieldAlert, novo: "Nova diretriz" },
      { id: "documentos", nome: "Documentos da aeronave", icon: FileCheck2 },
      { id: "orcamentos", nome: "Orçamentos", icon: FileText, novo: "Novo orçamento" },
      { id: "rateio", nome: "Custos e rateio", icon: Wallet },
    ],
  },
];
const modulos = secoes.flatMap(({ itens }) => itens);

export default function CTM() {
  const cliente = useQueryClient();
  const reduzirMovimento = useReducedMotion();
  const [selecao, selecionar] = useState("");
  const [aba, setAba] = useState("overview");
  const [criar, setCriar] = useState(false);
  const painel = useQuery({
    queryKey: ["ctm-dashboard", selecao],
    queryFn: () => buscarCtmDashboard(selecao || undefined),
    placeholderData: keepPreviousData,
  });
  const acesso = useQuery({
    queryKey: ["ctm-permissoes"],
    queryFn: () => colaboradorRequest<{ podeEditar: boolean }>("/api/ctm/coordenacao/permissoes"),
  });
  const dados = painel.isPlaceholderData ? undefined : painel.data?.data;
  const aviao = dados?.aeronave;
  const aeronaveId = selecao || String(aviao?.id ?? "");
  const reportes = useReportesCtm(aeronaveId);
  const emAberto = reportes.data?.registros.filter(
    (item) => String(item.aeronave_id) === aeronaveId && item.status !== "resolved",
  ).length;
  const modulo = modulos.find((item) => item.id === aba) ?? modulos[0];
  const IconeModulo = modulo.icon;
  const conhecePermissao = acesso.isSuccess;
  const podeEditar = acesso.data?.podeEditar === true;

  function abrir(id: string, novo = false) {
    setAba(id);
    setCriar(novo);
  }
  function atualizar() {
    void cliente.invalidateQueries({ queryKey: ["ctm-dashboard"] });
    void cliente.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/ctm/coordenacao/") });
  }

  return (
    <main className="space-y-5">
      <header className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Wrench size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">CTM</h1>
              <p className="text-sm text-muted-foreground">Controle Técnico de Manutenção</p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Selecionar aeronave</span>
              <select
                value={aeronaveId}
                onChange={(e) => {
                  selecionar(e.target.value);
                  setCriar(false);
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:min-w-52"
              >
                <option value="" disabled>
                  Selecionar aeronave
                </option>
                {painel.data?.data.aeronaves.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricula_registro} · {item.modelo}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl"
              onClick={atualizar}
              disabled={painel.isFetching}
              aria-label="Atualizar CTM"
            >
              <RefreshCw size={16} className={painel.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <nav aria-label="Seções do CTM" className="rounded-2xl border border-border/70 bg-card p-1.5 shadow-sm">
          <div role="tablist" className="flex items-center gap-1 overflow-x-auto [scrollbar-width:thin]">
            {secoes.map((secao, indice) => (
              <div key={secao.nome} className="flex shrink-0 items-center gap-1">
                {indice > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
                {secao.itens.map(({ id, nome, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={aba === id}
                    aria-current={aba === id ? "page" : undefined}
                    onClick={() => abrir(id)}
                    className="relative flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {aba === id && (
                      <motion.span
                        layoutId="ctm-secao"
                        transition={{ duration: reduzirMovimento ? 0 : 0.2 }}
                        className="absolute inset-0 rounded-xl border border-primary/20 bg-primary/10"
                      />
                    )}
                    <Icon size={15} className="relative shrink-0" />
                    <span className="relative">{nome}</span>
                    {id === "reportes" && !!emAberto && (
                      <span className="relative rounded-md bg-amber-500/15 px-1.5 font-bold text-amber-700 dark:text-amber-300">
                        {emAberto}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <motion.div
          key={aeronaveId + ":" + aba}
          initial={reduzirMovimento ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0 space-y-4"
        >
          {aba !== "overview" && (
            <div className="flex items-center gap-2.5 px-1">
              <IconeModulo size={20} className="text-primary" />
              <h2 className="text-xl font-bold tracking-tight">{modulo.nome}</h2>
            </div>
          )}
          {painel.isError && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              Não foi possível carregar a ficha da aeronave.{" "}
              <Button variant="link" onClick={() => void painel.refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!aeronaveId && !painel.isError && (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              {painel.isPending ? "Carregando aeronaves…" : "Nenhuma aeronave disponível no CTM."}
            </p>
          )}

          {aeronaveId && aba === "overview" && (
            <>
              <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Plane size={21} />
                  </span>
                  <div className="mr-auto">
                    <h2 className="text-lg font-bold">{aviao?.matricula_registro ?? "Visão geral"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[aviao?.fabricante, aviao?.modelo, aviao?.base].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {podeEditar && (
                    <Button className="gap-2 rounded-xl" onClick={() => abrir("oas", true)}>
                      <Plus size={16} /> Nova ordem de serviço
                    </Button>
                  )}
                </div>
                {conhecePermissao && !podeEditar && (
                  <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    Perfil de consulta. A criação e a edição estão disponíveis para CTM, Operações e gestão autorizada.
                  </p>
                )}
                {acesso.isError && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    A permissão de edição está indisponível.{" "}
                    <Button variant="link" onClick={() => void acesso.refetch()}>
                      Tentar novamente
                    </Button>
                  </p>
                )}
              </section>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  {
                    nome: "Ordens em aberto",
                    id: "oas",
                    valor: dados?.falhas?.includes("oas") ? undefined : dados?.resumo.ordens_abertas,
                    icon: ClipboardList,
                  },
                  {
                    nome: "Itens do programa",
                    id: "programa",
                    valor: dados?.falhas?.includes("programa") ? undefined : dados?.resumo.itens_manutencao,
                    icon: Gauge,
                  },
                  {
                    nome: "Diretrizes pendentes",
                    id: "diretrizes",
                    valor: dados?.falhas?.includes("diretrizes") ? undefined : dados?.resumo.diretrizes_pendentes,
                    icon: ShieldAlert,
                  },
                  { nome: "Reportes em aberto", id: "reportes", valor: emAberto, icon: BellRing },
                ].map(({ nome, id, valor, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => abrir(id)}
                    className="group rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm transition hover:border-primary/35 sm:p-4"
                  >
                    <span className="flex items-center justify-between gap-2 text-primary">
                      <Icon size={17} />
                      <ArrowRight
                        size={14}
                        className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                    <strong className="mt-2 block text-2xl tabular-nums">{valor ?? "—"}</strong>
                    <span className="text-xs text-muted-foreground">{nome}</span>
                  </button>
                ))}
              </div>
              <GraficoCustos ordens={dados?.oas ?? []} indisponivel={dados?.falhas?.includes("oas") || painel.isError} />
              <Previsoes aeronave={aeronaveId} resumido abrirCompleto={() => abrir("previsoes")} />
            </>
          )}

          {aeronaveId && modulo.novo && (
            <Cadastro
              aeronave={aeronaveId}
              modulo={aba}
              titulo={modulo.nome}
              novo={modulo.novo}
              matricula={aviao?.matricula_registro}
              criarAoAbrir={criar}
              aoAbrirCriacao={() => setCriar(false)}
              ras={dados?.ras ?? []}
              atualizar={atualizar}
            />
          )}
          {aeronaveId && aba === "reportes" && <Reportes aeronave={aeronaveId} />}
          {aeronaveId && aba === "previsoes" && <Previsoes aeronave={aeronaveId} />}
          {aeronaveId && aba === "rateio" && <Custos aeronave={aeronaveId} ordens={dados?.oas ?? []} />}
          {aeronaveId && aba === "peso" && (
            <CtmPesoBalanceamento aeronaveId={aeronaveId} aeronave={aviao} podeEditar={podeEditar} />
          )}
          {aeronaveId && aba === "documentos" && (
            <CtmDocumentosAeronave
              aeronaveId={aeronaveId}
              aeronaves={dados?.aeronaves ?? []}
              onSelecionarAeronave={selecionar}
              podeEditar={podeEditar}
            />
          )}
        </motion.div>
      </div>
    </main>
  );
}
