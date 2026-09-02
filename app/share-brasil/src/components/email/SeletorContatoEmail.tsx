import { Check, Mail, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ContatoEmail } from "@/lib/colaborador-api";

type Props = {
  contatos: ContatoEmail[];
  busca: string;
  emailSelecionado: string;
  onBusca: (value: string) => void;
  onSelecionar: (contato: ContatoEmail) => void;
};

export function SeletorContatoEmail({ contatos, busca, emailSelecionado, onBusca, onSelecionar }: Props) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(event) => onBusca(event.target.value)} placeholder="Buscar cliente, sócio ou e-mail" className="campo h-11 pl-9" aria-label="Buscar destinatário" />
      </div>
      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {contatos.length === 0 ? <p className="border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">Nenhum contato encontrado. Você ainda pode digitar um e-mail abaixo.</p> : contatos.map((contato) => {
          const ativo = contato.email.toLowerCase() === emailSelecionado.toLowerCase();
          return <button key={`${contato.tipo}-${contato.id}-${contato.email}`} type="button" onClick={() => onSelecionar(contato)} className={`flex w-full items-center gap-3 border p-3 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/[.08]" : "border-border bg-secondary/[.12] hover:border-primary/35 hover:bg-secondary/25"}`} aria-pressed={ativo}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-secondary/40 text-primary">{contato.tipo === "cliente" ? <UserRound size={15} /> : <Mail size={15} />}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-foreground">{contato.nome}</strong><span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{contato.email}</span><span className="mt-1 block text-[9px] uppercase tracking-[.12em] text-primary/80">{contato.tipo}</span></span>
            {ativo && <Check size={16} className="shrink-0 text-primary" />}
          </button>;
        })}
      </div>
    </div>
  );
}
