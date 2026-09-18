import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FolderOpen, Plane, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstadoVazio, EtiquetaStatus, formatarMoeda } from "@/components/dashboard/ComponentesDashboard";
import { AeronavePasta } from "@/components/ui/aeronavepasta";
import { buscarMovimentacoesFinanceiras, type PastaMovimentacoesFinanceiras } from "@/lib/colaborador-api";

type Despesa = PastaMovimentacoesFinanceiras["voos"][number]["despesas"][number];
type Pasta = PastaMovimentacoesFinanceiras;
type Voo = Pasta["voos"][number];

function dataBruta(valor: string | null | undefined) {
  if (!valor) return "—";
  const data = new Date(`${valor.slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null) {
  return status ? status.replace(/_/g, " ") : "Sem status";
}

function statusTone(status: string | null): "green" | "amber" | "red" | "blue" | "violet" | "neutral" {
  const value = (status || "").toLowerCase();
  if (["pago", "aprovado", "recebido", "reembolsado"].includes(value)) return "green";
  if (["cancelado", "reprovado", "estorno"].includes(value)) return "red";
  if (["pendente", "em_aberto", "aguardando_reembolso"].includes(value)) return "amber";
  if (["enviado"].includes(value)) return "blue";
  return "neutral";
}

function DespesasTabela({ despesas }: { despesas: Despesa[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Topo da Tabela - Inspirado na imagem de referência */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground md:text-base">
            Transações Financeiras Recentes
          </h3>
          <span className="flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {despesas.length} {despesas.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      </div>

      {/* Corpo da Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-muted/5">
            <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-4">ID / Data</th>
              <th className="px-5 py-4">Descrição</th>
              <th className="px-5 py-4">Caixa</th>
              <th className="px-5 py-4">Cliente (E-mail)</th>
              <th className="px-5 py-4 text-right">Valor (R$)</th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {despesas.map((despesa) => (
              <tr 
                key={`${despesa.id}-${despesa.origem || "despesa"}`} 
                className="transition-colors hover:bg-muted/30"
              >
                {/* ID / DATA Combinados */}
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="font-medium text-foreground">
                    {despesa.numero_doc || "Sem ID"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dataBruta(despesa.data)}
                  </div>
                </td>
                
                {/* DESCRIÇÃO */}
                <td className="px-5 py-3 font-medium text-foreground">
                  {despesa.descricao || "Despesa sem descrição"}
                </td>

                {/* CAIXA - Em Verde (com adaptação para Light/Dark) */}
                <td className="px-5 py-3">
                  <span className="inline-flex items-center rounded-md bg-green-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                    {despesa.tipo_caixa || "—"}
                  </span>
                </td>

                {/* CLIENTE/SHARE - Em Azul (com adaptação para Light/Dark) */}
                <td className="px-5 py-3">
                  <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
                    {despesa.email || "—"}
                  </span>
                </td>

                {/* VALOR */}
                <td className="whitespace-nowrap px-5 py-3 text-right font-mono font-semibold text-foreground">
                  {formatarMoeda(Number(despesa.valor) || 0)}
                </td>

                {/* STATUS */}
                <td className="px-5 py-3">
                  <EtiquetaStatus tone={statusTone(despesa.status)}>
                    {statusLabel(despesa.status)}
                  </EtiquetaStatus>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MovimentacoesFinanceiras({ aoVoltar }: { aoVoltar: () => void }) {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [pastaAberta, setPastaAberta] = useState<string | null>(null);
  const [vooAberto, setVooAberto] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPastas((await buscarMovimentacoesFinanceiras()).pastas || []);
    } catch {
      setErro("Não foi possível carregar todas as movimentações financeiras.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const pastaSelecionada = useMemo(() => pastas.find((pasta) => pasta.id === pastaAberta) || null, [pastas, pastaAberta]);
  const vooSelecionado = useMemo(() => pastaSelecionada?.voos.find((voo) => voo.numero_voo === vooAberto) || null, [pastaSelecionada, vooAberto]);

  const abrirPasta = (id: string) => {
    setPastaAberta(id);
    setVooAberto(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const abrirVoo = (numero: string) => {
    setVooAberto(numero);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const voltar = () => {
    if (vooAberto) { setVooAberto(null); return; }
    if (pastaAberta) { setPastaAberta(null); return; }
    aoVoltar();
  };

  return (
    <div className="route-enter space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Financeiro / Movimentações</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Todas as movimentações financeiras</h1>
          <p className="mt-1 text-xs text-muted-foreground">Consulte despesas organizadas por cotista e número de voo.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={voltar}>
            <ArrowLeft size={14} /> Voltar
          </Button>
          <Button type="button" variant="outline" className="h-9 gap-2 text-xs" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </div>
      
      {erro && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs text-red-600">
          {erro}
        </div>
      )}
      
      {carregando ? (
        <div className="space-y-3">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : !pastaSelecionada ? (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-bold">Pastas de cotistas</p>
            <p className="mt-1 text-xs text-muted-foreground">Abra uma pasta para consultar somente os voos e despesas daquele cotista.</p>
          </div>
          {!pastas.length ? (
            <EstadoVazio label="Nenhuma movimentação financeira encontrada" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastas.map((pasta) => (
                <AeronavePasta key={pasta.id} label={pasta.nome} count={pasta.quantidade} isOpen={false} onClick={() => abrirPasta(pasta.id)} />
              ))}
            </div>
          )}
        </section>
      ) : !vooSelecionado ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pasta do cotista</p>
              <h2 className="text-xl font-extrabold tracking-tight">{pastaSelecionada.nome}</h2>
            </div>
          </div>
          {!pastaSelecionada.voos.length ? (
            <EstadoVazio label="Nenhum voo com despesas vinculadas" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pastaSelecionada.voos.map((voo) => (
                <AeronavePasta key={voo.numero_voo} label={`Voo ${voo.numero_voo}`} count={voo.quantidade} isOpen={false} onClick={() => abrirVoo(voo.numero_voo)} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Plane className="size-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{pastaSelecionada.nome}</p>
              <h2 className="text-xl font-extrabold tracking-tight">Voo {vooSelecionado.numero_voo}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{vooSelecionado.quantidade} {vooSelecionado.quantidade === 1 ? "despesa vinculada" : "despesas vinculadas"}</p>
            </div>
          </div>
          <DespesasTabela despesas={vooSelecionado.despesas} />
        </section>
      )}
    </div>
  );
}
