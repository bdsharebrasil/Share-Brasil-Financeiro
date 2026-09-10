import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Receipt, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import {
  colaboradorRequest,
  criarRecibo,
  enviarAnexoRecibo,
  enviarPdfRecibo,
  type CotistaRecibo,
  type OpcoesRecibos,
  type Recibo,
} from "@/lib/colaborador-api";
import { gerarReciboPdf } from "@/lib/reciboPdf";

type TipoDemonstrativo = "INFRAERO" | "DECEA";

type ItemDemonstrativo = {
  data: string;
  hora?: string | null;
  operacao?: string | null;
  origem?: string | null;
  destino?: string | null;
  matricula?: string | null;
  valor: number;
};

type DemonstrativoLido = {
  tipo: TipoDemonstrativo;
  numero_documento: string | null;
  competencia: string | null;
  data_faturamento: string | null;
  aeronave_matricula: string | null;
  cliente_nome: string | null;
  valor_total: number | null;
  itens: ItemDemonstrativo[];
  rateio_por_perna?: Array<ItemDemonstrativo & { responsavel: string }>;
  _meta?: { soma_itens?: number | null; precisa_revisao_manual?: boolean };
};

type LinhaRateio = ItemDemonstrativo & {
  cotistaId: string;
  responsavelSugerido: string | null;
};

type ReciboGerado = Pick<Recibo, "id" | "numero_recibo" | "nome_pagador" | "valor">;

type Props = {
  opcoes: OpcoesRecibos;
  onCancel: () => void;
  onCreated: () => Promise<void> | void;
};

const normalizar = (valor: string | null | undefined) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const moeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);

const hoje = () => new Date().toISOString().slice(0, 10);

const arquivoParaBase64 = (arquivo: File) =>
  new Promise<{ imageBase64: string; mimeType: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = String(reader.result || "");
      const base64 = resultado.split(",")[1];
      if (!base64) {
        reject(new Error("Não foi possível preparar o arquivo para leitura."));
        return;
      }
      resolve({ imageBase64: base64, mimeType: arquivo.type || "application/octet-stream" });
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.readAsDataURL(arquivo);
  });

function cotistaPorNome(cotistas: CotistaRecibo[], nome: string | null | undefined) {
  const nomeNormalizado = normalizar(nome);
  return cotistas.find((cotista) => normalizar(cotista.nome) === nomeNormalizado) || null;
}

function descricaoLinha(linha: LinhaRateio) {
  const trecho = linha.origem && linha.destino
    ? `${linha.origem} → ${linha.destino}`
    : linha.operacao || "Operação não informada";
  return [linha.data, linha.hora, trecho].filter(Boolean).join(" · ");
}

