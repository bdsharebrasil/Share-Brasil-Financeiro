import type { ComboboxItem } from '../components/ui/searchableCombobox';
import { aeronaves, categorias, cotistas } from './financeiro';
import type { Fluxo, Periodicidade, StatusLancamento, TipoRateio } from '../types/financeiro';

export const opcoesCategoria: ComboboxItem[] = categorias.map((c) => ({
  id: c.id,
  label: c.nome,
  grupo: c.grupo,
  descricao: c.reembolsavel ?
  'Despesa reembolsável — gera cobrança ao cotista depois da baixa.' :
  'Despesa não reembolsável — entra direto no rateio da aeronave.'
}));

export const opcoesAeronave: ComboboxItem[] = aeronaves.map((a) => ({
  id: a.id,
  label: `${a.prefixo} — ${a.modelo}`,
  badge: a.prefixo,
  descricao: `${cotistas.filter((c) => c.aeronaveId === a.id).length} cotistas vinculados a esta aeronave.`
}));

export function opcoesCotista(aeronaveId?: string): ComboboxItem[] {
  const lista = aeronaveId ? cotistas.filter((c) => c.aeronaveId === aeronaveId) : cotistas;
  return [
  {
    id: 'rateio',
    label: 'Ratear entre todos os cotistas',
    descricao: 'O valor é dividido conforme o percentual de sociedade de cada cotista.'
  },
  ...lista.map((c) => ({
    id: c.id,
    label: c.nome,
    badge: `${c.percentualSociedade}%`,
    descricao: `Cotista da ${aeronaves.find((a) => a.id === c.aeronaveId)?.prefixo} — assume 100% desta despesa.`
  }))];

}

export const opcoesFluxo: {id: Fluxo;label: string;descricao: string;}[] = [
{
  id: 'DESPESA',
  label: 'Despesa',
  descricao: 'Saída de caixa da empresa que será rateada entre os cotistas.'
},
{
  id: 'RECEITA',
  label: 'Receita',
  descricao: 'Entrada de caixa, como o recebimento do rateio mensal.'
},
{
  id: 'REEMBOLSO',
  label: 'Reembolso',
  descricao: 'Despesa paga por alguém que será devolvida pela empresa ou pelo cotista.'
}];


export const opcoesRateio: {id: TipoRateio;label: string;descricao: string;}[] = [
{
  id: 'FIXO',
  label: 'Fixo — pela cota de sociedade',
  descricao: 'Dividido pelo percentual de cota, independente das horas voadas.'
},
{
  id: 'VARIAVEL_POR_HORA',
  label: 'Variável — por hora voada',
  descricao: 'Cada cotista paga na proporção das horas que voou no período.'
},
{
  id: 'VARIAVEL_POR_VOO',
  label: 'Variável — por voo realizado',
  descricao: 'Dividido pela quantidade de voos de cada cotista no período.'
},
{
  id: 'EXTRA',
  label: 'Extra — 100% do cotista',
  descricao: 'Cobrado integralmente do cotista responsável, sem divisão.'
}];


export const opcoesPeriodicidade: {id: Periodicidade;label: string;descricao: string;}[] = [
{ id: 'ÚNICO', label: 'Único', descricao: 'Cobrança que acontece uma só vez.' },
{ id: 'EVENTUAL', label: 'Eventual', descricao: 'Sem data fixa — ocorre conforme a operação.' },
{ id: 'MENSAL', label: 'Mensal', descricao: 'Repete todos os meses na mesma competência.' },
{ id: 'BIMESTRAL', label: 'Bimestral', descricao: 'Repete a cada dois meses.' },
{ id: 'TRIMESTRAL', label: 'Trimestral', descricao: 'Repete a cada três meses.' },
{ id: 'SEMESTRAL', label: 'Semestral', descricao: 'Repete a cada seis meses.' },
{ id: 'ANUAL', label: 'Anual', descricao: 'Repete uma vez por ano.' }];


export const opcoesFormaPagamento: ComboboxItem[] = [
{ id: 'Transferência PIX', label: 'Transferência PIX', descricao: 'Liquidação imediata.' },
{ id: 'Transferência TED', label: 'Transferência TED', descricao: 'Compensação no mesmo dia útil.' },
{ id: 'Boleto', label: 'Boleto bancário', descricao: 'Compensação em até 2 dias úteis.' },
{
  id: 'Cartão Corporativo',
  label: 'Cartão corporativo',
  descricao: 'Débito na fatura do cartão da empresa.'
},
{ id: 'Dinheiro', label: 'Dinheiro / espécie', descricao: 'Baixa manual no caixa.' }];


export const opcoesConta: ComboboxItem[] = [
{ id: 'Itaú · 4471-2', label: 'Itaú · Conta 4471-2', descricao: 'Caixa operacional Share Brasil.' },
{ id: 'Bradesco · 0091-8', label: 'Bradesco · Conta 0091-8', descricao: 'Folha de pagamento e tripulação.' },
{ id: 'BTG · 1123-0', label: 'BTG · Conta 1123-0', descricao: 'Aplicações e reserva de manutenção.' },
{ id: 'Caixa Share Brasil', label: 'Caixa Share Brasil', descricao: 'Caixa interno para pequenas despesas.' }];


export const opcoesStatus: ComboboxItem[] = [
{ id: 'TODOS', label: 'Todos os status', descricao: 'Sem filtro de situação.' },
{ id: 'EM_ABERTO', label: 'Em Aberto', descricao: 'Ainda dentro do prazo de pagamento.' },
{ id: 'EM_ATRASO', label: 'Em Atraso', descricao: 'Vencido e sem baixa registrada.' },
{ id: 'PAGO', label: 'Pago', descricao: 'Despesa liquidada.' },
{ id: 'RECEBIDO', label: 'Recebido', descricao: 'Receita já creditada em conta.' },
{
  id: 'AGUARDANDO_REEMBOLSO',
  label: 'Aguardando Reembolso',
  descricao: 'Pago por terceiro, aguardando devolução.'
},
{ id: 'REEMBOLSADO', label: 'Reembolsado', descricao: 'Devolução já efetuada.' }];


export const opcoesFiltroAeronave: ComboboxItem[] = [
{ id: 'todas', label: 'Todas as aeronaves', descricao: 'Sem filtro de matrícula.' },
...opcoesAeronave];


export const opcoesFiltroGrupo: ComboboxItem[] = [
{ id: 'todos', label: 'Todos os grupos de categoria', descricao: 'Sem filtro de grupo.' },
{
  id: 'DESPESAS EMPRESA',
  label: 'Despesas da empresa',
  descricao: 'Combustível, hangaragem, seguro, manutenção e taxas.'
},
{
  id: 'DESPESAS REEMBOLSÁVEIS',
  label: 'Despesas reembolsáveis',
  descricao: 'Gastos adiantados que serão devolvidos.'
},
{
  id: 'FOLHA DE PAGAMENTO',
  label: 'Folha de pagamento',
  descricao: 'Tripulação e equipe operacional.'
},
{ id: 'IMPOSTOS', label: 'Impostos e tributos', descricao: 'ISS, taxas e obrigações fiscais.' },
{
  id: 'RECEITAS OPERACIONAIS',
  label: 'Receitas operacionais',
  descricao: 'Rateio recebido dos cotistas.'
},
{
  id: 'ADM SHARE - RECIBO',
  label: 'ADM Share — recibo',
  descricao: 'Taxa de administração e recibos de saída.'
}];


export const opcoesFiltroStatus = opcoesStatus;

export type OpcaoStatusFiltro = StatusLancamento | 'TODOS';
