import { AlertTriangle, Gauge, Plane, Wallet } from "lucide-react";
import type {
  DashboardCotista,
  FechamentoMensalCotista,
  MediasCotistaMensais,
} from "@/lib/financeiro-share-api";
import { formatarCentavos, formatarData } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { rotuloMesCotista } from "@/lib/financeiro-cotista-periodo";
import { formatBRL, formatNumero } from "@/utils/format";
import { KpiCard } from "./KpiCard";

type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  mesesSelecionados: string[];
};

type LinhaMensal = {
  mes: string;
  fechamento?: FechamentoMensalCotista;
  mediasMensais?: MediasCotistaMensais;
};

function mesLabel(mes: string) {
  return rotuloMesCotista(mes);
}

export function FechamentoBalancoDashboardCotista({
  dashboard,
  carregando,
  erro,
  cotistas,
  mesesSelecionados,
}: Props) {
  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[104px] animate-pulse rounded-lg border border-border bg-muted/50"
            />
          ))}
        </div>
        <div className="h-[320px] animate-pulse rounded-lg border border-border bg-muted/50" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft/40 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
        <p className="text-sm font-bold text-card-foreground">
          Não foi possível montar o fechamento
        </p>
        <p className="max-w-md text-sm text-muted-foreground">{erro}</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        Selecione uma aeronave para consultar o fechamento.
      </div>
    );
  }

  const nomesPorIdentificador = new Map<string, string>();
  for (const cotista of cotistas) {
    const nome = cotista.nome.trim() || cotista.id;
    const identificadores = [
      cotista.id,
      cotista.cliente_id,
      cotista.socio_id,
      cotista.nome,
      ...(cotista.cotista_ids ?? []),
    ];
    for (const identificador of identificadores) {
      if (identificador) {
        nomesPorIdentificador.set(identificador.trim().toLocaleLowerCase(), nome);
      }
    }
  }
  const nomeCotista = (identificador?: string | null) => {
    const valor = String(identificador ?? "").trim();
    return valor
      ? nomesPorIdentificador.get(valor.toLocaleLowerCase()) ?? valor
      : "Não informado";
  };
  const lancamentos = dashboard.lancamentos.filter((lancamento) => {
    const mes = String(lancamento.data ?? "").slice(0, 7);
    return (
      lancamento.fluxo === "SAIDA" &&
      mesesSelecionados.includes(mes)
    );
  });
  const colunasCotistas = Array.from(
    new Set([
      ...cotistas.map((cotista) => cotista.nome.trim()).filter(Boolean),
      ...lancamentos.map((lancamento) => nomeCotista(lancamento.pagoPor)),
    ]),
  );
  const totaisCategorias = new Map<
    string,
    { total: number; cotistas: Map<string, number> }
  >();
  for (const lancamento of lancamentos) {
    const categoria = lancamento.categoria || "Sem categoria";
    const atual = totaisCategorias.get(categoria) ?? {
      total: 0,
      cotistas: new Map<string, number>(),
    };
    atual.total += lancamento.valorCentavos;
    const pagador = nomeCotista(lancamento.pagoPor);
    atual.cotistas.set(
      pagador,
      (atual.cotistas.get(pagador) ?? 0) + lancamento.valorCentavos,
    );
    totaisCategorias.set(categoria, atual);
  }

  const fechamentos = new Map(
    dashboard.fechamento_mensal.map((item) => [item.mes, item]),
  );
  const medias = new Map(
    dashboard.medias_mensais.map((item) => [item.mes, item]),
  );
  const meses = Array.from(
    new Set([
      ...fechamentos.keys(),
      ...medias.keys(),
      ...lancamentos.map((lancamento) => String(lancamento.data).slice(0, 7)),
    ]),
  ).sort();
  const linhas: LinhaMensal[] = meses.map((mes) => ({
    mes,
    fechamento: fechamentos.get(mes),
    mediasMensais: medias.get(mes),
  }));

  if (linhas.length === 0 && lancamentos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        Nenhum fechamento disponível para esta aeronave no período selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saídas no período"
          valor={formatBRL(dashboard.resumo.saidas)}
          detalhe={`${linhas.length} competência(s) selecionada(s)`}
          Icon={Wallet}
          destaque
        />
        <KpiCard
          label="Custos rateados"
          valor={formatBRL(dashboard.resumo.custo_rateado)}
          detalhe="Valores atribuídos a esta aeronave"
          Icon={Gauge}
        />
        <KpiCard
          label="Custo por hora"
          valor={formatarCentavos(dashboard.medias.custo_por_hora_centavos)}
          detalhe={`${formatNumero(dashboard.medias.horas_voadas, 2)} h voadas`}
          Icon={Plane}
        />
        <KpiCard
          label="Custo médio por voo"
          valor={formatarCentavos(dashboard.medias.custo_medio_por_voo_centavos)}
          detalhe={`${formatNumero(dashboard.medias.total_voos, 0)} voo(s) no período`}
          Icon={Gauge}
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-card-foreground">
            Fechamento mensal da aeronave
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valores e médias calculados para a aeronave e o período selecionados.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "Mês",
                  "Lançamentos",
                  "Entradas",
                  "Saídas",
                  "Custo rateado",
                  "Saldo",
                  "Horas voadas",
                  "Voos",
                  "Pousos",
                  "Custo / hora",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground first:text-left"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ mes, fechamento, mediasMensais }) => (
                <tr key={mes} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-2 text-xs font-bold capitalize text-card-foreground"
                  >
                    {mesLabel(mes)}
                  </th>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {fechamento?.lancamentos ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatBRL(fechamento?.entradas ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatBRL(fechamento?.saidas ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatBRL(fechamento?.custoRateado ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-card-foreground">
                    {formatBRL(fechamento?.saldo ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatNumero(mediasMensais?.horas_voadas ?? 0, 2)} h
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatNumero(mediasMensais?.total_voos ?? 0, 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                    {formatNumero(mediasMensais?.total_pousos ?? 0, 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-card-foreground">
                    {formatarCentavos(mediasMensais?.custo_por_hora_centavos ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-card-foreground">
            Soma do valor pago por categoria e cotista
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Despesas agrupadas por categoria e por quem realizou o pagamento.
          </p>
        </header>
        {totaisCategorias.size > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-xs font-bold text-muted-foreground">
                    Categoria
                  </th>
                  {colunasCotistas.map((nome) => (
                    <th
                      key={nome}
                      className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground"
                    >
                      {nome}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...totaisCategorias.entries()]
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([categoria, valores]) => (
                    <tr key={categoria} className="border-b border-border last:border-0">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-card-foreground">
                        {categoria}
                      </th>
                      {colunasCotistas.map((nome) => (
                        <td
                          key={nome}
                          className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs text-muted-foreground"
                        >
                          {formatarCentavos(valores.cotistas.get(nome) ?? 0)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">
                        {formatarCentavos(valores.total)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40">
                  <th className="px-3 py-2 text-xs font-bold text-card-foreground">
                    Total
                  </th>
                  {colunasCotistas.map((nome) => (
                    <td
                      key={nome}
                      className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground"
                    >
                      {formatarCentavos(
                        [...totaisCategorias.values()].reduce(
                          (total, valores) => total + (valores.cotistas.get(nome) ?? 0),
                          0,
                        ),
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">
                    {formatarCentavos(
                      [...totaisCategorias.values()].reduce(
                        (total, valores) => total + valores.total,
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhuma despesa encontrada nos meses selecionados.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-card-foreground">
            Lançamentos e rateios
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Detalhamento de despesas, pagadores e parcelas de cada cotista.
          </p>
        </header>
        {lancamentos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Data</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Doc</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Fornecedor</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Descrição</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Categoria</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Tipo</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Prazo</th>
                  <th rowSpan={2} className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">Pago por</th>
                  <th rowSpan={2} className="px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">Valor pago</th>
                  {colunasCotistas.map((nome) => (
                    <th key={nome} colSpan={2} className="border-l border-border px-3 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">
                      {nome}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-muted/20">
                  {colunasCotistas.flatMap((nome) => [
                    <th key={`${nome}-percentual`} className="border-l border-border px-2 py-1 text-right text-[9px] font-semibold text-muted-foreground">%</th>,
                    <th key={`${nome}-valor`} className="px-2 py-1 text-right text-[9px] font-semibold text-muted-foreground">Rateio</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {[...lancamentos]
                  .sort((a, b) => a.data.localeCompare(b.data))
                  .map((lancamento) => {
                    const rateios = new Map<string, { percentual: number; valor: number }>();
                    for (const rateio of lancamento.rateios) {
                      const nome = nomeCotista(rateio.cotistaId || rateio.cotista);
                      const atual = rateios.get(nome) ?? { percentual: 0, valor: 0 };
                      atual.percentual += rateio.percentual;
                      atual.valor += rateio.valorCentavos;
                      rateios.set(nome, atual);
                    }
                    const documento = lancamento.documento || lancamento.numeroDoc || lancamento.numeroNf || lancamento.numeroRecibo || "—";
                    return (
                      <tr key={lancamento.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatarData(lancamento.data)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{documento}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">{lancamento.fornecedor || "—"}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-xs font-medium text-card-foreground">{lancamento.descricao}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{lancamento.categoria}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{lancamento.tipo || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{lancamento.prazo || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{nomeCotista(lancamento.pagoPor)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs font-semibold text-card-foreground">{formatarCentavos(lancamento.valorCentavos)}</td>
                        {colunasCotistas.flatMap((nome) => {
                          const rateio = rateios.get(nome);
                          return [
                            <td key={`${lancamento.id}-${nome}-percentual`} className="whitespace-nowrap border-l border-border/70 px-2 py-2 text-right font-mono text-[10px] text-muted-foreground">
                              {rateio ? `${formatNumero(rateio.percentual, 4)}%` : "—"}
                            </td>,
                            <td key={`${lancamento.id}-${nome}-valor`} className="whitespace-nowrap px-2 py-2 text-right font-mono text-[10px] text-muted-foreground">
                              {rateio ? formatarCentavos(rateio.valor) : "—"}
                            </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhum lançamento encontrado nos meses selecionados.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-card-foreground">
            Compensação entre cotistas
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Valores a receber de cada cotista nos meses selecionados.
          </p>
        </header>
        {Object.keys(dashboard.matrizCompensacao).length > 0 ? (
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground">
                    Pago por ↓ / A receber de →
                  </th>
                  {Object.keys(dashboard.matrizCompensacao).map((devedor) => (
                    <th key={devedor} className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase text-muted-foreground">
                      {nomeCotista(devedor)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(dashboard.matrizCompensacao).map(([credor, devedores]) => (
                  <tr key={credor} className="border-t border-border">
                    <th className="whitespace-nowrap bg-muted/20 px-3 py-2 text-left text-xs font-semibold text-card-foreground">
                      {nomeCotista(credor)}
                    </th>
                    {Object.keys(dashboard.matrizCompensacao).map((devedor) => {
                      const valor = devedores[devedor] ?? 0;
                      return (
                        <td key={devedor} className={`whitespace-nowrap px-3 py-2 text-right font-mono text-xs ${valor > 0 ? "font-bold text-primary" : "text-muted-foreground/50"}`}>
                          {valor > 0 ? formatarCentavos(valor) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nenhuma compensação pendente nos meses selecionados.
          </p>
        )}
      </section>
    </div>
  );
}