import { useState } from "react";
import {
  enviarDocumentoInterno, enviarDocumentoCliente, enviarDocumentoSocioShare,
  enviarLogoCliente, enviarLogoHolding,
} from "@/lib/colaborador-api";
import { LinhaAnexo, type CategoriaAnexo } from "./LinhaAnexo";

const CATEGORIAS: readonly CategoriaAnexo[] = [
  { value: "cartao-cnpj", label: "Cartão CNPJ" },
  { value: "comprovante-endereco", label: "Comprovante de endereço" },
  { value: "contrato-share", label: "Contrato Share" },
  { value: "contrato-social", label: "Contrato social" },
  { value: "documentos-pessoais", label: "Documentos pessoais" },
  { value: "inscricao-estadual", label: "Inscrição estadual" },
];

type BaseProps = {
  enviarArquivo: (arquivo: File, categoria: string) => Promise<unknown>;
  aoConcluir?: () => void | Promise<void>;
  comCategoria?: boolean;
  accept?: string;
  label?: string;
};

function AnexoGerenciado({ enviarArquivo, aoConcluir, comCategoria, accept, label }: BaseProps) {
  const [arquivo, setArquivo] = useState<File>();
  const [categoria, setCategoria] = useState("documentos-pessoais");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviar() {
    if (!arquivo || enviando) return;
    setEnviando(true); setErro(null); setSucesso(null);
    try {
      await enviarArquivo(arquivo, categoria);
      setArquivo(undefined); setSucesso("Arquivo enviado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
      setEnviando(false);
      return;
    }
    // Uma falha de atualização não deve incentivar reenviar um arquivo já salvo.
    try { await aoConcluir?.(); }
    catch { setSucesso("Arquivo enviado. Atualize a tela para visualizar a lista mais recente."); }
    finally { setEnviando(false); }
  }

  return <div style={{ width: "100%", minWidth: 0 }}>
    <LinhaAnexo arquivo={arquivo} aoSelecionar={(file) => { setArquivo(file); setErro(null); setSucesso(null); }}
      aoEnviar={enviar} enviando={enviando} label={label} accept={accept}
      categorias={comCategoria ? CATEGORIAS : undefined} categoria={categoria}
      aoMudarCategoria={(value) => { setCategoria(value); setErro(null); setSucesso(null); }} erro={erro} />
    {sucesso && <p role="status" style={{ margin: "8px 0 0", fontSize: 13, color: "#b8c9db", overflowWrap: "anywhere" }}>{sucesso}</p>}
  </div>;
}

type Finalizacao = { aoConcluir?: () => void | Promise<void> };

/** Substitui a antiga linha de input file + botão na pasta de documentos. */
export function AnexoPasta({ pastaId, aoConcluir }: { pastaId: string } & Finalizacao) {
  return <AnexoGerenciado enviarArquivo={(file) => enviarDocumentoInterno(file, pastaId)} aoConcluir={aoConcluir} />;
}

/** Use tipo="logo" na aba Dados e tipo="documento" na aba Documentos. */
export function AnexoCliente({ clienteId, holding = false, tipo = "documento", aoConcluir }:
  { clienteId: string; holding?: boolean; tipo?: "documento" | "logo" } & Finalizacao) {
  return <AnexoGerenciado comCategoria={tipo === "documento"} accept={tipo === "logo" ? "image/*" : undefined}
    label={tipo === "logo" ? "Logo (opcional)" : "Documento do cliente"} aoConcluir={aoConcluir}
    enviarArquivo={(file, categoria) => tipo === "logo"
      ? holding ? enviarLogoHolding(clienteId, file) : enviarLogoCliente(clienteId, file)
      : enviarDocumentoCliente(clienteId, file, categoria)} />;
}

export function AnexoSocio({ socioId, aoConcluir }: { socioId: string } & Finalizacao) {
  return <AnexoGerenciado comCategoria label="Documento do sócio" aoConcluir={aoConcluir}
    enviarArquivo={(file, categoria) => enviarDocumentoSocioShare(socioId, file, categoria)} />;
}
