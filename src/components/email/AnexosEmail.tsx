"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  FileText,
  Fuel,
  Paperclip,
  Plus,
  Receipt,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { AnexoEmail } from "@/lib/colaborador-api";

type Props = {
  anexos: AnexoEmail[];
  selecionados: string[];
  onAlternar: (id: string) => void;

  arquivosNovos?: File[];
  onAdicionarArquivos?: (arquivos: File[]) => void;
  onRemoverArquivo?: (index: number) => void;

  somenteArquivosLocais?: boolean;
};

type Grupo = {
  chave: string;
  titulo: string;
  icone: typeof Receipt;
  origens: string[];
};

const grupos: Grupo[] = [
  {
    chave: "recibos",
    titulo: "Recibos",
    icone: Receipt,
    origens: ["recibo"],
  },
  {
    chave: "abastecimentos",
    titulo: "Abastecimentos",
    icone: Fuel,
    origens: ["abastecimento"],
  },
];

const EXTENSOES_ACEITAS =
  ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt";

export function AnexosEmail({
  anexos,
  selecionados,
  onAlternar,
  arquivosNovos = [],
  onAdicionarArquivos,
  onRemoverArquivo,
  somenteArquivosLocais = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  /**
   * Agrupa os anexos vindos da API.
   */
  const anexosPorGrupo = useMemo(() => {
    return grupos
      .map((grupo) => {
        const itens = anexos.filter((anexo) =>
          grupo.origens.includes(anexo.origem),
        );

        return {
          grupo,
          itens,
        };
      })
      .filter(({ itens }) => itens.length > 0);
  }, [anexos]);

  /**
   * Mapa para evitar ficar usando .find() toda vez
   * que renderiza os chips.
   */
  const anexosPorId = useMemo(() => {
    return new Map(anexos.map((anexo) => [anexo.id, anexo]));
  }, [anexos]);

  const totalSelecionado = selecionados.length + arquivosNovos.length;

  const nomeAnexo = (id: string) => {
    return anexosPorId.get(id)?.nome ?? id;
  };

  /**
   * Seleciona / remove documento sem fechar o Popover.
   */
  const alternarAnexo = (id: string) => {
    onAlternar(id);
  };

  /**
   * Abre o seletor nativo do sistema.
   *
   * É importante disparar o .click() diretamente
   * a partir da interação do usuário.
   */
  const abrirSeletorDeArquivo = () => {
    inputRef.current?.click();

    // Fechamos o seletor de documentos depois.
    setOpen(false);
    setBusca("");
  };

  /**
   * Recebe arquivos locais selecionados.
   */
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      onAdicionarArquivos?.(files);
    }

    /**
     * Permite selecionar novamente o mesmo arquivo.
     */
    event.target.value = "";
  };

  const handleOpenChange = (novoEstado: boolean) => {
    setOpen(novoEstado);

    if (!novoEstado) {
      setBusca("");
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border/60 bg-card/30 p-3">
      {/* =========================================================
          ANEXOS SELECIONADOS
      ========================================================= */}

      {totalSelecionado > 0 && (
        <div className="flex max-h-20 flex-wrap items-center gap-1.5 overflow-y-auto pr-1">
          {/* Documentos existentes */}
          {selecionados.map((id) => (
            <span
              key={`anexo-${id}`}
              className="
                inline-flex max-w-full items-center gap-1.5
                rounded-md
                border border-sky-500/30
                bg-sky-500/10
                px-2 py-1
                text-[10px] font-medium text-sky-300
              "
            >
              <FileText
                size={11}
                className="shrink-0"
              />

              <span
                className="max-w-[180px] truncate"
                title={nomeAnexo(id)}
              >
                {nomeAnexo(id)}
              </span>

              <button
                type="button"
                aria-label={`Remover ${nomeAnexo(id)}`}
                onClick={() => onAlternar(id)}
                className="
                  shrink-0 rounded-sm
                  text-sky-400/70
                  transition-colors
                  hover:text-sky-100
                  focus:outline-none
                  focus:ring-1
                  focus:ring-sky-400
                "
              >
                <X size={11} />
              </button>
            </span>
          ))}

          {/* Arquivos locais */}
          {arquivosNovos.map((arquivo, index) => (
            <span
              key={`arquivo-local-${arquivo.name}-${arquivo.size}-${index}`}
              className="
                inline-flex max-w-full items-center gap-1.5
                rounded-md
                border border-emerald-500/30
                bg-emerald-500/10
                px-2 py-1
                text-[10px] font-medium text-emerald-300
              "
            >
              <FileText
                size={11}
                className="shrink-0"
              />

              <span
                className="max-w-[180px] truncate"
                title={arquivo.name}
              >
                {arquivo.name}
              </span>

              {onRemoverArquivo && (
                <button
                  type="button"
                  aria-label={`Remover ${arquivo.name}`}
                  onClick={() => onRemoverArquivo(index)}
                  className="
                    shrink-0 rounded-sm
                    text-emerald-400/70
                    transition-colors
                    hover:text-emerald-100
                    focus:outline-none
                    focus:ring-1
                    focus:ring-emerald-400
                  "
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* =========================================================
          SELETOR DE ANEXOS
      ========================================================= */}

      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={open}
            className="
              h-8 w-fit gap-2
              rounded-md
              border-border dark:border-white/[.08]
              bg-card dark:bg-[#0d1525]
              px-3
              text-[10px] font-semibold text-muted-foreground dark:text-slate-300
              transition-colors
              hover:bg-white/[.06]
              hover:text-white
            "
          >
            <Paperclip
              size={13}
              className="shrink-0"
            />

            <span>Anexar arquivos</span>

            {totalSelecionado > 0 && (
              <span
                className="
                  flex min-w-5 items-center justify-center
                  rounded-md bg-[#1d639f]
                  px-1.5 py-0.5
                  text-[9px] font-bold text-white
                "
              >
                {totalSelecionado}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={16}
          className="
            z-[100]
            w-[min(440px,calc(100vw-2rem))]
            overflow-hidden
            rounded-xl
            border border-border dark:border-white/[.08]
            bg-card dark:bg-[#0b1220]
            p-0
            shadow-2xl
          "
          onOpenAutoFocus={(event) => {
            /**
             * O CommandInput já assume o foco.
             * Evita conflito de foco quando este componente
             * está dentro de outro Dialog.
             */
            event.preventDefault();
          }}
        >
          <Command
            shouldFilter
            className="bg-transparent"
          >
            {/* BUSCA */}
            {!somenteArquivosLocais && (
              <CommandInput
                value={busca}
                onValueChange={setBusca}
                placeholder="Buscar recibos, despesas ou abastecimentos..."
                className="h-11 text-xs"
              />
            )}

            <CommandList className="max-h-[360px] overflow-y-auto overflow-x-hidden">
              <CommandEmpty>
                <div className="flex flex-col items-center gap-1 py-6 text-center">
                  <FileText
                    size={22}
                    className="text-muted-foreground/50"
                  />

                  <span className="text-xs text-muted-foreground">
                    Nenhum documento encontrado.
                  </span>
                </div>
              </CommandEmpty>

              {/* =================================================
                  COMPUTADOR
              ================================================= */}

              <CommandGroup heading="Computador">
                <CommandItem
                  value="upload computador anexar arquivo novo local"
                  onSelect={abrirSeletorDeArquivo}
                  className="
                    cursor-pointer
                    gap-2
                    py-2.5
                    text-xs
                    aria-selected:bg-white/[.06]
                  "
                >
                  <div
                    className="
                      flex size-7 shrink-0
                      items-center justify-center
                      rounded-md
                      bg-white/[.05]
                      text-muted-foreground dark:text-slate-300
                    "
                  >
                    <Plus size={14} />
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-foreground dark:text-slate-200">
                      Anexar arquivo do computador
                    </span>

                    <span className="text-[10px] text-muted-foreground">
                      PDF, Word, Excel, imagem, CSV ou TXT
                    </span>
                  </div>
                </CommandItem>
              </CommandGroup>

              {/* =================================================
                  DOCUMENTOS DO SISTEMA
              ================================================= */}

              {!somenteArquivosLocais &&
                anexosPorGrupo.map(
                  ({ grupo, itens }) => {
                    const Icone = grupo.icone;

                    const quantidadeMarcada = itens.filter((item) =>
                      selecionados.includes(item.id),
                    ).length;

                    return (
                      <div key={grupo.chave}>
                        <CommandSeparator />

                        <CommandGroup
                          heading={`${grupo.titulo}${
                            quantidadeMarcada > 0
                              ? ` · ${quantidadeMarcada} selecionado${
                                  quantidadeMarcada > 1 ? "s" : ""
                                }`
                              : ""
                          }`}
                        >
                          {itens.map((anexo) => {
                            const marcado =
                              selecionados.includes(anexo.id);

                            return (
                              <CommandItem
                                key={anexo.id}

                                /**
                                 * ID incluído no value para impedir
                                 * colisão entre documentos com o mesmo nome.
                                 */
                                value={`${grupo.chave} ${anexo.id} ${anexo.nome}`}

                                onSelect={() =>
                                  alternarAnexo(anexo.id)
                                }

                                className="
                                  cursor-pointer
                                  gap-2
                                  py-2.5
                                  text-xs
                                  aria-selected:bg-white/[.06]
                                "
                              >
                                {/* ÍCONE */}
                                <div
                                  className={`
                                    flex size-7 shrink-0
                                    items-center justify-center
                                    rounded-md border
                                    transition-colors

                                    ${
                                      marcado
                                        ? "border-sky-500/40 bg-sky-500/15 text-sky-400"
                                        : "border-border dark:border-white/[.06] bg-white/[.03] text-muted-foreground dark:text-slate-400"
                                    }
                                  `}
                                >
                                  {marcado ? (
                                    <Check size={14} />
                                  ) : (
                                    <Icone size={14} />
                                  )}
                                </div>

                                {/* NOME */}
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span
                                    className={`
                                      truncate font-medium
                                      ${
                                        marcado
                                          ? "text-sky-300"
                                          : "text-foreground dark:text-slate-200"
                                      }
                                    `}
                                    title={anexo.nome}
                                  >
                                    {anexo.nome}
                                  </span>

                                  <span className="text-[10px] text-muted-foreground">
                                    {grupo.titulo}
                                  </span>
                                </div>

                                {/* CHECK DIREITO */}
                                <div
                                  className={`
                                    flex size-4 shrink-0
                                    items-center justify-center
                                    rounded border
                                    transition-all

                                    ${
                                      marcado
                                        ? "border-sky-500 bg-sky-500 text-white"
                                        : "border-border dark:border-white/15 bg-transparent"
                                    }
                                  `}
                                  aria-hidden="true"
                                >
                                  {marcado && (
                                    <Check
                                      size={10}
                                      strokeWidth={3}
                                    />
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </div>
                    );
                  },
                )}

              {/* Nenhum documento do sistema */}
              {!somenteArquivosLocais &&
                anexosPorGrupo.length === 0 &&
                busca.length === 0 && (
                  <>
                    <CommandSeparator />

                    <div className="px-4 py-5 text-center">
                      <p className="text-xs text-muted-foreground">
                        Nenhum recibo, despesa ou abastecimento
                        disponível para anexar.
                      </p>
                    </div>
                  </>
                )}
            </CommandList>

            {/* =================================================
                RODAPÉ
            ================================================= */}

            {totalSelecionado > 0 && (
              <div
                className="
                  flex items-center justify-between
                  border-t border-border dark:border-white/[.06]
                  bg-white/[.02]
                  px-3 py-2
                "
              >
                <span className="text-[10px] text-muted-foreground">
                  {totalSelecionado}{" "}
                  {totalSelecionado === 1
                    ? "arquivo selecionado"
                    : "arquivos selecionados"}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="h-7 px-2 text-[10px]"
                >
                  Concluir
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {/* =========================================================
          INPUT REAL DE ARQUIVO
      ========================================================= */}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={EXTENSOES_ACEITAS}
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
      />
    </div>
  );
}
