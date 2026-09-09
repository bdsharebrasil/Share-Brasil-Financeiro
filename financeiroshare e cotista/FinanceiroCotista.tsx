import React, { useState } from 'react';
import { Clock, Download, FileText, Plane, TrendingDown, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/layout/PageHeader';
import { KpiCard } from '../components/financeiro/KpiCard';
import { SectionCard } from '../components/financeiro/SectionCard';
import { StatusBadge } from '../components/financeiro/StatusBadge';
import { TabelaLancamentos } from '../components/financeiro/TabelaLancamentos';
import { DarBaixaDialog } from '../components/financeiro/DarBaixaDialog';
import { RankingUtilizacao } from '../components/financeiro/RankingUtilizacao';
import { GraficosUtilizacao } from '../components/financeiro/GraficosUtilizacao';
import {
  GraficoCustoHoraCotista,
  GraficoCustoMesCotista } from
'../components/financeiro/GraficosCotista';
import { ContasEmAberto } from '../components/financeiro/ContasEmAberto';
import { GraficosCustos } from '../components/financeiro/GraficosCustos';
import { RankingGastos } from '../components/financeiro/RankingGastos';
import { Avatar, AvatarFallback } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchableCombobox } from '../components/ui/SearchableCombobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { aeronaves, contasEmAberto, cotistas } from '../data/financeiro';
import { rankingCotistas } from '../data/metricas';
import { useLancamentos } from '../hooks/useLancamentos';
import type { Lancamento } from '../types/financeiro';
import { formatBRL, formatData, formatNumero } from '../utils/format';

const ABAS = [
{ id: 'balanco', label: 'Balanço' },
{ id: 'custos', label: 'Custos por Categoria' },
{ id: 'utilizacao', label: 'Utilização' },
{ id: 'ranking', label: 'Ranking' },
{ id: 'aberto', label: 'Contas em Aberto' },
{ id: 'lancamentos', label: 'Lançamentos' }];


