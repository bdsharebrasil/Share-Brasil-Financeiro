import type { PERIODICIDADES_RATEIO } from '../../shared/financeiro-contracts';

export type StatusLancamento =
'EM_ABERTO' |
'PAGO' |
'RECEBIDO' |
'EM_ATRASO' |
'AGUARDANDO_REEMBOLSO' |
'REEMBOLSADO' |
'PAGO_DIRETAMENTE' |
'CANCELADO';

export type Fluxo = 'DESPESA' | 'RECEITA' | 'REEMBOLSO' | 'ENTRADA' | 'SAIDA';

export type TipoRateio = 'FIXO' | 'VARIAVEL_POR_HORA' | 'VARIAVEL_POR_VOO' | 'EXTRA';

export type Periodicidade = typeof PERIODICIDADES_RATEIO[number];

export type GrupoCategoria =
'DESPESAS EMPRESA' |
'DESPESAS PARTICULARES' |
'FOLHA DE PAGAMENTO' |
'IMPOSTOS' |
'RECEITAS OPERACIONAIS' |
'DESPESAS REEMBOLSÁVEIS' |
'REEMBOLSOS ENTRADAS' |
'ADM SHARE - RECIBO';

export interface Categoria {
  id: string;
  nome: string;
  grupo: GrupoCategoria;
  reembolsavel: boolean;
}

export interface Aeronave {
  id: string;
  prefixo: string;
  modelo: string;
}

export interface Cotista {
  id: string;
  nome: string;
  avatar: string;
  aeronaveId: string;
  percentualSociedade: number;
  horasVoadas: number;
}

export interface Lancamento {
  id: string;
  descricao: string;
  fornecedor: string;
  categoriaId: string;
  categoriaNome: string;
  grupoCategoria: GrupoCategoria;
  aeronaveId: string;
  cotistaId: string | null;
  fluxo: Fluxo;
  tipoRateio: TipoRateio;
  periodicidade: Periodicidade;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento: string | null;
  valor: number;
  status: StatusLancamento;
  observacoes?: string;
  formaPagamento?: string;
  contaBancaria?: string;
  documentoNumero?: string;
}

export interface DadosBaixa {
  dataPagamento: string;
  valorPago: number;
  formaPagamento: string;
  contaBancaria: string;
  observacoes: string;
}

export interface SerieMensal {
  mes: string;
  horas: number;
  voos: number;
  custoTotal: number;
  custoHora: number;
  custoFixo: number;
  custoVariavel: number;
}

export interface RankingCategoria {
  categoria: string;
  valor: number;
  percentual: number;
}

export interface RankingCotista {
  cotistaId: string;
  nome: string;
  avatar: string;
  aeronave: string;
  horas: number;
  custoHora: number;
  custoMes: number;
  participacao: number;
}

export interface ContaAberta {
  id: string;
  cotistaId: string;
  nome: string;
  avatar: string;
  aeronave: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
  competencia: string;
  status: Extract<StatusLancamento, 'EM_ABERTO' | 'EM_ATRASO' | 'AGUARDANDO_REEMBOLSO'>;
}
