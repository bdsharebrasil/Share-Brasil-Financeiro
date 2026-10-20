import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxItem {
  id: string;
  label: string;
  grupo?: string;
  badge?: string;
  descricao?: string;
}

interface SearchableComboboxProps {
  items: ComboboxItem[];
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  allowFreeText?: boolean;
  clearable?: boolean;
  selectedLabel?: string;
  selectedValues?: string[];
  wrapSelectedLabel?: boolean;
  wrapItemLabels?: boolean;
  className?: string;
  popoverClassName?: string;
}

export function SearchableCombobox({
  items,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  icon,
  disabled,
  allowFreeText = false,
  clearable = false,
  selectedLabel,
  selectedValues,
  wrapSelectedLabel = false,
  wrapItemLabels = false,
  className,
  popoverClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Encontra o item selecionado
  const selectedItem = items.find((item) => item.id === value)

  // Filtra items baseado no searchValue
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && allowFreeText && searchValue.trim() && !selectedItem) {
        onChange(searchValue.trim(), searchValue.trim())
        setSearchValue("")
      }
      setOpen(nextOpen)
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-11 px-3 bg-[#101722] text-slate-100 hover:bg-[#172231] transition-colors touch-manipulation",
            "border-white/[.12] shadow-sm rounded-lg lg:h-10",
            className,
            // Tipografia mais elegante dependendo do estado
            !value ? "text-muted-foreground font-normal" : "text-foreground font-medium"
          )}
        >
          <div className={cn("flex min-w-0 flex-1 items-center gap-2", wrapSelectedLabel && "items-start") }>
            {icon && <span className="flex-shrink-0 text-muted-foreground/70">{icon}</span>}
            <span className={cn("min-w-0 truncate text-base tracking-tight lg:text-sm", wrapSelectedLabel && "overflow-visible whitespace-normal break-words text-left text-clip") }>
              {selectedItem ? (selectedLabel || selectedItem.label) : (value ? selectedLabel || value : placeholder)}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("z-[10000] max-h-[calc(100dvh-1rem)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-white/[.12] bg-[#101722] p-0 text-slate-100 shadow-lg", popoverClassName)} align="start" side="bottom">
        <Command className="max-h-[calc(100dvh-1rem)] overflow-hidden rounded-xl bg-[#101722] text-slate-100" shouldFilter={false}>
          <div className="border-b border-white/[.1]">
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-base text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0 lg:h-11 lg:text-sm"
            />
          </div>
          <CommandList className="max-h-[min(50dvh,320px)] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 lg:max-h-[min(220px,calc(100dvh-9rem))]">
            {filteredItems.length === 0 && !allowFreeText && (
              <CommandEmpty className="py-6 text-center text-sm text-slate-400">
                {emptyMessage}
              </CommandEmpty>
            )}
            {filteredItems.length === 0 && allowFreeText && searchValue.trim() && (
              <CommandEmpty className="py-2" />
            )}
            <CommandGroup>
              {clearable && value && (
                <CommandItem
                  value="__clear_selection__"
                  onSelect={() => {
                    onChange("", "")
                    setSearchValue("")
                    setOpen(false)
                  }}
                  className="flex min-h-[2.75rem] items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[.06] hover:text-white"
                >
                  Limpar seleção
                </CommandItem>
              )}
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.id, item.label)
                    setSearchValue("")
                    setOpen(false)
                  }}
                  className="flex min-h-[2.75rem] items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors touch-manipulation"
                >
                  <Check
                    className={cn(
                      "mr-1 h-4 w-4 shrink-0 transition-all",
                      (selectedValues ? selectedValues.includes(item.id) : value === item.id) ? "opacity-100 text-primary scale-100" : "opacity-0 scale-75"
                    )}
                  />
                  <span className={cn(
                    "min-w-0",
                    !wrapItemLabels && "truncate",
                    wrapItemLabels && "whitespace-normal break-words text-left",
                    (selectedValues ? selectedValues.includes(item.id) : value === item.id) ? "font-semibold" : "font-medium text-slate-200"
                  )}>
                    {item.label}
                  </span>
                </CommandItem>
              ))}
              {allowFreeText && filteredItems.length === 0 && searchValue.trim() && (
                <CommandItem
                  value={searchValue}
                  onSelect={() => {
                    onChange(searchValue, searchValue)
                    setSearchValue("")
                    setOpen(false)
                  }}
                  className="flex min-h-[2.75rem] items-center gap-2 px-3 py-2.5 text-sm rounded-lg cursor-pointer bg-primary/5 text-primary hover:bg-primary/10 transition-colors touch-manipulation"
                >
                  <Check className="mr-1 h-4 w-4 shrink-0 opacity-0 scale-75" />
                  <span className="truncate font-medium">
                    <strong>{searchValue}</strong>
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
