# Conciliação do fechamento do cotista com a referência PT-JPK

## Problema encontrado

O PDF de agosto/2026 registra R$ 15.596,58 e 25 minutos para a aeronave, mas zero etapas/horas para a Santa Rosa (100% da cota). O fechamento calculava utilização individual apenas com `clienteId`/`socioId` diretos. Já o diário remove esses titulares em `TR - Traslado` e `VT - Voo Teste`, por serem operações compartilhadas. Essas etapas iam para “Operação sem cotista vinculado”, bloqueando o custo/hora e a projeção do cotista.

O padrão do PDF é compatível com essa falha. A natureza e os vínculos do registro real ainda precisam ser confirmados na base de produção: os anexos não exibem esses campos.

## Comportamento corrigido

- TR/VT: parcelas iguais entre cotistas ativos com participação positiva do cadastro operacional atual. Duração física preservada; a parcela de horas e distância aparece separadamente. Uma etapa compartilhada pode constar no histórico de vários cotistas; as contagens de etapas/dias não são somáveis entre cotistas.
- Voo particular: titular explícito. Holding sem sócio só resolve titular quando há um único participante correspondente.
- Empréstimo: apenas o tomador identificado. Nunca atribuir ao cedente ou dividir entre proprietários como alternativa.
- Outros voos sem titular: permanecem pendentes, com aviso. Não atribuir automaticamente ao único proprietário.
- Custo/hora individual: despesas atribuídas ÷ tempo total atribuído (acionamento até corte). Tempo de voo (decolagem até pouso) é mostrado separadamente.
- Tela e PDF usam a mesma atribuição. O diário na seleção de cotista mostra suas etapas, incluindo compartilhadas.
- Custos, tabela e PDF usam a mesma competência de emissão; cancelamentos masculinos/femininos são excluídos.
- Projeção de 1 a 45 h/mês: fixos ÷ número de meses selecionados ÷ horas projetadas + variáveis ÷ horas registradas + extras ÷ horas registradas. Zero horas ou custos não classificados não geram estimativas artificiais.
- Multiplicador explícito dos fixos, padrão 1, altera apenas a projeção. O fator 2 permite simular a base fixa dobrada observada na planilha; não confirma que esse fator seja a regra contratual.

Não há histórico de vigência das cotas nesta carga. Compartilhamento usa o cadastro atual, explicitado na interface/PDF; períodos com troca de proprietários precisam de conferência histórica.

## Diferenças dos documentos que exigem conciliação dos dados

| Ponto | PDF gerado pelo sistema | Referência manual |
| --- | --- | --- |
| Período | Agosto/2026 | Janeiro a setembro/2026 |
| Total de agosto | R$ 15.596,58 | R$ 15.596,58, somando os lançamentos de agosto |
| Mão de obra de pneus | R$ 1.415,25 como FIXO | EXTRA |
| Horas totais em agosto | Custo/hora da aeronave implica 0,42 h; exibe 0h25 | 0,41 h; diário exibe 0:25 |
| Custo/hora de agosto | R$ 37.134,71 na aeronave; faltava no cotista | R$ 38.040,44 (R$ 15.596,58 ÷ 0,41) |
| Datas do diário e resumo mensal | Exige conferir registros de origem | As duas etapas de fevereiro aparecem agregadas no resumo de janeiro; a etapa de março aparece em fevereiro |
| Total de horas manual | — | Resumo: 2,88 h; diário: 02:54, equivalente a 2,90 h |
| Média mensal fixa manual | Média dos valores registrados nos meses selecionados | Hangaragem usa R$ 3.500/mês, embora esteja presente em apenas quatro dos nove meses |
| Base fixa da projeção manual | Multiplicador padrão 1 | R$ 17.226,49 para 1 h/mês, aproximadamente duas vezes R$ 8.613,25 |

Não mudar datas, horas ou classificação financeira por comparação visual. Para reproduzir todas as células manuais, é necessário conferir as fórmulas da planilha original, especialmente a mensalização dos fixos e o fator da projeção. Os valores do PDF manual não definem por si só uma regra consistente para todas as células.

## Validação

- Testes executáveis de cálculo reproduzem os R$ 15.596,58 de agosto com 0,42 h compartilhadas: custo/hora da Santa Rosa igual ao da aeronave, R$ 37.134,71, e projeção disponível.
- Casos adicionais: dois/três cotistas, cotas inativas/zeradas, empréstimo com/sem tomador, holding ambígua, ausência de horas, competências descontínuas, cancelamento e multiplicador dos fixos.
- PDF renderizado com o componente real e dados de teste; tabela completa dividida em páginas com cabeçalhos próprios.
- Testes antigos de fechamento possuem três falhas de expressões regulares já presentes no commit base, reproduzidas sem esta alteração. Não representam novas falhas de cálculo.
- Não foi consultado nem alterado o D1 de produção. A validação numérica usa os valores dos anexos e registros de teste; a homologação final precisa do registro operacional real.
