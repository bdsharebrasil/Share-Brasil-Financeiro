import { fmt, money } from "../../lib/balanco-cotista";
import { rateioDoCotista } from "../../lib/financeiro-cotista-lancamentos";

type Lancamento = Parameters<typeof rateioDoCotista>[0];
type Cotista = Parameters<typeof rateioDoCotista>[1];
type Cotistas = Parameters<typeof rateioDoCotista>[2];

export function CabecalhoRateioCotista({
  cotista,
  indice,
}: {
  cotista: Cotista;
  indice: number;
}) {
  return (
    <th className={`fb-num fb-share-header fb-tone-${indice % 2}`} scope="col">
      <strong>{cotista.nome}</strong>
      <span>Rateio · % / valor</span>
    </th>
  );
}

export function CelulaRateioCotista({
  lancamento,
  cotista,
  cotistas,
  indice,
}: {
  lancamento: Lancamento;
  cotista: Cotista;
  cotistas: Cotistas;
  indice: number;
}) {
  const rateio = rateioDoCotista(lancamento, cotista, cotistas);

  return (
    <td className={`fb-num fb-tone-${indice % 2}`}>
      {rateio ? (
        <div className="fb-share-cell">
          <span>{rateio.percentual == null ? "—" : `${fmt(rateio.percentual)}%`}</span>
          <strong>{money(rateio.valorCentavos)}</strong>
        </div>
      ) : (
        <span className="fb-muted-dash">—</span>
      )}
    </td>
  );
}
