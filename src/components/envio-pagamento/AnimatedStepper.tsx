import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import "./animated-stepper.css";

// Adaptado do Animated Stepper fornecido: entrada 240 ms, saída 150 ms e deslocamento de 12 px.
const ENTER = 0.24;
const EXIT = 0.15;
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

export type EtapaEnvio = { id: string; titulo: string };

/** Indicador controlado pela etapa real do formulário, sem navegação que ignore validações. */
export function AnimatedStepper({ etapas, atual }: { etapas: readonly EtapaEnvio[]; atual: number }) {
  return (
    <nav className="envio-stepper" aria-label="Etapas da programação do pagamento">
      <ol className="envio-stepper-lista">
        {etapas.map((etapa, index) => {
          const concluida = index < atual;
          const ativa = index === atual;
          return (
            <li key={etapa.id} className="envio-stepper-item" data-estado={concluida ? "concluida" : ativa ? "atual" : "pendente"} aria-current={ativa ? "step" : undefined}>
              <span className="envio-stepper-identidade">
                <span className="envio-stepper-no" aria-hidden="true">
                  <span className="envio-stepper-numero">{index + 1}</span>
                  <svg viewBox="0 0 16 16" fill="none" className="envio-stepper-check">
                    <path d="M3.5 8.5l3 3 6-6.5" pathLength="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="envio-stepper-texto">
                  <span className="envio-stepper-titulo">
                    <span aria-hidden="true" className="envio-stepper-reserva">{etapa.titulo}</span>
                    <span>{etapa.titulo}</span>
                  </span>
                  <span className="envio-stepper-estado">{concluida ? "Concluída" : ativa ? "Em andamento" : "Não iniciada"}</span>
                </span>
              </span>
              {index < etapas.length - 1 && <span className="envio-stepper-conector" aria-hidden="true"><span /></span>}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status" aria-atomic="true">Etapa {atual + 1} de {etapas.length}: {etapas[atual]?.titulo}</p>
    </nav>
  );
}

/** Somente a apresentação muda; campos, rascunhos e validações pertencem à página. */
export function AnimatedStepPanel({ etapa, titulo, children }: { etapa: number; titulo?: string; children: ReactNode }) {
  const anterior = useRef(etapa);
  const montado = useRef(false);
  const ultimaDirecao = useRef(1);
  const reduzido = useReducedMotion();
  const direcao = etapa === anterior.current ? ultimaDirecao.current : etapa > anterior.current ? 1 : -1;
  useEffect(() => { anterior.current = etapa; ultimaDirecao.current = direcao; montado.current = true; }, [etapa, direcao]);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <EtapaAnimada key={etapa} titulo={titulo} direcao={direcao} reduzido={Boolean(reduzido)} focar={montado.current}>
        {children}
      </EtapaAnimada>
    </AnimatePresence>
  );
}

function EtapaAnimada({ titulo, direcao, reduzido, focar, children }: {
  titulo?: string; direcao: number; reduzido: boolean; focar: boolean; children: ReactNode;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const presente = useIsPresent();
  useEffect(() => {
    if (focar) heading.current?.focus();
  }, [focar]);
  return (
    <motion.section
      className="envio-stepper-painel"
      aria-labelledby={titulo ? id : undefined}
      aria-hidden={presente ? undefined : true}
      inert={!presente}
      initial={reduzido ? false : { opacity: 0, x: 12 * direcao }}
      animate={{ opacity: 1, x: 0, transition: { duration: reduzido ? 0 : ENTER, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: reduzido ? 0 : EXIT, ease: EASE_IN } }}
    >
      {titulo && <h2 ref={heading} id={id} tabIndex={-1} className="envio-stepper-heading">{titulo}</h2>}
      {children}
    </motion.section>
  );
}
