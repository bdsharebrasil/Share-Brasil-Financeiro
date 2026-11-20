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
      tone: "border-cyan-500/50 bg-cyan-500/20 text-cyan-900 dark:text-cyan-300",
    },
    {
      menu: "cotistas",
      label: "COTISTAS",
      icon: User,
      tone: "border-emerald-500/50 bg-[rgba(133,236,181,1)] text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
    },
    {
      menu: "aeronaves",
      label: "AERONAVES",
      icon: Plane,
      tone: "border-cyan-500/50 bg-cyan-500/20 text-[rgba(188,215,224,1)] dark:text-cyan-300",
    },
    {
      menu: "documentos",
      label: "DOCUMENTOS",
      icon: Folder,
      tone: "border-sky-500/50 bg-sky-500/20 text-[rgba(101,155,187,1)] dark:text-sky-300",
    },
    {
      menu: "senhas",
      label: "SENHAS",
      icon: KeyRound,
      tone: "border-violet-500/50 bg-[rgba(129,97,172,1)] text-[rgba(14,11,19,1)] dark:bg-violet-500/20 dark:text-violet-300",
      fundo: "bg-[rgba(234,240,240,1)] dark:bg-card/65",
    },
    {
      menu: "aniversarios",
      label: "ANIVERSÁRIOS",
      icon: Cake,
      tone: "border-[rgba(236,221,72,0.5)] bg-[rgba(250,160,42,0.49)] text-[rgba(248,255,152,1)] dark:border-pink-500/50 dark:bg-pink-500/20 dark:text-pink-300",
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
    {
      menu: "apps-share-brasil",
      label: "APPs SHARE BRASIL",
      icon: Grid2X2,
      tone: "border-violet-500/50 bg-violet-500/20 text-violet-900 dark:text-violet-300",
    },
  ],
};
