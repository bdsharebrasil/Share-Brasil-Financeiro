# Propostas de gerenciamento no Gestor

Dashboard Gestor → Contratos → Propostas de gerenciamento permite criar, retomar e editar uma proposta a partir do modelo comercial Share Brasil. O documento usa as tabelas existentes `contratos`, `contrato_partes` e `contrato_anexos`. O modelo e as condições ficam em `dados_adicionais.proposta_gerenciamento`; o discriminador é `modelo: PROPOSTA_GERENCIAMENTO`.

O rascunho pode ter partes incompletas. Para gerar PDF ou avançar o status, preencha as partes, a aeronave e os serviços. Os dados são salvos automaticamente após a edição, com a opção Salvar agora. Erros mantêm o preenchimento na tela; conflitos permitem reabrir explicitamente a versão salva. Os demais contratos continuam no editor anterior.

O preço é o valor do pacote OU a soma dos grupos selecionados. A unidade define se é cobrado por cotista ou por aeronave. No modo pacote, os preços de referência dos grupos não são adicionados ao total. O conteúdo da proposta, inclusive condições comerciais, é editável.

Gerar e salvar PDF aguarda a gravação, gera um documento A4 com texto selecionável, armazena uma nova versão protegida e baixa o arquivo. As versões ficam em Andamento → Arquivos e versões. A geração não muda automaticamente o status para Enviado ou Assinado. Atualize o andamento conforme os eventos reais e anexe o documento assinado quando disponível.

Publicar primeiro o backend correspondente, que inclui revisões, histórico e validação. Não há migração nova. Não há alterações em `contratos_trabalho`.

Validação: testes de cálculo, datas e retomada (`tests/proposta-gerenciamento.test.mjs`); conferência de tipos dos novos módulos; fluxo DOM com criação, seleção de aeronave/cotista, salvamento automático, falha de conexão, edição durante gravação e reabertura; PDF padrão renderizado e conferido em três páginas A4. A conferência visual dentro da sessão autenticada de produção deve ocorrer após a publicação.
