// Tipos do módulo Financeiro Share — espelham o schema real das tabelas D1
// (backend-share). Ajuste aqui se o schema mudar; os componentes e ganchos
// (hooks) deste módulo importam tudo daqui, então este arquivo é a fonte
// única de verdade dos tipos.
import type { Periodicidade } from "@/types/financeiro";

export type FluxoLancamento = 'ENTRADA' | 'SAIDA';
export type CaixaLancamento = 'SHARE' | 'CLIENTE' | 'HOLDING';
export type StatusLancamento = 'EM_ABERTO' | 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'ATRASADO' | 'EM_ATRASO' | 'CANCELADO' | 'RECEITA' | 'ESTORNO' | 'ENTRADA' | 'SAIDA' | 'AGUARDANDO_REEMBOLSO' | 'REEMBOLSADO';
export type StatusContaFinanceira = 'EM_ABERTO' | 'PENDENTE' | 'RECEBIDO' | 'PAGO' | 'CANCELADO' | 'ATRASADO' | 'EM_ATRASO' | 'AGUARDANDO_REEMBOLSO' | 'REEMBOLSADO';
/** @deprecated use StatusContaFinanceira — mantido para não quebrar imports existentes */
export type StatusContaAPagar = StatusContaFinanceira;
export type TipoDocumento = 'RECIBO' | 'RELATORIO VIAGEM' | 'DEMONSTRATIVO' | 'NOTA FISCAL' | 'COMANDA' | 'BOLETO';

export interface Lancamento {
  id: string;
  aeronaveId: string | null;
  cotistaId: string | null;
  cotistaNome?: string | null;
  cotista?: string | null;
  data: string; // ISO date
  dataPagamento?: string | null;
  comprovanteUrl?: string | null;
  dataRecebimento?: string | null;
  descricao: string;
  documento: string | null;
  numeroDoc?: string | null;
  numeroNf?: string | null;
  numeroRecibo?: string | null;
  numeroDemonstrativo?: string | null;
  documentoUrl?: string | null;
  url_demonstrativo?: string | null;
  url_nf?: string | null;
  url_recibo?: string | null;
  url_boleto?: string | null;
  url_doc?: string | null;
  fornecedor: string | null; // texto livre, usado quando fornecedorId é nulo
  fornecedorId: string | null; // FK -> fornecedores_favoritos
  categoria: string; // texto livre, usado quando categoriaId é nulo
  categoriaId: string | null; // FK -> categoria_movimentacao_share
  categoriaClienteId?: string | null;
  grupoCategoria: string;
  tipo: string | null;
  prazo: string | null;
  periodicidade?: Periodicidade | null;
  fluxo: FluxoLancamento;
  fluxoOriginal?: string;
  valorCentavos: number;
  pagoPor: string;
  caixa: CaixaLancamento;
  contaBancariaId?: string | null;
  contaBancaria?: string | null;
  pagoDiretamente: boolean;
  reembolsavel: boolean;
  reembolsoQuitado: boolean;
  status: StatusLancamento;
  observacoes: string | null;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  anexos: Array<{
    id: string;
    nome: string;
    url: string;
    tipo?: string | null;
    numero?: string | null;
  }>;
}

