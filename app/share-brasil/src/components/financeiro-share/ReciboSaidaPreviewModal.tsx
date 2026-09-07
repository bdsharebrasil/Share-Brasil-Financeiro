import { useState } from "react";
import { Download, X } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { gerarReciboPdf } from "@/lib/reciboPdf";
import logoShare from "@/assets/share-signature-logo.png";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";

function dataExtenso(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ReciboSaidaPreviewModal({ open, data, saving, savedUrl, onClose, onConfirm, onSendEmail }: { open: boolean; data: any; saving: boolean; savedUrl: string | null; onClose: () => void; onConfirm: (blob: Blob) => void; onSendEmail?: () => void }) {
  const [creating, setCreating] = useState(false);
  if (!open || !data) return null;
  const makePdf = async () => gerarReciboPdf({
    numero: String(data.receipt_number || "—"), data: String(data.issue_date || ""),
    pagadorNome: String(data.payer_name || "—"), pagadorDocumento: String(data.payer_document || "Documento não informado"),
    emissorNome: "SHARE BRASIL SERVIÇOS AEROPORTUÁRIOS", emissorDocumento: "CNPJ: 30.898.549/0001-06",
    descricao: String(data.service_description || "—"), valor: Number(data.valor || 0),
  });
  const confirm = async () => { setCreating(true); try { await onConfirm(await makePdf()); } finally { setCreating(false); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-base font-bold">Prévia do recibo de saída</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div><div className="mx-auto max-w-xl border border-slate-300 bg-white p-6 text-slate-800 shadow-sm"><div className="flex items-start justify-between border-b border-slate-300 pb-4"><img src={logoShare} alt="Share Brasil" className="h-12 w-24 object-contain object-left" /><div className="text-center"><p className="text-xl font-bold">RECIBO</p></div><div className="text-right text-xs"><b>Número do recibo:</b><br />{String(data.receipt_number || "—")}<div className="mt-2 border-2 border-slate-700 px-4 py-2 text-base font-bold">{formatBRL(Number(data.valor || 0))}</div></div></div><div className="grid grid-cols-2 gap-8 border-b border-slate-300 py-5 text-xs"><div><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Pagador</p><b>{String(data.payer_name || "—")}</b><br />{String(data.payer_document || "Documento não informado")}</div><div><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Recebedor</p><b>SHARE BRASIL SERVIÇOS AEROPORTUÁRIOS</b><br />CNPJ: 30.898.549/0001-06</div></div><div className="mt-5 overflow-hidden border border-slate-300 text-xs"><div className="grid grid-cols-[1fr_100px] bg-slate-200 p-2 font-bold"><span>Descrição do serviço</span><span>Valor</span></div><div className="grid grid-cols-[1fr_100px] p-3"><span>{String(data.service_description || "—")}</span><b>{formatBRL(Number(data.valor || 0))}</b></div></div>{data.observacoes && <div className="mt-4 border border-slate-200 p-3 text-xs"><p className="mb-1 text-[10px] font-bold uppercase text-slate-500">Observações</p><p className="whitespace-pre-wrap">{String(data.observacoes)}</p></div>}<div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs"><p>Várzea Grande-MT, {dataExtenso(String(data.issue_date || ""))}</p><img src={assinaturaRecibo} alt="Assinatura" className="mx-auto mt-2 h-10 w-36 object-contain" /><div className="mx-auto h-px w-40 bg-slate-700" /><p className="font-semibold">Rolffe de Lima Erbe</p><p className="text-[10px] text-slate-500">Gestor Responsável</p><img src={logoShare} alt="Share Brasil" className="mx-auto mt-2 h-6 w-20 object-contain" /><p className="text-[9px] text-slate-500">FINANCEIRO - SHARE BRASIL SERVIÇOS AEROPORTUARIOS</p></div></div><div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>{savedUrl && <button onClick={onSendEmail} className="rounded-lg border border-border px-4 py-2 text-sm">Enviar por e-mail</button>}{!savedUrl && <button onClick={confirm} disabled={saving || creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{saving || creating ? "Salvando..." : "Gerar e salvar recibo"}</button>}{savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" /> Abrir</a>}</div></div></div>;
}
export default ReciboSaidaPreviewModal;
