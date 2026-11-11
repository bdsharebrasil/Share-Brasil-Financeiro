import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, CircleAlert, Copy, KeyRound, Loader2, Mail, Pencil, RefreshCw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  atualizarCredenciaisPortalCliente,
  enviarAcessoPortalCliente,
  type AcessoPortalCliente,
} from "@/lib/financeiro-share-api";

type Props = { aeronaveId: string };
type CredenciaisCriadas = { nome: string; login: string; senha: string };

export function PortalClienteTab({ aeronaveId }: Props) {
  const [cotistas, setCotistas] = useState<AcessoPortalCliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [credenciaisCriadas, setCredenciaisCriadas] = useState<CredenciaisCriadas | null>(null);
  const [cotistaCriando, setCotistaCriando] = useState<AcessoPortalCliente | null>(null);
  const [senhaCriacao, setSenhaCriacao] = useState("");
  const [enviarAoCriar, setEnviarAoCriar] = useState(false);
  const [emailAoCriar, setEmailAoCriar] = useState("");
  const [cotistaEnviando, setCotistaEnviando] = useState<AcessoPortalCliente | null>(null);
  const [senhaParaEnvio, setSenhaParaEnvio] = useState("");
  const [emailDestinatario, setEmailDestinatario] = useState("");
  const [cotistaEditando, setCotistaEditando] = useState<AcessoPortalCliente | null>(null);
  const [loginEditado, setLoginEditado] = useState("");
  const [senhaNova, setSenhaNova] = useState("");

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

  const abrirCriacao = (cotista: AcessoPortalCliente) => {
    setSenhaCriacao("");
    setEnviarAoCriar(false);
    setEmailAoCriar("");
    setCotistaCriando(cotista);
  };

  const criarAcesso = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cotistaCriando) return;
    const cotista = cotistaCriando;
    setProcessando(cotista.cotista_aeronave_id);
    try {
      const resultado = await criarAcessoPortalCliente(cotista.cotista_aeronave_id, senhaCriacao);
      setCredenciaisCriadas({ nome: cotista.nome, login: resultado.login, senha: senhaCriacao });
      setCotistaCriando(null);
      toast.success("Acesso criado. Copie a senha ou envie-a por e-mail, se desejar.");
      if (enviarAoCriar) {
        try {
          const enviado = await enviarAcessoPortalCliente(cotista.cotista_aeronave_id, { senha: senhaCriacao, destinatario: emailAoCriar.trim() });
          toast.success(`Senha enviada para ${enviado.destinatario}.`);
        } catch (error) {
          toast.error(`Acesso criado, mas o e-mail não foi enviado: ${error instanceof Error ? error.message : "verifique o destinatário e tente novamente."}`);
        }
      }
      setSenhaCriacao("");
      setEnviarAoCriar(false);
      setEmailAoCriar("");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o acesso.");
    } finally {
      setProcessando(null);
    }
  };

  const abrirEnvio = (cotista: AcessoPortalCliente) => {
    setSenhaParaEnvio("");
    setEmailDestinatario("");
    setCotistaEnviando(cotista);
  };

  const enviarAcesso = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cotistaEnviando) return;
    setProcessando(cotistaEnviando.cotista_aeronave_id);
    try {
      const resultado = await enviarAcessoPortalCliente(cotistaEnviando.cotista_aeronave_id, {
        senha: senhaParaEnvio,
        destinatario: emailDestinatario.trim(),
      });
      toast.success(`Senha atualizada e enviada para ${resultado.destinatario}.`);
      setCotistaEnviando(null);
      setSenhaParaEnvio("");
      setEmailDestinatario("");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o acesso por e-mail.");
    } finally {
      setProcessando(null);
    }
  };

  const iniciarEdicao = (cotista: AcessoPortalCliente) => {
    setLoginEditado(cotista.login || "");
    setSenhaNova("");
    setCotistaEditando(cotista);
  };

  const salvarCredenciais = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cotistaEditando) return;
    setProcessando(cotistaEditando.cotista_aeronave_id);
    try {
      const resultado = await atualizarCredenciaisPortalCliente(cotistaEditando.cotista_aeronave_id, {
        login: loginEditado.trim(),
        senha: senhaNova,
      });
      toast.success(`Credenciais atualizadas para ${resultado.login}.`);
      setCotistaEditando(null);
      setSenhaNova("");
      await carregar();
    } catch (error) {
      const codigo = error instanceof Error ? error.message : "";
      const mensagens: Record<string, string> = {
        login_ja_em_uso: "Esse login já está sendo usado por outro cotista.",
        login_invalido: "Use de 3 a 80 caracteres: letras, números, ponto, hífen ou sublinhado.",
        senha_deve_ter_entre_1_e_128_caracteres: "Informe uma senha com até 128 caracteres.",
        portal_usuario_alterado_tente_novamente: "As credenciais mudaram em outra sessão. Atualize e tente novamente.",
      };
      toast.error(mensagens[codigo] || "Não foi possível salvar as novas credenciais.");
    } finally {
      setProcessando(null);
    }
  };

  const copiarCredenciais = async () => {
    if (!credenciaisCriadas) return;
    try {
      await navigator.clipboard.writeText(`Login: ${credenciaisCriadas.login}\nSenha: ${credenciaisCriadas.senha}`);
      toast.success("Login e senha copiados.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie os dados manualmente.");
    }
  };

  return (
    <section className="financeiro-panel cotista-portal overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="financeiro-eyebrow">ACESSO AO PORTAL DO CLIENTE</p>
          <h3 className="mt-1 text-base font-bold">Portal Cliente</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Defina a senha do acesso. Não há tamanho mínimo (a senha não pode ficar vazia); o limite técnico é de 128 caracteres. O envio por e-mail é opcional e usa o destinatário informado no momento do envio.
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
            <table className="w-full min-w-[680px] text-left">
              <thead><tr className="border-b border-border text-[9px] font-bold uppercase tracking-[.11em] text-muted-foreground"><th className="px-4 py-3">Cotista</th><th className="px-4 py-3">Login do portal</th><th className="px-4 py-3">Acesso</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
              <tbody>{cotistas.map((cotista) => {
                const existe = Boolean(cotista.possui_acesso);
                const ocupado = processando === cotista.cotista_aeronave_id;
                const acoes = existe ? <>
                  <Button type="button" variant="outline" size="sm" disabled={Boolean(processando)} onClick={() => iniciarEdicao(cotista)} className="h-8 gap-1.5 text-[10px]"><Pencil size={13} /> Editar credenciais</Button>
                  <Button type="button" variant="outline" size="sm" disabled={Boolean(processando)} onClick={() => abrirEnvio(cotista)} title="Definir nova senha e informar o e-mail de destino" className="h-8 gap-1.5 text-[10px]"><Mail size={13} /> Enviar nova senha</Button>
                </> : <Button type="button" size="sm" disabled={Boolean(processando) || (!cotista.cliente_id && !cotista.socio_id)} onClick={() => abrirCriacao(cotista)} className="h-8 gap-1.5 text-[10px]">{ocupado ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Criar login e senha</Button>;
                return <tr key={cotista.cotista_aeronave_id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3"><p className="text-xs font-semibold">{cotista.nome}</p><p className="mt-1 text-[10px] text-muted-foreground">{cotista.codigo_cliente || "Cotista"}{cotista.percentual_sociedade != null ? ` · ${cotista.percentual_sociedade}%` : ""}</p></td>
                  <td className="px-4 py-3 font-mono text-xs">{cotista.login || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${existe ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{existe ? "Ativo" : "Não criado"}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{acoes}</div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {cotistas.map((cotista) => {
              const existe = Boolean(cotista.possui_acesso);
              const ocupado = processando === cotista.cotista_aeronave_id;
              const acoes = existe ? <>
                <Button type="button" variant="outline" size="sm" disabled={Boolean(processando)} onClick={() => iniciarEdicao(cotista)} className="h-8 flex-1 gap-1.5 px-2 text-[10px]"><Pencil size={13} /> Editar</Button>
                <Button type="button" variant="outline" size="sm" disabled={Boolean(processando)} onClick={() => abrirEnvio(cotista)} className="h-8 flex-1 gap-1.5 px-2 text-[10px]"><Mail size={13} /> Enviar senha</Button>
              </> : <Button type="button" size="sm" disabled={Boolean(processando) || (!cotista.cliente_id && !cotista.socio_id)} onClick={() => abrirCriacao(cotista)} className="h-8 w-full gap-1.5 text-[10px]">{ocupado ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} Criar login e senha</Button>;
              return <article key={cotista.cotista_aeronave_id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-2"><span className="mt-0.5 text-primary">{cotista.socio_id ? <Building2 size={15} /> : <UserRound size={15} />}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{cotista.nome}</p><p className="mt-1 text-[10px] text-muted-foreground">{cotista.codigo_cliente || "Cotista"}{cotista.percentual_sociedade != null ? ` · ${cotista.percentual_sociedade}%` : ""}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${existe ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{existe ? "Ativo" : "Não criado"}</span></div>
                <p className="mt-3 text-[10px] text-muted-foreground">Login: <span className="font-mono text-foreground">{cotista.login || "—"}</span></p>
                <div className="mt-3 flex gap-2">{acoes}</div>
              </article>;
            })}
          </div>
        </>
      )}

      <Dialog open={Boolean(cotistaCriando)} onOpenChange={(aberto) => {
        if (!aberto && !processando) { setCotistaCriando(null); setSenhaCriacao(""); setEnviarAoCriar(false); setEmailAoCriar(""); }
      }}>
        <DialogContent className="despesas-theme despesa-dialog">
          <form onSubmit={(event) => void criarAcesso(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Criar acesso ao Portal Cliente</DialogTitle>
              <DialogDescription>Defina a senha para {cotistaCriando?.nome}. Ela será salva como hash e não poderá ser revelada depois de fechar a janela.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="portal-cliente-senha-criacao" className="text-sm font-medium">Senha</label>
              <Input id="portal-cliente-senha-criacao" type="password" autoComplete="new-password" maxLength={128} value={senhaCriacao} onChange={(event) => setSenhaCriacao(event.target.value)} required />
              <p className="text-xs text-muted-foreground">Sem tamanho mínimo; não deixe em branco. Limite técnico: 128 caracteres.</p>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={enviarAoCriar} onChange={(event) => setEnviarAoCriar(event.target.checked)} className="size-4 accent-primary" /> Enviar esta senha por e-mail (opcional)</label>
            {enviarAoCriar && <div className="space-y-2"><label htmlFor="portal-cliente-email-criacao" className="text-sm font-medium">E-mail de destino</label><Input id="portal-cliente-email-criacao" type="email" autoComplete="off" maxLength={254} value={emailAoCriar} onChange={(event) => setEmailAoCriar(event.target.value)} placeholder="destinatario@exemplo.com" required /><p className="text-xs text-muted-foreground">Informe o endereço que receberá a senha; nenhum e-mail cadastrado é usado automaticamente.</p></div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCotistaCriando(null)}>Cancelar</Button>
              <Button type="submit" disabled={Boolean(processando)}>{processando === cotistaCriando?.cotista_aeronave_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Criar acesso</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cotistaEnviando)} onOpenChange={(aberto) => {
        if (!aberto && !processando) { setCotistaEnviando(null); setSenhaParaEnvio(""); setEmailDestinatario(""); }
      }}>
        <DialogContent className="despesas-theme despesa-dialog">
          <form onSubmit={(event) => void enviarAcesso(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Enviar nova senha por e-mail</DialogTitle>
              <DialogDescription>Defina a nova senha de {cotistaEnviando?.nome} e informe o endereço que deve recebê-la. A senha só será alterada se o envio for concluído.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2"><label htmlFor="portal-cliente-senha-envio" className="text-sm font-medium">Nova senha</label><Input id="portal-cliente-senha-envio" type="password" autoComplete="new-password" maxLength={128} value={senhaParaEnvio} onChange={(event) => setSenhaParaEnvio(event.target.value)} required /><p className="text-xs text-muted-foreground">Sem tamanho mínimo; não deixe em branco. Limite técnico: 128 caracteres.</p></div>
            <div className="space-y-2"><label htmlFor="portal-cliente-email-envio" className="text-sm font-medium">E-mail de destino</label><Input id="portal-cliente-email-envio" type="email" autoComplete="off" maxLength={254} value={emailDestinatario} onChange={(event) => setEmailDestinatario(event.target.value)} placeholder="destinatario@exemplo.com" required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCotistaEnviando(null)}>Cancelar</Button>
              <Button type="submit" disabled={Boolean(processando)}>{processando === cotistaEnviando?.cotista_aeronave_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Mail size={14} className="mr-2" />}Enviar senha</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credenciaisCriadas)} onOpenChange={(aberto) => { if (!aberto) setCredenciaisCriadas(null); }}>
        <DialogContent className="despesas-theme despesa-dialog">
          <DialogHeader>
            <DialogTitle>Acesso criado</DialogTitle>
            <DialogDescription>Senha definida para {credenciaisCriadas?.nome}. Ela será exibida somente nesta janela; copie-a agora se precisar guardá-la.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <p><span className="text-muted-foreground">Login:</span> <code className="ml-2 break-all font-mono font-bold">{credenciaisCriadas?.login}</code></p>
            <p><span className="text-muted-foreground">Senha:</span> <code className="ml-2 break-all font-mono font-bold">{credenciaisCriadas?.senha}</code></p>
          </div>
          <DialogFooter><Button type="button" onClick={() => void copiarCredenciais()} className="gap-2"><Copy size={14} /> Copiar credenciais</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cotistaEditando)} onOpenChange={(aberto) => {
        if (!aberto) { setCotistaEditando(null); setSenhaNova(""); }
      }}>
        <DialogContent className="despesas-theme despesa-dialog">
          <form onSubmit={(event) => void salvarCredenciais(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar credenciais do Portal Cliente</DialogTitle>
              <DialogDescription>Defina login e nova senha para {cotistaEditando?.nome}. A senha atual não pode ser revelada; a nova será salva de forma protegida.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="portal-cliente-login" className="text-sm font-medium">Novo login</label>
              <Input id="portal-cliente-login" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={80} pattern="[A-Za-z0-9._-]{3,80}" value={loginEditado} onChange={(event) => setLoginEditado(event.target.value)} required />
              <p className="text-xs text-muted-foreground">3–80 caracteres: letras, números, ponto, hífen ou sublinhado.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="portal-cliente-nova-senha" className="text-sm font-medium">Nova senha</label>
              <Input id="portal-cliente-nova-senha" type="password" autoComplete="new-password" maxLength={128} value={senhaNova} onChange={(event) => setSenhaNova(event.target.value)} required />
              <p className="text-xs text-muted-foreground">Sem tamanho mínimo; não deixe em branco. Limite técnico: 128 caracteres.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCotistaEditando(null)}>Cancelar</Button>
              <Button type="submit" disabled={Boolean(processando)}>{cotistaEditando && processando === cotistaEditando.cotista_aeronave_id ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}Salvar novas credenciais</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
