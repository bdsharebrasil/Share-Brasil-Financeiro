import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Wallet } from 'lucide-react';

const ITENS = [
{ to: '/financeiro-share', label: 'Share', Icon: Wallet },
{ to: '/financeiro-cotista', label: 'Cotista', Icon: Users },
{ to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }];


export function MobileNav() {
  return (
    <nav
      className="flex gap-1 border-b border-border bg-background px-4 py-2 lg:hidden"
      aria-label="Navegação">
      
      {ITENS.map(({ to, label, Icon }) =>
      <NavLink
        key={to}
        to={to}
        className={({ isActive }) =>
        `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        isActive ?
        'bg-brand text-brand-foreground' :
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`

        }>
        
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </NavLink>
      )}
    </nav>);

}