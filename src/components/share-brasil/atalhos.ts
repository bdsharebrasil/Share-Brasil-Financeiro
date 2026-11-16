import {
  BadgeCheck,
  Building2,
  Cake,
  Clock3,
  Folder,
  GraduationCap,
  KeyRound,
  ListTodo,
  Plane,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AbaDashboard = "share-brasil" | "minha-central";

export interface AtalhoDashboard {
  menu: string;
  label: string;
  icon: LucideIcon;
  tone: string;
  fundo?: string;
}

export const ABAS_DASHBOARD: ReadonlyArray<{
  id: AbaDashboard;
  label: string;
  detail: string;
}> = [
  {
    id: "share-brasil",
    label: "Share Brasil",
    detail: "Informações, documentos e serviços da empresa em um só lugar.",
  },
  {
    id: "minha-central",
    label: "Minha Central de Trabalho",
    detail: "Acesse suas tarefas, seu ponto e o centro de treinamento.",
  },
];

export const ATALHOS_POR_ABA: Record<
  AbaDashboard,
  ReadonlyArray<AtalhoDashboard>
> = {
  "share-brasil": [
    {
      menu: "contatos-clientes",
      label: "AGENDA",
      icon: Users,
      tone: "border-cyan-500/50 bg-cyan-500/20 text-cyan-900 dark:text-cyan-300",
    },
    {
      menu: "cotistas",
      label: "COTISTAS",
      icon: BadgeCheck,
      tone: "border-emerald-500/50 bg-emerald-500/20 text-emerald-900 dark:text-emerald-300",
    },
    {
      menu: "aeronaves",
      label: "AERONAVES",
      icon: Plane,
      tone: "border-cyan-500/50 bg-cyan-500/20 text-cyan-900 dark:text-cyan-300",
    },
    {
      menu: "documentos",
      label: "DOCUMENTOS",
      icon: Folder,
      tone: "border-sky-500/50 bg-sky-500/20 text-sky-900 dark:text-sky-300",
    },
    {
      menu: "senhas",
      label: "SENHAS",
      icon: KeyRound,
      tone: "border-violet-500/50 bg-violet-500/20 text-violet-900 dark:text-violet-300",
      fundo: "bg-[rgba(234,240,240,1)] dark:bg-card/65",
    },
    {
      menu: "hoteis",
      label: "HOTÉIS",
      icon: Building2,
      tone: "border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-300",
    },
    {
      menu: "aniversarios",
      label: "ANIVERSÁRIOS",
      icon: Cake,
      tone: "border-pink-500/50 bg-pink-500/20 text-pink-900 dark:text-pink-300",
    },
  ],
  "minha-central": [
    {
      menu: "tarefas",
      label: "TAREFAS",
      icon: ListTodo,
      tone: "border-amber-500/50 bg-amber-500/20 text-amber-900 dark:text-amber-300",
    },
    {
      menu: "ponto",
      label: "PONTO",
      icon: Clock3,
      tone: "border-emerald-500/50 bg-emerald-500/20 text-emerald-900 dark:text-emerald-300",
    },
    {
      menu: "centro-treinamento",
      label: "CENTRO DE TREINAMENTO",
      icon: GraduationCap,
      tone: "border-sky-500/50 bg-sky-500/20 text-sky-900 dark:text-sky-300",
    },
  ],
};
