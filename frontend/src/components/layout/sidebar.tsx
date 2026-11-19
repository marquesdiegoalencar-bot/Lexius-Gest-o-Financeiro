import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  FolderTree,
  Landmark,
  LayoutDashboard,
  LineChart,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
  { to: '/contas-a-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
  { to: '/bancos', label: 'Bancos', icon: Landmark },
  { to: '/pessoas', label: 'Pessoas', icon: Users },
  { to: '/empresas', label: 'Empresas', icon: Building2 },
  { to: '/categorias', label: 'Categorias', icon: Tag },
  { to: '/centros-custo', label: 'Centros de Custo', icon: FolderTree },
  { to: '/departamentos', label: 'Departamentos', icon: Building2 },
  { to: '/relatorios', label: 'Relatórios', icon: LineChart },
];

export function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-[var(--color-sidebar)] text-slate-100">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="text-left leading-tight">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200/90">Lexius</p>
          <p className="text-sm font-semibold text-white">Financeiro</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-sidebar-active)] text-white shadow-sm'
                  : 'text-blue-100/90 hover:bg-[var(--color-sidebar-hover)] hover:text-white',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-90" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <p className="border-t border-white/10 px-4 py-3 text-xs text-blue-200/60">ERP financeiro · API v1</p>
    </aside>
  );
}