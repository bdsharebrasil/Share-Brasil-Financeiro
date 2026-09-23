import { useCallback, useEffect, useState } from "react";
import { buscarConfiguracoesPesoBalanceamento, salvarConfiguracaoPesoBalanceamento, type ConfiguracaoPesoBalanceamento } from "@/lib/colaborador-api";

export function usePesoBalanceamento(aeronaveId?: string) {
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoPesoBalanceamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { setConfiguracoes((await buscarConfiguracoesPesoBalanceamento(aeronaveId)).configuracoes); }
    catch (causa) { setErro(causa instanceof Error ? causa.message : "Não foi possível carregar as configurações."); }
    finally { setCarregando(false); }
  }, [aeronaveId]);
  useEffect(() => { void carregar(); }, [carregar]);
  const salvar = async (payload: Partial<ConfiguracaoPesoBalanceamento> & { aeronave_id: string }) => {
    const resposta = await salvarConfiguracaoPesoBalanceamento(payload);
    setConfiguracoes((atuais) => [resposta.configuracao, ...atuais.filter((item) => item.aeronave_id !== resposta.configuracao.aeronave_id)]);
    return resposta.configuracao;
  };
  return { configuracoes, carregando, erro, recarregar: carregar, salvar };
}
