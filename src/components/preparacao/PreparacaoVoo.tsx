import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Fuel,
  Loader2,
  Paperclip,
  Phone,
  Plane,
  Plus,
  RefreshCw,
  Send,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DragReorder from '@/components/ui/drag-reorder';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SearchableCombobox, type ComboboxItem } from '@/components/ui/searchableCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { mesclar } from './mesclar';
import './preparacao.css';

export type TransportePreparacao = {
  json: (path: string, body?: unknown) => Promise<any>;
  arquivo: (path: string) => Promise<Blob>;
  enviar: (path: string, form: FormData) => Promise<any>;
  identidade: () => Promise<string | null>;
};

type AbaPreparacao = 'aeronave' | 'coordenacao' | 'combustivel' | 'resumo';

const ROTULOS: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  NAO_REALIZADO: 'Não realizado',
  NAO_APLICAVEL: 'Não se aplica',
};

const ROTULOS_CURTOS: Array<{ id: string; label: string }> = [
  { id: 'CONCLUIDO', label: 'Feito' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento' },
  { id: 'NAO_APLICAVEL', label: 'N/A' },
  { id: 'PENDENTE', label: 'Pendente' },
];

const CAFES: Record<string, string> = {
  INCLUIDO: 'Incluído na diária',
  A_PARTE: 'Pago à parte',
  NAO_OFERECE: 'Não oferece',
  A_CONFIRMAR: 'A confirmar',
};

const BADGE_ESTADO: Record<string, string> = {
  CONCLUIDO: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  EM_ANDAMENTO: 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  PENDENTE: 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  NAO_APLICAVEL: 'border-border bg-secondary text-muted-foreground',
  NAO_REALIZADO: 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
};

const resolvido = (s: any) => ['CONCLUIDO', 'NAO_APLICAVEL'].includes(s?.estado);

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dataBR = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v);

const momento = (v: any) => {
  if (!v) return '';
  const iso = String(v).replace(' ', 'T');
  const d = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR') : String(v);
};

const clone = (v: any) => JSON.parse(JSON.stringify(v));

const mensagens: Record<string, string> = {
  sem_permissao: 'Você não tem acesso à preparação deste voo.',
  nao_autorizado: 'Entre novamente para continuar.',
  voo_nao_encontrado: 'Este voo não foi encontrado.',
  versao_desatualizada: 'Outra pessoa atualizou esta preparação. Suas alterações foram preservadas para revisão.',
  preparacao_atualizando: 'A preparação está sendo atualizada. Tente novamente em alguns instantes.',
  reserva_incompleta: 'Para enviar o e-mail, confira check-in, check-out, hóspedes, quantidade de hóspedes e telefone de contato.',
  hotel_sem_email: 'Este hotel está sem e-mail cadastrado. Você pode manter a reserva pendente e concluir a preparação.',
  voo_encerrado: 'Este voo está encerrado e disponível para consulta.',
  falha_email_reserva: 'Não foi possível enviar a solicitação. Seus dados continuam salvos; tente novamente.',
  email_indisponivel: 'O envio de e-mail está indisponível no momento.',
  anexo_invalido: 'Selecione um PDF, JPG, PNG ou WEBP de até 10 MB.',
  abastecimento_invalido: 'Confira data, combustível, litros, preço e desconto do abastecimento realizado.',
  fornecedor_invalido: 'Selecione um fornecedor de combustível cadastrado.',
  aerodromo_nao_cadastrado: 'Cadastre o aeroporto antes de registrar o abastecimento realizado.',
};

const mensagemErro = (e: any) =>
  mensagens[String(e?.message)] ||
  (/network|fetch/i.test(String(e?.message))
    ? 'Confira sua conexão. As alterações ainda não foram enviadas.'
    : 'Não foi possível concluir a ação. Tente novamente.');

function normalizarAbaInicial(aba?: string): AbaPreparacao {
  if (aba === 'tripulacao' || aba === 'coordenacao') return 'coordenacao';
  if (aba === 'combustivel') return 'combustivel';
  if (aba === 'resumo') return 'resumo';
  return 'aeronave';
}

