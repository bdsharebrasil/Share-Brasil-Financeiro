import { useMemo, useState } from "react";
import { MousePointerClick, SearchX } from "lucide-react";
import type { EnvioPagamento } from "@/lib/colaborador-api";
import { EnvioFolderCard, type EnvioFolder } from "./EnvioFolderCard";
import { HistoryToolbar, type OpcaoFiltroStatus } from "./HistoryToolbar";
import { RequestDetail } from "./RequestDetail";
import { SummaryStrip } from "./SummaryStrip";
import { STATUS_PENDENTES, chaveStatus, estaPendente, rotuloStatus, type TipoEnvio } from "./status";

type HistoricoEnviosProps = {
  envios: EnvioPagamento[];
  carregando: boolean;
  rotuloTipo: (tipo: TipoEnvio) => string;
  restauracaoId: string | null;
  conversaoId: string | null;
  onAbrirPendente: (envio: EnvioPagamento) => void;
  onRecuperarConversao: (envio: EnvioPagamento) => void;
};

const TODOS = "todos";
const PENDENTES = "pendentes";

export function HistoricoEnvios({
  envios,
  carregando,
  rotuloTipo,
  restauracaoId,
  conversaoId,
  onAbrirPendente,
  onRecuperarConversao,
}: HistoricoEnviosProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(TODOS);
  const [pastasFechadas, setPastasFechadas] = useState<TipoEnvio[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtrosAtivos = query.trim() !== "" || status !== TODOS;

  const opcoesStatus = useMemo<OpcaoFiltroStatus[]>(() => {
    const contagem = new Map<string, number>();
    for (const envio of envios) {
      const chave = chaveStatus(envio.status);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    const individuais = Array.from(contagem)
      .filter(([chave]) => !STATUS_PENDENTES.includes(chave))
      .map(([chave, count]) => ({ value: chave, label: rotuloStatus(chave), count }));
    return [
      { value: TODOS, label: "Todos", count: envios.length },
      { value: PENDENTES, label: "Pendentes", count: envios.filter((envio) => estaPendente(envio.status)).length },
      ...individuais,
    ];
  }, [envios]);

  const filtrados = useMemo(() => {
    const termo = query.trim().toLowerCase();
    return envios.filter((envio) => {
      if (status === PENDENTES && !estaPendente(envio.status)) return false;
      if (status !== TODOS && status !== PENDENTES && chaveStatus(envio.status) !== status) return false;
      if (!termo) return true;
      return [envio.descricao, envio.fornecedor, envio.categoria_nome, envio.numero_voo, envio.observacoes, envio.criado_por]
        .some((campo) => (campo ?? "").toLowerCase().includes(termo));
    });
  }, [envios, query, status]);

  const pastas = useMemo<EnvioFolder[]>(() => {
    const porTipo = new Map<TipoEnvio, EnvioPagamento[]>();
    for (const envio of filtrados) porTipo.set(envio.tipo, [...(porTipo.get(envio.tipo) ?? []), envio]);
    return Array.from(porTipo, ([tipo, itens]) => ({
      tipo,
      rotulo: rotuloTipo(tipo),
      itens,
      total: itens.reduce((soma, envio) => soma + Number(envio.valor), 0),
      pendentes: itens.filter((envio) => estaPendente(envio.status)).length,
    }));
  }, [filtrados, rotuloTipo]);

  const resumo = useMemo(() => ({
    valor: envios.reduce((soma, envio) => soma + Number(envio.valor), 0),
    valorEmAberto: envios.filter((envio) => estaPendente(envio.status)).reduce((soma, envio) => soma + Number(envio.valor), 0),
    registros: envios.length,
    tipos: new Set(envios.map((envio) => envio.tipo)).size,
    share: envios.filter((envio) => envio.tipo === "share").length,
    emails: envios.filter((envio) => envio.email_enviado).length,
  }), [envios]);

  const selecionado = useMemo(() => envios.find((envio) => envio.id === selectedId) ?? null, [envios, selectedId]);

  const alternarPasta = (tipo: TipoEnvio) =>
    setPastasFechadas((atual) => (atual.includes(tipo) ? atual.filter((item) => item !== tipo) : [...atual, tipo]));

  const limparFiltros = () => {
    setQuery("");
    setStatus(TODOS);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[.16em]">Histórico de programação</p>
        <span className="text-[10px] text-muted-foreground">{envios.length} registro(s)</span>
      </div>

      {carregando ? (
        <div className="space-y-2">
          <div className="skeleton h-9 rounded-sm" />
          <div className="skeleton h-9 rounded-sm" />
        </div>
      ) : envios.length === 0 ? (
        <p className="rounded-sm border border-border bg-card/60 p-6 text-center text-[11px] text-muted-foreground">Nenhum lançamento enviado ainda.</p>
      ) : (
        <>
          <SummaryStrip {...resumo} />

          <HistoryToolbar
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            opcoesStatus={opcoesStatus}
            resultLabel={`${filtrados.length} de ${envios.length} programações`}
          />

          {pastas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-card/60 px-6 py-12 text-center">
              <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-[11px] font-bold text-foreground">Nenhuma programação encontrada</p>
              <p className="max-w-sm text-[10px] text-muted-foreground">Ajuste a busca ou o filtro de status para ver os envios registrados.</p>
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-1 rounded-sm border border-border bg-secondary px-3 py-1.5 text-[10px] font-bold text-foreground transition-colors duration-150 ease-out hover:border-primary/40"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
              <div className="space-y-3">
                {pastas.map((folder) => (
                  <EnvioFolderCard
                    key={folder.tipo}
                    folder={folder}
                    open={filtrosAtivos || !pastasFechadas.includes(folder.tipo)}
                    onToggle={alternarPasta}
                    selectedId={selecionado?.id ?? null}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>

              <div className="xl:sticky xl:top-6">
                {selecionado ? (
                  <RequestDetail
                    envio={selecionado}
                    rotulo={rotuloTipo(selecionado.tipo)}
                    onClose={() => setSelectedId(null)}
                    restaurando={restauracaoId === selecionado.id}
                    convertendo={conversaoId === selecionado.id}
                    onAbrirPendente={onAbrirPendente}
                    onRecuperarConversao={onRecuperarConversao}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                    <MousePointerClick className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="text-[11px] font-bold text-foreground">Nenhuma programação selecionada</p>
                    <p className="max-w-xs text-[10px] text-muted-foreground">Abra uma pasta e escolha uma programação para ver a trilha completa.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
