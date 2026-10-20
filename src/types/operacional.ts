export type StatusColaborador = "PAGO" | "EM_ABERTO" | "EM_ATRASO";

export interface Colaborador {
  id: string;
  nome: string;
  iniciais: string;
  cargo: string;
  aeronave: string;
  competencia: string;
  salarioBase: number;
  encargos: number;
  beneficios: number;
  vencimento: string;
  status: StatusColaborador;
}

export type StatusNotaSaida =
  | "RASCUNHO"
  | "AGUARDANDO_CONFERENCIA"
  | "ENVIADO"
  | "ASSINADO"
  | "FINALIZADO";

export interface NotaSaida {
  id: string;
  numero: string;
  destinatario: string;
  aeronave: string;
  competencia: string;
  categoria: string;
  valor: number;
  emissao: string;
  status: StatusNotaSaida;
}

export type StatusOrcamento = "EM_ANALISE" | "APROVADO" | "EXPIRADO" | "RECUSADO";

export interface Orcamento {
  id: string;
  descricao: string;
  fornecedor: string;
  aeronave: string;
  categoria: string;
  valor: number;
  validade: string;
  prazoEntrega: string;
  status: StatusOrcamento;
  economia?: number;
}
