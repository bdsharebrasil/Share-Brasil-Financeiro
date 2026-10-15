import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FilePlus2, FolderOpen, Route, Save } from "lucide-react";

import { BuscaVoo } from "@/components/plano/BuscaVoo";
import { Combustivel } from "@/components/plano/Combustivel";
import MapaRota from "@/components/plano/MapaRota";
import NotamLeituraAjuda from "@/components/plano/NotamLeituraAjuda";
import { PainelAerodromos } from "@/components/plano/PainelAerodromos";
import { PlanoIcao } from "@/components/plano/PlanoIcao";
import { ResumoVoo } from "@/components/plano/ResumoVoo";
import { Secao } from "@/components/plano/Secao";
import { TabelaSegmentos } from "@/components/plano/TabelaSegmentos";
import { usePlanoVoo } from "@/hooks/usarPlanoVoo";
import PlanosVooSalvos from "@/components/plano/PlanosVooSalvos";
import { buscarPlanosVoo, salvarPlanoVoo, type PlanoVooSalvo } from "@/lib/colaborador-api";

type AbaPlano = "novo" | "salvos";

export default function PlanoDeVoo() {
  const plano = usePlanoVoo();
  const [aba, setAba] = useState<AbaPlano>("novo");
  const [planosSalvos, setPlanosSalvos] = useState<PlanoVooSalvo[]>([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState(false);
  const [erroPlanos, setErroPlanos] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregarPlanosSalvos = useCallback(async () => {
    setCarregandoPlanos(true);
    setErroPlanos(null);
    try {
      setPlanosSalvos(await buscarPlanosVoo());
    } catch (error) {
      setErroPlanos(error instanceof Error ? error.message : "Não foi possível carregar os planos salvos.");
    } finally {
      setCarregandoPlanos(false);
    }
  }, []);

  useEffect(() => {
    if (aba === "salvos") void carregarPlanosSalvos();
  }, [aba, carregarPlanosSalvos]);

  const icaos = useMemo(
    () => [plano.formulario.adep, plano.formulario.ades, plano.formulario.alternado1, plano.formulario.alternado2],
    [plano.formulario.adep, plano.formulario.ades, plano.formulario.alternado1, plano.formulario.alternado2],
  );

  const iniciarNovo = () => {
    plano.resetar();
    setSalvo(false);
    setMensagem(null);
  };

  const salvar = async () => {
    const adep = plano.formulario.adep.trim().toUpperCase();
    const ades = plano.formulario.ades.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(adep) || !/^[A-Z]{4}$/.test(ades)) {
      setMensagem("Informe ADEP e ADES com códigos ICAO de quatro letras antes de salvar.");
      return;
    }
    if (adep === ades) {
      setMensagem("ADEP e ADES precisam ser aeródromos diferentes.");
      return;
    }

    setSalvando(true);
    setMensagem(null);
    try {
      await salvarPlanoVoo({
        numero_voo: plano.formulario.identificacao || null,
        adep,
        ades,
        data_voo: plano.formulario.dataVoo || null,
        eobt: plano.formulario.eobt || null,
        form: plano.formulario,
        contexto: plano.contexto,
        segmentos: plano.segmentos,
        rota: plano.rotaAisweb,
        combustivel: plano.combustivel,
        distancia_total_nm: plano.distanciaTotalNM,
        minutos_voo: plano.minutosVoo,
        salvo_em: new Date().toISOString(),
      });
      setSalvo(true);
      setMensagem("Plano de voo salvo com sucesso.");
      if (aba === "salvos") void carregarPlanosSalvos();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível salvar o plano de voo.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="route-enter space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101c2c] p-6 shadow-[0_18px_55px_rgba(0,0,0,.2)] md:p-8">
        <div className="absolute right-[-8%] top-[-75%] h-[260%] w-[45%] rotate-[18deg] bg-primary/[.08]" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Operações · ICAO FPL</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.055em] text-white md:text-4xl">Planos de voo</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Monte um briefing operacional ICAO ou consulte os planos já salvos pela equipe.</p>
          </div>
          <button type="button" onClick={iniciarNovo} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[.06] px-4 text-xs font-bold text-white transition-colors hover:bg-white/[.12]">
            <FilePlus2 size={15} /> Novo plano
          </button>
        </div>
      </header>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Planos de voo">
        <button type="button" role="tab" aria-selected={aba === "novo"} onClick={() => setAba("novo")} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${aba === "novo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <FilePlus2 size={15} /> Novo plano
        </button>
        <button type="button" role="tab" aria-selected={aba === "salvos"} onClick={() => setAba("salvos")} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition-colors ${aba === "salvos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <FolderOpen size={15} /> Planos salvos
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{planosSalvos.length}</span>
        </button>
      </div>
      {aba === "salvos" ? <PlanosVooSalvos planos={planosSalvos} carregando={carregandoPlanos} erro={erroPlanos} onRecarregar={() => void carregarPlanosSalvos()} /> : <>

      {plano.erro && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{plano.erro}</span>
        </div>
      )}
      {mensagem && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${salvo ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-primary/30 bg-primary/10 text-primary"}`}>
          {salvo ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {mensagem}
        </div>
      )}

      <BuscaVoo
        carregando={plano.carregando}
        erro={plano.erro}
        resumo={plano.contexto ? `${plano.contexto.solicitacao.origem} → ${plano.contexto.solicitacao.destino}` : null}
        sugestoes={plano.sugestoes}
        aoBuscar={(numero) => {
          setSalvo(false);
          setMensagem(null);
          void plano.buscarVoo(numero);
        }}
      />

      {plano.contexto && (
        <Secao titulo="Resumo do voo consultado" descricao="Dados do agendamento usados para preencher o FPL">
          <ResumoVoo contexto={plano.contexto} />
        </Secao>
      )}

      <Secao titulo="Plano de voo ICAO" descricao="Itens 7 a 19 · revise os dados antes de salvar">
        <PlanoIcao formulario={plano.formulario} atualizar={plano.atualizar} />
      </Secao>

      <Secao
        titulo="Rota e navegação"
        descricao="Consulte a rota AISWEB/DECEA e acompanhe os cálculos do trecho"
        acessorio={
          <button type="button" onClick={() => void plano.consultarRotaAisweb()} disabled={plano.carregando} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
            <Route size={14} /> Consultar rota
          </button>
        }
      >
        {plano.rotaAisweb?.routes[0] && (
          <div className="mb-4 rounded-lg border border-primary/25 bg-primary/[.06] p-3 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Rota sugerida · {plano.rotaAisweb.source}</p>
            <p className="mt-1 font-mono text-xs">{plano.rotaAisweb.routes[0].route}</p>
          </div>
        )}
        <TabelaSegmentos segmentos={plano.segmentos} />
      </Secao>

      <Secao titulo="Combustível e autonomia" descricao="Estimativa com reserva, táxi, vento e combustível a bordo">
        <Combustivel
          consumoHora={plano.consumoHora}
          minutosVoo={plano.minutosVoo}
          minutosReserva={plano.minutosReserva}
          minutosTaxi={plano.minutosTaxi}
          ventoKt={plano.ventoKt}
          combustivelABordo={plano.combustivelABordo}
          velocidadeSolo={plano.velocidadeSolo}
          distanciaTotalNM={plano.distanciaTotalNM}
          resultado={plano.combustivel}
          setMinutosReserva={plano.setMinutosReserva}
          setMinutosTaxi={plano.setMinutosTaxi}
          setVentoKt={plano.setVentoKt}
          setCombustivelABordo={plano.setCombustivelABordo}
        />
      </Secao>

      <Secao titulo="Mapa da rota" descricao="Rota, pontos, meteorologia e régua de navegação" abertaInicialmente={Boolean(plano.pontos.length)}>
        {plano.pontos.length ? (
          <MapaRota pontos={plano.pontos} velocidadeKt={plano.velocidadeKt} />
        ) : (
          <p className="text-sm text-muted-foreground">Informe ADEP e ADES com coordenadas cadastradas para abrir o mapa.</p>
        )}
      </Secao>

      <Secao titulo="Painel operacional" descricao="METAR, TAF, NOTAM, cartas e dados publicados para os aeródromos" abertaInicialmente={false}>
        <PainelAerodromos icaos={icaos} />
      </Secao>

      <Secao titulo="Orientação de NOTAM" abertaInicialmente={false}>
        <NotamLeituraAjuda />
      </Secao>

      <div className="flex justify-end border-t border-border pt-4">
        <button type="button" onClick={() => void salvar()} disabled={salvando} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
          <Save size={15} /> {salvando ? "Salvando..." : salvo ? "Plano salvo" : "Salvar plano de voo"}
        </button>
      </div>
      </>}
    </div>
  );
}
