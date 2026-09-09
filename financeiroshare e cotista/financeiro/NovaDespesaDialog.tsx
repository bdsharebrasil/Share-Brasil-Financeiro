import React, { useState } from 'react';
import { Building2, FileText, Layers, Plane, Plus, Repeat, Split, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
'../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { SearchableCombobox } from '../ui/SearchableCombobox';
import { DateField } from '../ui/DateField';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CampoFormulario } from './CampoFormulario';
import { categorias } from '../../data/financeiro';
import {
  opcoesAeronave,
  opcoesCategoria,
  opcoesCotista,
  opcoesFluxo,
  opcoesPeriodicidade,
  opcoesRateio } from
'../../data/opcoes';
import type { Fluxo, Lancamento, Periodicidade, TipoRateio } from '../../types/financeiro';
import { formatBRL, hoje } from '../../utils/format';

interface FormState {
  descricao: string;
  fornecedor: string;
  categoriaId: string;
  aeronaveId: string;
  cotistaId: string;
  fluxo: Fluxo;
  tipoRateio: TipoRateio;
  periodicidade: Periodicidade;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  documentoNumero: string;
  observacoes: string;
}

const INICIAL: FormState = {
  descricao: '',
  fornecedor: '',
  categoriaId: 'cat-comb',
  aeronaveId: 'ps-abc',
  cotistaId: 'rateio',
  fluxo: 'DESPESA',
  tipoRateio: 'FIXO',
  periodicidade: 'MENSAL',
  dataEmissao: hoje(),
  dataVencimento: hoje(),
  valor: 0,
  documentoNumero: '',
  observacoes: ''
};

