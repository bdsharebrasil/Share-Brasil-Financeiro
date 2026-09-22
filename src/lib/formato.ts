export function formatBRL(value: number | string | null | undefined) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0); }
/** Formatação de dados operacionais — sempre HH:MM, nunca decimal. */

export function minutosParaHoraMinuto(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !isFinite(minutos) || minutos < 0) return "--:--";
  const total = Math.round(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function horaMinutoParaMinutos(valor: string): number | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatarNumero(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || !isFinite(valor)) return "—";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarProa(graus: number | null | undefined): string {
  if (graus === null || graus === undefined || !isFinite(graus)) return "—";
  return `${String(Math.round(((graus % 360) + 360) % 360)).padStart(3, "0")}°`;
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const data = iso.slice(0, 10).split("-");
  if (data.length !== 3) return iso;
  return `${data[2]}/${data[1]}/${data[0]}`;
}

export function formatarCoordenada(lat: number, lon: number): string {
  const grau = (v: number, pos: string, neg: string) => {
    const hemi = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const g = Math.floor(abs);
    const min = (abs - g) * 60;
    return `${hemi}${String(g).padStart(2, "0")}°${min.toFixed(1).padStart(4, "0")}'`;
  };
  return `${grau(lat, "N", "S")} ${grau(lon, "E", "W")}`;
}
