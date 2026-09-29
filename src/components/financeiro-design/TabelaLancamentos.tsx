import { Fragment, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, FileText, Filter, Inbox, Search } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  formatarBRL,
  formatarData,
} from "./lancamento-tabela";

interface TabelaLancamentosProps {
  itens: LancamentoTabela[];
  filtros: FiltrosTabela;
  onFiltrar: (f: FiltrosTabela) => void;
  onDarBaixa: (lancamento: LancamentoTabela) => void;
  onAbrirDetalhe?: (lancamento: LancamentoTabela) => void;
  onEditar?: (lancamento: LancamentoTabela) => void;
  onDuplicar?: (lancamento: LancamentoTabela) => void;
  onAgendar?: (lancamento: LancamentoTabela) => void;
  onAnexar?: (lancamento: LancamentoTabela) => void;
  acoes?: React.ReactNode;
  titulo?: string;
  carregando?: boolean;
}

type Ordem = "vencimento" | "vencimento-desc" | "maior" | "menor";
const PENDENTES = ["EM_ABERTO", "EM_ATRASO", "PENDENTE", "ATRASADO"];
const R2_BASE = "https://share-brasil.com";

function urlCompleta(valor: string) {
  return /^https?:\/\//i.test(valor) ? valor : `${R2_BASE}/${valor.replace(/^\/+/, "")}`;
}

