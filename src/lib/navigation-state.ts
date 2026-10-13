type MenuDefinition = { id: string };
type StorageArea = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type SavedNavigation = { ambiente: string; menuAtivo: string };

const NAVIGATION_STORAGE_KEY = "share-brasil:pagina-ativa";

export type RestoredNavigation<TEnvironment extends string> = {
  ambiente: TEnvironment;
  menuAtivo: string;
  restaurada: boolean;
};

export function restaurarNavegacao<TEnvironment extends string>(
  menusPorAmbiente: Record<TEnvironment, readonly MenuDefinition[]>,
  armazenamento: StorageArea,
): RestoredNavigation<TEnvironment> {
  const ambientePadrao = Object.prototype.hasOwnProperty.call(menusPorAmbiente, "share-brasil")
    ? "share-brasil"
    : Object.keys(menusPorAmbiente)[0];
  const padrao = {
    ambiente: ambientePadrao as TEnvironment,
    menuAtivo: "overview",
    restaurada: false,
  };

  try {
    const valor = armazenamento.getItem(NAVIGATION_STORAGE_KEY);
    if (!valor) return padrao;

    const salvo = JSON.parse(valor) as Partial<SavedNavigation>;
    const ambienteValido = typeof salvo.ambiente === "string"
      && Object.prototype.hasOwnProperty.call(menusPorAmbiente, salvo.ambiente);
    if (!ambienteValido || typeof salvo.menuAtivo !== "string") return padrao;

    const ambiente = salvo.ambiente as TEnvironment;
    const menuValido = menusPorAmbiente[ambiente].some(({ id }) => id === salvo.menuAtivo)
      || salvo.menuAtivo === "perfil"
      || (ambiente === "operacoes" && salvo.menuAtivo === "aerodromos");
    if (!menuValido) return padrao;

    return { ambiente, menuAtivo: salvo.menuAtivo, restaurada: true };
  } catch {
    return padrao;
  }
}

export function salvarNavegacao(
  armazenamento: StorageArea,
  navegacao: SavedNavigation,
): void {
  try {
    armazenamento.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(navegacao));
  } catch {
    // A navegação continua funcional mesmo se o navegador bloquear o armazenamento da sessão.
  }
}

export function limparNavegacao(armazenamento: StorageArea): void {
  try {
    armazenamento.removeItem(NAVIGATION_STORAGE_KEY);
  } catch {
    // O logout não deve falhar se o navegador bloquear o armazenamento da sessão.
  }
}
