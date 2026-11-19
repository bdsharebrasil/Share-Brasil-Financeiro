import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvisoGestao } from "@/components/colaboradores/ComponentesColaboradores";
import type { FichaColaborador } from "@/lib/colaborador-api";
import { mensagemGestao } from "@/lib/gestao-colaboradores";
import {
  formatarCpf,
  formatarTelefone,
  TIPOS_CONTA,
  TIPOS_CHAVE_PIX,
} from "@/lib/cadastro-colaborador";
import {
  CAMPOS_EDICAO_FICHA,
  montarAlteracoesFicha,
  type EscopoEdicaoFicha,
} from "@/lib/edicao-ficha-colaborador";

type PerfilEditavel = FichaColaborador["perfil"];

const departamentos = [
  "Operações",
  "Coordenador de Voo",
  "Tripulante",
  "Piloto Chefe",
  "Financeiro",
  "Financeiro Master",
  "Administrativo",
];

function valorInicial(perfil: PerfilEditavel, campo: string): string | boolean {
  const registro = perfil as unknown as Record<string, unknown>;
  const valor =
    campo === "departamento"
      ? registro.departamento || registro.departamentos_email
      : registro[campo];
  if (campo === "exame_admissional_realizado") {
    return valor === true || valor === 1 || valor === "1" || valor === "true";
  }
  if (campo === "cpf") return formatarCpf(String(valor || ""));
  if (campo === "telefone") return formatarTelefone(String(valor || ""));
  return valor == null ? "" : String(valor);
}

