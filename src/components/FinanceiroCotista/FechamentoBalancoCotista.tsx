import type { DashboardCotista } from "@/lib/financeiro-share-api";
import type { CotistaAeronave } from "@/lib/colaborador-api";
import { FechamentoBalancoDashboardCotista } from "./FechamentoBalancoDashboardCotista";

type Props = {
  dashboard: DashboardCotista | null;
  carregando: boolean;
  erro: string | null;
  cotistas: CotistaAeronave[];
  mesesSelecionados: string[];
};

/** Tela de fechamento do Financeiro Cotista, com os filtros e dados do dashboard ativo. */
export function FechamentoBalancoCotista(props: Props) {
  return <FechamentoBalancoDashboardCotista {...props} />;
}
