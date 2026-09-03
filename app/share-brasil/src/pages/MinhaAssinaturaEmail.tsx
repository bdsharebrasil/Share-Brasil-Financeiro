import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarMinhaAssinatura, salvarMinhaAssinatura, type AssinaturaEmail } from "@/lib/colaborador-api";

const vazio: AssinaturaEmail = { nome: "SHARE BRASIL SERVICOS AEROPORTUARIOS LTDA", cargo: "", telefone: "", endereco: "", email: "" };
export default function MinhaAssinaturaEmail({ embedded = false }: { embedded?: boolean }) {
  const [dados, setDados] = useState<AssinaturaEmail>(vazio);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => { void buscarMinhaAssinatura().then((v) => setDados({ ...vazio, ...v, nome: vazio.nome, email: "" })).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar assinatura")).finally(() => setBusy(false)); }, []);
  const save = async () => { setErro(""); setOk(""); try { const salvo = await salvarMinhaAssinatura({ cargo: dados.cargo, telefone: dados.telefone, endereco: dados.endereco, nome: vazio.nome }); setDados({ ...vazio, ...salvo, nome: vazio.nome, email: "" }); setOk("Dados da assinatura salvos com sucesso."); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao salvar assinatura"); } };
  return <div className={`${embedded ? "" : "route-enter mx-auto max-w-4xl"} space-y-6`}>
    {!embedded && <header><h1 className="text-2xl font-extrabold">Assinatura</h1><p className="mt-1 text-xs text-muted-foreground">A assinatura utiliza sempre a empresa operacional/de contato.</p></header>}
    {(erro || ok) && <div className="flex items-center gap-2 rounded-xl border p-3 text-xs">{erro ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {erro || ok}</div>}
    {busy ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div> : <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-border/60 bg-card/60 p-6">
        <div><p className="text-xs font-bold uppercase tracking-wider">Empresa operacional/de contato</p><p className="mt-1 text-[11px] text-muted-foreground">Nome fixo conforme a configuração corporativa.</p></div>
        <label className="block"><span className="mb-1 block text-xs font-semibold">Nome</span><Input value={vazio.nome} disabled className="h-10 rounded-xl text-xs" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold">Departamento</span><Input value={dados.cargo || ""} disabled className="h-10 rounded-xl text-xs" placeholder="Carregado de departamentos_email" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold">Telefone</span><Input value={dados.telefone || ""} onChange={(e) => setDados((atual) => ({ ...atual, telefone: e.target.value }))} className="h-10 rounded-xl text-xs" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold">Endereço</span><Input value={dados.endereco || ""} onChange={(e) => setDados((atual) => ({ ...atual, endereco: e.target.value }))} className="h-10 rounded-xl text-xs" /></label>
        <div className="flex justify-end"><Button onClick={() => void save()} className="gap-2"><Save size={15} /> Salvar dados</Button></div>
      </section>
      <section className="rounded-2xl border border-border/60 bg-card/40 p-6"><p className="mb-3 text-xs font-semibold text-muted-foreground">Pré-visualização</p><div className="rounded-xl bg-white p-5 text-sm text-[#333]"><strong>{vazio.nome}</strong>{dados.cargo && <> — <span className="text-gray-500">{dados.cargo}</span></>}<br />{dados.telefone && <>TEL: {dados.telefone}<br /></>}www.sharebrasil.com.br{dados.endereco && <><br /><span className="text-xs text-gray-500">{dados.endereco}</span></>}</div><p className="mt-3 text-[11px] text-muted-foreground">O e-mail pessoal não faz parte da assinatura.</p></section>
    </div>}
  </div>;
}
