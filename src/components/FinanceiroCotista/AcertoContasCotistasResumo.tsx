import { useMemo } from "react";
import { ArrowRight, Scale } from "lucide-react";
import { money } from "@/lib/balanco-cotista";
import {
  calcularAcertoContasCotistas,
  type FontesAcertoCotistas,
  type ResultadoAcertoCotistas,
} from "@/lib/acerto-contas-cotistas";

type Props = {
  fontes: FontesAcertoCotistas;
  erroFonte?: string | null;
  mesesSelecionados: string[];
  resultado?: ResultadoAcertoCotistas;
};

export function AcertoContasCotistasResumo({ fontes, erroFonte, mesesSelecionados, resultado }: Props) {
  const calculo = useMemo(
    () => resultado ?? calcularAcertoContasCotistas(fontes, mesesSelecionados),
    [fontes, mesesSelecionados, resultado],
  );

  if (!calculo.balanco) {
    return <><style>{CSS}</style><div className="acc-state" role="status">{erroFonte || calculo.erro || "Não foi possível calcular o acerto de contas."}</div></>;
  }

  const participantes = calculo.balanco.saldos
    .filter((participante) => participante.dominio === "CLIENTES")
    .sort((a, z) => z.devidoCentavos - a.devidoCentavos || a.nome.localeCompare(z.nome, "pt-BR"));
  const nomes = new Map(participantes.map((participante) => [participante.id, participante.nome]));
  const compensacoes = calculo.balanco.compensacoes
    .map((compensacao) => ({
      ...compensacao,
      devedor: nomes.get(compensacao.deId) ?? compensacao.deId,
      credor: nomes.get(compensacao.paraId) ?? compensacao.paraId,
    }))
    .sort((a, z) => z.valorCentavos - a.valorCentavos);
  const totalDevido = participantes.reduce((total, participante) => total + participante.devidoCentavos, 0);
  const totalPago = participantes.reduce((total, participante) => total + participante.pagoCentavos, 0);
  const saldoTotal = totalPago - totalDevido;
  const dataFim = calculo.fim?.split("-").reverse().join("/") ?? "";

  return (
    <section className="acc">
      <style>{CSS}</style>
      <header className="acc-header">
        <div>
          <div className="acc-eyebrow"><Scale size={14} /> ACERTO ENTRE COTISTAS</div>
          <p>Posição acumulada até {dataFim}; inclui competências anteriores aos meses selecionados.</p>
        </div>
        <span className="acc-badge">{compensacoes.length} {compensacoes.length === 1 ? "transferência sugerida" : "transferências sugeridas"}</span>
      </header>

      <div className="acc-metrics">
        <article><span>Devido acumulado</span><strong>{money(totalDevido)}</strong></article>
        <article><span>Pagamento pessoal confirmado</span><strong>{money(totalPago)}</strong></article>
        <article><span>Pago − devido</span><strong className={saldoTotal > 0 ? "acc-credit" : saldoTotal < 0 ? "acc-debt" : ""}>{money(saldoTotal)}</strong></article>
      </div>

      <div className="acc-people" aria-label="Resumo por cotista">
        {participantes.map((participante) => (
          <article className="acc-person" key={participante.id}>
            <div className="acc-person-header">
              <strong>{participante.nome}</strong>
              <span className={participante.saldoCentavos > 0 ? "acc-pill acc-credit" : participante.saldoCentavos < 0 ? "acc-pill acc-debt" : "acc-pill"}>
                {participante.saldoCentavos > 0 ? "Crédito" : participante.saldoCentavos < 0 ? "Débito" : "Equilibrado"}
              </span>
            </div>
            <dl className="acc-person-values">
              <div><dt>Devido</dt><dd>{money(participante.devidoCentavos)}</dd></div>
              <div><dt>Pago pessoal</dt><dd>{money(participante.pagoCentavos)}</dd></div>
              <div><dt>Saldo líquido</dt><dd className={participante.saldoCentavos > 0 ? "acc-credit" : participante.saldoCentavos < 0 ? "acc-debt" : ""}>{money(participante.saldoCentavos)}</dd></div>
            </dl>
          </article>
        ))}
        {!participantes.length && <p className="acc-empty">Não há cotistas clientes incluídos na apuração detalhada.</p>}
      </div>

      <div className="acc-transfer-section">
        <h3>Quem paga para quem</h3>
        {compensacoes.length ? (
          <div className="acc-transfers">
            {compensacoes.map((compensacao) => (
              <article className="acc-transfer" key={`${compensacao.deId}:${compensacao.paraId}`}>
                <div className="acc-party"><small>QUEM PAGA</small><strong>{compensacao.devedor}</strong></div>
                <ArrowRight size={16} aria-hidden="true" />
                <div className="acc-party"><small>QUEM RECEBE</small><strong>{compensacao.credor}</strong></div>
                <strong className="acc-amount">{money(compensacao.valorCentavos)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="acc-empty">Nenhum pagamento pessoal confirmado foi identificado cobrindo a parcela de outro cotista até esta data. O saldo negativo indica valores sem cobertura pessoal identificada; sozinho, não determina que um cotista deva esse valor a outro.</p>
        )}
      </div>

      {calculo.balanco.avisos.length > 0 && (
        <div className="acc-warnings" role="note">
          <strong>Conferir dados antes de fechar</strong>
          <ul>{calculo.balanco.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>
        </div>
      )}
      <details className="fb-more"><summary>Como o cálculo funciona</summary><p className="acc-footnote">O cálculo usa parcelas ajustadas e pagamentos pessoais confirmados, considera caixa SHARE/HOLDING separado e não registra transferências bancárias entre cotistas. Saldos positivos são créditos na apuração; negativos são débitos.</p></details>
    </section>
  );
}

const CSS = `
.acc{--acc-card:var(--fb-card,var(--bcp-card,#fff));--acc-fg:var(--fb-text,var(--bcp-fg,#14202e));--acc-muted:var(--fb-muted,var(--bcp-muted,#5d6b7b));--acc-border:var(--fb-border,var(--bcp-border,#e0e6ed));--acc-soft:var(--fb-soft,var(--bcp-soft,#eef3f9));color:var(--acc-fg);font:inherit}
.acc-state{border:1px solid var(--fb-border,var(--bcp-border,#e0e6ed));border-left:3px solid #dda633;border-radius:8px;padding:12px;color:var(--fb-muted,var(--bcp-muted,#5d6b7b));font-size:12px;line-height:1.55}
.acc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.acc-eyebrow{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.05em}.acc-header p{margin:5px 0 0;color:var(--acc-muted);font-size:12px;line-height:1.5}.acc-badge,.acc-pill{display:inline-flex;align-items:center;border-radius:999px;background:var(--acc-soft);padding:3px 9px;color:var(--acc-muted);font-size:11px;white-space:nowrap}
.acc-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}.acc-metrics article,.acc-person{min-width:0;border:1px solid var(--acc-border);border-radius:8px;background:var(--acc-card);padding:12px}.acc-metrics span,.acc-person-values dt{display:block;color:var(--acc-muted);font-size:11px}.acc-metrics strong{display:block;margin-top:5px;font-size:17px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.acc-credit{color:#16805c!important}.acc-debt{color:#c04747!important}.acc-people{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:9px}.acc-person-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.acc-person-header>strong{font-size:13px;overflow-wrap:anywhere}.acc-person-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0 0}.acc-person-values dd{margin:3px 0 0;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.acc-transfer-section{margin-top:18px}.acc-transfer-section h3{margin:0 0 9px;font-size:14px}.acc-transfers{display:grid;gap:8px}.acc-transfer{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid var(--acc-border);border-radius:8px;background:var(--acc-card);padding:11px 12px}.acc-party{min-width:0}.acc-party small{display:block;margin-bottom:3px;color:var(--acc-muted);font-size:9px;letter-spacing:.05em}.acc-party strong{display:block;font-size:12px;overflow-wrap:anywhere}.acc-amount{font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}.acc-empty{margin:0;border:1px dashed var(--acc-border);border-radius:8px;padding:12px;color:var(--acc-muted);font-size:12px;line-height:1.55}.acc-warnings{margin-top:12px;border-left:3px solid #dda633;border-radius:4px;background:var(--acc-soft);padding:10px 12px;font-size:11px}.acc-warnings ul{margin:5px 0 0;padding-left:18px}.acc-warnings li+li{margin-top:4px}.acc-footnote{margin:12px 0 0;color:var(--acc-muted);font-size:10px;line-height:1.55}
@media(max-width:520px){.acc-person-values{grid-template-columns:1fr 1fr}.acc-person-values>div:last-child{grid-column:1/-1}.acc-transfer{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.acc-amount{grid-column:1/-1;justify-self:end}}
`;