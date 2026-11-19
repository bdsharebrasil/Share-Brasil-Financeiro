export function ContaBancariaCell({
  contaBancaria,
}: {
  contaBancaria: string | null | undefined;
}) {
  return (
    <td title={contaBancaria}>
      {contaBancaria || "—"}
    </td>
  );
}
