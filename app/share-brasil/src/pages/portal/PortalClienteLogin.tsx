import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Plane, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getCurrentSession, login } from "@/lib/api";

export default function PortalClienteLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => { void getCurrentSession().then((session) => { if (session) navigate("/portal-cliente", { replace: true }); else setVerificando(false); }); }, [navigate]);

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!usuario.trim() || !senha) { toast({ title: "Campos obrigatórios", description: "Informe seu usuário e senha.", variant: "destructive" }); return; }
    setEnviando(true);
    try { await login(usuario.trim(), senha); toast({ title: "Acesso autorizado", description: "Bem-vindo(a) ao Portal do Cliente." }); navigate("/portal-cliente", { replace: true }); } catch { toast({ title: "Acesso negado", description: "Usuário ou senha incorretos. Tente novamente.", variant: "destructive" }); } finally { setEnviando(false); }
  };

  if (verificando) return <div className="min-h-screen bg-[#0a101a]" aria-label="Verificando sessão do cliente" />;
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a101a] px-5 py-10 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,91,140,.35),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(110,80,25,.18),transparent_42%)]" /><section className="relative w-full max-w-[430px] rounded-3xl border border-white/10 bg-[#111c2b]/90 p-8 shadow-2xl backdrop-blur-xl"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#39d0ff]/10 text-[#8be8ff]"><Plane size={22} /></div><div><p className="text-sm font-extrabold tracking-[.18em]">SHARE BRASIL</p><p className="mt-1 text-xs text-white/50">Portal do Cliente</p></div></div><div className="mt-10"><h1 className="text-2xl font-bold">Acesse seus documentos</h1><p className="mt-2 text-sm leading-relaxed text-white/55">Consulte pagamentos, recibos e documentos vinculados à sua conta.</p></div><form onSubmit={enviar} className="mt-7 space-y-5"><div className="space-y-2"><Label htmlFor="portal-cliente-usuario" className="text-xs font-semibold text-white/70">Usuário</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={18} /><Input id="portal-cliente-usuario" value={usuario} onChange={(event) => setUsuario(event.target.value)} autoComplete="username" placeholder="Seu usuário" disabled={enviando} className="h-12 border-white/10 bg-white/5 pl-11 text-white placeholder:text-white/25" /></div></div><div className="space-y-2"><Label htmlFor="portal-cliente-senha" className="text-xs font-semibold text-white/70">Senha</Label><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={18} /><Input id="portal-cliente-senha" type={mostrarSenha ? "text" : "password"} value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete="current-password" placeholder="Sua senha" disabled={enviando} className="h-12 border-white/10 bg-white/5 pl-11 pr-11 text-white placeholder:text-white/25" /><button type="button" onClick={() => setMostrarSenha((atual) => !atual)} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/80">{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div><Button type="submit" disabled={enviando} className="h-12 w-full bg-[#39d0ff] font-bold text-[#061522] hover:bg-[#8be8ff]">{enviando ? "Validando acesso..." : "Entrar no portal"}</Button></form><p className="mt-7 text-center text-[11px] leading-relaxed text-white/35">Este acesso é independente do Portal do Colaborador.</p></section></main>;
}
