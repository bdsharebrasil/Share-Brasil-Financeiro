import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import urlResumoMedias from '../data/resumo-de-medias.csv?url';
import type { Balanco, LinhaBalanco, LinhaMedia } from '../types/balanco';
import { acharColuna, celula, ehMes, rotuloMes } from '../utils/csv';

const URL_RESUMO = urlResumoMedias;


interface Estado {
  balanco: Balanco | null;
  carregando: boolean;
  erro: string | null;
}

function blocos(linhas: string[][]): number[] {
  // Cada bloco da planilha tem uma linha de rótulos contendo "COMBUSTÍVEL".
  const encontrados: number[] = [];
  linhas.forEach((linha, i) => {
    const temCombustivel = linha.some((c) =>
    String(c ?? '').
    normalize('NFD').
    replace(/[\u0300-\u036f]/g, '').
    toUpperCase().
    includes('COMBUST')
    );
    if (temCombustivel) encontrados.push(i);
  });
  return encontrados;
}

function linhasDoBloco(linhas: string[][], inicio: number): string[][] {
  const dados: string[][] = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const primeira = linhas[i]?.[0];
    if (ehMes(primeira)) dados.push(linhas[i]);else
    if (dados.length > 0) break;
  }
  return dados;
}

export function useBalancoCotista(): Estado {
  const [estado, setEstado] = useState<Estado>({
    balanco: null,
    carregando: true,
    erro: null
  });

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch(URL_RESUMO);
        if (!resposta.ok) throw new Error('Falha ao baixar a planilha de fechamento.');
        const texto = await resposta.text();
        const { data } = Papa.parse<string[]>(texto, { skipEmptyLines: false });
        const linhas = (data as string[][]).map((l) => l.map((c) => String(c ?? '')));

        const cabecalhos = blocos(linhas);
        if (cabecalhos.length === 0) throw new Error('Estrutura da planilha não reconhecida.');

        const idGeral = cabecalhos[0];
        const idMedias = cabecalhos[1] ?? cabecalhos[0];

        const ctxGeral = [idGeral - 1, idGeral, idGeral + 1].filter((i) => i >= 0);
        const ctxMedias = [idMedias - 1, idMedias, idMedias + 1].filter((i) => i >= 0);

        const colGeral = {
          admTrip: acharColuna(linhas, ctxGeral, ['ADM']),
          hangaragem: acharColuna(linhas, ctxGeral, ['HANGAR']),
          manutencaoFixa: acharColuna(linhas, ctxGeral, ['MANUT', 'FIXA']),
          combustivel: acharColuna(linhas, ctxGeral, ['COMBUST']),
          manutencaoHora: acharColuna(linhas, ctxGeral, ['MANUT', 'HORA']),
          taxasVoo: acharColuna(linhas, ctxGeral, ['TAXAS']),
          hoteisAlimentacao: acharColuna(linhas, ctxGeral, ['HOTEIS']),
          custosExtras: acharColuna(linhas, ctxGeral, ['EXTRAS']),
          abastecimentoL: acharColuna(linhas, ctxGeral, ['ABST']),
          distancia: acharColuna(linhas, ctxGeral, ['DISTANCIA']),
          pousos: acharColuna(linhas, ctxGeral, ['POUSOS']),
          horasVoo: acharColuna(linhas, ctxGeral, ['H VOO']),
          horasTotais: acharColuna(linhas, ctxGeral, ['H TTL']),
          diasVoo: acharColuna(linhas, ctxGeral, ['DIAS VOO'])
        };

        const colMedias = {
          admTrip: acharColuna(linhas, ctxMedias, ['ADM']),
          hangaragem: acharColuna(linhas, ctxMedias, ['HANGAR']),
          manutencaoFixa: acharColuna(linhas, ctxMedias, ['MANUT', 'FIXA']),
          combustivel: acharColuna(linhas, ctxMedias, ['COMBUST']),
          manutencaoHora: acharColuna(linhas, ctxMedias, ['MANUT', 'HORA']),
          taxasVoo: acharColuna(linhas, ctxMedias, ['TAXAS']),
          hoteisAlimentacao: acharColuna(linhas, ctxMedias, ['HOTEIS']),
          custosExtras: acharColuna(linhas, ctxMedias, ['EXTRAS']),
          litros: acharColuna(linhas, ctxMedias, ['LITRO']),
          valorLitro: acharColuna(linhas, ctxMedias, ['VALOR L']),
          velocidade: acharColuna(linhas, ctxMedias, ['VELOCIDADE']),
          custoHora: acharColuna(linhas, ctxMedias, ['CUSTO HORA']),
          custoKm: acharColuna(linhas, ctxMedias, ['CUSTO KM']),
          custoDia: acharColuna(linhas, ctxMedias, ['CUSTO DIA'])
        };

        const geral: LinhaBalanco[] = linhasDoBloco(linhas, idGeral).map((l) => ({
          mes: rotuloMes(l[0]),
          admTrip: celula(l, colGeral.admTrip),
          hangaragem: celula(l, colGeral.hangaragem),
          manutencaoFixa: celula(l, colGeral.manutencaoFixa),
          combustivel: celula(l, colGeral.combustivel),
          manutencaoHora: celula(l, colGeral.manutencaoHora),
          taxasVoo: celula(l, colGeral.taxasVoo),
          hoteisAlimentacao: celula(l, colGeral.hoteisAlimentacao),
          custosExtras: celula(l, colGeral.custosExtras),
          abastecimentoL: celula(l, colGeral.abastecimentoL),
          distancia: celula(l, colGeral.distancia),
          pousos: celula(l, colGeral.pousos),
          horasVoo: celula(l, colGeral.horasVoo),
          horasTotais: celula(l, colGeral.horasTotais),
          diasVoo: celula(l, colGeral.diasVoo)
        }));

        const medias: LinhaMedia[] = linhasDoBloco(linhas, idMedias).map((l) => ({
          mes: rotuloMes(l[0]),
          admTrip: celula(l, colMedias.admTrip),
          hangaragem: celula(l, colMedias.hangaragem),
          manutencaoFixa: celula(l, colMedias.manutencaoFixa),
          combustivel: celula(l, colMedias.combustivel),
          manutencaoHora: celula(l, colMedias.manutencaoHora),
          taxasVoo: celula(l, colMedias.taxasVoo),
          hoteisAlimentacao: celula(l, colMedias.hoteisAlimentacao),
          custosExtras: celula(l, colMedias.custosExtras),
          litros: celula(l, colMedias.litros),
          valorLitro: celula(l, colMedias.valorLitro),
          velocidade: celula(l, colMedias.velocidade),
          custoHora: celula(l, colMedias.custoHora),
          custoKm: celula(l, colMedias.custoKm),
          custoDia: celula(l, colMedias.custoDia)
        }));

        if (geral.length === 0) throw new Error('Nenhuma competência encontrada na planilha.');

        const cabecalhoTexto = (linhas[0] ?? []).filter(Boolean);

        if (ativo) {
          setEstado({
            balanco: {
              titulo: cabecalhoTexto[0] ?? 'Resumo Geral',
              cotista: cabecalhoTexto[1] ?? 'Cotista',
              aeronave: cabecalhoTexto[2] ?? 'Aeronave',
              exercicio: cabecalhoTexto[3] ?? String(new Date().getFullYear()),
              geral,
              medias: medias.length > 0 ? medias : []
            },
            carregando: false,
            erro: null
          });
        }
      } catch (e) {
        if (ativo) {
          setEstado({
            balanco: null,
            carregando: false,
            erro: e instanceof Error ? e.message : 'Erro inesperado ao ler a planilha.'
          });
        }
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  return estado;
}