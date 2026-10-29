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
  detail: string;
  icon: LucideIcon;
  tone: string;
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
      menu: "aniversarios",
      label: "Aniversários",
      detail: "Datas comemorativas",
      icon: Cake,
      tone: "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    },
    {
      menu: "documentos",
      label: "Documentos",
      detail: "Pastas internas",
      icon: Folder,
      tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      menu: "senhas",
      label: "Senhas",
      detail: "Cofre corporativo",
      icon: KeyRound,
      tone: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    },
    {
      menu: "contatos-clientes",
      label: "Agenda cotistas",
      detail: "Relacionamento",
      icon: Users,
      tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
    {
      menu: "hoteis",
      label: "Hotéis",
      detail: "Reservas e contatos",
      icon: Building2,
      tone: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      menu: "aeronaves",
      label: "Aeronaves",
      detail: "Frota Share Brasil",
      icon: Plane,
      tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
  ],
  "minha-central": [
    {
      menu: "tarefas",
      label: "Tarefas",
      detail: "Kanban e agenda",
      icon: ListTodo,
      tone: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      menu: "ponto",
      label: "Ponto",
      detail: "Registro e histórico da jornada",
      icon: Clock3,
      tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      menu: "centro-treinamento",
      label: "Centro de treinamento",
      detail: "Salas e materiais",
      icon: GraduationCap,
      tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
  ],
};
