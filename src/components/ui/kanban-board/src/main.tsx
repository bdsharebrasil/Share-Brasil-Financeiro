import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyInitialTheme } from "@/ui/theme";
import { TooltipProvider } from "@/ui/Tooltip";
// Inter, self-hosted from @fontsource/inter (OFL-1.1): Latin subset, three weights.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@/styles/index.css";
import { ThemeToggle } from "@/ui/ThemeToggle";
import Preview from "@/kits/kanban/kanban-board/Preview";

function Demo() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="max-w-[640px]">
          <h1 className="m-0 text-[clamp(26px,4vw,34px)] leading-[1.15] font-semibold tracking-[-0.02em]">Kanban board</h1>
          <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">Columns of task cards with counts and work-in-progress limits; drag cards between columns or move them by keyboard, and add a card inline.</p>
        </div>
        <ThemeToggle />
      </header>
      <Preview />
    </main>
  );
}

// ?theme=dark or ?theme=light forces a theme; otherwise the saved choice or the system setting applies.
applyInitialTheme();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing in index.html");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <Demo />
    </TooltipProvider>
  </StrictMode>,
);
