import { Router, type IRouter } from "express";
import {
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
  GetFinancialMovementsQueryParams,
  GetFinancialMovementsResponse,
  GetShareholdersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const dashboardData = {
  operacoes: {
    departamento: "operacoes" as const,
    greeting: "Bom dia, Camilla",
    period: "Domingo, 30 de agosto de 2026",
    metrics: [
      { label: "Voos hoje", value: "06", detail: "2 em andamento", tone: "blue" as const },
      { label: "Agendamentos", value: "18", detail: "3 aguardando confirmação", tone: "green" as const },
      { label: "Pendências", value: "04", detail: "1 crítica para hoje", tone: "amber" as const },
    ],
    alerts: [
      { id: "op-1", title: "Plano de voo aguardando envio", description: "PT-OJG · saída prevista às 14:30", severity: "warning" as const },
      { id: "op-2", title: "Recado da operação", description: "Janela de manutenção do PR-SBR confirmada para amanhã.", severity: "info" as const },
    ],
  },
  financeiro: {
    departamento: "financeiro" as const,
    greeting: "Bom dia, Camilla",
    period: "Competência · agosto de 2026",
    metrics: [
      { label: "A receber", value: "R$ 84.630", detail: "12 cobranças em aberto", tone: "blue" as const },
      { label: "Programado", value: "R$ 42.180", detail: "8 pagamentos próximos", tone: "amber" as const },
      { label: "Inadimplência", value: "R$ 9.420", detail: "2 clientes críticos", tone: "red" as const },
    ],
    alerts: [
      { id: "fin-1", title: "Fechamento pendente", description: "O fechamento de julho precisa ser revisado em 3 dias.", severity: "warning" as const },
      { id: "fin-2", title: "2 recibos prontos para emissão", description: "As despesas foram conferidas e podem seguir para os cotistas.", severity: "success" as const },
    ],
  },
  gestor: {
    departamento: "gestor" as const,
    greeting: "Visão geral, Camilla",
    period: "Consolidado · agosto de 2026",
    metrics: [
      { label: "Saldo Caixa Share", value: "R$ 286.420", detail: "+8,4% contra julho", tone: "green" as const },
      { label: "Caixa Cliente", value: "R$ 118.930", detail: "24 movimentações no mês", tone: "blue" as const },
      { label: "Fechamentos", value: "09 / 12", detail: "3 aguardando conferência", tone: "amber" as const },
    ],
    alerts: [
      { id: "gest-1", title: "3 balanços mensais aguardam conferência", description: "DGA, PT-OJG e PR-SBR têm itens para validar antes do fechamento.", severity: "warning" as const },
      { id: "gest-2", title: "Caixa Share saudável", description: "Nenhuma conta crítica a vencer nos próximos 7 dias.", severity: "success" as const },
    ],
  },
  portal: {
    departamento: "portal" as const,
    greeting: "Olá, Camilla",
    period: "Atualizado há 12 minutos",
    metrics: [
      { label: "Em aberto", value: "R$ 4.475", detail: "2 cobranças aguardando pagamento", tone: "amber" as const },
      { label: "Pagos no mês", value: "R$ 18.260", detail: "5 lançamentos confirmados", tone: "green" as const },
      { label: "Documentos", value: "08", detail: "Todos disponíveis para consulta", tone: "blue" as const },
    ],
    alerts: [
      { id: "portal-1", title: "Pagamento pendente", description: "Combustível · vencimento em 3 dias", severity: "warning" as const },
    ],
  },
} as const;

const movements = [
  {
    id: "mov-001",
    date: "26 ago.",
    description: "Relatório de viagem · reembolso",
    category: "Despesas de viagem",
    account: "DGA Administradora de Bens SPE Ltda.",
    paidBy: "Dejalmo",
    amount: 617.33,
    status: "pago" as const,
    caixa: "share" as const,
    reimbursable: true,
  },
  {
    id: "mov-002",
    date: "14 ago.",
    description: "Combustível · JET",
    category: "Sem categoria",
    account: "DGA Administradora de Bens SPE Ltda.",
    paidBy: "—",
    amount: 4475,
    status: "pendente" as const,
    caixa: "cliente" as const,
    reimbursable: false,
  },
  {
    id: "mov-003",
    date: "13 ago.",
    description: "Combustível · JET",
    category: "Sem categoria",
    account: "DGA Administradora de Bens SPE Ltda.",
    paidBy: "—",
    amount: 3276,
    status: "pendente" as const,
    caixa: "cliente" as const,
    reimbursable: false,
  },
  {
    id: "mov-004",
    date: "11 ago.",
    description: "Assinatura Jeppesen",
    category: "Despesas reembolsáveis",
    account: "Share Brasil",
    paidBy: "Share Brasil",
    amount: 1250,
    status: "agendado" as const,
    caixa: "share" as const,
    reimbursable: true,
  },
  {
    id: "mov-005",
    date: "08 ago.",
    description: "Tarifa aeroportuária",
    category: "Taxas aeroportuárias",
    account: "PT-OJG",
    paidBy: "Mauricio",
    amount: 392.5,
    status: "pago" as const,
    caixa: "cliente" as const,
    reimbursable: false,
  },
];

const shareholders = [
  { id: "cot-001", name: "DGA Administradora", aircraft: "PT-OJG", hours: 18.4, balance: 12450, utilization: 74, status: "regular" as const },
  { id: "cot-002", name: "Dejalmo Ribeiro", aircraft: "PR-SBR", hours: 11.2, balance: -1830, utilization: 48, status: "atencao" as const },
  { id: "cot-003", name: "Mauricio Almeida", aircraft: "PT-OJG", hours: 8.7, balance: 3260, utilization: 35, status: "regular" as const },
  { id: "cot-004", name: "Gerson Duarte", aircraft: "PT-OJG", hours: 4.2, balance: -6420, utilization: 19, status: "inadimplente" as const },
];

router.get("/dashboard/summary", (req, res) => {
  const query = GetDashboardSummaryQueryParams.parse(req.query);
  res.json(GetDashboardSummaryResponse.parse(dashboardData[query.departamento]));
});

router.get("/financeiro/movimentacoes", (req, res) => {
  const query = GetFinancialMovementsQueryParams.parse(req.query);
  const filtered = query.caixa ? movements.filter((movement) => movement.caixa === query.caixa) : movements;
  res.json(GetFinancialMovementsResponse.parse(filtered.slice(0, query.limite)));
});

router.get("/financeiro/cotistas", (_req, res) => {
  res.json(GetShareholdersResponse.parse(shareholders));
});

export default router;