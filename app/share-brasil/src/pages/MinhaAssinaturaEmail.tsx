import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarMinhaAssinatura, salvarMinhaAssinatura, type AssinaturaEmail } from "@/lib/colaborador-api";
import logoShare from "@/assets/share-signature-logo.png";

const padrao: AssinaturaEmail = { nome: "", cargo: "", telefone: "", endereco: "", email: "" };
export default function MinhaAssinaturaEmail({ embedded = false }: { embedded?: boolean }) {
  const [dados, setDados] = useState<AssinaturaEmail>(padrao);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => { void buscarMinhaAssinatura().then((v) => setDados({ ...padrao, ...v })).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar assinatura")).finally(() => setBusy(false)); }, []);
  const save = async () => { setErro(""); setOk(""); try { setDados({ ...padrao, ...(await salvarMinhaAssinatura({ nome: dados.nome })) }); setOk("Nome salvo com sucesso."); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar assinatura"); } };
  return <div className={`${embedded ? "" : "route-enter mx-auto max-w-4xl"} space-y-6`}>
    {!embedded && <header><h1 className="text-2xl font-extrabold">Assinatura</h1></header>}
    {(erro || ok) && <div className="flex items-center gap-2 rounded-xl border p-3 text-xs">{erro ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {erro || ok}</div>}
    {busy ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div> : <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-6">
        <label className="block"><span className="mb-1 block text-xs font-semibold">Nome</span><Input value={dados.nome || ""} onChange={(e) => setDados((atual) => ({ ...atual, nome: e.target.value }))} className="h-10 rounded-xl text-xs" placeholder="Nome que aparecerá no e-mail" /></label>
        <div className="flex justify-end"><Button onClick={() => void save()} className="gap-2"><Save size={15} /> Salvar</Button></div>
      </section>
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6"><p className="mb-3 text-xs font-semibold text-muted-foreground">Pré-visualização</p><div className="flex min-h-[120px] w-full max-w-[381px] items-center gap-2 bg-white px-1 py-2 font-[Arial,sans-serif] text-[13px] leading-[1.15] text-[#333]"><img src={dados.logo_url || logoShare} alt="Share Brasil" className="h-auto w-[116px] shrink-0 object-contain" /><div className="min-w-0"><strong className="block text-[14px] leading-tight">{dados.nome || "Nome do usuário"}</strong>{dados.cargo && <span className="block text-[13px] text-[#555]">{dados.cargo}</span>}{dados.telefone && <span className="block">TEL: {dados.telefone}</span>}{dados.email && <span className="block">EMAIL: <a className="text-[#1a3c6e] underline" href={`mailto:${dados.email}`}>{dados.email}</a></span>}<span className="block">www.sharebrasil.com.br</span>{dados.endereco && <span className="block text-[11px] text-[#666]">{dados.endereco}</span>}</div></div></section>
    </div>}
  </div>;
}
