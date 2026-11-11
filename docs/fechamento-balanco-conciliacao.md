# Conciliação do fechamento PT-JPK com os extratos reais

## Fontes e diagnóstico confirmado

Foram conferidos o export `jpk.sql` do diário da aeronave `23fe8674-422f-42e0-bd27-cbee106b6c71` e o CSV `2 - CONTROLE GERAL PT JPK TESTE(C.csv`, fornecidos em 11/11/2026. Também foi considerada a comparação dos PDFs anteriores.

O diário contém **seis etapas: quatro VT - Voo Teste e dois TR - Traslado**. Todas têm `cliente_id`, `socio_id` e `holding_id` nulos, sem empréstimo. O registro de 28/08 é efetivamente um voo de teste. Isso confirma a causa do zero individual: o fechamento anterior exigia titular direto para reconhecer as horas do cotista.

A correção dos PRs frontend #124 e backend #16 já foi incorporada ao `main` pelo usuário. Compartilhamento considera cotistas ativos com participação positiva do cadastro atual, em parcelas iguais, preservando a duração física de cada etapa. A participação de 100% da Santa Rosa foi informada no PDF anterior; não faz parte do export do diário.

## Precisão dos tempos

Os horários são a referência quando completos e válidos. Os valores decimais gravados continuam disponíveis, sem alteração do D1. O backend acrescenta minutos de AC a COR e de DEP a POU; o fechamento converte esses minutos para horas sem arredondar cada etapa. Se os horários estiverem ausentes ou inválidos, utiliza o tempo decimal registrado. Relógios cruzando meia-noite são tratados como uma etapa de até 24 horas.

| Data D1 | Natureza | AC–COR | DEP–POU | Tempo total gravado |
| --- | --- | --- | --- | --- |
| 14/01/2026 | Voo teste | 22 min | 15 min | 0,37 h |
| 30/01/2026 | Traslado | 48 min | 37 min | 0,80 h |
| 27/02/2026 | Voo teste | 25 min | 14 min | 0,42 h |
| 11/05/2026 | Traslado | 27 min | 15 min | 0,45 h |
| 28/08/2026 | Voo teste | 25 min | 14 min | 0,42 h |
| 16/09/2026 | Voo teste | 27 min | 15 min | 0,45 h |
| **Total** | **6 etapas** | **174 min = 2h54** | **110 min = 1h50** | **2,91 h, exibidas como 2h55** |

Em agosto, 25 minutos equivalem a **25/60 h**, e não exatamente 0,42 nem 0,41. Com R$ 15.596,58 de despesas, o custo/hora é **R$ 37.431,79**. O cálculo anterior com 0,42 produzia R$ 37.134,71; a planilha resumida com 0,41 produzia R$ 38.040,44. A diferença é de precisão do denominador, não de valor financeiro.

## Conciliação do CSV de despesas

O CSV contém lançamentos históricos de 2020 a novembro de 2026. Foram selecionados apenas janeiro a setembro de 2026 para o período dos PDFs: **27 despesas e R$ 92.098,40**. Cabeçalhos, linhas vazias e linhas de modelo sem data não são despesas.

| Mês | Despesas | Etapas D1 | Horas totais pelos horários |
| --- | ---: | ---: | ---: |
| Janeiro | R$ 27.309,40 | 2 | 1h10 |
| Fevereiro | R$ 5.000,00 | 1 | 0h25 |
| Março | R$ 6.519,01 | 0 | 0h00 |
| Abril | R$ 5.251,13 | 0 | 0h00 |
| Maio | R$ 6.680,00 | 1 | 0h27 |
| Junho | R$ 8.742,28 | 0 | 0h00 |
| Julho | R$ 8.500,00 | 0 | 0h00 |
| Agosto | R$ 15.596,58 | 1 | 0h25 |
| Setembro | R$ 8.500,00 | 1 | 0h27 |
| **Total** | **R$ 92.098,40** | **6** | **2h54** |

Custo/hora do conjunto conciliado: R$ 92.098,40 ÷ 2,9 h = **R$ 31.758,07/h**. Este valor combina as despesas do CSV com os horários do diário exportado; não comprova sozinho que o financeiro do D1 contenha todos os mesmos lançamentos.

A despesa de 26/08, documento 53, R$ 1.415,25, está como **EXTRA** no CSV. No PDF do sistema aparecia como FIXO. O CSV de agosto implica R$ 8.500,00 fixos, R$ 5.681,33 variáveis e R$ 1.415,25 extras. O export `jpk.sql` contém somente o diário: não permite corrigir ou confirmar o tipo cadastrado no financeiro. Essa classificação deve ser conciliada no lançamento/rateio de origem; não inferir o tipo pelo texto da descrição.

A distância do D1 soma **59,0 NM** e o combustível abastecido no diário soma **147,1 L**. O PDF manual usava 61,4 NM. Datas, distâncias, categorias e arredondamentos devem seguir os registros conciliados, não cópias dos totais divergentes do PDF.

## Regras mantidas

- Voos particulares usam titular explícito. Holding sem sócio resolve titular apenas quando existe um único participante correspondente.
- Empréstimos pertencem apenas ao tomador identificado. Nunca usar o cedente como alternativa.
- Voos particulares sem titular ficam pendentes, com aviso, inclusive em aeronave de proprietário único.
- Etapas compartilhadas podem aparecer em vários históricos. Contagens de etapas e dias não devem ser somadas entre cotistas; horas e distâncias são atribuídas proporcionalmente.
- Tela e PDF usam os mesmos tempos normalizados e a mesma atribuição. O custo/hora usa AC–COR; o tempo de voo DEP–POU aparece separado.
- Custos usam a competência de emissão e excluem cancelamentos.
- Projeção: fixos ÷ meses selecionados ÷ horas projetadas + variáveis ÷ horas atribuídas + extras ÷ horas atribuídas. Multiplicador dos fixos é explícito, padrão 1, e altera somente a projeção. Ausência de horas ou custos não classificados impede estimativas artificiais.

## Limites e validação

O CSV exporta somente a aba de lançamentos e seus valores. Não contém fórmulas, abas do diário, resumos ou simuladores. Portanto, permite conciliar despesas e classificação, mas não recuperar as fórmulas de mensalização dos fixos nem confirmar a justificativa do fator 2 observado no PDF manual. Os testes não assumem essas fórmulas como regras contratuais.

Não há histórico de vigência das cotas nesta carga. Compartilhamento utiliza o cadastro atual, explicitado na interface/PDF; períodos com troca de proprietários exigem conferência histórica.

Testes com campos operacionais dos seis registros reais e os 27 valores do CSV verificam quantidades, competência, 174 minutos, classificação financeira, custo/hora e compatibilidade com payloads antigos. O SQL exportado foi executado apenas em SQLite em memória para a conciliação. Nenhuma alteração foi feita no D1 de produção.

Os testes antigos de conferência de texto ainda apresentam três falhas de expressões regulares já existentes no commit base; elas não são novas falhas de cálculo.
