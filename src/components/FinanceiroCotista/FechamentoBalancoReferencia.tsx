import { useMemo, useState, type ReactNode } from "react";
import { FileDown, Search } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { formatarCentavos, formatarData } from "@/lib/financeiro-share-api";
import type { DashboardCotista } from "@/lib/financeiro-share-api";
import {
  documentoDoLancamento,
  nomeFornecedorLancamento,
  nomePagadoresDoLancamento,
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
  type DashboardBalanco,
} from "@/lib/balanco-cotista";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";
import { BalancoClientePdf } from "./BalancoClientePdf";
import { calcularAcertoContasCotistas } from "@/lib/acerto-contas-cotistas";
import { AcertoContasCotistasResumo } from "./AcertoContasCotistasResumo";
import { CuriosidadesVooCotista } from "./CuriosidadesVooCotista";

type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  fornecedores: OpcaoFornecedorLancamento[];
  mesesSelecionados: string[];
  cotistaId?: string;
};

type Aba = "balanco" | "lancamentos" | "custo-hora" | "diario" | "curiosidades";
const ABAS: { id: Aba; nome: string }[] = [
  { id: "balanco", nome: "Balanço" },
  { id: "lancamentos", nome: "Lançamentos" },
  { id: "custo-hora", nome: "Custo por hora" },
  { id: "diario", nome: "Diário de bordo" },
  { id: "curiosidades", nome: "Seu período em voo" },
];
const MESES_PROJECAO = Array.from({ length: 45 }, (_, index) => index + 1);
const CORES = { fixos: "#2f6db5", variaveis: "#52794a", extras: "#e8b94a", naoClassificados: "#8291a4" };

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
  const [dialogPdfAberto, setDialogPdfAberto] = useState(false);
  const [cotistasPdfSelecionados, setCotistasPdfSelecionados] = useState<string[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [subMes, setSubMes] = useState<"custos" | "uso">("custos");

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
  const participante = b ? participanteDoCotista(b, cadastroCotista, cotistas) ?? b.participantes.find((item) => item.id === cotistaId) : undefined;
  const total = participante?.custo ?? b?.total;
  const meses = participante?.mensal ?? b?.mensais ?? [];
  const totalHoras = participante ? participante.horas : b?.totalHoras ?? null;
  const periodo = b?.meses.map(rotuloMesCotista).join(" · ") ?? "";
  const aeronave = b?.aeronave || "Aeronave selecionada";
  const lancamentos = (d?.lancamentos ?? [])
    .filter((item) => b?.meses.includes((item.dataEmissao || item.data).slice(0, 7))
      && norm(item.fluxo) === "SAIDA"
      && !["CANCELADO", "CANCELADA"].includes(norm(item.status)))
    .slice()
    .sort((a, z) => (a.dataEmissao || a.data).localeCompare(z.dataEmissao || z.data));
  const categorias = [...new Set(lancamentos.map((item) => item.categoria || "Sem categoria"))].sort((a, z) => a.localeCompare(z, "pt-BR"));
  const lancamentosFiltrados = lancamentos.filter((origem) =>
    (categoria === "Todas" || (origem.categoria || "Sem categoria") === categoria)
    && `${nomeFornecedorLancamento(origem, fornecedores)} ${origem.descricao}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const totalListado = lancamentosFiltrados.reduce((soma, item) => soma + (item.valorCentavos ?? 0), 0);
  const projecao = total && b
    ? projetarCustos(total, totalHoras, b.meses.length, horasProjetadas, fatorFixo)
    : null;
  const serieProjecao = total && b
    ? Array.from({ length: 45 }, (_, index) => {
        const horasMes = index + 1;
        const ponto = projetarCustos(total, totalHoras, b.meses.length, horasMes, fatorFixo);
        return ponto ? { horas: horasMes, ...ponto } : null;
      }).filter((item) => item !== null)
    : [];
  const voosOperacionais = (participante?.voos ?? b?.voos ?? [])
    .filter((voo) => b?.meses.includes(voo.data.slice(0, 7)));
  const voosDoParticipante = participante?.voos ?? [];
  const voos = voosOperacionais
    .slice()
    .sort((a, z) => a.data.localeCompare(z.data) || (a.numeroSequencial ?? 0) - (z.numeroSequencial ?? 0));
  const voosParaCuriosidades = participante ? voosDoParticipante : voos;
  const diarioDisponivel = Boolean(b?.fonteVoos || voosOperacionais.length);
  const tooltipEstilo = { background: "var(--fb-card)", color: "var(--fb-text)", border: "1px solid var(--fb-border)", borderRadius: 8, fontSize: 12 };

  if (carregando) return <div className="fb" role="status"><style>{CSS}</style><div className="fb-empty">Carregando fechamento…</div></div>;
  if (erro) return <div className="fb" role="alert"><style>{CSS}</style><div className="fb-empty">Não foi possível carregar o balanço: {erro}</div></div>;
  if (!d || !b || !total || !b.meses.length) return <div className="fb"><style>{CSS}</style><div className="fb-empty">Selecione a aeronave e os meses do fechamento.</div></div>;
  if (d.balanco_escopo && d.balanco_escopo !== "aeronave") return <div className="fb"><style>{CSS}</style><div className="fb-empty">O fechamento precisa dos dados consolidados da aeronave.</div></div>;

  const custoPorCategoria = b.categorias
    .map((item) => ({ nome: item.nome, valor: participante ? (item.cotistas.get(participante.id) ?? 0) : item.total }))
    .filter((item) => item.valor > 0)
    .sort((a, z) => z.valor - a.valor);
  const quota = participante?.quota;
  const proporcaoDoCusto = b.total.total > 0 ? (total.total / b.total.total) * 100 : null;
  const saldo = participante && acerto.balanco
    ? acerto.balanco.saldos.find((item) => item.id === participante.id)?.saldoCentavos ?? null
    : null;
  const quantidadeVoos = diarioDisponivel ? voos.length : b.totalVoos;
  const pousos = voos.reduce((soma, voo) => soma + (voo.pousos ?? 0), 0);
  const custoMensalMedio = b.meses.length ? total.total / b.meses.length : 0;
  const custoFixos = total.fixos;
  const custoVariavel = total.variaveis;
  const custoExtra = total.extras;
  const custoNaoClassificado = total.naoClassificados;
  const seriesCusto = meses.map((mes) => ({ ...mes, nome: mes.nome }));
  const abrirDialogPdf = () => {
    const selecionado = participante ? [participante.id] : b.participantes.map((item) => item.id);
    setCotistasPdfSelecionados(selecionado);
    setDialogPdfAberto(true);
  };

  const gerarRelatorioPdf = async () => {
    const participantesDoRelatorio = b.participantes.filter((item) => cotistasPdfSelecionados.includes(item.id));
    if (!participantesDoRelatorio.length) {
      toast.error("Selecione ao menos um cotista para gerar o relatório.");
      return;
    }
    setGerandoPdf(true);
    try {
      const arquivo = await pdf(<BalancoClientePdf
        balanco={b}
        dashboard={d}
        participantes={participantesDoRelatorio}
        aeronave={aeronave}
        cotistas={cotistas}
        fornecedores={fornecedores}
        horasProjetadas={horasProjetadas}
        fatorFixo={fatorFixo}
      />).toBlob();
      const slug = `${aeronave}-${b.meses.join("_")}-${participantesDoRelatorio.length === b.participantes.length ? "todos-cotistas" : participantesDoRelatorio.map((item) => item.nome).join("-")}`
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
      <style>{CSS}</style>
      <div className="fb-page-actions">
        <button type="button" className="fb-button" onClick={abrirDialogPdf} disabled={!b.participantes.length}><FileDown size={15} /> Gerar PDF</button>
      </div>
      {b.voosSemVinculo.length > 0 && <p className="fb-note" role="status">{b.voosSemVinculo.length} voo(s) sem titular identificado: entram no total da aeronave, mas precisam de vínculo no diário para compor as horas individuais.</p>}
      <nav className="fb-tabs" role="tablist" aria-label="Seções do fechamento">
        {ABAS.map((item) => <button
          type="button"
          role="tab"
          key={item.id}
          id={`fb-tab-${item.id}`}
          aria-selected={aba === item.id}
          aria-controls={`fb-panel-${item.id}`}
          onClick={() => setAba(item.id)}
        >{item.nome}</button>)}
      </nav>

      {aba === "balanco" && <section id="fb-panel-balanco" role="tabpanel" aria-labelledby="fb-tab-balanco">
        <div className="fb-hero">
          <div><small>Custo atribuído no período · {periodo}</small><div className="fb-big">{money(total.total)}</div></div>
          <div className="fb-hero-stats">
            <div>Cota contratual<strong>{quota == null ? "—" : fmt(quota, 1) + "%"}</strong></div>
            <div>Participação no custo<strong>{proporcaoDoCusto == null ? "—" : fmt(proporcaoDoCusto, 1) + "%"}</strong></div>
            <div>Saldo líquido acumulado<strong>{saldo == null ? "—" : money(saldo)}</strong></div>
          </div>
        </div>
        <div className="fb-grid fb-g3">
          <Kpi titulo="Média mensal" valor={money(custoMensalMedio)} detalhe={`${b.meses.length} ${b.meses.length === 1 ? "mês" : "meses"} selecionados`} />
          <Kpi titulo="Horas voadas" valor={horas(totalHoras)} detalhe={`${quantidadeVoos} voos · ${fmt(participante ? pousos : b.totalPousos ?? pousos, 0)} pousos`} />
          <Kpi titulo="Lançamentos" valor={fmt(lancamentos.length, 0)} detalhe="Despesas atribuídas ao cotista no período" />
        </div>
        <div className="fb-grid fb-g2">
          <section className="fb-card"><h2>Gastos por categoria</h2>
            {custoPorCategoria.length ? <div className="fb-scroll"><table>
              <thead><tr><th>Categoria</th><th className="fb-num">Valor atribuído</th><th className="fb-num">%</th><th aria-label="Participação"></th></tr></thead>
              <tbody>{custoPorCategoria.map((item) => <tr key={item.nome}>
                <td>{item.nome}</td><td className="fb-num">{money(item.valor)}</td>
                <td className="fb-num">{fmt(total.total ? item.valor / total.total * 100 : 0, 1)}%</td>
                <td><div className="fb-bar"><i style={{ width: `${Math.min(100, total.total ? item.valor / total.total * 100 : 0)}%` }} /></div></td>
              </tr>)}</tbody>
              <tfoot><tr><td>Total geral</td><td className="fb-num">{money(total.total)}</td><td className="fb-num">100%</td><td /></tr></tfoot>
            </table></div> : <Vazio>Não há despesas classificadas no período.</Vazio>}
          </section>
          <section className="fb-card"><h2>Custo mensal</h2><details className="fb-more"><summary>Como é classificado</summary><p className="fb-note">A natureza cadastrada tem prioridade. Quando ausente, usamos regras da categoria e descrição da despesa. A forma de rateio permanece independente.</p></details>
            <div className="fb-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={seriesCusto} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--fb-muted)" }} />
              <YAxis tickFormatter={(value) => fmt(value / 100, 0)} width={58} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} />
              <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipEstilo} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fixos" name="Fixos" stackId="custo" fill={CORES.fixos} isAnimationActive={false} />
              <Bar dataKey="variaveis" name="Variáveis" stackId="custo" fill={CORES.variaveis} isAnimationActive={false} />
              <Bar dataKey="extras" name="Extras" stackId="custo" fill={CORES.extras} isAnimationActive={false} />
              <Bar dataKey="naoClassificados" name="Sem natureza informada" stackId="custo" fill={CORES.naoClassificados} isAnimationActive={false} />
            </BarChart></ResponsiveContainer></div>
            <div className="fb-legend">
              <span><i style={{ background: CORES.fixos }} />Fixos {money(custoFixos)}</span>
              <span><i style={{ background: CORES.variaveis }} />Variáveis {money(custoVariavel)}</span>
              <span><i style={{ background: CORES.extras }} />Extras {money(custoExtra)}</span>
              {custoNaoClassificado > 0 && <span><i style={{ background: CORES.naoClassificados }} />Sem natureza informada {money(custoNaoClassificado)}</span>}
            </div>
          </section>
        </div>
        <div className="fb-grid fb-g2 fb-row-acerto">
          <section className="fb-card">
            <AcertoContasCotistasResumo
            fontes={d.balanco_fontes}
            erroFonte={d.balanco_detalhado_erro}
            mesesSelecionados={b.meses}
            resultado={acerto}
          />
          </section>
          <section className="fb-card">
            <div className="fb-card-head">
              <h2>{subMes === "custos" ? "Resumo mês a mês" : "Utilização e médias do período"}</h2>
              <div className="fb-subtabs" role="group" aria-label="Tabela mensal">
                <button type="button" aria-pressed={subMes === "custos"} onClick={() => setSubMes("custos")}>Custos</button>
                <button type="button" aria-pressed={subMes === "uso"} onClick={() => setSubMes("uso")}>Utilização</button>
              </div>
            </div>
            {subMes === "custos" ? <div className="fb-scroll"><table>
          <thead><tr><th>Mês</th><th className="fb-num">Fixos</th><th className="fb-num">Variáveis</th><th className="fb-num">Extras</th><th className="fb-num">Sem natureza informada</th><th className="fb-num">Total</th></tr></thead>
          <tbody>{meses.map((mes) => <tr key={mes.mes}><td>{mes.nome}</td><td className="fb-num">{money(mes.fixos)}</td><td className="fb-num">{money(mes.variaveis)}</td><td className="fb-num">{money(mes.extras)}</td><td className="fb-num">{money(mes.naoClassificados)}</td><td className="fb-num"><b>{money(mes.total)}</b></td></tr>)}</tbody>
          <tfoot><tr><td>Total</td><td className="fb-num">{money(total.fixos)}</td><td className="fb-num">{money(total.variaveis)}</td><td className="fb-num">{money(total.extras)}</td><td className="fb-num">{money(total.naoClassificados)}</td><td className="fb-num">{money(total.total)}</td></tr></tfoot>
        </table></div> : <div className="fb-scroll"><table>
          <thead><tr><th>Mês</th><th className="fb-num">Etapas</th><th className="fb-num">H. voo</th><th className="fb-num">H. totais atribuídas</th><th className="fb-num">Distância (NM)</th><th className="fb-num">Dias com voo</th><th className="fb-num">Custo/h</th></tr></thead>
          <tbody>{meses.map((mes) => <tr key={mes.mes}><td>{mes.nome}</td><td className="fb-num">{fmt(mes.voos, 0)}</td><td className="fb-num">{horas(mes.horasVoo)}</td><td className="fb-num">{horas(mes.horas)}</td><td className="fb-num">{fmt(mes.distanciaNm)}</td><td className="fb-num">{fmt(mes.diasVoo, 0)}</td><td className="fb-num">{money(mes.custoHora)}</td></tr>)}</tbody>
        </table></div>}
            <details className="fb-more"><summary>Como ler estes números</summary>
              {subMes === "uso" && <p className="fb-note">Tempo total: acionamento até corte. H. voo: decolagem até pouso. O cálculo usa os horários quando disponíveis; na ausência deles, usa o tempo registrado. Etapas e dias incluem operações compartilhadas; suas horas e distâncias são atribuídas proporcionalmente ao compartilhamento.</p>}
              <p className="fb-note">O saldo líquido no cabeçalho usa a mesma apuração detalhada de rateios e pagamentos pessoais confirmados exibida em Acerto de contas; ele não representa uma nova cobrança.</p>
            </details>
          </section>
        </div>
      </section>}

      {aba === "lancamentos" && <section id="fb-panel-lancamentos" role="tabpanel" aria-labelledby="fb-tab-lancamentos">
        <section className="fb-card fb-ledger-card">
          <header className="fb-ledger-head">
            <div><span className="fb-kicker">LANÇAMENTOS</span><h2>Despesas do período</h2></div>
            <div className="fb-ledger-total"><span>Total listado</span><strong>{formatarCentavos(totalListado)}</strong></div>
          </header>

          <div className="fb-ledger-tools">
            <select value={categoria} onChange={(event) => setCategoria(event.target.value)} aria-label="Filtrar por categoria">
              <option>Todas</option>{categorias.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="fb-search">
              <Search size={15} aria-hidden="true" />
              <input type="search" placeholder="Buscar fornecedor ou descrição" value={busca} onChange={(event) => setBusca(event.target.value)} aria-label="Buscar lançamentos" />
            </label>
            <span className="fb-ledger-count">{lancamentosFiltrados.length} lançamentos</span>
          </div>

          <div className="fb-scroll fb-ledger"><table>
            <thead><tr>
              <th>Data</th><th>Doc</th><th>Descrição</th><th>Favorecido</th><th>Categoria</th><th>Status</th><th>TIPO RATEIO</th>
              <th className="fb-num">Valor pago</th><th>PAGO POR</th>
              {cotistas.map((cotista, i) => <th className={`fb-num fb-share-header fb-tone-${i % 2}`} key={cotista.id}><strong>{cotista.nome}</strong><span>Rateio · % / valor</span></th>)}
            </tr></thead>
            <tbody>{lancamentosFiltrados.map((origem) => <tr key={origem.id}>
              <td>
                <div className="fb-date-stack">
                  <span><small>Emissão</small><b>{formatarDataSemAno(origem.dataEmissao || origem.data)}</b></span>
                  <span><small>Vencimento</small><b>{formatarDataSemAno(origem.prazo)}</b></span>
                </div>
              </td>
              <td className="fb-doc">{documentoDoLancamento(origem) || "—"}</td>
              <td className="fb-desc">{origem.descricao || "—"}</td>
              <td>{nomeFornecedorLancamento(origem, fornecedores) || "Fornecedor não informado"}</td>
              <td>{origem.categoria || "Sem categoria"}</td>
              <td><span className={`fb-status fb-status-${tomStatus(origem.status)}`}>{String(origem.status || "Não informado").replace(/_/g, " ").toLocaleUpperCase("pt-BR")}</span></td>
              <td><span className="fb-tag">{tipoRateioLancamento(origem)}</span></td>
              <td className="fb-num fb-money">{formatarCentavos(valorPagoLancamento(origem))}</td>
              <td>{nomePagadoresDoLancamento(origem, cotistas)}</td>
              {cotistas.map((cotista, i) => {
                const rateio = rateioDoCotista(origem, cotista, cotistas);
                return <td className={`fb-num fb-tone-${i % 2}`} key={cotista.id}>
                  {rateio
                    ? <div className="fb-share-cell"><span>{rateio.percentual == null ? "—" : `${fmt(rateio.percentual)}%`}</span><strong>{formatarCentavos(rateio.valorCentavos)}</strong></div>
                    : <span className="fb-muted-dash">—</span>}
                </td>;
              })}
            </tr>)}</tbody>
            <tfoot><tr>
              <td colSpan={9}>{lancamentosFiltrados.length} lançamentos · total rateado por cotista</td>
              {cotistas.map((cotista, i) => <td className={`fb-num fb-tone-${i % 2}`} key={cotista.id}>{formatarCentavos(lancamentosFiltrados.reduce((soma, item) => soma + (rateioDoCotista(item, cotista, cotistas)?.valorCentavos ?? 0), 0))}</td>)}
            </tr></tfoot>
          </table></div>
          {!lancamentosFiltrados.length && <Vazio>Nenhum lançamento encontrado com esses filtros.</Vazio>}
        </section>
      </section>}

      {aba === "custo-hora" && <section id="fb-panel-custo-hora" role="tabpanel" aria-labelledby="fb-tab-custo-hora">
        <div className="fb-grid fb-g2 fb-no-top">
          <Kpi titulo="Custo/hora da aeronave no período" valor={money(b.custoHora)} detalhe={`${horas(b.totalHoras)} totais · custo total da aeronave ÷ horas`} />
          <Kpi titulo="Custo/hora do cotista selecionado" valor={money(participante?.custoHora ?? null)} detalhe={participante ? `${participante.nome} · ${horas(participante.horas)} de voo` : "Selecione um cotista para ver o valor individual"} />
        </div>
        <div className="fb-grid fb-g3">
          <Kpi titulo={`Projeção por hora · ${horasProjetadas} h/mês`} valor={projecao ? money(projecao.custoHora) : "—"} detalhe={participante ? `Cotista: ${participante.nome}` : "Aeronave completa"} />
          <Kpi titulo="Parte fixa por hora" valor={projecao ? money(projecao.fixoHora) : "—"} detalhe={projecao?.metodo === "media_historica" ? "Sem separação por natureza do custo" : "Da seleção usada na projeção"} />
          <Kpi titulo="Variável + extras por hora" valor={projecao?.metodo === "natureza_custo" ? money(projecao.variavelHora + projecao.extraHora) : "—"} detalhe={projecao?.metodo === "media_historica" ? "Sem separação por natureza do custo" : "Da seleção usada na projeção"} />
        </div>
        <section className="fb-card fb-spaced"><h2>Projeção de custo por hora — {participante?.nome ?? "aeronave"}</h2>
          {projecao?.metodo === "natureza_custo" && <label className="fb-range-label">Multiplicador do custo fixo mensal: <input type="number" min="1" max="10" step="0.1" value={fatorFixo} onChange={(event) => setFatorFixo(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} aria-label="Multiplicador do custo fixo mensal" /></label>}
          {projecao?.metodo === "natureza_custo" && <p className="fb-note">Base fixa: {money(total.fixos / b.meses.length)} por mês × {fmt(fatorFixo)}. Use 1 para os custos registrados ou 2 para o cenário com base fixa em dobro. Este ajuste altera somente a projeção.</p>}
          {projecao?.metodo === "media_historica" && <p className="fb-note">Estimativa pela média histórica: custo atribuído ÷ horas registradas. O custo/hora é mantido e o custo mensal acompanha as horas simuladas. A forma de rateio FIXO, por voo ou por hora não define a natureza do gasto.</p>}
          <label className="fb-range-label" htmlFor="fb-horas">Horas voadas no mês: <b>{horasProjetadas}</b></label>
          <input className="fb-range" id="fb-horas" type="range" min="1" max="45" value={horasProjetadas} onChange={(event) => setHorasProjetadas(Number(event.target.value))} disabled={!projecao} />
          {projecao ? <div className="fb-chart fb-chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={serieProjecao} margin={{ top: 14, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--fb-border)" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="horas" tickFormatter={(value) => String(value)} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} label={{ value: "horas voadas por mês", position: "insideBottom", offset: -4, fontSize: 10, fill: "var(--fb-muted)" }} />
            <YAxis tickFormatter={(value) => fmt(value / 100, 0)} width={62} tick={{ fontSize: 10, fill: "var(--fb-muted)" }} />
            <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(value) => `${value} horas/mês`} contentStyle={tooltipEstilo} />
            <Line dataKey="custoHora" name="Custo por hora" stroke="#e8b94a" strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer></div> : <Vazio>A projeção exige horas registradas e meses selecionados.</Vazio>}
        </section>
        {projecao && <section className="fb-card fb-spaced"><h2>Tabela de projeção</h2><div className="fb-scroll"><table>
          <thead><tr><th>H. voadas</th>{projecao.metodo === "natureza_custo" && <><th className="fb-num">Custo fixo</th><th className="fb-num">Custo variável</th><th className="fb-num">Custo extra</th></>}<th className="fb-num">Custo por hora</th><th className="fb-num">Custo mensal</th></tr></thead>
          <tbody>{MESES_PROJECAO.map((h) => {
            const item = projetarCustos(total, totalHoras, b.meses.length, h, fatorFixo);
            return item && <tr key={h} className={h === horasProjetadas ? "fb-highlight" : undefined}>
              <td>{h}</td>{item.metodo === "natureza_custo" && <><td className="fb-num">{money(item.fixoHora)}</td><td className="fb-num">{money(item.variavelHora)}</td><td className="fb-num">{money(item.extraHora)}</td></>}<td className="fb-num"><b>{money(item.custoHora)}</b></td><td className="fb-num">{money(item.custoMensal)}</td>
            </tr>;
          })}</tbody>
        </table></div><p className="fb-note">Projeção estimada pela natureza cadastrada ou classificada, ou pela média histórica do custo/hora. O método de rateio é preservado. Não é previsão de manutenção nem compromisso de custo.</p></section>}
      </section>}

      {aba === "diario" && <section id="fb-panel-diario" role="tabpanel" aria-labelledby="fb-tab-diario">
        <section className="fb-card"><div className="fb-flight-heading"><h2>Registros de Voo</h2><span className="fb-tag">{voos.length} {voos.length === 1 ? "voo" : "voos"}</span></div>
          {diarioDisponivel ? voos.length ? <div className="fb-scroll"><table className="fb-flight-table">
            <thead><tr><th aria-label="Referência" /><th>DATA</th><th>TRECHO</th><th>DEP</th><th>POU</th><th className="fb-flight-accent">T VOO</th><th>T TOTAL</th>{participante && <th>HORAS ATRIB.</th>}<th>VOO PARA</th></tr></thead>
            <tbody>{voos.map((voo, index) => <tr key={voo.id}>
              <td className="fb-flight-ref">#{voo.numeroSequencial ?? index + 1}</td>
              <td>{formatarData(voo.data)}</td>
              <td className="fb-flight-route">{voo.trecho || `${voo.origem || "—"} X ${voo.destino || "—"}`}</td>
              <td>{formatarHorarioDiario(voo.tempoDep)}</td><td>{formatarHorarioDiario(voo.tempoPou)}</td>
              <td className="fb-flight-accent">{formatarDuracaoDiario(voo.horasVoo)}</td>
              <td>{horas(voo.horas)}</td>
              {participante && <td>{horas(horasAtribuidas(voo))}</td>}
              <td>{destinoVoo(voo, cotistas)}</td>
            </tr>)}</tbody>
          </table></div> : <Vazio>Nenhum voo registrado nos meses selecionados.</Vazio>
            : <Vazio>O diário de bordo não está disponível para esta consulta.</Vazio>}
        </section>
        <p className="fb-note">O custo/hora usa o tempo total (acionamento até corte). Traslados e voos de teste são compartilhados igualmente entre cotistas ativos do cadastro atual; a duração da etapa é preservada e as horas atribuídas mostram a parcela de cada cotista. Voos emprestados pertencem ao tomador identificado.</p>
      </section>}

      {aba === "curiosidades" && <section id="fb-panel-curiosidades" role="tabpanel" aria-labelledby="fb-tab-curiosidades">
        {voosParaCuriosidades.length || (totalHoras ?? 0) > 0 ? (
          <div className="bcp">
            <CuriosidadesVooCotista voos={voosParaCuriosidades} horas={totalHoras} periodo={periodo} />
          </div>
        ) : <Vazio>Não há dados de voo detalhados para os meses selecionados.</Vazio>}
      </section>}

      <Dialog open={dialogPdfAberto} onOpenChange={setDialogPdfAberto}>
        <DialogContent className="despesas-theme despesa-dialog w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">Gerar relatório do fechamento</DialogTitle>
            <DialogDescription className="break-words">O PDF terá capa e conteúdo completo das quatro seções para {aeronave}, no período {periodo}. Selecione um ou mais cotistas, ou marque todos.</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-3">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <Checkbox
                checked={cotistasPdfSelecionados.length === b.participantes.length && b.participantes.length > 0}
                onCheckedChange={(checked) => setCotistasPdfSelecionados(checked ? b.participantes.map((item) => item.id) : [])}
                aria-label="Selecionar todos os cotistas"
              />
              <span className="min-w-0"><strong className="block text-sm">Todos os cotistas</strong><span className="text-xs text-muted-foreground">Um capítulo completo para cada participante.</span></span>
            </label>
            <div className="max-h-[38dvh] space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {b.participantes.map((item) => {
                const marcado = cotistasPdfSelecionados.includes(item.id);
                return <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 hover:bg-muted/50">
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={(checked) => setCotistasPdfSelecionados((atuais) => checked ? [...new Set([...atuais, item.id])] : atuais.filter((id) => id !== item.id))}
                    aria-label={`Incluir ${item.nome} no PDF`}
                  />
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">{item.nome}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{item.holding ? "Holding" : "Cotista"}</span>
                </label>;
              })}
              {!b.participantes.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum cotista disponível para este fechamento.</p>}
            </div>
            <p className="text-xs text-muted-foreground">O arquivo será gerado como PDF profissional, com capa, título, aeronave, período selecionado e paginação. O download funciona também em dispositivos móveis.</p>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDialogPdfAberto(false)} disabled={gerandoPdf}>Cancelar</Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => void gerarRelatorioPdf()} disabled={gerandoPdf || cotistasPdfSelecionados.length === 0}>
              <FileDown size={15} className="mr-2" />{gerandoPdf ? "Gerando PDF…" : "Gerar PDF completo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return <div className="fb-kpi"><span>{titulo}</span><strong>{valor}</strong>{detalhe && <small>{detalhe}</small>}</div>;
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="fb-empty">{children}</div>;
}

function formatarDataSemAno(valor: string | null | undefined) {
  return formatarData(valor).replace(/\/\d{4}$/, "");
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
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function cotistaDoVoo(voo: VooBalanco, cotistas: CotistaAeronave[]) {
  const idsVinculados = voo.emprestado
    ? [voo.clienteTomadorId, voo.socioTomadorId]
    : [voo.clienteId, voo.socioId];
  const cotista = cotistas.find((item) =>
    [item.id, item.cliente_id, item.socio_id, ...(item.cotista_ids ?? [])]
      .some((id) => Boolean(id && idsVinculados.includes(id))),
  );
  return cotista?.nome || "Aeronave";
}

function destinoVoo(voo: VooBalanco, cotistas: CotistaAeronave[]) {
  if (voo.natureza === "TR - Traslado" || voo.natureza === "VT - Voo Teste") return voo.natureza;
  return cotistaDoVoo(voo, cotistas);
}

const CSS = `
.fb{--fb-bg: var(--app-canvas);--fb-card: var(--app-surface);--fb-text: var(--app-text);--fb-muted: var(--app-muted);--fb-border: var(--app-line);--fb-navy: var(--brand-navy);--fb-blue: var(--app-info);--fb-soft: var(--app-soft);max-width:1040px;margin:0 auto;padding:20px 0 42px;color:var(--fb-text);font:14px/1.5 "Segoe UI",system-ui,-apple-system,Roboto,sans-serif;color-scheme:light}
.fb .bcp{--bcp-card:var(--fb-card);--bcp-border:var(--fb-border);--bcp-fg:var(--fb-text);--bcp-muted:var(--fb-muted);--bcp-soft:var(--fb-soft);--bcp-accent:var(--fb-blue);--bcp-heading:var(--fb-blue)}
.fb *{box-sizing:border-box}.fb button,.fb input,.fb select{font:inherit;color:inherit}.fb button{cursor:pointer}.fb :is(button,input,select):focus-visible{outline:2px solid var(--fb-blue);outline-offset:2px}.fb-page-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:var(--fb-muted);font-size:12px}.fb-button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--fb-border);border-radius:6px;background:var(--fb-card);padding:7px 10px}.fb-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--fb-border);margin-bottom:18px}.fb-tabs button{flex-shrink:0;white-space:nowrap;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--fb-muted);padding:10px 14px}.fb-tabs button[aria-selected=true]{border-bottom-color:#e8b94a;color:var(--fb-text);font-weight:650}
.fb-hero{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:24px;background:var(--fb-navy);color:#fff;border-radius:10px;padding:22px 24px}.fb-hero small{font-size:13px;opacity:.8}.fb-big{font-size:clamp(28px,5vw,38px);font-weight:700;letter-spacing:-.02em;line-height:1.2;font-variant-numeric:tabular-nums}.fb-hero-stats{display:flex;gap:26px;flex-wrap:wrap}.fb-hero-stats div{font-size:12px;opacity:.95}.fb-hero-stats strong{display:block;font-size:16px}.fb-grid{display:grid;gap:14px;margin-top:14px}.fb-g3{grid-template-columns:repeat(3,minmax(0,1fr))}.fb-g2{grid-template-columns:repeat(2,minmax(0,1fr))}.fb-no-top{margin-top:0}.fb-kpi,.fb-card{background:var(--fb-card);border:1px solid var(--fb-border);border-radius:8px}.fb-kpi{padding:15px 17px;min-width:0}.fb-kpi>span{display:block;color:var(--fb-muted);font-size:12px}.fb-kpi>strong{display:block;margin:6px 0;font-size:21px;font-weight:650;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.fb-kpi>small{display:block;color:var(--fb-muted);font-size:11px}.fb-card{min-width:0;padding:16px 18px}.fb-card h2{margin:0 0 12px;font-size:15px;font-weight:650}.fb-spaced{margin-top:14px}.fb-scroll{width:100%;overflow-x:auto}.fb table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}.fb-flight-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.fb-flight-heading h2{margin:0 0 12px}.fb-flight-table{min-width:720px;table-layout:fixed}.fb-flight-ref{color:var(--fb-blue);font-family:ui-monospace,monospace;font-weight:700;white-space:nowrap}.fb-flight-route{font-family:ui-monospace,monospace;font-weight:700}.fb-flight-accent{color:var(--fb-blue)!important;font-weight:700}.fb th,.fb td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--fb-border);vertical-align:top}.fb th{color:var(--fb-muted);font-size:11px;font-weight:600}.fb .fb-num{text-align:right;white-space:nowrap}.fb tfoot td{font-weight:700;border-bottom:0;background:var(--fb-soft)}.fb .fb-bar{height:8px;min-width:80px;border-radius:4px;background:var(--fb-soft);overflow:hidden}.fb .fb-bar i{display:block;height:100%;border-radius:4px;background:var(--fb-blue)}.fb-chart{height:240px;width:100%;min-width:0}.fb-chart-tall{height:280px}.fb-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;color:var(--fb-muted);font-size:11px}.fb-legend span{white-space:nowrap}.fb-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}.fb-note{margin:16px 0 0;color:var(--fb-muted);font-size:11px;line-height:1.65}.fb-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.fb-tools select,.fb-tools input{min-width:210px;border:1px solid var(--fb-border);border-radius:6px;background:var(--fb-card);padding:7px 10px}.fb-tag{display:inline-block;border-radius:10px;background:var(--fb-soft);padding:1px 8px;font-size:11px}.fb-date-label{display:block;color:var(--fb-muted);font-size:9px;text-transform:uppercase;letter-spacing:.04em}.fb-range-label{display:block;color:var(--fb-muted);font-size:12px}.fb-range{width:100%;accent-color:var(--fb-blue)}.fb-highlight{background:var(--fb-soft)}.fb-empty{padding:24px 12px;text-align:center;color:var(--fb-muted)}
.fb-share-header{min-width:150px}.fb-share-header strong,.fb-share-header span{display:block}.fb-share-header strong{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fb-text);font-size:12px;text-transform:uppercase}.fb-share-header span{margin-top:3px;font-weight:400}.fb-share-cell span,.fb-share-cell strong{display:block}.fb-share-cell span{color:var(--fb-muted);font-size:12px}.fb-share-cell strong{margin-top:4px;color:var(--fb-text);font-size:15px;font-weight:700}
.fb{max-width:1240px;padding:16px 0 32px}.fb-page-actions{min-height:38px;margin:-28px 0 -21px;padding:0;justify-content:flex-end;align-items:flex-start}.fb-button{min-height:36px;border-color:color-mix(in srgb,var(--fb-border) 78%,transparent);border-radius:8px;transition:background-color .16s ease,border-color .16s ease}.fb-button:hover{background:var(--fb-soft);border-color:var(--fb-muted)}.fb-tabs{gap:8px;margin:0 0 16px;border-color:color-mix(in srgb,var(--fb-border) 82%,transparent)}.fb-tabs button{border-bottom-width:2px;border-radius:7px 7px 0 0;padding:10px 13px;transition:color .16s ease,background-color .16s ease}.fb-tabs button:hover{background:var(--fb-soft)}.fb-tabs button[aria-selected=true]{border-bottom-color:var(--fb-blue);color:var(--fb-blue)}.fb-hero{border:1px solid color-mix(in srgb,var(--fb-navy) 80%,white);border-radius:12px;padding:22px 24px;box-shadow:0 8px 24px rgba(15,61,110,.08)}.fb-grid{gap:12px;margin-top:12px}.fb-kpi,.fb-card{border-color:color-mix(in srgb,var(--fb-border) 82%,transparent);border-radius:10px;box-shadow:0 1px 2px rgba(18,36,56,.025)}.fb-kpi{padding:14px 16px}.fb-card{padding:16px}.fb-card h2{margin-bottom:10px}.fb th,.fb td{padding:9px 10px;border-color:color-mix(in srgb,var(--fb-border) 82%,transparent)}
:root[data-theme="dark"] .fb{--fb-bg: var(--app-canvas);--fb-card: var(--app-surface);--fb-text: var(--app-text);--fb-muted: var(--app-muted);--fb-border: var(--app-line);--fb-navy: var(--brand-navy);--fb-blue: var(--app-info);--fb-soft: var(--app-soft);color-scheme:dark}
.dark .fb{--fb-bg: var(--app-canvas);--fb-card: var(--app-surface);--fb-text: var(--app-text);--fb-muted: var(--app-muted);--fb-border: var(--app-line);--fb-navy: var(--brand-navy);--fb-blue: var(--app-info);--fb-soft: var(--app-soft);color-scheme:dark}
@media(max-width:780px){.fb-g3{grid-template-columns:repeat(2,minmax(0,1fr))}.fb-g2{grid-template-columns:1fr}.fb{padding:12px 0 24px}.fb-hero{padding:18px}.fb-hero-stats{gap:16px}.fb-card{padding:14px}}
@media(max-width:480px){.fb-g3{grid-template-columns:1fr 1fr}.fb-kpi{padding:12px}.fb-kpi>strong{font-size:17px}.fb-tabs button{padding:10px}.fb-page-actions{align-items:flex-start;flex-direction:column}.fb-tools{flex-direction:column}.fb-tools select,.fb-tools input{width:100%;min-width:0}}
@media print{.fb{--fb-bg:#fff;--fb-card:#fff;--fb-text:#14202e;--fb-muted:#5d6b7b;--fb-border:#d9dfe5;--fb-navy:#0f3d6e;background:#fff;max-width:none;padding:0}.fb-tabs,.fb-page-actions button,.fb-tools,.fb-range{display:none}.fb-card,.fb-kpi{break-inside:avoid}.fb-scroll{overflow:visible}.fb table{font-size:9px}.fb th,.fb td{padding:5px}.fb-chart{height:190px}}
.fb{--fb-ok:#1f8a5b;--fb-warn:#b7791f;--fb-bad:#d14343;--fb-wait:#7c5cd6;--fb-violet:#7c5cd6}
:root[data-theme="dark"] .fb,.dark .fb{--fb-ok:#5fd09b;--fb-warn:#f0c15a;--fb-bad:#f07878;--fb-wait:#b7a2f5;--fb-violet:#b7a2f5}

.fb .fb-ledger-card{padding:0;overflow:hidden;border-radius:14px}
.fb-ledger-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid var(--fb-border)}
.fb-ledger-head h2{margin:2px 0 0;font-size:14px}
.fb-kicker{font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--fb-blue)}
.fb-ledger-total{padding-left:18px;border-left:1px solid var(--fb-border);text-align:right}
.fb-ledger-total span{display:block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fb-muted)}
.fb-ledger-total strong{display:block;margin-top:2px;font:700 14px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:-.02em}

.fb-ledger-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 12px;background:var(--fb-soft);border-bottom:1px solid var(--fb-border)}
.fb .fb-ledger-tools select{height:32px;min-width:180px;padding:0 28px 0 10px;border:1px solid var(--fb-border);border-radius:8px;background:var(--fb-card)}
.fb-search{display:flex;align-items:center;gap:8px;flex:1 1 260px;max-width:420px;height:32px;padding:0 11px;border:1px solid var(--fb-border);border-radius:8px;background:var(--fb-card);color:var(--fb-muted);transition:border-color .15s,box-shadow .15s}
.fb-search:focus-within{border-color:var(--fb-blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--fb-blue) 16%,transparent)}
.fb-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--fb-text);font-size:13px}
.fb-ledger-count{margin-left:auto;font-size:11px;font-weight:600;color:var(--fb-muted)}

