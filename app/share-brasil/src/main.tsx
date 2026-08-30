import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import { getCurrentSession } from "@/lib/api";
import "./index.css";

function AuthGate() {
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    if (window.location.pathname === "/login") {
      if (active) setChecking(false);
      return () => { active = false; };
    }

    void getCurrentSession().then((user) => {
      if (!active) return;
      if (!user) {
        window.location.replace("/login");
        return;
      }
      setChecking(false);
    });

    return () => { active = false; };
  }, []);

  if (checking && window.location.pathname !== "/login") {
    return <div className="min-h-screen bg-[#030814]" aria-label="Verificando autenticação" />;
  }

  return <App />;
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <AuthGate />
  </ErrorBoundary>,
);
