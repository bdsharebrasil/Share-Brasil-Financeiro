import { instalarRecuperacaoRecursos } from "@/lib/recuperar-recursos";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import "./index.css";
import "./styles/erp-system.css";

// Proteção global de cota do Google Maps Platform (Tier 1)
(window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
};
const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map((a) => String(a)).join(" ");
  if (msg.includes("OverQuotaMapError") || msg.includes("QuotaExceededError")) {
    window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
  }
};

instalarRecuperacaoRecursos();
const queryClient = new QueryClient();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(r=>r.update()).catch(error=>console.warn("Não foi possível atualizar o aplicativo.",error));
  });
}

createRoot(document.getElementById("root")!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
