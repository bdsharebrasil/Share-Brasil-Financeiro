import "./fechamento-balanco.css";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, FileDown, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { formatarCentavos, formatarData, formatarMoeda } from "@/lib/financeiro-share-api";
import type { DashboardCotista } from "@/lib/financeiro-share-api";
import {
  documentoDoLancamento,
  nomeFornecedorLancamento,
  nomePagadoresDoLancamento,
  numerosDocumentosDoLancamento,
  rateioDoCotista,
  tipoRateioLancamento,
  valorPagoLancamento,
  type OpcaoFornecedorLancamento,
} from "@/lib/financeiro-cotista-lancamentos";
import {
  fmt,
  horas,
  horasAtribuidas,
  money,
  montarBalanco,
  norm,
  participanteDoCotista,
  projetarCustos,
  voosDoCotistaComFallback,
  type DashboardBalanco,
} from "@/lib/balanco-cotista";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";
import { calcularIndicadoresViagemCombustivel } from "@/lib/indicadores-despesas-cotista";
import { BalancoClientePdf } from "./BalancoClientePdf";
import { calcularAcertoContasCotistas } from "@/lib/acerto-contas-cotistas";
import { AcertoContasCotistasResumo } from "./AcertoContasCotistasResumo";
import { CuriosidadesVooCotista } from "./CuriosidadesVooCotista";
import { CabecalhoRateioCotista, CelulaRateioCotista } from "./RateioCotistaTableCells";

type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  fornecedores: OpcaoFornecedorLancamento[];
  mesesSelecionados: string[];
  cotistaId?: string;
};

type Aba = "balanco" | "acerto" | "lancamentos" | "custo-hora" | "diario" | "curiosidades";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "balanco", nome: "Balanço" },
  { id: "acerto", nome: "Acerto de contas" },
  { id: "lancamentos", nome: "Lançamentos" },
  { id: "custo-hora", nome: "Custo por hora" },
  { id: "diario", nome: "Diário de bordo" },
  { id: "curiosidades", nome: "Seu período em voo" },
];

const MESES_PROJECAO = Array.from({ length: 45 }, (_, index) => index + 1);
const ZOOMS_TABELA = [80, 90, 100, 110, 120] as const;
const ZOOM_PADRAO_TABELA = 90;
const PESOS_COLUNAS_TABELA = [8, 6, 20, 9, 9, 7, 8, 8, 8] as const;
const PESO_COLUNA_COTISTA = 10;
const CORES = {
  fixos: "#2f6db5",
  variaveis: "#52794a",
  extras: "#e8b94a",
  naoClassificados: "#8291a4",
};

