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

export function SeletorContatoEmail({
  contatos,
  busca,
  emailSelecionado,
  onBusca,
  onSelecionar,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={busca}
          onChange={(event) => onBusca(event.target.value)}
          placeholder="Buscar cliente, sócio ou e-mail"
          className="h-9 rounded-xl pl-9 text-xs"
          aria-label="Buscar destinatário"
        />
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {contatos.length === 0 ? (
          <p className="border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground rounded-xl">
            Nenhum contato encontrado. Digite abaixo.
          </p>
        ) : (
          contatos.map((contato) => {
            const ativo =
              contato.email.toLowerCase() === emailSelecionado.toLowerCase();
            return (
              <button
                key={`${contato.tipo}-${contato.id}-${contato.email}`}
                type="button"
                onClick={() => onSelecionar(contato)}
                className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  ativo
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-card/30 hover:bg-muted/50"
                }`}
                aria-pressed={ativo}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-primary">
                  {contato.tipo === "cliente" ? (
                    <UserRound size={13} />
                  ) : (
                    <Mail size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold">
                    {contato.nome}
                  </strong>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {contato.email}
                  </span>
                </span>
                {ativo && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}