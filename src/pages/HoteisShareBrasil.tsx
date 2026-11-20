import { interpretarCafe } from "@/lib/cafe-manha";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "@/components/agenda/agenda-contatos.css";
import { Check, Copy, Grid2X2, List, Mail, MapPin, Pencil, Phone, Plus, Search, Send, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndicadorPagina } from "@/components/dashboard/ComponentesDashboard";
import { atualizarHotelShare, buscarHoteisShare, buscarPerfilColaborador, criarHotelShare, excluirHotelShare, reservarHotelShare, type HotelShare } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card/80 shadow-sm";
const field = "h-10 w-full rounded-lg border border-border bg-background/60 px-3 text-xs outline-none transition-colors focus:border-primary/60";
const emptyHotel: Partial<HotelShare> = { nome: "", cidade: "", uf: "", endereco: "", telefone: "", telefone_reservas: "", email: "", email_comercial: "", contato_comercial: "", telefone_comercial: "", preco_single: null, preco_duplo: null, estrelas: 0, convenio: false, observacoes: "", cafe_manha: "A_CONFIRMAR" };
function isManager(value?: string | null) { return ["admin", "administrador", "gestor_master", "gestormaster"].includes((value || "").toLowerCase().replace(/[\s-]+/g, "_")); }
function money(value: number | null) { return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function cafeManhaLabel(value: string | null) { return interpretarCafe(value).rotulo; }
function Stars({ count }: { count: number }) { return <div className="flex gap-0.5" aria-label={`${count} estrelas`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} className={index < count ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />)}</div>; }

