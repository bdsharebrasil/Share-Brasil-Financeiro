import { useEffect, useRef, useState, type FormEvent } from "react";
import Cropper from "react-easy-crop";
import { CheckCircle2, FileText, KeyRound, Moon, Pencil, Sun, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  atualizarPerfilColaborador,
  atualizarSenhaColaborador,
  buscarPerfilColaborador,
  carregarArquivoColaborador,
  enviarDocumentoPessoal,
  enviarFotoColaborador,
  solicitarFerias,
  type PerfilColaboradorResponse,
} from "@/lib/colaborador-api";

type AbaPerfil = "dados" | "extrato" | "documentos" | "ferias";
type Tema = "dark" | "light";

const AVATAR_PADRAO = "/icon.pilot.png";
const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;

type AreaCortada = { x: number; y: number; width: number; height: number };

async function criarFotoCortada(origem: string, area: AreaCortada, nomeOriginal: string) {
  const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
    const elemento = new Image();
    elemento.onload = () => resolve(elemento);
    elemento.onerror = () => reject(new Error("imagem_invalida"));
    elemento.src = origem;
  });
  const largura = Math.max(1, Math.round(area.width));
  const altura = Math.max(1, Math.round(area.height));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("canvas_indisponivel");
  contexto.drawImage(imagem, area.x, area.y, area.width, area.height, 0, 0, largura, altura);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((resultado) => resultado ? resolve(resultado) : reject(new Error("canvas_vazio")), "image/jpeg", 0.92);
  });
  const nomeSemExtensao = nomeOriginal.replace(/\.[^/.]+$/, "") || "foto-perfil";
  const arquivo = new File([blob], `${nomeSemExtensao}-cortada.jpg`, { type: "image/jpeg" });
  return { arquivo, url: URL.createObjectURL(blob) };
}

const abas: Array<{ id: AbaPerfil; label: string }> = [
  { id: "dados", label: "Dados pessoais" },
  { id: "extrato", label: "Extrato bancário" },
  { id: "documentos", label: "Documentos pessoais" },
  { id: "ferias", label: "Férias" },
];

