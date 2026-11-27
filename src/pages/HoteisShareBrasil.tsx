import { interpretarCafe } from "@/lib/cafe-manha";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, Grid2X2, List, Mail, MapPin, Pencil, Plus, Search, Send, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GoogleHotelMap } from "@/components/mapa/GoogleHotelMap";
import { atualizarHotelShare, buscarHoteisShare, buscarPerfilColaborador, criarHotelShare, excluirHotelShare, reservarHotelShare, type HotelShare } from "@/lib/colaborador-api";

const card = "rounded-xl border border-border bg-card shadow-sm";
const emptyHotel: Partial<HotelShare> = { nome: "", cidade: "", uf: "", endereco: "", telefone: "", telefone_reservas: "", email: "", email_comercial: "", contato_comercial: "", telefone_comercial: "", preco_single: null, preco_duplo: null, estrelas: 0, convenio: false, observacoes: "", cafe_manha: "A_CONFIRMAR" };
function isManager(value?: string | null) { return ["admin", "administrador", "gestor_master", "gestormaster"].includes((value || "").toLowerCase().replace(/[\s-]+/g, "_")); }
function money(value: number | null) { return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function cafeManhaLabel(value: string | null) { return interpretarCafe(value).rotulo; }
function Stars({ count }: { count: number }) { return <div className="flex gap-0.5" aria-label={`${count} estrelas`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} className={index < count ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />)}</div>; }

