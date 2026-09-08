export type DocumentoSaidaOrigem = "nf_saida" | "recibo_saida";
export type StatusDocumentoSaida = "EM_ABERTO" | "PAGO" | "RECEBIDO" | "CANCELADO";
export type StatusRecibo = "CRIADO" | "ANEXO_PENDENTE" | "PDF_PENDENTE" | "EMITIDO" | "ERRO_ANEXO" | "ERRO_PDF" | "CANCELADO";
export type TipoRecibo = "recibo_reembolso" | "recibo_colaborador" | "recibo_pagamento";

export type CotistaAeronaveRef = {
  cotista_aeronave_id: string;
  aeronave_id: string;
  cliente_id: string | null;
  socio_id: string | null;
};
