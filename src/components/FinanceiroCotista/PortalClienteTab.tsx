import { useCallback, useEffect, useState } from "react";
import { Building2, CircleAlert, Copy, KeyRound, Loader2, Mail, RefreshCw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buscarAcessosPortalCliente,
  criarAcessoPortalCliente,
  enviarAcessoPortalCliente,
  type AcessoPortalCliente,
} from "@/lib/financeiro-share-api";

type Props = { aeronaveId: string };
type CredenciaisTemporarias = { nome: string; login: string; senha: string };

export function PortalClienteTab({ aeronaveId }: Props) {
  const [cotistas, setCotistas] = useState<AcessoPortalCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [credenciaisTemporarias, setCredenciaisTemporarias] = useState<CredenciaisTemporarias | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await buscarAcessosPortalCliente(aeronaveId);
      setCotistas(resposta.cotistas || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os acessos do Portal Cliente.");
    } finally {
      setCarregando(false);
    }
  }, [aeronaveId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const criarAcesso = async (cotista: AcessoPortalCliente) => {
    setProcessando(cotista.cotista_aeronave_id);
    try {
      const resultado = await criarAcessoPortalCliente(cotista.cotista_aeronave_id);
      setCredenciaisTemporarias({ nome: cotista.nome, login: resultado.login, senha: resultado.senha_temporaria });
      toast.success("Acesso criado. Copie a senha temporária antes de fechar esta janela.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o acesso.");
    } finally {
      setProcessando(null);
    }
  };

  const enviarAcesso = async (cotista: AcessoPortalCliente) => {
    setProcessando(cotista.cotista_aeronave_id);
    try {
      const resultado = await enviarAcessoPortalCliente(cotista.cotista_aeronave_id);
      setCredenciaisTemporarias(null);
      toast.success(`Senha temporária enviada para ${resultado.destinatario}.`);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o acesso por e-mail.");
    } finally {
      setProcessando(null);
    }
  };

  const copiarCredenciais = async () => {
    if (!credenciaisTemporarias) return;
    try {
      await navigator.clipboard.writeText(`Login: ${credenciaisTemporarias.login}\nSenha temporária: ${credenciaisTemporarias.senha}`);
      toast.success("Login e senha temporária copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie os dados manualmente.");
    }
  };

  return (
    <section className="financeiro-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="financeiro-eyebrow">ACESSO AO PORTAL DO CLIENTE</p>
          <h3 className="mt-1 text-base font-bold">Portal Cliente</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Logins vinculados aos cotistas desta aeronave. As senhas existentes são armazenadas como hash e não podem ser reveladas; você pode gerar uma senha temporária e enviá-la ao e-mail cadastrado.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void carregar()} disabled={carregando || Boolean(processando)} className="h-9 shrink-0 gap-2 text-xs">
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {erro && (
        <div role="alert" className="m-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <CircleAlert size={17} className="mt-0.5 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1"><p className="font-semibold">Não foi possível carregar os acessos.</p><p className="mt-1 break-words text-xs text-muted-foreground">{erro}</p></div>
          <Button type="button" variant="outline" onClick={() => void carregar()} className="h-8 shrink-0 text-xs">Tentar novamente</Button>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground"><Loader2 size={17} className="animate-spin" /> Carregando cotistas…</div>
      ) : erro ? null : cotistas.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum cotista cadastrado para esta aeronave.</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Login do portal</th><th className="px-4 py-3">Acesso</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
              <tbody>{cotistas.map((cotista) => {
                const existe = Boolean(cotista.possui_acesso);
                const ocupado = processando === cotista.cotista_aeronave_id;
                return <tr key={cotista.cotista_aeronave_id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3"><p className="text-xs font-semibold">{cotista.nome}</p><p className="mt-1 text-[10px] text-muted-foreground">{cotista.codigo_cliente || "Cotista"}{cotista.percentual_sociedade != null ? ` · ${cotista.percentual_sociedade}%` : ""}</p></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{cotista.email || "E-mail não cadastrado"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{cotista.login || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${existe ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{existe ? "Ativo" : "Não criado"}</span></td>
                  <td className="px-4 py-3 text-right">{existe ? <Button type="button" variant="outline" size="sm" disabled={Boolean(processando) || !cotista.email} onClick={() => void enviarAcesso(cotista)} title={!cotista.email ? "Cadastre um e-mail para enviar o acesso" : "Gerar e enviar uma nova senha temporária"} className="h-8 gap-1.5 text-[10px]"><Mail size={13} /> Enviar nova senha</Button> : <Button type="button" size="sm" disabled={Boolean(processando) || (!cotista.cliente_id && !cotista.socio_id)} onClick={() => void criarAcesso(cotista)} className="h-8 gap-1.5 text-[10px]">{ocupado ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Criar login e senha</Button>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {cotistas.map((cotista) => {
              const existe = Boolean(cotista.possui_acesso);
              const ocupado = processando === cotista.cotista_aeronave_id;
              return <article key={cotista.cotista_aeronave_id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2"><span className="mt-0.5 text-primary">{cotista.socio_id ? <Building2 size={15} /> : <UserRound size={15} />}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{cotista.nome}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">{cotista.email || "E-mail não cadastrado"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${existe ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{existe ? "Ativo" : "Não criado"}</span></div>
                <p className="mt-3 text-[10px] text-muted-foreground">Login: <span className="font-mono text-foreground">{cotista.login || "—"}</span></p>
                {existe ? <Button type="button" variant="outline" disabled={Boolean(processando) || !cotista.email} onClick={() => void enviarAcesso(cotista)} className="mt-3 h-9 w-full gap-2 text-xs"><Mail size={14} /> Enviar nova senha</Button> : <Button type="button" disabled={Boolean(processando) || (!cotista.cliente_id && !cotista.socio_id)} onClick={() => void criarAcesso(cotista)} className="mt-3 h-9 w-full gap-2 text-xs">{ocupado ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Criar login e senha</Button>}
              </article>;
            })}
          </div>
        </>
      )}

      <Dialog open={Boolean(credenciaisTemporarias)} onOpenChange={(aberto) => { if (!aberto) setCredenciaisTemporarias(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso criado</DialogTitle>
            <DialogDescription>Senha temporária para {credenciaisTemporarias?.nome}. Ela será exibida somente nesta janela; copie-a ou use “Enviar nova senha” para encaminhar uma senha ao e-mail cadastrado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <p><span className="text-muted-foreground">Login:</span> <code className="ml-2 break-all font-mono font-bold">{credenciaisTemporarias?.login}</code></p>
            <p><span className="text-muted-foreground">Senha temporária:</span> <code className="ml-2 break-all font-mono font-bold">{credenciaisTemporarias?.senha}</code></p>
          </div>
          <DialogFooter><Button type="button" onClick={() => void copiarCredenciais()} className="gap-2"><Copy size={14} /> Copiar credenciais</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
