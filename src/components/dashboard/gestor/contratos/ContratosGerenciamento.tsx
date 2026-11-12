import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Loader2,
  Plus,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import {
  carregarArquivoColaborador,
  colaboradorRequest,
} from '@/lib/colaborador-api';
import {
  calcularProposta,
  centavos,
  dataBR,
  edicaoDoContrato,
  moeda,
  novaEdicao,
  payloadContrato,
  reais,
  ROTULOS_STATUS,
  STATUS_CONTRATOS,
  validarEdicao,
  validadeProposta,
  type Contrato,
  type EdicaoContrato,
  type EventoContrato,
  type Parte,
  type Proposta,
} from './modelo';
import './contratos.css';

type Opcoes = {
  empresa: { razao_social?: string; cnpj?: string; endereco?: string } | null;
  aeronaves: { id: string; matricula_registro: string; modelo?: string }[];
  cotistas_contratos: {
    id: string;
    aeronave_id: string;
    nome: string;
    documento?: string;
  }[];
};
type Salvo = {
  id: string;
  numero: string;
  revisao: number;
  atualizado_em: string;
  dados_adicionais: Record<string, unknown>;
};
const vazio: Opcoes = { empresa: null, aeronaves: [], cotistas_contratos: [] };
const abas = [
  'Identificação',
  'Partes',
  'Serviços',
  'Condições',
  'Andamento',
  'Prévia',
] as const;
const erroHumano = (erro: unknown) => {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return msg.includes('contrato_alterado_por_outro_usuario')
    ? 'Este documento foi alterado em outra sessão. Seu preenchimento continua na tela. Reabrir a versão salva substituirá esta edição.'
    : msg.includes('numero_contrato_ja_cadastrado')
      ? 'Este número já pertence a outro contrato. Informe outro número.'
      : msg;
};
const dataHora = (valor: string) => {
  const d = new Date(
    valor.endsWith('Z') || valor.includes('+')
      ? valor
      : `${valor.replace(' ', 'T')}Z`,
  );
  return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR') : valor;
};
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Campo({
  nome,
  children,
  largo = false,
}: {
  nome: string;
  children: React.ReactNode;
  largo?: boolean;
}) {
  return (
    <label className={largo ? 'ct-campo ct-largo' : 'ct-campo'}>
      <span>{nome}</span>
      {children}
    </label>
  );
}
function Dinheiro({
  valor,
  onChange,
}: {
  valor: number;
  onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(reais(valor));
  useEffect(() => setTexto(reais(valor)), [valor]);
  return (
    <input
      aria-label="Valor em reais"
      inputMode="decimal"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const n = centavos(texto);
        if (n === null) setTexto(reais(valor));
        else {
          onChange(n);
          setTexto(reais(n));
        }
      }}
    />
  );
}
function DadosParte({
  titulo,
  parte,
  onChange,
}: {
  titulo: string;
  parte: Parte;
  onChange: (p: Parte) => void;
}) {
  const campo = (chave: keyof Parte, nome: string) => (
    <Campo nome={nome} key={chave}>
      <input
        value={String(parte[chave] || '')}
        onChange={(e) => onChange({ ...parte, [chave]: e.target.value })}
      />
    </Campo>
  );
  return (
    <section className="ct-painel">
      <h3>{titulo}</h3>
      <div className="ct-grade">
        <Campo nome="Tipo de pessoa">
          <select
            value={parte.tipo_pessoa}
            onChange={(e) =>
              onChange({
                ...parte,
                tipo_pessoa: e.target.value as Parte['tipo_pessoa'],
              })
            }
          >
            <option value="JURIDICA">Pessoa jurídica</option>
            <option value="FISICA">Pessoa física</option>
          </select>
        </Campo>
        {campo('nome', 'Nome ou razão social')}
        {campo('documento', 'CPF / CNPJ')}
        {campo('email', 'E-mail')}
        {campo('telefone', 'Telefone')}
        {campo('endereco', 'Endereço')}
        {campo('representante_nome', 'Representante')}
        {campo('representante_documento', 'CPF do representante')}
        {campo('representante_cargo', 'Cargo do representante')}
      </div>
    </section>
  );
}
export function ContratosGerenciamento() {
  const [lista, setLista] = useState<Contrato[]>([]),
    [opcoes, setOpcoes] = useState<Opcoes>(vazio),
    [carregando, setCarregando] = useState(true),
    [erro, setErro] = useState('');
  const [edicao, setEdicao] = useState<EdicaoContrato | null>(null),
    [registro, setRegistro] = useState<Contrato | null>(null),
    [aba, setAba] = useState<(typeof abas)[number]>('Identificação');
  const [salvando, setSalvando] = useState(false),
    [ocupado, setOcupado] = useState(false),
    [pendente, setPendente] = useState(false),
    [busca, setBusca] = useState(''),
    [filtro, setFiltro] = useState('TODOS');
  const edicaoRef = useRef(edicao),
    registroRef = useRef(registro),
    alteracoes = useRef(0),
    gravadas = useRef(0),
    emGravacao = useRef<Promise<Contrato> | null>(null),
    montado = useRef(true);
  const atualizarRegistro = (r: Contrato) => {
    registroRef.current = r;
    setRegistro(r);
    setLista((l) => [r, ...l.filter((c) => c.id !== r.id)]);
  };
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [l, o] = await Promise.all([
        colaboradorRequest<Contrato[]>('/api/gestor/contratos'),
        colaboradorRequest<Opcoes>('/api/gestor/contratos/opcoes'),
      ]);
      if (montado.current) {
        setLista(
          l.filter(
            (c) => c.dados_adicionais.modelo === 'PROPOSTA_GERENCIAMENTO',
          ),
        );
        setOpcoes(o);
      }
    } catch (e) {
      if (montado.current) setErro(erroHumano(e));
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, []);
  useEffect(() => {
    montado.current = true;
    void carregar();
    return () => {
      montado.current = false;
    };
  }, [carregar]);
  const mudar = (patch: Partial<EdicaoContrato>) => {
    if (!edicaoRef.current) return;
    const n = { ...edicaoRef.current, ...patch };
    edicaoRef.current = n;
    alteracoes.current++;
    setPendente(true);
    setEdicao(n);
    setErro('');
  };
  const proposta = (patch: Partial<Proposta>) =>
    mudar({ proposta: { ...edicaoRef.current!.proposta, ...patch } });
  const salvar = useCallback(async (): Promise<Contrato> => {
    if (emGravacao.current) {
      await emGravacao.current;
      if (alteracoes.current === gravadas.current) return registroRef.current!;
      return salvar();
    }
    if (registroRef.current && alteracoes.current === gravadas.current)
      return registroRef.current;
    const e = edicaoRef.current;
    if (!e) throw Error('Abra um documento.');
    const validacao = validarEdicao(e);
    if (validacao) throw Error(validacao);
    const versao = alteracoes.current;
    const atual = registroRef.current;
    setSalvando(true);
    const tarefa = (async () => {
      const resposta = await colaboradorRequest<Salvo>(
        atual ? `/api/gestor/contratos/${atual.id}` : '/api/gestor/contratos',
        {
          method: atual ? 'PUT' : 'POST',
          body: JSON.stringify(payloadContrato(e, atual)),
        },
      );
      const r = {
        ...atual,
        ...payloadContrato(e, atual),
        ...resposta,
        documento_url: atual?.documento_url || null,
        criado_em: atual?.criado_em || resposta.atualizado_em,
        anexos: atual?.anexos || [],
      } as Contrato;
      atualizarRegistro(r);
      gravadas.current = versao;
      setPendente(alteracoes.current !== versao);
      if (edicaoRef.current && !edicaoRef.current.numero && resposta.numero) {
        edicaoRef.current = { ...edicaoRef.current, numero: resposta.numero };
        setEdicao(edicaoRef.current);
      }
      return r;
    })();
    emGravacao.current = tarefa;
    try {
      return await tarefa;
    } finally {
      emGravacao.current = null;
      if (montado.current) setSalvando(false);
    }
  }, []);
  useEffect(
    () => () => {
      if (alteracoes.current !== gravadas.current)
        void salvar().catch(() => undefined);
    },
    [salvar],
  );
  const salvarComErro = async () => {
    try {
      setErro('');
      return await salvar();
    } catch (e) {
      setErro(erroHumano(e));
      return null;
    }
  };
  useEffect(() => {
    if (!edicao || !pendente || ocupado) return;
    const t = setTimeout(() => {
      void salvar().catch((e) => {
        if (montado.current) setErro(erroHumano(e));
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [edicao, pendente, ocupado, salvar]);
  useEffect(() => {
    const impedir = (e: BeforeUnloadEvent) => {
      if (alteracoes.current !== gravadas.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', impedir);
    return () => window.removeEventListener('beforeunload', impedir);
  }, []);
  const abrir = async (c: Contrato) => {
    if (edicaoRef.current && !(await salvarComErro())) return;
    setOcupado(true);
    try {
      const r = await colaboradorRequest<Contrato>(
        `/api/gestor/contratos/${c.id}`,
      );
      atualizarRegistro(r);
      const e = edicaoDoContrato(r);
      edicaoRef.current = e;
      setEdicao(e);
      alteracoes.current = 0;
      gravadas.current = 0;
      setPendente(false);
      setAba('Identificação');
      setErro('');
    } catch (e) {
      setErro(erroHumano(e));
    } finally {
      setOcupado(false);
    }
  };
  const reabrirSalvo = async () => {
    if (!registroRef.current) return;
    setOcupado(true);
    try {
      const r = await colaboradorRequest<Contrato>(
        `/api/gestor/contratos/${registroRef.current.id}`,
      );
      atualizarRegistro(r);
      edicaoRef.current = edicaoDoContrato(r);
      setEdicao(edicaoRef.current);
      alteracoes.current = gravadas.current = 0;
      setPendente(false);
      setErro('');
    } catch (e) {
      setErro(erroHumano(e));
    } finally {
      setOcupado(false);
    }
  };
  const novo = async () => {
    setOcupado(true);
    setErro('');
    const e = novaEdicao();
    if (opcoes.empresa)
      e.contratada = {
        ...e.contratada,
        nome: opcoes.empresa.razao_social || 'SHARE BRASIL',
        documento: opcoes.empresa.cnpj || '',
        endereco: opcoes.empresa.endereco || '',
      };
    registroRef.current = null;
    setRegistro(null);
    edicaoRef.current = e;
    setEdicao(e);
    alteracoes.current = 1;
    gravadas.current = 0;
    setPendente(true);
    setAba('Identificação');
    try {
      await salvar();
    } catch (err) {
      setErro(erroHumano(err));
    } finally {
      setOcupado(false);
    }
  };
  const voltar = async () => {
    if (!(await salvarComErro())) return;
    edicaoRef.current = null;
    setEdicao(null);
    registroRef.current = null;
    setRegistro(null);
    setErro('');
  };
  const gerar = async () => {
    const e = edicaoRef.current;
    if (!e) return;
    const validacao = validarEdicao(e, true);
    if (validacao) {
      setErro(validacao);
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      const r = await salvar();
      const snapshot = { ...e, numero: r.numero || e.numero };
      const { gerarPropostaPdf } = await import('./PropostaGerenciamentoPdf');
      const blob = await gerarPropostaPdf(snapshot);
      const nome = `${r.numero || 'proposta'}-r${r.revisao || 0}.pdf`;
      const form = new FormData();
      form.set('arquivo', new File([blob], nome, { type: 'application/pdf' }));
      form.set('tipo', 'PROPOSTA_GERADA');
      form.set('revisao', String(r.revisao || 0));
      await colaboradorRequest(`/api/gestor/contratos/${r.id}/anexos`, {
        method: 'POST',
        body: form,
      });
      atualizarRegistro(
        await colaboradorRequest<Contrato>(`/api/gestor/contratos/${r.id}`),
      );
      baixar(blob, nome);
    } catch (err) {
      setErro(erroHumano(err));
    } finally {
      setOcupado(false);
    }
  };
  const anexar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setOcupado(true);
    setErro('');
    try {
      const r = await salvar();
      const form = new FormData();
      form.set('arquivo', arquivo);
      form.set('tipo', 'ANEXO');
      await colaboradorRequest(`/api/gestor/contratos/${r.id}/anexos`, {
        method: 'POST',
        body: form,
      });
      atualizarRegistro(
        await colaboradorRequest<Contrato>(`/api/gestor/contratos/${r.id}`),
      );
    } catch (e) {
      setErro(erroHumano(e));
    } finally {
      setOcupado(false);
    }
  };
  const baixarAnexo = async (a: Contrato['anexos'][number]) => {
    try {
      baixar(await carregarArquivoColaborador(a.arquivo_url), a.nome);
    } catch (e) {
      setErro(erroHumano(e));
    }
  };
  const p = edicao?.proposta;
  let valor = 0,
    unitario = 0;
  try {
    if (p) {
      const t = calcularProposta(p);
      valor = t.total;
      unitario = t.unitario;
    }
  } catch {
    /* O formulário exibe o erro ao salvar. */
  }
  const historico = (registro?.dados_adicionais.historico_andamento ||
    []) as EventoContrato[];
  const filtrados = lista.filter(
    (c) =>
      (filtro === 'TODOS' || c.status === filtro) &&
      `${c.numero} ${c.titulo} ${c.partes.map((p) => p.nome).join(' ')} ${String((c.dados_adicionais.proposta_gerenciamento as Proposta)?.aeronave_descricao || '')}`
        .toLocaleLowerCase('pt-BR')
        .includes(busca.toLocaleLowerCase('pt-BR')),
  );
  return (
    <div className="ct-central">
      <header className="ct-cabecalho">
        <div>
          <span className="ct-sobre">GESTOR / CONTRATOS</span>
          <h2>
            {edicao
              ? 'Proposta de gerenciamento'
              : 'Propostas de gerenciamento'}
          </h2>
          <p>
            {edicao
              ? 'Preencha, revise e acompanhe o documento.'
              : 'Documentos, valores e andamento em um só lugar.'}
          </p>
        </div>
        {!edicao && (
          <button
            className="ct-botao ct-primario"
            onClick={() => void novo()}
            disabled={carregando || ocupado}
          >
            <Plus size={17} /> Nova proposta
          </button>
        )}
      </header>
      {erro && (
        <div role="alert" className="ct-erro">
          {erro}
          {edicao && erro.includes('outra sessão') && (
            <button
              disabled={ocupado || salvando}
              onClick={() => void reabrirSalvo()}
            >
              Reabrir versão salva
            </button>
          )}
          {!edicao && (
            <button onClick={() => void carregar()}>Tentar novamente</button>
          )}
        </div>
      )}
      {carregando ? (
        <div className="ct-vazio">
          <Loader2 className="ct-giro" /> Carregando documentos…
        </div>
      ) : !edicao ? (
        <>
          <div className="ct-indicadores">
            {[
              ['Documentos', lista.length],
              [
                'Em preparação',
                lista.filter((c) =>
                  ['RASCUNHO', 'EM_REVISAO'].includes(c.status),
                ).length,
              ],
              [
                'Em vigência',
                lista.filter((c) => c.status === 'EM_VIGENCIA').length,
              ],
            ].map(([n, v]) => (
              <div key={n}>
                <span>{n}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="ct-filtros">
            <label className="ct-busca">
              <Search size={16} />
              <input
                aria-label="Buscar propostas"
                placeholder="Buscar por número, cliente ou aeronave"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar por andamento"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            >
              <option value="TODOS">Todos os status</option>
              {STATUS_CONTRATOS.map((s) => (
                <option key={s} value={s}>
                  {ROTULOS_STATUS[s]}
                </option>
              ))}
            </select>
          </div>
          {!filtrados.length ? (
            <div className="ct-vazio">
              <FileText size={27} />
              <h3>
                {lista.length
                  ? 'Nenhuma proposta encontrada'
                  : 'Sua próxima proposta começa aqui'}
              </h3>
              <p>
                {lista.length
                  ? 'Ajuste a busca ou o status.'
                  : 'Crie um rascunho a partir do modelo de gerenciamento Share Brasil.'}
              </p>
            </div>
          ) : (
            <div className="ct-tabela">
              <table>
                <thead>
                  <tr>
                    <th>Documento / cliente</th>
                    <th>Aeronave</th>
                    <th>Status</th>
                    <th>Total mensal</th>
                    <th>Atualização</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.numero || 'Sem número'}</strong>
                        <span>
                          {c.partes.find((p) => p.papel === 'CONTRATANTE')
                            ?.nome || 'Cliente a definir'}
                        </span>
                      </td>
                      <td>
                        {(c.dados_adicionais.proposta_gerenciamento as Proposta)
                          ?.aeronave_descricao || '—'}
                      </td>
                      <td>
                        <span className={`ct-status ct-status-${c.status}`}>
                          {ROTULOS_STATUS[c.status]}
                        </span>
                      </td>
                      <td>{moeda(c.valor_centavos || 0)}</td>
                      <td>{dataHora(c.atualizado_em)}</td>
                      <td>
                        <button
                          className="ct-botao"
                          disabled={ocupado}
                          onClick={() => void abrir(c)}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ct-barra">
            <button
              className="ct-botao"
              onClick={() => void voltar()}
              disabled={ocupado}
            >
              <ArrowLeft size={16} /> Documentos
            </button>
            <div className="ct-gravacao" role="status">
              {salvando ? (
                <>
                  <Loader2 size={14} className="ct-giro" /> Salvando…
                </>
              ) : pendente ? (
                'Alterações não salvas'
              ) : (
                <>
                  <Check size={14} /> Salvo{' '}
                  {registro ? dataHora(registro.atualizado_em) : ''}
                </>
              )}
            </div>
            <button
              className="ct-botao"
              onClick={() => void salvarComErro()}
              disabled={ocupado || salvando}
            >
              <Save size={16} /> Salvar agora
            </button>
            <button
              className="ct-botao ct-primario"
              disabled={ocupado || salvando}
              onClick={() => void gerar()}
            >
              {ocupado ? (
                <Loader2 size={16} className="ct-giro" />
              ) : (
                <Download size={16} />
              )}{' '}
              Gerar e salvar PDF
            </button>
          </div>
          <div className="ct-contexto">
            <div>
              <span>{edicao.numero || 'NOVO RASCUNHO'}</span>
              <strong>{edicao.contratante.nome || 'Cliente a definir'}</strong>
              <small>{p!.aeronave_descricao || 'Aeronave a definir'}</small>
            </div>
            <div>
              <span className={`ct-status ct-status-${edicao.status}`}>
                {ROTULOS_STATUS[edicao.status]}
              </span>
            </div>
            <div className="ct-valor">
              <span>Total mensal</span>
              <strong>{moeda(valor)}</strong>
              <small>
                {p!.unidade === 'POR_COTISTA'
                  ? `${p!.quantidade_cotistas} cotista(s)`
                  : 'Por aeronave'}
              </small>
            </div>
          </div>
          <nav className="ct-abas" aria-label="Etapas da proposta">
            {abas.map((a) => (
              <button
                key={a}
                aria-current={aba === a ? 'page' : undefined}
                className={aba === a ? 'ct-ativa' : ''}
                onClick={() => setAba(a)}
              >
                {a}
              </button>
            ))}
          </nav>
          <fieldset disabled={ocupado} className="ct-edicao">
            {aba === 'Identificação' && (
              <section className="ct-painel">
                <h3>Identificação do documento</h3>
                <p>
                  O preenchimento é salvo automaticamente. Você pode retomar
                  este rascunho depois.
                </p>
                <div className="ct-grade">
                  <Campo nome="Título" largo>
                    <input
                      value={edicao.titulo}
                      maxLength={240}
                      onChange={(e) => mudar({ titulo: e.target.value })}
                    />
                  </Campo>
                  <Campo nome="Número interno">
                    <input
                      value={edicao.numero}
                      onChange={(e) => mudar({ numero: e.target.value })}
                    />
                  </Campo>
                  <Campo nome="Emissão">
                    <input
                      type="date"
                      value={p!.emissao}
                      onChange={(e) => proposta({ emissao: e.target.value })}
                    />
                  </Campo>
                  <Campo nome="Aeronave cadastrada">
                    <select
                      value={edicao.aeronave_id}
                      onChange={(e) => {
                        const a = opcoes.aeronaves.find(
                          (a) => a.id === e.target.value,
                        );
                        mudar({
                          aeronave_id: e.target.value,
                          cotista_id: '',
                          proposta: {
                            ...p!,
                            aeronave_descricao: a
                              ? [a.matricula_registro, a.modelo]
                                  .filter(Boolean)
                                  .join(' · ')
                              : p!.aeronave_descricao,
                          },
                        });
                      }}
                    >
                      <option value="">
                        Sem vínculo / preenchimento manual
                      </option>
                      {opcoes.aeronaves.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.matricula_registro} · {a.modelo}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo nome="Aeronave apresentada no documento">
                    <input
                      value={p!.aeronave_descricao}
                      placeholder="Ex.: PT-XXX · Modelo da aeronave"
                      onChange={(e) =>
                        proposta({ aeronave_descricao: e.target.value })
                      }
                    />
                  </Campo>
                  <Campo nome="Cidade de emissão">
                    <input
                      value={p!.cidade}
                      onChange={(e) => proposta({ cidade: e.target.value })}
                    />
                  </Campo>
                  <Campo nome="Validade da proposta (dias)">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={p!.validade_dias}
                      onChange={(e) =>
                        proposta({ validade_dias: Number(e.target.value) })
                      }
                    />
                  </Campo>
                  <Campo nome="Apresentação da empresa" largo>
                    <textarea
                      rows={13}
                      value={p!.apresentacao}
                      onChange={(e) =>
                        proposta({ apresentacao: e.target.value })
                      }
                    />
                  </Campo>
                </div>
              </section>
            )}
            {aba === 'Partes' && (
              <>
                <section className="ct-painel">
                  <h3>Vincular contratante</h3>
                  <Campo nome="Cotista cadastrado (opcional)">
                    <select
                      value={edicao.cotista_id}
                      onChange={(e) => {
                        const c = opcoes.cotistas_contratos.find(
                          (c) => c.id === e.target.value,
                        );
                        mudar({
                          cotista_id: e.target.value,
                          ...(c
                            ? {
                                contratante: {
                                  ...edicao.contratante,
                                  nome: c.nome,
                                  documento: c.documento || '',
                                },
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Preencher manualmente</option>
                      {opcoes.cotistas_contratos
                        .filter(
                          (c) =>
                            !edicao.aeronave_id ||
                            c.aeronave_id === edicao.aeronave_id,
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                    </select>
                  </Campo>
                </section>
                <DadosParte
                  titulo="Contratante / cliente"
                  parte={edicao.contratante}
                  onChange={(contratante) => mudar({ contratante })}
                />
                <DadosParte
                  titulo="Contratada / prestadora do serviço"
                  parte={edicao.contratada}
                  onChange={(contratada) => mudar({ contratada })}
                />
              </>
            )}
            {aba === 'Serviços' && (
              <>
                <section className="ct-painel">
                  <h3>Escopo do gerenciamento</h3>
                  <p>
                    Selecione os grupos incluídos e edite um serviço por linha.
                  </p>
                </section>
                {p!.servicos.map((s, i) => (
                  <section key={s.id} className="ct-painel">
                    <label className="ct-selecao">
                      <input
                        type="checkbox"
                        checked={s.incluido}
                        onChange={(e) =>
                          proposta({
                            servicos: p!.servicos.map((g, j) =>
                              i === j
                                ? { ...g, incluido: e.target.checked }
                                : g,
                            ),
                          })
                        }
                      />
                      <strong>{s.titulo}</strong>
                      <span>{s.incluido ? 'Incluído' : 'Fora do escopo'}</span>
                    </label>
                    <div className="ct-grade">
                      <Campo nome="Nome do grupo">
                        <input
                          value={s.titulo}
                          onChange={(e) =>
                            proposta({
                              servicos: p!.servicos.map((g, j) =>
                                i === j ? { ...g, titulo: e.target.value } : g,
                              ),
                            })
                          }
                        />
                      </Campo>
                      {p!.modo_cobranca === 'SERVICOS' && (
                        <Campo nome="Valor mensal do grupo (R$)">
                          <Dinheiro
                            valor={s.valor_centavos}
                            onChange={(valor_centavos) =>
                              proposta({
                                servicos: p!.servicos.map((g, j) =>
                                  i === j ? { ...g, valor_centavos } : g,
                                ),
                              })
                            }
                          />
                        </Campo>
                      )}
                      <Campo nome="Serviços incluídos" largo>
                        <textarea
                          rows={Math.min(11, s.itens.length + 1)}
                          value={s.itens.join('\n')}
                          onChange={(e) =>
                            proposta({
                              servicos: p!.servicos.map((g, j) =>
                                i === j
                                  ? { ...g, itens: e.target.value.split('\n') }
                                  : g,
                              ),
                            })
                          }
                        />
                      </Campo>
                    </div>
                  </section>
                ))}
                <section className="ct-painel">
                  <div className="ct-grade">
                    <Campo nome="Descrição do atendimento" largo>
                      <textarea
                        rows={4}
                        value={p!.descricao_servicos}
                        onChange={(e) =>
                          proposta({ descricao_servicos: e.target.value })
                        }
                      />
                    </Campo>
                    <Campo nome="Áreas de atuação (uma por linha)" largo>
                      <textarea
                        rows={8}
                        value={p!.areas.join('\n')}
                        onChange={(e) =>
                          proposta({ areas: e.target.value.split('\n') })
                        }
                      />
                    </Campo>
                  </div>
                </section>
              </>
            )}
            {aba === 'Condições' && (
              <>
                <section className="ct-painel">
                  <h3>Investimento</h3>
                  <div className="ct-grade">
                    <Campo nome="Composição do preço">
                      <select
                        value={p!.modo_cobranca}
                        onChange={(e) =>
                          proposta({
                            modo_cobranca: e.target
                              .value as Proposta['modo_cobranca'],
                          })
                        }
                      >
                        <option value="PACOTE">Valor único do pacote</option>
                        <option value="SERVICOS">
                          Soma dos grupos selecionados
                        </option>
                      </select>
                    </Campo>
                    <Campo nome="Unidade de cobrança">
                      <select
                        value={p!.unidade}
                        onChange={(e) =>
                          proposta({
                            unidade: e.target.value as Proposta['unidade'],
                          })
                        }
                      >
                        <option value="POR_COTISTA">Por cotista</option>
                        <option value="POR_AERONAVE">Por aeronave</option>
                      </select>
                    </Campo>
                    {p!.modo_cobranca === 'PACOTE' && (
                      <Campo nome="Valor mensal do pacote (R$)">
                        <Dinheiro
                          valor={p!.valor_pacote_centavos}
                          onChange={(valor_pacote_centavos) =>
                            proposta({ valor_pacote_centavos })
                          }
                        />
                      </Campo>
                    )}
                    {p!.unidade === 'POR_COTISTA' && (
                      <Campo nome="Quantidade de cotistas na proposta">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={p!.quantidade_cotistas}
                          onChange={(e) =>
                            proposta({
                              quantidade_cotistas: Number(e.target.value),
                            })
                          }
                        />
                      </Campo>
                    )}
                    <Campo nome="Forma de pagamento">
                      <input
                        value={edicao.forma_pagamento}
                        onChange={(e) =>
                          mudar({ forma_pagamento: e.target.value })
                        }
                      />
                    </Campo>
                  </div>
                  <div className="ct-total">
                    <span>Total mensal desta proposta</span>
                    <strong>{moeda(valor)}</strong>
                  </div>
                  <p>
                    {p!.modo_cobranca === 'PACOTE'
                      ? 'Os serviços selecionados estão incluídos no valor do pacote.'
                      : 'O valor considera apenas os grupos selecionados. Edite os preços na aba Serviços.'}
                  </p>
                </section>
                <section className="ct-painel">
                  <h3>Condições e vigência</h3>
                  <div className="ct-grade">
                    <Campo nome="Condições comerciais" largo>
                      <textarea
                        rows={5}
                        value={p!.condicoes}
                        onChange={(e) =>
                          proposta({ condicoes: e.target.value })
                        }
                      />
                    </Campo>
                    <Campo nome="Início previsto">
                      <input
                        type="date"
                        value={edicao.data_inicio}
                        onChange={(e) => mudar({ data_inicio: e.target.value })}
                      />
                    </Campo>
                    <Campo nome="Término previsto">
                      <input
                        type="date"
                        value={edicao.data_fim}
                        onChange={(e) => mudar({ data_fim: e.target.value })}
                      />
                    </Campo>
                    <Campo nome="Foro (opcional)">
                      <input
                        value={edicao.foro}
                        onChange={(e) => mudar({ foro: e.target.value })}
                      />
                    </Campo>
                    <Campo nome="Mensagem de encerramento" largo>
                      <input
                        value={p!.encerramento}
                        onChange={(e) =>
                          proposta({ encerramento: e.target.value })
                        }
                      />
                    </Campo>
                  </div>
                </section>
              </>
            )}
            {aba === 'Andamento' && (
              <>
                <section className="ct-painel">
                  <h3>Andamento do documento</h3>
                  <p>Atualize o status conforme cada etapa for realizada.</p>
                  <div className="ct-grade">
                    <Campo nome="Status">
                      <select
                        value={edicao.status}
                        onChange={(e) =>
                          mudar({
                            status: e.target.value as EdicaoContrato['status'],
                          })
                        }
                      >
                        {STATUS_CONTRATOS.map((s) => (
                          <option key={s} value={s}>
                            {ROTULOS_STATUS[s]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <Campo nome="Data da assinatura">
                      <input
                        type="date"
                        value={edicao.data_assinatura}
                        onChange={(e) =>
                          mudar({ data_assinatura: e.target.value })
                        }
                      />
                    </Campo>
                    <Campo nome="Observações internas" largo>
                      <textarea
                        rows={4}
                        value={edicao.observacoes}
                        onChange={(e) => mudar({ observacoes: e.target.value })}
                      />
                    </Campo>
                  </div>
                </section>
                <section className="ct-painel">
                  <div className="ct-secao-topo">
                    <h3>Arquivos e versões</h3>
                    <label className="ct-botao">
                      <Upload size={15} /> Anexar arquivo
                      <input
                        type="file"
                        className="ct-arquivo"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          void anexar(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {!registro?.anexos.length ? (
                    <p>Os PDFs gerados e anexos ficarão registrados aqui.</p>
                  ) : (
                    registro.anexos.map((a) => (
                      <div className="ct-anexo" key={a.id}>
                        <FileText size={18} />
                        <div>
                          <strong>{a.nome}</strong>
                          <span>
                            {a.tipo === 'PROPOSTA_GERADA'
                              ? 'Versão gerada pelo sistema'
                              : 'Anexo do contrato'}
                          </span>
                        </div>
                        <button
                          className="ct-botao"
                          onClick={() => void baixarAnexo(a)}
                        >
                          <Download size={15} /> Baixar
                        </button>
                      </div>
                    ))
                  )}
                </section>
                <section className="ct-painel">
                  <h3>Histórico de andamento</h3>
                  <ol className="ct-historico">
                    {[...historico].reverse().map((h) => (
                      <li key={h.id}>
                        <span className="ct-ponto" />
                        <div>
                          <strong>
                            {h.acao === 'CRIADO'
                              ? 'Rascunho criado'
                              : h.acao === 'DOCUMENTO_GERADO'
                                ? 'Nova versão do PDF gerada'
                                : `${h.de ? ROTULOS_STATUS[h.de as keyof typeof ROTULOS_STATUS] + ' → ' : ''}${ROTULOS_STATUS[h.para as keyof typeof ROTULOS_STATUS] || h.para}`}
                          </strong>
                          <time>{dataHora(h.data)}</time>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
            {aba === 'Prévia' && (
              <div className="ct-previa">
                <div className="ct-folha">
                  <div className="ct-marca">
                    SHARE BRASIL <small>GERENCIAMENTO DE AERONAVES</small>
                  </div>
                  <span className="ct-sobre">
                    PROPOSTA COMERCIAL · {edicao.numero}
                  </span>
                  <h1>{edicao.titulo}</h1>
                  <div className="ct-previa-dados">
                    <div>
                      <small>PREPARADA PARA</small>
                      <strong>
                        {edicao.contratante.nome || 'Cliente a definir'}
                      </strong>
                      <span>{edicao.contratante.documento}</span>
                    </div>
                    <div>
                      <small>AERONAVE</small>
                      <strong>
                        {p!.aeronave_descricao || 'Aeronave a definir'}
                      </strong>
                      <span>Válida até {dataBR(validadeProposta(p!))}</span>
                    </div>
                  </div>
                  <h2>Gestão para voar com tranquilidade</h2>
                  {p!.apresentacao.split(/\n\s*\n/).map((t, i) => (
                    <p key={i}>{t}</p>
                  ))}
                  <h2>Serviços incluídos</h2>
                  {p!.servicos
                    .filter((s) => s.incluido)
                    .map((s) => (
                      <section key={s.id}>
                        <h3>{s.titulo}</h3>
                        {p!.modo_cobranca === 'SERVICOS' && (
                          <strong>{moeda(s.valor_centavos)} / mês</strong>
                        )}
                        <ul>
                          {s.itens
                            .filter((t) => t.trim())
                            .map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                        </ul>
                      </section>
                    ))}
                  <h2>Investimento e atendimento</h2>
                  <div className="ct-previa-investimento">
                    <strong>
                      {moeda(unitario)}{' '}
                      <small>
                        / mês{' '}
                        {p!.unidade === 'POR_COTISTA'
                          ? 'por cotista'
                          : 'por aeronave'}
                      </small>
                    </strong>
                    <p>Total mensal da proposta: {moeda(valor)}</p>
                  </div>
                  <p>{p!.descricao_servicos}</p>
                  <h3>Áreas de atuação</h3>
                  <ul>
                    {p!.areas
                      .filter((t) => t.trim())
                      .map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                  </ul>
                  <h3>Pagamento e condições</h3>
                  <p>{edicao.forma_pagamento}</p>
                  <p className="ct-texto-livre">{p!.condicoes}</p>
                  <p>
                    Validade: {p!.validade_dias} dias. Emissão:{' '}
                    {dataBR(p!.emissao)}.
                    {edicao.data_inicio
                      ? ` Início previsto: ${dataBR(edicao.data_inicio)}.`
                      : ''}
                    {edicao.data_fim
                      ? ` Término previsto: ${dataBR(edicao.data_fim)}.`
                      : ''}
                  </p>
                  {edicao.foro && <p>Foro: {edicao.foro}</p>}
                  <p>
                    {p!.cidade}, {dataBR(p!.emissao)}.
                  </p>
                  <h3>{p!.encerramento}</h3>
                  <strong>{edicao.contratada.nome}</strong>
                  <p>
                    {[
                      edicao.contratada.documento,
                      edicao.contratada.email,
                      edicao.contratada.telefone,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            )}
          </fieldset>
        </>
      )}
    </div>
  );
}
