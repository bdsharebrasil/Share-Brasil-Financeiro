import type { DashboardCotista } from "@/lib/financeiro-share-api";
import { calcularBalancoMensal } from "@/lib/balanco-cotistas";

export type FontesAcertoCotistas = DashboardCotista["balanco_fontes"];
export type BalancoAcertoCotistas = ReturnType<typeof calcularBalancoMensal>;
export type ResultadoAcertoCotistas = {
  balanco: BalancoAcertoCotistas | null;
  erro: string | null;
  fim: string | null;
};

const regexMes = /^20\d{2}-(0[1-9]|1[0-2])$/;

/**
 * Usa rateios ajustados e pagamentos confirmados do ledger, acumulando desde o início
 * do histórico até o último mês selecionado. Não usa a matriz legada do dashboard.
 */
export function calcularAcertoContasCotistas(
  fontes: FontesAcertoCotistas,
  mesesSelecionados: string[],
): ResultadoAcertoCotistas {
  if (!fontes || fontes.versao !== 1) {
    return {
      balanco: null,
      erro: "A fonte detalhada de rateios e pagamentos não está disponível para esta aeronave.",
      fim: null,
    };
  }

  const meses = [...new Set(mesesSelecionados.filter((mes) => regexMes.test(mes)))].sort();
  if (!meses.length) {
    return { balanco: null, erro: "Selecione ao menos um mês válido para calcular o acerto.", fim: null };
  }

  const ultimoMes = meses[meses.length - 1];
  const [ano, mes] = ultimoMes.split("-").map(Number);
  const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

  try {
    const balanco = calcularBalancoMensal(
      fontes.participantes,
      fontes.rateios,
      fontes.pagamentos,
      fontes.ajustes,
      "2000-01-01",
      fim,
    );
    return { balanco, erro: null, fim };
  } catch (error) {
    return {
      balanco: null,
      erro: error instanceof Error ? error.message : String(error),
      fim,
    };
  }
}
