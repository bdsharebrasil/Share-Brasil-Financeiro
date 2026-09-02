import { useState, type ReactNode } from "react";
import { BarChart3, RotateCw, Table2 } from "lucide-react";

export default function DiarioPainelFlip({ frente, verso, rotuloFrente = "Lançamentos", rotuloVerso = "Resumo do mês" }: { frente: ReactNode; verso: ReactNode; rotuloFrente?: string; rotuloVerso?: string }) {
  const [virado, setVirado] = useState(false);

  return (
    <div className="relative" style={{ perspective: "2200px" }}>
      <button
        type="button"
        onClick={() => setVirado((atual) => !atual)}
        className="absolute -top-3 right-4 z-30 flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-[#0f1a27]/90 px-3 py-1.5 text-[10px] font-bold text-cyan-200 shadow-lg backdrop-blur transition-colors hover:border-cyan-300/60 hover:text-cyan-100"
        title="Girar quadro"
      >
        <RotateCw size={12} className={`transition-transform duration-500 ${virado ? "rotate-180" : ""}`} />
        {virado ? <><Table2 size={12} /> {rotuloFrente}</> : <><BarChart3 size={12} /> {rotuloVerso}</>}
      </button>
      <div
        className="grid transition-transform duration-[700ms] [transform-style:preserve-3d]"
        style={{ transform: virado ? "rotateY(180deg)" : "rotateY(0deg)", transitionTimingFunction: "cubic-bezier(.22,.85,.28,1)" }}
      >
        <div className="col-start-1 row-start-1 [backface-visibility:hidden]" aria-hidden={virado}>
          <div className={virado ? "pointer-events-none opacity-0" : "opacity-100"}>{frente}</div>
        </div>
        <div className="col-start-1 row-start-1 [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!virado}>
          <div className={virado ? "opacity-100" : "pointer-events-none opacity-0"}>{verso}</div>
        </div>
      </div>
    </div>
  );
}
