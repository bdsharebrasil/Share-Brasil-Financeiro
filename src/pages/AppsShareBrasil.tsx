import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Grid2X2,
  Loader2,
  Monitor,
  Plane,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/utils";

const aplicativos = [
  {
    nome: "Painel Operacional",
    url: "https://deskboard.share-brasil.com/auth",
    icone: Monitor,
    tom: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-200",
  },
  {
    nome: "Portal do Cliente",
    url: "https://cliente.share-brasil.com/",
    icone: Users,
    tom: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-200",
  },
  {
    nome: "App Tripulação",
    url: "https://tripulacao.share-brasil.com/",
    icone: Plane,
    tom: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/15 dark:text-violet-200",
  },
] as const;

function AplicativoCard({ app }: { app: (typeof aplicativos)[number] }) {
  const [estado, setEstado] = useState<"pronto" | "copiando" | "copiado" | "erro">("pronto");
  const input = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const montado = useRef(true);
  const trava = useRef(false);
  const id = useId();
  const Icone = app.icone;

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (estado === "copiado") botao.current?.focus();
    if (estado === "erro") {
      input.current?.focus();
      input.current?.select();
    }
  }, [estado]);

  async function copiar() {
    if (trava.current) return;
    trava.current = true;
    clearTimeout(timer.current);
    setEstado("copiando");
    let copiado = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(app.url);
        copiado = true;
      }
    } catch {
      // Navegadores que bloqueiam a API podem permitir a cópia por seleção.
    }
    if (!montado.current) { trava.current = false; return; }
    if (!copiado) {
      try { copiado = copyText(app.url); } catch { /* Usa a seleção manual. */ }
    }
    trava.current = false;
    setEstado(copiado ? "copiado" : "erro");
    if (copiado) {
      timer.current = setTimeout(() => setEstado("pronto"), 2500);
    }
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir ${app.nome} em nova aba`}
        className="group flex min-h-60 flex-col items-start p-6 transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className={`flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm transition-transform motion-safe:group-hover:-translate-y-1 ${app.tom}`}>
          <Icone size={30} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{app.nome}</h2>
        <span className="mt-1 text-xs text-muted-foreground">{new URL(app.url).hostname}</span>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          Abrir aplicativo <ArrowUpRight size={16} aria-hidden="true" />
        </span>
      </a>
      <div className="border-t border-border bg-secondary/15 p-4 sm:p-5">
        <label htmlFor={id} className="mb-2 block text-xs font-medium text-muted-foreground">Link para compartilhar</label>
        <input
          ref={input}
          id={id}
          type="url"
          readOnly
          spellCheck={false}
          value={app.url}
          aria-label={`Link de ${app.nome}`}
          aria-describedby={estado === "erro" ? `${id}-erro` : undefined}
          onFocus={(event) => event.currentTarget.select()}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <Button
          ref={botao}
          variant="outline"
          className={`mt-2 w-full gap-2 ${estado === "copiado" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : ""}`}
          disabled={estado === "copiando"}
          aria-label={`Copiar link de ${app.nome}`}
          aria-busy={estado === "copiando" || undefined}
          onClick={() => void copiar()}
        >
          {estado === "copiando" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : estado === "copiado" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {estado === "copiando" ? "Copiando…" : estado === "copiado" ? "Link copiado" : "Copiar link"}
        </Button>
        <span role="status" className="sr-only">{estado === "copiado" ? `Link de ${app.nome} copiado.` : ""}</span>
        {estado === "erro" && <p id={`${id}-erro`} role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">Não foi possível copiar automaticamente. Copie o link selecionado.</p>}
      </div>
    </article>
  );
}

export default function AppsShareBrasil({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <div className="route-enter mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" onClick={aoVoltar} className="gap-2"><ArrowLeft size={15} aria-hidden="true" />Voltar ao painel</Button>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Grid2X2 size={23} aria-hidden="true" /></span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">APPs SHARE BRASIL</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesse e compartilhe nossos aplicativos.</p>
          </div>
        </div>
      </header>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {aplicativos.map((app) => <AplicativoCard key={app.url} app={app} />)}
      </div>
    </div>
  );
}
