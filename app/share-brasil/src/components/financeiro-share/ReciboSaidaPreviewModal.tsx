import { useState } from "react";
import { Download, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { formatBRL } from "@/lib/format";
import assinaturaRecibo from "@/assets/assinatura-para-recibo.png";
import logoShare from "@/assets/share-signature-logo.png";

async function carregarImagem(src: string) {
  const resposta = await fetch(src);
  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => { URL.revokeObjectURL(url); resolve(imagem); };
    imagem.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível carregar a assinatura.")); };
    imagem.src = url;
  });
}

function dataExtenso(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ReciboSaidaPreviewModal({ open, data, saving, savedUrl, onClose, onConfirm, onSendEmail }: { open: boolean; data: any; saving: boolean; savedUrl: string | null; onClose: () => void; onConfirm: (blob: Blob) => void; onSendEmail?: () => void }) {
  const [creating, setCreating] = useState(false);
  if (!open || !data) return null;
  const makePdf = async () => { const pdf = new jsPDF(); pdf.setFontSize(18); pdf.text("RECIBO", 20, 25); pdf.setFontSize(11); pdf.text(`Número: ${String(data.receipt_number || "")}`, 20, 40); pdf.text(`Recebedor: ${String(data.payer_name || "")}`, 20, 52); pdf.text(`Documento: ${String(data.payer_document || "")}`, 20, 64); pdf.text(`Descrição: ${String(data.service_description || "")}`, 20, 76); pdf.text(`Categoria: ${String(data.nome_categoria || "")}`, 20, 88); pdf.text(`Valor: ${formatBRL(Number(data.valor || 0))}`, 20, 100); pdf.text(`Emissão: ${String(data.issue_date || "")}`, 20, 112); const imagemAssinatura = await carregarImagem(assinaturaRecibo); const imagemLogo = await carregarImagem(logoShare); pdf.setFontSize(9); pdf.text(`Várzea Grande-MT, ${dataExtenso(String(data.issue_date || ""))}`, 105, 125, { align: "center" }); pdf.addImage(imagemAssinatura, "PNG", 78, 129, 54, 20); pdf.line(70, 150, 140, 150); pdf.setFontSize(11); pdf.text("Rolffe de Lima Erbe", 105, 155, { align: "center" }); pdf.text("Gestor Responsável", 105, 160, { align: "center" }); pdf.addImage(imagemLogo, "PNG", 88, 164, 34, 10); pdf.setFontSize(8); pdf.text("FINANCEIRO - SHARE BRASIL SERVIÇOS AEROPORTUARIOS", 105, 178, { align: "center" }); return pdf.output("blob"); };
  const confirm = async () => { setCreating(true); try { await onConfirm(await makePdf()); } finally { setCreating(false); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-base font-bold">Prévia do recibo de saída</h3><button onClick={onClose}><X className="h-4 w-4" /></button></div><div className="rounded-xl border border-border bg-background p-5 text-sm"><div className="mb-4 flex justify-between"><strong>RECIBO</strong><strong>{String(data.receipt_number || "")}</strong></div><p><b>Recebedor:</b> {String(data.payer_name || "—")}</p><p><b>Descrição:</b> {String(data.service_description || "—")}</p><p><b>Categoria:</b> {String(data.nome_categoria || "—")}</p><p className="mt-4 text-lg font-bold">{formatBRL(Number(data.valor || 0))}</p><div className="mt-5 border-t border-border pt-4 text-center"><p className="text-xs">Várzea Grande-MT, {dataExtenso(String(data.issue_date || ""))}</p><img src={assinaturaRecibo} alt="Assinatura" className="mx-auto h-12 w-auto" /><p className="text-xs font-semibold">Rolffe de Lima Erbe</p><p className="text-[10px] text-muted-foreground">Gestor Responsável</p><img src={logoShare} alt="Share Brasil" className="mx-auto mt-1 h-7 w-auto" /><p className="text-[9px] text-muted-foreground">FINANCEIRO - SHARE BRASIL SERVIÇOS AEROPORTUARIOS</p></div></div><div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>{savedUrl && <button onClick={onSendEmail} className="rounded-lg border border-border px-4 py-2 text-sm">Enviar por e-mail</button>} {!savedUrl && <button onClick={confirm} disabled={saving || creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{saving || creating ? "Salvando..." : "Gerar e salvar recibo"}</button>}{savedUrl && <a href={savedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" /> Abrir</a>}</div></div></div>;
}
export default ReciboSaidaPreviewModal;
