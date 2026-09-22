import { Campo } from "./Secao";
import type { FormularioIcao } from "@/lib/tipos";

export const classeEntrada =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary";

interface Props {
  formulario: FormularioIcao;
  atualizar: <C extends keyof FormularioIcao>(campo: C, valor: FormularioIcao[C]) => void;
}

export function PlanoIcao({ formulario, atualizar }: Props) {
  const texto = (campo: keyof FormularioIcao, placeholder = "", extra?: string) => (
    <input
      value={formulario[campo]}
      onChange={(e) => atualizar(campo, e.target.value.toUpperCase() as never)}
      placeholder={placeholder}
      className={`${classeEntrada} ${extra ?? ""}`}
    />
  );

  return (
    <div className="space-y-6">
      <Bloco titulo="Item 7 — Identificação da aeronave">
        <Campo rotulo="Identificação / número do voo">{texto("identificacao", "SB123")}</Campo>
      </Bloco>

      <Bloco titulo="Item 8 — Regra e tipo de voo">
        <Campo rotulo="Regra de voo">
          <select
            value={formulario.regraVoo}
            onChange={(e) => atualizar("regraVoo", e.target.value as FormularioIcao["regraVoo"])}
            className={classeEntrada}
          >
            <option value="I">I — IFR</option>
            <option value="V">V — VFR</option>
            <option value="Y">Y — IFR seguido de VFR</option>
            <option value="Z">Z — VFR seguido de IFR</option>
          </select>
        </Campo>
        <Campo rotulo="Tipo de voo">
          <select
            value={formulario.tipoVoo}
            onChange={(e) => atualizar("tipoVoo", e.target.value as FormularioIcao["tipoVoo"])}
            className={classeEntrada}
          >
            <option value="S">S — Regular</option>
            <option value="N">N — Não regular</option>
            <option value="G">G — Aviação geral</option>
            <option value="M">M — Militar</option>
            <option value="X">X — Outros</option>
          </select>
        </Campo>
      </Bloco>

      <Bloco titulo="Item 9 — Número, tipo e esteira">
        <Campo rotulo="Número de aeronaves">{texto("numeroAeronaves", "1")}</Campo>
        <Campo rotulo="Tipo da aeronave">{texto("tipoAeronave", "C56X")}</Campo>
        <Campo rotulo="Categoria de esteira">
          <select
            value={formulario.esteira}
            onChange={(e) => atualizar("esteira", e.target.value as FormularioIcao["esteira"])}
            className={classeEntrada}
          >
            <option value="L">L — Leve</option>
            <option value="M">M — Média</option>
            <option value="H">H — Pesada</option>
            <option value="J">J — Super</option>
          </select>
        </Campo>
      </Bloco>

      <Bloco titulo="Item 10 — Equipamento">
        <Campo
          rotulo="Equipamento e capacidades"
          ajuda="Formato: equipamento de comunicação/navegação, barra, vigilância. Exemplo: SDFG/LB1. Preencha conforme o equipamento real da aeronave."
        >
          {texto("equipamento", "SDFG/LB1")}
        </Campo>
      </Bloco>

      <Bloco titulo="Item 13 — Partida">
        <Campo rotulo="ADEP">{texto("adep", "SBMT")}</Campo>
        <Campo rotulo="Data do voo">
          <input
            type="date"
            value={formulario.dataVoo}
            onChange={(e) => atualizar("dataVoo", e.target.value)}
            className={classeEntrada}
          />
        </Campo>
        <Campo rotulo="EOBT (UTC)" ajuda="Sempre em UTC, formato HH:MM.">
          {texto("eobt", "13:30")}
        </Campo>
      </Bloco>

      <Bloco titulo="Item 15 — Cruzeiro">
        <Campo rotulo="Velocidade">{texto("velocidade", "N0250")}</Campo>
        <Campo rotulo="Nível">{texto("nivel", "F250")}</Campo>
        <Campo rotulo="Rota" extra="sm:col-span-3">
          <textarea
            value={formulario.rota}
            onChange={(e) => atualizar("rota", e.target.value.toUpperCase())}
            rows={2}
            className={`${classeEntrada} resize-y`}
            placeholder="DCT ..."
          />
        </Campo>
      </Bloco>

      <Bloco titulo="Item 16 — Destino, EET e alternados">
        <Campo rotulo="ADES">{texto("ades", "SBBR")}</Campo>
        <Campo rotulo="EET (HHMM)">{texto("eet", "0135")}</Campo>
        <Campo rotulo="Alternado 1">{texto("alternado1", "SBGO")}</Campo>
        <Campo rotulo="Alternado 2">{texto("alternado2")}</Campo>
      </Bloco>

      <Bloco titulo="Item 18 — Outras informações">
        <Campo
          rotulo="Outras informações"
          ajuda="Indicadores disponíveis: RMK/ RALT/ TYP/ REG/ OPR/ PBN/ NAV/ DAT/. Nada é gerado automaticamente sem dado confiável."
          extra="sm:col-span-3"
        >
          <textarea
            value={formulario.outrasInformacoes}
            onChange={(e) => atualizar("outrasInformacoes", e.target.value.toUpperCase())}
            rows={3}
            className={`${classeEntrada} resize-y`}
            placeholder="REG/PRMDL TYP/C56X RMK/..."
          />
        </Campo>
      </Bloco>

      <Bloco titulo="Item 19 — Informação suplementar">
        <Campo rotulo="Autonomia (HH:MM)">{texto("autonomia", "05:20")}</Campo>
        <Campo rotulo="Pessoas a bordo">{texto("pessoasABordo", "6")}</Campo>
        <Campo rotulo="Rádio de emergência">{texto("radioEmergencia", "UHF VHF ELT")}</Campo>
        <Campo rotulo="Equipamento de sobrevivência">{texto("sobrevivencia", "P D M J")}</Campo>
        <Campo rotulo="Coletes salva-vidas">{texto("coletes", "J L F U V")}</Campo>
        <Campo rotulo="Botes">{texto("botes")}</Campo>
        <Campo rotulo="Cor e marcas da aeronave">{texto("corAeronave")}</Campo>
        <Campo rotulo="Piloto em comando">{texto("piloto")}</Campo>
        <Campo rotulo="Observações" extra="sm:col-span-3">
          <textarea
            value={formulario.observacoes}
            onChange={(e) => atualizar("observacoes", e.target.value.toUpperCase())}
            rows={2}
            className={`${classeEntrada} resize-y`}
          />
        </Campo>
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{titulo}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}