export default function ImportarDemonstrativoIA({ opcoes, onCancel, onCreated }: Props) {
  const [tipo, setTipo] = useState<TipoDemonstrativo>("INFRAERO");
  const [aeronaveId, setAeronaveId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [demonstrativo, setDemonstrativo] = useState<DemonstrativoLido | null>(null);
  const [linhas, setLinhas] = useState<LinhaRateio[]>([]);
  const [carregandoLeitura, setCarregandoLeitura] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [recibosGerados, setRecibosGerados] = useState<ReciboGerado[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const cotistas = useMemo(
    () => opcoes.cotistas.filter((cotista) => cotista.aeronave_id === aeronaveId),
    [aeronaveId, opcoes.cotistas],
  );
  const itensCotistas = useMemo(
    () => cotistas.map((cotista) => ({ id: cotista.id, label: cotista.nome })),
    [cotistas],
  );
  const categoriaSelecionada = useMemo(
    () => opcoes.categorias.find((categoria) => categoria.id === categoriaId) || null,
    [categoriaId, opcoes.categorias],
  );
  const consolidado = useMemo(() => {
    const grupos = new Map<string, { cotista: CotistaRecibo; valor: number; operacoes: number }>();
    for (const linha of linhas) {
      const cotista = cotistas.find((item) => item.id === linha.cotistaId);
      if (!cotista) continue;
      const grupo = grupos.get(cotista.id) || { cotista, valor: 0, operacoes: 0 };
      grupo.valor += Number(linha.valor) || 0;
      grupo.operacoes += 1;
      grupos.set(cotista.id, grupo);
    }
    return [...grupos.values()].map((grupo) => ({
      ...grupo,
      valor: Math.round(grupo.valor * 100) / 100,
    }));
  }, [cotistas, linhas]);
  const totalLinhas = useMemo(
    () => linhas.reduce((total, linha) => total + (Number(linha.valor) || 0), 0),
    [linhas],
  );
  const linhasSemCotista = linhas.filter((linha) => !linha.cotistaId).length;

  const selecionarAeronave = (id: string) => {
    setAeronaveId(id);
    setLinhas([]);
    setDemonstrativo(null);
    setRecibosGerados([]);
    setErro("");
    setSucesso("");
  };

  const lerDemonstrativo = async () => {
    if (!arquivo || !aeronaveId) {
      setErro("Selecione a aeronave e o demonstrativo antes de iniciar a leitura.");
      return;
    }
    setCarregandoLeitura(true);
    setErro("");
    setSucesso("");
    setRecibosGerados([]);
    try {
      const body = await arquivoParaBase64(arquivo);
      const resultado = await colaboradorRequest<DemonstrativoLido>("/api/demonstrativo-rateio", {
        method: "POST",
        body: JSON.stringify({ ...body, tipo }),
      });
      const cotistasDaAeronave = opcoes.cotistas.filter((cotista) => cotista.aeronave_id === aeronaveId);
      const itensComResponsavel = resultado.rateio_por_perna || resultado.itens.map((item) => ({ ...item, responsavel: "" }));
      const novasLinhas = itensComResponsavel.map((item) => {
        const cotista = cotistaPorNome(cotistasDaAeronave, item.responsavel);
        return {
          ...item,
          cotistaId: cotista?.id || "",
          responsavelSugerido: item.responsavel || null,
        };
      });
      setDemonstrativo(resultado);
      setLinhas(novasLinhas);
      if (!categoriaId) {
        const categoriaTarifa = opcoes.categorias.find((categoria) =>
          /tarifa|infraero|decea|navega/i.test(categoria.nome),
        );
        setCategoriaId(categoriaTarifa?.id || "");
      }
      setSucesso(`${novasLinhas.length} operação(ões) lida(s). Revise as atribuições antes de gerar os recibos.`);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Não foi possível ler o demonstrativo.");
    } finally {
      setCarregandoLeitura(false);
    }
  };

  const atualizarLinha = (indice: number, atualizacao: Partial<LinhaRateio>) => {
    setLinhas((atuais) => atuais.map((linha, index) => index === indice ? { ...linha, ...atualizacao } : linha));
  };

  const gerarPdf = async (recibo: Recibo, cotista: CotistaRecibo) => {
    const pdf = await gerarReciboPdf({
      numero: recibo.numero_recibo,
      valor: Number(recibo.valor || 0) / 100,
      descricao: recibo.descricao || "Tarifa aeronáutica rateada por voo",
      data: recibo.data_emissao,
      pagadorNome: cotista.nome,
      pagadorDocumento: cotista.cnpj || cotista.cpf,
      pagadorEndereco: cotista.endereco,
      pagadorCidade: cotista.cidade,
      pagadorUf: cotista.uf,
    });
    return new File([pdf], `recibo-${recibo.numero_recibo}.pdf`, { type: "application/pdf" });
  };

  const gerarRecibos = async () => {
    if (!demonstrativo || !aeronaveId || !categoriaSelecionada || !consolidado.length || linhasSemCotista) {
      setErro("Informe a categoria e atribua todas as linhas a um cotista antes de gerar os recibos.");
      return;
    }
    setGerando(true);
    setErro("");
    setSucesso("");
    const criados: ReciboGerado[] = [];
    try {
      for (let index = 0; index < consolidado.length; index += 1) {
        const grupo = consolidado[index];
        setProgresso(`Gerando recibo ${index + 1} de ${consolidado.length}...`);
        const descricao = [
          `Tarifa ${tipo}`,
          demonstrativo.numero_documento ? `documento ${demonstrativo.numero_documento}` : null,
          demonstrativo.competencia ? `competência ${demonstrativo.competencia}` : null,
          `${grupo.operacoes} voo(s) atribuído(s) a ${grupo.cotista.nome}`,
        ].filter(Boolean).join(" · ");
        const resposta = await criarRecibo({
          tipo_recibo: "recibo_reembolso",
          aeronave_id: aeronaveId,
          pagador_tipo: "cotista_aeronave",
          pagador_id: grupo.cotista.id,
          nome_pagador: grupo.cotista.nome,
          documento_pagador: grupo.cotista.cnpj || grupo.cotista.cpf,
          endereco_pagador: grupo.cotista.endereco,
          cidade_pagador: grupo.cotista.cidade,
          uf_pagador: grupo.cotista.uf,
          recebedor_nome: "SHARE BRASIL SERVICOS AEROPORTUARIOS",
          valor_centavos: Math.round(grupo.valor * 100),
          descricao,
          data_emissao: hoje(),
          data_vencimento: hoje(),
          categoria_movimentacao_id: categoriaSelecionada.id,
          categoria_nome: categoriaSelecionada.nome,
          grupo_categoria: categoriaSelecionada.grupo_categoria || "DESPESAS REEMBOLSÁVEIS",
          numero_documento_anexo: demonstrativo.numero_documento,
          observacoes: linhas
            .filter((linha) => linha.cotistaId === grupo.cotista.id)
            .map(descricaoLinha)
            .join("\n"),
        });
        if (arquivo) await enviarAnexoRecibo(arquivo, resposta.recibo.id);
        const pdf = await gerarPdf(resposta.recibo, grupo.cotista);
        await enviarPdfRecibo(resposta.recibo.id, pdf);
        criados.push(resposta.recibo);
      }
      setRecibosGerados(criados);
      await onCreated();
      setSucesso(`${criados.length} recibo(s) foram gerados e estão disponíveis no histórico.`);
    } catch (cause) {
      setRecibosGerados(criados);
      setErro(`${cause instanceof Error ? cause.message : "Não foi possível concluir a geração."} Os recibos já concluídos permanecem disponíveis no histórico.`);
    } finally {
      setProgresso("");
      setGerando(false);
    }
  };

  const removerArquivo = () => {
    setArquivo(null);
    if (inputArquivo.current) inputArquivo.current.value = "";
  };

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-card/60 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-secondary/20 px-5 py-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em]">Leitura automática</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Importe um demonstrativo INFRAERO ou DECEA e revise o rateio por voo.</p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel} disabled={gerando} className="h-8 gap-1.5 text-[11px]">
          <X size={14} /> Fechar
        </Button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-[11px]">
            <span className="mb-1 block font-bold text-muted-foreground">TIPO DO DEMONSTRATIVO</span>
            <select value={tipo} onChange={(event) => setTipo(event.target.value as TipoDemonstrativo)} className="campo">
              <option value="INFRAERO">INFRAERO</option>
              <option value="DECEA">DECEA</option>
            </select>
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-bold text-muted-foreground">AERONAVE</span>
            <SearchableCombobox
              items={opcoes.aeronaves.map((aeronave) => ({ id: aeronave.id, label: `${aeronave.matricula_registro}${aeronave.modelo ? ` · ${aeronave.modelo}` : ""}` }))}
              value={aeronaveId}
              onChange={selecionarAeronave}
              placeholder="Selecione a aeronave"
              searchPlaceholder="Buscar aeronave..."
              emptyMessage="Nenhuma aeronave encontrada."
            />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-bold text-muted-foreground">CATEGORIA DO RECIBO</span>
            <SearchableCombobox
              items={opcoes.categorias.map((categoria) => ({ id: categoria.id, label: categoria.nome }))}
              value={categoriaId}
              onChange={setCategoriaId}
              placeholder="Selecione a categoria"
              searchPlaceholder="Buscar categoria..."
              emptyMessage="Nenhuma categoria encontrada."
            />
          </div>
        </div>

        <div className="rounded-sm border border-dashed border-primary/45 bg-primary/[.035] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputArquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setArquivo(event.target.files?.[0] || null)}
              className="min-w-0 flex-1 text-[11px] file:mr-3 file:rounded-sm file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-[11px] file:font-bold file:text-primary"
            />
            <Button type="button" onClick={() => void lerDemonstrativo()} disabled={!arquivo || !aeronaveId || carregandoLeitura || gerando} className="h-9 gap-2 text-[11px]">
              {carregandoLeitura ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {carregandoLeitura ? "Lendo demonstrativo..." : "Ler com IA"}
            </Button>
          </div>
          {arquivo && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <FileText size={14} className="text-primary" />
              <span className="max-w-[360px] truncate font-medium text-foreground">{arquivo.name}</span>
              <button type="button" onClick={removerArquivo} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Remover arquivo">
                <X size={15} />
              </button>
            </div>
          )}
        </div>

        {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
        {sucesso && <Mensagem tipo="sucesso">{sucesso}</Mensagem>}

        {demonstrativo && (
          <>
            <div className="grid gap-3 rounded-sm border border-border bg-secondary/[.12] p-4 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
              <Dado label="Documento" valor={demonstrativo.numero_documento || "Não identificado"} />
              <Dado label="Competência" valor={demonstrativo.competencia || "Não identificada"} />
              <Dado label="Matrícula lida" valor={demonstrativo.aeronave_matricula || "Não identificada"} />
              <Dado label="Total lido" valor={moeda(demonstrativo.valor_total ?? totalLinhas)} />
            </div>

            {demonstrativo._meta?.precisa_revisao_manual && (
              <Mensagem tipo="alerta">O total extraído difere da soma das operações. Confira os valores antes de gerar os recibos.</Mensagem>
            )}

            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full min-w-[850px] text-left text-[11px]">
                <thead className="bg-secondary/40 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Data / hora</th>
                    <th className="px-3 py-2.5">Operação</th>
                    <th className="px-3 py-2.5">Cotista responsável</th>
                    <th className="px-3 py-2.5 text-right">Valor rateado</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, indice) => (
                    <tr key={`${linha.data}-${linha.hora}-${indice}`} className="border-t border-border/70">
                      <td className="px-3 py-3 text-muted-foreground">{[linha.data, linha.hora].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-3">
                        <p>{linha.origem && linha.destino ? `${linha.origem} → ${linha.destino}` : linha.operacao || "—"}</p>
                        {linha.responsavelSugerido && <p className="mt-1 text-[10px] text-primary">Diário: {linha.responsavelSugerido}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <SearchableCombobox
                          items={itensCotistas}
                          value={linha.cotistaId}
                          onChange={(cotistaId) => atualizarLinha(indice, { cotistaId })}
                          placeholder="Selecione o cotista"
                          searchPlaceholder="Buscar cotista..."
                          emptyMessage="Nenhum cotista para esta aeronave."
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number(linha.valor || 0).toFixed(2)}
                          onChange={(event) => atualizarLinha(indice, { valor: Number(event.target.value) || 0 })}
                          className="campo ml-auto w-28 text-right font-mono"
                          aria-label={`Valor rateado da operação ${indice + 1}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {linhasSemCotista > 0 && <Mensagem tipo="alerta">Há {linhasSemCotista} linha(s) sem cotista definido. Atribua todas as operações para continuar.</Mensagem>}

            <div className="rounded-sm border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold">Recibos que serão gerados</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Um recibo de reembolso para cada cotista, com os voos atribuídos.</p>
                </div>
                <strong className="text-sm">{moeda(totalLinhas)}</strong>
              </div>
              <div className="divide-y divide-border">
                {consolidado.map((grupo) => (
                  <div key={grupo.cotista.id} className="flex items-center justify-between gap-4 px-4 py-3 text-[11px]">
                    <span className="font-semibold">{grupo.cotista.nome} <span className="font-normal text-muted-foreground">· {grupo.operacoes} voo(s)</span></span>
                    <span className="font-mono font-bold">{moeda(grupo.valor)}</span>
                  </div>
                ))}
                {!consolidado.length && <p className="px-4 py-3 text-[11px] text-muted-foreground">Atribua as operações para visualizar os recibos.</p>}
              </div>
            </div>

            {recibosGerados.length > 0 && (
              <Mensagem tipo="sucesso">
                {recibosGerados.map((recibo) => `${recibo.numero_recibo} · ${recibo.nome_pagador}`).join(" | ")}
              </Mensagem>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              {progresso && <span className="mr-auto self-center text-[11px] text-muted-foreground">{progresso}</span>}
              <Button type="button" variant="outline" onClick={onCancel} disabled={gerando} className="h-9 text-[11px]">Cancelar</Button>
              <Button type="button" onClick={() => void gerarRecibos()} disabled={gerando || !categoriaId || !consolidado.length || linhasSemCotista > 0} className="h-9 gap-2 text-[11px]">
                {gerando ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                {gerando ? "Gerando recibos..." : "Gerar recibos"}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Dado({ label, valor }: { label: string; valor: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{valor}</p></div>;
}

function Mensagem({ tipo, children }: { tipo: "erro" | "sucesso" | "alerta"; children: React.ReactNode }) {
  const estilos = {
    erro: "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-200",
    sucesso: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
    alerta: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-200",
  };
  const Icon = tipo === "sucesso" ? CheckCircle2 : AlertCircle;
  return <div role={tipo === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-sm border p-3 text-[11px] ${estilos[tipo]}`}><Icon size={15} className="mt-0.5 shrink-0" /> <span>{children}</span></div>;
}
