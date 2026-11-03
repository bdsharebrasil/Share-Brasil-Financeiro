import { useQuery } from "@tanstack/react-query";
import {
  buscarAbastecimentoOpcoes,
  buscarContatosShare,
  buscarHoteisShare,
} from "@/lib/colaborador-api";
import { buscarFornecedoresFavoritos } from "@/lib/financeiro-share-api";

export type FornecedorSource = "agenda" | "combustivel" | "favorito" | "hotel";

export interface FornecedorOption {
  id: string;
  nome: string;
  origem: FornecedorSource;
}

interface UseFornecedoresOptions {
  includeFavorites?: boolean;
  includeHotels?: boolean;
  favoriteCategory?: string;
  enabled?: boolean;
}

const getName = (record: Record<string, unknown>, origem: FornecedorSource) => {
  const apelido = typeof record.apelido === "string" ? record.apelido.trim() : "";
  if (origem === "favorito" && apelido) return apelido;

  const name = [
    record.nome_fornecedor,
    record.empresa,
    record.razao_social,
    record.nome_fantasia,
    record.fantasia,
    record.nome,
    record.nome_completo,
    record.apelido,
    record.nome_empresa,
    record.nome_contato,
    record.nome_contato_responsavel,
  ].find((value) => typeof value === "string" && value.trim());

  return typeof name === "string" ? name.trim() : "";
};

async function loadSource(
  origem: FornecedorSource,
  fetchRecords: () => Promise<unknown[]>,
  category?: string,
): Promise<FornecedorOption[]> {
  try {
    const records = await fetchRecords();
    return records
      .map((record) => {
        const dados = record as Record<string, unknown>;
        const nome = getName(dados, origem);
        const categoria = String(dados.categoria ?? dados.categoria_fornecedor ?? "");
        if (category && categoria !== category) return null;
        if (!nome) return null;

        return {
          id: `${origem}:${String(dados.id ?? nome)}`,
          nome,
          origem,
        };
      })
      .filter((fornecedor): fornecedor is FornecedorOption => fornecedor !== null);
  } catch (error) {
    console.warn(`Erro ao buscar fornecedores de ${origem}:`, error);
    return [];
  }
}

export function useFornecedores({ includeFavorites = false, includeHotels = false, favoriteCategory, enabled = true }: UseFornecedoresOptions = {}) {
  return useQuery({
    queryKey: ["fornecedores-search", includeFavorites, includeHotels, favoriteCategory],
    queryFn: async () => {
      const sources = await Promise.all([
        ...(includeFavorites ? [loadSource("favorito", async () => await buscarFornecedoresFavoritos(), favoriteCategory)] : []),
        ...(includeHotels ? [loadSource("hotel", buscarHoteisShare)] : []),
        loadSource("combustivel", async () => (await buscarAbastecimentoOpcoes()).fornecedores),
        loadSource("agenda", buscarContatosShare),
      ]);

      const byName = new Map<string, FornecedorOption>();
      sources.flat().forEach((fornecedor) => {
        const key = fornecedor.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!byName.has(key)) byName.set(key, fornecedor);
      });

      return Array.from(byName.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}