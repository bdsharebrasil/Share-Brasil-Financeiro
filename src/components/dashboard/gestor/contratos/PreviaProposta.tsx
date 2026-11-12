import React, { useEffect, useMemo } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { PropostaGerenciamentoPdf } from './PropostaGerenciamentoPdf';
import type { EdicaoContrato } from './modelo';

export default function PreviaProposta({ edicao }: { edicao: EdicaoContrato }) {
  const documento = useMemo(
    () => <PropostaGerenciamentoPdf edicao={edicao} />,
    [edicao],
  );
  const [instancia, atualizar] = usePDF();
  useEffect(() => {
    atualizar(documento);
  }, [documento, atualizar]);
  if (instancia.error)
    return (
      <div className="ct-erro" role="alert">
        Não foi possível montar a prévia do PDF. Verifique a conexão e tente
        novamente.
        <button type="button" onClick={() => atualizar(documento)}>
          Tentar novamente
        </button>
      </div>
    );
  if (instancia.loading || !instancia.url)
    return (
      <div className="ct-vazio" role="status">
        Preparando a prévia do PDF…
      </div>
    );
  return (
    <section className="ct-pdf-previa" aria-label="Prévia do documento">
      <div className="ct-pdf-barra">
        <p>
          Esta é a mesma composição usada na emissão. O arquivo será registrado
          ao gerar e salvar o PDF.
        </p>
        <a
          className="ct-botao"
          href={instancia.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir prévia
        </a>
      </div>
      <iframe title="Prévia da proposta em PDF" src={instancia.url} />
    </section>
  );
}
