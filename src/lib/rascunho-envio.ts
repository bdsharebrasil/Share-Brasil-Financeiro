import type { RascunhoEnvioPagamento } from "./colaborador-api";

export type DadosRascunhoEnvio = {
  form?: { descricao?: string };
  envioId?: string | null;
};

export type ProgressoRascunhoEnvio = {
  preenchimento: string;
  programacao: string;
  rateio: string;
  email: string;
  descricao: string;
  envioCriado: boolean;
};

export function lerDadosRascunho(dadosJson: string | null | undefined): DadosRascunhoEnvio {
  try {
    const dados = JSON.parse(dadosJson || "{}");
    return dados && typeof dados === "object" ? dados as DadosRascunhoEnvio : {};
  } catch {
    return {};
  }
}

export function progressoRascunho(rascunho: RascunhoEnvioPagamento, dados: DadosRascunhoEnvio): ProgressoRascunhoEnvio {
  const envioCriado = Boolean(rascunho.envio_id || dados.envioId);
  const programado = Boolean(rascunho.envio_lancamento_id || rascunho.envio_movimentacao_id || ["CONVERTIDO"].includes(String(rascunho.envio_status || "").toUpperCase()));
  const tipoComRateio = rascunho.tipo_envio !== "share";
  const totalEmails = Number(rascunho.total_destinatarios || 0);
  const emailsEnviados = Number(rascunho.emails_enviados || 0);
  const emailsFalhos = Number(rascunho.emails_falhos || 0);

  return {
    preenchimento: envioCriado ? "Concluído" : rascunho.etapa_atual > 0 ? `Em andamento · etapa ${rascunho.etapa_atual + 1} de 4` : "Pendente",
    programacao: !envioCriado ? "Aguardando criação" : programado ? "Concluída" : "Pendente",
    rateio: !tipoComRateio ? "Não se aplica" : Number(rascunho.rateio_total || 0) > 0 ? `Concluído · ${rascunho.rateio_total} linha(s)` : "Pendente",
    email: !tipoComRateio ? "Não se aplica" : totalEmails === 0 ? "Aguardando destinatários" : emailsFalhos > 0 ? `${emailsFalhos} falha(s) · ${emailsEnviados} de ${totalEmails}` : emailsEnviados >= totalEmails ? "Concluído" : `${emailsEnviados} de ${totalEmails} enviados`,
    descricao: dados.form?.descricao || ({ share: "Pagamento Share", cliente: "Despesa de cliente", reembolso: "Despesa com reembolso" } as Record<string, string>)[rascunho.tipo_envio] || "Pagamento",
    envioCriado,
  };
}
