import {
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
      label: "Agenda cotistas",
      icon: Users,
      tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
    {
      menu: "aeronaves",
      label: "Aeronaves",
      icon: Plane,
      tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
    {
      menu: "documentos",
      label: "Documentos",
      icon: Folder,
      tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      menu: "senhas",
      label: "Senhas",
      icon: KeyRound,
      tone: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      fundo: "bg-[rgba(234,240,240,1)]",
    },
    {
      menu: "hoteis",
      label: "Hotéis",
      icon: Building2,
      tone: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      menu: "aniversarios",
      label: "Aniversários",
      icon: Cake,
      tone: "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    },
  ],
  "minha-central": [
    {
      menu: "tarefas",
      label: "Tarefas",
      icon: ListTodo,
      tone: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      menu: "ponto",
      label: "Ponto",
      icon: Clock3,
      tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      menu: "centro-treinamento",
      label: "Centro de treinamento",
      icon: GraduationCap,
      tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
  ],
};
