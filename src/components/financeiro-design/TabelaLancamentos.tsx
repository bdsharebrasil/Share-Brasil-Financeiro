import { CheckCircle2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type FiltrosTabela,
  type LancamentoTabela,
  formatarBRL,
  formatarData,
} from "./lancamento-tabela";
import { TabelaFinanceiraPremium, type FiltroTabelaFinanceira, type LinhaTabelaFinanceira } from "./TabelaFinanceiraPremium";

interface TabelaLancamentosProps {
  itens: LancamentoTabela[];
  filtros: FiltrosTabela;
  onFiltrar: (f: FiltrosTabela) => void;
  onDarBaixa: (lancamento: LancamentoTabela) => void;
  onAbrirDetalhe?: (lancamento: LancamentoTabela) => void;
  onEditar?: (lancamento: LancamentoTabela) => void;
  onDuplicar?: (lancamento: LancamentoTabela) => void;
  onAgendar?: (lancamento: LancamentoTabela) => void;
  onAnexar?: (lancamento: LancamentoTabela) => void;
  acoes?: React.ReactNode;
  titulo?: string;
  carregando?: boolean;
  itensTotais?: LancamentoTabela[];
  resumo?: string;
}

const PENDENTES = ["EM_ABERTO", "EM_ATRASO", "PENDENTE", "ATRASADO"];
const OPCOES_STATUS = [
  { id: "TODOS", label: "Todos" },
  { id: "EM_ABERTO", label: "A pagar" },
  { id: "PAGO", label: "Pagos" },
  { id: "EM_ATRASO", label: "Vencidos" },
];

function grupoStatus(status: string): string {
  if (["EM_ATRASO", "ATRASADO"].includes(status)) return "EM_ATRASO";
  if (["PENDENTE", "EM_ABERTO"].includes(status)) return "EM_ABERTO";
  return status;
}

function rotuloStatus(status: string): { label: string; tone: LinhaTabelaFinanceira["tomStatus"] } {
  if (status === "PAGO") return { label: "Pago", tone: "emerald" };
  if (status === "EM_ATRASO" || status === "ATRASADO") return { label: "Vencido", tone: "red" };
  if (status === "AGENDADO") return { label: "Agendado", tone: "blue" };
  if (status === "CANCELADO") return { label: "Cancelado", tone: "muted" };
  return { label: "A pagar", tone: "amber" };
}

export function TabelaLancamentos({
  itens,
  filtros,
  onFiltrar,
  onDarBaixa,
  onAbrirDetalhe,
  onEditar,
  onDuplicar,
  onAgendar,
  onAnexar,
  acoes,
  titulo = "Contas a pagar",
  carregando = false,
  itensTotais = itens,
  resumo,
}: TabelaLancamentosProps) {
  const counts = new Map<string, number>([["TODOS", itensTotais.length]]);
  itensTotais.forEach((item) => {
    const grupo = grupoStatus(item.status);
    counts.set(grupo, (counts.get(grupo) ?? 0) + 1);
  });
  const opcoes: FiltroTabelaFinanceira[] = OPCOES_STATUS.map((opcao) => ({
    ...opcao,
    quantidade: counts.get(opcao.id) ?? 0,
  }));
  const linhas: LinhaTabelaFinanceira[] = itens.map((lancamento) => {
    const status = rotuloStatus(lancamento.status);
    const pendente = PENDENTES.includes(lancamento.status);
    const menu = onEditar || onDuplicar || onAgendar || onAnexar ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" aria-label={`Mais ações para ${lancamento.descricao}`} className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEditar && <DropdownMenuItem onSelect={() => onEditar(lancamento)}>Editar</DropdownMenuItem>}
          {onDuplicar && <DropdownMenuItem onSelect={() => onDuplicar(lancamento)}>Duplicar</DropdownMenuItem>}
          {onAgendar && pendente && <DropdownMenuItem onSelect={() => onAgendar(lancamento)}>Agendar pagamento</DropdownMenuItem>}
          {onAnexar && <DropdownMenuItem onSelect={() => onAnexar(lancamento)}>Anexar documento</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;
    const acoesLinha = (
      <div className="flex items-center justify-end gap-1.5">
        {onAbrirDetalhe && <Button type="button" size="sm" variant="ghost" onClick={() => onAbrirDetalhe(lancamento)} className="h-8 px-2.5 text-[11px]">Detalhes</Button>}
        {pendente ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onDarBaixa(lancamento)} className="h-8 gap-1.5 whitespace-nowrap px-2.5 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Baixar
          </Button>
        ) : <span className="whitespace-nowrap px-2 text-[10px] text-muted-foreground">Liquidado</span>}
        {menu}
      </div>
    );

    return {
      id: lancamento.id,
      principal: lancamento.fornecedor && lancamento.fornecedor !== "—" ? lancamento.fornecedor : lancamento.descricao,
      secundaria: lancamento.descricao,
      categoria: lancamento.categoriaNome,
      vencimento: formatarData(lancamento.dataVencimento),
      valor: formatarBRL(lancamento.valor),
      status: lancamento.status,
      statusLabel: status.label,
      tomStatus: status.tone,
      acoes: acoesLinha,
    };
  });

  const filtroAtivo = filtros.status === "TODOS" ? "TODOS" : grupoStatus(filtros.status);
  const descricao = carregando
    ? "Carregando lançamentos…"
    : `${itensTotais.length} ${itensTotais.length === 1 ? "lançamento" : "lançamentos"} · ${resumo ?? `total ${formatarBRL(itensTotais.reduce((total, item) => total + item.valor, 0))}`}`;

  return (
    <TabelaFinanceiraPremium
      titulo={titulo}
      descricao={descricao}
      linhas={linhas}
      filtros={opcoes}
      filtroAtivo={filtroAtivo}
      aoFiltrar={(id) => onFiltrar({ ...filtros, status: id })}
      busca={filtros.busca}
      aoBuscar={(busca) => onFiltrar({ ...filtros, busca })}
      placeholderBusca="Buscar fornecedor, descrição ou documento"
      carregando={carregando}
      mensagemVazia="Nenhuma conta a pagar encontrada."
      acaoCabecalho={acoes}
    />
  );
}
