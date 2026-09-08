import { useEffect, useState } from "react";

const ORBIT_MS = 4200;
const TW = 340;
const TH = 72;
const TR = 22;
const PAD = 14;
const OW = TW + PAD * 2;
const OH = TH + PAD * 2;
const OR = TR + PAD;

const orbitPath = [
  `M ${OR} 0`,
  `H ${OW - OR}`,
  `A ${OR} ${OR} 0 0 1 ${OW} ${OR}`,
  `V ${OH - OR}`,
  `A ${OR} ${OR} 0 0 1 ${OW - OR} ${OH}`,
  `H ${OR}`,
  `A ${OR} ${OR} 0 0 1 0 ${OH - OR}`,
  `V ${OR}`,
  `A ${OR} ${OR} 0 0 1 ${OR} 0`,
  `Z`,
].join(" ");

const straightH = 2 * (TW + PAD * 2 - 2 * OR);
const straightV = 2 * (TH + PAD * 2 - 2 * OR);
const arcs = 2 * Math.PI * OR;
const PERIMETER = Math.round(straightH + straightV + arcs);

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
        <path d={orbitPath} fill="none" stroke="rgba(0,200,255,0.12)" strokeWidth={1.5} />
        <path
          d={orbitPath}
          fill="none"
          stroke="url(#welcome-toast-glow)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={PERIMETER}
          strokeDashoffset={PERIMETER}
          style={{ animation: `arcFill ${ORBIT_MS}ms linear forwards`, filter: "drop-shadow(0 0 6px #00C8FF)" }}
        />
        <defs>
          <linearGradient id="welcome-toast-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00C8FF" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#00E87A" stopOpacity={1} />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ position: "absolute", top: 0, left: 0, width: OW, height: OH, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            fontSize: 18,
            lineHeight: 1,
            offsetPath: `path('${orbitPath}')`,
            offsetRotate: "auto",
            animation: `planeOrbit ${ORBIT_MS}ms linear forwards`,
            filter: "drop-shadow(0 0 8px rgba(0,200,255,0.9))",
            transformOrigin: "center center",
          } as React.CSSProperties}
        >
          ✈️
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
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.08) inset",
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
            background: "linear-gradient(135deg, rgba(0,200,255,0.2), rgba(0,232,122,0.15))",
            border: "1px solid rgba(0,200,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🛫
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(0,200,255,0.8)", textTransform: "uppercase", marginBottom: 2 }}>
            Share Brasil
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#E8F4FD", fontFamily: "'DM Sans', sans-serif" }}>
            Bem-vindo de volta, <span style={{ color: "#00C8FF" }}>{displayName}</span>
          </p>
        </div>

        <div style={{ width: 3, height: 36, borderRadius: 2, background: "rgba(0,200,255,0.1)", overflow: "hidden", flexShrink: 0 }}>
          <div
            style={{
              width: "100%",
              borderRadius: 2,
              background: "linear-gradient(180deg, #00C8FF, #00E87A)",
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
