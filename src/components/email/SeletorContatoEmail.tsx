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
    <div className="space-y-2 rounded-xl border border-border bg-card p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onFocus={() => setAberto(true)}
            onChange={(event) => { onBusca(event.target.value); setAberto(true); }}
            placeholder="Buscar contato por nome ou e-mail"
            className="h-10 w-full rounded-xl border-border bg-card pl-9 pr-3 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition-all focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/10"
            aria-label="Buscar destinatário"
          />
        </div>
        {aberto && <Button type="button" variant="ghost" size="icon" onClick={() => { setAberto(false); onBusca(""); }} className="h-10 w-10 shrink-0 rounded-xl border border-border text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Fechar busca"><X size={14} /></Button>}
      </div>

      {emailsSelecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {emailsSelecionados.map((email) => <span key={email} className="rounded-full border border-primary/25 bg-primary/[.08] px-2.5 py-1 text-[10px] font-medium text-primary shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">{email}</span>)}
        </div>
      )}

      {mostrarResultados && (
        <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-[0_18px_38px_rgba(0,0,0,.24)] backdrop-blur-sm">
          {contatos.length === 0 ? (
            <p className="rounded-lg p-4 text-center text-[11px] leading-5 text-muted-foreground">Nenhum contato encontrado. Você pode digitar o e-mail manualmente abaixo.</p>
          ) : contatos.slice(0, 12).map((contato) => {
            const ativo = emailsSelecionados.includes(contato.email.toLowerCase());
            return (
              <button
                key={`${contato.tipo}-${contato.id}-${contato.email}`}
                type="button"
                onClick={() => onSelecionar(contato)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 ${ativo ? "border-primary/55 bg-primary/[.09] shadow-[0_0_0_1px_hsl(var(--primary)/.08)]" : "border-border bg-card hover:border-primary/25 hover:bg-secondary"}`}
                aria-pressed={ativo}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ativo ? "border-primary/25 bg-primary/[.10] text-primary" : "border-border bg-muted/50 text-muted-foreground"}`}>
                  {contato.tipo === "cliente" ? <UserRound size={13} /> : <Mail size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-foreground">{contato.nome}</strong>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{contato.email}</span>
                </span>
                {ativo && <Check size={14} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
      <p className="px-0.5 text-[10px] leading-4 text-muted-foreground">Busque um contato e selecione. Para incluir mais, use `;` entre os e-mails ou selecione outro contato.</p>
    </div>
  );
}
