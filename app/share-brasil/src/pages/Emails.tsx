import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  XCircle,
  Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";
import { AnexosEmail } from "@/components/email/AnexosEmail";
import { buscarCentralEmail, enviarEmailCliente, type AnexoEmail, type ContatoEmail, type EmailEnviado } from "@/lib/colaborador-api";

// --- COMPONENTE: SeletorContatoEmail ---

type SeletorProps = {
  contatos: ContatoEmail[];
  busca: string;
  emailSelecionado: string;
  onBusca: (value: string) => void;
  onSelecionar: (contato: ContatoEmail) => void;
};

export function SeletorContatoEmail({ contatos, busca, emailSelecionado, onBusca, onSelecionar }: SeletorProps) {
  return (
    <div className="space-y-3">
      <div className="relative group">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <Input 
          value={busca} 
          onChange={(event) => onBusca(event.target.value)} 
          placeholder="Buscar cliente, sócio ou e-mail..." 
          className="h-10 pl-10 rounded-xl bg-muted/40 border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all shadow-sm" 
          aria-label="Buscar destinatário" 
        />
      </div>
      
      <div className="max-h-56 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
        {contatos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 p-5 text-center text-xs text-muted-foreground bg-muted/20">
            Nenhum contato encontrado.<br/>Você pode digitar o e-mail manualmente abaixo.
          </p>
        ) : (
          contatos.map((contato) => {
            const ativo = contato.email.toLowerCase() === emailSelecionado.toLowerCase();
            return (
              <button 
                key={`${contato.tipo}-${contato.id}-${contato.email}`} 
                type="button" 
                onClick={() => onSelecionar(contato)} 
                className={`group flex w-full items-center gap-3.5 rounded-xl p-2.5 text-left transition-all duration-200 ${
                  ativo 
                    ? "bg-primary text-primary-foreground shadow-md scale-[0.99]" 
                    : "bg-transparent hover:bg-muted/60 text-foreground"
                }`} 
                aria-pressed={ativo}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                  ativo ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-primary"
                }`}>
                  {contato.tipo === "cliente" ? <UserRound size={18} /> : <Mail size={18} />}
                </span>
                
                <span className="min-w-0 flex-1">
                  <strong className={`block truncate text-sm font-medium ${ativo ? "text-primary-foreground" : "text-foreground"}`}>
                    {contato.nome}
                  </strong>
                  <span className={`mt-0.5 block truncate text-xs ${ativo ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {contato.email}
                  </span>
                </span>
                
                {ativo && <Check size={18} className="shrink-0 text-primary-foreground" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL: Emails ---

const dataBr = (valor: string | null) => valor ? new Date(valor).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function Emails() {
  const [contatos, setContatos] = useState<ContatoEmail[]>([]);
  const [anexos, setAnexos] = useState<AnexoEmail[]>([]);
  const [historico, setHistorico] = useState<EmailEnviado[]>([]);
  const [busca, setBusca] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [nomeDestinatario, setNomeDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const carregar = async () => {
    setCarregando(true); setErro("");
    try { 
      const dados = await buscarCentralEmail(); 
      setContatos(dados.contatos); setAnexos(dados.anexos); setHistorico(dados.historico); 
    }
    catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível carregar a central de e-mail."); }
    finally { setCarregando(false); }
  };
  
  useEffect(() => { void carregar(); }, []);
  
  const contatosFiltrados = useMemo(() => { 
    const termo = busca.trim().toLowerCase(); 
    return !termo ? contatos : contatos.filter((item) => `${item.nome} ${item.email} ${item.tipo}`.toLowerCase().includes(termo)); 
  }, [busca, contatos]);
  
  const anexosSelecionados = anexos.filter((item) => selecionados.includes(item.id));
  const selecionarContato = (contato: ContatoEmail) => { setDestinatario(contato.email); setNomeDestinatario(contato.nome); };
  const alternarAnexo = (id: string) => setSelecionados((atual) => atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]);
  
  const enviar = async () => {
    if (!destinatario.trim() || !assunto.trim() || !mensagem.trim()) { setErro("Informe destinatário, assunto e mensagem."); return; }
    setEnviando(true); setErro(""); setSucesso("");
    try {
      await enviarEmailCliente({ destinatarios: [destinatario.trim()], assunto: assunto.trim(), mensagem: mensagem.trim(), anexos: anexosSelecionados.map(({ id }) => id), nome_destinatario: nomeDestinatario || undefined });
      setSucesso(`E-mail enviado com sucesso para ${destinatario.trim()}.`); 
      setAssunto(""); setMensagem(""); setDestinatario(""); setNomeDestinatario(""); setSelecionados([]); 
      await carregar();
    } catch (cause) { setErro(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail."); }
    finally { setEnviando(false); }
  };

  return (
    <div className="route-enter mx-auto max-w-6xl space-y-8 pb-10">
      
      {/* Header Estilo Mac */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <IndicadorPagina>Financeiro / E-mail</IndicadorPagina>
          <h1 className="mt-2 flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-foreground">
            Central de E-mail
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            Envie documentos financeiros com contatos e links seguros do Share Brasil.
          </p>
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          size="sm" 
          onClick={() => void carregar()} 
          disabled={carregando} 
          className="gap-2 rounded-full px-5 shadow-sm hover:shadow-md transition-all bg-background border border-border/40"
        > 
          <RefreshCw size={14} className={carregando ? "animate-spin text-primary" : "text-muted-foreground"} /> 
          Sincronizar
        </Button>
      </header>

      {/* Alertas */}
      {(erro || sucesso) && (
        <div className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
          erro ? "border border-destructive/20 bg-destructive/10 text-destructive" : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        }`}>
          {erro ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {erro || sucesso}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        
        {/* Painel Esquerdo: Nova Mensagem */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/40 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/30 bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Mail size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Nova Mensagem</h2>
                <p className="text-xs text-muted-foreground">Componha um novo e-mail seguro</p>
              </div>
            </div>
            <ShieldCheck size={20} className="text-primary/60" />
          </div>
          
          <div className="space-y-6 p-6">
            {/* Destinatário */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground">Para</label>
              <SeletorContatoEmail contatos={contatosFiltrados} busca={busca} emailSelecionado={destinatario} onBusca={setBusca} onSelecionar={selecionarContato} />
              
              <div className="relative mt-3 flex items-center">
                <div className="flex-1">
                  <Input 
                    value={destinatario} 
                    onChange={(event) => { setDestinatario(event.target.value); setNomeDestinatario(""); }} 
                    placeholder="Ou insira um e-mail manualmente..." 
                    type="email" 
                    className="h-10 rounded-xl border-border/50 bg-background/50 shadow-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20" 
                    aria-label="E-mail do destinatário" 
                  />
                </div>
                {nomeDestinatario && (
                  <span className="absolute right-3 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
                    {nomeDestinatario}
                  </span>
                )}
              </div>
            </div>

            {/* Assunto */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">Assunto</label>
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                  <Clock3 size={12} /> Envio imediato
                </span>
              </div>
              <Input 
                value={assunto} 
                onChange={(event) => setAssunto(event.target.value)} 
                placeholder="Ex: Resumo Financeiro - Setembro" 
                className="h-10 rounded-xl border-border/50 bg-background/50 shadow-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 text-sm font-medium" 
              />
            </div>

            {/* Mensagem */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground">Mensagem</label>
              <Textarea 
                value={mensagem} 
                onChange={(event) => setMensagem(event.target.value)} 
                placeholder="Escreva os detalhes aqui..." 
                className="min-h-[160px] resize-y rounded-xl border-border/50 bg-background/50 p-4 shadow-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 text-sm leading-relaxed" 
              />
            </div>

            {/* Anexos */}
            <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Paperclip size={14} /> Anexos
                </label>
                {selecionados.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                    {selecionados.length} selecionado(s)
                  </span>
                )}
              </div>
              <AnexosEmail anexos={anexos} selecionados={selecionados} onAlternar={alternarAnexo} />
            </div>

            {/* Botão Enviar */}
            <Button 
              type="button" 
              onClick={() => void enviar()} 
              disabled={enviando || carregando} 
              className="h-12 w-full rounded-xl gap-2 font-semibold shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
            >
              <Send size={16} /> 
              {enviando ? "Processando envio..." : "Enviar E-mail Seguro"}
            </Button>
          </div>
        </section>

        {/* Painel Direito: Preview e Histórico */}
        <section className="space-y-6">
          
          {/* Card: Prévia (Estilo Apple Mail) */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
            <div className="border-b border-border/30 bg-muted/30 px-5 py-3">
              <p className="text-xs font-semibold text-muted-foreground">Prévia do E-mail</p>
            </div>
            
            <div className="p-6">
              <div className="mb-6 flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground shadow-sm">
                  <span className="text-sm font-bold">{nomeDestinatario ? nomeDestinatario.charAt(0).toUpperCase() : (destinatario ? destinatario.charAt(0).toUpperCase() : "?")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {assunto || "Sem Assunto"}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    Para: <span className="text-foreground font-medium">{destinatario || "Nenhum destinatário"}</span>
                  </p>
                </div>
              </div>

              <div className="min-h-[120px] rounded-xl border border-border/30 bg-muted/10 p-5 text-sm leading-relaxed text-foreground/80 shadow-inner">
                {mensagem ? (
                  <div className="whitespace-pre-wrap">{mensagem}</div>
                ) : (
                  <span className="italic text-muted-foreground">A mensagem do e-mail aparecerá aqui...</span>
                )}
              </div>

              {anexosSelecionados.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {anexosSelecionados.map((item) => (
                    <span key={item.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted/50">
                      <FileText size={14} className="text-primary/70" />
                      {item.nome}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Histórico */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-sm backdrop-blur-xl transition-all">
            <button 
              type="button" 
              onClick={() => setMostrarHistorico((atual) => !atual)} 
              className="flex w-full items-center justify-between bg-card px-6 py-4 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <History size={14} className="text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground">Atividade Recente</span>
              </div>
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                {historico.length}
              </span>
            </button>
            
            {mostrarHistorico && (
              <div className="max-h-[400px] divide-y divide-border/40 overflow-y-auto border-t border-border/40 bg-card/30 custom-scrollbar">
                {historico.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">Nenhum envio registrado recentemente.</p>
                ) : (
                  historico.map((item) => (
                    <div key={item.id} className="group p-5 transition-colors hover:bg-muted/20">
                      <div className="flex items-start gap-4">
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.status === "enviado" ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>
                          {item.status === "enviado" ? <Check size={12} strokeWidth={3} /> : <XCircle size={14} />}
                        </span>
                        
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{item.assunto}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.destinatarios.join(", ")}</p>
                          
                          <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-muted-foreground/80">
                            <span className="flex items-center gap-1"><Clock3 size={10} /> {dataBr(item.criado_em)}</span>
                            <span className="flex items-center gap-1"><FileText size={10} /> {item.quantidade_anexos} doc(s)</span>
                          </div>
                        </div>
                        
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${item.status === "enviado" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
