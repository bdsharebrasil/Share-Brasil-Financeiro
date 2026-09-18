import { useEffect, useState } from "react";
import { Plane } from "lucide-react";

// Configurações de tempo (em milissegundos)
const ORBIT_MS = 1500; // "Bem rapidinho" (1.5 segundos para a volta completa)
const CLOSE_DELAY = 700; // Tempo que fica na tela após completar a volta para dar tempo de ler
const TOTAL_MS = ORBIT_MS + CLOSE_DELAY;

// Configurações de tamanho (círculo principal)
const SIZE = 200; // Tamanho de referência (px) usado só para calcular a geometria do SVG
const CENTER = SIZE / 2;
const RADIUS = 88; // Raio da órbita do avião
const PERIMETER = Math.round(2 * Math.PI * RADIUS);

// Path em formato de círculo perfeito começando pelo topo e girando no sentido horário
const orbitPath = `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER} ${CENTER + RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER} ${CENTER - RADIUS} Z`;

interface WelcomeToastProps {
  name: string;
}

export default function WelcomeToast({ name }: WelcomeToastProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "closing">("entering");

  useEffect(() => {
    // Entra na tela logo após montar
    const t1 = setTimeout(() => setPhase("visible"), 50);
    // Remove da tela após a animação + tempo de leitura
    const t2 = setTimeout(() => setPhase("closing"), TOTAL_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "closing") return null;

  const entering = phase === "entering";
  const displayName = name.trim().split(/\s+/)[0].toUpperCase();

  return (
    <div
      className="welcome-toast-shell"
      style={{
        position: "fixed",
        // clamp() em vez de breakpoints fixos: o toast encolhe suavemente em
        // qualquer largura de tela, do iPhone SE (320px) ao desktop, sem
        // "saltos" entre tamanhos.
        bottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), calc(env(safe-area-inset-bottom, 0px) + 3vh))",
        right: "max(calc(env(safe-area-inset-right, 0px) + 10px), calc(env(safe-area-inset-right, 0px) + 3vw))",
        zIndex: 9999,
        width: "clamp(112px, 34vw, 200px)",
        height: "clamp(112px, 34vw, 200px)",
        maxWidth: "min(200px, 92vw)",
        maxHeight: "min(200px, 92vw)",
        transformOrigin: "bottom right",
        transition: "opacity 0.3s cubic-bezier(0.34,1.56,0.64,1), transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: entering ? 0 : 1,
        transform: entering ? "translateY(24px) scale(0.8)" : "translateY(0) scale(1)",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        {/* Fundo escuro circular onde fica o texto */}
        <div
          style={{
            position: "absolute",
            inset: "7%", // Deixa um espaço proporcional para a linha do trajeto passar por fora
            borderRadius: "50%",
            background: "linear-gradient(135deg, #378fc2b2 0%, #193d7a79 100%)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,184,212,0.1) inset",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "8%",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "clamp(7px, 2.4vw, 10px)",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(202, 252, 224, 0.8)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Share Brasil
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(10px, 3.4vw, 15px)",
              fontWeight: 700,
              color: "#7dcc88",
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            Bem-vindo,
            <br />
            <span style={{ color: "rgb(182, 226, 238)" }}>{displayName}</span>
          </p>
        </div>

        {/* SVG que desenha o rastro luminoso — escala junto com o contêiner via viewBox */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="circular-glow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#49B9D7" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#033344" stopOpacity={1} />
            </linearGradient>
          </defs>

          {/* Linha de fundo sutil (opcional) */}
          <path d={orbitPath} fill="none" stroke="rgba(67,190,218,0.1)" strokeWidth={2} />

          {/* Linha que é preenchida junto com o avião */}
          <path
            d={orbitPath}
            fill="none"
            stroke="url(#circular-glow)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={PERIMETER}
            strokeDashoffset={PERIMETER}
            style={{ animation: `arcFill ${ORBIT_MS}ms linear forwards` }}
          />
        </svg>

        {/* Avião e seu contêiner de animação — o path do offset-path usa as
           mesmas coordenadas do viewBox (0-200), então o navegador escala
           o movimento junto com o tamanho real do elemento pai. */}
        <div style={{ position: "absolute", inset: 0 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "10%",
              height: "10%",
              minWidth: 14,
              minHeight: 14,
              display: "grid",
              placeItems: "center",
              offsetPath: `path('${orbitPath}')`,
              offsetRotate: "auto",
              animation: `planeOrbit ${ORBIT_MS}ms linear forwards`,
            } as React.CSSProperties}
          >
            {/* Rotacionando 35deg pois o ícone padrão "Plane" do lucide aponta para a diagonal superior */}
            <Plane
              className="welcome-toast-plane-icon"
              strokeWidth={2}
              fill="#1b3979"
              color="#0b5c70"
              aria-hidden="true"
              style={{ transform: "rotate(35deg)" }}
            />
          </div>
        </div>
      </div>

      {/* Keyframes embutidos. O SVG usa coordenadas fixas (0-200) que são
         reescaladas pelo próprio viewBox/offset-path, então não precisamos
         mais de media queries com "saltos" de escala. */}
      <style>{`
        @keyframes planeOrbit {
          from { offset-distance: 0%; }
          to { offset-distance: 100%; }
        }
        @keyframes arcFill {
          from { stroke-dashoffset: ${PERIMETER}; }
          to { stroke-dashoffset: 0; }
        }
        .welcome-toast-plane-icon {
          width: clamp(14px, 4.2vw, 18px);
          height: clamp(14px, 4.2vw, 18px);
        }
      `}</style>
    </div>
  );
}