.fb .fb-ledger{max-height:70vh;overflow:auto}
.fb .fb-ledger table{min-width:1180px;border-collapse:separate;border-spacing:0}
.fb .fb-ledger thead th{position:sticky;top:0;z-index:2;height:34px;padding:0 10px;background:var(--fb-soft);color:var(--fb-muted);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;border-bottom:1px solid var(--fb-border);border-right:1px solid color-mix(in srgb,var(--fb-border) 55%,transparent)}
.fb .fb-ledger thead th:last-child{border-right:0}
.fb .fb-ledger tbody tr{height:34px}
.fb .fb-ledger tbody td{padding:4px 10px;vertical-align:middle;font-size:12px;line-height:1.3;border-bottom:1px solid color-mix(in srgb,var(--fb-border) 70%,transparent);border-right:1px solid color-mix(in srgb,var(--fb-border) 35%,transparent);transition:background-color .12s}
.fb .fb-ledger tbody td:last-child{border-right:0}
.fb .fb-ledger tbody tr:nth-child(even) td{background-color:color-mix(in srgb,var(--fb-soft) 45%,transparent)}
.fb .fb-ledger tbody tr:hover td{background-color:color-mix(in srgb,var(--fb-blue) 6%,transparent)}
.fb .fb-doc{font:600 11px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--fb-blue)}
.fb .fb-desc{min-width:200px;font-weight:600}
.fb .fb-money{font:700 13px ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}