export function NovaDespesaDialog({ onCriar }: {onCriar: (lancamento: Lancamento) => void;}) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormState>(INICIAL);
  const [erros, setErros] = useState<Record<string, string>>({});

  const set = <K extends keyof FormState,>(campo: K, valor: FormState[K]) =>
  setForm((f) => ({ ...f, [campo]: valor }));

  const rateioAtual = opcoesRateio.find((r) => r.id === form.tipoRateio)!;
  const fluxoAtual = opcoesFluxo.find((f) => f.id === form.fluxo)!;
  const periodicidadeAtual = opcoesPeriodicidade.find((p) => p.id === form.periodicidade)!;
  const categoriaAtual = categorias.find((c) => c.id === form.categoriaId)!;

  function validar(): boolean {
    const novos: Record<string, string> = {};
    if (!form.descricao.trim()) novos.descricao = 'Informe a descrição do lançamento.';
    if (!form.fornecedor.trim()) novos.fornecedor = 'Informe o fornecedor ou favorecido.';
    if (form.valor <= 0) novos.valor = 'O valor precisa ser maior que zero.';
    if (form.dataVencimento < form.dataEmissao)
    novos.dataVencimento = 'O vencimento não pode ser anterior à emissão.';
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!validar()) return;
    onCriar({
      id: `LC-2026-${Math.floor(1000 + Math.random() * 8999)}`,
      descricao: form.descricao.trim(),
      fornecedor: form.fornecedor.trim(),
      categoriaId: categoriaAtual.id,
      categoriaNome: categoriaAtual.nome,
      grupoCategoria: categoriaAtual.grupo,
      aeronaveId: form.aeronaveId,
      cotistaId: form.cotistaId === 'rateio' ? null : form.cotistaId,
      fluxo: form.fluxo,
      tipoRateio: form.tipoRateio,
      periodicidade: form.periodicidade,
      dataEmissao: form.dataEmissao,
      dataVencimento: form.dataVencimento,
      dataPagamento: null,
      valor: form.valor,
      status: 'EM_ABERTO',
      documentoNumero: form.documentoNumero || undefined,
      observacoes: form.observacoes || undefined
    });
    setForm(INICIAL);
    setErros({});
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo lançamento de despesa</DialogTitle>
          <DialogDescription>
            O lançamento entra como <strong>Em Aberto</strong> e o rateio é calculado conforme o
            tipo escolhido abaixo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submeter} className="space-y-6 py-1" noValidate>
          <fieldset className="space-y-4">
            <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-card-foreground">
              <FileText className="h-4 w-4 text-brand" aria-hidden="true" />
              Identificação
            </legend>

            <CampoFormulario
              id="descricao"
              rotulo="Descrição"
              obrigatorio
              erro={erros.descricao}
              dica="Como este lançamento aparecerá na tabela e no extrato do cotista.">
              
              <Input
                id="descricao"
                value={form.descricao}
                onChange={(e) => set('descricao', e.target.value)}
                placeholder="Ex.: Abastecimento JET A-1 — 2.400L"
                aria-invalid={!!erros.descricao}
                className="h-11 rounded-xl" />
              
            </CampoFormulario>

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoFormulario
                id="fornecedor"
                rotulo="Fornecedor / favorecido"
                obrigatorio
                erro={erros.fornecedor}
                dica="Quem emitiu a cobrança ou receberá o pagamento.">
                
                <Input
                  id="fornecedor"
                  value={form.fornecedor}
                  onChange={(e) => set('fornecedor', e.target.value)}
                  placeholder="Ex.: Air BP Aviation"
                  aria-invalid={!!erros.fornecedor}
                  className="h-11 rounded-xl" />
                
              </CampoFormulario>

              <CampoFormulario
                id="documento"
                rotulo="Nº do documento"
                dica="Nota fiscal, recibo ou contrato de referência (opcional).">
                
                <Input
                  id="documento"
                  value={form.documentoNumero}
                  onChange={(e) => set('documentoNumero', e.target.value)}
                  placeholder="NF 00000"
                  className="num h-11 rounded-xl" />
                
              </CampoFormulario>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-card-foreground">
              <Layers className="h-4 w-4 text-brand" aria-hidden="true" />
              Classificação
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <CampoFormulario
                rotulo="Categoria"
                dica={
                categoriaAtual.reembolsavel ?
                `Grupo ${categoriaAtual.grupo} · despesa reembolsável.` :
                `Grupo ${categoriaAtual.grupo} · não reembolsável.`
                }>
                
                <SearchableCombobox
                  items={opcoesCategoria}
                  value={form.categoriaId}
                  onChange={(id) => set('categoriaId', id)}
                  ariaLabel="Categoria do lançamento"
                  searchPlaceholder="Buscar categoria…"
                  icon={<Layers className="h-4 w-4" />} />
                
              </CampoFormulario>

              <CampoFormulario rotulo="Fluxo financeiro" dica={fluxoAtual.descricao}>
                <SearchableCombobox
                  items={opcoesFluxo}
                  value={form.fluxo}
                  onChange={(id) => set('fluxo', id as Fluxo)}
                  ariaLabel="Fluxo financeiro"
                  searchPlaceholder="Buscar fluxo…"
                  icon={<Split className="h-4 w-4" />} />
                
              </CampoFormulario>

              <CampoFormulario
                rotulo="Aeronave"
                dica="Define quais cotistas participam do rateio deste custo.">
                
                <SearchableCombobox
                  items={opcoesAeronave}
                  value={form.aeronaveId}
                  onChange={(id) => {
                    set('aeronaveId', id);
                    set('cotistaId', 'rateio');
                  }}
                  ariaLabel="Aeronave"
                  searchPlaceholder="Buscar prefixo ou modelo…"
                  icon={<Plane className="h-4 w-4" />} />
                
              </CampoFormulario>

              <CampoFormulario
                rotulo="Cotista responsável"
                dica={
                form.cotistaId === 'rateio' ?
                'O valor será dividido entre todos os cotistas da aeronave.' :
                'Este cotista assume integralmente a despesa.'
                }>
                
                <SearchableCombobox
                  items={opcoesCotista(form.aeronaveId)}
                  value={form.cotistaId}
                  onChange={(id) => set('cotistaId', id)}
                  ariaLabel="Cotista responsável"
                  searchPlaceholder="Buscar cotista…"
                  icon={<User className="h-4 w-4" />} />
                
              </CampoFormulario>

              <CampoFormulario rotulo="Tipo de rateio" dica={rateioAtual.descricao}>
                <SearchableCombobox
                  items={opcoesRateio}
                  value={form.tipoRateio}
                  onChange={(id) => set('tipoRateio', id as TipoRateio)}
                  ariaLabel="Tipo de rateio"
                  searchPlaceholder="Buscar tipo de rateio…"
                  icon={<Split className="h-4 w-4" />} />
                
              </CampoFormulario>

              <CampoFormulario rotulo="Periodicidade" dica={periodicidadeAtual.descricao}>
                <SearchableCombobox
                  items={opcoesPeriodicidade}
                  value={form.periodicidade}
                  onChange={(id) => set('periodicidade', id as Periodicidade)}
                  ariaLabel="Periodicidade"
                  searchPlaceholder="Buscar periodicidade…"
                  icon={<Repeat className="h-4 w-4" />} />
                
              </CampoFormulario>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-card-foreground">
              <Building2 className="h-4 w-4 text-brand" aria-hidden="true" />
              Valores e prazos
            </legend>

            <div className="grid gap-4 sm:grid-cols-3">
              <CampoFormulario rotulo="Data de emissão" dica="Data do documento fiscal.">
                <DateField
                  value={form.dataEmissao}
                  onChange={(iso) => set('dataEmissao', iso)}
                  ariaLabel="Data de emissão"
                  atalhos={false} />
                
              </CampoFormulario>

              <CampoFormulario
                rotulo="Data de vencimento"
                erro={erros.dataVencimento}
                dica="Prazo limite para dar baixa sem entrar em atraso.">
                
                <DateField
                  value={form.dataVencimento}
                  onChange={(iso) => set('dataVencimento', iso)}
                  ariaLabel="Data de vencimento" />
                
              </CampoFormulario>

              <CampoFormulario
                id="valor"
                rotulo="Valor total"
                obrigatorio
                erro={erros.valor}
                dica="Valor bruto do documento, antes do rateio.">
                
                <CurrencyInput
                  id="valor"
                  value={form.valor}
                  onChange={(v) => set('valor', v)}
                  ariaLabel="Valor total"
                  invalido={!!erros.valor} />
                
              </CampoFormulario>
            </div>

            <CampoFormulario
              id="obs"
              rotulo="Observações"
              dica="Referência de voo, centro de custo ou qualquer detalhe adicional.">
              
              <Textarea
                id="obs"
                rows={3}
                value={form.observacoes}
                onChange={(e) => set('observacoes', e.target.value)}
                placeholder="Informações complementares…"
                className="rounded-xl" />
              
            </CampoFormulario>
          </fieldset>

          <div className="rounded-xl border border-brand/40 bg-brand-soft/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Resumo do rateio
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-card-foreground">
              <strong className="num">{formatBRL(form.valor)}</strong> de{' '}
              <strong>{categoriaAtual.nome}</strong>, com rateio{' '}
              <strong>{rateioAtual.label.toLowerCase()}</strong>,{' '}
              {form.cotistaId === 'rateio' ?
              'dividido entre todos os cotistas da aeronave' :
              'cobrado integralmente do cotista selecionado'}
              , vencendo em{' '}
              <strong className="num">
                {form.dataVencimento.split('-').reverse().join('/')}
              </strong>
              .
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar lançamento</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);

}