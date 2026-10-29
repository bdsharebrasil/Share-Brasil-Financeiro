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
      icon: Cake,
    },
    {
      menu: "documentos",
      label: "Documentos",
      icon: Folder,
    },
    {
      menu: "senhas",
      label: "Senhas",
      icon: KeyRound,
    },
    {
      menu: "contatos-clientes",
      label: "Agenda cotistas",
      icon: Users,
    },
    {
      menu: "hoteis",
      label: "Hotéis",
      icon: Building2,
    },
    {
      menu: "aeronaves",
      label: "Aeronaves",
      icon: Plane,
    },
  ],
  "minha-central": [
    {
      menu: "tarefas",
      label: "Tarefas",
      icon: ListTodo,
    },
    {
      menu: "ponto",
      label: "Ponto",
      icon: Clock3,
    },
    {
      menu: "centro-treinamento",
      label: "Centro de treinamento",
      icon: GraduationCap,
    },
  ],
};
