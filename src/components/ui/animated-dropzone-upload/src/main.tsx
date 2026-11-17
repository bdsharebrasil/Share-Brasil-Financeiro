import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Playground } from "@/components/dropzone-upload/Component";
import { Button } from "@/ui/Button";
// Inter, self-hosted from @fontsource/inter (OFL-1.1): Latin subset, the three weights the component uses.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@/styles/index.css";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function Demo() {
  const [theme, setTheme] = useState<Theme>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("theme");
    return fromUrl === "light" || fromUrl === "dark" ? fromUrl : systemTheme();
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[880px] flex-col px-5 pt-10 pb-16 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[620px]">
          <h1 className="m-0 text-[clamp(26px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.02em]">Dropzone upload</h1>
          <p className="mt-3 mb-0 text-[16px] leading-relaxed text-muted">A file-upload area supporting both drag-and-drop and a file-browse control.</p>
        </div>
        <Button variant="secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </Button>
      </header>
      <section aria-label="Live component" className="mt-8 grid min-h-[420px] flex-1 place-items-center rounded-panel border border-line bg-sunken p-8">
        <Playground />
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing in index.html");

createRoot(root).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
