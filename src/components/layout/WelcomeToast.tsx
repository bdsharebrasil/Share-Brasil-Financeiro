import { useEffect, useState } from "react";
import { Plane } from "lucide-react";

const ORBIT_MS = 4200;
const TW = 340;
const TH = 72;
const TR = 22;
const PAD = 14;
const OW = TW + PAD * 2;
const OH = TH + PAD * 2;
const ORBIT_SIZE = 64;
const ORBIT_CENTER = ORBIT_SIZE / 2;
const ORBIT_RADIUS = 28;
const ORBIT_LEFT = 24;
const ORBIT_TOP = 18;

const orbitPath = `M ${ORBIT_CENTER} ${ORBIT_CENTER - ORBIT_RADIUS} A ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 1 1 ${ORBIT_CENTER} ${ORBIT_CENTER + ORBIT_RADIUS} A ${ORBIT_RADIUS} ${ORBIT_RADIUS} 0 1 1 ${ORBIT_CENTER} ${ORBIT_CENTER - ORBIT_RADIUS} Z`;
const PERIMETER = Math.round(2 * Math.PI * ORBIT_RADIUS);

interface WelcomeToastProps {
  name: string;
}

export default function WelcomeToast({ name }: WelcomeToastProps) {
  const [phase, setPhase] = useState<"entering" | "visible" | "closing">("entering");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 80);
    const t2 = setTimeout(() => setPhase("closing"), ORBIT_MS);
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
      style={{
        position: "fixed",
        bottom: 36,
        right: 36,
        zIndex: 9999,
        width: OW,
        height: OH,
        transition: "opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: entering ? 0 : 1,
        transform: entering ? "translateY(24px) scale(0.92)" : "translateY(0) scale(1)",
        pointerEvents: "none",
      }}
    >
      <svg width={OW} height={OH} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
        <g transform={`translate(${ORBIT_LEFT} ${ORBIT_TOP})`}>
          <path d={orbitPath} fill="none" stroke="rgba(67,190,218,0.22)" strokeWidth={1.5} />
          <path
            d={orbitPath}
            fill="none"
            stroke="url(#welcome-toast-glow)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={PERIMETER}
            strokeDashoffset={PERIMETER}
            style={{ animation: `arcFill ${ORBIT_MS}ms linear forwards` }}
          />
        </g>
        <defs>
          <linearGradient id="welcome-toast-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#49B9D7" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#1D86AC" stopOpacity={0.95} />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ position: "absolute", top: ORBIT_TOP, left: ORBIT_LEFT, width: ORBIT_SIZE, height: ORBIT_SIZE, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 18,
            height: 18,
            display: "grid",
            placeItems: "center",
            offsetPath: `path('${orbitPath}')`,
            offsetRotate: "auto",
            animation: `planeOrbit ${ORBIT_MS}ms linear forwards`,
            transformOrigin: "center center",
          } as React.CSSProperties}
        >
          <Plane size={17} strokeWidth={1.5} fill="#4AB8D4" color="#4AB8D4" aria-hidden="true" />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: TW,
          height: TH,
          borderRadius: TR,
          background: "linear-gradient(135deg, #111E38 0%, #0D1A30 100%)",
          border: "1px solid rgba(0,200,255,0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,184,212,0.08) inset",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 22px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(55,167,198,0.12)",
            border: "1px solid rgba(74,184,212,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Plane size={20} strokeWidth={1.5} fill="#4AB8D4" color="#4AB8D4" aria-hidden="true" />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(136, 192, 207, 0.8)", textTransform: "uppercase", marginBottom: 2 }}>
            Share Brasil
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#E8F4FD", fontFamily: "'DM Sans', sans-serif" }}>
            Bem-vindo de volta, <span style={{ color: "#81becfff" }}>{displayName}</span>
          </p>
        </div>

        <div style={{ width: 3, height: 36, borderRadius: 2, background: "rgba(0,200,255,0.1)", overflow: "hidden", flexShrink: 0 }}>
          <div
            style={{
              width: "100%",
              borderRadius: 2,
              background: "linear-gradient(180deg, #0c82a3b2, #33a771ff)",
              height: "100%",
              transformOrigin: "top",
              animation: `barFill ${ORBIT_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes planeOrbit {
          from { offset-distance: 0%; }
          to { offset-distance: 100%; }
        }
        @keyframes arcFill {
          from { stroke-dashoffset: ${PERIMETER}; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes barFill {
          from { transform: scaleY(1); }
          to { transform: scaleY(0); }
        }
      `}</style>
    </div>
  );
}