export default function PreparacaoVoo({
  vooId,
  api,
  aoSalvar,
  aoProgresso,
  escuro = false,
  abaInicial = 'aeronave',
  painelAeronave,
}: {
  vooId: string;
  api: TransportePreparacao;
  aoSalvar?: () => void;
  aoProgresso?: (n: number) => void;
  escuro?: boolean;
  abaInicial?: string;
  painelAeronave?: ReactNode;
}) {
  const root = `/api/interno/agendamento/${encodeURIComponent(vooId)}/preparacao`;
  const [registro, setRegistro] = useState<any>(null);
  const [dados, setDados] = useState<any>(null);
  const [opcoes, setOpcoes] = useState<any>({ hoteis: [], fornecedores: [] });
  const [aba, setAba] = useState<AbaPreparacao>(() => normalizarAbaInicial(abaInicial));
  const [etapaId, setEtapaId] = useState<string>('');
  const [escala, setEscala] = useState('e1');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [sujo, setSujo] = useState(false);
  const [offline, setOffline] = useState(false);
  const [versoes, setVersoes] = useState<any[] | null>(null);
  const [conflito, setConflito] = useState<any>(null);
  const [combustivel, setCombustivel] = useState<any>(null);
  const [novoFornecedor, setNovoFornecedor] = useState<any>(null);
  const [todos, setTodos] = useState(false);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
  const [reordenandoEtapa, setReordenandoEtapa] = useState(false);
  const [hotelAberto, setHotelAberto] = useState(false);
  const [hangarAberto, setHangarAberto] = useState(false);
  const [itensAbertos, setItensAbertos] = useState<Record<string, boolean>>({});
  const [obsAbertas, setObsAbertas] = useState<Record<string, boolean>>({});

  const ref = useRef<any>(null);
  const atual = useRef<any>(null);
  const base = useRef<any>(null);
  const busy = useRef(false);
  const dirty = useRef(false);
  const sequencia = useRef(0);
  const cache = useRef('');
  const vivo = useRef(true);
  const conflitando = useRef(false);
  const enviarRef = useRef<(concluir?: boolean) => Promise<any>>(async () => null);
  const carregouRascunho = useRef(false);
  const pendenciasRef = useRef<HTMLElement>(null);
  const reqEmail = useRef<Record<string, { assinatura: string; id: string }>>({});

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const aplicar = useCallback(
    (r: any, manter = false) => {
      atual.current = r;
      base.current = clone(r.dados);
      if (!manter) {
        ref.current = clone(r.dados);
        setDados(ref.current);
        dirty.current = false;
        setSujo(false);
      }
      setRegistro(r);
      if (cache.current) {
        try {
          sessionStorage.setItem(cache.current, JSON.stringify(r));
        } catch {}
      }
      aoProgresso?.(Object.values(r.dados.itens || {}).filter((x: any) => x.estado !== 'PENDENTE').length);
    },
    [aoProgresso],
  );

  const carregar = useCallback(async () => {
    try {
      const id = await api.identidade();
      cache.current = id ? `share:preparacao:${id}:${vooId}` : '';
      const r = await api.json(root);
      if (!vivo.current || dirty.current || busy.current) return;
      aplicar(r);
      setOffline(false);
      setErro('');
      if (!carregouRascunho.current && cache.current) {
        carregouRascunho.current = true;
        try {
          const draft = JSON.parse(sessionStorage.getItem(`${cache.current}:rascunho`) || 'null');
          if (draft) {
            const l = mesclar(draft.base, draft.dados, r.dados);
            const rr = mesclar(draft.base, draft.dados, r.dados, 'remoto');
            if (l.conflitos) {
              conflitando.current = true;
              setConflito({ local: l.dados, remoto: rr.dados, total: l.conflitos });
            } else {
              ref.current = l.dados;
              setDados(l.dados);
            }
            dirty.current = true;
            setSujo(true);
            setAviso('Rascunho local recuperado. Confira as alterações antes de concluir.');
          }
        } catch {}
      }
    } catch (e) {
      if (!vivo.current) return;
      const salvo = cache.current && sessionStorage.getItem(cache.current);
      if (salvo && !dirty.current) {
        try {
          const r = JSON.parse(salvo);
          const d = JSON.parse(sessionStorage.getItem(`${cache.current}:rascunho`) || 'null');
          if (d) r.dados = d.dados;
          aplicar(r);
          setOffline(true);
        } catch {
          setErro(mensagemErro(e));
        }
      } else {
        setErro(mensagemErro(e));
      }
    }
  }, [api, root, vooId, aplicar]);

  useEffect(() => {
    void carregar();
    void api
      .json(`${root}/opcoes`)
      .then((o) => {
        if (vivo.current) setOpcoes(o);
      })
      .catch(() => {
        if (vivo.current) {
          setAviso('Não foi possível carregar os cadastros. Você pode preencher os detalhes manualmente e tentar novamente.');
        }
      });
  }, [carregar, api, root]);

  useEffect(() => {
    const fn = () => {
      if (!dirty.current && !busy.current && document.visibilityState !== 'hidden') void carregar();
    };
    window.addEventListener('focus', fn);
    const t = setInterval(fn, 30000);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', fn);
    };
  }, [carregar]);

  useEffect(() => {
    if (!sujo || conflito || offline) return;
    const t = setTimeout(() => void enviarRef.current(false), 1000);
    return () => clearTimeout(t);
  }, [dados, sujo, registro?.versao, conflito, offline]);

  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, []);

  function alterar(fn: (d: any) => void) {
    if (offline || registro?.somente_leitura) return;
    const novo = clone(ref.current);
    fn(novo);
    ref.current = novo;
    sequencia.current++;
    dirty.current = true;
    setSujo(true);
    setDados(novo);
    if (cache.current) {
      try {
        sessionStorage.setItem(
          `${cache.current}:rascunho`,
          JSON.stringify({ dados: novo, base: base.current, versao: atual.current?.versao }),
        );
      } catch {}
    }
    setAviso('');
  }

  async function salvar(concluir = false) {
    if (busy.current || offline || conflitando.current || !ref.current) return null;
    busy.current = true;
    setOcupado(concluir ? 'concluir' : 'salvar');
    setErro('');
    const seq = sequencia.current;
    try {
      const r = await api.json(root + (concluir ? '/concluir' : ''), {
        versao: atual.current.versao,
        dados: ref.current,
      });
      if (!vivo.current) return null;
      const iguais = seq === sequencia.current;
      aplicar({ ...atual.current, ...r }, !iguais);
      if (iguais) {
        dirty.current = false;
        setSujo(false);
        if (cache.current) {
          try {
            sessionStorage.removeItem(`${cache.current}:rascunho`);
          } catch {}
        }
      }
      aoSalvar?.();
      if (concluir) setAviso('Preparação finalizada com sucesso.');
      return r;
    } catch (e: any) {
      if (!vivo.current) return null;
      if (e.message === 'versao_desatualizada') {
        const remoto = await api.json(root).catch(() => null);
        if (remoto) {
          const local = mesclar(base.current, ref.current, remoto.dados);
          const servidor = mesclar(base.current, ref.current, remoto.dados, 'remoto');
          atual.current = remoto;
          base.current = clone(remoto.dados);
          setRegistro(remoto);
          if (!local.conflitos) {
            ref.current = local.dados;
            setDados(local.dados);
            dirty.current = true;
            setSujo(true);
            setAviso('Alterações da equipe incorporadas. Salvando suas alterações.');
          } else {
            conflitando.current = true;
            setConflito({ local: local.dados, remoto: servidor.dados, total: local.conflitos });
            setErro(mensagemErro(e));
          }
        } else {
          setErro(mensagemErro(e));
        }
      } else {
        setErro(mensagemErro(e));
      }
      return null;
    } finally {
      busy.current = false;
      if (vivo.current) setOcupado('');
    }
  }

  enviarRef.current = salvar;

  function resolver(qual: 'local' | 'remoto') {
    const novo = conflito[qual];
    ref.current = novo;
    setDados(novo);
    setConflito(null);
    conflitando.current = false;
    dirty.current = true;
    setSujo(true);
    setErro('');
    if (cache.current) {
      try {
        sessionStorage.setItem(
          `${cache.current}:rascunho`,
          JSON.stringify({ dados: novo, base: base.current, versao: atual.current?.versao }),
        );
      } catch {}
    }
  }

  const readonly = offline || Boolean(registro?.somente_leitura) || Boolean(ocupado && ocupado !== 'salvar');
  const eAtual = dados?.escalas?.find((e: any) => e.id === escala) || dados?.escalas?.[0];
  const eHotel = dados?.trechos?.[0]?.destino_escala_id
    ? dados.escalas.find((e: any) => e.id === dados.trechos[0].destino_escala_id)
    : dados?.escalas?.[dados.escalas.length - 1];
  const papelAerodromo = (esc: any, idx: number, total: number) => {
    if (esc?.id === 'e1' || idx === 0) return 'Origem';
    if ((eHotel && esc?.id === eHotel.id) || (total > 1 && idx === total - 1)) return 'Destino';
    return `Trecho ${idx + 1}`;
  };
  const indiceAtual = Math.max(0, (dados?.escalas || []).findIndex((e: any) => e.id === eAtual?.id));
  const papelAerodromoAtual = papelAerodromo(eAtual, indiceAtual, dados?.escalas?.length || 1);

  function item(id: string, patch: any) {
    alterar((d) => {
      d.itens[id] = { ...d.itens[id], ...patch };
    });
  }

  function servico(id: string, patch: any, campos = false) {
    alterar((d) => {
      const s = d.escalas.flatMap((e: any) => e.servicos).find((x: any) => x.id === id);
      if (s) {
        if (campos) s.dados = { ...s.dados, ...patch };
        else Object.assign(s, patch);
      }
    });
  }

  const campo = (titulo: string, valor: any, onChange: (v: string) => void, tipo = 'text', placeholder?: string) => (
    <Field key={titulo} className="gap-1.5">
      <FieldLabel className="text-xs font-semibold text-muted-foreground">{titulo}</FieldLabel>
      <Input
        type={tipo}
        value={valor ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly}
        className="h-11 rounded-lg text-sm sm:h-10 sm:text-xs"
      />
    </Field>
  );

  function situacao(r: any, onChange: (v: string) => void) {
    return (
      <Select value={r.estado} disabled={readonly} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Situação"
          data-estado={r.estado}
          className={cn('h-10 min-w-[165px] rounded-lg text-xs font-semibold sm:h-9', BADGE_ESTADO[r.estado] || '')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROTULOS).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function botoesEstadoRapido(estadoAtual: string | undefined, onChange: (v: string) => void) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Situação do item">
        {ROTULOS_CURTOS.map((op) => {
          const ativo = (estadoAtual || 'PENDENTE') === op.id;
          return (
            <button
              key={op.id}
              type="button"
              disabled={readonly}
              aria-pressed={ativo}
              onClick={() => onChange(op.id)}
              className={cn(
                'inline-flex min-h-[38px] items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors sm:min-h-[34px]',
                ativo
                  ? op.id === 'CONCLUIDO'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : op.id === 'NAO_APLICAVEL'
                      ? 'border-border bg-secondary text-foreground'
                      : op.id === 'EM_ANDAMENTO'
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {op.id === 'CONCLUIDO' && ativo && <Check size={13} className="mr-1" />}
              {op.label}
            </button>
          );
        })}
      </div>
    );
  }

  function selecionar(s: any, id: string) {
    if (!id) return;
    const hotel = s.tipo === 'HOTEL';
    const x = hotel
      ? opcoes.hoteis.find((itemH: any) => itemH.id === id)
      : opcoes.fornecedores.find((itemF: any) => `${itemF.origem}:${itemF.id}` === id);
    if (!x) return;
    const dadosCopiados: any = {
      nome: x.nome,
      telefone: x.telefone_reservas || x.telefone || '',
      email: x.email || x.email_comercial || '',
      endereco: x.endereco || '',
      cidade: x.cidade || x.nome_cidade || '',
      contato: x.contato || '',
      cadastro_copiado_em: new Date().toISOString(),
    };
    if (hotel) {
      Object.assign(dadosCopiados, {
        preco_single: String(x.preco_single ?? ''),
        preco_duplo: String(x.preco_duplo ?? ''),
        cafe_estado: x.cafe?.estado || 'A_CONFIRMAR',
        cafe_valor: x.cafe?.valor || '',
        cafe_oferece: x.cafe?.oferece ? 'SIM' : '',
      });
    } else {
      const k: any = { GPU: 'gpu', TRANSFER: 'transfer', AR_CONDICIONADO: 'ar_condicionado', HANGAR: 'pernoite' };
      const v = x[k[s.tipo]];
      if (k[s.tipo]) {
        dadosCopiados.disponibilidade = v === 'NAO' ? 'Não disponível' : v ? 'Disponível' : 'Não informado';
        dadosCopiados.valor = ['SIM', 'NAO'].includes(v) ? '' : String(x[`valor_${k[s.tipo]}`] || v || '');
        if (dadosCopiados.valor === 'GRATUITO') dadosCopiados.valor = 'Gratuito';
      }
      if (s.tipo === 'COMBUSTIVEL') {
        Object.assign(dadosCopiados, {
          nome_fornecedor: String(x.nome || ''),
          codigo_icao: String(x.codigo_icao || ''),
          pessoa_contato: String(x.contato || ''),
          telefone: String(x.telefone || ''),
          preco_jet: String(x.preco_jet ?? ''),
          preco_avgas: String(x.preco_avgas ?? ''),
        });
      }
    }
    alterar((d) => {
      const esc = d.escalas.find((e: any) => e.id === eAtual.id);
      const serv = esc.servicos.find((v: any) => v.id === s.id);
      if (serv.cadastro_id !== x.id && serv.estado === 'CONCLUIDO') serv.estado = 'EM_ANDAMENTO';
      serv.cadastro_id = x.id;
      serv.origem = hotel ? 'hotel' : x.origem;
      serv.dados = { ...serv.dados, ...dadosCopiados };
      if (s.tipo === 'HANGAR') {
        for (const [tipo, k] of Object.entries({ GPU: 'gpu', TRANSFER: 'transfer', AR_CONDICIONADO: 'ar_condicionado' })) {
          const v = esc.servicos.find((sv: any) => sv.tipo === tipo);
          if (v && !v.cadastro_id) {
            v.cadastro_id = x.id;
            v.origem = x.origem;
            v.dados = {
              ...v.dados,
              ...dadosCopiados,
              disponibilidade: x[k] === 'NAO' ? 'Não disponível' : x[k] ? 'Disponível' : 'Não informado',
              valor: ['SIM', 'NAO'].includes(x[k]) ? '' : String(x[`valor_${k}`] || x[k] || ''),
            };
          }
        }
      }
    });
  }

  async function cadastrarFornecedor() {
    if (!novoFornecedor?.nome_fornecedor?.trim()) return;
    await acao('fornecedor', async () => {
      const salvo = await api.json('/api/interno/abastecimentos/fornecedores', {
        nome_cidade: novoFornecedor.nome_cidade || '',
        codigo_icao: novoFornecedor.codigo_icao || '',
        nome_fornecedor: novoFornecedor.nome_fornecedor,
        pessoa_contato: novoFornecedor.pessoa_contato || '',
        telefone: novoFornecedor.telefone || '',
        preco_avgas: novoFornecedor.preco_avgas || null,
        preco_jet: novoFornecedor.preco_jet || null,
      });
      const opcoesAtualizadas = await api.json(`${root}/opcoes`);
      setOpcoes(opcoesAtualizadas);
      const f = (opcoesAtualizadas.fornecedores || []).find((x: any) => x.origem === 'combustivel' && x.id === salvo.id);
      if (f && combustivel) setCombustivel({ ...combustivel, fornecedor_id: salvo.id });
      if (f && dados?.escalas) {
        const serv = dados.escalas
          .flatMap((e: any) => e.servicos)
          .find((x: any) => x.tipo === 'COMBUSTIVEL' && x.id === `${eAtual.id}:COMBUSTIVEL`);
        if (serv) selecionar(serv, `combustivel:${salvo.id}`);
      }
      setNovoFornecedor(null);
      setAviso('Fornecedor cadastrado. Os dados podem ser editados neste checklist.');
    });
  }

  async function acao(tipo: string, fn: () => Promise<void>) {
    if (busy.current || readonly) return;
    if (dirty.current && !(await salvar())) return;
    busy.current = true;
    setOcupado(tipo);
    setErro('');
    try {
      await fn();
    } catch (e) {
      if (vivo.current) setErro(mensagemErro(e));
    } finally {
      busy.current = false;
      if (vivo.current) setOcupado('');
    }
  }

  async function anexar(s: any, file: File) {
    if (!file.size || file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErro(mensagens.anexo_invalido);
      return;
    }
    await acao('anexo', async () => {
      const f = new FormData();
      f.append('arquivo', file);
      f.append('servico_id', s.id);
      await api.enviar(`${root}/anexos`, f);
      const r = await api.json(root);
      aplicar(r);
      setAviso('Comprovante anexado.');
    });
  }

  async function reservar(s: any) {
    await acao('reserva', async () => {
      const assinatura = JSON.stringify([
        s.cadastro_id,
        s.dados,
        s.observacao === 'Solicitação enviada; aguardando confirmação do hotel.' ? '' : s.observacao,
      ]);
      const cacheKey = `${cache.current}:reserva:${s.id}`;
      let req = reqEmail.current[s.id];
      try {
        req = req || JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      } catch {}
      if (!req || req.assinatura !== assinatura) req = { assinatura, id: crypto.randomUUID() };
      reqEmail.current[s.id] = req;
      sessionStorage.setItem(cacheKey, JSON.stringify(req));
      const envio = await api.json(`${root}/reservar-hotel`, {
        requisicao_id: req.id,
        escala_id: eAtual.id,
        servico_id: s.id,
        versao: atual.current.versao,
      });
      const r = await api.json(root);
      aplicar(r);
      if (!envio.repetido) {
        servico(s.id, {
          estado: 'EM_ANDAMENTO',
          observacao: s.observacao || 'Solicitação enviada; aguardando confirmação do hotel.',
        });
      }
      setAviso(
        envio.repetido
          ? 'Esta solicitação já foi enviada.'
          : 'Solicitação enviada. A confirmação do hotel continua pendente.',
      );
    });
  }

  async function baixar(path: string, nome: string) {
    try {
      const blob = await api.arquivo(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  async function briefing() {
    if (busy.current) return;
    if (dirty.current && !(await salvar())) return;
    setOcupado('pdf');
    busy.current = true;
    try {
      const r = await api.json(`${root}/emitir`, { versao: atual.current.versao });
      await baixar(`${root}/pdf?versao=${r.versao}`, `briefing-${registro.voo.numero_voo || 'voo'}-v${r.versao}.pdf`);
      const novo = await api.json(root);
      aplicar(novo);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      busy.current = false;
      setOcupado('');
    }
  }

  async function registrarCombustivel() {
    if (
      combustivel.arquivo &&
      (!combustivel.arquivo.size ||
        combustivel.arquivo.size > 10 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(combustivel.arquivo.type))
    ) {
      setErro(mensagens.anexo_invalido);
      return;
    }
    await acao('combustivel', async () => {
      const r = await api.json(`${root}/abastecimento-realizado`, {
        ...combustivel,
        escala_id: eAtual.id,
      });
      if (combustivel.arquivo) {
        const f = new FormData();
        f.append('arquivo', combustivel.arquivo);
        f.append('tipo', 'comanda');
        await api.enviar(`/api/interno/abastecimentos/${r.id}/arquivo`, f);
      }
      const novo = await api.json(root);
      aplicar(novo);
      setCombustivel(null);
      setAviso(r.repetido ? 'Este abastecimento já está registrado.' : 'Abastecimento realizado registrado.');
    });
  }

  if (!registro || !dados) {
    return (
      <section className="pv flex flex-col items-center justify-center gap-3 py-10 text-center" data-escuro={escuro}>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p role="status" className="text-sm text-muted-foreground">
          {erro || 'Carregando preparação do voo…'}
        </p>
        {erro && (
          <Button type="button" variant="outline" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        )}
      </section>
    );
  }

  const secoesAeronave = (registro.secoes || []).filter((s: any) => s.segmento === 'aeronave');
  const etapaSelecionada = secoesAeronave.find((s: any) => s.id === etapaId) || secoesAeronave[0] || null;
  const secoesTripulacao = (registro.secoes || []).filter((s: any) => s.segmento === 'tripulacao');

  const respostas = [
    ...Object.values(dados.itens),
    ...dados.escalas.flatMap((e: any) =>
      e.servicos.filter((s: any) => !['PLANO_VOO', 'METEO_NOTAM', 'BALIZAMENTO'].includes(s.tipo)),
    ),
  ] as any[];

  const totalItensCheck = Object.keys(dados.itens || {}).length;
  const resolvidosCheck = Object.values(dados.itens || {}).filter((x: any) => resolvido(x)).length;
  const percentualCheck = totalItensCheck > 0 ? Math.round((resolvidosCheck / totalItensCheck) * 100) : 0;

  const pendenciasDetalhadas: any[] = [
    ...Object.entries(dados.itens)
      .filter(([, r]: any) => !resolvido(r))
      .map(([id, r]: any) => {
        const sec = registro.secoes.find((x: any) => x.itens.some((i: any) => i.id === id));
        const it = sec?.itens.find((i: any) => i.id === id);
        return { etapa: sec?.titulo || 'Checklist', item: it?.label || id, estado: r.estado, tipo: 'item', id };
      }),
    ...dados.escalas.flatMap((e: any, idx: number) =>
      e.servicos
        .filter((s: any) => !['PLANO_VOO', 'METEO_NOTAM', 'BALIZAMENTO'].includes(s.tipo) && !resolvido(s))
        .map((s: any) => ({
          etapa: `${papelAerodromo(e, idx, dados.escalas.length)} · ${e.icao || e.cidade || 'Aeródromo'}`,
          item: registro.tipos_servico.find((t: any) => t.id === s.tipo)?.nome || s.tipo,
          estado: s.estado,
          tipo: 'servico',
          id: s.id,
        })),
    ),
    ...dados.escalas.flatMap((e: any, idx: number) =>
      e.servicos
        .filter(
          (s: any) =>
            s.tipo === 'HOTEL' &&
            s.estado === 'CONCLUIDO' &&
            !['INCLUIDO', 'A_PARTE', 'NAO_OFERECE'].includes(s.dados.cafe_estado),
        )
        .map((s: any) => ({
          etapa: `${papelAerodromo(e, idx, dados.escalas.length)} · ${e.icao || e.cidade || 'Aeródromo'}`,
          item: `${registro.tipos_servico.find((t: any) => t.id === s.tipo)?.nome || 'Hotel'} · situação do café da manhã`,
          estado: 'A_CONFIRMAR',
          tipo: 'cafe',
          id: s.id,
        })),
    ),
    ...(!String(dados.nivel_oleo || '').trim()
      ? [{ etapa: 'Aeronave', item: 'Nível de óleo LH / RH', estado: 'PENDENTE', tipo: 'oleo' }]
      : []),
  ];

  const pendencias = pendenciasDetalhadas.length;
  const servicoPorId = (id: string) => dados.escalas.flatMap((e: any) => e.servicos).find((s: any) => s.id === id);
  const atualizarPendencia = (p: any, patch: any) => (p.tipo === 'item' ? item(p.id, patch) : servico(p.id, patch));

  const marcarEtapaConcluida = (itens: any[]) =>
    alterar((d) => {
      for (const i of itens) d.itens[i.id] = { ...d.itens[i.id], estado: 'CONCLUIDO' };
    });

  const itensOrdenados = (sec: any) => {
    const ordem = dados.ordem_checklist?.[sec.id];
    if (!Array.isArray(ordem)) return sec.itens;
    const posicao = new Map(ordem.map((id: string, index: number) => [id, index]));
    return [...sec.itens].sort(
      (a: any, b: any) =>
        (posicao.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (posicao.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  };

  const reordenarItens = (secId: string, itens: any[]) =>
    alterar((d) => {
      d.ordem_checklist = { ...(d.ordem_checklist || {}), [secId]: itens.map((i) => i.id) };
    });

  const statusPreparacao = registro.finalizado_em
    ? pendencias
      ? `Finalizada · ${pendencias} pendência(s)`
      : 'Preparação finalizada'
    : `${resolvidosCheck}/${totalItensCheck} verificados`;

  const hotelServico = eHotel?.servicos?.find((s: any) => s.tipo === 'HOTEL');
  const hangarServico = eAtual?.servicos?.find((s: any) => s.tipo === 'HANGAR');
  const combustivelServico = eAtual?.servicos?.find((s: any) => s.tipo === 'COMBUSTIVEL');
  const outrosServicosEscala = (eAtual?.servicos || []).filter(
    (s: any) =>
      !['PLANO_VOO', 'METEO_NOTAM', 'HOTEL', 'HANGAR', 'GPU', 'AR_CONDICIONADO', 'TRANSFER', 'BALIZAMENTO', 'COMBUSTIVEL'].includes(
        s.tipo,
      ),
  );

  const coordenacaoItens = (() => {
    const existentes = secoesTripulacao.flatMap((s: any) => s.itens);
    const porId = (id: string) => existentes.find((i: any) => i.id === id);
    const idsOrdenados = ['plano_voo', 'notam', 'comissaria', 'ipads', 'cartoes', 'documentacao_aeronave'];
    const baseItens = idsOrdenados
      .map((id) => porId(id))
      .filter(Boolean)
      .map((i: any) => ({
        id: i.id,
        label: i.label,
        record: dados.itens[i.id],
      }));
    const extras = existentes
      .filter((i: any) => !idsOrdenados.includes(i.id) && i.id !== 'reservas')
      .map((i: any) => ({
        id: i.id,
        label: i.label,
        record: dados.itens[i.id],
      }));
    return [...baseItens, ...extras];
  })();

  const seletorAerodromo = (labelTexto = 'Aeródromo do voo') =>
    dados.escalas?.length ? (
      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-secondary/35 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">{labelTexto}</p>
          <p className="text-xs text-muted-foreground">
            {eAtual
              ? `${papelAerodromoAtual}: ${eAtual.icao || 'Sem ICAO'}${eAtual.cidade ? ` · ${eAtual.cidade}` : ''}`
              : 'Selecione origem ou destino'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dados.escalas.map((esc: any, idx: number) => {
            const ativa = esc.id === eAtual?.id;
            const papel = papelAerodromo(esc, idx, dados.escalas.length);
            return (
              <button
                key={esc.id}
                type="button"
                onClick={() => setEscala(esc.id)}
                aria-pressed={ativa}
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
                  ativa
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-secondary',
                )}
              >
                <span className={cn('text-[11px] font-medium', ativa ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                  {papel}:
                </span>
                <span className="font-mono font-bold">{esc.icao || 'Definir'}</span>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const alternarGrupoItens = (ids: string[], expandir: boolean) => {
    setItensAbertos((prev) => {
      const proximo = { ...prev };
      for (const id of ids) proximo[id] = expandir;
      return proximo;
    });
  };

  const renderItemChecklist = (i: any) => {
    const rec = dados.itens[i.id] || { estado: 'PENDENTE', observacao: '' };
    const temObs = Boolean(rec.observacao?.trim());
    const aberto = Boolean(itensAbertos[i.id]);
    const obsAberta = Boolean(obsAbertas[i.id] || temObs || aberto);
    const concluido = rec.estado === 'CONCLUIDO';
    const oleoPreenchido = Boolean(String(dados.nivel_oleo || '').trim());

    return (
      <div
        key={i.id}
        data-estado={rec.estado}
        className={cn(
          'overflow-hidden rounded-xl border transition-colors',
          concluido
            ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
            : 'border-border bg-card',
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2 sm:px-3.5">
          <button
            type="button"
            disabled={readonly}
            aria-label={concluido ? `Reabrir ${i.label}` : `Marcar ${i.label} como feito`}
            aria-pressed={concluido}
            onClick={() => item(i.id, { estado: concluido ? 'PENDENTE' : 'CONCLUIDO' })}
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors sm:h-8 sm:w-8',
              concluido
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:text-primary',
            )}
          >
            <Check size={15} className={concluido ? 'opacity-100' : 'opacity-35'} />
          </button>

          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => setItensAbertos((prev) => ({ ...prev, [i.id]: !aberto }))}
            className="flex min-h-[40px] min-w-0 flex-1 items-center justify-between gap-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    'text-sm font-semibold leading-snug',
                    concluido ? 'text-foreground/85' : 'text-foreground',
                  )}
                >
                  {i.label}
                </span>
                {i.tipo === 'oleo' && (
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    {oleoPreenchido ? `Óleo: ${dados.nivel_oleo}` : 'Informar nível LH/RH'}
                  </span>
                )}
              </div>
              {!aberto && temObs && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Obs.: {rec.observacao}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                  BADGE_ESTADO[rec.estado] || BADGE_ESTADO.PENDENTE,
                )}
              >
                {ROTULOS[rec.estado] || ROTULOS.PENDENTE}
              </span>
              <ChevronDown
                size={16}
                className={cn('text-muted-foreground transition-transform duration-150', aberto && 'rotate-180')}
              />
            </div>
          </button>
        </div>

        {aberto && (
          <div className="space-y-3 border-t border-border bg-secondary/15 px-3.5 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {botoesEstadoRapido(rec.estado, (estado) => item(i.id, { estado }))}
              {rec.responsavel && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {rec.responsavel} · {momento(rec.atualizado_em)}
                </span>
              )}
            </div>

            {i.tipo === 'oleo' && (
              <div className="max-w-sm">
                {campo('Nível de óleo LH / RH', dados.nivel_oleo, (v) =>
                  alterar((d) => {
                    d.nivel_oleo = v;
                  }),
                )}
              </div>
            )}

            {obsAberta && (
              <Textarea
                aria-label={`Observação: ${i.label}`}
                placeholder="Observação ou motivo, se necessário"
                value={rec.observacao || ''}
                onChange={(e) => item(i.id, { observacao: e.target.value })}
                disabled={readonly}
                className="min-h-[56px] rounded-lg bg-card text-xs"
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const tabs: Array<{ id: AbaPreparacao; label: string; icon: typeof Plane }> = [
    { id: 'aeronave', label: 'Checklist aeronave', icon: Plane },
    { id: 'coordenacao', label: 'Coordenação & solo', icon: Users },
    { id: 'combustivel', label: 'Abastecimento', icon: Fuel },
    { id: 'resumo', label: 'Briefing & pendências', icon: ClipboardList },
  ];

  return (
    <section className="pv space-y-5" data-escuro={escuro}>
      {/* Cabeçalho compacto de status da preparação */}
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-foreground">Preparação e Check pré-voo</h3>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
                pendencias > 0
                  ? 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {statusPreparacao}
            </span>
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {offline
              ? `Modo offline · dados de ${momento(registro.atualizado_em) || 'última consulta'}`
              : ocupado === 'salvar'
                ? 'Salvando alterações…'
                : sujo
                  ? 'Alterações pendentes de sincronização automática'
                  : `Sincronizado · versão ${registro.versao}${registro.atualizado_por_nome ? ` · ${registro.atualizado_por_nome}` : ''}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void briefing()}
            disabled={!!ocupado || !!conflito || offline}
            className="h-10 gap-2 rounded-lg text-xs font-semibold"
          >
            {ocupado === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Briefing PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Atualizar preparação"
            onClick={() => void carregar()}
            disabled={sujo || !!ocupado}
            className="h-10 w-10 rounded-lg p-0"
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </header>

      {/* Barra de progresso limpa */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Progresso dos checks</span>
          <span className="font-mono font-bold text-primary">{percentualCheck}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percentualCheck}%` }}
          />
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs font-medium text-red-700 dark:text-red-300" role="alert">
          <AlertCircle size={16} className="shrink-0" />
          <span>{erro}</span>
        </div>
      )}
      {aviso && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-300" role="status">
          <AlertCircle size={16} className="shrink-0" />
          <span>{aviso}</span>
        </div>
      )}
      {conflito && (
        <div className="space-y-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs" role="alert">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {conflito.total} campo(s) foram alterados também por outro coordenador. Campos diferentes já foram combinados.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => resolver('local')}>
              Manter minhas alterações
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => resolver('remoto')}>
              Usar alterações da equipe
            </Button>
          </div>
        </div>
      )}

      {/* Navegação unificada entre os 4 blocos lógicos */}
      <nav
        className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-secondary/45 p-1"
        aria-label="Etapas da preparação"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const ativa = aba === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={ativa}
              onClick={() => setAba(id)}
              className={cn(
                'flex min-h-[42px] shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors sm:flex-1 sm:justify-center',
                ativa
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card hover:text-foreground',
              )}
            >
              <Icon size={15} />
              <span>{label}</span>
              {id === 'resumo' && pendencias > 0 && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold',
                    ativa ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
                  )}
                >
                  {pendencias}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* BLOCO 1: CHECKLIST AERONAVE INLINE (sem modais ou sheets empilhados) */}
      {aba === 'aeronave' && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Etapas do checklist da aeronave">
            {secoesAeronave.map((s: any) => {
              const ativos = s.itens.filter((i: any) => resolvido(dados.itens[i.id])).length;
              const completa = ativos === s.itens.length && s.itens.length > 0;
              const selecionada = etapaSelecionada?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={selecionada}
                  onClick={() => {
                    setEtapaId(s.id);
                    setReordenandoEtapa(false);
                  }}
                  className={cn(
                    'flex min-h-[54px] items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors',
                    selecionada
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-bold text-foreground">{s.titulo}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ativos}/{s.itens.length} itens resolvidos
                    </span>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold',
                      completa
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-card text-foreground border border-border',
                    )}
                  >
                    {completa ? 'OK' : `${s.itens.length - ativos} pend.`}
                  </span>
                </button>
              );
            })}
          </div>

          {etapaSelecionada && (() => {
            const idsEtapa = etapaSelecionada.itens.map((x: any) => x.id);
            const todosAbertosEtapa = idsEtapa.length > 0 && idsEtapa.every((id: string) => Boolean(itensAbertos[id]));
            return (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3.5 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{etapaSelecionada.titulo}</h4>
                    {etapaSelecionada.subtitulo && (
                      <p className="text-xs text-muted-foreground">{etapaSelecionada.subtitulo}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!idsEtapa.length}
                      onClick={() => alternarGrupoItens(idsEtapa, !todosAbertosEtapa)}
                      className="h-9 gap-1.5 text-xs"
                    >
                      <ChevronDown size={14} className={cn('transition-transform', todosAbertosEtapa && 'rotate-180')} />
                      {todosAbertosEtapa ? 'Recolher itens' : 'Expandir itens'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={readonly}
                      onClick={() => setReordenandoEtapa((v) => !v)}
                      className="h-9 gap-1.5 text-xs"
                    >
                      <ArrowUpDown size={14} />
                      {reordenandoEtapa ? 'Concluir ordem' : 'Reordenar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={readonly || !etapaSelecionada.itens.length}
                      onClick={() => marcarEtapaConcluida(etapaSelecionada.itens)}
                      className="h-9 gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      <Check size={14} />
                      Marcar todos como feitos
                    </Button>
                  </div>
                </div>

                {reordenandoEtapa ? (
                  <DragReorder
                    items={itensOrdenados(etapaSelecionada)}
                    ariaLabel={`Itens da etapa ${etapaSelecionada.titulo}`}
                    disabled={readonly}
                    label={(i: any) => i.label}
                    onReorder={(proximos: any[]) => reordenarItens(etapaSelecionada.id, proximos)}
                    renderItem={(i: any) => renderItemChecklist(i)}
                  />
                ) : (
                  <div className="space-y-2">
                    {itensOrdenados(etapaSelecionada).map((i: any) => renderItemChecklist(i))}
                  </div>
                )}
              </div>
            );
          })()}

          {registro.finalizado_em && painelAeronave}
        </div>
      )}

      {/* BLOCO 2: COORDENAÇÃO, HOTEL & SERVIÇOS DE SOLO (tudo inline, sem context menu oculto ou modal aninhado) */}
      {aba === 'coordenacao' && (
        <div className="space-y-5">
          {seletorAerodromo('Aeródromo para apoio de solo')}

          {/* Tarefas gerais da coordenação */}
          {(() => {
            const idsCoord = coordenacaoItens.map((it) => it.id);
            const todosAbertosCoord = idsCoord.length > 0 && idsCoord.every((id) => Boolean(itensAbertos[id]));
            return (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-foreground">Documentos, plano de voo e cabine</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!idsCoord.length}
                      onClick={() => alternarGrupoItens(idsCoord, !todosAbertosCoord)}
                      className="h-9 gap-1.5 text-xs"
                    >
                      <ChevronDown size={14} className={cn('transition-transform', todosAbertosCoord && 'rotate-180')} />
                      {todosAbertosCoord ? 'Recolher itens' : 'Expandir itens'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={readonly}
                      onClick={() => marcarEtapaConcluida(secoesTripulacao.flatMap((s: any) => s.itens))}
                      className="h-9 gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      <Check size={14} />
                      Concluir coordenação
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {coordenacaoItens.map((it) => renderItemChecklist(it))}
                </div>
              </div>
            );
          })()}

          {/* Card expansível inline: Reservas de Hotel (Destino) */}
          {eHotel && hotelServico && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setHotelAberto((v) => !v)}
                aria-expanded={hotelAberto}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-secondary/35"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Reservas de hotel ({eHotel.icao || eHotel.cidade || 'Destino'})
                      </span>
                      <span
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                          BADGE_ESTADO[dados.itens.reservas?.estado || hotelServico.estado] || BADGE_ESTADO.PENDENTE,
                        )}
                      >
                        {ROTULOS[dados.itens.reservas?.estado || hotelServico.estado] || 'Pendente'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {hotelServico.dados?.nome
                        ? `${hotelServico.dados.nome} · Café: ${CAFES[hotelServico.dados.cafe_estado] || 'A confirmar'}`
                        : 'Selecione o hotel e envie a reserva ou anexe comprovante'}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={cn('shrink-0 text-muted-foreground transition-transform', hotelAberto && 'rotate-180')}
                />
              </button>

              {hotelAberto && (
                <div className="space-y-4 border-t border-border bg-secondary/15 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Situação geral da reserva</span>
                    {botoesEstadoRapido(dados.itens.reservas?.estado || 'PENDENTE', (estado) => {
                      item('reservas', { estado });
                      servico(hotelServico.id, { estado });
                    })}
                  </div>

                  {(() => {
                    const hotelItems: ComboboxItem[] = opcoes.hoteis.map((h: any) => ({
                      id: String(h.id),
                      label: String(h.nome || 'Hotel'),
                      descricao: [h.cidade || h.nome_cidade, h.codigo_icao].filter(Boolean).join(' · '),
                    }));
                    const hotelAtual = hotelItems.find((h) => h.id === String(hotelServico.cadastro_id || ''));
                    const visiveis = todos
                      ? hotelItems
                      : hotelItems.filter(
                          (h: any) =>
                            !eHotel.cidade ||
                            String(h.descricao || '').toLocaleLowerCase().includes(String(eHotel.cidade).toLocaleLowerCase()),
                        );
                    const itensHotel =
                      hotelAtual && !visiveis.some((h: any) => h.id === hotelAtual.id) ? [hotelAtual, ...visiveis] : visiveis;

                    return (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field className="gap-1.5 sm:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <FieldLabel className="text-xs font-semibold text-muted-foreground">
                                Hotel cadastrado
                              </FieldLabel>
                              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={todos}
                                  onChange={(ev) => setTodos(ev.target.checked)}
                                  className="h-4 w-4 accent-primary"
                                />
                                Buscar em todas as cidades
                              </label>
                            </div>
                            <SearchableCombobox
                              items={itensHotel}
                              value={String(hotelServico.cadastro_id || '')}
                              onChange={(id) => selecionar(hotelServico, id)}
                              placeholder="Selecione um hotel"
                              selectedLabel={hotelServico.dados.nome || undefined}
                              searchPlaceholder="Buscar hotel por nome, cidade ou ICAO"
                              filterItem={(it, q) =>
                                `${it.label} ${it.descricao || ''}`.toLocaleLowerCase().includes(q.toLocaleLowerCase())
                              }
                              disabled={readonly}
                            />
                          </Field>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {campo('Nome do hotel', hotelServico.dados.nome, (v) =>
                            servico(hotelServico.id, { nome: v }, true),
                          )}
                          {campo(
                            'Telefone do hotel',
                            hotelServico.dados.telefone,
                            (v) => servico(hotelServico.id, { telefone: v }, true),
                            'tel',
                          )}
                          {campo(
                            'E-mail do hotel',
                            hotelServico.dados.email,
                            (v) => servico(hotelServico.id, { email: v }, true),
                            'email',
                          )}
                          {campo('Endereço', hotelServico.dados.endereco, (v) =>
                            servico(hotelServico.id, { endereco: v }, true),
                          )}
                          {campo(
                            'Check-in',
                            hotelServico.dados.checkin,
                            (v) => servico(hotelServico.id, { checkin: v }, true),
                            'date',
                          )}
                          {campo(
                            'Check-out',
                            hotelServico.dados.checkout,
                            (v) => servico(hotelServico.id, { checkout: v }, true),
                            'date',
                          )}
                          {campo('Tipo de quarto', hotelServico.dados.tipo_quarto, (v) =>
                            servico(hotelServico.id, { tipo_quarto: v }, true),
                          )}
                          {campo(
                            'Quantidade de quartos',
                            hotelServico.dados.quartos,
                            (v) => servico(hotelServico.id, { quartos: v }, true),
                            'number',
                          )}
                          {campo(
                            'Quantidade de hóspedes',
                            hotelServico.dados.quantidade_hospedes,
                            (v) => servico(hotelServico.id, { quantidade_hospedes: v }, true),
                            'number',
                          )}
                          {campo(
                            'Telefone do hóspede',
                            hotelServico.dados.telefone_hospede,
                            (v) => servico(hotelServico.id, { telefone_hospede: v }, true),
                            'tel',
                          )}
                          {campo(
                            'Valor acordado (R$)',
                            hotelServico.dados.valor_acordado,
                            (v) => servico(hotelServico.id, { valor_acordado: v }, true),
                            'number',
                          )}
                          <Field className="gap-1.5">
                            <FieldLabel className="text-xs font-semibold text-muted-foreground">
                              Cobrança do valor
                            </FieldLabel>
                            <Select
                              value={hotelServico.dados.valor_acordado_tipo || 'TOTAL'}
                              disabled={readonly}
                              onValueChange={(v) => servico(hotelServico.id, { valor_acordado_tipo: v }, true)}
                            >
                              <SelectTrigger aria-label="Valor acordado" className="h-11 rounded-lg text-sm sm:h-10 sm:text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PESSOA">Por pessoa</SelectItem>
                                <SelectItem value="TOTAL">Valor total da reserva</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field className="gap-1.5">
                            <FieldLabel className="text-xs font-semibold text-muted-foreground">Café da manhã</FieldLabel>
                            <Select
                              value={hotelServico.dados.cafe_estado || 'A_CONFIRMAR'}
                              disabled={readonly}
                              onValueChange={(v) => servico(hotelServico.id, { cafe_estado: v }, true)}
                            >
                              <SelectTrigger aria-label="Café da manhã" className="h-11 rounded-lg text-sm sm:h-10 sm:text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CAFES).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          {hotelServico.dados.cafe_estado === 'A_PARTE' &&
                            campo(
                              'Valor do café (R$)',
                              hotelServico.dados.cafe_valor,
                              (v) => servico(hotelServico.id, { cafe_valor: v }, true),
                              'number',
                            )}
                        </div>

                        <Field className="gap-1.5">
                          <FieldLabel className="text-xs font-semibold text-muted-foreground">
                            Hóspedes nominados
                          </FieldLabel>
                          <Textarea
                            value={hotelServico.dados.hospedes || ''}
                            disabled={readonly}
                            onChange={(ev) => servico(hotelServico.id, { hospedes: ev.target.value }, true)}
                            className="min-h-[68px] rounded-lg text-xs"
                          />
                        </Field>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={readonly}
                            onClick={() => {
                              const lista = [registro.voo.piloto_nome, registro.voo.copiloto_nome].filter(Boolean);
                              servico(
                                hotelServico.id,
                                {
                                  hospedes: lista.join('\n'),
                                  quantidade_hospedes: String(lista.length),
                                },
                                true,
                              );
                            }}
                            className="h-10 text-xs"
                          >
                            Usar tripulação escalada
                          </Button>
                          <Button
                            type="button"
                            disabled={readonly || !!ocupado || !hotelServico.cadastro_id}
                            onClick={() => void reservar(hotelServico)}
                            className="h-10 gap-2 text-xs font-semibold"
                          >
                            <Send size={14} />
                            Enviar solicitação de reserva
                          </Button>
                          {!readonly && (
                            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary">
                              <Paperclip size={14} />
                              Anexar comprovante
                              <input
                                type="file"
                                className="sr-only"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                disabled={!!ocupado}
                                onChange={(ev) => {
                                  if (ev.target.files?.[0]) void anexar(hotelServico, ev.target.files[0]);
                                  ev.currentTarget.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {registro.reservas
                          ?.filter((r: any) => r.servico_id === hotelServico.id)
                          .map((r: any) => (
                            <p key={r.id} className="text-xs text-muted-foreground">
                              {r.status === 'ENVIADO'
                                ? 'Solicitação enviada'
                                : r.status === 'FALHA'
                                  ? 'Falha no envio'
                                  : 'Envio pendente'}{' '}
                              · {momento(r.enviado_em || r.criado_em)}
                            </p>
                          ))}
                        <div className="flex flex-wrap gap-2">
                          {registro.anexos
                            ?.filter((a: any) => a.servico_id === hotelServico.id)
                            .map((a: any) => (
                              <Button
                                type="button"
                                variant="outline"
                                key={a.id}
                                disabled={offline}
                                onClick={() => void baixar(`${root}/anexos/${a.id}`, a.nome)}
                                className="h-9 gap-1.5 text-xs"
                              >
                                <Paperclip size={13} />
                                {a.nome}
                              </Button>
                            ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Card expansível inline: Hangar e Serviços de Solo na Escala Ativa */}
          {eAtual && hangarServico && (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setHangarAberto((v) => !v)}
                aria-expanded={hangarAberto}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-secondary/35"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Wrench size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Hangar e apoio de solo ({papelAerodromoAtual}: {eAtual.icao || 'Aeródromo'})
                      </span>
                      <span
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                          BADGE_ESTADO[hangarServico.estado] || BADGE_ESTADO.PENDENTE,
                        )}
                      >
                        {ROTULOS[hangarServico.estado] || ROTULOS.PENDENTE}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Hangaragem, GPU, ar-condicionado, transfer e balizamento
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={cn('shrink-0 text-muted-foreground transition-transform', hangarAberto && 'rotate-180')}
                />
              </button>

              {hangarAberto && (
                <div className="space-y-4 border-t border-border bg-secondary/15 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field className="gap-1.5">
                      <FieldLabel className="text-xs font-semibold text-muted-foreground">
                        Cadastro de hangar / FBO
                      </FieldLabel>
                      <SearchableCombobox
                        items={opcoes.fornecedores
                          .filter(
                            (x: any) =>
                              !x.codigo_icao ||
                              !eAtual.icao ||
                              String(x.codigo_icao).toUpperCase() === String(eAtual.icao).toUpperCase(),
                          )
                          .map((x: any) => ({
                            id: `${x.origem}:${x.id}`,
                            label: String(x.nome || 'Fornecedor'),
                            descricao: [x.cidade, x.codigo_icao].filter(Boolean).join(' · '),
                          }))}
                        value={hangarServico?.cadastro_id ? `${hangarServico.origem}:${hangarServico.cadastro_id}` : ''}
                        onChange={(id) => selecionar(hangarServico, id)}
                        placeholder="Selecione o cadastro do aeródromo"
                        searchPlaceholder="Buscar por fornecedor ou ICAO"
                        disabled={readonly}
                      />
                    </Field>
                    {campo('Cidade do aeródromo', eAtual.cidade, (v) =>
                      alterar((d) => {
                        d.escalas.find((x: any) => x.id === eAtual.id).cidade = v;
                      }),
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {(['HANGAR', 'GPU', 'AR_CONDICIONADO', 'TRANSFER'] as const).map((tipo) => {
                      const s = eAtual.servicos.find((x: any) => x.tipo === tipo);
                      if (!s) return null;
                      const label = {
                        HANGAR: 'Hangar',
                        GPU: 'GPU',
                        AR_CONDICIONADO: 'Ar-condicionado',
                        TRANSFER: 'Transfer',
                      }[tipo];
                      return (
                        <section key={tipo} className="space-y-3 rounded-xl border border-border bg-card p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-sm font-bold text-foreground">{label}</h5>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={readonly}
                                aria-pressed={s.estado === 'CONCLUIDO'}
                                onClick={() => servico(s.id, { estado: 'CONCLUIDO' })}
                                className={cn(
                                  'min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold',
                                  s.estado === 'CONCLUIDO'
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-border bg-background text-foreground hover:bg-secondary',
                                )}
                              >
                                Feito
                              </button>
                              <button
                                type="button"
                                disabled={readonly}
                                aria-pressed={s.estado === 'NAO_APLICAVEL'}
                                onClick={() => servico(s.id, { estado: 'NAO_APLICAVEL' })}
                                className={cn(
                                  'min-h-[34px] rounded-lg border px-2.5 text-xs font-semibold',
                                  s.estado === 'NAO_APLICAVEL'
                                    ? 'border-border bg-secondary text-foreground'
                                    : 'border-border bg-background text-muted-foreground hover:bg-secondary',
                                )}
                              >
                                N/A
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {campo('Disponibilidade', s.dados.disponibilidade, (v) =>
                              servico(s.id, { disponibilidade: v }, true),
                            )}
                            {campo('Valor referência', s.dados.valor, (v) => servico(s.id, { valor: v }, true))}
                            {campo('Valor acordado', s.dados.valor_acordado, (v) =>
                              servico(s.id, { valor_acordado: v }, true),
                            )}
                            {tipo === 'HANGAR' && (
                              <Field className="gap-1.5">
                                <FieldLabel className="text-xs font-semibold text-muted-foreground">
                                  Balizamento
                                </FieldLabel>
                                <Select
                                  value={s.dados.balizamento || 'PENDENTE'}
                                  disabled={readonly}
                                  onValueChange={(v) => servico(s.id, { balizamento: v }, true)}
                                >
                                  <SelectTrigger aria-label="Balizamento" className="h-11 rounded-lg text-sm sm:h-10 sm:text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PENDENTE">A confirmar</SelectItem>
                                    <SelectItem value="FEITO">Feito</SelectItem>
                                    <SelectItem value="NAO_NECESSARIO">Não necessário</SelectItem>
                                  </SelectContent>
                                </Select>
                              </Field>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Demais serviços no aeródromo selecionado (ex.: Comissaria / Atendimento especial) */}
          {outrosServicosEscala.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">
                Demais serviços em {eAtual?.icao || papelAerodromoAtual}
              </h4>
              {outrosServicosEscala.map((s: any) => (
                <article key={s.id} className="space-y-3 rounded-xl border border-border bg-card p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-semibold text-foreground">
                      {registro.tipos_servico.find((t: any) => t.id === s.tipo)?.nome || s.tipo}
                    </strong>
                    {situacao(s, (estado) => servico(s.id, { estado }))}
                  </div>
                  {campo('Observação / motivo', s.observacao, (v) => servico(s.id, { observacao: v }))}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BLOCO 3: ABASTECIMENTO (previsão com fornecedor + realizado em um único fluxo) */}
      {aba === 'combustivel' && (
        <div className="space-y-5">
          {seletorAerodromo('Aeródromo de abastecimento')}

          {combustivelServico && (
            <article className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Fornecedor e previsão de combustível</h4>
                  <p className="text-xs text-muted-foreground">
                    Selecione o fornecedor em {eAtual?.icao || papelAerodromoAtual} ou confirme que não haverá abastecimento.
                  </p>
                </div>
                {situacao(combustivelServico, (estado) => servico(combustivelServico.id, { estado }))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field className="flex-1 gap-1.5">
                  <FieldLabel className="text-xs font-semibold text-muted-foreground">Fornecedor</FieldLabel>
                  <SearchableCombobox
                    items={opcoes.fornecedores
                      .filter((f: any) => f.origem === 'combustivel')
                      .map((f: any) => ({
                        id: `combustivel:${f.id}`,
                        label: String(f.nome || f.nome_fornecedor),
                        descricao: [f.codigo_icao, f.cidade || f.nome_cidade].filter(Boolean).join(' · '),
                      }))}
                    value={combustivelServico.cadastro_id ? `${combustivelServico.origem}:${combustivelServico.cadastro_id}` : ''}
                    selectedLabel={combustivelServico.dados.nome_fornecedor || undefined}
                    onChange={(id) => selecionar(combustivelServico, id)}
                    placeholder="Selecione o fornecedor"
                    searchPlaceholder="Buscar fornecedor, ICAO ou cidade"
                    emptyMessage="Nenhum fornecedor cadastrado."
                    disabled={readonly}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={readonly}
                  onClick={() =>
                    setNovoFornecedor({
                      nome_cidade: eAtual?.cidade || '',
                      codigo_icao: eAtual?.icao || '',
                      nome_fornecedor: '',
                      pessoa_contato: '',
                      telefone: '',
                      preco_avgas: '',
                      preco_jet: '',
                    })
                  }
                  className="h-10 gap-1.5 text-xs"
                >
                  <Plus size={14} />
                  Novo fornecedor
                </Button>
              </div>

              {novoFornecedor && (
                <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-bold text-foreground">Cadastrar fornecedor de combustível</h5>
                    <button
                      type="button"
                      onClick={() => setNovoFornecedor(null)}
                      aria-label="Cancelar cadastro"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['nome_fornecedor', 'Nome do fornecedor', 'text'],
                      ['nome_cidade', 'Cidade', 'text'],
                      ['codigo_icao', 'Código ICAO', 'text'],
                      ['pessoa_contato', 'Pessoa de contato', 'text'],
                      ['telefone', 'Telefone', 'tel'],
                      ['preco_avgas', 'Preço Avgas', 'number'],
                      ['preco_jet', 'Preço Jet', 'number'],
                    ].map(([k, l, t]) =>
                      campo(
                        String(l),
                        novoFornecedor[k],
                        (v) => setNovoFornecedor({ ...novoFornecedor, [k]: v }),
                        String(t),
                      ),
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={readonly || !!ocupado || !novoFornecedor.nome_fornecedor?.trim()}
                      onClick={() => void cadastrarFornecedor()}
                      className="h-10 gap-1.5 text-xs"
                    >
                      {ocupado === 'fornecedor' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Salvar fornecedor
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setNovoFornecedor(null)} className="h-10 text-xs">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campo('Código ICAO', combustivelServico.dados.codigo_icao, (v) =>
                  servico(combustivelServico.id, { codigo_icao: v.toUpperCase() }, true),
                )}
                {campo('Nome do fornecedor', combustivelServico.dados.nome_fornecedor, (v) =>
                  servico(combustivelServico.id, { nome_fornecedor: v }, true),
                )}
                {campo('Pessoa de contato', combustivelServico.dados.pessoa_contato, (v) =>
                  servico(combustivelServico.id, { pessoa_contato: v }, true),
                )}
                {campo(
                  'Telefone',
                  combustivelServico.dados.telefone,
                  (v) => servico(combustivelServico.id, { telefone: v }, true),
                  'tel',
                )}
                {campo(
                  'Preço Avgas',
                  combustivelServico.dados.preco_avgas,
                  (v) => servico(combustivelServico.id, { preco_avgas: v }, true),
                  'number',
                )}
                {campo(
                  'Preço Jet',
                  combustivelServico.dados.preco_jet,
                  (v) => servico(combustivelServico.id, { preco_jet: v }, true),
                  'number',
                )}
              </div>

              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold text-muted-foreground">Observações do abastecimento</FieldLabel>
                <Textarea
                  value={combustivelServico.observacao || ''}
                  disabled={readonly}
                  onChange={(e) => servico(combustivelServico.id, { observacao: e.target.value })}
                  className="min-h-[56px] rounded-lg text-xs"
                />
              </Field>
            </article>
          )}

          {/* Registro do abastecimento efetivamente realizado */}
          <div className="space-y-4 rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">Abastecimento realizado</h4>
                <p className="text-xs text-muted-foreground">
                  Lance os litros, comanda e nota fiscal após o reabastecimento.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={readonly}
                  onClick={() =>
                    item('abastecimento', {
                      estado: 'NAO_APLICAVEL',
                      observacao: `Não gerou abastecimento em ${eAtual?.icao || 'neste local'}.`,
                    })
                  }
                  className="h-9 text-xs"
                >
                  Não gerou abastecimento neste local
                </Button>
                {!readonly &&
                  !combustivel &&
                  !registro.abastecimentos?.some(
                    (a: any) => a.escala_id === eAtual?.id || (!a.escala_id && a.local === eAtual?.icao),
                  ) && (
                    <Button
                      type="button"
                      onClick={() =>
                        setCombustivel({
                          data: hoje(),
                          tipo_combustivel: 'Jet A-1',
                          litros: '',
                          valor_unitario: '',
                          desconto: '0',
                          numero_comanda: '',
                          numero_nf: '',
                          fornecedor_id: combustivelServico?.cadastro_id || '',
                        })
                      }
                      className="h-9 gap-1.5 text-xs"
                    >
                      <Plus size={14} />
                      Registrar abastecimento
                    </Button>
                  )}
              </div>
            </div>

            {registro.abastecimentos?.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {registro.abastecimentos.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-xs">
                    <div>
                      <strong className="font-mono text-foreground">{a.local}</strong>
                      <span className="ml-2 text-muted-foreground">{dataBR(a.data)}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground">
                      {a.litros} L · R$ {a.valor_unitario}/L
                    </span>
                  </div>
                ))}
              </div>
            )}

            {combustivel && (
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {campo('Data', combustivel.data, (v) => setCombustivel({ ...combustivel, data: v }), 'date')}
                  {campo('Combustível', combustivel.tipo_combustivel, (v) =>
                    setCombustivel({ ...combustivel, tipo_combustivel: v }),
                  )}
                  <Field className="gap-1.5">
                    <FieldLabel className="text-xs font-semibold text-muted-foreground">Fornecedor</FieldLabel>
                    <Select
                      value={combustivel.fornecedor_id || '__NONE__'}
                      onValueChange={(v) => setCombustivel({ ...combustivel, fornecedor_id: v === '__NONE__' ? '' : v })}
                    >
                      <SelectTrigger aria-label="Fornecedor" className="h-11 rounded-lg text-sm sm:h-10 sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">Selecione</SelectItem>
                        {opcoes.fornecedores
                          .filter((f: any) => f.categoria === 'COMBUSTIVEL' && Boolean(f.id))
                          .map((f: any) => (
                            <SelectItem key={f.origem + f.id} value={String(f.id)}>
                              {f.nome} · {f.codigo_icao}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {(['litros', 'valor_unitario', 'desconto', 'numero_comanda', 'numero_nf'] as const).map((k) =>
                    campo(
                      {
                        litros: 'Litros abastecidos',
                        valor_unitario: 'Valor por litro',
                        desconto: 'Desconto',
                        numero_comanda: 'Comanda',
                        numero_nf: 'Nota fiscal',
                      }[k],
                      combustivel[k],
                      (v) => setCombustivel({ ...combustivel, [k]: v }),
                      ['litros', 'valor_unitario', 'desconto'].includes(k) ? 'number' : 'text',
                    ),
                  )}
                  <Field className="gap-1.5">
                    <FieldLabel className="text-xs font-semibold text-muted-foreground">Comprovante</FieldLabel>
                    <Input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setCombustivel({ ...combustivel, arquivo: e.target.files?.[0] })}
                      className="h-11 rounded-lg text-xs sm:h-10"
                    />
                  </Field>
                </div>

                {opcoes.ultimo_diario && (
                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={!!combustivel.lancamento_diario_id}
                      onChange={(e) =>
                        setCombustivel({
                          ...combustivel,
                          lancamento_diario_id: e.target.checked ? opcoes.ultimo_diario.id : '',
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    Vincular ao último trecho do diário: {opcoes.ultimo_diario.origem} → {opcoes.ultimo_diario.destino} (
                    {opcoes.ultimo_diario.data})
                  </label>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={!!ocupado} onClick={() => void registrarCombustivel()} className="h-10 text-xs">
                    Salvar abastecimento realizado
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCombustivel(null)} className="h-10 text-xs">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLOCO 4: BRIEFING & RESUMO COMPLETO */}
      {aba === 'resumo' && (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {dados.trechos.map((t: any, i: number) => (
              <div key={t.id} className="rounded-xl border border-border bg-secondary/30 p-3.5">
                <strong className="block font-mono text-sm font-bold text-foreground">
                  Trecho {i + 1}: {t.origem} → {t.destino}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dataBR(t.data) || 'Data a confirmar'} · {t.horario || 'Horário a confirmar'} ·{' '}
                  {t.fuso || 'Fuso a confirmar'}
                  {t.pernoite ? ' · Pernoite' : ''}
                </p>
              </div>
            ))}
          </div>

          {respostas.filter((r) => !resolvido(r)).length > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-300">
              <AlertCircle size={16} className="shrink-0" />
              <span>Há itens pendentes. Você ainda pode concluir e eles ficarão detalhados no relatório do briefing.</span>
            </div>
          )}

          {dados.escalas.map((e: any, idx: number) => (
            <div key={e.id} className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {papelAerodromo(e, idx, dados.escalas.length)} · {e.icao || 'Aeródromo'} {e.cidade ? `· ${e.cidade}` : ''}
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {e.servicos
                  .filter((s: any) => !['PLANO_VOO', 'METEO_NOTAM', 'BALIZAMENTO'].includes(s.tipo))
                  .map((s: any) => (
                    <div key={s.id} className="space-y-2 rounded-xl border border-border bg-card p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-foreground">
                          {registro.tipos_servico.find((t: any) => t.id === s.tipo)?.nome}
                          {s.dados.nome ? ` · ${s.dados.nome}` : ''}
                        </strong>
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                            BADGE_ESTADO[s.estado] || BADGE_ESTADO.PENDENTE,
                          )}
                        >
                          {ROTULOS[s.estado]}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {s.observacao || (!resolvido(s) ? 'Motivo não informado' : 'Sem observação')}
                      </p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {Object.entries({
                          telefone: 'Telefone',
                          email: 'E-mail',
                          checkin: 'Check-in',
                          checkout: 'Check-out',
                          quartos: 'Quartos',
                          hospedes: 'Hóspedes',
                          valor_acordado: 'Valor acordado',
                          nome_fornecedor: 'Fornecedor',
                        })
                          .filter(([k]) => s.dados[k])
                          .map(([k, nome]) => (
                            <div key={k} className="min-w-0">
                              <dt className="text-muted-foreground">{nome}</dt>
                              <dd className="truncate font-semibold text-foreground">
                                {['checkin', 'checkout'].includes(k) ? dataBR(s.dados[k]) : s.dados[k]}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      {s.dados.telefone && (
                        <a
                          href={`tel:${s.dados.telefone.replace(/[^+\d]/g, '')}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                        >
                          <Phone size={13} />
                          Ligar
                        </a>
                      )}
                      {registro.anexos
                        ?.filter((a: any) => a.servico_id === s.id)
                        .map((a: any) => (
                          <button
                            key={a.id}
                            type="button"
                            disabled={offline}
                            onClick={() => void baixar(`${root}/anexos/${a.id}`, a.nome)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                          >
                            <Paperclip size={13} />
                            {a.nome}
                          </button>
                        ))}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <details className="rounded-xl border border-border bg-secondary/20 p-3.5">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-foreground">
              <span>Conferência detalhada da aeronave e tripulação ({Object.keys(dados.itens).length} itens)</span>
              <ChevronRight size={15} />
            </summary>
            <div className="mt-3 space-y-4">
              {registro.secoes.map((sec: any) => (
                <div key={sec.id} className="space-y-1.5">
                  <h5 className="text-xs font-bold text-foreground">{sec.titulo}</h5>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {sec.itens.map((i: any) => (
                      <div
                        key={i.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                      >
                        <span className="truncate font-medium text-foreground">{i.label}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                            BADGE_ESTADO[dados.itens[i.id]?.estado] || BADGE_ESTADO.PENDENTE,
                          )}
                        >
                          {ROTULOS[dados.itens[i.id]?.estado] || 'Pendente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Observações gerais da preparação */}
      <Field className="gap-1.5">
        <FieldLabel className="text-xs font-semibold text-muted-foreground">Observações gerais da preparação</FieldLabel>
        <Textarea
          value={dados.observacoes}
          disabled={readonly}
          onChange={(e) =>
            alterar((d) => {
              d.observacoes = e.target.value;
            })
          }
          placeholder="Registre recados operacionais para a tripulação ou coordenação..."
          className="min-h-[64px] rounded-xl text-xs"
        />
      </Field>

      {/* Lista interativa de pendências (quando expandida pelo rodapé) */}
      {mostrarPendencias && (
        <section
          ref={pendenciasRef}
          className="space-y-3 rounded-xl border border-border bg-secondary/25 p-4"
          aria-label="Detalhes das pendências"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Pendências da preparação ({pendencias})</h4>
            <button
              type="button"
              onClick={() => setMostrarPendencias(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>
          {pendenciasDetalhadas.length ? (
            <div className="space-y-2.5">
              {pendenciasDetalhadas.map((p: any, i: number) => (
                <div
                  key={`${p.tipo}-${p.id ?? p.indice}-${i}`}
                  className="space-y-2.5 rounded-xl border border-border bg-card p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="block text-xs font-bold text-foreground">{p.item}</strong>
                      <span className="text-xs text-muted-foreground">{p.etapa}</span>
                    </div>
                  </div>
                  {(p.tipo === 'item' || p.tipo === 'servico') && (
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                      {situacao(p.tipo === 'item' ? dados.itens[p.id] : servicoPorId(p.id), (estado) =>
                        atualizarPendencia(p, { estado }),
                      )}
                      <Textarea
                        aria-label={`Observação: ${p.item}`}
                        placeholder="Observação ou motivo, se necessário"
                        value={(p.tipo === 'item' ? dados.itens[p.id] : servicoPorId(p.id))?.observacao || ''}
                        disabled={readonly}
                        onChange={(e) => atualizarPendencia(p, { observacao: e.target.value })}
                        className="min-h-[42px] rounded-lg text-xs"
                      />
                      <Button
                        type="button"
                        disabled={readonly}
                        onClick={() => atualizarPendencia(p, { estado: 'CONCLUIDO' })}
                        className="h-10 gap-1.5 text-xs"
                      >
                        <Check size={14} />
                        Concluir
                      </Button>
                    </div>
                  )}
                  {p.tipo === 'cafe' && (
                    <Field className="max-w-xs gap-1.5">
                      <FieldLabel className="text-xs font-semibold text-muted-foreground">Café da manhã</FieldLabel>
                      <Select
                        value=""
                        disabled={readonly}
                        onValueChange={(v) => {
                          if (v) servico(p.id, { cafe_estado: v }, true);
                        }}
                      >
                        <SelectTrigger aria-label="Café da manhã" className="h-10 rounded-lg text-xs">
                          <SelectValue placeholder="Defina a situação" />
                        </SelectTrigger>
                        <SelectContent>
                          {['INCLUIDO', 'A_PARTE', 'NAO_OFERECE'].map((k) => (
                            <SelectItem key={k} value={k}>
                              {CAFES[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {p.tipo === 'oleo' && (
                    <div className="max-w-xs">
                      {campo('Nível de óleo LH / RH', dados.nivel_oleo, (v) =>
                        alterar((d) => {
                          d.nivel_oleo = v;
                        }),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={15} />
              Nenhuma pendência. Todos os itens foram resolvidos.
            </p>
          )}
        </section>
      )}

      {/* Rodapé fixo/acessível com botão primário claro */}
      <footer className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:px-0 sm:pb-0">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-expanded={mostrarPendencias}
            onClick={() => {
              const abrir = !mostrarPendencias;
              setMostrarPendencias(abrir);
              if (abrir) requestAnimationFrame(() => pendenciasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {pendencias} pendência(s) · {mostrarPendencias ? 'Ocultar detalhes' : 'Revisar pendências'}
          </button>
          <button
            type="button"
            onClick={() =>
              void api
                .json(`${root}/versoes`)
                .then(setVersoes)
                .catch((e) => setErro(mensagemErro(e)))
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <FileText size={13} />
            Versões do briefing
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            type="button"
            variant="outline"
            disabled={readonly || !!ocupado || !!conflito}
            onClick={() => void salvar(false)}
            className="h-11 rounded-xl text-xs font-semibold sm:h-10"
          >
            {ocupado === 'salvar' && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Salvar agora
          </Button>
          <Button
            type="button"
            disabled={readonly || !!ocupado || !!conflito}
            onClick={() => void salvar(true)}
            className="h-11 gap-1.5 rounded-xl text-xs font-bold sm:h-10"
          >
            {ocupado === 'concluir' ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
            Concluir preparação
          </Button>
        </div>
      </footer>

      {versoes && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-secondary/20 px-4">
          {versoes.map((v: any) => (
            <li key={v.versao} className="flex items-center justify-between gap-3 py-2.5 text-xs">
              <span className="text-foreground">
                Versão {v.versao} · {momento(v.criado_em)} · {v.tipo === 'CONCLUSAO' ? 'Conclusão' : 'Atualização'}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void baixar(`${root}/pdf?versao=${v.versao}`, `briefing-v${v.versao}.pdf`)}
                className="h-8 text-xs"
              >
                Baixar PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
