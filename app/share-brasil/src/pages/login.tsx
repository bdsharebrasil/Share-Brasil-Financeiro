import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Plane, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const flightRoutes = [
  { y: "-18vh", duration: "19s", delay: "-4s", size: 22, opacity: 0.34 },
  { y: "8vh", duration: "27s", delay: "-14s", size: 16, opacity: 0.2 },
  { y: "25vh", duration: "23s", delay: "-8s", size: 18, opacity: 0.25 },
  { y: "-34vh", duration: "31s", delay: "-22s", size: 14, opacity: 0.16 },
  { y: "35vh", duration: "25s", delay: "-17s", size: 20, opacity: 0.22 },
];

function isValidUsername(value: string) {
  return value.length > 0 && !value.includes(" ") && !value.includes("@");
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!installEvent) return null;

  const install = async () => {
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#38d7ff]/30 bg-[#38d7ff]/10 px-4 py-2 text-xs font-semibold text-[#8be8ff] transition-colors hover:bg-[#38d7ff]/20"
    >
      Instalar Share Brasil
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);

  useEffect(() => {
    const savedUser = window.localStorage.getItem("login_username");
    if (savedUser) {
      setUsername(savedUser);
      setRememberUser(true);
    }

    if (!isSupabaseConfigured) {
      setIsCheckingSession(false);
      return;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
      else setIsCheckingSession(false);
    });
  }, [navigate]);

  const handleUsernameChange = (value: string) => {
    setUsername(value.replace(/[@\s]/g, "").toLowerCase());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha seu usuário e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUsername(trimmedUsername)) {
      toast({
        title: "Usuário inválido",
        description: "Informe apenas o usuário, sem espaços ou @.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase não configurado");
      }
      const formattedLogin = /@share-brasil\.com$/i.test(trimmedUsername)
        ? trimmedUsername
        : `${trimmedUsername}@share-brasil.com`;

      if (rememberUser) window.localStorage.setItem("login_username", trimmedUsername);
      else window.localStorage.removeItem("login_username");

      const { error } = await supabase.auth.signInWithPassword({
        email: formattedLogin,
        password,
      });
      if (error) throw error;
      toast({
        title: "Acesso autorizado",
        description: "Bem-vindo(a) ao portal Share Brasil.",
      });
      navigate("/", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      toast({
        title: "Acesso negado",
        description: message.includes("supabase não configurado")
          ? "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env."
          : message.includes("invalid") || message.includes("credentials")
          ? "Usuário ou senha incorretos. Tente novamente."
          : "Não foi possível realizar o login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = isValidUsername(username);

  if (isCheckingSession) {
    return <div className="min-h-screen bg-[#030814]" aria-label="Verificando sessão" />;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030814] px-5 py-10 text-white sm:px-8">
      <InstallPrompt />
      <style>{`
        @keyframes login-flight {
          0% { opacity: 0; transform: translate3d(-25vw, var(--flight-y), 0) rotate(90deg) scale(.8); }
          15% { opacity: var(--flight-opacity); }
          85% { opacity: var(--flight-opacity); }
          100% { opacity: 0; transform: translate3d(125vw, var(--flight-y), 0) rotate(90deg) scale(1); }
        }
        .login-flight { animation: login-flight var(--flight-duration) linear var(--flight-delay) infinite; }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,67,122,.5),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(17,94,133,.3),transparent_42%)]" />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-no-repeat bg-center opacity-20 mix-blend-screen"
        style={{
          backgroundImage: "url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')",
          backgroundSize: "90% auto",
          filter: "invert(70%) sepia(100%) saturate(300%) hue-rotate(150deg) brightness(120%) drop-shadow(0 0 10px rgba(57,208,255,0.2))",
          maskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#02050d]/95 via-[#061225]/80 to-[#081b31]/95" />

      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {flightRoutes.map((route, index) => (
          <div
            key={index}
            className="login-flight absolute left-0 top-1/2 text-[#39d0ff]"
            style={{
              "--flight-duration": route.duration,
              "--flight-delay": route.delay,
              "--flight-y": route.y,
              "--flight-opacity": route.opacity,
            } as CSSProperties}
          >
            <Plane style={{ width: route.size, height: route.size }} className="drop-shadow-[0_0_12px_rgba(57,208,255,.5)]" />
          </div>
        ))}
      </div>

      <section className="relative z-20 w-full max-w-[416px] rounded-[28px] border border-white/10 bg-[#061223]/75 px-6 py-8 shadow-[0_40px_80px_-20px_rgba(0,10,20,.85)] backdrop-blur-xl sm:rounded-[32px] sm:px-8 sm:py-10">
        <div className="text-center">
          <img src="/logoshare.branco.png" alt="Logo Share Brasil" className="mx-auto h-20 w-auto object-contain" />
          <p className="mt-1.5 text-sm text-[#94a3b8]">Acesso ao Portal do Colaborador</p>
        </div>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="username" className="ml-1 text-sm font-medium text-[#cbd5e1]">LOGIN</Label>
            <div className="group relative">
              <User className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors ${isUsernameFocused ? "text-[#38d7ff]" : "text-white/30"}`} />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(event) => handleUsernameChange(event.target.value)}
                onFocus={() => setIsUsernameFocused(true)}
                onBlur={() => setIsUsernameFocused(false)}
                placeholder="seu.nome"
                autoComplete="username"
                disabled={isSubmitting}
                className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 pr-12 text-base text-white placeholder:text-white/20 focus-visible:border-[#38d7ff]/50 focus-visible:bg-white/10 focus-visible:ring-[#38d7ff]/50 sm:pr-40"
              />
              <span className={`pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-2 text-sm font-medium sm:flex ${isUsernameFocused || isValid ? "text-white/60" : "text-white/30"}`}>
                @share-brasil.com
                {isValid && !isUsernameFocused && <CheckCircle2 className="h-4 w-4 text-[#38d7ff]" />}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="ml-1 text-sm font-medium text-[#cbd5e1]">Senha</Label>
            <div className="group relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-[#38d7ff]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 pr-12 text-base tracking-widest text-white placeholder:text-white/20 placeholder:tracking-normal focus-visible:border-[#38d7ff]/50 focus-visible:bg-white/10 focus-visible:ring-[#38d7ff]/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/80 focus-visible:text-[#38d7ff]"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-1 pt-1">
            <Checkbox
              id="remember-user"
              checked={rememberUser}
              onCheckedChange={(checked) => setRememberUser(checked === true)}
              disabled={isSubmitting}
              className="h-5 w-5 rounded-md border-white/20 bg-white/5 data-[state=checked]:border-[#38d7ff] data-[state=checked]:bg-[#38d7ff] data-[state=checked]:text-[#02111f]"
            />
            <Label htmlFor="remember-user" className="cursor-pointer text-sm font-medium text-[#94a3b8] transition-colors hover:text-white">Lembrar meu acesso</Label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !isValid || !password}
            className="h-14 w-full rounded-2xl bg-[#38d7ff] text-base font-semibold text-[#02111f] shadow-[0_8px_16px_-10px_rgba(56,215,255,.4)] transition-all hover:bg-[#6be4ff] hover:shadow-[0_12px_24px_-10px_rgba(56,215,255,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38d7ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061223] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none"
          >
            {isSubmitting ? "Autenticando..." : "Acessar Plataforma"}
          </Button>
        </form>
      </section>
    </main>
  );
}
