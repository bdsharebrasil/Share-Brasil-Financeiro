import { useEffect, useId, useRef, useState } from "react";

// Uma volta de 1,5 s, seguida de 700 ms para leitura e saída suave.
const ORBIT_MS = 1500;
const CLOSE_DELAY = 700;
const EXIT_MS = 320;
const RADIUS = 145;
const LENGTH = 2 * Math.PI * RADIUS;

interface WelcomeToastProps {
  name: string;
  onClose?: () => void;
}

// Silhueta de avião vista de cima, apontando para cima.
const PLANE =
  "M 0 -20 C 2 -20 3 -17 3 -14 L 3 -5 L 17 4 L 17 9 L 3 4 L 3 15 L 8 19 L 8 22 L 0 19 L -8 22 L -8 19 L -3 15 L -3 4 L -17 9 L -17 4 L -3 -5 L -3 -14 C -3 -17 -2 -20 0 -20 Z";

export default function WelcomeToast({ name, onClose }: WelcomeToastProps) {
  const [phase, setPhase] = useState<
    "entering" | "visible" | "closing" | "closed"
  >("entering");
  const closeRef = useRef(onClose);
  const id = `share-welcome-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const displayName = name.trim().split(/\s+/)[0]?.toLocaleUpperCase("pt-BR") || "VOCÊ";
  // Nomes longos ocupam uma linha própria sem sair do cartão.
  const longName = displayName.length > 11;
  const nameSize = Math.max(13, Math.min(23, 216 / (displayName.length * 0.65)));

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const enter = window.setTimeout(() => setPhase("visible"), 50);
    const close = window.setTimeout(
      () => setPhase("closing"),
      50 + ORBIT_MS + CLOSE_DELAY,
    );
    const finish = window.setTimeout(() => {
      setPhase("closed");
      closeRef.current?.();
    }, 50 + ORBIT_MS + CLOSE_DELAY + EXIT_MS);

    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(close);
      window.clearTimeout(finish);
    };
  }, []);

  if (phase === "closed") return null;

  return (
    <div
      className="share-welcome"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        right: "calc(env(safe-area-inset-right, 0px) + 12px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        width: "clamp(190px, 19vw, 240px)",
        maxWidth: "calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))",
        zIndex: 9999,
        pointerEvents: "none",
        isolation: "isolate",
      }}
    >
      <span className="share-welcome-accessible">
        Share Brasil. Bem-vindo de volta, {displayName}!
      </span>

      {/* Toda a geometria usa o mesmo viewBox, inclusive a órbita do avião. */}
      <svg
        viewBox="0 0 600 390"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`${id}-ring`} x1="35" y1="170" x2="325" y2="170" gradientUnits="userSpaceOnUse">
            <stop stopColor="#27AFFF" />
            <stop offset="0.48" stopColor="#42D9EF" />
            <stop offset="1" stopColor="#48F0D4" />
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0.65" stopColor="#20CBE4" stopOpacity="0" />
            <stop offset="0.88" stopColor="#20CBE4" stopOpacity="0.12" />
            <stop offset="1" stopColor="#20CBE4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-card`} x1="212" y1="274" x2="582" y2="376" gradientUnits="userSpaceOnUse">
            <stop stopColor="#173D68" />
            <stop offset="0.48" stopColor="#10233F" />
            <stop offset="1" stopColor="#0B1728" />
          </linearGradient>
          <linearGradient id={`${id}-border`} x1="212" y1="280" x2="582" y2="370" gradientUnits="userSpaceOnUse">
            <stop stopColor="#40C7E5" />
            <stop offset="1" stopColor="#527FB3" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={`${id}-shadow`} x="-25%" y="-60%" width="150%" height="240%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="9" stdDeviation="12" floodColor="#001622" floodOpacity="0.65" />
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#25C7E5" floodOpacity="0.15" />
          </filter>
        </defs>

        <circle cx="180" cy="170" r="174" fill={`url(#${id}-halo)`} />
        <circle cx="180" cy="170" r={RADIUS} stroke={`url(#${id}-ring)`} strokeWidth="13" opacity="0.12" />
        {/* Leve anel completo, visível antes de o rastro ser preenchido. */}
        <circle cx="180" cy="170" r={RADIUS} stroke={`url(#${id}-ring)`} strokeWidth="2" opacity="0.25" />

        <g transform="rotate(-90 180 170)">
          <circle
            className="share-welcome-trail"
            cx="180" cy="170" r={RADIUS}
            stroke={`url(#${id}-ring)`}
            strokeWidth="13" strokeLinecap="round"
            strokeDasharray={LENGTH} strokeDashoffset={LENGTH}
            filter={`url(#${id}-glow)`}
          />
          <circle
            className="share-welcome-trail"
            cx="180" cy="170" r={RADIUS}
            stroke={`url(#${id}-ring)`}
            strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={LENGTH} strokeDashoffset={LENGTH}
          />
        </g>

        {/* Rotação em torno do centro do SVG: acompanha a escala do círculo. */}
        <g className="share-welcome-orbit">
          <g transform="translate(180 25) rotate(90) scale(.75)">
            <path d={PLANE} fill="#66E5F1" opacity="0.65" filter={`url(#${id}-glow)`} />
            <path d={PLANE} fill="#71E5EE" />
          </g>
        </g>

        {/* Cartão sobreposto à parte inferior direita do círculo. */}
        <rect x="212" y="274" width="370" height="102" rx="26" fill={`url(#${id}-card)`} stroke={`url(#${id}-border)`} strokeWidth="1.5" filter={`url(#${id}-shadow)`} />
        <rect x="230" y="293" width="70" height="70" rx="16" fill="#176D7E" fillOpacity="0.83" />
        <path d={PLANE} transform="translate(265 327) scale(.86)" fill="#59DAE4" />

        <g fontFamily="'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
          <text x="316" y="307" fill="#789ABF" fontSize="14" fontWeight="500" letterSpacing=".5">SHARE BRASIL</text>
          <text x="316" y="334" fill="#F5FAFF" fontSize="23" fontWeight="600" letterSpacing="-.45">
            {longName ? "Bem-vindo de volta," : "Bem-vindo de"}
          </text>
          <text x="316" y="362" fontSize={longName ? nameSize : 23} fontWeight="600" letterSpacing="-.45">
            {!longName && <tspan fill="#F5FAFF">volta, </tspan>}
            <tspan fill="#67D3EC">{displayName}</tspan>
          </text>
        </g>

        <rect x="558" y="292" width="7" height="68" rx="3.5" fill="#155163" />
        <rect className="share-welcome-meter" x="558" y="312" width="7" height="48" rx="3.5" fill="#54D2F0" />
      </svg>

      <style>{`
        .share-welcome {
          opacity: 0;
          transform: translateY(18px) scale(.94);
          transform-origin: bottom right;
          transition: opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1);
        }
        .share-welcome[data-phase="visible"] {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .share-welcome[data-phase="closing"] {
          opacity: 0;
          transform: translateY(12px) scale(.97);
        }
        .share-welcome-accessible {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
          border: 0;
        }
        .share-welcome-trail {
          animation: shareWelcomeTrail ${ORBIT_MS}ms linear forwards;
          animation-play-state: paused;
        }
        .share-welcome-orbit {
          transform-origin: 180px 170px;
          transform-box: view-box;
          animation: shareWelcomeOrbit ${ORBIT_MS}ms linear forwards;
          animation-play-state: paused;
        }
        .share-welcome-meter {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: shareWelcomeMeter ${ORBIT_MS + CLOSE_DELAY}ms linear forwards;
          animation-play-state: paused;
        }
        .share-welcome[data-phase="visible"] .share-welcome-trail,
        .share-welcome[data-phase="visible"] .share-welcome-orbit,
        .share-welcome[data-phase="visible"] .share-welcome-meter,
        .share-welcome[data-phase="closing"] .share-welcome-trail,
        .share-welcome[data-phase="closing"] .share-welcome-orbit,
        .share-welcome[data-phase="closing"] .share-welcome-meter {
          animation-play-state: running;
        }
        @keyframes shareWelcomeTrail { to { stroke-dashoffset: 0; } }
        @keyframes shareWelcomeOrbit { to { transform: rotate(360deg); } }
        @keyframes shareWelcomeMeter { to { transform: scaleY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .share-welcome { transition: opacity 150ms ease; transform: none; }
          .share-welcome[data-phase="closing"] { transform: none; }
          .share-welcome-trail { animation: none; stroke-dashoffset: 0; }
          .share-welcome-orbit, .share-welcome-meter { animation: none; }
        }
      `}</style>
    </div>
  );
}
