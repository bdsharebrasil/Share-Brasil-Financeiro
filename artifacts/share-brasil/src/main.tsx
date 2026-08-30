import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";
import { supabase } from "@/lib/supabase";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import "./index.css";

setBaseUrl(import.meta.env.VITE_API_URL || "");
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
});

createRoot(document.getElementById("root")!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
