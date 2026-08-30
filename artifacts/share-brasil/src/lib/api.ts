import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type Department = "operacoes" | "financeiro" | "gestor" | "portal";
export type CashType = "share" | "cliente";

export type HealthStatus = { status: string };
export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "neutral";
};
export type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
};
export type DashboardSummary = {
  departamento: Department;
  greeting: string;
  metrics: DashboardMetric[];
  alerts: AlertItem[];
  period: string;
};
export type FinancialMovement = {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  paidBy: string;
  amount: number;
  status: "pago" | "pendente" | "agendado";
  caixa: CashType;
  reimbursable?: boolean;
};
export type Shareholder = {
  id: string;
  name: string;
  aircraft: string;
  hours: number;
  balance: number;
  utilization: number;
  status: "regular" | "atencao" | "inadimplente";
};

type QueryOptions = { query?: { queryKey?: readonly unknown[] } };

const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!supabase) {
    throw new Error("A autenticação ainda não foi configurada.");
  }

  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `API error (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error || message;
    } catch {
      // Keep the HTTP status when the server does not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const getHealthCheckQueryKey = () => ["health"] as const;
export const getGetDashboardSummaryQueryKey = (params: { departamento: Department }) => ["dashboard", params] as const;
export const getGetFinancialMovementsQueryKey = (params?: { caixa?: CashType; limite?: number }) => ["movimentacoes", params] as const;
export const getGetShareholdersQueryKey = () => ["cotistas"] as const;

export const getHealthCheck = () => request<HealthStatus>("/api/healthz");
export const getDashboardSummary = (params: { departamento: Department }) =>
  request<DashboardSummary>(`/api/dashboard/summary?departamento=${encodeURIComponent(params.departamento)}`);
export const getFinancialMovements = (params: { caixa?: CashType; limite?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.caixa) search.set("caixa", params.caixa);
  if (params.limite !== undefined) search.set("limite", String(params.limite));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request<FinancialMovement[]>(`/api/financeiro/movimentacoes${suffix}`);
};
export const getShareholders = () => request<Shareholder[]>("/api/financeiro/cotistas");

export function useHealthCheck(options?: QueryOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey || getHealthCheckQueryKey(),
    queryFn: getHealthCheck,
  });
}

export function useGetDashboardSummary(params: { departamento: Department }, options?: QueryOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey || getGetDashboardSummaryQueryKey(params),
    queryFn: () => getDashboardSummary(params),
  });
}

export function useGetFinancialMovements(params: { caixa?: CashType; limite?: number } = {}, options?: QueryOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey || getGetFinancialMovementsQueryKey(params),
    queryFn: () => getFinancialMovements(params),
  });
}

export function useGetShareholders(options?: QueryOptions) {
  return useQuery({
    queryKey: options?.query?.queryKey || getGetShareholdersQueryKey(),
    queryFn: getShareholders,
  });
}