function formatarData(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function formatarMoeda(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatarTamanho(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function textoStatus(status: string) {
  return {
    pago: "Pago",
    pendente: "Pendente",
    cancelado: "Cancelado",
    em_analise: "Em análise",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
    solicitada: "Solicitada",
    aprovada: "Aprovada",
    reprovada: "Reprovada",
    cancelada: "Cancelada",
  }[status] || status;
}

export default function Perfil({ tema, onAlternarTema }: { tema: Tema; onAlternarTema: () => void }) {
  const { toast } = useToast();
  const [aba, setAba] = useState<AbaPerfil>("dados");
  const [dados, setDados] = useState<PerfilColaboradorResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [versaoFoto, setVersaoFoto] = useState(0);
  const [fotoDialogAberto, setFotoDialogAberto] = useState(false);
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [fotoOrigemUrl, setFotoOrigemUrl] = useState<string | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
  const [fotoPreviewFile, setFotoPreviewFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaCortada, setAreaCortada] = useState<AreaCortada | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoOrigemUrlRef = useRef<string | null>(null);
  const fotoPreviewUrlRef = useRef<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("RG");
  const [enviandoDocumento, setEnviandoDocumento] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacoesFerias, setObservacoesFerias] = useState("");
  const [solicitandoFerias, setSolicitandoFerias] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const response = await buscarPerfilColaborador();
      setDados(response);
      setNome(response.perfil.nome_completo);
      setCpf(response.perfil.cpf || "");
      setTelefone(response.perfil.telefone || "");
    } catch {
      toast({ title: "Não foi possível carregar o perfil", description: "Tente atualizar a página.", variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  useEffect(() => () => {
    if (fotoOrigemUrlRef.current) URL.revokeObjectURL(fotoOrigemUrlRef.current);
    if (fotoPreviewUrlRef.current) URL.revokeObjectURL(fotoPreviewUrlRef.current);
  }, []);

  useEffect(() => {
    let ativo = true;
    let url: string | null = null;
    if (dados?.perfil.foto_url) {
      void carregarArquivoColaborador(`/api/colaborador/foto?v=${versaoFoto}`).then((blob) => {
        if (!ativo) return;
        url = URL.createObjectURL(blob);
        setFoto(url);
      }).catch(() => setFoto(null));
    } else {
      setFoto(null);
    }
    return () => {
      ativo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dados?.perfil.foto_url, versaoFoto]);

  const salvarDados = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const response = await atualizarPerfilColaborador({ nome_completo: nome.trim(), cpf: cpf.trim() || null, telefone: telefone.trim() || null });
      setDados((current) => current ? { ...current, perfil: response.perfil } : current);
      toast({ title: "Perfil atualizado", description: "Seus dados foram salvos." });
    } catch {
      toast({ title: "Falha ao salvar", description: "Não foi possível atualizar seus dados.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  useEffect(() => {
    if (!fotoOrigemUrl || !areaCortada || !arquivoFoto) return;
    let ativo = true;
    setGerandoPreview(true);
    setFotoPreviewFile(null);
    if (fotoPreviewUrlRef.current) {
      URL.revokeObjectURL(fotoPreviewUrlRef.current);
      fotoPreviewUrlRef.current = null;
      setFotoPreviewUrl(null);
    }
    void criarFotoCortada(fotoOrigemUrl, areaCortada, arquivoFoto.name).then(({ arquivo, url }) => {
      if (!ativo) {
        URL.revokeObjectURL(url);
        return;
      }
      fotoPreviewUrlRef.current = url;
      setFotoPreviewUrl(url);
      setFotoPreviewFile(arquivo);
    }).catch(() => {
      if (ativo) toast({ title: "Falha ao preparar foto", description: "Não foi possível recortar esta imagem. Escolha outra e tente novamente.", variant: "destructive" });
    }).finally(() => {
      if (ativo) setGerandoPreview(false);
    });
    return () => { ativo = false; };
  }, [areaCortada, arquivoFoto, fotoOrigemUrl, toast]);

  const limparTrocaFoto = () => {
    if (fotoOrigemUrlRef.current) {
      URL.revokeObjectURL(fotoOrigemUrlRef.current);
      fotoOrigemUrlRef.current = null;
    }
    if (fotoPreviewUrlRef.current) {
      URL.revokeObjectURL(fotoPreviewUrlRef.current);
      fotoPreviewUrlRef.current = null;
    }
    setFotoDialogAberto(false);
    setArquivoFoto(null);
    setFotoOrigemUrl(null);
    setFotoPreviewUrl(null);
    setFotoPreviewFile(null);
    setAreaCortada(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setGerandoPreview(false);
  };

  const trocarFoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!arquivo || enviandoFoto) return;
    if (!arquivo.type.startsWith("image/") || arquivo.size > TAMANHO_MAXIMO_FOTO) {
      toast({ title: "Falha ao enviar foto", description: "Escolha uma imagem de até 10 MB e tente novamente.", variant: "destructive" });
      return;
    }
    if (fotoOrigemUrlRef.current) URL.revokeObjectURL(fotoOrigemUrlRef.current);
    if (fotoPreviewUrlRef.current) {
      URL.revokeObjectURL(fotoPreviewUrlRef.current);
      fotoPreviewUrlRef.current = null;
    }
    const origemUrl = URL.createObjectURL(arquivo);
    fotoOrigemUrlRef.current = origemUrl;
    setArquivoFoto(arquivo);
    setFotoOrigemUrl(origemUrl);
    setFotoPreviewFile(null);
    setFotoPreviewUrl(null);
    setAreaCortada(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFotoDialogAberto(true);
  };

  const salvarFoto = async () => {
    if (!fotoPreviewFile || enviandoFoto || gerandoPreview) return;
    setEnviandoFoto(true);
    try {
      await enviarFotoColaborador(fotoPreviewFile);
      limparTrocaFoto();
      setVersaoFoto((versao) => versao + 1);
      await carregar();
      toast({ title: "Foto atualizada", description: "Sua foto foi alterada com sucesso." });
    } catch {
      toast({ title: "Falha ao enviar foto", description: "Escolha uma imagem de até 10 MB e tente novamente.", variant: "destructive" });
    } finally {
      setEnviandoFoto(false);
    }
  };

  const anexarDocumento = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    setEnviandoDocumento(true);
    try {
      await enviarDocumentoPessoal(tipoDocumento, arquivo);
      await carregar();
      toast({ title: "Documento enviado", description: "O documento está em análise." });
    } catch {
      toast({ title: "Falha ao enviar documento", description: "Aceitamos PDF, JPG, PNG ou WEBP até 10 MB.", variant: "destructive" });
    } finally {
      setEnviandoDocumento(false);
      event.target.value = "";
    }
  };

  const alterarSenha = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (novaSenha.length < 8 || novaSenha !== confirmacaoSenha) {
      toast({ title: "Senha inválida", description: "Use pelo menos 8 caracteres e confirme a senha.", variant: "destructive" });
      return;
    }
    setSalvandoSenha(true);
    try {
      await atualizarSenhaColaborador(novaSenha);
      setNovaSenha("");
      setConfirmacaoSenha("");
      toast({ title: "Senha atualizada", description: "Sua senha foi alterada com sucesso." });
    } catch {
      toast({ title: "Falha ao alterar senha", description: "Não foi possível atualizar sua senha.", variant: "destructive" });
    } finally {
      setSalvandoSenha(false);
    }
  };

  const pedirFerias = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSolicitandoFerias(true);
    try {
      await solicitarFerias(dataInicio, dataFim, observacoesFerias);
      setDataInicio("");
      setDataFim("");
      setObservacoesFerias("");
      await carregar();
      toast({ title: "Solicitação enviada", description: "Aguarde a análise do departamento responsável." });
    } catch (error) {
      const message = error instanceof Error && error.message === "saldo_de_ferias_insuficiente"
        ? "O período solicitado ultrapassa seu saldo disponível."
        : "Confira as datas e tente novamente.";
      toast({ title: "Não foi possível solicitar férias", description: message, variant: "destructive" });
    } finally {
      setSolicitandoFerias(false);
    }
  };

  if (carregando) return <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">Carregando perfil...</div>;
  if (!dados) return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Perfil indisponível.</div>;

  const { perfil, pagamentos, documentos, ferias, resumo_ferias } = dados;
  const iniciais = perfil.nome_completo.split(" ").filter(Boolean).slice(0, 2).map((item) => item[0]).join("").toUpperCase() || "CO";

  return (
    <div className="route-enter space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary">Conta / Meu perfil</p>
          <h1 className="text-2xl font-extrabold tracking-[-.04em] md:text-[30px]">Meu perfil</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">Gerencie seus dados, documentos, pagamentos e férias.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/70 p-1">
          <span className="px-2 text-[10px] font-bold text-muted-foreground">Aparência</span>
          <button type="button" onClick={tema === "dark" ? undefined : onAlternarTema} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold ${tema === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><Moon size={13} /> Escuro</button>
          <button type="button" onClick={tema === "light" ? undefined : onAlternarTema} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold ${tema === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}><Sun size={13} /> Claro</button>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/75 p-5 sm:flex-row sm:items-center">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xl font-extrabold text-primary">
          <img src={foto || AVATAR_PADRAO} alt={`Foto de ${perfil.nome_completo}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = AVATAR_PADRAO; }} />
          <label htmlFor="foto-colaborador" className={`absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground ${enviandoFoto ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} title={enviandoFoto ? "Enviando foto" : "Trocar foto"}><Pencil size={12} /><input id="foto-colaborador" type="file" accept="image/*" className="hidden" onChange={trocarFoto} disabled={enviandoFoto} /></label>
        </div>
        <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{perfil.nome_completo}</h2><p className="mt-1 text-xs text-muted-foreground">{perfil.tipo_user || "Colaborador"} · {perfil.departamento || "Share Brasil"}</p><p className="mt-1 text-xs text-muted-foreground">{perfil.email}</p></div>
        <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[230px]"><div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="text-[9px] text-muted-foreground">Férias disponíveis</p><p className="mt-1 font-mono text-lg font-bold text-primary">{resumo_ferias.dias_disponiveis} dias</p></div><div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5"><p className="text-[9px] text-muted-foreground">Pagamentos</p><p className="mt-1 font-mono text-lg font-bold">{pagamentos.length}</p></div></div>
      </section>

      <Dialog open={fotoDialogAberto} onOpenChange={(aberto) => { if (!aberto && !enviandoFoto) limparTrocaFoto(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar foto do perfil</DialogTitle>
            <DialogDescription>Arraste a imagem para centralizar o rosto e use o zoom para ajustar o enquadramento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_150px]">
            <div className="space-y-3">
              <div className="relative h-[min(70vw,360px)] min-h-[240px] overflow-hidden rounded-lg bg-slate-950">
                {fotoOrigemUrl && <Cropper image={fotoOrigemUrl} crop={crop} zoom={zoom} aspect={1} cropShape="rect" showGrid onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setAreaCortada(pixels)} />}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold"><Label htmlFor="zoom-foto">Zoom</Label><span className="font-mono text-muted-foreground">{zoom.toFixed(1)}x</span></div>
                <div className="flex items-center gap-3"><span className="text-[10px] text-muted-foreground">1x</span><Slider id="zoom-foto" min={1} max={3} step={0.1} value={[zoom]} onValueChange={(valor) => setZoom(valor[0] ?? 1)} aria-label="Zoom da foto" disabled={enviandoFoto} /><span className="text-[10px] text-muted-foreground">3x</span></div>
              </div>
            </div>
            <div className="space-y-2"><p className="text-xs font-semibold">Prévia final</p><div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/30">{fotoPreviewUrl ? <img src={fotoPreviewUrl} alt="Prévia da foto recortada" className="h-full w-full object-cover" /> : <span className="px-4 text-center text-[10px] text-muted-foreground">{gerandoPreview ? "Gerando prévia..." : "A prévia aparecerá aqui"}</span>}</div></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={limparTrocaFoto} disabled={enviandoFoto}>Cancelar</Button>
            <Button type="button" onClick={() => void salvarFoto()} disabled={!fotoPreviewFile || gerandoPreview || enviandoFoto}>{enviandoFoto ? "Salvando..." : "Salvar foto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 p-1">
        {abas.map((item) => <button key={item.id} type="button" onClick={() => setAba(item.id)} className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[10px] font-bold transition-colors ${aba === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{item.label}</button>)}
      </nav>

      {aba === "dados" && <section className="rounded-xl border border-border bg-card/75 p-5"><div className="mb-5 flex items-center gap-2"><UserRound size={17} className="text-primary" /><div><h2 className="text-sm font-bold">Dados pessoais</h2><p className="text-[10px] text-muted-foreground">Informações cadastrais do colaborador.</p></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="perfil-nome">Nome completo</Label><Input id="perfil-nome" value={nome} onChange={(event) => setNome(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="perfil-email">E-mail corporativo</Label><Input id="perfil-email" value={perfil.email} disabled /></div><div className="space-y-2"><Label htmlFor="perfil-cpf">CPF</Label><Input id="perfil-cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="Não informado" /></div><div className="space-y-2"><Label htmlFor="perfil-telefone">Telefone</Label><Input id="perfil-telefone" value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="Não informado" /></div><div className="space-y-2"><Label>Tipo de usuário</Label><Input value={perfil.tipo_user || "Não informado"} disabled /></div><div className="space-y-2"><Label>Data de admissão</Label><Input value={formatarData(perfil.data_admissao)} disabled /></div><div className="space-y-2"><Label>Data de nascimento</Label><Input value={formatarData(perfil.data_nascimento)} disabled /></div><div className="space-y-2"><Label>RG</Label><Input value={perfil.rg || "Não informado"} disabled /></div><div className="space-y-2"><Label>CANAC</Label><Input value={perfil.canac || "Não informado"} disabled /></div><div className="space-y-2"><Label>Status</Label><Input value={perfil.status || "Não informado"} disabled /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="perfil-endereco">Endereço</Label><Input id="perfil-endereco" value={perfil.endereco || "Não informado"} disabled /></div><div className="space-y-2"><Label>Cidade</Label><Input value={perfil.cidade || "Não informado"} disabled /></div><div className="space-y-2"><Label>UF</Label><Input value={perfil.uf || "Não informado"} disabled /></div><div className="space-y-2"><Label>Departamento</Label><Input value={perfil.departamento || "Não informado"} disabled /></div><div className="space-y-2"><Label>Banco</Label><Input value={perfil.nome_banco || "Não informado"} disabled /></div><div className="space-y-2"><Label>Tipo de conta</Label><Input value={perfil.tipo_conta || "Não informado"} disabled /></div><div className="space-y-2"><Label>Agência</Label><Input value={perfil.agencia_numero || "Não informado"} disabled /></div><div className="space-y-2"><Label>Conta</Label><Input value={perfil.conta_numero || "Não informado"} disabled /></div><div className="space-y-2"><Label>{perfil.tipo_chave_pix ? `Chave ${perfil.tipo_chave_pix}` : "Chave Pix"}</Label><Input value={perfil.pix || "Não informado"} disabled /></div></div><div className="mt-5 flex justify-end"><Button type="button" onClick={() => void salvarDados()} disabled={salvando || !nome.trim()}>{salvando ? "Salvando..." : "Salvar alterações"}</Button></div><form className="mt-6 border-t border-border/70 pt-5" onSubmit={alterarSenha}><div className="mb-4 flex items-center gap-2"><KeyRound size={15} className="text-primary" /><div><h3 className="text-xs font-bold">Trocar senha</h3><p className="text-[10px] text-muted-foreground">Use pelo menos 8 caracteres.</p></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="nova-senha">Nova senha</Label><Input id="nova-senha" type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} minLength={8} required /></div><div className="space-y-2"><Label htmlFor="confirmacao-senha">Confirmar nova senha</Label><Input id="confirmacao-senha" type="password" value={confirmacaoSenha} onChange={(event) => setConfirmacaoSenha(event.target.value)} minLength={8} required /></div></div><div className="mt-4 flex justify-end"><Button type="submit" disabled={salvandoSenha}>{salvandoSenha ? "Atualizando..." : "Atualizar senha"}</Button></div></form></section>}

      {aba === "extrato" && <section className="overflow-hidden rounded-xl border border-border bg-card/75"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Extrato bancário</h2><p className="mt-1 text-[10px] text-muted-foreground">Valores pagos ou programados para você.</p></div>{pagamentos.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">Nenhum pagamento registrado.</div> : <div className="divide-y divide-border/70">{pagamentos.map((pagamento) => <div key={pagamento.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 size={17} /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">{pagamento.descricao}</p><p className="mt-1 text-[10px] text-muted-foreground">Competência: {pagamento.competencia || "Não informada"} · Pagamento: {formatarData(pagamento.data_pagamento)}</p></div><div className="flex items-center gap-3 sm:flex-col sm:items-end"><strong className="font-mono text-sm">{formatarMoeda(pagamento.valor)}</strong><span className="text-[9px] font-bold uppercase text-primary">{textoStatus(pagamento.status)}</span></div></div>)}</div>}</section>}

      {aba === "documentos" && <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-xl border border-border bg-card/75 p-5"><div className="mb-5 flex items-center gap-2"><Upload size={17} className="text-primary" /><div><h2 className="text-sm font-bold">Anexar documento</h2><p className="text-[10px] text-muted-foreground">PDF, JPG, PNG ou WEBP até 10 MB.</p></div></div><div className="space-y-4"><div className="space-y-2"><Label htmlFor="tipo-documento">Tipo do documento</Label><select id="tipo-documento" value={tipoDocumento} onChange={(event) => setTipoDocumento(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option>RG</option><option>CPF</option><option>CNH</option><option>Comprovante de residência</option><option>Certidão</option><option>Outro</option></select></div><label htmlFor="arquivo-documento" className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center hover:bg-primary/10"><FileText size={23} className="mb-2 text-primary" /><span className="text-xs font-bold">{enviandoDocumento ? "Enviando..." : "Clique para selecionar o arquivo"}</span><span className="mt-1 text-[10px] text-muted-foreground">O documento será enviado para análise</span><input id="arquivo-documento" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={anexarDocumento} disabled={enviandoDocumento} /></label></div></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Meus documentos</h2><p className="mt-1 text-[10px] text-muted-foreground">Acompanhe os arquivos enviados.</p></div>{documentos.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">Nenhum documento enviado.</div> : <div className="divide-y divide-border/70">{documentos.map((documento) => <div key={documento.id} className="flex items-center gap-3 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{documento.nome_arquivo}</p><p className="mt-1 text-[10px] text-muted-foreground">{documento.tipo_documento} · {formatarTamanho(documento.tamanho_bytes)}</p></div><span className="text-[9px] font-bold uppercase text-primary">{textoStatus(documento.status)}</span></div>)}</div>}</section></div>}

      {aba === "ferias" && <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section className="rounded-xl border border-border bg-card/75 p-5"><div className="mb-5"><h2 className="text-sm font-bold">Solicitar férias</h2><p className="mt-1 text-[10px] text-muted-foreground">Saldo disponível: <strong className="text-primary">{resumo_ferias.dias_disponiveis} dias</strong> de {resumo_ferias.dias_direito} dias.</p></div><form className="space-y-4" onSubmit={pedirFerias}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ferias-inicio">Data de início</Label><Input id="ferias-inicio" type="date" value={dataInicio} onChange={(event) => setDataInicio(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="ferias-fim">Data de término</Label><Input id="ferias-fim" type="date" value={dataFim} onChange={(event) => setDataFim(event.target.value)} required /></div></div><div className="space-y-2"><Label htmlFor="ferias-observacoes">Observações</Label><Textarea id="ferias-observacoes" value={observacoesFerias} onChange={(event) => setObservacoesFerias(event.target.value)} placeholder="Observações opcionais" /></div><Button type="submit" disabled={solicitandoFerias}>{solicitandoFerias ? "Enviando..." : "Solicitar período"}</Button></form></section><section className="overflow-hidden rounded-xl border border-border bg-card/75"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-bold">Minhas solicitações</h2><p className="mt-1 text-[10px] text-muted-foreground">Veja o status e os dias de cada pedido.</p></div>{ferias.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma solicitação de férias.</div> : <div className="divide-y divide-border/70">{ferias.map((feria) => <div key={feria.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">{formatarData(feria.data_inicio)} até {formatarData(feria.data_fim)}</p><p className="mt-1 text-[10px] text-muted-foreground">{feria.quantidade_dias} dias solicitados</p></div><span className="text-[9px] font-bold uppercase text-primary">{textoStatus(feria.status)}</span></div>{feria.motivo_reprovacao && <p className="mt-2 rounded-md bg-destructive/10 p-2 text-[10px] text-destructive">Motivo: {feria.motivo_reprovacao}</p>}</div>)}</div>}</section></div>}
    </div>
  );
}
