import type React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

interface CampoFormularioProps {
  id?: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CampoFormulario({
  id,
  rotulo,
  dica,
  erro,
  obrigatorio = false,
  children,
  className = "",
}: CampoFormularioProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {rotulo}
        {obrigatorio ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <div className="mt-1.5">{children}</div>
      {erro ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      ) : dica ? (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{dica}</p>
      ) : null}
    </div>
  );
}
