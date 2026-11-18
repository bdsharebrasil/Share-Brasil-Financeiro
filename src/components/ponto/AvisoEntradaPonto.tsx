import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, LogIn, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  capturarLocalizacaoPonto,
  consultarAvisoPonto,
  mensagemErroPonto,
  registrarPonto,
  sinalizarPonto,
  type AvisoPonto,
  type ComprovantePonto,
  type GeolocalizacaoPonto,
} from "@/lib/ponto-api";
import { colaboradorRequest } from "@/lib/colaborador-api";
import { useLocalidadePonto } from "@/lib/localidade-ponto";
import "./registro-ponto.css";
export default function AvisoEntradaPonto({
  usuarioId,
}: {
  usuarioId: string;
}) {
  const [aviso, setAviso] = useState<AvisoPonto | null>(null);
  const [aberto, setAberto] = useState(false);
  const [geo, setGeo] = useState<GeolocalizacaoPonto | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [comprovante, setComprovante] = useState<ComprovantePonto | null>(null);
  const localidade = useLocalidadePonto(geo?.latitude, geo?.longitude);
  const [agora, setAgora] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const chave = useRef(crypto.randomUUID());
  useEffect(() => {
    let ativo = true;
    void consultarAvisoPonto(usuarioId)
      .then((r) => {
        if (!ativo) return;
        sinalizarPonto(Boolean(r.ponto_ativo));
        if (!r.exibir) return;
        setAviso(r);
        setAberto(true);
        setOffset(Date.parse(r.horario_servidor!) - Date.now());
        void capturarLocalizacaoPonto().then((g) => {
          if (ativo) setGeo(g);
        });
      })
      .catch(() => {
        /* O aviso nunca bloqueia o login. O erro fica visível na página de ponto. */
      });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);
  useEffect(() => {
    if (!aberto) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aberto]);
  const fechar = () => {
    if (salvando) return;
    setAberto(false);
    if (!comprovante)
      void colaboradorRequest(
        "/api/sharebrasil/ponto/entrada-login/dispensar",
        { method: "POST" },
      ).catch(() => undefined);
  };
  const registrar = async () => {
    if (salvando) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await registrarPonto(
        "entrada",
        geo || { status: "INDISPONIVEL" },
        chave.current,
      );
      setComprovante(r.comprovante);
    } catch (e) {
      setErro(mensagemErroPonto(e));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) fechar();
      }}
    >
      <DialogContent className="ponto-confirmacao max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {comprovante ? (
              <CheckCircle2 size={22} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            ) : <Clock3 size={18} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
            {comprovante
              ? "Entrada registrada com sucesso"
              : "Deseja registrar a entrada?"}
          </DialogTitle>
          <DialogDescription>
            {comprovante
              ? "Seu ponto está iniciado. Pode continuar no sistema."
              : "Primeiro acesso do dia. Confira o horário e a localização antes de registrar."}
          </DialogDescription>
        </DialogHeader>
        <div className="ponto-confirmacao-hora rounded-xl border border-border bg-secondary/25 p-4 text-center">
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {new Date(
              comprovante?.registrado_em || agora + offset,
            ).toLocaleTimeString("pt-BR", {
              timeZone: comprovante?.fuso_horario || aviso?.fuso_horario,
              hour12: false,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {aviso?.data_local?.split("-").reverse().join("/")} ·{" "}
            {aviso?.fuso_horario}
          </p>
        </div>
        {!comprovante && <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs">
          <MapPin size={16} className="shrink-0 text-primary" />
          <div>
            {geo?.status === "INFORMADA" ? (
              <>
                <p className="font-medium">
                  {localidade ?? "Localizando cidade…"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Precisão estimada: {Math.round(geo.precisao_metros || 0)} m
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {!geo
                  ? "Solicitando localização ao navegador…"
                  : geo.status === "NEGADA"
                    ? "Permissão de localização negada. Essa condição acompanhará o registro."
                    : "Localização indisponível. Você pode registrar a entrada."}
              </p>
            )}
          </div>
        </div>}
        {erro && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-300">
            {erro}
          </p>
        )}
        {comprovante ? (
          <>
            <p role="status" className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={15} />
              Horário salvo no seu espelho de ponto.
            </p>
            <div className="flex justify-end gap-2">
              <Button className="ponto-confirmar w-full" onClick={fechar}>Continuar</Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={fechar} disabled={salvando}>
              Agora não
            </Button>
            <Button className="ponto-confirmar" onClick={() => void registrar()} disabled={salvando}>
              {salvando ? <Loader2 size={16} className="ponto-girando" aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
              {salvando ? "Registrando…" : "Registrar entrada"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

