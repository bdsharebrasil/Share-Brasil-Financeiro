import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  LayoutDashboard,
  Plane,
  Settings,
  Users,
  Wallet,
  FileBarChart } from
'lucide-react';
import { Avatar, AvatarFallback } from '../ui/Avatar';

const GRUPOS = [
{
  titulo: 'Main',
  itens: [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/financeiro-share', label: 'Financeiro Share', Icon: Wallet },
  { to: '/financeiro-cotista', label: 'Financeiro Cotista', Icon: Users },
  { to: '/aeronaves', label: 'Aeronaves', Icon: Plane }]

},
{
  titulo: 'Analytics',
  itens: [
  { to: '/relatorios', label: 'Relatórios', Icon: FileBarChart },
  { to: '/alertas', label: 'Alertas', Icon: Bell }]

},
{
  titulo: 'Config',
  itens: [{ to: '/configuracoes', label: 'Configurações', Icon: Settings }]
}];


interface SidebarProps {
  colapsada: boolean;
  onToggle: () => void;
}

export function Sidebar({ colapsada, onToggle }: SidebarProps) {
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex ${
      colapsada ? 'w-[74px]' : 'w-[228px]'} transition-[width] duration-200`
      }>
      
      <div className="flex items-center justify-between gap-2 px-4 py-5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Plane className="h-4 w-4" aria-hidden="true" />
          </span>
          {!colapsada &&
          <span className="leading-tight">
              <span className="block text-sm font-semibold">Share</span>
              <span className="block text-xs text-muted-foreground">Brasil</span>
            </span>
          }
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
          className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          
          <ChevronLeft
            className={`h-4 w-4 transition-transform ${colapsada ? 'rotate-180' : ''}`}
            aria-hidden="true" />
          
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Navegação principal">
        {GRUPOS.map((grupo) =>
        <div key={grupo.titulo}>
            {!colapsada &&
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {grupo.titulo}
              </p>
          }
            <ul className="space-y-1">
              {grupo.itens.map(({ to, label, Icon }) =>
            <li key={to}>
                  <NavLink
                to={to}
                title={label}
                className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ?
                'bg-brand text-brand-foreground font-medium' :
                'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`

                }>
                
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!colapsada && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
            )}
            </ul>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-4">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-brand text-xs text-brand-foreground">RM</AvatarFallback>
        </Avatar>
        {!colapsada &&
        <span className="leading-tight">
            <span className="block text-sm font-medium">Rafael Mendes</span>
            <span className="block text-xs text-muted-foreground">Gestor Financeiro</span>
          </span>
        }
      </div>
    </aside>);

}