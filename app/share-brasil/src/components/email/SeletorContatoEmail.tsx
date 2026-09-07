import { useState } from "react";
import { Check, Mail, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContatoEmail } from "@/lib/colaborador-api";

type Props = {
  contatos: ContatoEmail[];
  busca: string;
  emailSelecionado: string;
  onBusca: (value: string) => void;
  onSelecionar: (contato: ContatoEmail) => void;
};

export function SeletorContatoEmail({ contatos, busca, emailSelecionado, onBusca, onSelecionar }: Props) {
  const [aberto, setAberto] = useState(false);
  const emailsSelecionados = emailSelecionado.split(";").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const mostrarResultados = aberto && busca.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onFocus={() => setAberto(true)}
            onChange={(event) => { onBusca(event.target.value); setAberto(true); }}
            placeholder="Buscar contato por nome ou e-mail"
            className="h-9 rounded-xl pl-9 text-xs"
            aria-label="Buscar destinatário"
          />
        </div>
        {aberto && <Button type="button" variant="ghost" size="icon" onClick={() => { setAberto(false); onBusca(""); }} className="h-9 w-9 rounded-xl" aria-label="Fechar busca"><X size={14} /></Button>}
      </div>

      {emailsSelecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emailsSelecionados.map((email) => <span key={email} className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] text-primary">{email}</span>)}
        </div>
      )}

      {mostrarResultados && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/50 bg-background/80 p-1.5 shadow-lg">
          {contatos.length === 0 ? (
            <p className="p-3 text-center text-[11px] text-muted-foreground">Nenhum contato encontrado. Você pode digitar o e-mail manualmente abaixo.</p>
          ) : contatos.slice(0, 12).map((contato) => {
            const ativo = emailsSelecionados.includes(contato.email.toLowerCase());
            return (
              <button key={`${contato.tipo}-${contato.id}-${contato.email}`} type="button" onClick={() => onSelecionar(contato)} className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${ativo ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 bg-card/30 hover:bg-muted/50"}`} aria-pressed={ativo}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-primary">{contato.tipo === "cliente" ? <UserRound size={13} /> : <Mail size={13} />}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold">{contato.nome}</strong><span className="block truncate text-[10px] text-muted-foreground">{contato.email}</span></span>
                {ativo && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Busque um contato e selecione. Para incluir mais, use `;` entre os e-mails ou selecione outro contato.</p>
    </div>
  );
}
