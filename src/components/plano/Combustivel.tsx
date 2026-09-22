import { Campo, Dado } from "./Secao";
import { classeEntrada } from "./PlanoIcao";
import { formatarNumero, minutosParaHoraMinuto } from "@/lib/format";
import type { ResultadoCombustivel } from "@/lib/navegacao";

interface Props {
  consumoHora: number;
  minutosVoo: number;
  minutosReserva: number;
  minutosTaxi: number;
  ventoKt: number;
  combustivelABordo: string;
  velocidadeSolo: number;
  distanciaTotalNM: number;
  resultado: ResultadoCombustivel;
  setMinutosReserva: (v: number) => void;
  setMinutosTaxi: (v: number) => void;
  setVentoKt: (v: number) => void;
  setCombustivelABordo: (v: string) => void;
}

export function Combustivel(props: Props) {
  const litros = (v: number) => (props.consumoHora > 0 ? `${formatarNumero(v, 0)} L` : "—");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo rotulo="Reserva (min)">
          <input
            type="number"
            value={props.minutosReserva}
            onChange={(e) => props.setMinutosReserva(Number(e.target.value))}
            className={classeEntrada}
          />
        </Campo>
        <Campo rotulo="Táxi (min)">
          <input
            type="number"
            value={props.minutosTaxi}
            onChange={(e) => props.setMinutosTaxi(Number(e.target.value))}
            className={classeEntrada}
          />
        </Campo>
        <Campo rotulo="Vento de proa (kt)">
          <input
            type="number"
            value={props.ventoKt}
            onChange={(e) => props.setVentoKt(Number(e.target.value))}
            className={classeEntrada}
          />
        </Campo>
        <Campo rotulo="Combustível a bordo (L)">
          <input
            type="number"
            value={props.combustivelABordo}
            onChange={(e) => props.setCombustivelABordo(e.target.value)}
            placeholder="opcional"
            className={classeEntrada}
          />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <Dado rotulo="Distância total" valor={`${formatarNumero(props.distanciaTotalNM)} NM`} />
        <Dado rotulo="Velocidade no solo" valor={`${formatarNumero(props.velocidadeSolo, 0)} kt`} />
        <Dado rotulo="Tempo de voo" valor={minutosParaHoraMinuto(props.minutosVoo)} />
        <Dado rotulo="Reserva" valor={minutosParaHoraMinuto(props.minutosReserva)} />
        <Dado rotulo="Combustível da etapa" valor={litros(props.resultado.etapa)} />
        <Dado rotulo="Combustível de reserva" valor={litros(props.resultado.reserva)} />
        <Dado rotulo="Combustível de táxi" valor={litros(props.resultado.taxi)} />
        <Dado rotulo="Combustível total" valor={litros(props.resultado.total)} />
        <Dado rotulo="Autonomia" valor={minutosParaHoraMinuto(props.resultado.autonomiaMinutos)} />
        <Dado
          rotulo="Margem"
          valor={
            props.resultado.margemMinutos === null
              ? "—"
              : `${minutosParaHoraMinuto(props.resultado.margemMinutos)} · ${formatarNumero(props.resultado.margemLitros ?? 0, 0)} L`
          }
        />
      </div>

      {props.consumoHora <= 0 && (
        <p className="text-xs text-warning">
          A aeronave não possui consumo por hora cadastrado no sistema — os valores de combustível ficam
          indisponíveis até o cadastro ser preenchido.
        </p>
      )}
    </div>
  );
}
