import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componente = readFileSync(new URL("../src/components/agendamento/JornadaVoo.tsx", import.meta.url), "utf8");

test("a interface oferece criação de jornada programada sem exigir acionamento", () => {
  assert.match(componente, /salvarInicio = async \(aguardarHorarios = false\)/);
  assert.match(componente, /payload\.aguardar_horarios = true/);
  assert.match(componente, /Criar jornada e aguardar horários/);
  assert.match(componente, /jornada\.status === "programada"\) return "Aguardando horários"/);
  assert.match(componente, /Informar horários da perna/);
  assert.match(componente, /disabled=\{salvando \|\| !data \|\| !perna\.origem \|\| !perna\.destino\} className="gap-2 text-xs"><CalendarDays/);
});
