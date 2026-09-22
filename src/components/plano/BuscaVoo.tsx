import { useEffect, useRef, useState, type FormEvent } from "react";

import { formatarData } from "@/lib/format";
import type { SugestaoVoo } from "@/lib/tipos";

interface Props {
  carregando: boolean;
  erro: string | null;
  resumo: string | null;
  sugestoes: SugestaoVoo[];
  aoBuscar: (numeroVoo: string) => void;
}

export function BuscaVoo({ carregando, erro, resumo, sugestoes, aoBuscar }: Props) {
  const [valor, setValor] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (valor.trim()) {
      setAberto(false);
      aoBuscar(valor.trim());
    }
  };

  const escolher = (numero: string) => {
    setValor(numero);
    setAberto(false);
    aoBuscar(numero);
  };

  return (
    <form onSubmit={enviar} className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <label
        htmlFor="numero-voo"
        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Número do voo
      </label>
      <div ref={caixa} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          id="numero-voo"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value.toUpperCase());
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder="EBL-0003/26"
          autoComplete="off"
          className="min-w-0 rounded-lg border border-input bg-background px-4 py-3 font-mono text-xl font-semibold tracking-widest text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <button
          type="submit"
          disabled={carregando}
          className="shrink-0 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {carregando ? "Buscando..." : "Buscar"}
        </button>

        {aberto && sugestoes.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {sugestoes.map((s) => (
              <li key={s.numero_voo}>
                <button
                  type="button"
                  onClick={() => escolher(s.numero_voo)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-background"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-semibold text-foreground">
                      {s.numero_voo}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[s.origem, s.destino].filter(Boolean).join(" → ")}
                      {s.matricula_registro ? ` · ${s.matricula_registro}` : ""}
                      {s.modelo ? ` ${s.modelo}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {s.data_agendada ? formatarData(s.data_agendada) : ""}
                    </span>
                    <span className="block text-[10px] uppercase text-primary">{s.status ?? ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      {resumo && !erro && <p className="mt-3 text-sm text-primary">✓ Voo encontrado · {resumo}</p>}
    </form>
  );
}
