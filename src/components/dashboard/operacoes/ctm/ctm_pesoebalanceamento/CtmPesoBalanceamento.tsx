import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buscarPainelAgendamento,
  type AeronaveAgendamento,
  type CtmRegistro,
  type SolicitacaoVooInterna,
} from "@/lib/colaborador-api";
import { usePesoBalanceamento } from "./hooks/usePesoBalanceamento";
import { useFichaPesoBalanceamento } from "./hooks/useFichaPesoBalanceamento";
import FormularioPesoBalanceamento from "./aeronave/FormularioPesoBalanceamento";
import ListaFichasPesoBalanceamento from "./fichas/ListaFichasPesoBalanceamento";
import { GraficoEnvelope, pontosEnvelope } from "./componentes/GraficoEnvelope";

const formatar = (valor: unknown, unidade: string) =>
  valor != null && Number.isFinite(Number(valor))
    ? Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " " + unidade
    : "—";

export default function CtmPesoBalanceamento({
  aeronaveId,
  aeronave,
  podeEditar,
}: {
  aeronaveId: string;
  aeronave?: CtmRegistro | null;
  podeEditar: boolean;
}) {
  const [aba, setAba] = useState("aeronave");
  const [formulario, setFormulario] = useState(false);
  const [voos, setVoos] = useState<SolicitacaoVooInterna[]>([]);
  const [carregandoVoos, setCarregandoVoos] = useState(true);
  const [erroVoos, setErroVoos] = useState("");
  const peso = usePesoBalanceamento(aeronaveId);
  const fichas = useFichaPesoBalanceamento();
  const configuracao = peso.configuracoes.find((item) => item.aeronave_id === aeronaveId);
  const pontos = pontosEnvelope(configuracao ?? null);
  const matricula = aeronave?.matricula_registro || configuracao?.matricula_registro;
  const aeronaves = aeronave && aeronave.id === aeronaveId ? [aeronave as AeronaveAgendamento] : [];

  const carregarVoos = useCallback(async () => {
    setCarregandoVoos(true);
    setErroVoos("");
    try {
      const painel = await buscarPainelAgendamento();
      setVoos(painel.agendamentos.filter((item) => item.aeronave_id === aeronaveId));
    } catch (erro) {
      setErroVoos(erro instanceof Error ? erro.message : "Não foi possível carregar os agendamentos.");
    } finally {
      setCarregandoVoos(false);
    }
  }, [aeronaveId]);

  useEffect(() => {
    if (aba === "fichas") void carregarVoos();
  }, [aba, carregarVoos]);
  const metricas = [
    { nome: "Peso básico vazio", valor: configuracao?.peso_vazio_padrao, unidade: "kg" },
    { nome: "Peso máx. de decolagem", valor: configuracao?.peso_maximo_decolagem, unidade: "kg" },
    { nome: "Peso máx. de pouso", valor: configuracao?.peso_maximo_pouso, unidade: "kg" },
    { nome: "Peso máx. sem combustível", valor: configuracao?.peso_maximo_sem_combustivel, unidade: "kg" },
  ];

  return (
    <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList className="h-auto flex-wrap gap-1 rounded-xl p-1">
        <TabsTrigger value="aeronave" className="gap-2 rounded-lg px-3 py-2">
          <Scale size={15} /> Base da aeronave
        </TabsTrigger>
        <TabsTrigger value="fichas" className="gap-2 rounded-lg px-3 py-2">
          <ClipboardList size={15} /> Fichas de voo
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aeronave" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div>
            <h3 className="font-semibold">{matricula || "Aeronave selecionada"}</h3>
            <p className="text-sm text-muted-foreground">
              {configuracao?.numero_relatorio_pesagem || "Documentação de peso e balanceamento"}
            </p>
          </div>
          <Button
            className="gap-2 rounded-xl"
            disabled={!podeEditar || !aeronaves.length || peso.carregando || !!peso.erro}
            onClick={() => setFormulario(true)}
          >
            {configuracao ? <Pencil size={15} /> : <Plus size={16} />}
            {configuracao ? "Editar configuração" : "Cadastrar configuração"}
          </Button>
          {!podeEditar && (
            <p className="w-full text-xs text-muted-foreground">
              Perfil de consulta. O cadastro está disponível para CTM, Operações e gestão autorizada.
            </p>
          )}
        </div>
        {peso.erro && (
          <p role="alert" className="rounded-xl border bg-card p-4 text-sm text-destructive">
            {peso.erro}{" "}
            <Button variant="link" onClick={() => void peso.recarregar()}>
              Tentar novamente
            </Button>
          </p>
        )}
        {peso.carregando ? (
          <div role="status" className="flex items-center gap-2 rounded-2xl border bg-card p-5 text-sm">
            <Loader2 className="animate-spin" size={16} /> Carregando configuração…
          </div>
        ) : (
          !peso.erro && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {metricas.map(({ nome, valor, unidade }) => (
                  <div key={nome} className="rounded-xl border bg-card p-3">
                    <span className="text-xs text-muted-foreground">{nome}</span>
                    <strong className="mt-1 block text-lg tabular-nums">{formatar(valor, unidade)}</strong>
                  </div>
                ))}
              </div>
              <GraficoEnvelope
                pontos={pontos}
                avaliavel={configuracao?.validado === true || configuracao?.validado === 1}
                pesoVazio={
                  configuracao && configuracao.braco_cg_padrao != null
                    ? { cg: Number(configuracao.braco_cg_padrao), peso: Number(configuracao.peso_vazio_padrao) }
                    : undefined
                }
              />
            </>
          )
        )}
        <Dialog open={formulario} onOpenChange={setFormulario}>
          {formulario && (
            <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Configuração de peso e balanceamento</DialogTitle>
                <DialogDescription>{matricula}</DialogDescription>
              </DialogHeader>
              <FormularioPesoBalanceamento
                aeronaveFixa={aeronaveId}
                aeronaves={aeronaves}
                inicial={configuracao}
                salvar={peso.salvar}
                fechar={() => setFormulario(false)}
              />
            </DialogContent>
          )}
        </Dialog>
      </TabsContent>
      <TabsContent value="fichas" className="space-y-3">
        {(fichas.erro || erroVoos) && (
          <p role="alert" className="rounded-xl border bg-card p-4 text-sm text-destructive">
            {fichas.erro || erroVoos}{" "}
            <Button
              variant="link"
              onClick={() => {
                void fichas.recarregar();
                void carregarVoos();
              }}
            >
              Tentar novamente
            </Button>
          </p>
        )}
        {carregandoVoos || fichas.carregando ? (
          <div role="status" className="flex items-center gap-2 rounded-2xl border bg-card p-5 text-sm">
            <Loader2 className="animate-spin" size={16} /> Carregando fichas de voo…
          </div>
        ) : (
          <ListaFichasPesoBalanceamento
            fichas={fichas.fichas.filter((item) => item.aeronave_id === aeronaveId)}
            voos={voos}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
