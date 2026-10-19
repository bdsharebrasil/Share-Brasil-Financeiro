import type { Colaborador, NotaSaida, Orcamento } from '../types/operacional';

export const folhaPagamento: Colaborador[] = [
{
  id: 'CL-01',
  nome: 'Cmte. Henrique Duarte',
  iniciais: 'HD',
  cargo: 'Comandante',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  salarioBase: 32000,
  encargos: 11840,
  beneficios: 3200,
  vencimento: '2026-06-05',
  status: 'PAGO'
},
{
  id: 'CL-02',
  nome: 'Cmte. Letícia Prado',
  iniciais: 'LP',
  cargo: 'Comandante',
  aeronave: 'PR-XYZ',
  competencia: 'Jun/2026',
  salarioBase: 32000,
  encargos: 11840,
  beneficios: 3200,
  vencimento: '2026-06-05',
  status: 'PAGO'
},
{
  id: 'CL-03',
  nome: 'Copiloto Rafael Nunes',
  iniciais: 'RN',
  cargo: 'Copiloto',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  salarioBase: 18500,
  encargos: 6845,
  beneficios: 2400,
  vencimento: '2026-06-05',
  status: 'EM_ABERTO'
},
{
  id: 'CL-04',
  nome: 'Copiloto Diego Ramos',
  iniciais: 'DR',
  cargo: 'Copiloto',
  aeronave: 'PR-XYZ',
  competencia: 'Jun/2026',
  salarioBase: 18500,
  encargos: 6845,
  beneficios: 2400,
  vencimento: '2026-06-05',
  status: 'EM_ABERTO'
},
{
  id: 'CL-05',
  nome: 'Camila Ferraz',
  iniciais: 'CF',
  cargo: 'Comissária de bordo',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  salarioBase: 9800,
  encargos: 3626,
  beneficios: 1600,
  vencimento: '2026-06-05',
  status: 'EM_ATRASO'
},
{
  id: 'CL-06',
  nome: 'Sérgio Bastos',
  iniciais: 'SB',
  cargo: 'Mecânico de manutenção',
  aeronave: 'Base SBSP',
  competencia: 'Jun/2026',
  salarioBase: 12400,
  encargos: 4588,
  beneficios: 1800,
  vencimento: '2026-06-05',
  status: 'EM_ABERTO'
},
{
  id: 'CL-07',
  nome: 'Juliana Reis',
  iniciais: 'JR',
  cargo: 'Administrativo / Financeiro',
  aeronave: 'Escritório',
  competencia: 'Jun/2026',
  salarioBase: 11200,
  encargos: 4144,
  beneficios: 1500,
  vencimento: '2026-06-05',
  status: 'PAGO'
}];


export const notasSaida: NotaSaida[] = [
{
  id: 'NF-0091',
  numero: 'NF 000091',
  destinatario: 'Eduardo Lins',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  categoria: 'ADM Share Brasil',
  valor: 18500,
  emissao: '2026-06-01',
  status: 'FINALIZADO'
},
{
  id: 'NF-0092',
  numero: 'NF 000092',
  destinatario: 'Ana Beatriz',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  categoria: 'ADM Share Brasil',
  valor: 18500,
  emissao: '2026-06-01',
  status: 'ASSINADO'
},
{
  id: 'NF-0093',
  numero: 'NF 000093',
  destinatario: 'Rodrigo Faria',
  aeronave: 'PR-XYZ',
  competencia: 'Jun/2026',
  categoria: 'ADM e Trip Share Brasil',
  valor: 22400,
  emissao: '2026-06-02',
  status: 'ENVIADO'
},
{
  id: 'NF-0094',
  numero: 'NF 000094',
  destinatario: 'Marcos Silveira',
  aeronave: 'PR-XYZ',
  competencia: 'Jun/2026',
  categoria: 'ADM e Trip Share Brasil',
  valor: 22400,
  emissao: '2026-06-02',
  status: 'AGUARDANDO_CONFERENCIA'
},
{
  id: 'NF-0095',
  numero: 'Recibo 000095',
  destinatario: 'Fernanda Moura',
  aeronave: 'PS-ABC',
  competencia: 'Jun/2026',
  categoria: 'Recibo de Saída',
  valor: 18500,
  emissao: '2026-06-03',
  status: 'RASCUNHO'
}];


export const orcamentos: Orcamento[] = [
{
  id: 'OR-2026-018',
  descricao: 'Revisão programada 600h — célula e motores',
  fornecedor: 'TAM Aviação Executiva',
  aeronave: 'PR-XYZ',
  categoria: 'Manutenção',
  valor: 386400,
  validade: '2026-06-30',
  prazoEntrega: '45 dias',
  status: 'EM_ANALISE'
},
{
  id: 'OR-2026-019',
  descricao: 'Revisão programada 600h — célula e motores',
  fornecedor: 'Líder Aviação',
  aeronave: 'PR-XYZ',
  categoria: 'Manutenção',
  valor: 412800,
  validade: '2026-06-25',
  prazoEntrega: '38 dias',
  status: 'EM_ANALISE'
},
{
  id: 'OR-2026-015',
  descricao: 'Renovação de seguro casco e RETA — 12 meses',
  fornecedor: 'Porto Seguro Aviação',
  aeronave: 'PS-ABC',
  categoria: 'Seguro',
  valor: 466800,
  validade: '2026-07-15',
  prazoEntrega: 'Imediato',
  status: 'APROVADO',
  economia: 28400
},
{
  id: 'OR-2026-012',
  descricao: 'Contrato anual de hangaragem — Base SBSP',
  fornecedor: 'Hangar Congonhas Ltda',
  aeronave: 'PS-ABC',
  categoria: 'Hangaragem',
  valor: 748800,
  validade: '2026-05-31',
  prazoEntrega: 'Imediato',
  status: 'EXPIRADO'
},
{
  id: 'OR-2026-009',
  descricao: 'Pintura externa completa e retoque de interior',
  fornecedor: 'AeroPaint Brasil',
  aeronave: 'PR-XYZ',
  categoria: 'Manutenção',
  valor: 298000,
  validade: '2026-06-10',
  prazoEntrega: '60 dias',
  status: 'RECUSADO'
}];