export function TabelaLancamentos({
  itens,
  filtros,
  onFiltrar,
  onDarBaixa,
  onAbrirDetalhe,
  onEditar,
  onDuplicar,
  onAgendar,
  onAnexar,
  acoes,
  titulo = "Tabela de lançamentos",
  carregando = false,
}: TabelaLancamentosProps) {
  const [ordem, setOrdem] = useState<Ordem>("vencimento");
  const [aberta, setAberta] = useState<string | null>(null);
  const total = itens.reduce((s, l) => s + l.valor, 0);
  const ordenados = [...itens].sort((a, b) => {
    if (ordem === "maior") return b.valor - a.valor;
    if (ordem === "menor") return a.valor - b.valor;
    const comparacao = (a.dataVencimento ?? "").localeCompare(b.dataVencimento ?? "");
    return ordem === "vencimento" ? comparacao : -comparacao;
  });

  return (
    <SectionCard
      titulo={titulo}
      descricao={carregando ? "Carregando…" : `${itens.length} registros · total ${formatarBRL(total)}`}
      Icon={FileText}
      acoes={acoes}
      semPadding
    >
      <div className="border-b border-border px-5 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Filtros e visualização
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={filtros.busca}
              onChange={(e) => onFiltrar({ ...filtros, busca: e.target.value })}
              placeholder="Buscar descrição, documento, categoria…"
              aria-label="Buscar lançamentos"
              className="h-9 rounded-xl pl-9"
            />
          </div>
          <select
            value={filtros.status}
            onChange={(e) => onFiltrar({ ...filtros, status: e.target.value })}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Filtrar por status"
          >
            <option value="TODOS">Todos os status</option>
            <option value="EM_ABERTO">Em aberto</option>
            <option value="EM_ATRASO">Em atraso</option>
            <option value="LIQUIDADO">Pagas / recebidas</option>
            <option value="CANCELADO">Canceladas</option>
          </select>
          <select
            value={filtros.grupo}
            onChange={(e) => onFiltrar({ ...filtros, grupo: e.target.value })}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Filtrar por grupo"
          >
            <option value="TODOS">Todos os grupos</option>
            <option value="DESPESA">Despesa</option>
            <option value="RECEITA">Receita</option>
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Ordenar lançamentos"
          >
            <option value="vencimento">Vencimento mais próximo</option>
            <option value="vencimento-desc">Vencimento mais distante</option>
            <option value="maior">Maior valor</option>
            <option value="menor">Menor valor</option>
          </select>
        </div>
      </div>

      {!carregando && itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-card-foreground">Nenhum lançamento encontrado</p>
          <p className="max-w-sm text-xs text-muted-foreground">Ajuste os filtros ou registre um novo lançamento.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[1050px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="whitespace-nowrap">Documento / emissão</TableHead>
                <TableHead className="whitespace-nowrap">Descrição</TableHead>
                <TableHead className="whitespace-nowrap">Fornecedor / cotista</TableHead>
                <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                <TableHead className="whitespace-nowrap text-right">Valor (R$)</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando lançamentos…</TableCell></TableRow>
              ) : ordenados.map((l) => {
                const pendente = PENDENTES.includes(l.status);
                const expandida = aberta === l.id;
                const documentos = l.documentos?.length
                  ? l.documentos
                  : l.documentoUrl
                    ? [{ nome: "Documento", url: l.documentoUrl }]
                    : [];
                return (
                  <Fragment key={l.id}>
                    <TableRow className={expandida ? "bg-muted/30" : "hover:bg-muted/20"}>
                      <TableCell>
                        <span className={`block h-2 w-2 rounded-full ${l.status === "EM_ATRASO" ? "bg-destructive" : pendente ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-mono text-xs font-semibold">{l.documento || "Sem número"}</p>
                        <p className="text-xs text-muted-foreground">{formatarData(l.dataEmissao ?? null)}</p>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <p className="truncate text-sm font-medium text-card-foreground">{l.descricao}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{l.categoriaNome}</p>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{l.fornecedor || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatarData(l.dataVencimento)}</TableCell>
                      <TableCell className={`whitespace-nowrap text-right font-mono text-sm font-semibold ${l.fluxo === "ENTRADA" ? "text-emerald-600" : "text-card-foreground"}`}>
                        {formatarBRL(l.valor)}
                      </TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant={expandida ? "outline" : "ghost"}
                          aria-label={expandida ? "Recolher detalhes" : "Expandir detalhes"}
                          aria-expanded={expandida}
                          onClick={() => setAberta(expandida ? null : l.id)}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandida ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandida && (
                      <TableRow className="border-b border-border bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="px-6 py-5">
                          <div className="grid gap-6 lg:grid-cols-3">
                            <section className="space-y-2">
                              <h3 className="text-[10px] font-bold uppercase tracking-wide text-primary">Documentos vinculados</h3>
                              {documentos.length ? documentos.map((documento) => (
                                <a key={`${documento.nome}-${documento.url}`} href={urlCompleta(documento.url)} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-accent">
                                  <FileText className="h-4 w-4 text-primary" /> {documento.nome} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </a>
                              )) : <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>}
                            </section>
                            <section className="space-y-2 text-xs">
                              <h3 className="text-[10px] font-bold uppercase tracking-wide text-primary">Lançamento</h3>
                              <p><span className="text-muted-foreground">Categoria:</span> {l.categoriaNome || "—"}</p>
                              {l.rateios?.length ? l.rateios.map((rateio) => <p key={rateio.id}><span className="text-muted-foreground">Rateio · {rateio.cotista_id ?? "Cotista"}:</span> {formatarBRL(Number(rateio.valor_rateado_centavos) / 100)} · {rateio.status.replace(/_/g, " ")}</p>) : <p><span className="text-muted-foreground">Identificador:</span> <span className="font-mono">{l.id}</span></p>}
                              {l.dataPagamento && <p><span className="text-muted-foreground">Liquidado em:</span> {formatarData(l.dataPagamento)}</p>}
                            </section>
                            <section className="space-y-2">
                              <h3 className="text-[10px] font-bold uppercase tracking-wide text-primary">Ações</h3>
                              <div className="flex flex-wrap gap-2">
                                {onDarBaixa && <Button size="sm" onClick={() => onDarBaixa(l)} disabled={!pendente}><CheckCircle2 className="mr-1 h-4 w-4" />{l.fluxo === "ENTRADA" ? "Registrar recebimento" : "Dar baixa"}</Button>}
                                {onAbrirDetalhe && <Button size="sm" variant="outline" onClick={() => onAbrirDetalhe(l)}>Detalhes</Button>}
                                {onEditar && <Button size="sm" variant="outline" onClick={() => onEditar(l)}>Editar</Button>}
                                {onDuplicar && <Button size="sm" variant="outline" onClick={() => onDuplicar(l)}>Duplicar</Button>}
                                {onAgendar && pendente && <Button size="sm" variant="outline" onClick={() => onAgendar(l)}>Agendar</Button>}
                                {onAnexar && <Button size="sm" variant="outline" onClick={() => onAnexar(l)}>Anexar documento</Button>}
                              </div>
                            </section>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
