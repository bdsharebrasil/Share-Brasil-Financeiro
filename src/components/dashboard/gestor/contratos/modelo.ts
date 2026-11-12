export const LAYOUT_PDF_PROPOSTA = 'PREMIUM_SHARE_V1';
export const STATUS_CONTRATOS = [
  'RASCUNHO',
  'EM_REVISAO',
  'ENVIADO',
  'ASSINADO',
  'EM_VIGENCIA',
  'CONCLUIDO',
  'RESCINDIDO',
  'CANCELADO',
] as const;
export type StatusContrato = (typeof STATUS_CONTRATOS)[number];
export const ROTULOS_STATUS: Record<StatusContrato, string> = {
  RASCUNHO: 'Rascunho',
  EM_REVISAO: 'Em revisão',
  ENVIADO: 'Enviado',
  ASSINADO: 'Assinado',
  EM_VIGENCIA: 'Em vigência',
  CONCLUIDO: 'Concluído',
  RESCINDIDO: 'Rescindido',
  CANCELADO: 'Cancelado',
};
export type Parte = {
  id?: string;
  papel: string;
  tipo_pessoa: 'FISICA' | 'JURIDICA';
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  representante_nome?: string;
  representante_documento?: string;
  representante_cargo?: string;
  dados_adicionais?: Record<string, unknown>;
  assinou_em?: string | null;
  ordem?: number;
};
export type Servico = {
  id: string;
  titulo: string;
  incluido: boolean;
  valor_centavos: number;
  itens: string[];
};
export type Proposta = {
  versao: 1;
  emissao: string;
  validade_dias: number;
  cidade: string;
  aeronave_descricao: string;
  apresentacao: string;
  descricao_servicos: string;
  areas: string[];
  servicos: Servico[];
  modo_cobranca: 'PACOTE' | 'SERVICOS';
  unidade: 'POR_COTISTA' | 'POR_AERONAVE';
  quantidade_cotistas: number;
  valor_pacote_centavos: number;
  condicoes: string;
  encerramento: string;
};
export type EventoContrato = {
  id: string;
  data: string;
  usuario_id: string;
  acao: string;
  de?: string;
  para?: string;
  descricao?: string;
};
export type Contrato = {
  id: string;
  numero: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  status: StatusContrato;
  valor_centavos: number | null;
  moeda: string;
  forma_pagamento: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  data_assinatura: string | null;
  aeronave_id: string | null;
  dados_adicionais: Record<string, unknown>;
  documento_url: string | null;
  foro: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  partes: Parte[];
  anexos: {
    id: string;
    nome: string;
    tipo: string;
    arquivo_url: string;
    criado_em?: string;
  }[];
  revisao?: number;
};
export type EdicaoContrato = {
  titulo: string;
  numero: string;
  status: StatusContrato;
  forma_pagamento: string;
  data_inicio: string;
  data_fim: string;
  data_assinatura: string;
  aeronave_id: string;
  foro: string;
  observacoes: string;
  cotista_id: string;
  contratante: Parte;
  contratada: Parte;
  proposta: Proposta;
};
export const hojeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const parteVazia = (papel: string): Parte => ({
  papel,
  tipo_pessoa: 'JURIDICA',
  nome: '',
  documento: '',
  email: '',
  telefone: '',
  endereco: '',
});
export const moeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valor / 100,
  );
