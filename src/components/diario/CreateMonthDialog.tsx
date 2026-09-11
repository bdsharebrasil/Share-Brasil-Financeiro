import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Calendar,
  Gauge,
  Fuel,
  MapPin,
  DollarSign,
  Plane,
  Settings2,
  Info,
} from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchableCombobox";
import { buscarOpcoesDiario } from "@/lib/colaborador-api";

interface CreateMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  aircraftRegistration: string;
  month: number;
  year: number;
  currentModoCelula?: "tvoo" | "tempo_total" | null;
  previousMonthData: {
    celula_atual_ttotal?: number | null;
    celula_prox_revisao_ttotal?: number | null;
    horimetro_final?: number | null;
    aerodromo_base?: string | null;
    consumo_combustivel?: string | null;
    tem_tarifa_diaria?: boolean | null;
    tarifa_diaria?: number | null;
  } | null;
  onCreate: (data: any) => Promise<void>;
}

interface AerodromeRow {
  id: string;
  designativo: string;
  nome: string;
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function CreateMonthDialog({
  open,
  onOpenChange,
  aircraftId,
  aircraftRegistration,
  month: initialMonth,
  year: initialYear,
  currentModoCelula,
  previousMonthData,
  onCreate,
}: CreateMonthDialogProps) {
  const [loading, setLoading] = useState(false);
  const [aerodromes, setAerodromes] = useState<{ id: string; designativo: string; name: string }[]>([]);
  const [aerodromesError, setAerodromesError] = useState<string | null>(null);

  // Modo de cálculo de célula
  const [modoCelula, setModoCelula] = useState<"tvoo" | "tempo_total">("tempo_total");
  const [modoConfirmed, setModoConfirmed] = useState(false);

  // Seleção de mês/ano
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  // Form state
  const [formData, setFormData] = useState({
    celula_anterior: 0,
    celula_prox_revisao: 0,
    horimetro_inicio: 0,
    aerodromo_base: "",
    consumo_combustivel: "",
    tem_tarifa_diaria: false,
    tarifa_diaria: 0,
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 4 + i);

  useEffect(() => {
    if (open) {
      fetchAerodromes();
      setSelectedMonth(initialMonth);
      setSelectedYear(initialYear);

      if (currentModoCelula) {
        setModoCelula(currentModoCelula);
        setModoConfirmed(false);
      } else {
        setModoCelula("tempo_total");
        setModoConfirmed(false);
      }

      if (previousMonthData?.celula_atual_ttotal) {
        setFormData({
          celula_anterior: previousMonthData.celula_atual_ttotal || 0,
          celula_prox_revisao: previousMonthData.celula_prox_revisao_ttotal || 0,
          horimetro_inicio: previousMonthData.horimetro_final || 0,
          aerodromo_base: previousMonthData.aerodromo_base || "",
          consumo_combustivel: previousMonthData.consumo_combustivel || "",
          tem_tarifa_diaria: previousMonthData.tem_tarifa_diaria || false,
          tarifa_diaria: previousMonthData.tarifa_diaria || 0,
        });
      } else {
        setFormData({
          celula_anterior: 0,
          celula_prox_revisao: 0,
          horimetro_inicio: 0,
          aerodromo_base: "",
          consumo_combustivel: "",
          tem_tarifa_diaria: false,
          tarifa_diaria: 0,
        });
      }
    }
  }, [open, previousMonthData, initialMonth, initialYear, currentModoCelula]);

  const fetchAerodromes = async () => {
    setAerodromesError(null);
    try {
      const data = await buscarOpcoesDiario();
      const aerodromesData = data as { aerodromos?: AerodromeRow[] };

      if (data && Array.isArray(aerodromesData.aerodromos)) {
        setAerodromes(
          aerodromesData.aerodromos.map((a) => ({
            id: a.id,
            designativo: a.designativo,
            name: a.nome,
          }))
        );
      } else {
        setAerodromes([]);
      }
    } catch (error) {
      console.error("Falha ao carregar aeródromos do D1:", error);
      setAerodromesError("Não foi possível carregar a lista de aeródromos.");
      setAerodromes([]);
    }
  };

  const handleSubmit = async () => {
    if (formData.celula_anterior <= 0) return;

    setLoading(true);
    try {
      await onCreate({
        aeronave_id: aircraftId,
        mes: selectedMonth,
        ano: selectedYear,
        modo_celula: modoCelula,
        celula_anterior_ttotal: formData.celula_anterior,
        celula_atual_ttotal: formData.celula_anterior,
        celula_prox_revisao_ttotal: formData.celula_prox_revisao || null,
        celula_disponivel_ttotal: formData.celula_prox_revisao
          ? formData.celula_prox_revisao - formData.celula_anterior
          : null,
        horimetro_inicio: formData.horimetro_inicio || null,
        horimetro_final: formData.horimetro_inicio || null,
        aerodromo_base: formData.aerodromo_base || null,
        consumo_combustivel: formData.consumo_combustivel || null,
        tem_tarifa_diaria: formData.tem_tarifa_diaria,
        tarifa_diaria: formData.tem_tarifa_diaria ? formData.tarifa_diaria : null,
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const horasDisponiveis = formData.celula_prox_revisao - formData.celula_anterior;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Calendar size={16} /></span>
            Abrir diário mensal
          </DialogTitle>
          <DialogDescription className="text-xs">Configure os parâmetros da aeronave {aircraftRegistration} para o período selecionado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="diario-month">Mês</Label><Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}><SelectTrigger id="diario-month"><SelectValue placeholder="Selecione o mês" /></SelectTrigger><SelectContent>{MONTHS.map((name, index) => <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="diario-year">Ano</Label><Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}><SelectTrigger id="diario-year"><SelectValue placeholder="Selecione o ano" /></SelectTrigger><SelectContent>{years.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/[.04] p-4">
            <div className="mb-3 flex items-start gap-3"><Settings2 size={16} className="mt-0.5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Modo de cálculo da célula</p><p className="mt-1 text-[11px] text-muted-foreground">Escolha qual referência será usada para controlar a disponibilidade.</p></div></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([["tempo_total", "Tempo total", "Usa o horímetro total da aeronave."], ["tvoo", "Tempo de voo", "Usa somente as horas em voo."]] as const).map(([value, label, description]) => <button key={value} type="button" onClick={() => { setModoCelula(value); setModoConfirmed(true); }} className={`rounded-lg border p-3 text-left transition-colors ${modoCelula === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/50 hover:border-primary/40"}`}><span className="flex items-center gap-2 text-xs font-semibold"><Gauge size={14} /> {label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{description}</span></button>)}
            </div>
            {modoConfirmed && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-primary"><Info size={12} /> Modo selecionado: {modoCelula === "tvoo" ? "tempo de voo" : "tempo total"}.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="celula-anterior">Célula anterior (h)</Label><Input id="celula-anterior" type="number" min="0" step="0.1" value={formData.celula_anterior || ""} onChange={(event) => setFormData((current) => ({ ...current, celula_anterior: Number(event.target.value) || 0 }))} placeholder="0,0" /></div>
            <div className="space-y-2"><Label htmlFor="celula-revisao">Próxima revisão (h)</Label><Input id="celula-revisao" type="number" min="0" step="0.1" value={formData.celula_prox_revisao || ""} onChange={(event) => setFormData((current) => ({ ...current, celula_prox_revisao: Number(event.target.value) || 0 }))} placeholder="0,0" /><p className="text-[10px] text-muted-foreground">Disponível: {Math.max(0, horasDisponiveis).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</p></div>
            <div className="space-y-2"><Label htmlFor="horimetro-inicio">Horímetro inicial</Label><Input id="horimetro-inicio" type="number" min="0" step="0.1" value={formData.horimetro_inicio || ""} onChange={(event) => setFormData((current) => ({ ...current, horimetro_inicio: Number(event.target.value) || 0 }))} placeholder="0,0" /></div>
            <div className="space-y-2"><Label htmlFor="aerodromo-base">Aeródromo base</Label><SearchableCombobox items={aerodromes.map((aerodrome) => ({ id: aerodrome.id, label: `${aerodrome.designativo} · ${aerodrome.name}` }))} value={formData.aerodromo_base} onChange={(value, label) => setFormData((current) => ({ ...current, aerodromo_base: value || label.split(" · ")[0] }))} placeholder="Selecione o aeródromo" searchPlaceholder="Buscar aeródromo..." emptyMessage="Nenhum aeródromo encontrado." icon={<MapPin size={14} />} />{aerodromesError && <p className="text-[10px] text-destructive">{aerodromesError}</p>}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="consumo-combustivel">Consumo de combustível</Label><div className="relative"><Fuel size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input id="consumo-combustivel" className="pl-9" value={formData.consumo_combustivel} onChange={(event) => setFormData((current) => ({ ...current, consumo_combustivel: event.target.value }))} placeholder="Ex.: 180 L/H" /></div></div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5"><div><p className="flex items-center gap-1.5 text-xs font-medium"><DollarSign size={14} className="text-primary" /> Tarifa diária</p><p className="mt-1 text-[10px] text-muted-foreground">Aplicar tarifa aos lançamentos.</p></div><Switch checked={formData.tem_tarifa_diaria} onCheckedChange={(checked) => setFormData((current) => ({ ...current, tem_tarifa_diaria: checked }))} aria-label="Ativar tarifa diária" /></div>
            {formData.tem_tarifa_diaria && <div className="space-y-2 sm:col-start-2"><Label htmlFor="tarifa-diaria">Valor da diária</Label><Input id="tarifa-diaria" type="number" min="0" step="0.01" value={formData.tarifa_diaria || ""} onChange={(event) => setFormData((current) => ({ ...current, tarifa_diaria: Number(event.target.value) || 0 }))} placeholder="0,00" /></div>}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-secondary/20 p-3 text-[10px] text-muted-foreground"><Plane size={14} className="mt-0.5 shrink-0 text-primary" /><span>O diário será aberto para a aeronave selecionada e poderá receber os lançamentos de voo deste período.</span></div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button><Button type="button" onClick={() => void handleSubmit()} disabled={loading || formData.celula_anterior <= 0} className="gap-2">{loading ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}{loading ? "Salvando..." : "Abrir diário"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
