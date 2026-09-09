import React from 'react';
import { AlertTriangle, Calculator, Gauge, Layers, Plane, Wallet } from 'lucide-react';
import { SectionCard } from '../financeiro/SectionCard';
import { KpiCard } from '../financeiro/KpiCard';
import { useBalancoCotista } from '../../hooks/useBalancoCotista';
import type { LinhaBalanco, LinhaMedia } from '../../types/balanco';
import { formatBRL, formatNumero } from '../../utils/format';

const fixos = (l: LinhaBalanco) => l.admTrip + l.hangaragem + l.manutencaoFixa;
const variaveis = (l: LinhaBalanco) =>
l.combustivel + l.manutencaoHora + l.taxasVoo + l.hoteisAlimentacao;
const totalLinha = (l: LinhaBalanco) => fixos(l) + variaveis(l) + l.custosExtras;

function Celula({
  children,
  destaque = false,
  className = ''




}: {children: React.ReactNode;destaque?: boolean;className?: string;}) {
  return (
    <td
      className={`num whitespace-nowrap px-3 py-2 text-right text-xs ${
      destaque ? 'font-bold text-card-foreground' : 'text-muted-foreground'} ${
      className}`}>
      
      {children}
    </td>);

}

function Cabecalho({
  children,
  colSpan,
  className = ''




}: {children: React.ReactNode;colSpan?: number;className?: string;}) {
  return (
    <th
      scope="col"
      colSpan={colSpan}
      className={`whitespace-nowrap border-b border-border px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground ${className}`}>
      
      {children}
    </th>);

}

