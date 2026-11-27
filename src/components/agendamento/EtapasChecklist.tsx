import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./etapas-checklist.css";

// Adaptado do Animated Stepper 1.0.0 (HorizonX), fornecido pelo usuário.
const ENTRADA = 0.24;
const SAIDA = 0.15;
const SUAVE = [0.2, 0.8, 0.2, 1] as const;
const FECHAR = [0.4, 0, 1, 1] as const;

export type EtapaChecklist = {
  id: string;
  titulo: string;
  descricao?: string;
  concluida: boolean;
};

function TituloEtapa({
  id,
  titulo,
  focar,
}: {
  id: string;
  titulo: string;
  focar: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focar) {
      ref.current?.focus({ preventScroll: true });
      ref.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [id, focar]);
  return (
    <h3
      id={id}
      ref={ref}
      tabIndex={-1}
      style={{ scrollMarginTop: "calc(var(--app-header-height, 80px) + 16px)" }}
      className="mb-3 rounded text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {titulo}
    </h3>
  );
}

export default function EtapasChecklist({
  etapas,
  atual,
  direcao,
  desabilitado,
  aoSelecionar,
  children,
}: {
  etapas: EtapaChecklist[];
  atual: string;
  direcao: number;
  desabilitado?: boolean;
  aoSelecionar: (id: string) => void;
  children: ReactNode;
}) {
  const reduzir = useReducedMotion() ?? false;
  const id = useId();
  const anterior = useRef(atual);
  const navegou = useRef(false);
  if (anterior.current !== atual) {
    anterior.current = atual;
    navegou.current = true;
  }
  const indice = Math.max(
    0,
    etapas.findIndex((etapa) => etapa.id === atual),
  );
  const etapa = etapas[indice];
  if (!etapa) return null;
  const tituloId = `${id}-${etapa.id}`;
  const conteudo = (
    <>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Etapa {indice + 1} de {etapas.length}
      </p>
      <TituloEtapa
        id={tituloId}
        titulo={etapa.descricao || etapa.titulo}
        focar={navegou.current}
      />
      {children}
    </>
  );

  return (
    <div className="checklist-etapas">
      <ol
        className="checklist-etapas-lista"
        aria-label="Etapas do checklist pré-voo"
      >
        {etapas.map((item, i) => (
          <li
            key={item.id}
            className="checklist-etapa"
            aria-current={item.id === atual ? "step" : undefined}
            data-concluida={item.concluida}
          >
            <button
              type="button"
              className="checklist-etapa-botao"
              disabled={desabilitado}
              onClick={() => aoSelecionar(item.id)}
              title={item.descricao || item.titulo}
            >
              <span className="checklist-etapa-numero" aria-hidden="true">
                <span className="checklist-etapa-indice">{i + 1}</span>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="checklist-etapa-check"
                >
                  <path
                    d="M3.5 8.5l3 3 6-6.5"
                    pathLength={1}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <strong className="block text-xs font-semibold">
                  {item.titulo}
                </strong>
                <span className="block text-[11px] text-muted-foreground">
                  {item.concluida
                    ? "Concluída"
                    : item.id === atual
                      ? "Atual"
                      : "Pendente"}
                </span>
              </span>
            </button>
            {i < etapas.length - 1 && (
              <span className="checklist-etapa-conector" aria-hidden="true">
                <span />
              </span>
            )}
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" className="sr-only">
        Etapa {indice + 1} de {etapas.length}: {etapa.descricao || etapa.titulo}
      </p>
      <div className="checklist-etapas-painel">
        {reduzir ? (
          <section key={atual} aria-labelledby={tituloId}>
            {conteudo}
          </section>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={direcao}>
            <motion.section
              key={atual}
              aria-labelledby={tituloId}
              custom={direcao}
              variants={{
                entrada: (sentido: number) => ({ opacity: 0, x: 12 * sentido }),
                visivel: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: ENTRADA, ease: SUAVE },
                },
                saida: {
                  opacity: 0,
                  transition: { duration: SAIDA, ease: FECHAR },
                },
              }}
              initial="entrada"
              animate="visivel"
              exit="saida"
            >
              {conteudo}
            </motion.section>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
