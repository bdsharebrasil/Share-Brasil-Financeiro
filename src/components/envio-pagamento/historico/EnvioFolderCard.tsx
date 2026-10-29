import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import type { EnvioPagamento } from "@/lib/colaborador-api";
import { formatarMoeda } from "./status";
import { RequestRow } from "./RequestRow";

export type EnvioFolder = {
  tipo: EnvioPagamento["tipo"];
  rotulo: string;
  itens: EnvioPagamento[];
  total: number;
  pendentes: number;
};

type EnvioFolderCardProps = {
  folder: EnvioFolder;
  open: boolean;
  onToggle: (tipo: EnvioPagamento["tipo"]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const EASE = [0.23, 1, 0.32, 1] as const;

export function EnvioFolderCard({ folder, open, onToggle, selectedId, onSelect }: EnvioFolderCardProps) {
  const { tipo, rotulo, itens, total, pendentes } = folder;
  const panelId = `envio-folder-${tipo}`;

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-card/60">
      <h3>
        <button
          type="button"
          onClick={() => onToggle(tipo)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-secondary/40"
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18, ease: EASE }} className="text-muted-foreground">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </motion.span>

          <span className={open ? "text-primary" : "text-muted-foreground"}>
            {open ? <FolderOpen className="h-4 w-4" aria-hidden="true" /> : <Folder className="h-4 w-4" aria-hidden="true" />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold text-foreground">{rotulo}</span>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              {itens.length} {itens.length === 1 ? "programação" : "programações"}
              {pendentes > 0 ? ` · ${pendentes} pendente${pendentes > 1 ? "s" : ""}` : ""}
            </span>
          </span>

          <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-foreground">{formatarMoeda(total)}</span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-1 border-t border-border/60 px-2 py-2">
              {itens.map((envio) => (
                <RequestRow key={envio.id} envio={envio} rotulo={rotulo} selected={selectedId === envio.id} onSelect={onSelect} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
