import { useCallback, useEffect, useRef, useState } from "react";
import { Clipboard, Copy, MessageCircle, Mic, MicOff, MonitorUp, PenTool, PhoneOff, Plus, Send, UserRound, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buscarIceServersCentro, buscarPerfilColaborador, buscarSalasTreinamento, criarSalaTreinamento, encerrarSalaTreinamento, type SalaTreinamento } from "@/lib/colaborador-api";
import { API_BASE } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { IndicadorPagina } from "@/components/dashboard/PrimitivosDashboard";

const card = "rounded-xl border border-border bg-card/80 shadow-sm";
type Participant = { id: string; userId?: string; name: string };
type Signal = { type: string; from?: string; fromName?: string; to?: string; participant?: Participant; participants?: Participant[]; whiteboard?: unknown[]; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; action?: { kind: "path"; points: Array<{ x: number; y: number }>; color: string; width: number }; text?: string };
function managerRole(value?: string | null) { return ["admin", "administrador", "gestor_master", "gestormaster"].includes((value || "").toLowerCase().replace(/[\s-]+/g, "_")); }

export default function SalaReuniao() {
  const [rooms, setRooms] = useState<SalaTreinamento[]>([]);
  const [manager, setManager] = useState(false);
  const [room, setRoom] = useState<SalaTreinamento | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [messages, setMessages] = useState<Array<{ name: string; text: string }>>([]);
  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([{ urls: "stun:stun.cloudflare.com:3478" }]);
  const [error, setError] = useState("");
  const localVideo = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const myId = useRef(crypto.randomUUID());
  const myName = useRef("Participante");
  const participantMap = useRef<Record<string, Participant>>({});

  const loadRooms = useCallback(async () => { try { const [list, profile] = await Promise.all([buscarSalasTreinamento(), buscarPerfilColaborador()]); setRooms(list); setManager(managerRole(profile.perfil.tipo_user)); myName.current = profile.perfil.nome_exibicao || profile.perfil.nome_completo || profile.perfil.email; } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar as salas."); } }, []);
  useEffect(() => { void loadRooms(); }, [loadRooms]);

  const send = useCallback((payload: Record<string, unknown>) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(payload)); }, []);
  const drawAction = useCallback((action: NonNullable<Signal["action"]>) => { const context = canvas.current?.getContext("2d"); if (!context || action.points.length < 2) return; const width = canvas.current?.width || 640; const height = canvas.current?.height || 360; context.strokeStyle = action.color; context.lineWidth = action.width; context.lineCap = "round"; context.beginPath(); action.points.forEach((point, index) => { const x = point.x * width; const y = point.y * height; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); }, []);
  const closePeer = (id: string) => { peers.current[id]?.close(); delete peers.current[id]; setRemoteStreams((current) => { const next = { ...current }; delete next[id]; return next; }); };
  const ensurePeer = useCallback((remote: Participant) => {
    if (peers.current[remote.id]) return peers.current[remote.id];
    const peer = new RTCPeerConnection({ iceServers });
    peers.current[remote.id] = peer;
    localStream.current?.getTracks().forEach((track) => peer.addTrack(track, localStream.current!));
    peer.onicecandidate = (event) => { if (event.candidate) send({ type: "ice", to: remote.id, candidate: event.candidate.toJSON() }); };
    peer.ontrack = (event) => { const stream = event.streams[0]; if (stream) setRemoteStreams((current) => ({ ...current, [remote.id]: stream })); };
    peer.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(peer.connectionState)) closePeer(remote.id); };
    return peer;
  }, [send, iceServers]);
  const offerPeer = useCallback(async (remote: Participant) => { const peer = ensurePeer(remote); const offer = await peer.createOffer(); await peer.setLocalDescription(offer); send({ type: "offer", to: remote.id, description: offer }); }, [ensurePeer, send]);

  const join = async (selected: SalaTreinamento) => {
    setError(""); setRoom(selected); setMessages([]); setParticipants([]); participantMap.current = {};
    try {
      const [{ data: { session } }, ice] = await Promise.all([supabase.auth.getSession(), buscarIceServersCentro()]);
      if (!session?.access_token) throw new Error("sessao_nao_encontrada");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
      localStream.current = stream; if (localVideo.current && stream) { localVideo.current.srcObject = stream; await localVideo.current.play().catch(() => undefined); }
      const participantId = myId.current;
      const url = new URL(`${API_BASE.replace(/^http/, "ws")}/api/sharebrasil/centro-treinamento/reunioes/${selected.id}/ws`); url.searchParams.set("access_token", session.access_token); url.searchParams.set("participant_id", participantId);
      const socket = new WebSocket(url); ws.current = socket;
      setIceServers(ice.ice_servers.length ? ice.ice_servers : [{ urls: "stun:stun.cloudflare.com:3478" }]);
      socket.onopen = () => { setConnected(true); };
      socket.onclose = () => setConnected(false);
      socket.onerror = () => setError("A conexão da sala foi interrompida.");
      socket.onmessage = async (event) => { const data = JSON.parse(event.data) as Signal;
        if (data.type === "room_state" || data.type === "participant_joined") { const list = data.participants || (data.participant ? [data.participant] : []); list.filter((participant) => participant.id !== myId.current).forEach((participant) => { participantMap.current[participant.id] = participant; if (!participants.some((current) => current.id === participant.id)) setParticipants((current) => current.some((item) => item.id === participant.id) ? current : [...current, participant]); if (myId.current < participant.id && data.type !== "room_state") void offerPeer(participant); }); if (data.type === "room_state") { (data.whiteboard || []).forEach((action) => drawAction(action as NonNullable<Signal["action"]>)); for (const participant of list) if (participant.id !== myId.current && myId.current < participant.id) void offerPeer(participant); } return; }
        if (data.type === "participant_left" && data.participantId) { setParticipants((current) => current.filter((participant) => participant.id !== data.participantId)); closePeer(data.participantId); return; }
        if (data.type === "chat" && data.text) { setMessages((current) => [...current, { name: data.fromName || "Participante", text: data.text! }]); return; }
        if (data.type === "whiteboard" && data.action) { drawAction(data.action); return; }
        if (!data.from) return; const remote = participantMap.current[data.from] || { id: data.from, name: data.fromName || "Participante" }; const peer = ensurePeer(remote);
        if (data.type === "offer" && data.description) { await peer.setRemoteDescription(data.description); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); send({ type: "answer", to: data.from, description: answer }); }
        if (data.type === "answer" && data.description) await peer.setRemoteDescription(data.description);
        if (data.type === "ice" && data.candidate) await peer.addIceCandidate(data.candidate).catch(() => undefined);
      };
    } catch (cause) { setRoom(null); setError(cause instanceof Error ? cause.message : "Não foi possível entrar na sala."); }
  };
  const leave = () => { ws.current?.close(); ws.current = null; Object.keys(peers.current).forEach(closePeer); localStream.current?.getTracks().forEach((track) => track.stop()); screenStream.current?.getTracks().forEach((track) => track.stop()); localStream.current = null; setRoom(null); setConnected(false); setParticipants([]); setRemoteStreams({}); void loadRooms(); };
  useEffect(() => () => leave(), []);
  const createRoom = async (event: React.FormEvent) => { event.preventDefault(); setCreating(true); try { const created = await criarSalaTreinamento({ titulo: title, descricao: description }); setTitle(""); setDescription(""); await loadRooms(); await join(created); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar a sala."); } finally { setCreating(false); } };
  const shareScreen = async () => { if (!room) return; if (sharing) { screenStream.current?.getTracks().forEach((track) => track.stop()); setSharing(false); return; } const stream = await navigator.mediaDevices.getDisplayMedia({ video: true }).catch(() => null); if (!stream) return; screenStream.current = stream; const track = stream.getVideoTracks()[0]; Object.values(peers.current).forEach((peer) => peer.getSenders().find((sender) => sender.track?.kind === "video")?.replaceTrack(track)); track.onended = () => { setSharing(false); }; setSharing(true); };
  const toggleTrack = (kind: "audio" | "video") => { const track = localStream.current?.getTracks().find((candidate) => candidate.kind === kind); if (!track) return; track.enabled = !track.enabled; if (kind === "audio") setMicrophone(track.enabled); else setCamera(track.enabled); };
  const sendChat = (event: React.FormEvent) => { event.preventDefault(); if (!message.trim()) return; send({ type: "chat", text: message.trim() }); setMessages((current) => [...current, { name: myName.current, text: message.trim() }]); setMessage(""); };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => { const target = event.currentTarget; const rect = target.getBoundingClientRect(); const points = [{ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }]; const move = (moveEvent: PointerEvent) => points.push({ x: (moveEvent.clientX - rect.left) / rect.width, y: (moveEvent.clientY - rect.top) / rect.height }); const end = () => { target.releasePointerCapture(event.pointerId); target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", end); if (points.length > 1) { const action = { kind: "path" as const, points, color: "#38bdf8", width: 3 }; drawAction(action); send({ type: "whiteboard", action }); } }; target.setPointerCapture(event.pointerId); target.addEventListener("pointermove", move); target.addEventListener("pointerup", end); };

  if (room) return <div className="route-enter space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><IndicadorPagina>Centro de Treinamento / Sala de reunião</IndicadorPagina><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em]">{room.titulo}</h1><p className="mt-1 text-xs text-muted-foreground">{connected ? "Conectado" : "Conectando..."} · cada participante aparece com seu nome</p></div><Button type="button" variant="outline" onClick={leave} className="h-9 gap-2 text-[11px] text-red-300"><PhoneOff size={14} /> Sair da reunião</Button></div>
    {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200">{error}</div>}
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]"><section className={`${card} min-w-0 p-3`}><div className="grid gap-3 md:grid-cols-2">{localStream.current && <div className="relative overflow-hidden rounded-lg bg-black"><video ref={localVideo} muted playsInline className="aspect-video w-full object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">{myName.current} (você)</span></div>}{Object.entries(remoteStreams).map(([id, stream]) => <RemoteVideo key={id} id={id} stream={stream} name={participantMap.current[id]?.name || "Participante"} />)}</div><div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" variant={microphone ? "outline" : "destructive"} onClick={() => toggleTrack("audio")} className="h-9 gap-2 text-[11px]">{microphone ? <Mic size={14} /> : <MicOff size={14} />}{microphone ? "Microfone" : "Mudo"}</Button><Button type="button" variant={camera ? "outline" : "destructive"} onClick={() => toggleTrack("video")} className="h-9 gap-2 text-[11px]">{camera ? <Video size={14} /> : <VideoOff size={14} />}{camera ? "Câmera" : "Câmera desligada"}</Button><Button type="button" variant={sharing ? "default" : "outline"} onClick={() => void shareScreen()} className="h-9 gap-2 text-[11px]"><MonitorUp size={14} /> {sharing ? "Parar tela" : "Compartilhar tela"}</Button></div></section><aside className="space-y-4"><section className={`${card} p-4`}><h2 className="flex items-center gap-2 text-xs font-bold"><UserRound size={14} className="text-primary" /> Participantes ({participants.length + 1})</h2><div className="mt-3 space-y-2"><p className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] font-bold">{myName.current} (você)</p>{participants.map((participant) => <p key={participant.id} className="rounded-lg bg-secondary/40 px-3 py-2 text-[11px]">{participant.name}</p>)}</div></section><section className={`${card} flex h-[310px] flex-col p-4`}><h2 className="flex items-center gap-2 text-xs font-bold"><MessageCircle size={14} className="text-primary" /> Chat da reunião</h2><div className="mt-3 flex-1 space-y-2 overflow-y-auto">{messages.map((item, index) => <p key={`${item.name}-${index}`} className="text-[11px]"><strong>{item.name}:</strong> {item.text}</p>)}</div><form onSubmit={sendChat} className="mt-3 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Mensagem..." className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-2 text-[11px] outline-none focus:border-primary/60" /><Button type="submit" size="icon" className="h-9 w-9"><Send size={14} /></Button></form></section></aside></div><section className={`${card} p-3`}><div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xs font-bold"><PenTool size={14} className="text-primary" /> Lousa colaborativa</h2><span className="text-[10px] text-muted-foreground">Todos os participantes podem desenhar</span></div><canvas ref={canvas} width={1000} height={500} onPointerDown={draw} className="h-[320px] w-full touch-none rounded-lg border border-border bg-slate-950" /></section></div>;

  return <div className="route-enter space-y-6"><div><IndicadorPagina>Share Brasil / Centro de Treinamento</IndicadorPagina><h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-[-.04em] md:text-[30px]"><Video className="text-primary" size={25} /> Sala de reunião</h1><p className="mt-1.5 text-xs text-muted-foreground">Salas virtuais com vídeo, compartilhamento de tela, chat e lousa colaborativa.</p></div>{error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200">{error}</div>}{manager && <form onSubmit={createRoom} className={`${card} flex flex-wrap items-end gap-3 p-4`}><div className="min-w-[220px] flex-1"><label className="mb-1 block text-[10px] font-bold text-muted-foreground">Nome da sala</label><input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Ex.: Reunião semanal" className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-xs outline-none focus:border-primary/60" /></div><div className="min-w-[260px] flex-[2]"><label className="mb-1 block text-[10px] font-bold text-muted-foreground">Descrição</label><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Pauta ou objetivo da reunião" className="h-10 w-full rounded-lg border border-border bg-background/50 px-3 text-xs outline-none focus:border-primary/60" /></div><Button type="submit" disabled={creating} className="h-10 gap-2 text-[11px]"><Plus size={14} /> {creating ? "Criando..." : "Criar sala"}</Button></form>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rooms.length ? rooms.map((item) => <article key={item.id} className={`${card} flex min-h-44 flex-col p-4`}><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Video size={17} /></div><span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300">AO VIVO</span></div><h2 className="mt-4 text-sm font-bold">{item.titulo}</h2><p className="mt-1 text-[11px] text-muted-foreground">{item.descricao || "Sala colaborativa Share Brasil."}</p><p className="mt-2 text-[10px] text-muted-foreground">Criada por {item.criado_por_nome || "equipe Share Brasil"}</p><div className="mt-auto flex items-center justify-between pt-4"><Button type="button" onClick={() => void join(item)} className="h-8 gap-2 text-[10px]"><Video size={13} /> Entrar na sala</Button>{manager && <Button type="button" variant="ghost" onClick={() => void encerrarSalaTreinamento(item.id).then(loadRooms)} className="h-8 px-2 text-[10px] text-red-300"><PhoneOff size={12} /></Button>}</div></article>) : <div className={`${card} col-span-full p-12 text-center text-xs text-muted-foreground`}>Nenhuma sala ativa no momento.</div>}</div></div>;
}

function RemoteVideo({ stream, name }: { id: string; stream: MediaStream; name: string }) { const ref = useRef<HTMLVideoElement>(null); useEffect(() => { if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => undefined); } }, [stream]); return <div className="relative overflow-hidden rounded-lg bg-black"><video ref={ref} playsInline className="aspect-video w-full object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">{name}</span></div>; }
