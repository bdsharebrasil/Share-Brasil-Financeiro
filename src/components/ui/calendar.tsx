import { useEffect, useRef, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS_PT = [
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

const DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function parseInput(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type CalendarEvent = {
  date: string;
  label: string;
  color?: "blue" | "green" | "red" | "yellow";
};

type CalendarProps = {
  value?: Date | null;
  onChange?: (date: Date) => void;
  placeholder?: string;
  label?: string;
  events?: CalendarEvent[];
};

export function Calendar({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  label,
  events = [],
}: CalendarProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ? formatDate(value) : "");
  const [view, setView] = useState({
    year: value?.getFullYear() ?? today.getFullYear(),
    month: value?.getMonth() ?? today.getMonth(),
  });
  const [selected, setSelected] = useState<Date | null>(value ?? null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value ? formatDate(value) : "");
    setSelected(value ?? null);
    if (value) {
      setView({ year: value.getFullYear(), month: value.getMonth() });
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectDate(date: Date) {
    setSelected(date);
    setInputValue(formatDate(date));
    onChange?.(date);
    setOpen(false);
  }

  function handleInput(valueFromInput: string) {
    let digits = valueFromInput.replace(/\D/g, "");
    if (digits.length > 2) digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 5) digits = `${digits.slice(0, 5)}/${digits.slice(5)}`;
    const formattedValue = digits.slice(0, 10);

    setInputValue(formattedValue);

    const parsedDate = parseInput(formattedValue);
    if (parsedDate) {
      setSelected(parsedDate);
      setView({ year: parsedDate.getFullYear(), month: parsedDate.getMonth() });
      onChange?.(parsedDate);
    }
  }

  function changeMonth(offset: number) {
    setView((current) => {
      const date = new Date(current.year, current.month + offset, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(view.year, view.month, 0).getDate();
  const cells: { day: number; currentMonth: boolean }[] = [];

  for (let index = firstDay - 1; index >= 0; index -= 1) {
    cells.push({ day: daysInPreviousMonth - index, currentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, currentMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ day: cells.length - firstDay - daysInMonth + 1, currentMonth: false });
  }

  const eventDates = new Set(events.map((event) => event.date));

  return (
    <div ref={containerRef} className="relative w-full">
      {label && <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>}

      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2.5 transition-all",
          "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
          open && "border-primary/60 ring-2 ring-primary/20",
        )}
      >
        <button
          type="button"
          aria-label="Abrir calendário"
          onClick={() => setOpen((isOpen) => !isOpen)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
        >
          <CalendarIcon size={15} />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          placeholder={placeholder}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={() => setOpen(true)}
          className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[320px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/10">
          <div className="flex items-center justify-between px-5 py-4">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => changeMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-foreground">
              {MONTHS_PT[view.month]} {view.year}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => changeMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 px-3 pb-1">
            {DAYS_PT.map((day) => (
              <div key={day} className="py-1 text-center text-[9px] font-bold tracking-wider text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-4">
            {cells.map((cell, index) => {
              const isToday =
                cell.currentMonth &&
                view.year === today.getFullYear() &&
                view.month === today.getMonth() &&
                cell.day === today.getDate();
              const isSelected =
                cell.currentMonth &&
                selected?.getFullYear() === view.year &&
                selected?.getMonth() === view.month &&
                selected?.getDate() === cell.day;
              const hasEvent = cell.currentMonth && eventDates.has(dateKey(view.year, view.month, cell.day));

              return (
                <button
                  key={`${view.year}-${view.month}-${index}`}
                  type="button"
                  disabled={!cell.currentMonth}
                  onClick={() => cell.currentMonth && selectDate(new Date(view.year, view.month, cell.day))}
                  className={cn(
                    "relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-all",
                    cell.currentMonth ? "cursor-pointer" : "cursor-default text-muted-foreground opacity-25",
                    cell.currentMonth && !isSelected && !isToday && "text-foreground hover:bg-accent/50",
                    isToday && !isSelected && "bg-primary/15 text-primary",
                    isSelected && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                  )}
                >
                  {cell.day}
                  {hasEvent && (
                    <span
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        isSelected ? "bg-white/70" : "bg-primary",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;