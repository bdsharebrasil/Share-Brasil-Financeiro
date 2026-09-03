import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarMinhaAssinatura, salvarMinhaAssinatura, type AssinaturaEmail } from "@/lib/colaborador-api";

const padrao: AssinaturaEmail = { nome: "", cargo: "", telefone: "", endereco: "", email: "" };
export default function MinhaAssinaturaEmail({ embedded = false }: { embedded?: boolean }) {
  const [dados, setDados] = useState<AssinaturaEmail>(padrao);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => { void buscarMinhaAssinatura().then((v) => setDados({ ...padrao, ...v, email: "" })).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar assinatura")).finally(() => setBusy(false)); }, []);
  const save = async () => { setErro(""); setOk(""); try { setDados({ ...padrao, ...(await salvarMinhaAssinatura({ nome: dados.nome })), email: "" }); setOk("Nome da assinatura salvo com sucesso."); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar assinatura"); } };
  return <div className={`${embedded ? "" : "route-enter mx-auto max-w-4xl"} space-y-6`}>
    {!embedded && <header><h1 className="text-2xl font-extrabold">Assinatura</h1><p className="mt-1 text-xs text-muted-foreground">O padrão é carregado de departamentos_email; somente o nome pode ser personalizado.</p></header>}
    {(erro || ok) && <div className="flex items-center gap-2 rounded-xl border p-3 text-xs">{erro ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {erro || ok}</div>}
    {busy ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div> : <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-6">
        <div><p className="text-xs font-bold uppercase tracking-wider">Nome exibido</p><p className="mt-1 text-[11px] text-muted-foreground">Este nome fica salvo em user_profiles.email_envio e será usado na assinatura.</p></div>
        <label className="block"><span className="mb-1 block text-xs font-semibold">Nome da assinatura</span><Input value={dados.nome || ""} onChange={(e) => setDados((atual) => ({ ...atual, nome: e.target.value }))} className="h-10 rounded-xl text-xs" placeholder="Nome que aparecerá no e-mail" /></label>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">Os demais dados são padrão do departamento_email e não precisam ser editados aqui.</div>
        <div className="flex justify-end"><Button onClick={() => void save()} className="gap-2"><Save size={15} /> Salvar nome</Button></div>
      </section>
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6"><p className="mb-3 text-xs font-semibold text-muted-foreground">Pré-visualização</p><div className="rounded-xl bg-white p-5 text-sm text-[#333]"><strong>{dados.nome || "Nome do usuário"}</strong>{dados.cargo && <> — <span className="text-gray-500">{dados.cargo}</span></>}<br />{dados.telefone && <>TEL: {dados.telefone}<br /></>}www.sharebrasil.com.br{dados.endereco && <><br /><span className="text-xs text-gray-500">{dados.endereco}</span></>}</div><p className="mt-3 text-[11px] text-muted-foreground">O e-mail pessoal não faz parte da assinatura.</p></section>
    </div>}
  </div>;
}