export function FinanceiroCotista() {
  const [cotistaId, setCotistaId] = useState(cotistas[0].id);
  const [baixa, setBaixa] = useState<Lancamento | null>(null);
  const { itens, filtros, setFiltros, darBaixa } = useLancamentos(cotistaId);

  const cotista = cotistas.find((c) => c.id === cotistaId)!;
  const aeronave = aeronaves.find((a) => a.id === cotista.aeronaveId)!;
  const ranking = rankingCotistas.find((r) => r.cotistaId === cotistaId)!;
  const posicao =
  [...rankingCotistas].
  sort((a, b) => a.custoHora - b.custoHora).
  findIndex((r) => r.cotistaId === cotistaId) + 1;

  const pendentes = contasEmAberto.filter((c) => c.cotistaId === cotistaId);
  const saldoAberto = pendentes.reduce((s, c) => s + c.valor, 0);

  return (
    <>
      <PageHeader
        trilha={['Finanças', 'Financeiro Cotista']}
        titulo="Financeiro Cotista"
        subtitulo="Balanço do cliente: rateio, utilização e custos individuais"
        acoes={
        <>
            <div className="w-full sm:w-[260px]">
              <SearchableCombobox
              items={cotistas.map((c) => ({
                id: c.id,
                label: c.nome,
                badge: `${c.percentualSociedade}%`,
                grupo: aeronaves.find((a) => a.id === c.aeronaveId)?.prefixo,
                descricao: `${formatNumero(c.horasVoadas, 1)} h voadas · ${
                aeronaves.find((a) => a.id === c.aeronaveId)?.modelo}`

              }))}
              value={cotistaId}
              onChange={setCotistaId}
              ariaLabel="Selecionar cotista"
              searchPlaceholder="Buscar cotista ou aeronave…"
              icon={<Users className="h-4 w-4" />} />
            
            </div>
            <Button
            variant="outline"
            size="sm"
            onClick={() =>
            toast.info('Demonstrativo enviado', {
              description: `Extrato de ${cotista.nome} enviado por e-mail.`
            })
            }>
            
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Extrato do cotista
            </Button>
          </>
        } />
      

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-brand text-base text-brand-foreground">
            {cotista.avatar}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-card-foreground">{cotista.nome}</h2>
            <Badge variant="outline" className="num">
              {aeronave.prefixo}
            </Badge>
            <Badge variant="secondary">{cotista.percentualSociedade}% de cota</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {aeronave.modelo} · {posicao}º no ranking de custo por hora
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo em aberto</p>
          <p
            className={`num text-2xl font-semibold ${saldoAberto > 0 ? 'text-danger' : 'text-success'}`}>
            
            {formatBRL(saldoAberto)}
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Horas Voadas"
          valor={`${formatNumero(cotista.horasVoadas, 1)} h`}
          detalhe="Competência Jun/2026"
          Icon={Plane} />
        
        <KpiCard
          label="Custo por Hora"
          valor={`${formatBRL(ranking.custoHora)}/h`}
          detalhe={`${posicao}º entre ${rankingCotistas.length} cotistas`}
          Icon={TrendingDown} />
        
        <KpiCard
          label="Custo do Mês"
          valor={formatBRL(ranking.custoMes)}
          detalhe={`Rateio de ${cotista.percentualSociedade}% da cota`}
          Icon={Wallet} />
        
        <KpiCard
          label="Títulos Pendentes"
          valor={`${pendentes.length} títulos`}
          detalhe={pendentes.length > 0 ? formatBRL(saldoAberto) : 'Cotista em dia'}
          Icon={Clock}
          destaque={pendentes.length > 0} />
        
      </div>

      <Tabs defaultValue="balanco">
        <div className="mb-4 overflow-x-auto pb-1">
          <TabsList className="w-max">
            {ABAS.map((a) =>
            <TabsTrigger key={a.id} value={a.id} className="whitespace-nowrap">
                {a.label}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="balanco" className="space-y-4">
          <GraficoCustoMesCotista cotista={cotista} />
          <SectionCard
            titulo="Títulos do cotista"
            descricao={`${pendentes.length} pendências · ${formatBRL(saldoAberto)}`}
            Icon={FileText}
            semPadding>
            
            {pendentes.length === 0 ?
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                Nenhum título pendente. Cotista em dia com o rateio.
              </p> :

            <ul className="divide-y divide-border">
                {pendentes.map((c) =>
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="num text-sm font-medium text-card-foreground">{c.id}</p>
                      <p className="num text-xs text-muted-foreground">
                        {c.competencia} · venc. {formatData(c.vencimento)}
                      </p>
                    </div>
                    <p className="num text-sm font-semibold text-card-foreground">
                      {formatBRL(c.valor)}
                    </p>
                    <StatusBadge status={c.status} />
                  </li>
              )}
              </ul>
            }
          </SectionCard>
        </TabsContent>

        <TabsContent value="custos" className="space-y-4">
          <GraficosCustos />
          <RankingGastos />
        </TabsContent>

        <TabsContent value="utilizacao" className="space-y-4">
          <GraficosUtilizacao />
          <GraficoCustoHoraCotista cotista={cotista} />
        </TabsContent>

        <TabsContent value="ranking">
          <RankingUtilizacao destaqueId={cotistaId} />
        </TabsContent>

        <TabsContent value="aberto">
          <ContasEmAberto />
        </TabsContent>

        <TabsContent value="lancamentos">
          <TabelaLancamentos
            titulo="Lançamentos do cotista"
            itens={itens}
            filtros={filtros}
            onFiltrar={setFiltros}
            onDarBaixa={setBaixa} />
          
        </TabsContent>
      </Tabs>

      <DarBaixaDialog lancamento={baixa} onFechar={() => setBaixa(null)} onConfirmar={darBaixa} />
    </>);

}