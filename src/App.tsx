import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import LayoutInterno from "@/components/layout/LayoutInterno";

const Login = lazy(() => import("@/pages/login"));
const AprovacaoRelatorioViagem = lazy(
  () => import("@/components/relatorio-viagem/AprovacaoRelatorioViagem"),
);

function ProtecaoColaborador() {
  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setVerificando(false);
      return;
    }
    let ativo = true;
    void supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!ativo) return;
      if (error) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setAutenticado(Boolean(session) && !error);
      setVerificando(false);
    }).catch(async () => {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      if (!ativo) return;
      setAutenticado(false);
      setVerificando(false);
    });
    return () => { ativo = false; };
  }, []);

  if (verificando) return <div className="min-h-screen bg-[#030814]" aria-label="Verificando autenticação" />;
  return autenticado ? <LayoutInterno /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Suspense
        fallback={
          <div
            className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
            role="status"
          >
            Carregando…
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/aprovar-relatorio"
            element={<AprovacaoRelatorioViagem />}
          />
          <Route path="*" element={<ProtecaoColaborador />} />
        </Routes>
      </Suspense>
      <Toaster />
      <SonnerToaster />
    </>
  );
}
