import { useMemo } from "react";

export type Pagador =
  | "tripulante_1"
  | "tripulante_2"
  | "cliente"
  | "sharebrasil"
  | "outro";

export type Despesa = {
  id?: string;
  data?: string;
  categoria?: string;
  descricao?: string;
  valor?: number | string;
  observacoes?: string;
  pago_por?: string;
  paid_by?: string;
};

export type ResumoRelatorio = {
  total_a_receber?: number | string;
  cliente_pagou?: number | string;
  share_brasil_pagou?: number | string;
};

export type FiltroDespesas = "tripulante" | "cliente" | "sharebrasil" | "outros";

export function normalizarPagador(valor: unknown): Pagador {
  const normalizado = String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");

  if (normalizado === "cliente" || normalizado === "client") return "cliente";
  if (["share", "sharebrasil", "share_brasil"].includes(normalizado)) {
    return "sharebrasil";
  }
  if (["tripulante_2", "tripulante2"].includes(normalizado)) {
    return "tripulante_2";
  }
  if (["tripulante_1", "tripulante1"].includes(normalizado)) {
    return "tripulante_1";
  }
  return "outro";
}

function somarDespesas(despesas: Despesa[]) {
  return despesas.reduce((total, despesa) => total + (Number(despesa.valor) || 0), 0);
}

export function useCalculadoraRelatorio(
  despesas: Despesa[],
  resumo?: ResumoRelatorio,
  posicao: 1 | 2 = 1,
) {
  return useMemo(() => {
    const resumoAtual = resumo || {};
    const pagadorTripulante: Pagador =
      posicao === 1 ? "tripulante_1" : "tripulante_2";
    const pagadorOutroTripulante: Pagador =
      posicao === 1 ? "tripulante_2" : "tripulante_1";

    const despesasTripulante = despesas.filter(
      (despesa) => normalizarPagador(despesa.pago_por || despesa.paid_by) === pagadorTripulante,
    );
    const despesasOutroTripulante = despesas.filter(
      (despesa) => normalizarPagador(despesa.pago_por || despesa.paid_by) === pagadorOutroTripulante,
    );
    const despesasCliente = despesas.filter(
      (despesa) => normalizarPagador(despesa.pago_por || despesa.paid_by) === "cliente",
    );
    const despesasShare = despesas.filter(
      (despesa) => normalizarPagador(despesa.pago_por || despesa.paid_by) === "sharebrasil",
    );
    const despesasOutros = despesas.filter(
      (despesa) => normalizarPagador(despesa.pago_por || despesa.paid_by) === "outro",
    );
    const despesasOutras = [...despesasOutroTripulante, ...despesasOutros];

    return {
      despesasTripulante,
      despesasOutroTripulante,
      despesasCliente,
      despesasShare,
      despesasOutros,
      despesasOutras,
      totalGeral: somarDespesas(despesas),
      totalTripulante:
        Number(resumoAtual.total_a_receber) || somarDespesas(despesasTripulante),
      totalCliente:
        Number(resumoAtual.cliente_pagou) || somarDespesas(despesasCliente),
      totalShare:
        Number(resumoAtual.share_brasil_pagou) || somarDespesas(despesasShare),
      totalOutros: somarDespesas(despesasOutras),
      pagadorTripulante,
    };
  }, [despesas, posicao, resumo]);
}
