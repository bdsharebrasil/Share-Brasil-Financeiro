-- PESO E BALANCEAMENTO / PT-OPC / D1
-- Fonte visual: 5- P&B.pdf, páginas 1 a 3, relatório REM-P&B0077.
-- IMPORTANTE: MODELO PREPARADO, AINDA PENDENTE DE DADOS DO MANUAL E CONFERÊNCIA.
-- Não importa a configuração enquanto os NULL abaixo não forem preenchidos.
-- Nenhum limite foi inventado; não há zeros simulando limites ausentes.
-- O relatório apresenta conjuntos conflitantes de peso/CG/momento.
-- O usuário deve preencher o conjunto confirmado pela documentação técnica.
-- Unidades: kg, metros e kg*m, compatíveis com os demais braços deste arquivo.
-- Este arquivo complementa o SQL de manutenção; não o substitui.
-- Não cria tabelas novas, não usa BEGIN/COMMIT nem INSERT OR REPLACE.
--
-- EDITE APENAS O BLOCO confirmado ANTES DE IMPORTAR.
-- 9 valores obrigatórios: peso, braço, momento, MTOW, MLW, CG dianteiro,
-- CG traseiro, MAC/CMA e LEMAC. Os outros parâmetros podem continuar NULL.
-- Os dados de pesagem originais completos permanecem em notas, inclusive
-- os conflitos. Não escolhemos 2514/3,43 ou 2496,95/3,46 automaticamente.
--
-- Só importa se ID + matrícula + modelo + série correspondem ao PDF.
-- Não sobrescreve configuração já validada ou com pesagem posterior a 2020.
-- O ID da configuração existente é preservado, mantendo as fichas vinculadas.
-- A repetição da importação preserva os registros deste mesmo relatório.