export default function HoteisShareBrasil() {
  const [hotels, setHotels] = useState<HotelShare[]>([]); const [search, setSearch] = useState(""); const [order, setOrder] = useState("nome"); const [view, setView] = useState<"grid" | "list">("grid"); const [manager, setManager] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reservation, setReservation] = useState<HotelShare | null>(null); const [mapHotel, setMapHotel] = useState<HotelShare | null>(null); const [editor, setEditor] = useState<HotelShare | null | false>(false); const [saving, setSaving] = useState(false);
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
  return <div className="route-enter space-y-6"><div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center"><div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center lg:col-start-2 lg:w-auto"><div className="relative w-full sm:w-64"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, cidade ou contato..." aria-label="Buscar hotéis" className="h-10 pl-9 text-sm" /></div><Select value={order} onValueChange={setOrder}><SelectTrigger aria-label="Ordenar hotéis" className="h-10 w-full sm:w-[190px] text-sm"><SelectValue placeholder="Ordenar por" /></SelectTrigger><SelectContent><SelectItem value="nome">Ordenar por nome</SelectItem><SelectItem value="cidade">Ordenar por cidade</SelectItem><SelectItem value="estrelas">Ordenar por estrelas</SelectItem></SelectContent></Select><Button type="button" onClick={() => { setError(""); setEditor(null); }} className="h-10 gap-2 text-xs whitespace-nowrap"><Plus size={14} /> Novo Hotel</Button></div><div className="flex lg:col-start-3 lg:justify-end"><div role="group" aria-label="Visualização dos hotéis" className="flex h-10 items-center gap-1 rounded-lg border border-border bg-card p-1"><button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="Lista" className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><List size={14} /></button><button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grade" className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Grid2X2 size={14} /></button></div></div></div>
    {(error || notice) && <div className={`rounded-lg border p-3 text-xs font-medium ${error ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{error || notice}</div>}
    {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-80 rounded-xl" />)}</div> : hotels.length === 0 ? <div className={`${card} p-14 text-center text-xs text-muted-foreground`}>Nenhum hotel encontrado.</div> : view === "grid" ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{hotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} manager={manager} onReserve={() => setReservation(hotel)} onViewMap={() => setMapHotel(hotel)} onEdit={() => { setError(""); setEditor(hotel); }} onDelete={() => void deleteHotel(hotel)} onCopy={copy} />)}</div> : <HotelList hotels={hotels} manager={manager} onReserve={setReservation} onViewMap={setMapHotel} onEdit={(hotel) => { setError(""); setEditor(hotel); }} onDelete={(hotel) => void deleteHotel(hotel)} onCopy={copy} />}
    {editor !== false && <Dialog open onOpenChange={(open) => { if (!open && !saving) setEditor(false); }}><HotelEditor key={editor?.id || "novo"} initial={editor || emptyHotel} saving={saving} error={error} onCancel={() => setEditor(false)} onSubmit={saveHotel} /></Dialog>}
    {reservation && <ReservationModal hotel={reservation} onClose={() => setReservation(null)} onSuccess={(message) => { setReservation(null); setNotice(message); }} />}
    {mapHotel && <Dialog open onOpenChange={(open) => { if (!open) setMapHotel(null); }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{mapHotel.nome}</DialogTitle><DialogDescription>{[mapHotel.endereco, mapHotel.cidade && `${mapHotel.cidade}${mapHotel.uf ? ` - ${mapHotel.uf}` : ""}`].filter(Boolean).join(", ") || "Localização no Google Maps"}</DialogDescription></DialogHeader><GoogleHotelMap nome={mapHotel.nome} endereco={mapHotel.endereco} cidade={mapHotel.cidade} uf={mapHotel.uf} /></DialogContent></Dialog>}
  </div>;
}

function HotelCard({ hotel, manager, onReserve, onViewMap, onEdit, onDelete, onCopy }: { hotel: HotelShare; manager: boolean; onReserve: () => void; onViewMap: () => void; onEdit: () => void; onDelete: () => void; onCopy: (value: string | null) => void }) { return <article className={`${card} flex min-h-[330px] flex-col p-4 transition-transform hover:-translate-y-0.5`}><div className="flex items-start justify-between gap-2"><h2 className="line-clamp-2 text-base font-extrabold uppercase tracking-[-.02em]">{hotel.nome}</h2>{hotel.convenio && <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">CONVÊNIO</span>}</div><div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><MapPin size={14} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" /><span>{[hotel.endereco, hotel.cidade && `${hotel.cidade}${hotel.uf ? ` - ${hotel.uf}` : ""}`].filter(Boolean).join(", ") || "Endereço não informado"}</span></div><div className="mt-3"><Stars count={hotel.estrelas} /><p className="mt-2 text-xs text-muted-foreground">{cafeManhaLabel(hotel.cafe_manha)}</p></div><div className="my-4 border-t border-border" /><div className="space-y-1 text-xs text-muted-foreground"><p className="font-bold uppercase tracking-[.06em] text-[11px]">Telefone / reservas</p><p className="flex items-center gap-2 text-foreground">{hotel.telefone_reservas || hotel.telefone || "Não informado"}{(hotel.telefone_reservas || hotel.telefone) && <button type="button" onClick={() => onCopy(hotel.telefone_reservas || hotel.telefone)} title="Copiar" className="text-muted-foreground hover:text-primary"><Copy size={13} /></button>}</p>{hotel.email && <p className="flex items-center gap-2 truncate"><Mail size={13} /> {hotel.email}</p>}</div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center"><div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Single</p><p className="mt-1 text-sm font-extrabold tabular-nums">{money(hotel.preco_single)}</p></div><div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Duplo</p><p className="mt-1 text-sm font-extrabold tabular-nums">{money(hotel.preco_duplo)}</p></div></div><div className="mt-auto flex gap-2 pt-4"><Button type="button" onClick={onReserve} disabled={!hotel.email && !hotel.email_comercial} className="h-9 flex-1 gap-2 text-xs whitespace-nowrap" title={!hotel.email && !hotel.email_comercial ? "Cadastre um email para habilitar a reserva" : undefined}><Mail size={14} /> {hotel.email || hotel.email_comercial ? "Reservar" : "Sem email"}</Button><Button type="button" variant="outline" onClick={onViewMap} className="h-9 w-9 p-0" title="Ver no mapa"><MapPin size={14} /></Button><Button type="button" variant="outline" onClick={onEdit} className="h-9 w-9 p-0" title="Editar"><Pencil size={14} /></Button>{manager && <Button type="button" variant="outline" onClick={onDelete} className="h-9 w-9 p-0 text-destructive hover:text-destructive" title="Excluir"><Trash2 size={14} /></Button>}</div></article>; }

function HotelList({ hotels, manager, onReserve, onViewMap, onEdit, onDelete, onCopy }: { hotels: HotelShare[]; manager: boolean; onReserve: (hotel: HotelShare) => void; onViewMap: (hotel: HotelShare) => void; onEdit: (hotel: HotelShare) => void; onDelete: (hotel: HotelShare) => void; onCopy: (value: string | null) => void }) { return <div className={`${card} overflow-x-auto`}><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"><th className="px-4 py-3">Hotel</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Diárias</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{hotels.map((hotel) => <tr key={hotel.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30"><td className="px-4 py-3"><p className="font-bold uppercase">{hotel.nome}</p><div className="mt-1"><Stars count={hotel.estrelas} /></div><p className="mt-1 text-[11px] text-muted-foreground">{cafeManhaLabel(hotel.cafe_manha)}</p></td><td className="px-4 py-3 text-muted-foreground">{[hotel.cidade, hotel.uf].filter(Boolean).join(" - ") || "—"}<span className="mt-1 block max-w-[220px] truncate text-[11px]">{hotel.endereco || ""}</span></td><td className="px-4 py-3 text-muted-foreground"><p className="text-foreground">{hotel.telefone_reservas || hotel.telefone || "—"}</p><p className="max-w-[210px] truncate text-[11px]">{hotel.email || "Sem email"}</p><button type="button" onClick={() => onCopy(hotel.email || hotel.telefone_reservas || hotel.telefone)} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"><Copy size={11} /> Copiar contato</button></td><td className="px-4 py-3 whitespace-nowrap tabular-nums">{money(hotel.preco_single)} / {money(hotel.preco_duplo)}</td><td className="px-4 py-3"><div className="flex gap-2"><Button type="button" onClick={() => onReserve(hotel)} disabled={!hotel.email && !hotel.email_comercial} className="h-8 gap-1.5 text-[11px] whitespace-nowrap"><Mail size={12} /> Reservar</Button><Button type="button" variant="outline" onClick={() => onViewMap(hotel)} className="h-8 w-8 p-0" title="Ver no mapa"><MapPin size={13} /></Button><Button type="button" variant="outline" onClick={() => onEdit(hotel)} className="h-8 w-8 p-0" title="Editar"><Pencil size={13} /></Button>{manager && <Button type="button" variant="outline" onClick={() => onDelete(hotel)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title="Excluir"><Trash2 size={13} /></Button>}</div></td></tr>)}</tbody></table></div>; }

function HotelEditor({ initial, saving, error, onCancel, onSubmit }: { initial: Partial<HotelShare>; saving: boolean; error: string; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const cafeSalvo = String(initial.cafe_manha || "").trim();
  const cafe = interpretarCafe(cafeSalvo);
  const [tipoCafe, setTipoCafe] = useState(cafe.tipo);
  return (
    <DialogContent className="sm:max-w-2xl" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }} onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle>{initial.id ? "Editar hotel" : "Cadastrar novo hotel"}</DialogTitle>
        <DialogDescription>Preencha os dados do hotel e as condições de hospedagem. Campos com * são obrigatórios.</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-5" aria-busy={saving}>
        {error && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive">{error}</div>}
        <section className="space-y-3" aria-labelledby="hotel-identificacao">
          <h3 id="hotel-identificacao" className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wider text-primary">Dados do hotel</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="hotel-nome" className="text-xs">Nome do hotel *</FieldLabel>
              <Input id="hotel-nome" name="nome" defaultValue={initial.nome || ""} required autoFocus disabled={saving} placeholder="Nome do hotel" />
            </Field>
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="hotel-endereco" className="text-xs">Endereço</FieldLabel>
              <Input id="hotel-endereco" name="endereco" defaultValue={initial.endereco || ""} disabled={saving} placeholder="Rua, número e complemento" />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-cidade" className="text-xs">Cidade</FieldLabel>
              <Input id="hotel-cidade" name="cidade" defaultValue={initial.cidade || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-uf" className="text-xs">UF</FieldLabel>
              <Input id="hotel-uf" name="uf" defaultValue={initial.uf || ""} maxLength={2} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-telefone" className="text-xs">Telefone</FieldLabel>
              <Input id="hotel-telefone" name="telefone" type="tel" defaultValue={initial.telefone || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-telefone-reservas" className="text-xs">Telefone de reservas</FieldLabel>
              <Input id="hotel-telefone-reservas" name="telefone_reservas" type="tel" defaultValue={initial.telefone_reservas || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-email" className="text-xs">E-mail para reserva</FieldLabel>
              <Input id="hotel-email" name="email" type="email" defaultValue={initial.email || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-email-comercial" className="text-xs">E-mail comercial</FieldLabel>
              <Input id="hotel-email-comercial" name="email_comercial" type="email" defaultValue={initial.email_comercial || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-contato-comercial" className="text-xs">Contato comercial</FieldLabel>
              <Input id="hotel-contato-comercial" name="contato_comercial" defaultValue={initial.contato_comercial || ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-telefone-comercial" className="text-xs">Telefone comercial</FieldLabel>
              <Input id="hotel-telefone-comercial" name="telefone_comercial" type="tel" defaultValue={initial.telefone_comercial || ""} disabled={saving} />
            </Field>
          </div>
        </section>
        <section className="space-y-3" aria-labelledby="hotel-hospedagem">
          <h3 id="hotel-hospedagem" className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wider text-primary">Condições de hospedagem</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-preco-single" className="text-xs">Preço single (R$)</FieldLabel>
              <Input id="hotel-preco-single" name="preco_single" type="number" min="0" step="0.01" defaultValue={initial.preco_single ?? ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-preco-duplo" className="text-xs">Preço duplo (R$)</FieldLabel>
              <Input id="hotel-preco-duplo" name="preco_duplo" type="number" min="0" step="0.01" defaultValue={initial.preco_duplo ?? ""} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-estrelas" className="text-xs">Estrelas</FieldLabel>
              <Input id="hotel-estrelas" name="estrelas" type="number" min="0" max="5" defaultValue={initial.estrelas || 0} disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="hotel-convenio" className="text-xs">Convênio</FieldLabel>
              <label htmlFor="hotel-convenio" className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-xs text-foreground">
                <input id="hotel-convenio" name="convenio" type="checkbox" defaultChecked={Boolean(initial.convenio)} disabled={saving} className="h-4 w-4 accent-primary" />
                Hotel conveniado
              </label>
            </Field>
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="hotel-cafe-manha" className="text-xs">Café da manhã</FieldLabel>
              <Select name="cafe_manha_tipo" value={tipoCafe} onValueChange={setTipoCafe} disabled={saving}>
                <SelectTrigger id="hotel-cafe-manha">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A_CONFIRMAR">A confirmar</SelectItem>
                  <SelectItem value="INCLUIDO">Incluído na diária</SelectItem>
                  <SelectItem value="A_PARTE">Pago à parte</SelectItem>
                  <SelectItem value="NAO_OFERECE">Não oferece</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {tipoCafe === "A_PARTE" && (
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="hotel-cafe-valor" className="text-xs">Valor do café da manhã (R$)</FieldLabel>
                <Input id="hotel-cafe-valor" name="cafe_manha_valor" type="number" min="0.01" step="0.01" defaultValue={cafe.valor} disabled={saving} placeholder="0,00" />
              </Field>
            )}
          </div>
        </section>
        <section className="space-y-2" aria-labelledby="hotel-observacoes">
          <Field className="gap-1.5">
            <FieldLabel id="hotel-observacoes" htmlFor="hotel-observacoes-input" className="text-xs">Observações</FieldLabel>
            <Textarea id="hotel-observacoes-input" name="observacoes" defaultValue={initial.observacoes || ""} disabled={saving} placeholder="Informações adicionais" className="min-h-20" />
          </Field>
        </section>
        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving} className="gap-2"><Check size={15} aria-hidden="true" />{saving ? "Salvando…" : "Salvar hotel"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ReservationModal({ hotel, onClose, onSuccess }: { hotel: HotelShare; onClose: () => void; onSuccess: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      data_checkin: String(form.get("data_checkin")),
      data_checkout: String(form.get("data_checkout")),
      tipo_quarto: String(form.get("tipo_quarto")),
      quantidade_hospedes: Number(form.get("quantidade_hospedes")),
      hospede_nome: String(form.get("hospede_nome")),
      hospede_telefone: String(form.get("hospede_telefone")),
      hospede_email: String(form.get("hospede_email") || ""),
      observacoes: String(form.get("observacoes") || ""),
    };
    try {
      const result = await reservarHotelShare(hotel.id, payload);
      onSuccess(`Solicitação enviada para ${result.destinatario_email}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a reserva.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Reservar em {hotel.nome}</DialogTitle>
          <DialogDescription>Nova solicitação · será enviada para {hotel.email || hotel.email_comercial}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" aria-busy={saving}>
          {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-checkin" className="text-xs">Check-in *</FieldLabel>
              <Input id="res-checkin" name="data_checkin" type="date" required disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-checkout" className="text-xs">Check-out *</FieldLabel>
              <Input id="res-checkout" name="data_checkout" type="date" required disabled={saving} />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-quarto" className="text-xs">Tipo de quarto</FieldLabel>
              <Select name="tipo_quarto" defaultValue="Single" disabled={saving}>
                <SelectTrigger id="res-quarto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Duplo">Duplo</SelectItem>
                  <SelectItem value="Triplo">Triplo</SelectItem>
                  <SelectItem value="Não informado">Não informado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-qtd" className="text-xs">Quantidade de hóspedes *</FieldLabel>
              <Input id="res-qtd" name="quantidade_hospedes" type="number" min="1" defaultValue="1" required disabled={saving} placeholder="Quantidade de hóspedes" />
            </Field>
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="res-nome" className="text-xs">Nome do hóspede *</FieldLabel>
              <Input id="res-nome" name="hospede_nome" required disabled={saving} placeholder="Nome do hóspede" />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-tel" className="text-xs">Telefone do hóspede *</FieldLabel>
              <Input id="res-tel" name="hospede_telefone" required disabled={saving} placeholder="Telefone do hóspede" />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="res-email" className="text-xs">E-mail do hóspede</FieldLabel>
              <Input id="res-email" name="hospede_email" type="email" disabled={saving} placeholder="E-mail do hóspede" />
            </Field>
            <Field className="gap-1.5 sm:col-span-2">
              <FieldLabel htmlFor="res-obs" className="text-xs">Observações da reserva</FieldLabel>
              <Textarea id="res-obs" name="observacoes" disabled={saving} placeholder="Observações da reserva" className="min-h-20" />
            </Field>
          </div>
          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-2"><Send size={14} /> {saving ? "Enviando..." : "Enviar solicitação"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

