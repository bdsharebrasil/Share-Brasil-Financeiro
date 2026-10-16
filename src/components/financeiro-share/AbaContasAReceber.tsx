import { useMemo, useState } from "react";
import { CheckCircle2, FileText, HandCoins, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/financeiro-design/SectionCard";
import { StatusBadge } from "@/components/financeiro-design/StatusBadge";
import { formatarBRL, formatarData, hojeISO } from "@/components/financeiro-design/lancamento-tabela";
import { useContasAReceber } from "@/hooks/useContasAReceber";
import { alterarStatusLancamento, editarLancamento } from "@/lib/financeiro-share-api";
import { ModalContaAReceber } from "./ModalContaAReceber";
import type { ContaAReceber } from "./tipos";

const QUITADOS = ["RECEBIDO", "CANCELADO"];

function diasEmAtraso(vencimento: string, hoje: string) {
  const ms = new Date(`${hoje}T12:00:00`).getTime() - new Date(`${vencimento.slice(0, 10)}T12:00:00`).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "?";
}

export function AbaContasAReceber() {
  const { contas, carregando, erro, darBaixa, recarregar } = useContasAReceber({});
  const [filtroStatus, setFiltroStatus] = useState("PENDENTES");
  const [busca, setBusca] = useState("");
  const [contaSelecionada, setContaSelecionada] = useState<ContaAReceber | null>(null);
  const [documento, setDocumento] = useState<string | null>(null);

  const hoje = hojeISO();
  const pendentes = useMemo(() => contas.filter((conta) => !QUITADOS.includes(conta.status)), [contas]);
  const total = pendentes.reduce((soma, conta) => soma + conta.valor, 0);
  const atrasadas = pendentes.filter((conta) => diasEmAtraso(conta.dataVencimento, hoje) > 0);

  const visiveis = useMemo(() => contas.filter((conta) => {
    const passaStatus = filtroStatus === "PENDENTES"
      ? !QUITADOS.includes(conta.status)
      : filtroStatus === "TODOS" || conta.status === filtroStatus;
    const texto = `${conta.descricao ?? ""} ${conta.cotistaNome ?? ""} ${conta.fornecedor ?? ""} ${conta.documento ?? ""}`.toLowerCase();
    return passaStatus && (!busca || texto.includes(busca.toLowerCase()));
  }), [busca, contas, filtroStatus]);

  async function editar(conta: ContaAReceber) {
    const descricao = window.prompt("Descrição do recebimento", conta.descricao ?? "");
    if (!descricao?.trim() || descricao.trim() === conta.descricao) return;
    try {
      await editarLancamento(conta.lancamentoId ?? conta.id, { descricao: descricao.trim() });
      await recarregar();
      toast.success("Recebimento atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível editar o recebimento.");
    }
  }

  async function cancelar(conta: ContaAReceber) {
    if (!window.confirm("Cancelar este recebimento? O registro permanecerá no histórico.")) return;
    try {
      await alterarStatusLancamento(conta.lancamentoId ?? conta.id, "CANCELADO");
      await recarregar();
      toast.success("Recebimento cancelado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o recebimento.");
    }
  }

  return (
    <div className="space-y-4">
      {erro && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{erro}</div>}

      <SectionCard
        titulo="Contas a receber dos cotistas"
        descricao={`${pendentes.length} títulos · ${formatarBRL(total)} · ${atrasadas.length} em atraso`}
        Icon={HandCoins}
        acoes={
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cotista, descrição ou documento"
              className="h-9 rounded-md border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTES">Pendentes</SelectItem>
                <SelectItem value="TODOS">Todos os status</SelectItem>
                <SelectItem value="EM_ABERTO">Em aberto</SelectItem>
                <SelectItem value="ATRASADO">Atrasado</SelectItem>
                <SelectItem value="RECEBIDO">Recebido</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        semPadding
      >
        {carregando ? (
          <p className="px-5 py-14 text-center text-sm text-muted-foreground">Carregando contas…</p>
        ) : visiveis.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-muted-foreground">
            {filtroStatus === "PENDENTES" && !busca
              ? "Nenhum título a receber. Todos os cotistas estão em dia."
              : "Nenhuma conta encontrada."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((conta) => {
              const nome = conta.cotistaNome || conta.fornecedor || conta.descricao || "Recebimento";
              const descricao = conta.descricao || conta.categoriaNome || "Recebimento";
              const dias = QUITADOS.includes(conta.status) ? 0 : diasEmAtraso(conta.dataVencimento, hoje);
              const quitado = QUITADOS.includes(conta.status);
              return (
                <li key={conta.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className={dias > 0 ? "bg-red-500/10 text-xs text-red-700 dark:text-red-300" : "bg-primary/10 text-xs text-primary"}>
                      {iniciais(nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-card-foreground">{nome}</p>
                      {conta.documento && <Badge variant="outline" className="font-mono text-[10px]">{conta.documento}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {descricao} · venc. {formatarData(conta.dataVencimento)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-card-foreground">{formatarBRL(conta.valor)}</p>
                    <p className={`text-xs ${dias > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {dias > 0 ? `${dias} dias em atraso` : "No prazo"}
                    </p>
                  </div>
                  <StatusBadge status={conta.status} />
                  <div className="flex items-center gap-1">
                    {conta.documentoUrl && (
                      <Button variant="ghost" size="icon" aria-label="Ver documento" onClick={() => setDocumento(conta.documentoUrl)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {!quitado && (
                      <>
                        <Button variant="ghost" size="icon" aria-label="Editar recebimento" onClick={() => void editar(conta)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Cancelar recebimento" onClick={() => void cancelar(conta)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => setContaSelecionada(conta)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Dar Baixa
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total a receber</span>
          <span className="text-base font-bold text-card-foreground">{formatarBRL(total)}</span>
        </div>
      </SectionCard>

      {contaSelecionada && (
        <ModalContaAReceber
          conta={contaSelecionada}
          aberto
          onFechar={() => setContaSelecionada(null)}
          onConfirmar={async (dados) => {
            await darBaixa(contaSelecionada.id, dados);
            toast.success("Recebimento registrado", {
              description: `${contaSelecionada.cotistaNome || contaSelecionada.descricao || "Conta"} · ${formatarBRL(contaSelecionada.valor)}`,
            });
            setContaSelecionada(null);
          }}
        />
      )}

      {documento && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDocumento(null)}>
          <div className="h-[85vh] w-full max-w-5xl rounded-xl bg-background p-3" onClick={(e) => e.stopPropagation()}>
            <iframe title="Documento vinculado" src={documento} className="h-full w-full rounded-lg border border-border" />
          </div>
        </div>
      )}
    </div>
  );
}