WITH confirmado AS (
  SELECT
    NULL AS peso_vazio_padrao,             -- confirmar: 2514 ou 2496.95 kg (ou valor retificado)
    NULL AS braco_cg_padrao,               -- confirmar: 3.43 ou 3.46 m (ou valor retificado)
    NULL AS momento_padrao,               -- confirmar: 8533.58 ou 8633.31 kg*m (ou valor retificado)
    NULL AS peso_maximo_decolagem,         -- MTOW kg, obter do manual aplicável
    NULL AS peso_maximo_pouso,             -- MLW kg, obter do manual aplicável
    NULL AS cg_limite_dianteiro,           -- m: envelope compatível com o peso, confirmar no POH
    NULL AS cg_limite_traseiro,            -- m: envelope compatível com o peso, confirmar no POH
    NULL AS mac_comprimento,               -- m: CMA/MAC, não informado no PDF
    NULL AS lemac_distancia,               -- m: NÃO usar os 3.48 m do Main Spar
    NULL AS peso_maximo_sem_combustivel,   -- kg, opcional no schema
    NULL AS capacidade_combustivel_total, -- kg, não é o combustível não utilizável
    NULL AS capacidade_combustivel_util,  -- kg, não é o combustível não utilizável
    NULL AS limite_bagagem_diant_kg,       -- kg: posição 0.76 m não informa limite de peso
    NULL AS limite_bagagem_tras_kg         -- kg: posição 6.48 m não informa limite de peso
)
INSERT INTO ctm_peso_balanceamento (
  id, aeronave_id, peso_vazio_padrao, braco_cg_padrao, momento_padrao,
  peso_maximo_decolagem, peso_maximo_pouso, peso_maximo_sem_combustivel,
  cg_limite_dianteiro, cg_limite_traseiro, mac_comprimento, lemac_distancia,
  capacidade_combustivel_total, capacidade_combustivel_util,
  data_ultima_pesagem, numero_relatorio_pesagem, responsavel_tecnico,
  limite_bagagem_diant_kg, limite_bagagem_tras_kg,
  validado, validado_em, validado_por, notas
)
SELECT
  '5ef06746-be6b-5667-9fbf-9b5cc86570db', a.id,
  d.peso_vazio_padrao, d.braco_cg_padrao, d.momento_padrao,
  d.peso_maximo_decolagem, d.peso_maximo_pouso, d.peso_maximo_sem_combustivel,
  d.cg_limite_dianteiro, d.cg_limite_traseiro, d.mac_comprimento, d.lemac_distancia,
  d.capacidade_combustivel_total, d.capacidade_combustivel_util,
  '2020-07-29', 'REM-P&B0077', 'EDIMILSON DE MEDEIROS SIMAS',
  d.limite_bagagem_diant_kg, d.limite_bagagem_tras_kg,
  0, NULL, NULL, '{"importacao":"PT-OPC-PB-REM-PB0077-20200729","arquivo":"5- P&B.pdf","paginas":3,"relatorio":"REM-P&B0077","matricula":"PT-OPC","fabricante":"PIPER AIRCRAFT","modelo":"PA-31T","numero_serie":"31T-8120010","data_pesagem":"2020-07-29","local":"JUNDIAÍ/SP","situacao":"NIVELADO","numero_assentos":7,"responsavel_tecnico":"EDIMILSON DE MEDEIROS SIMAS","anac_responsavel":"115080","cft_responsavel":"2606799704","mecanico":"JOSÉ EDNALDO S. A.","anac_mecanico":"225958","balanca":{"modelo":"CM-1002","serie":"1793","afericao":"2020-03-13","validade":"2021-03-13","amplitude_original":"0,10g"},"pagina_1":{"dados_pesagem_originais":[{"apoio":"DIREITO","peso_1_kg":"1068","tara":"0","peso_2_kg":"1065","braco_m":"3,86","momento_impresso":"4110,90"},{"apoio":"ESQUERDO","peso_1_kg":"1040","tara":"0","peso_2_kg":"1053","braco_m":"3,86","momento_impresso":"4064,58"},{"apoio":"AUXILIAR","peso_1_kg":"410","tara":"0","peso_2_kg":"396","braco_m":"1,25","momento_impresso":"495"},{"apoio":"TOTAL REG.","peso_1_kg":"2488","tara":"0","peso_2_kg":"2514","braco_m":"3,45","momento_impresso":"8670,48"}],"modificacoes":{"total_reg":{"peso_kg":"2514","braco_m":"3,45","momento_impresso":"8670,48"},"coluna_1_subtracao":{"peso_kg":"17,05","braco_m":"2,18","momento_impresso":"37,169"},"coluna_2":{"peso_kg":"0","braco_m":"-","momento_impresso":"0"},"peso_vazio":{"peso_kg":"2496,95","braco_m":"3,46","momento_impresso":"8633,31"}},"resultado":{"peso_basico_kg":"2514","peso_basico_lbs":"5549","cg_m":"3,43","cg_in":"135,8","momento_impresso":"8533,58","momento_imperial_impresso":"753554,2","cma_percentual":"-"},"observacoes_originais":["AERONAVE PESADA SOBRE AS RODAS DO TREM DE POUSO PRINCIPAL E AUXILIAR.","TANQUES DE COMBUSTÍVEL DRENADO, MOTOR ABASTECIDO COM ÓLEO, EXTINTORES DE INCÊNDIO INSTALADO.","O PESO BÁSICO ACIMA INDICADO INCLUI O ÓLEO DO MOTOR E O COMBUSTÍVEL NÃO UTILIZÁVEL.","PARA INFORMAÇÕES DE PESO MÁXIMO DE DECOLAGEM E LIMITES DO C.G. CONSULTE O MANUAL DE OPERAÇÃO E TCDS."]},"pagina_2":{"oleo_motor_coluna_1":{"peso_kgf":"17,050","braco_m":"2,18","momento_impresso":"37,169"},"coluna_2":"N/A","cg_limite_dianteiro":"Consultar POH","cg_limite_traseiro":"Consultar POH","combustivel_nao_utilizavel":{"peso_original":"24,462","braco_m":"3,20","momento_impresso":"7827,84"}},"pagina_3":{"datum":"F.S. 0,0","main_spar_m":"3,48","main_spar_in":"137","trem_auxiliar_m":"1,25","trem_principal_m":"3,86","estacoes_m":{"bagageiro_dianteiro":0.76,"assentos_01_02":3.02,"assentos_03_04":4.21,"assentos_05_06":5.03,"assento_07":5.81,"bagageiro_traseiro":6.48}},"pendencias":["Confirmar peso/CG/momento operacionais: MODIFICAÇÕES informa 2496,95 / 3,46 / 8633,31, enquanto RESULTADO informa 2514 / 3,43 / 8533,58.","A primeira coluna de pesos dos apoios soma 2518, mas seu TOTAL REG. é 2488. A segunda soma 2514. Não foi corrigido automaticamente.","O momento do combustível não utilizável está impresso como 7827,84; 24,462 vezes 3,20 resulta 78,2784. Não reinterpretado como outro valor/unidade.","MTOW, peso máximo de pouso, envelope de CG, MAC/CMA, LEMAC, combustível total/utilizável e limites de bagagem não são fornecidos numericamente.","Main spar a 3,48 m NÃO é informação de LEMAC. Não usar uma medida no lugar da outra.","O documento é de 2020: confirmar que corresponde à configuração atual e ao cadastro PA-31T / 31T-8120010.","validado=0: importação documental não é aprovação técnica para cálculo de voo."]}'
