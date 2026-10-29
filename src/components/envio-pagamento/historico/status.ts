import type { EnvioPagamento } from "@/lib/colaborador-api";

export const statusEnvio: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-amber-400/10 text-amber-600 dark:text-amber-300" },
  pago: { label: "Pago", className: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", className: "bg-red-400/10 text-red-700 dark:text-red-300" },
  enviado: { label: "Enviado", className: "bg-sky-400/10 text-sky-700 dark:text-sky-300" },
  email_enviado: { label: "E-mail enviado", className: "bg-sky-400/10 text-sky-700 dark:text-sky-300" },
  email_nao_enviado: { label: "E-mail não enviado", className: "bg-amber-400/10 text-amber-600 dark:text-amber-300" },
  convertido: { label: "Convertido", className: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" },
};

export const STATUS_PENDENTES = ["pendente", "email_pendente", "email_nao_enviado", "aguardando_aprovacao", "aguardando_pagamento"];

export function chaveStatus(status?: string | null) {
  return String(status || "").toLowerCase();
}

export function rotuloStatus(status?: string | null) {
  return statusEnvio[chaveStatus(status)]?.label ?? (status || "Enviado");
}

export function estaPendente(status?: string | null) {
  return STATUS_PENDENTES.includes(chaveStatus(status));
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

export function formatarData(valor?: string | null) {
  return valor ? new Date(`${valor.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";
}

export function formatarDataHora(valor?: string | null) {
  return valor ? new Date(valor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export type TipoEnvio = EnvioPagamento["tipo"];
