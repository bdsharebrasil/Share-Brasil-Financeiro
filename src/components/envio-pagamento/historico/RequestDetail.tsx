import type { ReactNode } from "react";
import { CheckCircle2, Clock3, FileText, Mail, Send, UserRound, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnvioPagamento } from "@/lib/colaborador-api";
import { chaveStatus, estaPendente, formatarData, formatarDataHora, formatarMoeda } from "./status";
import { StatusBadge } from "./StatusBadge";

type RequestDetailProps = {
  envio: EnvioPagamento;
  rotulo: string;
  onClose: () => void;
  restaurando: boolean;
  convertendo: boolean;
  onAbrirPendente: (envio: EnvioPagamento) => void;
  onRecuperarConversao: (envio: EnvioPagamento) => void;
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-[11px] font-bold text-foreground">{value}</p>
    </div>
  );
}

function TimelineItem({ icon, title, detail, tone = "neutral" }: { icon: ReactNode; title: string; detail: string; tone?: "neutral" | "ok" | "bad" }) {
  const classes =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300"
      : tone === "bad"
        ? "border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-300"
        : "border-border bg-secondary text-muted-foreground";

  return (
    <li className="group relative flex gap-3 pb-4 last:pb-0">
      <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${classes}`}>{icon}</span>
      <span className="absolute bottom-0 left-[13.5px] top-8 w-px bg-border group-last:hidden" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}

export function RequestDetail({ envio, rotulo, onClose, restaurando, convertendo, onAbrirPendente, onRecuperarConversao }: RequestDetailProps) {
  const chave = chaveStatus(envio.status);
  const podeRetomar = estaPendente(envio.status);
  const podeCriarRateio = envio.tipo === "cliente" && chave === "email_enviado" && !envio.lancamento_id;

  return (
    <article className="flex flex-col gap-5 rounded-sm border border-border bg-card/60 p-5">
      <header className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">{rotulo}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={envio.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhe"
              className="rounded-sm p-1 text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h2 className="text-sm font-bold leading-snug text-foreground">{envio.descricao}</h2>
        <p className="text-[10px] text-muted-foreground">{envio.fornecedor || "Sem fornecedor"}</p>
        <p className="pt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{formatarMoeda(Number(envio.valor))}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Criado em" value={formatarDataHora(envio.criado_em)} />
        <InfoItem label="Responsável" value={envio.criado_por || "Não informado"} />
        <InfoItem label="Data da despesa" value={formatarData(envio.data_despesa)} />
        <InfoItem label="Vencimento" value={formatarData(envio.vencimento)} />
        <InfoItem label="Voo" value={envio.numero_voo || "Sem voo"} />
        <InfoItem label="Centro de custo" value={envio.centro_custo || "Não informado"} />
      </div>

      {envio.observacoes ? (
        <div className="rounded-sm border border-border bg-background/60 p-3">
          <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Observações</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{envio.observacoes}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Trilha da programação</p>
        <ol className="relative">
          <TimelineItem
            icon={<UserRound className="h-3.5 w-3.5" />}
            title="Programação criada"
            detail={`${envio.criado_por || "Responsável não informado"} · ${formatarDataHora(envio.criado_em)}`}
          />
          {envio.email_solicitado ? (
            <TimelineItem
              icon={<Mail className="h-3.5 w-3.5" />}
              title="E-mail solicitado"
              detail={envio.email_enviado ? "E-mail enviado aos destinatários" : "Aguardando envio do e-mail"}
              tone={envio.email_enviado ? "ok" : "neutral"}
            />
          ) : null}
          {envio.tipo === "share" ? (
            <TimelineItem
              icon={<Send className="h-3.5 w-3.5" />}
              title="Enviada ao caixa Share"
              detail="Registro criado no fluxo financeiro da Share"
            />
          ) : null}
          {envio.lancamento_id || chave === "convertido" ? (
            <TimelineItem
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              title="Lançamento convertido"
              detail="Despesa registrada nas movimentações"
              tone="ok"
            />
          ) : null}
          {estaPendente(envio.status) ? (
            <TimelineItem
              icon={<Clock3 className="h-3.5 w-3.5" />}
              title="Aguardando pagamento"
              detail={`Vencimento em ${formatarData(envio.vencimento)}`}
            />
          ) : null}
          {chave === "pago" ? (
            <TimelineItem icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Pagamento concluído" detail="Pagamento registrado" tone="ok" />
          ) : null}
          {chave === "cancelado" ? (
            <TimelineItem
              icon={<XCircle className="h-3.5 w-3.5" />}
              title="Programação cancelada"
              detail={envio.observacoes ?? "Cancelada pelo financeiro"}
              tone="bad"
            />
          ) : null}
        </ol>
      </div>

      {podeRetomar || podeCriarRateio ? (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {podeRetomar ? (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-2 rounded-sm px-3 text-[10px]" disabled={restaurando} onClick={() => onAbrirPendente(envio)}>
              <FileText className="h-3 w-3" /> {restaurando ? "Abrindo envio…" : "Abrir envio pendente"}
            </Button>
          ) : null}
          {podeCriarRateio ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-sm px-3 text-[10px]" disabled={convertendo} onClick={() => onRecuperarConversao(envio)}>
              {convertendo ? "Criando rateio…" : "Criar rateio da despesa"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
