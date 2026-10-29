import { rotuloStatus, statusEnvio, chaveStatus } from "./status";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const classe = statusEnvio[chaveStatus(status)]?.className ?? "bg-secondary text-muted-foreground";
  return <span className={`shrink-0 rounded-sm px-2 py-1 text-[9px] font-bold ${classe}`}>{rotuloStatus(status)}</span>;
}
