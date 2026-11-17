import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  useAnimationControls,
} from "framer-motion";
import "./animated-stepper.css";

// Adaptado do Animated Stepper fornecido: entrada 240 ms, saída 150 ms e deslocamento de 12 px.
const ENTER = 0.24;
const EXIT = 0.15;
const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

export type EtapaEnvio = { id: string; titulo: string };

/** Indicador controlado pela etapa real do formulário, sem navegação que ignore validações. */
export function AnimatedStepper({
  etapas,
  atual,
  ariaLabel = "Etapas da programação do pagamento",
}: {
  etapas: readonly EtapaEnvio[];
  atual: number;
  ariaLabel?: string;
}) {
  return (
    <nav className="envio-stepper" aria-label={ariaLabel}>
      <ol className="envio-stepper-lista">
        {etapas.map((etapa, index) => {
          const concluida = index < atual;
          const ativa = index === atual;
          return (
            <li
              key={etapa.id}
              className="envio-stepper-item"
              data-estado={
                concluida ? "concluida" : ativa ? "atual" : "pendente"
              }
              aria-current={ativa ? "step" : undefined}
            >
              <span className="envio-stepper-identidade">
                <span className="envio-stepper-no" aria-hidden="true">
                  <span className="envio-stepper-numero">{index + 1}</span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="envio-stepper-check"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-6.5"
                      pathLength="1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="envio-stepper-texto">
                  <span className="envio-stepper-titulo">
                    <span aria-hidden="true" className="envio-stepper-reserva">
                      {etapa.titulo}
                    </span>
                    <span>{etapa.titulo}</span>
                  </span>
                  <span className="envio-stepper-estado">
                    {concluida
                      ? "Concluída"
                      : ativa
                        ? "Em andamento"
                        : "Não iniciada"}
                  </span>
                </span>
              </span>
              {index < etapas.length - 1 && (
                <span className="envio-stepper-conector" aria-hidden="true">
                  <span />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status" aria-atomic="true">
        Etapa {atual + 1} de {etapas.length}: {etapas[atual]?.titulo}
      </p>
    </nav>
  );
}

/** Somente a apresentação muda; campos, rascunhos e validações pertencem à página. */
export function AnimatedStepPanel({
  etapa,
  titulo,
  children,
  ativo,
  className,
}: {
  etapa: number;
  titulo?: string;
  children: ReactNode;
  ativo?: boolean;
  className?: string;
}) {
  const anterior = useRef(etapa);
  const montado = useRef(false);
  const ultimaDirecao = useRef(1);
  const reduzido = useReducedMotion();
  const direcao =
    etapa === anterior.current
      ? ultimaDirecao.current
      : etapa > anterior.current
        ? 1
        : -1;
  useEffect(() => {
    anterior.current = etapa;
    ultimaDirecao.current = direcao;
    montado.current = true;
  }, [etapa, direcao]);
  // Formulários com inputs não controlados mantêm o DOM e os arquivos selecionados.
  if (ativo !== undefined)
    return (
      <EtapaPreservada
        ativo={ativo}
        titulo={titulo}
        direcao={direcao}
        reduzido={Boolean(reduzido)}
        className={className}
      >
        {children}
      </EtapaPreservada>
    );
  return (
    <AnimatePresence mode="wait" initial={false}>
      <EtapaAnimada
        key={etapa}
        titulo={titulo}
        direcao={direcao}
        reduzido={Boolean(reduzido)}
        focar={montado.current}
      >
        {children}
      </EtapaAnimada>
    </AnimatePresence>
  );
}

function EtapaAnimada({
  titulo,
  direcao,
  reduzido,
  focar,
  children,
}: {
  titulo?: string;
  direcao: number;
  reduzido: boolean;
  focar: boolean;
  children: ReactNode;
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
      animate={{
        opacity: 1,
        x: 0,
        transition: { duration: reduzido ? 0 : ENTER, ease: EASE_OUT },
      }}
      exit={{
        opacity: 0,
        transition: { duration: reduzido ? 0 : EXIT, ease: EASE_IN },
      }}
    >
      {titulo && (
        <h2
          ref={heading}
          id={id}
          tabIndex={-1}
          className="envio-stepper-heading"
        >
          {titulo}
        </h2>
      )}
      {children}
    </motion.section>
  );
}

/** Mesma transição sequencial, sem desmontar inputs ou limpar seleções de arquivo. */
function EtapaPreservada({
  ativo,
  titulo,
  direcao,
  reduzido,
  className,
  children,
}: {
  ativo: boolean;
  titulo?: string;
  direcao: number;
  reduzido: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const controls = useAnimationControls();
  const inicial = useRef(ativo);
  const anterior = useRef(ativo);
  useEffect(() => {
    const mudou = anterior.current !== ativo;
    anterior.current = ativo;
    let cancelado = false;
    let timer: number | undefined;
    controls.stop();
    const entrar = () => {
      controls.set({
        display: "flex",
        opacity: reduzido ? 1 : 0,
        x: reduzido ? 0 : 12 * direcao,
      });
      heading.current?.focus();
      void controls.start({
        opacity: 1,
        x: 0,
        transition: { duration: reduzido ? 0 : ENTER, ease: EASE_OUT },
      });
    };
    if (reduzido || !mudou) {
      controls.set({
        display: ativo ? "flex" : "none",
        opacity: ativo ? 1 : 0,
        x: 0,
      });
      if (ativo && mudou) heading.current?.focus();
    } else if (ativo) {
      // A saída da etapa anterior termina antes de exibir a próxima.
      controls.set({ display: "none", opacity: 0, x: 12 * direcao });
      timer = window.setTimeout(entrar, EXIT * 1000);
    } else {
      void controls
        .start({ opacity: 0, transition: { duration: EXIT, ease: EASE_IN } })
        .then(() => {
          if (!cancelado) controls.set({ display: "none", x: 12 * direcao });
        });
    }
    return () => {
      cancelado = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controls.stop();
    };
  }, [ativo, controls, direcao, reduzido]);
  return (
    <motion.section
      className={["envio-stepper-painel", className].filter(Boolean).join(" ")}
      aria-labelledby={titulo ? id : undefined}
      aria-hidden={ativo ? undefined : true}
      inert={!ativo}
      initial={{
        display: inicial.current ? "flex" : "none",
        opacity: inicial.current ? 1 : 0,
      }}
      animate={controls}
    >
      {titulo && (
        <h2
          id={id}
          ref={heading}
          tabIndex={-1}
          className="envio-stepper-heading"
        >
          {titulo}
        </h2>
      )}
      {children}
    </motion.section>
  );
}