.fb-date-stack{display:grid;gap:1px}
.fb-date-stack span{display:block;white-space:nowrap}
.fb-date-stack small{display:block;color:var(--fb-muted);font-size:9px;letter-spacing:.06em;text-transform:uppercase}
.fb-date-stack b{font:600 12px ui-monospace,SFMono-Regular,Consolas,monospace}

.fb-status{--t:var(--fb-muted);display:inline-flex;align-items:center;gap:5px;padding:1px 7px;border-radius:999px;color:var(--t);background:color-mix(in srgb,var(--t) 13%,transparent);border:1px solid color-mix(in srgb,var(--t) 24%,transparent);font-size:10.5px;font-weight:700;letter-spacing:.02em;line-height:1.2}
.fb-status::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}
.fb-status-ok{--t:var(--fb-ok)}.fb-status-pend{--t:var(--fb-warn)}.fb-status-late{--t:var(--fb-bad)}.fb-status-wait{--t:var(--fb-wait)}

.fb .fb-ledger .fb-tag{padding:2px 7px;border-radius:6px;background:color-mix(in srgb,var(--fb-blue) 11%,transparent);color:var(--fb-blue);font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;line-height:1.25}

.fb .fb-ledger .fb-tone-0{background-image:linear-gradient(color-mix(in srgb,var(--fb-blue) 6%,transparent),color-mix(in srgb,var(--fb-blue) 6%,transparent))}
.fb .fb-ledger .fb-tone-1{background-image:linear-gradient(color-mix(in srgb,var(--fb-violet) 6%,transparent),color-mix(in srgb,var(--fb-violet) 6%,transparent))}
.fb .fb-ledger thead .fb-tone-0 strong{color:var(--fb-blue)}
.fb .fb-ledger thead .fb-tone-1 strong{color:var(--fb-violet)}
.fb .fb-ledger .fb-share-header span{text-transform:none;letter-spacing:0;font-weight:500;font-size:10px}
.fb .fb-share-cell{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.fb .fb-share-cell span{font:500 11px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--fb-muted)}
.fb .fb-share-cell strong{margin:0;font:700 13px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:-.02em}
.fb .fb-muted-dash{color:var(--fb-muted)}

