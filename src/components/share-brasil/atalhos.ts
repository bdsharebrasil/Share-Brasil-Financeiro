import {
  Cake,
  Clock3,
  Folder,
  GraduationCap,
  Grid2X2,
  KeyRound,
  ListTodo,
  Plane,
  User,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { IconeAgenda } from "@/types/navegacao";

export type AbaDashboard = "share-brasil" | "minha-central";

export interface AtalhoDashboard {
  menu: string;
  label: string;
  icon: ComponentType<LucideProps>;
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
      label: "CONTATOS",
      icon: IconeAgenda,
      tone: "border-cyan-600/35 bg-cyan-50 text-cyan-700 dark:border-cyan-500/50 dark:bg-cyan-500/20 dark:text-cyan-300",
    },
    {
      menu: "cotistas",
      label: "COTISTAS",
      icon: User,
      tone: "border-emerald-600/35 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
    {
      menu: "aeronaves",
      label: "AERONAVES",
      icon: Plane,
      tone: "border-sky-600/35 bg-sky-50 text-sky-700 dark:border-cyan-500/50 dark:bg-cyan-500/20 dark:text-cyan-300",
    },
    {
      menu: "documentos",
      label: "DOCUMENTOS",
      icon: Folder,
      tone: "border-sky-600/35 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/20 dark:text-sky-300",
    },
    {
      menu: "senhas",
      label: "SENHAS",
      icon: KeyRound,
      tone: "border-violet-600/35 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/20 dark:text-violet-300",
    },
    {
      menu: "aniversarios",
      label: "ANIVERSÁRIOS",
      icon: Cake,
      tone: "border-pink-600/35 bg-pink-50 text-pink-700 dark:border-pink-500/50 dark:bg-pink-500/20 dark:text-pink-300",
    },
  ],
  "minha-central": [
    {
      menu: "tarefas",
      label: "TAREFAS",
      icon: ListTodo,
      tone: "border-amber-600/35 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300",
    },
    {
      menu: "ponto",
      label: "PONTO",
      icon: Clock3,
      tone: "border-emerald-600/35 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
    {
      menu: "centro-treinamento",
      label: "CENTRO DE TREINAMENTO",
      icon: GraduationCap,
      tone: "border-sky-600/35 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/20 dark:text-sky-300",
    },
    {
      menu: "apps-share-brasil",
      label: "APPs SHARE BRASIL",
      icon: Grid2X2,
      tone: "border-violet-600/35 bg-violet-50 text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/20 dark:text-violet-300",
    },
  ],
};
