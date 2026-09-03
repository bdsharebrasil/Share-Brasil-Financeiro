import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AbaCaixaEmpresa } from './AbaCaixaEmpresa';
import { AbaContasAPagar } from './AbaContasAPagar';
import { AbaContasAReceber } from './AbaContasAReceber';
// Próximas abas a implementar, na ordem combinada:
// import { AbaFolhaPagamento } from './abas/AbaFolhaPagamento';
// import { AbaNotasSaida } from './abas/AbaNotasSaida';
// import { AbaConfiguracoesShare } from './abas/AbaConfiguracoesShare';

export function PaginaFinanceiroShare() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Financeiro Share</h1>

      <Tabs defaultValue="caixa-empresa">
        <TabsList>
          <TabsTrigger value="caixa-empresa">Caixa Empresa</TabsTrigger>
          <TabsTrigger value="contas-apagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="contas-areceber">Contas a Receber</TabsTrigger>
          {/* <TabsTrigger value="folha-pagamento">Folha de Pagamento</TabsTrigger> */}
          {/* <TabsTrigger value="notas-saida">Notas e Recibos</TabsTrigger> */}
          {/* <TabsTrigger value="configuracoes">Configurações</TabsTrigger> */}
        </TabsList>

        <TabsContent value="caixa-empresa">
          <AbaCaixaEmpresa />
        </TabsContent>

        <TabsContent value="contas-apagar">
          <AbaContasAPagar />
        </TabsContent>

        <TabsContent value="contas-areceber">
          <AbaContasAReceber />
        </TabsContent>
      </Tabs>
    </div>
  );
}