export type Saldo = { id: string; nome: string; dominio: string; devidoCentavos: number; pagoCentavos: number; saldoCentavos: number };
export type Linha = { id: string; participanteId: string; dominio: string; origemChave: string; competencia: string; categoria: string; descricao: string; tipo: string; devido: number };
export type Balanco = { inicio: string; fim: string; aeronaveId: string; status: 'PRELIMINAR'; saldos: Saldo[]; linhas: Linha[]; avisos: string[]; compensacoes: { deId: string; paraId: string; valorCentavos: number }[] };
export const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);
export function validarResposta(raw: unknown): Balanco {
  const b = raw as Balanco;
  if (!b || !Array.isArray(b.saldos) || !Array.isArray(b.linhas) || !Array.isArray(b.compensacoes) || !Array.isArray(b.avisos) || b.avisos.some(a => typeof a !== 'string') || typeof b.inicio !== 'string' || typeof b.fim !== 'string' || typeof b.aeronaveId !== 'string') throw Error('Resposta incompatível com o balanço mensal.');
  const integer = (n: number, signed = false) => Number.isSafeInteger(n) && (signed || n >= 0);
  const ids = new Set<string>();
  for (const s of b.saldos) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.nome !== 'string' || typeof s.dominio !== 'string' || !integer(s.devidoCentavos) || !integer(s.pagoCentavos) || !integer(s.saldoCentavos, true) || s.saldoCentavos !== s.pagoCentavos - s.devidoCentavos) throw Error('Saldos inconsistentes na resposta.');
    ids.add(s.id);
  }
  const rows = new Set<string>();
  for (const r of b.linhas) {
    if (!r || typeof r.id !== 'string' || rows.has(r.id) || !ids.has(r.participanteId) || !integer(r.devido) || ['dominio','origemChave','competencia','categoria','descricao','tipo'].some(k => typeof r[k as keyof Linha] !== 'string')) throw Error('Rateio inválido na resposta.');
    rows.add(r.id);
  }
  for (const c of b.compensacoes) if (!c || !ids.has(c.deId) || !ids.has(c.paraId) || c.deId === c.paraId || !integer(c.valorCentavos)) throw Error('Compensação inválida.');
  return b;
}
export function somar(valores: number[]) {
  const total = valores.reduce((a,b) => a+b,0);
  if (!Number.isSafeInteger(total)) throw Error('Total acima do limite seguro.');
  return total;
}
export function resumir(b: Balanco) {
  const saldos = b.saldos.filter(s => s.dominio === 'CLIENTES');
  const ids = new Set(saldos.map(s => s.id));
  const linhas = b.linhas.filter(r => r.dominio === 'CLIENTES' && ids.has(r.participanteId));
  const categorias = [...new Set(linhas.map(r => r.categoria))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  const custo = somar(saldos.map(s => s.devidoCentavos)), pago = somar(saldos.map(s => s.pagoCentavos));
  if (somar(linhas.map(r => r.devido)) !== custo) throw Error('Custos detalhados não conciliam com os saldos.');
  return { saldos, linhas, categorias, custo, pago, diferenca: custo-pago, compensacoes: b.compensacoes.filter(c => ids.has(c.deId) && ids.has(c.paraId)) };
}
export function csv(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(v => '"'+String(v).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')+'"').join(';')).join('\r\n');
}
