import DashboardGestorResumoComponent from "@/components/dashboard/gestor/DashboardGestorResumo";

export default function DashboardGestorResumo({ aoNavegar }: { aoNavegar: (menu: string, aba?: string) => void }) {
  return <DashboardGestorResumoComponent aoNavegar={aoNavegar} />;
}