.fb .fb-ledger tfoot td{position:sticky;bottom:0;z-index:2;padding:2px 10px;background:var(--fb-soft);border-top:1px solid var(--fb-border);font-size:12px;font-weight:700}

@media(max-width:640px){
  .fb-ledger-head{padding:14px}
  .fb-search{max-width:none}
  .fb-ledger-count{width:100%;margin:0}
}

@media screen{
.fb{--fb-offset:300px;padding:8px 0 16px}
.fb-tabs{margin:0 0 8px}.fb-tabs button{padding:6px 12px;font-size:13px}
.fb-hero{padding:10px 16px;gap:12px;border-radius:8px;align-items:center;box-shadow:none}
.fb-hero small{font-size:11px}.fb-big{font-size:clamp(20px,2.6vw,26px);line-height:1.15}
.fb-hero-stats{gap:20px}.fb-hero-stats strong{font-size:14px}
.fb-grid{gap:8px;margin-top:8px}
.fb-kpi{padding:7px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;border-radius:8px}
.fb-kpi>span{grid-column:1;grid-row:1;font-size:11px}
.fb-kpi>strong{grid-column:2;grid-row:1/3;margin:0;font-size:16px;text-align:right}
.fb-kpi>small{grid-column:1;grid-row:2;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-card{padding:10px 12px;border-radius:8px}
.fb-card h2{margin:0 0 6px;font-size:13px}
.fb-spaced{margin-top:8px}
.fb table{font-size:12px}
.fb th,.fb td{padding:4px 8px}.fb th{font-size:10px}
.fb .fb-bar{height:6px;min-width:60px}
.fb-chart{height:150px}.fb-chart-tall{height:200px}
.fb-legend{margin-top:2px;gap:10px}
.fb-note{margin:6px 0 0;font-size:10.5px;line-height:1.5}
.fb-g2 .fb-scroll{max-height:230px;overflow:auto}
.fb-g2 .fb-scroll thead th{position:sticky;top:0;z-index:1;background:var(--fb-card)}
.fb-g2 .fb-scroll tfoot td{position:sticky;bottom:0}
.fb-more{margin-top:6px}.fb-more summary{cursor:pointer;color:var(--fb-muted);font-size:11px}
.fb-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.fb-card-head h2{margin:0}
.fb-subtabs{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--fb-border);border-radius:7px;background:var(--fb-soft)}
.fb-subtabs button{border:0;background:transparent;padding:3px 10px;border-radius:5px;font-size:11px;font-weight:600;color:var(--fb-muted)}
.fb-subtabs button[aria-pressed=true]{background:var(--fb-card);color:var(--fb-blue)}
.fb-flight-heading h2{margin:0 0 6px}
/* Acerto entre cotistas em formato de linhas */
.fb .acc-header{margin-bottom:6px;gap:8px}.fb .acc-header p{margin:2px 0 0;font-size:11px}
.fb .acc-metrics{gap:6px;margin-bottom:6px}.fb .acc-metrics article{padding:6px 10px}.fb .acc-metrics strong{margin-top:1px;font-size:14px}
.fb .acc-people{grid-template-columns:1fr;gap:4px;max-height:150px;overflow:auto}
.fb .acc-person{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:5px 10px}
.fb .acc-person-header{align-items:center;gap:8px}
.fb .acc-person-values{margin:0;grid-template-columns:repeat(3,auto);gap:14px}
.fb .acc-person-values dt{font-size:9px}.fb .acc-person-values dd{margin:0;font-size:11.5px}
.fb .acc-transfer-section{margin-top:8px}.fb .acc-transfer-section h3{margin:0 0 4px;font-size:12px}
.fb .acc-transfers{gap:4px;max-height:110px;overflow:auto}.fb .acc-transfer{padding:4px 10px;gap:8px}
.fb .acc-empty{padding:6px 10px;font-size:11px}.fb .acc-warnings{margin-top:6px;padding:6px 10px}.fb .acc-footnote{margin:4px 0 0}
/* Lançamentos: linha de 28px, altura acompanha a tela */
.fb-ledger-head{padding:6px 12px}.fb-ledger-tools{padding:4px 10px}
.fb .fb-ledger{max-height:calc(100dvh - var(--fb-offset));min-height:260px}
.fb .fb-ledger table{min-width:1000px}
.fb .fb-ledger thead th{height:28px;padding:0 8px}
.fb .fb-ledger tbody tr{height:28px}
.fb .fb-ledger tbody td{padding:2px 8px;font-size:11.5px}
.fb .fb-ledger .fb-desc{min-width:150px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb .fb-ledger .fb-status{padding:0 6px;font-size:10px}
.fb .fb-share-header{min-width:130px}.fb .fb-share-header strong{max-width:130px;font-size:11px}
.fb .fb-date-stack{display:flex;gap:10px}.fb .fb-date-stack small{display:none}
.fb .fb-date-stack span:first-child b::before{content:"Em. ";font-weight:400;color:var(--fb-muted)}
.fb .fb-date-stack span:last-child b::before{content:"Venc. ";font-weight:400;color:var(--fb-muted)}
.fb .fb-share-cell{flex-direction:row;align-items:baseline;justify-content:flex-end;gap:6px}
.fb .fb-share-cell strong{font-size:12px}
}
`;