import React from 'react';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { FechamentoBalancoCotista } from '../components/relatorios/FechamentoBalancoCotista';

export function Relatorios() {
  return (
    <>
      <PageHeader
        trilha={['Analytics', 'Relatórios', 'Fechamento do Balanço']}
        titulo="Fechamento do Balanço do Cotista"
        subtitulo="Consolidação mensal de custos fixos, variáveis, extras e indicadores de operação"
        acoes={
        <>
            <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Relatório enviado para impressão')}>
            
              <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Imprimir
            </Button>
            <Button
            size="sm"
            onClick={() =>
            toast.success('Fechamento exportado', {
              description: 'Planilha do balanço gerada em .xlsx.'
            })
            }>
            
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Exportar fechamento
            </Button>
          </>
        } />
      

      <Tabs defaultValue="fechamento">
        <div className="mb-4 overflow-x-auto pb-1">
          <TabsList className="w-max">
            <TabsTrigger value="fechamento" className="whitespace-nowrap">
              Fechamento do Balanço
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="fechamento">
          <FechamentoBalancoCotista />
        </TabsContent>
      </Tabs>
    </>);

}