export function FechamentoBalancoReferencia({
  dashboard,
  carregando,
  erro,
  cotistas,
  fornecedores,
  mesesSelecionados,
  cotistaId,
}: Props) {
  const [aba, setAba] = useState<Aba>("balanco");
  const [horasProjetadas, setHorasProjetadas] = useState(10);
  const [fatorFixo, setFatorFixo] = useState(1);
  const [categoria, setCategoria] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [zoomTabela, setZoomTabela] = useState<number>(() => {
    if (typeof window === "undefined") return ZOOM_PADRAO_TABELA;
    try {
      const salvo = Number(window.localStorage.getItem("share:fechamento:zoom-tabela"));
      return ZOOMS_TABELA.some((valor) => valor === salvo) ? salvo : ZOOM_PADRAO_TABELA;
    } catch {
      return ZOOM_PADRAO_TABELA;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("share:fechamento:zoom-tabela", String(zoomTabela));
    } catch {
      /* Armazenamento desabilitado */
    }
  }, [zoomTabela]);

  const alterarZoomTabela = (passo: -1 | 1) => {
    setZoomTabela((atual) => {
      const indice = ZOOMS_TABELA.findIndex((valor) => valor === atual);
      return ZOOMS_TABELA[Math.max(0, Math.min(ZOOMS_TABELA.length - 1, indice + passo))];
    });
  };

  const [dialogPdfAberto, setDialogPdfAberto] = useState(false);
  const [cotistasPdfSelecionados, setCotistasPdfSelecionados] = useState<string[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [subMes, setSubMes] = useState<"custos" | "uso">("custos");
  const [subAbaDiario, setSubAbaDiario] = useState<"voos" | "emprestimos">("voos");
  const [filtroCotistaEmprestimo, setFiltroCotistaEmprestimo] = useState(cotistaId || "__todos__");

  useEffect(() => {
    setFiltroCotistaEmprestimo(cotistaId || "__todos__");
  }, [cotistaId]);

  const d = dashboard as DashboardBalanco | null;
  const b = useMemo(
    () => (d ? montarBalanco(d, cotistas, mesesSelecionados) : null),
    [d, cotistas, mesesSelecionados],
  );
  const mesesAcerto = b?.meses ?? mesesSelecionados;
  const acerto = useMemo(
    () => calcularAcertoContasCotistas(d?.balanco_fontes, mesesAcerto),
    [d?.balanco_fontes, mesesAcerto],
  );

  const cadastroCotista = cotistaId ? cotistas.find((item) => item.id === cotistaId) : undefined;
  const participante = b
    ? participanteDoCotista(b, cadastroCotista, cotistas) ??
      b.participantes.find((item) => item.id === cotistaId)
    : undefined;
  const total = participante?.custo ?? b?.total;
  const meses = participante?.mensal ?? b?.mensais ?? [];
  const totalHoras = participante ? participante.horas : b?.totalHoras ?? null;
  const periodo = b?.meses.map(rotuloMesCotista).join(" · ") ?? "";
  const aeronave = b?.aeronave || "Aeronave selecionada";

  const lancamentos = (d?.lancamentos ?? [])
    .filter(
      (item) =>
        b?.meses.includes((item.dataEmissao || item.data).slice(0, 7)) &&
        norm(item.fluxo) === "SAIDA" &&
        !["CANCELADO", "CANCELADA"].includes(norm(item.status)),
    )
    .slice()
    .sort(
      (a, z) =>
        compararDocumentos(numeroDocLancamento(a), numeroDocLancamento(z)) ||
        (a.dataEmissao || a.data).localeCompare(z.dataEmissao || z.data),
    );

  const categorias = [...new Set(lancamentos.map((item) => item.categoria || "Sem categoria"))].sort(
    (a, z) => a.localeCompare(z, "pt-BR"),
  );

  const lancamentosFiltrados = lancamentos.filter(
    (origem) =>
      (categoria === "Todas" || (origem.categoria || "Sem categoria") === categoria) &&
      `${nomeFornecedorLancamento(origem, fornecedores)} ${origem.descricao}`
        .toLocaleLowerCase("pt-BR")
        .includes(busca.toLocaleLowerCase("pt-BR")),
  );

  const totalListado = lancamentosFiltrados.reduce(
    (soma, item) => soma + (item.valorCentavos ?? 0),
    0,
  );

  const projecao =
    total && b ? projetarCustos(total, totalHoras, b.meses.length, horasProjetadas, fatorFixo) : null;

  const serieProjecao =
    total && b
      ? Array.from({ length: 45 }, (_, index) => {
          const horasMes = index + 1;
          const ponto = projetarCustos(total, totalHoras, b.meses.length, horasMes, fatorFixo);
          return ponto ? { horas: horasMes, ...ponto } : null;
        }).filter((item) => item !== null)
      : [];

  const voosDoParticipante = participante?.voos ?? [];
  const voosOperacionais = participante
    ? voosDoCotistaComFallback(
        voosDoParticipante,
        b?.voos ?? [],
        {
          clienteId: cadastroCotista?.cliente_id ?? null,
          socioId: cadastroCotista?.socio_id ?? null,
        },
        b?.meses ?? [],
      )
    : cotistaId
      ? []
      : (b?.voos ?? []).filter((voo) => b?.meses.includes(String(voo.data ?? "").slice(0, 7)));

  const voos = voosOperacionais
    .slice()
    .sort((a, z) => a.data.localeCompare(z.data) || (a.numeroSequencial ?? 0) - (z.numeroSequencial ?? 0));
  const voosParaCuriosidades = voos;
  const diarioDisponivel = Boolean(b?.fonteVoos || voosOperacionais.length);

  const cotistaFiltroEmprestimo = cotistas.find((cotista) => cotista.id === filtroCotistaEmprestimo);
  const emprestimosAeronave = (dashboard?.emprestimos_aeronave ?? [])
    .filter((voo) => b?.meses.includes(String(voo.data ?? "").slice(0, 7)))
    .filter((voo) => {
      if (filtroCotistaEmprestimo === "__todos__") return true;
      if (!cotistaFiltroEmprestimo) return false;
      const clienteTomador =
        Boolean(cotistaFiltroEmprestimo.cliente_id) &&
        voo.tomador_cliente_id === cotistaFiltroEmprestimo.cliente_id;
      const socioTomador =
        Boolean(cotistaFiltroEmprestimo.socio_id) &&
        voo.tomador_socio_id === cotistaFiltroEmprestimo.socio_id;
      return clienteTomador || socioTomador;
    })
    .sort((a, z) => (a.data ?? "").localeCompare(z.data ?? "") || a.id.localeCompare(z.id));

  const tooltipEstilo = {
    background: "var(--fb-card)",
    color: "var(--fb-text)",
    border: "1px solid var(--fb-border)",
    borderRadius: 8,
    fontSize: 12,
  };

  if (carregando)
    return (
      <div className="fb" role="status">
        <div className="fb-empty">Carregando fechamento…</div>
      </div>
    );
  if (erro)
    return (
      <div className="fb" role="alert">
        <div className="fb-empty">Não foi possível carregar o balanço: {erro}</div>
      </div>
    );
  if (!d || !b || !total || !b.meses.length)
    return (
      <div className="fb">
        <div className="fb-empty">Selecione a aeronave e os meses do fechamento.</div>
      </div>
    );
  if (d.balanco_escopo && d.balanco_escopo !== "aeronave")
    return (
      <div className="fb">
        <div className="fb-empty">O fechamento precisa dos dados consolidados da aeronave.</div>
      </div>
    );

  const indicadoresDespesas = calcularIndicadoresViagemCombustivel(
    participante ? participante.lancamentos : b.participantes.flatMap((item) => item.lancamentos),
  );
  const custoPorCategoria = b.categorias
    .map((item) => ({
      nome: item.nome,
      valor: participante ? (item.cotistas.get(participante.id) ?? 0) : item.total,
    }))
    .filter((item) => item.valor > 0)
    .sort((a, z) => z.valor - a.valor);

  const quota = participante?.quota;
  const proporcaoDoCusto = b.total.total > 0 ? (total.total / b.total.total) * 100 : null;
  const saldo =
    participante && acerto.balanco
      ? (acerto.balanco.saldos.find((item) => item.id === participante.id)?.saldoCentavos ?? null)
      : null;
  const quantidadeVoos = diarioDisponivel ? voos.length : b.totalVoos;
  const pousos = voos.reduce((soma, voo) => soma + (voo.pousos ?? 0), 0);
  const custoMensalMedio = b.meses.length ? total.total / b.meses.length : 0;
  const custoFixos = total.fixos;
  const custoVariavel = total.variaveis;
  const custoExtra = total.extras;
  const custoNaoClassificado = total.naoClassificados;
  const seriesCusto = meses.map((mes) => ({ ...mes, nome: mes.nome }));

  const pesoTotalColunas =
    PESOS_COLUNAS_TABELA.reduce<number>((totalPeso, peso) => totalPeso + peso, 0) +
    cotistas.length * PESO_COLUNA_COTISTA;
  const larguraMinimaTabela = Math.ceil(Math.max(1080, 900 + cotistas.length * 145) * Math.max(1, zoomTabela / 100));

  const abrirDialogPdf = () => {
    const selecionado = participante ? [participante.id] : b.participantes.map((item) => item.id);
    setCotistasPdfSelecionados(selecionado);
    setDialogPdfAberto(true);
  };

  const gerarRelatorioPdf = async () => {
    const participantesDoRelatorio = b.participantes.filter((item) =>
      cotistasPdfSelecionados.includes(item.id),
    );
    if (!participantesDoRelatorio.length) {
      toast.error("Selecione ao menos um cotista para gerar o relatório.");
      return;
    }
    setGerandoPdf(true);
    try {
      const arquivo = await pdf(
        <BalancoClientePdf
          balanco={b}
          dashboard={d}
          participantes={participantesDoRelatorio}
          aeronave={aeronave}
          cotistas={cotistas}
          fornecedores={fornecedores}
          horasProjetadas={horasProjetadas}
          fatorFixo={fatorFixo}
        />,
      ).toBlob();
      const slug = `${aeronave}-${b.meses.join("_")}-${
        participantesDoRelatorio.length === b.participantes.length
          ? "todos-cotistas"
          : participantesDoRelatorio.map((item) => item.nome).join("-")
      }`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fechamento-financeiro-${slug}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDialogPdfAberto(false);
      toast.success("Relatório completo gerado e baixado.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível gerar o relatório PDF.");
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="fb">
      {b.voosSemVinculo.length > 0 && (
        <p className="fb-warning-banner" role="status">
          <strong>Atenção:</strong> {b.voosSemVinculo.length} voo(s) sem titular identificado entram
          no total da aeronave, mas precisam de vínculo no diário para compor as horas individuais.
        </p>
      )}

      <div className="fb-commandbar">
        <nav className="fb-tabs" role="tablist" aria-label="Seções do fechamento">
          {ABAS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={`fb-tab-${item.id}`}
              aria-selected={aba === item.id}
              aria-controls={`fb-panel-${item.id}`}
              onClick={() => setAba(item.id)}
            >
              {item.nome}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="fb-button fb-export"
          onClick={abrirDialogPdf}
          disabled={!b.participantes.length}
        >
          <FileDown size={15} /> Gerar PDF
        </button>
      </div>

      {aba === "balanco" && (
        <section
          id="fb-panel-balanco"
          role="tabpanel"
          aria-labelledby="fb-tab-balanco"
          className="fb-section-stack"
        >
          <div className="fb-hero">
            <div className="fb-hero-context">
              <small>
                {participante ? `Cotista: ${participante.nome}` : "Consolidado da aeronave"} ·{" "}
                {periodo}
              </small>
              <span className="fb-hero-cost-label">
                {participante ? "Custo atribuído ao cotista" : "Custo total da aeronave"}
              </span>
              <div className="fb-big">{money(total.total)}</div>
              {participante && (
                <div className="fb-hero-aircraft">
                  Custo total da aeronave: <strong>{money(b.total.total)}</strong>
                </div>
              )}
            </div>

            <div className="fb-hero-stats">
              <div className="fb-hero-stat">
                <span>Cota contratual</span>
                <strong>{quota == null ? "—" : fmt(quota, 1) + "%"}</strong>
              </div>
              <div className="fb-hero-stat">
                <span>Participação no custo</span>
                <strong>{proporcaoDoCusto == null ? "—" : fmt(proporcaoDoCusto, 1) + "%"}</strong>
              </div>
              <div className="fb-hero-stat">
                <span>Saldo líquido acumulado</span>
                <strong>{saldo == null ? "—" : money(saldo)}</strong>
                <button type="button" className="fb-hero-link" onClick={() => setAba("acerto")}>
                  Ver acerto detalhado <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>

          <div className="fb-grid fb-g4">
            <Kpi
              titulo="Média mensal"
              valor={money(custoMensalMedio)}
              detalhe={`${b.meses.length} ${b.meses.length === 1 ? "mês" : "meses"} · ${fmt(
                lancamentos.length,
                0,
              )} lançamentos`}
            />
            <Kpi
              titulo="Horas voadas"
              valor={horas(totalHoras)}
              detalhe={`${quantidadeVoos} voos · ${fmt(
                participante ? pousos : (b.totalPousos ?? pousos),
                0,
              )} pousos`}
            />
            <Kpi
              titulo={`Despesas de viagem (${indicadoresDespesas.viagens.quantidade})`}
              valor={money(indicadoresDespesas.viagens.totalCentavos)}
              detalhe={`Ticket médio: ${money(indicadoresDespesas.viagens.ticketMedioCentavos)}`}
            />
            <Kpi
              titulo={`Combustível (${indicadoresDespesas.combustivel.quantidade})`}
              valor={money(indicadoresDespesas.combustivel.totalCentavos)}
              detalhe={`Ticket médio: ${money(indicadoresDespesas.combustivel.ticketMedioCentavos)}`}
            />
          </div>

          <div className="fb-grid fb-g2 fb-analysis">
            <section className="fb-card">
              <div className="fb-card-head">
                <h2>Gastos por categoria</h2>
                <span className="fb-tag">{custoPorCategoria.length} categorias</span>
              </div>
              {custoPorCategoria.length ? (
                <div className="fb-scroll fb-scroll-bounded">
                  <table>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th className="fb-num">{participante ? "Valor atribuído" : "Valor total"}</th>
                        <th className="fb-num">%</th>
                        <th aria-label="Participação"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {custoPorCategoria.map((item) => {
                        const pct = total.total ? (item.valor / total.total) * 100 : 0;
                        return (
                          <tr key={item.nome}>
                            <td>{item.nome}</td>
                            <td className="fb-num">{money(item.valor)}</td>
                            <td className="fb-num">{fmt(pct, 1)}%</td>
                            <td>
                              <div className="fb-bar">
                                <i style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total geral</td>
                        <td className="fb-num">{money(total.total)}</td>
                        <td className="fb-num">100%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <Vazio>Não há despesas classificadas no período.</Vazio>
              )}
            </section>

            <section className="fb-card">
              <div className="fb-card-head">
                <h2>Evolução do custo mensal</h2>
              </div>
              <div className="fb-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={seriesCusto} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--fb-muted)" }} />
                    <YAxis
                      tickFormatter={(value) => fmt(value / 100, 0)}
                      width={58}
                      tick={{ fontSize: 10.5, fill: "var(--fb-muted)" }}
                    />
                    <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipEstilo} />
                    <Bar
                      dataKey="fixos"
                      name="Fixos"
                      stackId="custo"
                      fill={CORES.fixos}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="variaveis"
                      name="Variáveis"
                      stackId="custo"
                      fill={CORES.variaveis}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="extras"
                      name="Extras"
                      stackId="custo"
                      fill={CORES.extras}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="naoClassificados"
                      name="Sem natureza"
                      stackId="custo"
                      fill={CORES.naoClassificados}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="fb-legend">
                <span>
                  <i style={{ background: CORES.fixos }} />
                  Fixos: <b>{money(custoFixos)}</b>
                </span>
                <span>
                  <i style={{ background: CORES.variaveis }} />
                  Variáveis: <b>{money(custoVariavel)}</b>
                </span>
                <span>
                  <i style={{ background: CORES.extras }} />
                  Extras: <b>{money(custoExtra)}</b>
                </span>
                {custoNaoClassificado > 0 && (
                  <span>
                    <i style={{ background: CORES.naoClassificados }} />
                    Sem natureza: <b>{money(custoNaoClassificado)}</b>
                  </span>
                )}
              </div>
            </section>
          </div>

          <section className="fb-card">
            <div className="fb-card-head">
              <h2>
                {subMes === "custos"
                  ? "Detalhamento mensal de custos"
                  : "Utilização e médias operacionais por mês"}
              </h2>
              <div className="fb-subtabs" role="group" aria-label="Alternar visão mensal">
                <button
                  type="button"
                  aria-pressed={subMes === "custos"}
                  onClick={() => setSubMes("custos")}
                >
                  Custos
                </button>
                <button
                  type="button"
                  aria-pressed={subMes === "uso"}
                  onClick={() => setSubMes("uso")}
                >
                  Utilização
                </button>
              </div>
            </div>

            {subMes === "custos" ? (
              <div className="fb-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th className="fb-num">Fixos</th>
                      <th className="fb-num">Variáveis</th>
                      <th className="fb-num">Extras</th>
                      <th className="fb-num">Sem natureza</th>
                      <th className="fb-num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meses.map((mes) => (
                      <tr key={mes.mes}>
                        <td className="font-medium capitalize">{mes.nome}</td>
                        <td className="fb-num">{money(mes.fixos)}</td>
                        <td className="fb-num">{money(mes.variaveis)}</td>
                        <td className="fb-num">{money(mes.extras)}</td>
                        <td className="fb-num">{money(mes.naoClassificados)}</td>
                        <td className="fb-num">
                          <b>{money(mes.total)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total do período</td>
                      <td className="fb-num">{money(total.fixos)}</td>
                      <td className="fb-num">{money(total.variaveis)}</td>
                      <td className="fb-num">{money(total.extras)}</td>
                      <td className="fb-num">{money(total.naoClassificados)}</td>
                      <td className="fb-num">{money(total.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="fb-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th className="fb-num">Etapas</th>
                      <th className="fb-num">H. voo</th>
                      <th className="fb-num">H. totais atribuídas</th>
                      <th className="fb-num">Distância (NM)</th>
                      <th className="fb-num">Dias com voo</th>
                      <th className="fb-num">Custo/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meses.map((mes) => (
                      <tr key={mes.mes}>
                        <td className="font-medium capitalize">{mes.nome}</td>
                        <td className="fb-num">{fmt(mes.voos, 0)}</td>
                        <td className="fb-num">{horas(mes.horasVoo)}</td>
                        <td className="fb-num">{horas(mes.horas)}</td>
                        <td className="fb-num">{fmt(mes.distanciaNm)}</td>
                        <td className="fb-num">{fmt(mes.diasVoo, 0)}</td>
                        <td className="fb-num">{money(mes.custoHora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="fb-methodology">
            <summary>Notas metodológicas e critérios de apuração</summary>
            <ul className="fb-methodology-list">
              <li>
                <strong>Classificação de custos:</strong> a natureza cadastrada na despesa tem
                prioridade. Quando ausente, aplicam-se regras pela categoria e descrição, mantendo a
                forma de rateio independente.
              </li>
              <li>
                <strong>Horas e utilização:</strong> tempo total considera acionamento até corte; H.
                voo considera decolagem até pouso. Usa os horários quando disponíveis e, na
                ausência deles, o tempo registrado. Etapas e dias incluem operações compartilhadas,
                com horas e distâncias atribuídas proporcionalmente.
              </li>
              <li>
                <strong>Saldo líquido:</strong> usa a mesma apuração detalhada de rateios e
                pagamentos pessoais confirmados da aba <em>Acerto de contas</em>; não representa uma
                nova cobrança.
              </li>
            </ul>
          </details>
        </section>
      )}

      {aba === "acerto" && (
        <section id="fb-panel-acerto" role="tabpanel" aria-labelledby="fb-tab-acerto">
          <div className="fb-card">
            <AcertoContasCotistasResumo
              fontes={d.balanco_fontes}
              erroFonte={d.balanco_detalhado_erro}
              mesesSelecionados={b.meses}
              resultado={acerto}
            />
          </div>
        </section>
      )}

      {aba === "lancamentos" && (
        <section id="fb-panel-lancamentos" role="tabpanel" aria-labelledby="fb-tab-lancamentos">
          <section className="fb-card fb-ledger-card">
            <header className="fb-ledger-head">
              <div>
                <span className="fb-kicker">Lançamentos do fechamento</span>
                <h2>Despesas consideradas no período</h2>
              </div>
              <div className="fb-ledger-total">
                <span>Total listado</span>
                <strong>{formatarCentavos(totalListado)}</strong>
              </div>
            </header>

            <div className="fb-ledger-tools">
              <select
                value={categoria}
                onChange={(event) => setCategoria(event.target.value)}
                aria-label="Filtrar por categoria"
              >
                <option>Todas</option>
                {categorias.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <label className="fb-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Buscar fornecedor ou descrição..."
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  aria-label="Buscar lançamentos"
                />
              </label>

              <span className="fb-ledger-count">{lancamentosFiltrados.length} lançamentos</span>

              <div
                className="fb-zoom-control"
                role="group"
                aria-label="Ajustar tamanho da tabela de lançamentos"
              >
                <button
                  type="button"
                  onClick={() => alterarZoomTabela(-1)}
                  disabled={zoomTabela === ZOOMS_TABELA[0]}
                  aria-label="Diminuir tabela"
                  title="Diminuir tabela"
                >
                  <Minus size={13} />
                </button>
                <output aria-live="polite" aria-label="Tamanho da tabela">
                  {zoomTabela}%
                </output>
                <button
                  type="button"
                  onClick={() => alterarZoomTabela(1)}
                  disabled={zoomTabela === ZOOMS_TABELA[ZOOMS_TABELA.length - 1]}
                  aria-label="Aumentar tabela"
                  title="Aumentar tabela"
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomTabela(ZOOM_PADRAO_TABELA)}
                  disabled={zoomTabela === ZOOM_PADRAO_TABELA}
                  aria-label="Restaurar tamanho padrão da tabela"
                  title="Restaurar tamanho padrão"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            <div
              className="fb-scroll fb-ledger"
              style={
                {
                  "--fb-zoom": zoomTabela / 100,
                  "--fb-table-min-width": `${larguraMinimaTabela}px`,
                } as CSSProperties
              }
            >
              <table className="fb-ledger-table">
                <colgroup>
                  {PESOS_COLUNAS_TABELA.map((peso, indice) => (
                    <col key={indice} style={{ width: `${(peso * 100) / pesoTotalColunas}%` }} />
                  ))}
                  {cotistas.map((cotista) => (
                    <col
                      key={cotista.id}
                      style={{ width: `${(PESO_COLUNA_COTISTA * 100) / pesoTotalColunas}%` }}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Doc</th>
                    <th>Descrição</th>
                    <th>Favorecido</th>
                    <th>Categoria</th>
                    <th>Status</th>
                    <th>Tipo Rateio</th>
                    <th className="fb-num">Valor pago</th>
                    <th>Pago por</th>
                    {cotistas.map((cotista, i) => (
                      <CabecalhoRateioCotista key={cotista.id} cotista={cotista} indice={i} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentosFiltrados.map((origem) => (
                    <tr key={origem.id}>
                      <td>
                        <div className="fb-date-stack">
                          <span>
                            <small>Em.</small>
                            <b>{formatarDataSemAno(origem.dataEmissao || origem.data)}</b>
                          </span>
                          <span>
                            <small>Venc.</small>
                            <b>{formatarDataSemAno(origem.prazo)}</b>
                          </span>
                        </div>
                      </td>
                      <td className="fb-doc">{numeroDocLancamento(origem) || "—"}</td>
                      <td>
                        <span className="fb-desc-content" title={origem.descricao || undefined}>
                          {origem.descricao || "—"}
                        </span>
                      </td>
                      <td>{nomeFornecedorLancamento(origem, fornecedores) || "Não informado"}</td>
                      <td>{origem.categoria || "Sem categoria"}</td>
                      <td>
                        <span className={`fb-status fb-status-${tomStatus(origem.status)}`}>
                          {String(origem.status || "Não informado")
                            .replace(/_/g, " ")
                            .toLocaleUpperCase("pt-BR")}
                        </span>
                      </td>
                      <td>
                        <span className="fb-tag">{tipoRateioLancamento(origem)}</span>
                      </td>
                      <td className="fb-num fb-money">
                        {formatarCentavos(valorPagoLancamento(origem))}
                      </td>
                      <td>{nomePagadoresDoLancamento(origem, cotistas)}</td>
                      {cotistas.map((cotista, i) => (
                        <CelulaRateioCotista
                          key={cotista.id}
                          lancamento={origem}
                          cotista={cotista}
                          cotistas={cotistas}
                          indice={i}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={9}>
                      {lancamentosFiltrados.length} lançamentos · total rateado por cotista
                    </td>
                    {cotistas.map((cotista, i) => (
                      <td className={`fb-num fb-tone-${i % 2}`} key={cotista.id}>
                        {formatarCentavos(
                          lancamentosFiltrados.reduce(
                            (soma, item) =>
                              soma + (rateioDoCotista(item, cotista, cotistas)?.valorCentavos ?? 0),
                            0,
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            {!lancamentosFiltrados.length && (
              <Vazio>Nenhum lançamento encontrado com esses filtros.</Vazio>
            )}
          </section>
        </section>
      )}

      {aba === "custo-hora" && (
        <section
          id="fb-panel-custo-hora"
          role="tabpanel"
          aria-labelledby="fb-tab-custo-hora"
          className="fb-section-stack"
        >
          <div className="fb-grid fb-g2">
            <Kpi
              titulo="Custo/hora da aeronave no período"
              valor={money(b.custoHora)}
              detalhe={`${horas(b.totalHoras)} totais · custo total da aeronave ÷ horas`}
            />
            <Kpi
              titulo="Custo/hora do cotista selecionado"
              valor={money(participante?.custoHora ?? null)}
              detalhe={
                participante
                  ? `${participante.nome} · ${horas(participante.horas)} de voo`
                  : "Selecione um cotista para ver o valor individual"
              }
            />
          </div>

          <section className="fb-card">
            <div className="fb-card-head">
              <h2>Simulador de custo por hora — {participante?.nome ?? "aeronave"}</h2>
            </div>

            <div className="fb-sim-controls">
              <div>
                <label className="fb-range-label" htmlFor="fb-horas">
                  <span>
                    Horas voadas no mês: <strong>{horasProjetadas} h</strong>
                  </span>
                  <input
                    className="fb-range"
                    id="fb-horas"
                    type="range"
                    min="1"
                    max="45"
                    value={horasProjetadas}
                    onChange={(event) => setHorasProjetadas(Number(event.target.value))}
                    disabled={!projecao}
                  />
                </label>
              </div>

              {projecao?.metodo === "natureza_custo" && (
                <div>
                  <label className="fb-range-label">
                    <span>Multiplicador do custo fixo mensal</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      value={fatorFixo}
                      onChange={(event) =>
                        setFatorFixo(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                      }
                      aria-label="Multiplicador do custo fixo mensal"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="fb-grid fb-g3" style={{ marginBottom: 16 }}>
              <Kpi
                titulo={`Projeção por hora · ${horasProjetadas} h/mês`}
                valor={projecao ? money(projecao.custoHora) : "—"}
                detalhe={participante ? `Cotista: ${participante.nome}` : "Aeronave completa"}
              />
              <Kpi
                titulo="Parte fixa por hora"
                valor={projecao ? money(projecao.fixoHora) : "—"}
                detalhe={
                  projecao?.metodo === "media_historica"
                    ? "Sem separação por natureza"
                    : `Base fixa: ${money(total.fixos / b.meses.length)}/mês × ${fmt(fatorFixo)}`
                }
              />
              <Kpi
                titulo="Variável + extras por hora"
                valor={
                  projecao?.metodo === "natureza_custo"
                    ? money(projecao.variavelHora + projecao.extraHora)
                    : "—"
                }
                detalhe={
                  projecao?.metodo === "media_historica"
                    ? "Sem separação por natureza"
                    : "Da seleção usada na projeção"
                }
              />
            </div>

            {projecao ? (
              <div className="fb-chart fb-chart-tall">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serieProjecao} margin={{ top: 14, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis
                      dataKey="horas"
                      tickFormatter={(value) => String(value)}
                      tick={{ fontSize: 10.5, fill: "var(--fb-muted)" }}
                      label={{
                        value: "horas voadas por mês",
                        position: "insideBottom",
                        offset: -4,
                        fontSize: 10.5,
                        fill: "var(--fb-muted)",
                      }}
                    />
                    <YAxis
                      tickFormatter={(value) => fmt(value / 100, 0)}
                      width={62}
                      tick={{ fontSize: 10.5, fill: "var(--fb-muted)" }}
                    />
                    <Tooltip
                      formatter={(value) => money(Number(value))}
                      labelFormatter={(value) => `${value} horas/mês`}
                      contentStyle={tooltipEstilo}
                    />
                    <Line
                      dataKey="custoHora"
                      name="Custo por hora"
                      stroke="#e8b94a"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Vazio>A projeção exige horas registradas e meses selecionados.</Vazio>
            )}

            {projecao && (
              <p className="fb-note" style={{ marginTop: 12 }}>
                {projecao.metodo === "natureza_custo"
                  ? "Use 1 para os custos registrados ou 2 para o cenário com base fixa em dobro; o ajuste altera somente a projeção. "
                  : "Estimativa pela média histórica: custo atribuído ÷ horas registradas; o custo mensal acompanha as horas simuladas. "}
                O método de rateio é preservado. Não é previsão de manutenção nem compromisso de
                custo.
              </p>
            )}
          </section>

          {projecao && (
            <section className="fb-card">
              <h2>Tabela de sensibilidade por hora voada</h2>
              <div className="fb-scroll fb-scroll-bounded">
                <table>
                  <thead>
                    <tr>
                      <th>H. voadas</th>
                      {projecao.metodo === "natureza_custo" && (
                        <>
                          <th className="fb-num">Custo fixo/h</th>
                          <th className="fb-num">Custo variável/h</th>
                          <th className="fb-num">Custo extra/h</th>
                        </>
                      )}
                      <th className="fb-num">Custo por hora</th>
                      <th className="fb-num">Custo mensal estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MESES_PROJECAO.map((h) => {
                      const item = projetarCustos(total, totalHoras, b.meses.length, h, fatorFixo);
                      return (
                        item && (
                          <tr key={h} className={h === horasProjetadas ? "fb-highlight" : undefined}>
                            <td className="font-medium">{h} h</td>
                            {item.metodo === "natureza_custo" && (
                              <>
                                <td className="fb-num">{money(item.fixoHora)}</td>
                                <td className="fb-num">{money(item.variavelHora)}</td>
                                <td className="fb-num">{money(item.extraHora)}</td>
                              </>
                            )}
                            <td className="fb-num">
                              <b>{money(item.custoHora)}</b>
                            </td>
                            <td className="fb-num">{money(item.custoMensal)}</td>
                          </tr>
                        )
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}

      {aba === "diario" && (
        <section
          id="fb-panel-diario"
          role="tabpanel"
          aria-labelledby="fb-tab-diario"
          className="fb-section-stack"
        >
          <div>
            <div className="fb-subtabs" role="group" aria-label="Diário de bordo e voos empréstimo">
              <button
                type="button"
                id="fb-subtab-diario"
                aria-pressed={subAbaDiario === "voos"}
                onClick={() => setSubAbaDiario("voos")}
              >
                Diário de bordo
              </button>
              <button
                type="button"
                id="fb-subtab-emprestimos"
                aria-pressed={subAbaDiario === "emprestimos"}
                onClick={() => setSubAbaDiario("emprestimos")}
              >
                Voos empréstimo
              </button>
            </div>
          </div>

          {subAbaDiario === "voos" ? (
            <section className="fb-card">
              <div className="fb-card-head">
                <h2>Registros de Voo</h2>
                <span className="fb-tag">
                  {voos.length} {voos.length === 1 ? "voo" : "voos"}
                </span>
              </div>
              {diarioDisponivel ? (
                voos.length ? (
                  <div className="fb-scroll">
                    <table className="fb-flight-table">
                      <thead>
                        <tr>
                          <th aria-label="Referência">Ref.</th>
                          <th>Data</th>
                          <th>Trecho</th>
                          <th>Dep</th>
                          <th>Pou</th>
                          <th className="fb-flight-accent">T. Voo</th>
                          <th>T. Total</th>
                          {participante && <th>Horas Atrib.</th>}
                          <th>Voo para</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voos.map((voo, index) => (
                          <tr key={voo.id}>
                            <td className="fb-flight-ref">#{voo.numeroSequencial ?? index + 1}</td>
                            <td>{formatarData(voo.data)}</td>
                            <td className="fb-flight-route">
                              {voo.trecho || `${voo.origem || "—"} X ${voo.destino || "—"}`}
                            </td>
                            <td>{formatarHorarioDiario(voo.tempoDep)}</td>
                            <td>{formatarHorarioDiario(voo.tempoPou)}</td>
                            <td className="fb-flight-accent">
                              {formatarDuracaoDiario(voo.horasVoo)}
                            </td>
                            <td>{horas(voo.horas)}</td>
                            {participante && <td>{horas(horasAtribuidas(voo))}</td>}
                            <td>{destinoVoo(voo, cotistas)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Vazio>Nenhum voo registrado nos meses selecionados.</Vazio>
                )
              ) : (
                <Vazio>O diário de bordo não está disponível para esta consulta.</Vazio>
              )}
            </section>
          ) : (
            <section className="fb-card">
              <header className="fb-card-head">
                <div>
                  <span className="fb-kicker">Diário de bordo</span>
                  <h2>Voos empréstimo ({emprestimosAeronave.length})</h2>
                </div>
                <label className="fb-search">
                  <Search size={15} aria-hidden="true" />
                  <select
                    value={filtroCotistaEmprestimo}
                    onChange={(event) => setFiltroCotistaEmprestimo(event.target.value)}
                    aria-label="Filtrar voos empréstimo por cotista"
                  >
                    <option value="__todos__">Todos os cotistas</option>
                    {cotistas.map((cotista) => (
                      <option key={cotista.id} value={cotista.id}>
                        {cotista.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </header>

              {emprestimosAeronave.length ? (
                <div className="fb-scroll">
                  <table className="fb-flight-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Voo</th>
                        <th>Trecho / Local</th>
                        <th>Tomador</th>
                        <th>Emprestador</th>
                        <th className="fb-num">Litros</th>
                        <th className="fb-num">Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emprestimosAeronave.map((voo) => (
                        <tr key={voo.id}>
                          <td>{formatarData(voo.data)}</td>
                          <td>{voo.numero_voo || "—"}</td>
                          <td className="fb-flight-route">
                            {voo.trecho || voo.local_icao || voo.local || "—"}
                          </td>
                          <td>{voo.tomador_nome || "Não identificado"}</td>
                          <td>{voo.emprestador_nome || "Não identificado"}</td>
                          <td className="fb-num">
                            {voo.litros == null ? "—" : fmt(voo.litros, 1)}
                          </td>
                          <td className="fb-num">
                            {voo.valor_total == null ? "—" : formatarMoeda(voo.valor_total)}
                          </td>
                          <td>
                            {voo.status_reembolso ||
                              voo.status_lancamento ||
                              voo.status_abastecimento ||
                              "Não informado"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Vazio>Nenhum voo empréstimo identificado para este cotista e período.</Vazio>
              )}
            </section>
          )}

          <p className="fb-note">
            O custo/hora usa o tempo total (acionamento até corte). Traslados e voos de teste são
            compartilhados igualmente entre cotistas ativos do cadastro atual; a duração da etapa é
            preservada e as horas atribuídas mostram a parcela de cada cotista. Voos emprestados
            pertencem ao tomador identificado, e registros sem vínculo de tomador não são atribuídos
            a um cotista específico.
          </p>
        </section>
      )}

      {aba === "curiosidades" && (
        <section id="fb-panel-curiosidades" role="tabpanel" aria-labelledby="fb-tab-curiosidades">
          {voosParaCuriosidades.length || (totalHoras ?? 0) > 0 ? (
            <div className="bcp">
              <CuriosidadesVooCotista
                voos={voosParaCuriosidades}
                horas={totalHoras}
                periodo={periodo}
              />
            </div>
          ) : (
            <Vazio>Não há dados de voo detalhados para os meses selecionados.</Vazio>
          )}
        </section>
      )}

      <Dialog open={dialogPdfAberto} onOpenChange={setDialogPdfAberto}>
        <DialogContent className="despesas-theme despesa-dialog max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">Gerar relatório do fechamento</DialogTitle>
            <DialogDescription className="break-words">
              O PDF terá capa e conteúdo completo das seções para {aeronave}, no período {periodo}.
              Selecione um ou mais cotistas, ou marque todos.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-3">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <Checkbox
                checked={
                  cotistasPdfSelecionados.length === b.participantes.length &&
                  b.participantes.length > 0
                }
                onCheckedChange={(checked) =>
                  setCotistasPdfSelecionados(checked ? b.participantes.map((item) => item.id) : [])
                }
                aria-label="Selecionar todos os cotistas"
              />
              <span className="min-w-0">
                <strong className="block text-sm">Todos os cotistas</strong>
                <span className="text-xs text-muted-foreground">
                  Um capítulo completo para cada participante.
                </span>
              </span>
            </label>
            <div className="max-h-[38dvh] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {b.participantes.map((item) => {
                const marcado = cotistasPdfSelecionados.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(checked) =>
                        setCotistasPdfSelecionados((atuais) =>
                          checked
                            ? [...new Set([...atuais, item.id])]
                            : atuais.filter((id) => id !== item.id),
                        )
                      }
                      aria-label={`Incluir ${item.nome} no PDF`}
                    />
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">
                      {item.nome}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.holding ? "Holding" : "Cotista"}
                    </span>
                  </label>
                );
              })}
              {!b.participantes.length && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum cotista disponível para este fechamento.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDialogPdfAberto(false)}
              disabled={gerandoPdf}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void gerarRelatorioPdf()}
              disabled={gerandoPdf || cotistasPdfSelecionados.length === 0}
            >
              <FileDown size={15} className="mr-2" />
              {gerandoPdf ? "Gerando PDF…" : "Gerar PDF completo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="fb-kpi">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="fb-empty">{children}</div>;
}

function formatarDataSemAno(valor: string | null | undefined) {
  return formatarData(valor).replace(/\/\d{4}$/, "");
}

type LancamentoDoBalanco = DashboardBalanco["lancamentos"][number];

function numeroDocLancamento(lancamento: LancamentoDoBalanco) {
  return numerosDocumentosDoLancamento(lancamento) || documentoDoLancamento(lancamento) || null;
}

function compararDocumentos(a: string | null, z: string | null) {
  if (!a || !z) return a ? -1 : z ? 1 : 0;
  return a.localeCompare(z, "pt-BR", { numeric: true });
}

function tomStatus(status: string | null | undefined) {
  const s = String(status ?? "").trim().toUpperCase();
  if (["PAGO", "PAGO_DIRETAMENTE", "REEMBOLSADO", "RECEBIDO"].includes(s)) return "ok";
  if (s === "EM_ABERTO") return "pend";
  if (s === "EM_ATRASO") return "late";
  if (s === "AGUARDANDO_REEMBOLSO") return "wait";
  return "neutral";
}

type VooBalanco = NonNullable<DashboardBalanco["balanco_operacional"]>["voos"][number];

function formatarHorarioDiario(valor: string | null) {
  return valor ? valor.slice(0, 5) : "—";
}

function formatarDuracaoDiario(valor: number | null) {
  const minutos = Math.max(0, Math.round(Number(valor || 0) * 60));
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(
    2,
    "0",
  )}`;
}

function cotistaDoVoo(voo: VooBalanco, cotistas: CotistaAeronave[]) {
  const idsVinculados = voo.emprestado
    ? [voo.clienteTomadorId, voo.socioTomadorId]
    : [voo.clienteId, voo.socioId];
  const cotista = cotistas.find((item) =>
    [item.id, item.cliente_id, item.socio_id, ...(item.cotista_ids ?? [])].some((id) =>
      Boolean(id && idsVinculados.includes(id)),
    ),
  );
  return cotista?.nome || "Aeronave";
}

function destinoVoo(voo: VooBalanco, cotistas: CotistaAeronave[]) {
  if (voo.natureza === "TR - Traslado" || voo.natureza === "VT - Voo Teste") return voo.natureza;
  return cotistaDoVoo(voo, cotistas);
}
