import React, { useMemo, useState } from 'react';
import { Building2, Download, Layers, Scale, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/layout/PageHeader';
import { KpiCard } from '../components/financeiro/KpiCard';
import { TabelaLancamentos } from '../components/financeiro/TabelaLancamentos';
import { NovaDespesaDialog } from '../components/financeiro/NovaDespesaDialog';
import { DarBaixaDialog } from '../components/financeiro/DarBaixaDialog';
import { GraficoFixoVariavel } from '../components/financeiro/GraficoFixoVariavel';
import { ContasAReceber } from '../components/financeiro/ContasAReceber';
import { FolhaPagamento } from '../components/financeiro/FolhaPagamento';
import { NotasFiscaisSaida } from '../components/financeiro/NotasFiscaisSaida';
import { Orcamentos } from '../components/financeiro/Orcamentos';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { useLancamentos } from '../hooks/useLancamentos';
import type { Lancamento } from '../types/financeiro';
import { formatBRL } from '../utils/format';
import { serieMensal } from '../data/metricas';

const ABAS = [
{ id: 'pagar', label: 'Contas a Pagar' },
{ id: 'receber', label: 'Contas a Receber' },
{ id: 'salario', label: 'Pagamento Salário' },
{ id: 'lancamentos', label: 'Lançamentos' },
{ id: 'nf-saida', label: 'Nota Fiscal de Saída' },
{ id: 'orcamentos', label: 'Orçamentos' }];


export function FinanceiroShare() {
  const { itens, todos, filtros, setFiltros, adicionar, darBaixa } = useLancamentos();
  const [baixa, setBaixa] = useState<Lancamento | null>(null);

  // Financeiro Share trata apenas dos custos da empresa.
  const somenteEmpresa = (l: Lancamento) =>
  l.grupoCategoria !== 'RECEITAS OPERACIONAIS' && l.fluxo !== 'RECEITA';

  const despesas = useMemo(() => itens.filter(somenteEmpresa), [itens]);
  const aPagar = useMemo(
    () => despesas.filter((l) => l.status === 'EM_ABERTO' || l.status === 'EM_ATRASO'),
    [despesas]
  );

  const resumo = useMemo(() => {
    const base = todos.filter(somenteEmpresa);
    return {
      emAberto: base.
      filter((l) => l.status === 'EM_ABERTO' || l.status === 'EM_ATRASO').
      reduce((s, l) => s + l.valor, 0),
      atrasado: base.filter((l) => l.status === 'EM_ATRASO').reduce((s, l) => s + l.valor, 0)
    };
  }, [todos]);

  const custoTotal = serieMensal.reduce((s, m) => s + m.custoTotal, 0);
  const custoFixo = serieMensal.reduce((s, m) => s + m.custoFixo, 0);
  const custoVariavel = serieMensal.reduce((s, m) => s + m.custoVariavel, 0);

  return (
    <>
      <PageHeader
        trilha={['Finanças', 'Financeiro Share']}
        titulo="Financeiro Share"
        subtitulo="Custos operacionais da empresa · Exercício 2026 (Jan–Jun)"
        acoes={
        <>
            <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('DRE exportado', { description: 'Arquivo .xlsx gerado.' })}>
            
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Exportar DRE
            </Button>
            <NovaDespesaDialog onCriar={adicionar} />
          </>
        } />
      

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Custo Total"
          valor={formatBRL(custoTotal)}
          detalhe={`${serieMensal.length} competências apuradas`}
          Icon={Layers}
          destaque />
        
        <KpiCard
          label="Custo Fixo"
          valor={formatBRL(custoFixo)}
          detalhe={`${Math.round(custoFixo / custoTotal * 100)}% do custo total`}
          Icon={Building2} />
        
        <KpiCard
          label="Custo Variável"
          valor={formatBRL(custoVariavel)}
          detalhe={`${Math.round(custoVariavel / custoTotal * 100)}% do custo total`}
          Icon={Scale} />
        
        <KpiCard
          label="A Pagar em Aberto"
          valor={formatBRL(resumo.emAberto)}
          detalhe={
          resumo.atrasado > 0 ?
          `${formatBRL(resumo.atrasado)} em atraso` :
          'Nenhum título em atraso'
          }
          Icon={Wallet} />
        
      </div>

      <div className="mb-5">
        <GraficoFixoVariavel />
      </div>

      <Tabs defaultValue="pagar">
        <div className="mb-4 overflow-x-auto pb-1">
          <TabsList className="w-max">
            {ABAS.map((a) =>
            <TabsTrigger key={a.id} value={a.id} className="whitespace-nowrap">
                {a.label}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="pagar">
          <TabelaLancamentos
            titulo="Contas a pagar"
            itens={aPagar}
            filtros={filtros}
            onFiltrar={setFiltros}
            onDarBaixa={setBaixa} />
          
        </TabsContent>

        <TabsContent value="receber">
          <ContasAReceber />
        </TabsContent>

        <TabsContent value="salario">
          <FolhaPagamento />
        </TabsContent>

        <TabsContent value="lancamentos">
          <TabelaLancamentos
            itens={despesas}
            filtros={filtros}
            onFiltrar={setFiltros}
            onDarBaixa={setBaixa}
            acoes={<NovaDespesaDialog onCriar={adicionar} />} />
          
        </TabsContent>

        <TabsContent value="nf-saida">
          <NotasFiscaisSaida />
        </TabsContent>

        <TabsContent value="orcamentos">
          <Orcamentos />
        </TabsContent>
      </Tabs>

      <DarBaixaDialog lancamento={baixa} onFechar={() => setBaixa(null)} onConfirmar={darBaixa} />
    </>);

}