FROM aeronave a CROSS JOIN confirmado d
WHERE a.id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c'
  AND upper(replace(replace(a.matricula_registro,'-',''),' ',''))='PTOPC'
  AND upper(replace(replace(a.modelo,'-',''),' ',''))='PA31T'
  AND upper(replace(replace(a.numero_serie,'-',''),' ',''))='31T8120010'
  AND d.peso_vazio_padrao > 0 AND d.braco_cg_padrao > 0 AND d.momento_padrao > 0
  AND d.peso_maximo_decolagem > 0 AND d.peso_maximo_pouso > 0
  AND d.peso_maximo_decolagem >= d.peso_maximo_pouso
  AND d.peso_maximo_pouso >= d.peso_vazio_padrao
  AND d.cg_limite_dianteiro > 0 AND d.cg_limite_traseiro > d.cg_limite_dianteiro
  AND d.mac_comprimento > 0 AND d.lemac_distancia IS NOT NULL
ON CONFLICT(aeronave_id) DO UPDATE SET
  peso_vazio_padrao=excluded.peso_vazio_padrao,
  braco_cg_padrao=excluded.braco_cg_padrao,
  momento_padrao=excluded.momento_padrao,
  peso_maximo_decolagem=excluded.peso_maximo_decolagem,
  peso_maximo_pouso=excluded.peso_maximo_pouso,
  peso_maximo_sem_combustivel=excluded.peso_maximo_sem_combustivel,
  cg_limite_dianteiro=excluded.cg_limite_dianteiro,
  cg_limite_traseiro=excluded.cg_limite_traseiro,
  mac_comprimento=excluded.mac_comprimento,
  lemac_distancia=excluded.lemac_distancia,
  capacidade_combustivel_total=excluded.capacidade_combustivel_total,
  capacidade_combustivel_util=excluded.capacidade_combustivel_util,
  data_ultima_pesagem=excluded.data_ultima_pesagem,
  numero_relatorio_pesagem=excluded.numero_relatorio_pesagem,
  responsavel_tecnico=excluded.responsavel_tecnico,
  limite_bagagem_diant_kg=excluded.limite_bagagem_diant_kg,
  limite_bagagem_tras_kg=excluded.limite_bagagem_tras_kg,
  validado=0, validado_em=NULL, validado_por=NULL,
  notas=excluded.notas, atualizado_em=CURRENT_TIMESTAMP
WHERE COALESCE(ctm_peso_balanceamento.validado,0)=0
  AND (ctm_peso_balanceamento.data_ultima_pesagem IS NULL
       OR ctm_peso_balanceamento.data_ultima_pesagem <= '2020-07-29')
  AND COALESCE(ctm_peso_balanceamento.numero_relatorio_pesagem,'') <> 'REM-P&B0077';

