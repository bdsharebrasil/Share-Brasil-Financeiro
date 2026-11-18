import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudSun, FilePlus2, FolderOpen, MapPin, Route, Save } from "lucide-react";

import { BuscaVoo } from "@/components/plano/BuscaVoo";
import MapaRota from "@/components/plano/MapaRota";
import { PainelAerodromos } from "@/components/plano/PainelAerodromos";
import { PlanoIcao } from "@/components/plano/PlanoIcao";
import { ResumoVoo } from "@/components/plano/ResumoVoo";
import { Secao } from "@/components/plano/Secao";
import { TabelaSegmentos } from "@/components/plano/TabelaSegmentos";
import { usePlanoVoo } from "@/hooks/usarPlanoVoo";
import PlanosVooSalvos from "@/components/plano/PlanosVooSalvos";
import ConsultaMeteorologia from "@/components/plano/ConsultaMeteorologia";
import { buscarPlanosVoo, salvarPlanoVoo, type PlanoVooSalvo } from "@/lib/colaborador-api";

type AbaPlano = "completo" | "aerodromo" | "meteorologia" | "salvos";
type AbaCompleto = "formulario" | "rotas";

const MENU_PLANO: { id: AbaPlano; label: string; icon: typeof FilePlus2 }[] = [
  { id: "completo", label: "Criar Plano de Voo Completo", icon: FilePlus2 },
  { id: "aerodromo", label: "Informações Aeródromo", icon: MapPin },
  { id: "meteorologia", label: "Meteorologia", icon: CloudSun },
  { id: "salvos", label: "Planos de Voo Salvos", icon: FolderOpen },
];