export function EditorFichaColaborador({
  perfil,
  escopo,
  onClose,
  onSave,
}: {
  perfil: PerfilEditavel;
  escopo: EscopoEdicaoFicha;
  onClose: () => void;
  onSave: (alteracoes: Record<string, unknown>) => Promise<void>;
}) {
  const [valores, setValores] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      CAMPOS_EDICAO_FICHA[escopo].map((campo) => [
        campo,
        valorInicial(perfil, campo),
      ]),
    ),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const titulo = escopo === "pessoal" ? "Editar dados pessoais" : "Editar dados profissionais";
  const alterar = (campo: string, valor: string | boolean) =>
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
  const texto = (campo: string) => String(valores[campo] ?? "");
  const houveMudanca = (campo: string) =>
      Object.prototype.hasOwnProperty.call(
      montarAlteracoesFicha(escopo, perfil as unknown as Record<string, unknown>, valores),
      campo,
    );

  const campo = (
    nome: string,
    rotulo: string,
    opcoes: { tipo?: string; largo?: boolean; placeholder?: string } = {},
  ) => (
    <label
      key={nome}
      className={`space-y-1.5 text-sm ${opcoes.largo ? "md:col-span-2" : ""}`}
    >
      <span className="font-medium">{rotulo}</span>
      <input
        id={`editar-colaborador-${nome}`}
        type={opcoes.tipo || "text"}
        value={texto(nome)}
        placeholder={opcoes.placeholder}
        onChange={(event) => {
          let value = event.target.value;
          if (nome === "cpf") value = formatarCpf(value);
          if (nome === "telefone") value = formatarTelefone(value);
          alterar(nome, value);
        }}
        aria-invalid={Boolean(erros[nome])}
        aria-describedby={erros[nome] ? `erro-${nome}` : undefined}
        className="rh-input"
      />
      {erros[nome] && (
        <span id={`erro-${nome}`} className="rh-field-error" role="alert">
          {erros[nome]}
        </span>
      )}
    </label>
  );
  const seletor = (
    nome: string,
    rotulo: string,
    opcoes: Array<{ value: string; label: string }>,
    vazio?: string,
  ) => (
    <label key={nome} className="space-y-1.5 text-sm">
      <span className="font-medium">{rotulo}</span>
      <select
        id={`editar-colaborador-${nome}`}
        value={texto(nome)}
        onChange={(event) => alterar(nome, event.target.value)}
        className="rh-input"
      >
        {vazio && <option value="">{vazio}</option>}
        {opcoes.map((opcao) => (
          <option value={opcao.value} key={opcao.value}>
            {opcao.label}
          </option>
        ))}
      </select>
    </label>
  );
  const validar = (alteracoes: Record<string, unknown>) => {
    const novosErros: Record<string, string> = {};
    if (escopo === "pessoal") {
      if (houveMudanca("nome_completo") && !texto("nome_completo").trim()) {
        novosErros.nome_completo = "Informe o nome completo.";
      }
      if (
        houveMudanca("cpf") &&
        texto("cpf").trim() &&
        texto("cpf").replace(/\D/g, "").length !== 11
      ) {
        novosErros.cpf = "Informe os 11 números do CPF.";
      }
      if (
        houveMudanca("telefone") &&
        texto("telefone").trim() &&
        ![10, 11].includes(texto("telefone").replace(/\D/g, "").length)
      ) {
        novosErros.telefone = "Informe o DDD e o telefone com 10 ou 11 números.";
      }
    } else {
      if (
        (houveMudanca("departamento") || houveMudanca("canac")) &&
        texto("departamento") === "Tripulante" &&
        !texto("canac").trim()
      ) {
        novosErros.canac = "Informe o CANAC do tripulante.";
      }
      const alterouExame = Object.keys(alteracoes).some((chave) =>
        chave.startsWith("exame_admissional_"),
      );
      if (alterouExame) {
        const camposObrigatorios = valores.exame_admissional_realizado
          ? ["exame_admissional_data", "exame_admissional_local", "exame_admissional_empresa"]
          : ["exame_admissional_prazo"];
        for (const chave of camposObrigatorios) {
          if (!texto(chave).trim()) {
            novosErros[chave] = "Preencha este campo para salvar os dados do exame.";
          }
        }
      }
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    const normalizados = Object.fromEntries(
      Object.entries(valores).map(([chave, valor]) => [
        chave,
        typeof valor === "string"
          ? chave === "uf"
            ? valor.trim().toUpperCase()
            : valor.trim()
          : valor,
      ]),
    );
    const alteracoes = montarAlteracoesFicha(
      escopo,
      perfil as unknown as Record<string, unknown>,
      normalizados,
    );
    if (!validar(alteracoes)) return;
    if (!Object.keys(alteracoes).length) {
      onClose();
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await onSave(alteracoes);
      onClose();
    } catch (cause) {
      setErro(mensagemGestao(cause, "Não foi possível salvar as alterações. Tente novamente."));
    } finally {
      setSalvando(false);
    }
  }

  const selecaoComValorAtual = (campoNome: string, lista: string[]) => {
    const valor = texto(campoNome);
    const opcoes = [...new Set([...lista, ...(valor && !lista.includes(valor) ? [valor] : [])])];
    return opcoes.map((item) => ({ value: item, label: item }));
  };

  const complementoPessoal: ReactNode = (
    <>
      {seletor(
        "tipo_conta",
        "Tipo de conta",
        [
          ...TIPOS_CONTA.map((item) => ({ value: item.value, label: item.label })),
          ...(texto("tipo_conta") && !TIPOS_CONTA.some((item) => item.value === texto("tipo_conta"))
            ? [{ value: texto("tipo_conta"), label: texto("tipo_conta") }]
            : []),
        ],
        "Selecione",
      )}
      {seletor(
        "tipo_chave_pix",
        "Tipo de chave Pix",
        [
          ...TIPOS_CHAVE_PIX.map((item) => ({ value: item.value, label: item.label })),
          ...(texto("tipo_chave_pix") && !TIPOS_CHAVE_PIX.some((item) => item.value === texto("tipo_chave_pix"))
            ? [{ value: texto("tipo_chave_pix"), label: texto("tipo_chave_pix") }]
            : []),
        ],
        "Sem chave Pix",
      )}
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <div className="space-y-1 pr-8">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {escopo === "pessoal"
              ? "Atualize somente as informações exibidas na aba Dados pessoais."
              : "Atualize somente lotação, admissão e informações profissionais do colaborador."}
          </DialogDescription>
        </div>
        {erro && <AvisoGestao erro>{erro}</AvisoGestao>}
        <form onSubmit={(event) => void enviar(event)} className="space-y-5">
          {escopo === "pessoal" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {campo("nome_completo", "Nome completo", { largo: true })}
              {campo("nome_exibicao", "Nome de exibição")}
              {campo("data_nascimento", "Data de nascimento", { tipo: "date" })}
              {campo("cpf", "CPF", { placeholder: "000.000.000-00" })}
              {campo("rg", "RG")}
              {campo("telefone", "Telefone", { tipo: "tel", placeholder: "(00) 00000-0000" })}
              {campo("endereco", "Endereço", { largo: true })}
              {campo("cidade", "Cidade")}
              {campo("uf", "UF", { placeholder: "Ex.: SP" })}
              {campo("nome_banco", "Banco")}
              {complementoPessoal}
              {campo("agencia_numero", "Agência")}
              {campo("conta_numero", "Número da conta")}
              {campo("pix", "Chave Pix", { largo: true })}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {seletor(
                "departamento",
                "Departamento",
                selecaoComValorAtual("departamento", departamentos),
                "Selecione o departamento",
              )}
              {campo("data_admissao", "Data de admissão", { tipo: "date" })}
              {seletor(
                "status",
                "Situação",
                selecaoComValorAtual("status", ["ativo", "inativo", "ferias"]),
                "Selecione a situação",
              )}
              {campo("canac", "CANAC", { placeholder: "Registro profissional" })}
              <label className="space-y-1.5 text-sm md:col-span-2">
                <span className="font-medium">Situação do exame admissional</span>
                <select
                  value={valores.exame_admissional_realizado ? "sim" : "nao"}
                  onChange={(event) =>
                    alterar("exame_admissional_realizado", event.target.value === "sim")
                  }
                  className="rh-input"
                >
                  <option value="nao">Pendente</option>
                  <option value="sim">Realizado</option>
                </select>
              </label>
              {valores.exame_admissional_realizado ? (
                <>
                  {campo("exame_admissional_data", "Data do exame", { tipo: "date" })}
                  {campo("exame_admissional_local", "Local do exame")}
                  {campo("exame_admissional_empresa", "Empresa responsável", { largo: true })}
                </>
              ) : (
                campo("exame_admissional_prazo", "Prazo para realizar o exame", { tipo: "date", largo: true })
              )}
              <p className="text-xs text-muted-foreground md:col-span-2">
                O comprovante e os demais documentos podem ser enviados ou atualizados na aba Documentos.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              className="rh-btn"
              onClick={onClose}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button type="submit" className="rh-btn rh-btn-primary" disabled={salvando}>
              {salvando ? <Loader2 size={15} className="rh-spin" /> : <Save size={15} />}
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
