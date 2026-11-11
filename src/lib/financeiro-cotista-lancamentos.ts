import type { CotistaAeronave } from "@/lib/colaborador-api";
import type { DocumentoVinculado, LancamentoEconomico } from "@/lib/financeiro-share-api";

export type OpcaoFornecedorLancamento = { id: string; label: string };

const normalizarNome = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export function rateioDoCotista(
  lancamento: LancamentoEconomico,
  cotista: CotistaAeronave,
  cotistas: CotistaAeronave[],
) {
  const ids = [cotista.id, cotista.cliente_id, cotista.socio_id, ...(cotista.cotista_ids ?? [])];
  const rateios = lancamento.rateios ?? [];
  const porId = rateios.find((rateio) => rateio.cotistaId && ids.includes(rateio.cotistaId));
  if (porId) return porId;

  const nome = normalizarNome(cotista.nome.trim());
  const nomesIguais = cotistas.filter((item) => normalizarNome(item.nome.trim()) === nome);
  if (nomesIguais.length === 1) {
    const porNome = rateios.find((rateio) => normalizarNome(rateio.cotista.trim()) === nome);
    if (porNome) return porNome;
  }

  if (!rateios.length) {
    const participanteId = lancamento.participanteId;
    const participanteNome = lancamento.participanteNome;
    const pertence = Boolean(participanteId && ids.includes(participanteId))
      || (!participanteId && participanteNome && nomesIguais.length === 1
        && normalizarNome(participanteNome.trim()) === nome);
    if (pertence) {
      return {
        percentual: lancamento.percentualUso ?? lancamento.percentualSociedade ?? cotista.percentual_sociedade,
        valorCentavos: lancamento.valorRateadoCentavos || lancamento.valorCentavos,
      };
    }
  }
  return null;
}