export default function HoteisShareBrasil() {
  const [hotels, setHotels] = useState<HotelShare[]>([]); const [search, setSearch] = useState(""); const [order, setOrder] = useState("nome"); const [view, setView] = useState<"grid" | "list">("grid"); const [manager, setManager] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reservation, setReservation] = useState<HotelShare | null>(null); const [editor, setEditor] = useState<HotelShare | null | false>(false); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const [list, profile] = await Promise.all([buscarHoteisShare(search, order), buscarPerfilColaborador()]); setHotels(list); setManager(isManager(profile.perfil.tipo_user)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os hotéis."); } finally { setLoading(false); } }, [search, order]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer); }, [load]);
  const saveHotel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue>;
    const valorNumero = (key: string) => {
      const value = raw[key];
      if (value == null || String(value).trim() === "") return null;
      return Number(String(value));
    };

    const tipoCafeManha = String(raw.cafe_manha_tipo ?? "A_CONFIRMAR");
    const precoCafeManha = valorNumero("cafe_manha_valor");
    if (tipoCafeManha === "A_PARTE" && String(raw.cafe_manha_valor || "").trim() && (precoCafeManha == null || !Number.isFinite(precoCafeManha) || precoCafeManha <= 0)) {
      setError("Informe um valor maior que zero para o café da manhã cobrado.");
      return;
    }
    setError("");
    const payload: Partial<HotelShare> = {
      nome: String(raw.nome ?? "").trim(),
      endereco: String(raw.endereco ?? "").trim() || null,
      cidade: String(raw.cidade ?? "").trim() || null,
      uf: String(raw.uf ?? "").trim() || null,
      telefone: String(raw.telefone ?? "").trim() || null,
      telefone_reservas: String(raw.telefone_reservas ?? "").trim() || null,
      email: String(raw.email ?? "").trim() || null,
      email_comercial: String(raw.email_comercial ?? "").trim() || null,
      contato_comercial: String(raw.contato_comercial ?? "").trim() || null,
      telefone_comercial: String(raw.telefone_comercial ?? "").trim() || null,
      observacoes: String(raw.observacoes ?? "").trim() || null,
      estrelas: Number(String(raw.estrelas ?? 0) || 0),
      preco_single: valorNumero("preco_single"),
      preco_duplo: valorNumero("preco_duplo"),
      convenio: form.get("convenio") === "on" || form.get("convenio") === "true",
      cafe_manha: tipoCafeManha === "A_PARTE" && precoCafeManha != null ? precoCafeManha.toFixed(2) : tipoCafeManha,
    };

    setSaving(true);
    try {
      if (editor) await atualizarHotelShare(editor.id, payload); else await criarHotelShare(payload);
      setEditor(false);
      setNotice("Hotel salvo com sucesso.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o hotel.");
    } finally {
      setSaving(false);
    }
  };
  const deleteHotel = async (hotel: HotelShare) => { if (!window.confirm(`Excluir o hotel “${hotel.nome}”?`)) return; try { await excluirHotelShare(hotel.id); setHotels((current) => current.filter((item) => item.id !== hotel.id)); setNotice("Hotel excluído."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o hotel."); } };
  const copy = async (value: string | null) => { if (!value) return; await navigator.clipboard?.writeText(value); setNotice("Contato copiado."); };
  return <div className="route-enter space-y-6"><div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center"><div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center lg:col-start-2 lg:w-auto"><div className="relative w-full sm:w-60"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, cidade ou contato..." aria-label="Buscar hotéis" className="h-10 rounded-lg border-border bg-card pl-9 text-sm" /></div><select value={order} onChange={(event) => setOrder(event.target.value)} className="h-10 w-auto min-w-[155px] rounded-lg border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary/60"><option value="nome">Ordenar por nome</option><option value="cidade">Ordenar por cidade</option><option value="estrelas">Ordenar por estrelas</option></select><Button type="button" onClick={() => { setError(""); setEditor(null); }} className="h-10 gap-2 text-xs"><Plus size={14} /> Novo Hotel</Button></div><div className="flex lg:col-start-3 lg:justify-end"><div role="group" aria-label="Visualização dos hotéis" className="flex h-10 items-center gap-1 rounded-lg border border-border bg-card p-1"><button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="Lista" className={`flex h-8 w-8 items-center justify-center rounded-md ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/[.06]"}`}><List size={14} /></button><button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grade" className={`flex h-8 w-8 items-center justify-center rounded-md ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/[.06]"}`}><Grid2X2 size={14} /></button></div></div></div>
    {(error || notice) && <div className={`rounded-lg border p-3 text-[11px] ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</div>}
    {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-80 rounded-xl" />)}</div> : hotels.length === 0 ? <div className={`${card} p-14 text-center text-xs text-muted-foreground`}>Nenhum hotel encontrado.</div> : view === "grid" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{hotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} manager={manager} onReserve={() => setReservation(hotel)} onEdit={() => { setError(""); setEditor(hotel); }} onDelete={() => void deleteHotel(hotel)} onCopy={copy} />)}</div> : <HotelList hotels={hotels} manager={manager} onReserve={setReservation} onEdit={(hotel) => { setError(""); setEditor(hotel); }} onDelete={(hotel) => void deleteHotel(hotel)} onCopy={copy} />}
    {editor !== false && <Dialog open onOpenChange={(open) => { if (!open && !saving) setEditor(false); }}><HotelEditor key={editor?.id || "novo"} initial={editor || emptyHotel} saving={saving} error={error} onCancel={() => setEditor(false)} onSubmit={saveHotel} /></Dialog>}
    {reservation && <ReservationModal hotel={reservation} onClose={() => setReservation(null)} onSuccess={(message) => { setReservation(null); setNotice(message); }} />}
  </div>;
}

function HotelCard({ hotel, manager, onReserve, onEdit, onDelete, onCopy }: { hotel: HotelShare; manager: boolean; onReserve: () => void; onEdit: () => void; onDelete: () => void; onCopy: (value: string | null) => void }) { return <article className={`${card} flex min-h-[330px] flex-col p-4 transition-transform hover:-translate-y-0.5`}><div className="flex items-start justify-between gap-2"><h2 className="line-clamp-2 text-base font-extrabold uppercase tracking-[-.02em]">{hotel.nome}</h2>{hotel.convenio && <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300">CONVÊNIO</span>}</div><div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground"><MapPin size={14} className="mt-0.5 shrink-0 text-red-400" /><span>{[hotel.endereco, hotel.cidade && `${hotel.cidade}${hotel.uf ? ` - ${hotel.uf}` : ""}`].filter(Boolean).join(", ") || "Endereço não informado"}</span></div><div className="mt-3"><Stars count={hotel.estrelas} /><p className="mt-2 text-[11px] text-muted-foreground">{cafeManhaLabel(hotel.cafe_manha)}</p></div><div className="my-4 border-t border-border" /><div className="space-y-1 text-[11px] text-muted-foreground"><p className="font-bold uppercase tracking-[.08em] text-[9px]">Telefone / reservas</p><p className="flex items-center gap-2">{hotel.telefone_reservas || hotel.telefone || "Não informado"}{(hotel.telefone_reservas || hotel.telefone) && <button type="button" onClick={() => onCopy(hotel.telefone_reservas || hotel.telefone)} title="Copiar"><Copy size={13} /></button>}</p>{hotel.email && <p className="flex items-center gap-2 truncate"><Mail size={13} /> {hotel.email}</p>}</div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center"><div><p className="text-[9px] uppercase text-muted-foreground">Single</p><p className="mt-1 text-sm font-extrabold">{money(hotel.preco_single)}</p></div><div><p className="text-[9px] uppercase text-muted-foreground">Duplo</p><p className="mt-1 text-sm font-extrabold">{money(hotel.preco_duplo)}</p></div></div><div className="mt-auto flex gap-2 pt-4"><Button type="button" onClick={onReserve} disabled={!hotel.email && !hotel.email_comercial} className="h-9 flex-1 gap-2 text-[11px]" title={!hotel.email && !hotel.email_comercial ? "Cadastre um email para habilitar a reserva" : undefined}><Mail size={14} /> {hotel.email || hotel.email_comercial ? "Reservar" : "Sem email"}</Button><Button type="button" variant="outline" onClick={onEdit} className="h-9 w-9 p-0" title="Editar"><Pencil size={13} /></Button>{manager && <Button type="button" variant="outline" onClick={onDelete} className="h-9 w-9 p-0 text-red-300" title="Excluir"><Trash2 size={13} /></Button>}</div></article>; }

function HotelList({ hotels, manager, onReserve, onEdit, onDelete, onCopy }: { hotels: HotelShare[]; manager: boolean; onReserve: (hotel: HotelShare) => void; onEdit: (hotel: HotelShare) => void; onDelete: (hotel: HotelShare) => void; onCopy: (value: string | null) => void }) { return <div className={`${card} overflow-x-auto`}><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-border text-[9px] uppercase tracking-[.12em] text-muted-foreground"><th className="px-4 py-3">Hotel</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Diárias</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{hotels.map((hotel) => <tr key={hotel.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/20"><td className="px-4 py-3"><p className="font-bold uppercase">{hotel.nome}</p><div className="mt-1"><Stars count={hotel.estrelas} /></div><p className="mt-1 text-[10px] text-muted-foreground">{cafeManhaLabel(hotel.cafe_manha)}</p></td><td className="px-4 py-3 text-muted-foreground">{[hotel.cidade, hotel.uf].filter(Boolean).join(" - ") || "—"}<span className="mt-1 block max-w-[220px] truncate text-[10px]">{hotel.endereco || ""}</span></td><td className="px-4 py-3 text-muted-foreground"><p>{hotel.telefone_reservas || hotel.telefone || "—"}</p><p className="max-w-[210px] truncate text-[10px]">{hotel.email || "Sem email"}</p><button type="button" onClick={() => onCopy(hotel.email || hotel.telefone_reservas || hotel.telefone)} className="mt-1 flex items-center gap-1 text-[10px] text-primary"><Copy size={11} /> Copiar contato</button></td><td className="px-4 py-3 whitespace-nowrap">{money(hotel.preco_single)} / {money(hotel.preco_duplo)}</td><td className="px-4 py-3"><div className="flex gap-2"><Button type="button" onClick={() => onReserve(hotel)} disabled={!hotel.email && !hotel.email_comercial} className="h-8 gap-1.5 text-[10px]"><Mail size={12} /> Reservar</Button><Button type="button" variant="outline" onClick={() => onEdit(hotel)} className="h-8 w-8 p-0" title="Editar"><Pencil size={12} /></Button>{manager && <Button type="button" variant="outline" onClick={() => onDelete(hotel)} className="h-8 w-8 p-0 text-red-300" title="Excluir"><Trash2 size={12} /></Button>}</div></td></tr>)}</tbody></table></div>; }

function HotelEditor({ initial, saving, error, onCancel, onSubmit }: { initial: Partial<HotelShare>; saving: boolean; error: string; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const cafeSalvo = String(initial.cafe_manha || "").trim();
  const cafeNormalizado = cafeSalvo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const cafe = interpretarCafe(cafeSalvo);
  const tipoCafeInicial = cafe.tipo;
  const valorCafeInicial = cafe.valor;
  const [tipoCafe, setTipoCafe] = useState(tipoCafeInicial);
  return (
    <DialogContent className="ac-dialog" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader className="ac-dialog-header">
        <DialogTitle>{initial.id ? "Editar hotel" : "Cadastrar novo hotel"}</DialogTitle>
        <DialogDescription>Preencha os dados do hotel e as condições de hospedagem.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="ac-dialog-form" aria-busy={saving}>
        <div className="ac-form-body">
          <p className="ac-muted">Nome do hotel é obrigatório. Campos com * são obrigatórios.</p>
          {error && <div role="alert" className="ac-notice ac-notice--error">{error}</div>}
          <section className="ac-section" aria-labelledby="hotel-identificacao">
            <h3 id="hotel-identificacao" className="ac-section-heading">Dados do hotel</h3>
            <div className="ac-form-grid">
              <label className="ac-field ac-full" htmlFor="hotel-nome"><span>Nome do hotel *</span><input id="hotel-nome" name="nome" defaultValue={initial.nome || ""} required autoFocus disabled={saving} placeholder="Nome do hotel" className="ac-control" /></label>
              <label className="ac-field ac-full" htmlFor="hotel-endereco"><span>Endereço</span><input id="hotel-endereco" name="endereco" defaultValue={initial.endereco || ""} disabled={saving} placeholder="Rua, número e complemento" className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-cidade"><span>Cidade</span><input id="hotel-cidade" name="cidade" defaultValue={initial.cidade || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-uf"><span>UF</span><input id="hotel-uf" name="uf" defaultValue={initial.uf || ""} maxLength={2} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-telefone"><span>Telefone</span><input id="hotel-telefone" name="telefone" type="tel" defaultValue={initial.telefone || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-telefone-reservas"><span>Telefone de reservas</span><input id="hotel-telefone-reservas" name="telefone_reservas" type="tel" defaultValue={initial.telefone_reservas || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-email"><span>E-mail para reserva</span><input id="hotel-email" name="email" type="email" defaultValue={initial.email || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-email-comercial"><span>E-mail comercial</span><input id="hotel-email-comercial" name="email_comercial" type="email" defaultValue={initial.email_comercial || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-contato-comercial"><span>Contato comercial</span><input id="hotel-contato-comercial" name="contato_comercial" defaultValue={initial.contato_comercial || ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-telefone-comercial"><span>Telefone comercial</span><input id="hotel-telefone-comercial" name="telefone_comercial" type="tel" defaultValue={initial.telefone_comercial || ""} disabled={saving} className="ac-control" /></label>
            </div>
          </section>
          <section className="ac-section" aria-labelledby="hotel-hospedagem">
            <h3 id="hotel-hospedagem" className="ac-section-heading">Condições de hospedagem</h3>
            <div className="ac-form-grid">
              <label className="ac-field" htmlFor="hotel-preco-single"><span>Preço single (R$)</span><input id="hotel-preco-single" name="preco_single" type="number" min="0" step="0.01" defaultValue={initial.preco_single ?? ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-preco-duplo"><span>Preço duplo (R$)</span><input id="hotel-preco-duplo" name="preco_duplo" type="number" min="0" step="0.01" defaultValue={initial.preco_duplo ?? ""} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-estrelas"><span>Estrelas</span><input id="hotel-estrelas" name="estrelas" type="number" min="0" max="5" defaultValue={initial.estrelas || 0} disabled={saving} className="ac-control" /></label>
              <label className="ac-field" htmlFor="hotel-convenio"><span>Convênio</span><span className="ac-control flex items-center gap-2"><input id="hotel-convenio" name="convenio" type="checkbox" defaultChecked={Boolean(initial.convenio)} disabled={saving} className="accent-primary" /> Hotel conveniado</span></label>
              <label className="ac-field ac-full" htmlFor="hotel-cafe-manha"><span>Café da manhã</span><select id="hotel-cafe-manha" name="cafe_manha_tipo" value={tipoCafe} onChange={(event) => setTipoCafe(event.target.value)} disabled={saving} className="ac-control"><option value="A_CONFIRMAR">A confirmar</option><option value="INCLUIDO">Incluído na diária</option><option value="A_PARTE">Pago à parte</option><option value="NAO_OFERECE">Não oferece</option></select></label>
              {tipoCafe === "A_PARTE" && <label className="ac-field ac-full" htmlFor="hotel-cafe-valor"><span>Valor do café da manhã (R$)</span><input id="hotel-cafe-valor" name="cafe_manha_valor" type="number" min="0.01" step="0.01" defaultValue={valorCafeInicial} disabled={saving} placeholder="0,00" className="ac-control" /></label>}
            </div>
          </section>
          <section className="ac-section" aria-labelledby="hotel-observacoes">
            <h3 id="hotel-observacoes" className="ac-section-heading">Observações</h3>
            <textarea id="hotel-observacoes" name="observacoes" defaultValue={initial.observacoes || ""} disabled={saving} placeholder="Informações adicionais" className="ac-control" />
          </section>
        </div>
        <div className="ac-footer"><button type="button" className="ac-btn" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="ac-btn ac-btn--primary" disabled={saving}><Check size={16} aria-hidden="true" />{saving ? "Salvando…" : "Salvar hotel"}</button></div>
      </form>
    </DialogContent>
  );
}
function ReservationModal({ hotel, onClose, onSuccess }: { hotel: HotelShare; onClose: () => void; onSuccess: (message: string) => void }) { const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const payload = { data_checkin: String(form.get("data_checkin")), data_checkout: String(form.get("data_checkout")), tipo_quarto: String(form.get("tipo_quarto")), quantidade_hospedes: Number(form.get("quantidade_hospedes")), hospede_nome: String(form.get("hospede_nome")), hospede_telefone: String(form.get("hospede_telefone")), hospede_email: String(form.get("hospede_email") || ""), observacoes: String(form.get("observacoes") || "") }; try { const result = await reservarHotelShare(hotel.id, payload); onSuccess(`Solicitação enviada para ${result.destinatario_email}.`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar a reserva."); } finally { setSaving(false); } }; return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={submit} className={`${card} max-h-[90dvh] w-full max-w-xl overflow-y-auto bg-background p-5`}><div className="flex items-start justify-between"><div><IndicadorPagina>Nova solicitação</IndicadorPagina><h2 className="mt-1 text-xl font-extrabold">Reservar em {hotel.nome}</h2><p className="mt-1 text-[11px] text-muted-foreground">A solicitação será enviada para {hotel.email || hotel.email_comercial}.</p></div><button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X size={17} /></button></div>{error && <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200">{error}</p>}<div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-bold text-muted-foreground">Check-in<input name="data_checkin" type="date" required className={`${field} mt-1`} /></label><label className="text-[10px] font-bold text-muted-foreground">Check-out<input name="data_checkout" type="date" required className={`${field} mt-1`} /></label><select name="tipo_quarto" className={field}><option>Single</option><option>Duplo</option><option>Triplo</option><option>Não informado</option></select><input name="quantidade_hospedes" type="number" min="1" defaultValue="1" required placeholder="Quantidade de hóspedes" className={field} /><input name="hospede_nome" required placeholder="Nome do hóspede" className={`${field} sm:col-span-2`} /><input name="hospede_telefone" required placeholder="Telefone do hóspede" className={field} /><input name="hospede_email" type="email" placeholder="E-mail do hóspede" className={field} /><textarea name="observacoes" placeholder="Observações da reserva" className="min-h-20 rounded-lg border border-border bg-background/60 p-3 text-xs outline-none focus:border-primary/60 sm:col-span-2" /></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="h-9 text-[11px]">Cancelar</Button><Button type="submit" disabled={saving} className="h-9 gap-2 text-[11px]"><Send size={14} /> {saving ? "Enviando..." : "Enviar solicitação"}</Button></div></form></div>, document.body); }