export function FechamentoBalancoCotista() {
  const { balanco, carregando, erro } = useBalancoCotista();

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) =>
          <div key={i} className="h-[104px] animate-pulse rounded-xl border border-border bg-muted/50" />
          )}
        </div>
        <div className="h-[320px] animate-pulse rounded-xl border border-border bg-muted/50" />
      </div>);

  }

  if (erro || !balanco) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/40 bg-danger-soft/40 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
        <p className="text-sm font-bold text-card-foreground">
          Não foi possível montar o fechamento
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {erro ?? 'Planilha de fechamento indisponível.'}
        </p>
      </div>);

  }

  const totais = balanco.geral.reduce(
    (acc, l) => ({
      admTrip: acc.admTrip + l.admTrip,
      hangaragem: acc.hangaragem + l.hangaragem,
      manutencaoFixa: acc.manutencaoFixa + l.manutencaoFixa,
      combustivel: acc.combustivel + l.combustivel,
      manutencaoHora: acc.manutencaoHora + l.manutencaoHora,
      taxasVoo: acc.taxasVoo + l.taxasVoo,
      hoteisAlimentacao: acc.hoteisAlimentacao + l.hoteisAlimentacao,
      custosExtras: acc.custosExtras + l.custosExtras,
      abastecimentoL: acc.abastecimentoL + l.abastecimentoL,
      distancia: acc.distancia + l.distancia,
      pousos: acc.pousos + l.pousos,
      horasVoo: acc.horasVoo + l.horasVoo,
      horasTotais: acc.horasTotais + l.horasTotais,
      diasVoo: acc.diasVoo + l.diasVoo
    }),
    {
      admTrip: 0,
      hangaragem: 0,
      manutencaoFixa: 0,
      combustivel: 0,
      manutencaoHora: 0,
      taxasVoo: 0,
      hoteisAlimentacao: 0,
      custosExtras: 0,
      abastecimentoL: 0,
      distancia: 0,
      pousos: 0,
      horasVoo: 0,
      horasTotais: 0,
      diasVoo: 0
    } as Omit<LinhaBalanco, 'mes'>
  );

  const totalFixos = totais.admTrip + totais.hangaragem + totais.manutencaoFixa;
  const totalVariaveis =
  totais.combustivel + totais.manutencaoHora + totais.taxasVoo + totais.hoteisAlimentacao;
  const totalGeral = totalFixos + totalVariaveis + totais.custosExtras;
  const custoHora = totais.horasVoo > 0 ? totalGeral / totais.horasVoo : 0;
  const custoKm = totais.distancia > 0 ? totalGeral / totais.distancia : 0;
  const custoDia = totais.diasVoo > 0 ? totalGeral / totais.diasVoo : 0;

  const mediaMes = totalGeral / Math.max(1, balanco.geral.length);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Geral"
          valor={formatBRL(totalGeral)}
          detalhe={`${balanco.geral.length} competências · média ${formatBRL(mediaMes)}/mês`}
          Icon={Wallet}
          destaque />
        
        <KpiCard
          label="Custos Fixos"
          valor={formatBRL(totalFixos)}
          detalhe={`${Math.round(totalFixos / totalGeral * 100)}% do total · ADM/Trip, hangaragem e manut. fixa`}
          Icon={Layers} />
        
        <KpiCard
          label="Custos Variáveis"
          valor={formatBRL(totalVariaveis)}
          detalhe={`${Math.round(totalVariaveis / totalGeral * 100)}% do total · combustível, manut./hora, taxas e hotéis`}
          Icon={Gauge} />
        
        <KpiCard
          label="Custos Extras"
          valor={formatBRL(totais.custosExtras)}
          detalhe="Eventos fora do orçamento previsto"
          Icon={Calculator} />
        
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Custo por Hora"
          valor={`${formatBRL(custoHora)}/h`}
          detalhe={`${formatNumero(totais.horasVoo, 2)} h de voo apuradas`}
          Icon={Plane} />
        
        <KpiCard
          label="Custo por KM"
          valor={`${formatBRL(custoKm)}/km`}
          detalhe={`${formatNumero(totais.distancia)} NM percorridos`}
          Icon={Gauge} />
        
        <KpiCard
          label="Custo por Dia"
          valor={`${formatBRL(custoDia)}/dia`}
          detalhe={`${formatNumero(totais.diasVoo)} dias de operação`}
          Icon={Calculator} />
        
        <KpiCard
          label="Abastecimento"
          valor={`${formatNumero(totais.abastecimentoL)} L`}
          detalhe={`${formatNumero(totais.pousos)} pousos registrados`}
          Icon={Plane} />
        
      </div>

      <SectionCard
        titulo={`Resumo Geral — ${balanco.exercicio}`}
        descricao={`${balanco.cotista} · ${balanco.aeronave} · fechamento mensal de custos e operação`}
        Icon={Layers}
        semPadding>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Cabecalho className="sticky left-0 z-10 bg-card text-left">Competência</Cabecalho>
                <Cabecalho colSpan={3} className="bg-warning-soft/40 text-center">
                  Custos Fixos
                </Cabecalho>
                <Cabecalho colSpan={4} className="bg-brand-soft/40 text-center">
                  Custos Variáveis
                </Cabecalho>
                <Cabecalho className="text-center">Extras</Cabecalho>
                <Cabecalho className="text-center">Total</Cabecalho>
                <Cabecalho colSpan={6} className="bg-muted/60 text-center">
                  Operação
                </Cabecalho>
              </tr>
              <tr>
                <Cabecalho className="sticky left-0 z-10 bg-card text-left">Mês</Cabecalho>
                <Cabecalho>ADM / Trip.</Cabecalho>
                <Cabecalho>Hangaragem</Cabecalho>
                <Cabecalho>Manut. fixa</Cabecalho>
                <Cabecalho>Combustível</Cabecalho>
                <Cabecalho>Manut. / hora</Cabecalho>
                <Cabecalho>Taxas de voo</Cabecalho>
                <Cabecalho>Hotéis / alim.</Cabecalho>
                <Cabecalho>Extras</Cabecalho>
                <Cabecalho>Total do mês</Cabecalho>
                <Cabecalho>Abast. (L)</Cabecalho>
                <Cabecalho>Distância</Cabecalho>
                <Cabecalho>Pousos</Cabecalho>
                <Cabecalho>H voo</Cabecalho>
                <Cabecalho>H total</Cabecalho>
                <Cabecalho>Dias voo</Cabecalho>
              </tr>
            </thead>
            <tbody>
              {balanco.geral.map((l) =>
              <tr key={l.mes} className="border-b border-border transition-colors hover:bg-accent">
                  <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 text-left text-xs font-bold text-card-foreground">
                  
                    {l.mes}
                  </th>
                  <Celula>{formatBRL(l.admTrip, true)}</Celula>
                  <Celula>{formatBRL(l.hangaragem, true)}</Celula>
                  <Celula>{formatBRL(l.manutencaoFixa, true)}</Celula>
                  <Celula>{formatBRL(l.combustivel, true)}</Celula>
                  <Celula>{formatBRL(l.manutencaoHora, true)}</Celula>
                  <Celula>{formatBRL(l.taxasVoo, true)}</Celula>
                  <Celula>{formatBRL(l.hoteisAlimentacao, true)}</Celula>
                  <Celula>{formatBRL(l.custosExtras, true)}</Celula>
                  <Celula destaque>{formatBRL(totalLinha(l), true)}</Celula>
                  <Celula>{formatNumero(l.abastecimentoL)}</Celula>
                  <Celula>{formatNumero(l.distancia)}</Celula>
                  <Celula>{formatNumero(l.pousos)}</Celula>
                  <Celula>{formatNumero(l.horasVoo, 2)}</Celula>
                  <Celula>{formatNumero(l.horasTotais, 2)}</Celula>
                  <Celula>{formatNumero(l.diasVoo)}</Celula>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60">
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-muted/60 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-card-foreground">
                  
                  Total
                </th>
                <Celula destaque>{formatBRL(totais.admTrip, true)}</Celula>
                <Celula destaque>{formatBRL(totais.hangaragem, true)}</Celula>
                <Celula destaque>{formatBRL(totais.manutencaoFixa, true)}</Celula>
                <Celula destaque>{formatBRL(totais.combustivel, true)}</Celula>
                <Celula destaque>{formatBRL(totais.manutencaoHora, true)}</Celula>
                <Celula destaque>{formatBRL(totais.taxasVoo, true)}</Celula>
                <Celula destaque>{formatBRL(totais.hoteisAlimentacao, true)}</Celula>
                <Celula destaque>{formatBRL(totais.custosExtras, true)}</Celula>
                <Celula destaque>{formatBRL(totalGeral, true)}</Celula>
                <Celula destaque>{formatNumero(totais.abastecimentoL)}</Celula>
                <Celula destaque>{formatNumero(totais.distancia)}</Celula>
                <Celula destaque>{formatNumero(totais.pousos)}</Celula>
                <Celula destaque>{formatNumero(totais.horasVoo, 2)}</Celula>
                <Celula destaque>{formatNumero(totais.horasTotais, 2)}</Celula>
                <Celula destaque>{formatNumero(totais.diasVoo)}</Celula>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {balanco.medias.length > 0 ?
      <SectionCard
        titulo="Resumo das Médias"
        descricao="Médias mensais por categoria e indicadores operacionais e financeiros"
        Icon={Gauge}
        semPadding>
        
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Cabecalho className="sticky left-0 z-10 bg-card text-left">Mês</Cabecalho>
                  <Cabecalho colSpan={3} className="bg-warning-soft/40 text-center">
                    Fixos (média)
                  </Cabecalho>
                  <Cabecalho colSpan={4} className="bg-brand-soft/40 text-center">
                    Variáveis (média)
                  </Cabecalho>
                  <Cabecalho className="text-center">Extras</Cabecalho>
                  <Cabecalho colSpan={3} className="bg-muted/60 text-center">
                    Operacionais
                  </Cabecalho>
                  <Cabecalho colSpan={3} className="bg-success-soft/40 text-center">
                    Financeiras
                  </Cabecalho>
                </tr>
                <tr>
                  <Cabecalho className="sticky left-0 z-10 bg-card text-left">
                    Competência
                  </Cabecalho>
                  <Cabecalho>ADM / Trip.</Cabecalho>
                  <Cabecalho>Hangaragem</Cabecalho>
                  <Cabecalho>Manut. fixa</Cabecalho>
                  <Cabecalho>Combustível</Cabecalho>
                  <Cabecalho>Manut. / hora</Cabecalho>
                  <Cabecalho>Taxas de voo</Cabecalho>
                  <Cabecalho>Hotéis / alim.</Cabecalho>
                  <Cabecalho>Extras</Cabecalho>
                  <Cabecalho>Litros</Cabecalho>
                  <Cabecalho>Valor / litro</Cabecalho>
                  <Cabecalho>Velocidade</Cabecalho>
                  <Cabecalho>Custo hora</Cabecalho>
                  <Cabecalho>Custo km</Cabecalho>
                  <Cabecalho>Custo dia</Cabecalho>
                </tr>
              </thead>
              <tbody>
                {balanco.medias.map((l: LinhaMedia) =>
              <tr
                key={l.mes}
                className="border-b border-border transition-colors hover:bg-accent">
                
                    <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 text-left text-xs font-bold text-card-foreground">
                  
                      {l.mes}
                    </th>
                    <Celula>{formatBRL(l.admTrip, true)}</Celula>
                    <Celula>{formatBRL(l.hangaragem, true)}</Celula>
                    <Celula>{formatBRL(l.manutencaoFixa, true)}</Celula>
                    <Celula>{formatBRL(l.combustivel, true)}</Celula>
                    <Celula>{formatBRL(l.manutencaoHora, true)}</Celula>
                    <Celula>{formatBRL(l.taxasVoo, true)}</Celula>
                    <Celula>{formatBRL(l.hoteisAlimentacao, true)}</Celula>
                    <Celula>{formatBRL(l.custosExtras, true)}</Celula>
                    <Celula>{formatNumero(l.litros, 2)}</Celula>
                    <Celula>{formatBRL(l.valorLitro)}</Celula>
                    <Celula>{formatNumero(l.velocidade)}</Celula>
                    <Celula destaque>{formatBRL(l.custoHora, true)}</Celula>
                    <Celula destaque>{formatBRL(l.custoKm)}</Celula>
                    <Celula destaque>{formatBRL(l.custoDia, true)}</Celula>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        </SectionCard> :
      null}
    </div>);

}