const ehUuid = (valor: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

export function nomeFornecedorLancamento(
  item: LancamentoEconomico,
  fornecedores: OpcaoFornecedorLancamento[],
) {
  const fornecedor = opcaoFornecedorLancamento(item, fornecedores);
  if (fornecedor) return fornecedor.label;
  const nome = item.fornecedor?.trim() ?? "";
  if (nome && !ehUuid(nome)) return nome;
  return nome ? "Fornecedor não identificado" : "";
}

export function opcaoFornecedorLancamento(
  item: LancamentoEconomico,
  fornecedores: OpcaoFornecedorLancamento[],
) {
  const registro = item as LancamentoEconomico & {
    fornecedor_id?: string | null;
    fornecedores_favoritos_id?: string | null;
  };
  const nomeOuId = item.fornecedor?.trim() ?? "";
  const identificador = (registro.fornecedorId || registro.fornecedor_id || registro.fornecedores_favoritos_id || nomeOuId).trim();
  const fornecedorPorId = fornecedores.find((fornecedor) =>
    fornecedor.id === identificador || fornecedor.id.endsWith(`:${identificador}`),
  );
  if (fornecedorPorId) return fornecedorPorId;

  const nomeNormalizado = normalizarNome(nomeOuId);
  return fornecedores.find((fornecedor) =>
    normalizarNome(fornecedor.label) === nomeNormalizado,
  );
}

export function nomePagadoresDoLancamento(
  item: LancamentoEconomico,
  cotistas: CotistaAeronave[],
) {
  const resolveNome = (valor: string) => {
    const id = valor.trim();
    if (!id) return "";
    const cotista = cotistas.find((candidato) =>
      [candidato.id, candidato.cliente_id, candidato.socio_id, ...(candidato.cotista_ids ?? [])].includes(id),
    );
    if (cotista) return cotista.nome;
    return ehUuid(id) ? "Cotista não identificado" : id;
  };
  const pagadores = (item.rateios ?? [])
    .map((rateio) => rateio.pagoPor?.trim())
    .filter((pagador): pagador is string => Boolean(pagador));
  if (!pagadores.length && item.pagoPor?.trim()) pagadores.push(item.pagoPor.trim());
  return [...new Set(pagadores.map(resolveNome).filter(Boolean))].join(", ") || "—";
}

export function documentoDoLancamento(lancamento: LancamentoEconomico) {
  return (
    lancamento.numeroDemonstrativo ||
    lancamento.documentoNumero ||
    lancamento.numeroNf ||
    lancamento.numeroRecibo ||
    lancamento.numeroDoc ||
    lancamento.documento ||
    null
  );
}

export type DocumentoDoLancamento = DocumentoVinculado & { responsaveis: string[] };

/** Reúne os anexos sem perder o vínculo quando a API também os traz no lançamento. */
export function documentosDoLancamento(
  lancamento: LancamentoEconomico,
  cotistas: CotistaAeronave[] = [],
): DocumentoDoLancamento[] {
  const documentos = new Map<string, DocumentoDoLancamento>();
  const adicionar = (documento: DocumentoVinculado, responsavel?: string) => {
    if (!documento.url && !documento.numero?.trim()) return;
    const chave = documento.url || `${documento.tipo || documento.nome}:${documento.numero}`;
    const anterior = documentos.get(chave);
    documentos.set(chave, {
      ...anterior,
      ...documento,
      nome: documento.nome || anterior?.nome || "Documento",
      numero: documento.numero?.trim() || anterior?.numero || null,
      tipo: documento.tipo || anterior?.tipo || null,
      responsaveis: [...new Set([...(anterior?.responsaveis ?? []), ...(responsavel ? [responsavel] : [])])],
    });
  };
  const legados = [
    { nome: "Documento", tipo: "documento", url: lancamento.urlDoc, numero: lancamento.numeroDoc },
    { nome: "Nota fiscal", tipo: "nota_fiscal", url: lancamento.urlNf, numero: lancamento.numeroNf },
    { nome: "Recibo", tipo: "recibo", url: lancamento.urlRecibo, numero: lancamento.numeroRecibo },
    { nome: "Demonstrativo", tipo: "demonstrativo", url: lancamento.urlDemonstrativo, numero: lancamento.numeroDemonstrativo },
    { nome: "Boleto", tipo: "boleto", url: lancamento.urlBoleto, numero: lancamento.numeroBoleto },
  ];
  for (const documento of legados) {
    if (documento.url) adicionar({ ...documento, url: documento.url });
  }
  for (const documento of lancamento.documentos ?? []) adicionar(documento);
  for (const rateio of lancamento.rateios ?? []) {
    const cotista = rateio.cotistaId ? cotistas.find((item) =>
      [item.id, item.cliente_id, item.socio_id, ...(item.cotista_ids ?? [])].includes(rateio.cotistaId),
    ) : undefined;
    const responsavel = cotista?.nome || rateio.cotista || "Cotista não identificado";
    for (const documento of rateio.documentos ?? []) adicionar(documento, responsavel);
  }
  return [...documentos.values()];
}

/** Resumo para leitura/busca; a edição continua usando o campo original individual. */
export function numerosDocumentosDoLancamento(lancamento: LancamentoEconomico) {
  const numeros = [
    lancamento.numeroDemonstrativo, lancamento.documentoNumero, lancamento.numeroNf,
    lancamento.numeroRecibo, lancamento.numeroDoc, lancamento.numeroBoleto,
    ...(lancamento.documentos ?? []).map((documento) => documento.numero),
    ...(lancamento.rateios ?? []).flatMap((rateio) => (rateio.documentos ?? []).map((documento) => documento.numero)),
  ].map((numero) => numero?.trim()).filter((numero): numero is string => Boolean(numero));
  return [...new Set(numeros)].join(" / ") || documentoDoLancamento(lancamento);
}

export function tipoRateioLancamento(lancamento: LancamentoEconomico) {
  return String(lancamento.tipoRateio || lancamento.tipo || "—")
    .replace(/_/g, " ")
    .toLocaleUpperCase("pt-BR");
}

export function valorPagoLancamento(lancamento: LancamentoEconomico) {
  const pagoInformado = Math.max(0, Number(lancamento.valorPagoCentavos || 0));
  const status = (lancamento.status ?? "").trim().toUpperCase();
  if (["PAGO", "PAGO_DIRETAMENTE"].includes(status)) {
    return Math.min(lancamento.valorCentavos, pagoInformado || lancamento.valorCentavos);
  }
  return Math.min(lancamento.valorCentavos, pagoInformado);
}

