import { Link } from 'wouter';
import { ArrowLeft, Radio } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary">
          <Radio size={24} />
        </div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[.2em] text-primary">Sinal não localizado · 404</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-.05em]">Esta rota não está na carta.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">O endereço solicitado não faz parte do centro de comando Share Brasil.</p>
        <Link href="/" data-testid="link-back-dashboard" className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">
          <ArrowLeft size={15} /> Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}