-- ESTAÇÕES: posições documentadas na página 3.
-- Peso inicial zero significa SEM CARGA; não representa capacidade máxima.
-- incluir_no_calculo=0: cadastro geométrico, sem presumir passageiros/bagagem.
-- Só são criadas se a configuração deste relatório já tiver sido importada.
INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '6accb3cf-3e12-58e8-b801-b64508693b6e', p.id, 'Assento 01', 'ASSENTO', 0, 3.02, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 01' AND e.braco_posicao=3.02)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT 'eab81be6-8cc3-507f-b742-5c0577067acc', p.id, 'Assento 02', 'ASSENTO', 0, 3.02, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 02' AND e.braco_posicao=3.02)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '3220e7e2-db5b-5213-9497-ffb9e827b365', p.id, 'Assento 03', 'ASSENTO', 0, 4.21, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 03' AND e.braco_posicao=4.21)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '6a4aec30-9058-5bda-b9a2-600dfc7a48a7', p.id, 'Assento 04', 'ASSENTO', 0, 4.21, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 04' AND e.braco_posicao=4.21)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '3b39537a-b2af-5f87-94d0-e998872fdd93', p.id, 'Assento 05', 'ASSENTO', 0, 5.03, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 05' AND e.braco_posicao=5.03)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '152bfa3b-854e-551b-9c23-9ba59def673a', p.id, 'Assento 06', 'ASSENTO', 0, 5.03, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 06' AND e.braco_posicao=5.03)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT 'f4f5b30a-7d9c-5898-989b-bdefa9420337', p.id, 'Assento 07', 'ASSENTO', 0, 5.81, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Assento 07' AND e.braco_posicao=5.81)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT 'c8361d24-eedb-5365-b917-9d55dea49836', p.id, 'Bagageiro dianteiro', 'BAGAGEM', 0, 0.76, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Bagageiro dianteiro' AND e.braco_posicao=0.76)
ON CONFLICT(id) DO NOTHING;

INSERT INTO ctm_estacoes (
  id, peso_balanceamento_id, descricao, categoria, peso_sem_combustivel,
  braco_posicao, momento, incluir_no_calculo
)
SELECT '21bb0cd9-97f5-5457-8fcc-7d61f1eb5bf1', p.id, 'Bagageiro traseiro', 'BAGAGEM', 0, 6.48, 0, 0
FROM ctm_peso_balanceamento p
WHERE p.aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c' AND COALESCE(p.validado,0)=0
  AND p.numero_relatorio_pesagem='REM-P&B0077'
  AND json_extract(CASE WHEN json_valid(p.notas) THEN p.notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729'
  AND NOT EXISTS (SELECT 1 FROM ctm_estacoes e WHERE e.peso_balanceamento_id=p.id
                  AND e.descricao='Bagageiro traseiro' AND e.braco_posicao=6.48)
ON CONFLICT(id) DO NOTHING;

-- RESULTADO E DIAGNÓSTICO (não confundir execução SQL com aprovação técnica).
SELECT
 CASE
  WHEN NOT EXISTS(SELECT 1 FROM aeronave WHERE id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c')
    THEN 'PENDENTE: aeronave não encontrada pelo ID.'
  WHEN NOT EXISTS(SELECT 1 FROM aeronave WHERE id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c'
    AND upper(replace(replace(matricula_registro,'-',''),' ',''))='PTOPC'
    AND upper(replace(replace(modelo,'-',''),' ',''))='PA31T'
    AND upper(replace(replace(numero_serie,'-',''),' ',''))='31T8120010')
    THEN 'PENDENTE: matrícula, modelo ou número de série do cadastro não corresponde ao PDF.'
  WHEN EXISTS(SELECT 1 FROM ctm_peso_balanceamento WHERE aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c'
    AND (COALESCE(validado,0)<>0 OR data_ultima_pesagem > '2020-07-29'))
    THEN 'PRESERVADO: configuração validada ou mais recente; o PDF antigo não a substituiu.'
  WHEN EXISTS(SELECT 1 FROM ctm_peso_balanceamento WHERE aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c'
    AND json_extract(CASE WHEN json_valid(notas) THEN notas ELSE '{}' END,'$.importacao')='PT-OPC-PB-REM-PB0077-20200729')
    THEN 'IMPORTADO COMO NÃO VALIDADO: conferir limites, envelope e valores com a documentação técnica.'
  ELSE 'PENDENTE: preencher os 9 parâmetros obrigatórios no bloco confirmado. Nenhuma configuração foi importada.'
 END AS resultado;

SELECT id, aeronave_id, peso_vazio_padrao, braco_cg_padrao, momento_padrao,
 peso_maximo_decolagem, peso_maximo_pouso, cg_limite_dianteiro,
 cg_limite_traseiro, mac_comprimento, lemac_distancia,
 data_ultima_pesagem, numero_relatorio_pesagem, validado
FROM ctm_peso_balanceamento WHERE aeronave_id='6514c72c-4b71-4c36-9ae7-c1cd6f7d962c';