export default function PlanoDeVoo() {
  const plano = usePlanoVoo();
  const [aba, setAba] = useState<AbaPlano>("completo");
  const [abaCompleto, setAbaCompleto] = useState<AbaCompleto>("formulario");
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
    setAba("completo");
    setAbaCompleto("formulario");
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
        coordenadas: plano.coordenadas,
        minutosReserva: plano.minutosReserva,
        minutosTaxi: plano.minutosTaxi,
        ventoKt: plano.ventoKt,
        combustivelABordo: plano.combustivelABordo,
        consultaAerodromo: plano.consultaAerodromo,
        aerodromoAtivo: plano.aerodromoAtivo,
        segmentos: plano.segmentos,
        rota: plano.rotaAisweb,
        combustivel: plano.combustivel,
        distancia_total_nm: plano.distanciaTotalNM,
        minutos_voo: plano.minutosVoo,
        salvo_em: new Date().toISOString(),
      });
      setSalvo(true);
      setMensagem("Plano de voo salvo com sucesso.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível salvar o plano de voo.");
    } finally {
      setSalvando(false);
    }
  };

  if (!plano.pronto) return <p role="status" className="p-4 text-sm text-muted-foreground">Carregando plano de voo…</p>;

  return (
    <div className="route-enter space-y-5">
      <header className="relative overflow-hidden rounded-[10px] border border-border dark:border-white/10 bg-card dark:bg-card px-6 py-[23px] text-[11px] font-light leading-[15px]  md:px-8">
        <div className="absolute right-[-8%] top-[-75%] h-[260%] w-[45%] rotate-[18deg] bg-primary/[.08]" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.055em] text-foreground md:text-4xl">Plano de voo</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground dark:text-slate-300">Preencha o formulário ICAO, consulte informações operacionais e acesse rapidamente os planos salvos.</p>
          </div>
          <button type="button" onClick={iniciarNovo} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border dark:border-white/15 bg-white/[.06] px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted">
            <FilePlus2 size={15} /> Novo plano
          </button>
        </div>
      </header>

      <nav className="grid grid-cols-2 gap-2 border-b border-border pb-3 lg:grid-cols-4" role="tablist" aria-label="Menu do plano de voo">
        {MENU_PLANO.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center text-xs font-bold transition-colors ${aba === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <Icon size={15} /> {label}
            {id === "salvos" && <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{planosSalvos.length}</span>}
          </button>
        ))}
      </nav>

      {aba === "completo" && (
        <section className="space-y-5">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Plano de voo completo">
            <button type="button" role="tab" aria-selected={abaCompleto === "formulario"} onClick={() => setAbaCompleto("formulario")} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold ${abaCompleto === "formulario" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <FilePlus2 size={15} /> Formulário ICAO
            </button>
            <button type="button" role="tab" aria-selected={abaCompleto === "rotas"} onClick={() => setAbaCompleto("rotas")} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold ${abaCompleto === "rotas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Route size={15} /> Criar rotas
            </button>
          </div>

          {abaCompleto === "formulario" ? (
            <div className="space-y-5">
              {plano.erro && <Aviso erro>{plano.erro}</Aviso>}
              {mensagem && <Aviso sucesso={salvo}>{mensagem}</Aviso>}
              <BuscaVoo
                carregando={plano.carregando || plano.carregandoSugestoes}
                selecionado={plano.contexto?.solicitacao.id}
                aoRecarregar={plano.recarregarVoos}
                erro={plano.erro}
                resumo={plano.contexto ? `${plano.contexto.solicitacao.origem} → ${plano.contexto.solicitacao.destino}` : null}
                sugestoes={plano.sugestoes}
                aoBuscar={(numero) => {
                  setSalvo(false);
                  setMensagem(null);
                  void plano.buscarVoo(numero);
                }}
              />
              {plano.contexto && <Secao titulo="Resumo do voo consultado" descricao="Dados do agendamento usados para auxiliar o preenchimento"><ResumoVoo contexto={plano.contexto} /></Secao>}
              <Secao titulo="Formulário de plano de voo ICAO" descricao="Itens 7 a 19 · revise e confirme os dados antes de encaminhar ao órgão AIS">
                <PlanoIcao formulario={plano.formulario} atualizar={plano.atualizar} />
              </Secao>
              <div className="flex justify-end border-t border-border pt-4">
                <button type="button" onClick={() => void salvar()} disabled={salvando} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  <Save size={15} /> {salvando ? "Salvando..." : salvo ? "Plano salvo" : "Salvar plano de voo"}
                </button>
              </div>
            </div>
          ) : (
            <CriarRotas plano={plano} icaos={icaos} />
          )}
        </section>
      )}

      {aba === "aerodromo" && <ConsultaAerodromo plano={plano} icaos={icaos} />}
      {aba === "meteorologia" && <ConsultaMeteorologia />}
      {aba === "salvos" && <PlanosVooSalvos planos={planosSalvos} carregando={carregandoPlanos} erro={erroPlanos} aoAbrir={(salvo) => { plano.abrirSalvo(salvo.payload); setAba("completo"); setAbaCompleto("formulario"); setSalvo(false); setMensagem(null); }} onRecarregar={() => void carregarPlanosSalvos()} />}
    </div>
  );
}

