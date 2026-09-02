import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabase";
import LayoutInterno from "@/components/layout/LayoutInterno";
import Login from "@/pages/login";

function ProtecaoColaborador() {
  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
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
  return <><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<ProtecaoColaborador />} /></Routes><Toaster /></>;
}
