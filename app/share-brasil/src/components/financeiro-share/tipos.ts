// Tipos do módulo Financeiro Share — espelham o schema real das tabelas D1
// (backend-share). Ajuste aqui se o schema mudar; os componentes e ganchos
// (hooks) deste módulo importam tudo daqui, então este arquivo é a fonte
// única de verdade dos tipos.

export type FluxoLancamento = 'ENTRADA' | 'SAIDA';
export type CaixaLancamento = 'SHARE' | 'CLIENTE';
export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'CANCELADO';
export type StatusContaFinanceira = 'PENDENTE' | 'PAGO' | 'CANCELADO' | 'ATRASADO';
/** @deprecated use StatusContaFinanceira — mantido para não quebrar imports existentes */
export type StatusContaAPagar = StatusContaFinanceira;

export interface Lancamento {
  id: string;
  aeronaveId: string | null;
  data: string; // ISO date
  descricao: string;
  documento: string | null;
  fornecedor: string | null; // texto livre, usado quando fornecedorId é nulo
  fornecedorId: string | null; // FK -> fornecedores_favoritos
  categoria: string; // texto livre, usado quando categoriaId é nulo
  categoriaId: string | null; // FK -> categoria_movimentacao_share
  grupoCategoria: string;
  tipo: string | null;
  prazo: string | null;
  fluxo: FluxoLancamento;
  valorCentavos: number;
  pagoPor: string;
  caixa: CaixaLancamento;
  pagoDiretamente: boolean;
  reembolsavel: boolean;
  reembolsoQuitado: boolean;
  status: StatusLancamento;
  observacoes: string | null;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ContaAPagar {
  id: string;
  dataVencimento: string;
  valor: number;
  categoriaId: string | null;
  categoriaNome: string | null;
  descricao: string | null;
  criadoPor: string | null;
  aeronaveId: string | null;
  fornecedorId: string | null;
  cotistaId: string | null;
  boletoUrl: string | null;
  nfUrl: string | null;
  dataPagamento: string | null;
  bancoPagamento: string | null;
  comprovantePagamentoUrl: string | null;
  lancamentoId: string | null;
  status: StatusContaFinanceira;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ContaAReceber {
  id: string;
  dataVencimento: string;
  valor: number;
  categoriaId: string | null;
  categoriaNome: string | null;
  descricao: string | null;
  criadoPor: string | null;
  aeronaveId: string | null;
  fornecedorId: string | null;
  cotistaId: string | null;
  boletoUrl: string | null;
  nfUrl: string | null;
  nfSaidaId: string | null;
  dataRecebimento: string | null;
  bancoRecebimento: string | null;
  comprovanteRecebimentoUrl: string | null;
  lancamentoId: string | null;
  status: StatusContaFinanceira;
  criadoEm: string;
  atualizadoEm: string;
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
}

/** Filtros aceitos pela listagem de contas a pagar. */
export interface FiltrosContasAPagar {
  status?: StatusContaFinanceira;
  vencidasAte?: string; // ISO date
  fornecedorId?: string;
}

/** Filtros aceitos pela listagem de contas a receber. */
export interface FiltrosContasAReceber {
  status?: StatusContaFinanceira;
  vencidasAte?: string; // ISO date
  cotistaId?: string;
}
