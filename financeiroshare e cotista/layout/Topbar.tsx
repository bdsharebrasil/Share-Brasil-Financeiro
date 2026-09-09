import React from 'react';
import { Bell, Moon, Search, SlidersHorizontal, Sun } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useTheme } from '../../contexts/ThemeContext';

export function Topbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="relative min-w-[180px] flex-1 md:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true" />
        
        <Input
          type="search"
          placeholder="Buscar lançamento, cotista, categoria…"
          aria-label="Buscar"
          className="pl-9" />
        
      </div>

      <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
        Dados ao vivo
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span className="num hidden text-xs text-muted-foreground lg:inline">
          01 Jun 2026 · 14:32 BRT
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}>
          
          {theme === 'dark' ?
          <Sun className="h-4 w-4" aria-hidden="true" /> :

          <Moon className="h-4 w-4" aria-hidden="true" />
          }
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Preferências">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </header>);

}