export const reais = (valor: number) =>
  (valor / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function centavos(valor: string) {
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(valor)) return null;
  const n = Math.round(
    Number(valor.replace(/\./g, '').replace(',', '.')) * 100,
  );
  return Number.isSafeInteger(n) ? n : null;
}
export function dataBR(valor: string | null) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? valor.split('-').reverse().join('/')
    : '—';
}
export function validadeProposta(p: Proposta) {
  const d = new Date(`${p.emissao}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || !Number.isInteger(p.validade_dias))
    return '';
  d.setUTCDate(d.getUTCDate() + p.validade_dias);
  return d.toISOString().slice(0, 10);
}
export function calcularProposta(p: Proposta) {
  const unitario =
    p.modo_cobranca === 'PACOTE'
      ? p.valor_pacote_centavos
      : p.servicos
          .filter((s) => s.incluido)
          .reduce((n, s) => n + s.valor_centavos, 0);
  const quantidade = p.unidade === 'POR_COTISTA' ? p.quantidade_cotistas : 1;
  const total = unitario * quantidade;
  if (
    !Number.isSafeInteger(unitario) ||
    unitario < 0 ||
    !Number.isInteger(quantidade) ||
    quantidade < 1 ||
    !Number.isSafeInteger(total)
  )
    throw Error('Confira os valores e a quantidade de cotistas.');
  return { unitario, quantidade, total };
}

export function novaProposta(): Proposta {
  return {
    versao: 1,
    emissao: hojeLocal(),
    validade_dias: 15,
    cidade: 'Cuiabá/MT',
    aeronave_descricao: '',
    modo_cobranca: 'PACOTE',
    unidade: 'POR_COTISTA',
    quantidade_cotistas: 1,
    valor_pacote_centavos: 175000,
    apresentacao: `Em tempos de crise a palavra é INOVAÇÃO.

Ver oportunidade em um momento difícil, assim nasceu a SHARE BRASIL. A palavra “SHARE”, que na tradução significa “Compartilhar”, já traz um prospecto do que veremos nos próximos anos em todos os segmentos.

A aviação executiva não foge à regra e, por isso, trouxemos para Cuiabá a inovação em transporte executivo, fornecendo profissionalismo na entrega de serviços. A otimização da aviação executiva tem sido foco da empresa há pelo menos 3 anos, e o compartilhamento tornou-se algo tão tangível quanto viável economicamente.

Para oferecermos algo diferente do atual mercado nacional, escolhemos por não “engessar” nossas ofertas de serviços, buscando sempre uma visão de “SOLUÇÃO” em compartilhamento e gerenciamento de aeronaves, ofertando propostas personalizadas a seus clientes.

Também temos enorme preocupação em relação à qualidade da segurança em suas operações. Para tanto, modelos de qualidade fornecidos em empresas de táxi aéreo, linhas aéreas e mesmo da aviação executiva estão em implementação constante.

Nossas operações contam com uma rede de apoio (Flight Support) ampla em todo o território nacional. Nossos tripulantes passam por avaliações anuais de saúde e capacidade técnica, além de avaliações internas que envolvem habilidades não técnicas (NOTECHS), vindas do programa de CRM (corporate resource management).

As manutenções costumam dar “dor de cabeça” para proprietários de aeronaves, principalmente quando a falta de informações faz com que tomadas de decisões afetem os custos operacionais e mesmo a segurança. Para resolver este problema, contamos com uma equipe técnica especializada no equipamento em questão em Cuiabá e com nosso acompanhamento incondicional através de Ordens de Acompanhamento de Serviço (OAS) e Relatórios de Acompanhamento de Serviço (RAS), agilizando o fornecimento de peças com melhores preços e prazos de entrega.

Todos os pontos citados anteriormente fazem parte do programa de gerenciamento SHARE, onde o principal objetivo é facilitar o transporte aéreo executivo, deixando aos usuários apenas o trabalho de entrar em contato conosco.`,
    descricao_servicos:
      'Fornecemos ao cliente, além do apoio incondicional em todas as fases de voo (coordenação de voo, serviço de rampa e logística de solo), uma gestão completa de custos mensais e prospecção de gastos semestrais e anuais. Uma boa gestão de aeronave consegue reduzir custos, cortando gastos desnecessários ou evitando retrabalhos, disponibilizando a aeronave por mais dias no mês.',
    areas: [
      'Gestão de compartilhamento',
      'Financeiro para apoio de custos da aeronave',
      'Relacionamento pessoal / marketing',
      'Estatística (centro de custos da aeronave)',
      'Coordenação de voo',
      'Pilotagem (pilotos com o mesmo mínimo de empresas de táxi aéreo)',
      'GSO (gerente de segurança operacional)',
      'Engenharia aeronáutica e mecânica',
    ],
    condicoes: 'Optando sem nota, com recibo, desconto de R$ 100,00 por sócio.',
    encerramento: 'Voe seguro, voe eficiente, voe com SHARE BRASIL.',
    servicos: [
      {
        id: 'ctm',
        titulo: 'Gestão de manutenção da aeronave / CTM',
        incluido: true,
        valor_centavos: 170000,
        itens: [
          'Controle de vencimentos dos componentes da aeronave',
          'Controle de disponibilidade de horas da aeronave',
          'Atualização de cadernetas',
          'Análise de conformidades das etiquetas de manutenção',
          'Auxílio nas cotações e compras de peças',
          'Auxílio na cotação e contratação de prestadores de serviços terceirizados',
          'Auxílio nas cotações e contratos de seguros aeronáuticos',
          'Atualização e acompanhamento de diário de bordo',
          'Elaboração de OAS (Ordem de Acompanhamento de Serviço)',
          'Elaboração de RAS (Relatório de Acompanhamento de Serviço)',
        ],
      },
      {
        id: 'financeiro',
        titulo: 'Gestão financeira da aeronave',
        incluido: true,
        valor_centavos: 150000,
        itens: [
          'Balanço financeiro mensal de custos entre cotistas (regime de copropriedade)',
          'Registro e elaboração do custeio mensal da aeronave',
          'Controle de vencimentos e estoque de comissaria',
          'Controle de vencimentos e atualização de assinaturas eletrônicas',
          'Auxílio na elaboração de relatório de despesas de viagens',
          'Auxílio no controle de ressarcimentos de despesas de viagens e diárias',
          'Elaboração de relatório de despesa de viagem',
          'Controle e acompanhamento de cobranças tarifárias, combustíveis, peças e terceiros',
        ],
      },
      {
        id: 'estatistica',
        titulo: 'Estatística',
        incluido: true,
        valor_centavos: 130000,
        itens: [
          'Elaboração de dados estatísticos sobre consumo médio da aeronave, volume total mensal e anual de abastecimentos, quantidade de km e horas voadas por cada piloto',
          'Registro e elaboração do quantitativo de horas voadas da aeronave',
          'Projeção estatística de custos a curto, médio e longo prazo',
          'Custo por hora, km e assento atualizados',
          'Registro do diário de bordo digital para elaboração de relatórios operacionais',
        ],
      },
    ],
  };
}
export function novaEdicao(): EdicaoContrato {
  return {
    titulo: 'Proposta de gerenciamento de aeronave',
    numero: '',
    status: 'RASCUNHO',
    forma_pagamento: 'Mensal',
    data_inicio: '',
    data_fim: '',
    data_assinatura: '',
    aeronave_id: '',
    foro: '',
    observacoes: '',
    cotista_id: '',
    contratante: parteVazia('CONTRATANTE'),
    contratada: { ...parteVazia('CONTRATADA'), nome: 'SHARE BRASIL' },
    proposta: novaProposta(),
  };
}
export function edicaoDoContrato(c: Contrato): EdicaoContrato {
  const d = c.dados_adicionais;
  return {
    titulo: c.titulo,
    numero: c.numero || '',
    status: c.status,
    forma_pagamento: c.forma_pagamento || '',
    data_inicio: c.data_inicio || '',
    data_fim: c.data_fim || '',
    data_assinatura: c.data_assinatura || '',
    aeronave_id: c.aeronave_id || '',
    foro: c.foro || '',
    observacoes: c.observacoes || '',
    cotista_id: String(d.cotista_id || ''),
    contratante: {
      ...parteVazia('CONTRATANTE'),
      ...c.partes.find((p) => p.papel === 'CONTRATANTE'),
    },
    contratada: {
      ...parteVazia('CONTRATADA'),
      ...c.partes.find((p) => p.papel === 'CONTRATADA'),
    },
    proposta: (d.proposta_gerenciamento as Proposta) || novaProposta(),
  };
}
const dataValida = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
export function validarEdicao(e: EdicaoContrato, gerar = false) {
  if (
    e.proposta.servicos.some(
      (s) => !Number.isSafeInteger(s.valor_centavos) || s.valor_centavos < 0,
    ) ||
    !Number.isSafeInteger(e.proposta.valor_pacote_centavos) ||
    e.proposta.valor_pacote_centavos < 0
  )
    return 'Confira os valores dos serviços e do pacote.';
  if (
    [e.data_inicio, e.data_fim, e.data_assinatura].some(
      (d) => d && !dataValida(d),
    )
  )
    return 'Confira as datas do contrato.';
  if (e.data_inicio && e.data_fim && e.data_fim < e.data_inicio)
    return 'O término não pode ser anterior ao início.';
  if (!e.titulo.trim()) return 'Informe o título.';
  try {
    calcularProposta(e.proposta);
  } catch (err) {
    return String((err as Error).message);
  }
  if (
    !dataValida(e.proposta.emissao) ||
    !validadeProposta(e.proposta) ||
    e.proposta.validade_dias < 1 ||
    e.proposta.validade_dias > 365
  )
    return 'Confira a data de emissão e a validade da proposta.';
  if (gerar || e.status !== 'RASCUNHO') {
    if (!e.contratante.nome.trim() || !e.contratada.nome.trim())
      return 'Preencha as duas partes antes de gerar o documento ou avançar o status.';
    if (!e.proposta.aeronave_descricao.trim()) return 'Informe a aeronave.';
    if (!e.proposta.servicos.some((s) => s.incluido))
      return 'Selecione pelo menos um grupo de serviços.';
  }
  return '';
}
export function payloadContrato(e: EdicaoContrato, anterior?: Contrato | null) {
  return {
    numero: e.numero.trim() || null,
    tipo: 'PRESTACAO_SERVICO',
    titulo: e.titulo,
    descricao: 'Proposta de gerenciamento de aeronave',
    status: e.status,
    valor_centavos: calcularProposta(e.proposta).total,
    moeda: 'BRL',
    forma_pagamento: e.forma_pagamento,
    aeronave_id: e.aeronave_id || null,
    data_inicio: e.data_inicio || null,
    data_fim: e.data_fim || null,
    data_assinatura: e.data_assinatura || null,
    foro: e.foro,
    observacoes: e.observacoes,
    dados_adicionais: {
      ...anterior?.dados_adicionais,
      modelo: 'PROPOSTA_GERENCIAMENTO',
      layout_pdf: LAYOUT_PDF_PROPOSTA,
      proposta_gerenciamento: e.proposta,
      tipo_vinculo: e.cotista_id ? 'COTISTA' : 'MANUAL',
      cotista_id: e.cotista_id || null,
    },
    partes: [
      { ...e.contratante, ordem: 0 },
      { ...e.contratada, ordem: 1 },
    ],
    ...(anterior
      ? {
          revisao_esperada:
            anterior.revisao ?? Number(anterior.dados_adicionais._revisao || 0),
        }
      : {}),
  };
}
