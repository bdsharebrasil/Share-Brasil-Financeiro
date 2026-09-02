import {
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
  GraduationCap,
  Video,
  BookOpen,
  Building2,
  FileBarChart,
  FileCheck2,
  FileText,
  Send,
  Folder,
  Fuel,
  KeyRound,
  ListTodo,
  LayoutDashboard,
  Mail,
  MessageSquare,
  NotebookPen,
  Receipt,
  RefreshCw,
  Settings2,
  Users,
  WalletCards,
  Wrench,
  ContactRound,
  type LucideIcon,
} from "lucide-react";

export type Ambiente = "gestor" | "operacoes" | "financeiro" | "share-brasil" | "portal";
export type Tema = "dark" | "light";

export const PONTO_ATIVO_EVENTO = "share-brasil:ponto-status";
export const PONTO_ATIVO_STORAGE = "share-brasil:ponto-ativo";

export type ItemMenu = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

export const nomesAmbiente: Record<Ambiente, string> = {
  gestor: "Gestor",
  operacoes: "Operações",
  financeiro: "Financeiro",
  "share-brasil": "Share Brasil",
  portal: "Portal do Cliente",
};

export const descricoesAmbiente: Record<Ambiente, string> = {
  gestor: "Visão executiva e decisões da empresa",
  operacoes: "Controle da operação aérea",
  financeiro: "Rotinas financeiras e administrativas",
  "share-brasil": "Pessoas, documentos e relacionamento corporativo",
  portal: "Consulta de cobranças e documentos",
};

export const menusPorAmbiente: Record<Ambiente, ItemMenu[]> = {
  operacoes: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "agendamentos", label: "Agendamentos", icon: CalendarDays, badge: "4" },
    { id: "plano-de-voo", label: "Plano de voo", icon: FileText },
    { id: "diario-de-bordo", label: "Diário de bordo", icon: NotebookPen },
    { id: "tripulacao", label: "Gestão Tripulação", icon: Users },
    { id: "abastecimentos", label: "Abastecimentos", icon: Fuel },
    { id: "ctm", label: "CTM", icon: Wrench },
    { id: "recados", label: "Recados", icon: MessageSquare },
  ],
  financeiro: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "recibos", label: "Emissão de recibo", icon: Receipt, badge: "8" },
    { id: "despesas", label: "Relatório de despesa de viagem", icon: FileBarChart },
    { id: "enviar-pagamento", label: "Enviar pagamento", icon: Send },
    { id: "pagamentos", label: "Programação de pagamento", icon: CreditCard, badge: "5" },
    { id: "email", label: "E-mail", icon: Mail },
    { id: "ciclo", label: "Ciclo de voo", icon: RefreshCw },
    { id: "recados", label: "Recados", icon: MessageSquare },
  ],
  "share-brasil": [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "centro-treinamento", label: "CENTRO TREINAMENTO", icon: GraduationCap },
    { id: "sala-reuniao", label: "Sala de reunião", icon: Video },
    { id: "tutorial", label: "Tutorial", icon: BookOpen },
    { id: "treinamento", label: "Treinamento", icon: GraduationCap },
    { id: "ponto", label: "Ponto e jornada", icon: Clock3 },
    { id: "documentos", label: "Documentos", icon: Folder },
    { id: "senhas", label: "Senhas", icon: KeyRound },
    { id: "tarefas", label: "Tarefas", icon: ListTodo },
    { id: "contatos-clientes", label: "Contatos", icon: ContactRound },
    { id: "hoteis", label: "Hotéis", icon: Building2 },
  ],
  gestor: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "financeiro-share", label: "Financeiro Share", icon: WalletCards, badge: "3" },
    { id: "financeiro-cotista", label: "Financeiro Cotista", icon: Users },
    { id: "gestao-colaborador", label: "Gestão Colaborador", icon: Users },
    { id: "ferias", label: "Férias", icon: CalendarDays },
    { id: "simulador-custos", label: "Simulador de custos", icon: CircleDollarSign },
    { id: "configuracoes", label: "Configurações", icon: Settings2 },
    { id: "recados", label: "Recados", icon: MessageSquare },
  ],
  portal: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard, badge: "2" },
    { id: "documentos", label: "Documentos", icon: FileCheck2 },
  ],
};

export function menuInicial(ambiente: Ambiente): string {
  return menusPorAmbiente[ambiente][0]?.id ?? "overview";
}