export interface ContaAPagar {
  anexos?: Lancamento["anexos"];
  anexos_json?: unknown;
  id: string;
  dataEmissao: string | null;
  dataVencimento: string;
  periodicidade?: Periodicidade | null;
  valor: number;
  categoriaId: string | null;
  categoriaClienteId?: string | null;
  categoriaNome: string | null;
  descricao: string | null;
  criadoPor: string | null;
  aeronaveId: string | null;
  aeronaveMatricula?: string | null;
  fornecedor: string | null;
  fornecedorId: string | null;
  cotistaId: string | null;
  cotistaNome?: string | null;
  cotista?: string | null;
  reembolsavel?: boolean;
  reembolsoQuitado?: boolean;
  boletoUrl: string | null;
  nfUrl: string | null;
  dataPagamento: string | null;
  bancoPagamento: string | null;
  contaBancariaId?: string | null;
  fluxo?: string | null;
  tipoCaixa?: CaixaLancamento | string | null;
  holdingId?: string | null;
  movimentoHoldingId?: string | null;
  fonteLancamento?: boolean;
  comprovantePagamentoUrl: string | null;
  documento: string | null;
  numeroDoc?: string | null;
  numeroNf?: string | null;
  numeroRecibo?: string | null;
  numeroDemonstrativo?: string | null;
  tipoDocumento?: TipoDocumento | null;
  numerosDocumento?: string[];
  documentoUrl: string | null;
  url_demonstrativo?: string | null;
  url_nf?: string | null;
  url_recibo?: string | null;
  url_boleto?: string | null;
  url_doc?: string | null;
  lancamentoId: string | null;
  status: StatusContaFinanceira;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ContaAReceber {
  id: string;
  dataEmissao: string | null;
  dataVencimento: string;
  periodicidade?: Periodicidade | null;
  valor: number;
  categoriaId: string | null;
  categoriaClienteId?: string | null;
  categoriaNome: string | null;
  descricao: string | null;
  criadoPor: string | null;
  aeronaveId: string | null;
  aeronaveMatricula?: string | null;
  fornecedor: string | null;
  fornecedorId: string | null;
  cotistaId: string | null;
  cotistaNome: string | null;
  cotista?: string | null;
  holdingId?: string | null;
  holdingNome?: string | null;
  boletoUrl: string | null;
  nfUrl: string | null;
  nfSaidaId: string | null;
  dataRecebimento: string | null;
  email_enviado_em?: string | null;
  bancoRecebimento: string | null;
  contaBancariaId?: string | null;
  comprovanteRecebimentoUrl: string | null;
  documento: string | null;
  tipoDocumento?: TipoDocumento | null;
  numerosDocumento?: string[];
  documentoUrl: string | null;
  url_demonstrativo?: string | null;
  url_nf?: string | null;
  url_recibo?: string | null;
  url_boleto?: string | null;
  url_doc?: string | null;
  lancamentoId: string | null;
  status: StatusContaFinanceira;
  criadoEm: string;
  atualizadoEm: string;
  rateios?: Array<{
    id: string;
    cotista_id: string | null;
    cotista_nome?: string | null;
    valor_rateado_centavos: number;
    valor_pago_real_centavos: number;
    status: string;
  }>;
}

export interface FornecedorFavorito {
  id: string;
  nomeCompleto: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  codigoIcao: string | null;
  pessoaContato: string | null;
  precoAvgas: number;
  precoJet: number;
  telefone: string | null;
  documento: string | null;
  apelido: string | null;
  contaPagamento: string | null;
}

export interface CategoriaMovimentacaoShare {
  id: string;
  nome: string;
  tipo: string | null;
  reembolsavel: boolean;
  grupoCategoria: string | null;
  tipoDespesa: string | null;
  categoriaClienteId: string | null;
}

/** Filtros aceitos pela listagem do caixa da empresa (aba "Caixa Empresa"). */
export interface FiltrosCaixaEmpresa {
  competencia?: string; // 'AAAA-MM'
  fluxo?: FluxoLancamento;
  status?: StatusLancamento;
  categoriaId?: string;
  caixa?: CaixaLancamento;
}

/** Filtros aceitos pela listagem de contas a pagar. */
export interface FiltrosContasAPagar {
  status?: StatusContaFinanceira;
  vencidasAte?: string; // ISO date
  fornecedorId?: string;
  incluirLancamentos?: boolean;
  incluirReembolsos?: boolean;
}

/** Filtros aceitos pela listagem de contas a receber. */
export interface FiltrosContasAReceber {
  status?: StatusContaFinanceira;
  vencidasAte?: string; // ISO date
  cotistaId?: string;
}
