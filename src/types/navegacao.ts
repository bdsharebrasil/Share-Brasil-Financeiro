import {
  CalendarDays,
  Cake,
  CircleDollarSign,
  Clock3,
  CreditCard,
  GraduationCap,
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
  BriefcaseBusiness,
  NotebookPen,
  Receipt,
  RefreshCw,
  Settings2,
  Wallet,
  Wrench,
  Plane,
  IdCard,
  User,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement, forwardRef, type ComponentType, type SVGProps } from "react";

const URL_ICONE_AGENDA = "https://cdn.builder.io/api/v1/image/assets%2F46aa69654530411793d5011e629d04aa%2F206f0cb63b6d4b2ebfd2582f4461d757?format=webp&width=800&height=1200";

export function IconeAgenda({ size = 18, className }: LucideProps) {
  return createElement("img", { src: URL_ICONE_AGENDA, alt: "", width: size, height: size, className: `shrink-0 object-contain brightness-0 invert ${className ?? ""}` });
}

const BanknoteArrowUp: LucideIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => createElement(
  "svg",
  { ...props, ref, className: `ml-[5px] mr-[5px] pl-[3px] pr-[3px] ${props.className ?? ""}`, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  createElement("rect", { width: 20, height: 12, x: 2, y: 6, rx: 2 }),
  createElement("circle", { cx: 12, cy: 12, r: 2 }),
  createElement("path", { d: "M6 12h.01M18 12h.01" }),
  createElement("path", { d: "M12 2v4M9 5l3-3 3 3" }),
));

export type Ambiente = "gestor" | "operacoes" | "financeiro" | "share-brasil" | "portal";
export type Tema = "dark" | "light";

export const PONTO_ATIVO_EVENTO = "share-brasil:ponto-status";
export const PONTO_ATIVO_STORAGE = "share-brasil:ponto-ativo";

export type ItemMenu = {
  id: string;
  label: string;
  icon: ComponentType<LucideProps>;
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
    { id: "overview", label: "VISÃO GERAL", icon: LayoutDashboard },
    { id: "agendamentos", label: "AGENDAMENTOS", icon: CalendarDays, badge: "4" },
    { id: "plano-de-voo", label: "PLANO DE VOO", icon: FileText },
    { id: "diario-de-bordo", label: "DIÁRIO DE BORDO", icon: NotebookPen },
    { id: "tripulacao", label: "GESTÃO TRIPULAÇÃO", icon: Users },
    { id: "abastecimentos", label: "ABASTECIMENTOS", icon: Fuel },
    { id: "ctm", label: "CTM", icon: Wrench },
    { id: "recados", label: "RECADOS", icon: MessageSquare },
  ],
  financeiro: [
    { id: "overview", label: "VISÃO GERAL", icon: LayoutDashboard },
    { id: "recibos", label: "EMISSÃO DE RECIBO", icon: Receipt, badge: "8" },
    { id: "despesas", label: "RELATÓRIO DE DESPESA DE VIAGEM", icon: FileBarChart },
    { id: "enviar-pagamento", label: "ENVIAR PAGAMENTO", icon: Send },
    { id: "pagamentos", label: "PROGRAMAÇÃO DE PAGAMENTO", icon: CreditCard, badge: "5" },
    { id: "email", label: "E-MAIL", icon: Mail },
    { id: "recados", label: "RECADOS", icon: MessageSquare },
  ],
  "share-brasil": [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "aniversarios", label: "Aniversários", icon: Cake },
    { id: "aeronaves", label: "Aeronaves", icon: Plane },
    { id: "centro-treinamento", label: "CENTRO TREINAMENTO", icon: GraduationCap },
    { id: "ponto", label: "Ponto e jornada", icon: Clock3 },
    { id: "documentos", label: "Documentos", icon: Folder },
    { id: "senhas", label: "Senhas", icon: KeyRound },
    { id: "tarefas", label: "Tarefas", icon: ListTodo },
    { id: "contatos-clientes", label: "AGENDA", icon: IconeAgenda },
    { id: "cotistas", label: "COTISTAS", icon: User },
    { id: "hoteis", label: "Hotéis", icon: Building2 },
  ],
  gestor: [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "gestor", label: "Gestor", icon: BriefcaseBusiness },
    { id: "financeiro-cotista", label: "Financeiro Cotista", icon: Receipt },
    { id: "gestao-ponto", label: "Gestão de Ponto", icon: Clock3 },
    { id: "gestao-colaborador", label: "Gestão Colaborador", icon: IdCard },
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

