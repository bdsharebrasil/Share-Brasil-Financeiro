import { useState, useEffect } from "react";
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
  onCreate: (data: any) => Promise;
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
  const [aerodromesError, setAerodromesError] = useState(null);

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