function CriarRotas({ plano, icaos }: { plano: ReturnType<typeof usePlanoVoo>; icaos: string[] }) {
  const origem = plano.formulario.adep;
  const destino = plano.formulario.ades;
  const [validacao, setValidacao] = useState("");

  const consultar = async (event: React.FormEvent) => {
    event.preventDefault();
    const adep = origem.trim().toUpperCase();
    const ades = destino.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(adep) || !/^[A-Z]{4}$/.test(ades) || adep === ades) {
      setValidacao("Informe dois códigos ICAO válidos e diferentes para os pontos A e B.");
      return;
    }
    setValidacao("");
    plano.atualizar("adep", adep);
    plano.atualizar("ades", ades);
    await plano.consultarRotaAisweb(adep, ades);
  };

  return (
    <div className="space-y-5">
      <Secao titulo="Pontos A e B" descricao="Consulte a rota publicada e veja o trecho no mapa">
        <form onSubmit={consultar} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <label className="text-xs font-semibold text-muted-foreground">Ponto A · ADEP
            <input value={origem} onChange={(e) => plano.atualizar("adep", e.target.value.toUpperCase())} maxLength={4} placeholder="SBGR" className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tracking-widest text-foreground" />
          </label>
          <Route className="hidden h-5 w-5 text-primary sm:block" />
          <label className="text-xs font-semibold text-muted-foreground">Ponto B · ADES
            <input value={destino} onChange={(e) => plano.atualizar("ades", e.target.value.toUpperCase())} maxLength={4} placeholder="SBRJ" className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tracking-widest text-foreground" />
          </label>
          <button type="submit" disabled={plano.carregando} className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">{plano.carregando ? "Consultando..." : "Consultar rota"}</button>
        </form>
        {(validacao || plano.erro) && <Aviso erro>{validacao || plano.erro}</Aviso>}
        {plano.rotaAisweb?.routes[0] && (
          <div className="mt-4 rounded-lg border border-primary/25 bg-primary/[.06] p-3 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Rota sugerida · {plano.rotaAisweb.source}</p>
            <p className="mt-1 break-words font-mono text-xs">{plano.rotaAisweb.routes[0].route}</p>
          </div>
        )}
      </Secao>

      {plano.segmentos.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Distância" value={`${plano.distanciaTotalNM.toFixed(1)} NM`} />
          <Metric label="Tempo estimado" value={`${Math.floor(plano.minutosVoo / 60).toString().padStart(2, "0")}:${Math.round(plano.minutosVoo % 60).toString().padStart(2, "0")}`} />
          <Metric label="Velocidade" value={plano.velocidadeKt ? `${plano.velocidadeKt} kt` : "—"} />
        </div>
      )}
      <Secao titulo="Mapa, régua e coordenadas" descricao="Altere o estilo do mapa, meça um trecho e consulte as coordenadas dos pontos">
        <p className="mb-3 text-xs text-muted-foreground">Traçado direto entre os aeródromos. Aerovias e procedimentos devem ser consultados nas cartas publicadas.</p>
        {plano.pontos.length ? <MapaRota pontos={plano.pontos} velocidadeKt={plano.velocidadeKt} /> : <p className="text-sm text-muted-foreground">Consulte uma rota com ADEP e ADES válidos para carregar as coordenadas e o mapa.</p>}
      </Secao>
      {plano.segmentos.length > 0 && <Secao titulo="Cálculo do trecho" descricao="Distância, proa e tempo calculados a partir das coordenadas disponíveis"><TabelaSegmentos segmentos={plano.segmentos} /></Secao>}
      <Secao titulo="Informações AISWEB/DECEA da rota" descricao="Ficha dos aeródromos, METAR/TAF, NOTAM e cartas publicadas">
        <PainelAerodromos icaos={icaos} selecionado={plano.aerodromoAtivo} aoSelecionar={plano.setAerodromoAtivo} />
      </Secao>
    </div>
  );
}

function ConsultaAerodromo({ plano, icaos }: { plano: ReturnType<typeof usePlanoVoo>; icaos: string[] }) {
  const [icao, setIcao] = useState(plano.consultaAerodromo);
  const consultado = plano.consultaAerodromo;
  const [erro, setErro] = useState("");

  const buscar = (event: React.FormEvent) => {
    event.preventDefault();
    const codigo = icao.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(codigo)) {
      setErro("Informe um código ICAO de quatro letras, por exemplo SBGR.");
      return;
    }
    setErro("");
    plano.setConsultaAerodromo(codigo);
    plano.setAerodromoAtivo(codigo);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-foreground">Informações do aeródromo</h2>
        <p className="mt-1 text-sm text-muted-foreground">Consulte dados publicados no AISWEB/DECEA, incluindo ficha, pistas, frequências, meteorologia, NOTAM e cartas.</p>
      </div>
      <form onSubmit={buscar} className="flex gap-[27px] px-2">
        <input value={icao} onChange={(event) => setIcao(event.target.value.toUpperCase())} maxLength={4} placeholder="Código ICAO · ex.: SBGR" aria-label="Código ICAO do aeródromo" className="mx-[-4px] h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-[35px] font-mono text-sm tracking-widest text-foreground" />
        <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground">Consultar</button>
      </form>
      {erro && <Aviso erro>{erro}</Aviso>}
      <PainelAerodromos icaos={[...icaos, consultado]} selecionado={plano.aerodromoAtivo} aoSelecionar={plano.setAerodromoAtivo} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-bold text-primary">{value}</p></div>;
}

function Aviso({ children, erro = false, sucesso = false }: { children: React.ReactNode; erro?: boolean; sucesso?: boolean }) {
  return <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${erro ? "border-destructive/35 bg-destructive/10 text-destructive" : sucesso ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300" : "border-primary/30 bg-primary/10 text-primary"}`}>
    {sucesso ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{children}
  </div>;
}
