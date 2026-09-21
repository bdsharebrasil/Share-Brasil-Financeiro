import MovimentacoesFinanceirasComponent from "@/components/dashboard/financeiro/MovimentacoesFinanceiras";

export default function MovimentacoesFinanceiras({ aoVoltar }: { aoVoltar: () => void }) {
  return <MovimentacoesFinanceirasComponent aoVoltar={aoVoltar} />;
}
