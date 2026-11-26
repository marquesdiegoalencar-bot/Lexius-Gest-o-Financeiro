'use client';

import Link from 'next/link';
import { LayoutDashboard, LogOut, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AdminShell({
  children,
  userName,
  companyName,
  onLogout,
}: {
  children: React.ReactNode;
  userName?: string;
  companyName?: string;
  onLogout?: () => void;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-fornatto-brown text-fornatto-white md:flex">
        <div className="border-b border-white/10 p-6">
          <p className="text-xl font-bold tracking-tight text-fornatto-gold">FORNATTO</p>
          <p className="mt-1 text-xs text-fornatto-cream/80">Gestão para padarias</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm"
          >
            <LayoutDashboard className="h-4 w-4 text-fornatto-gold" />
            Painel
          </Link>
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-fornatto-cream/70">
          {companyName && (
            <p className="mb-1 flex items-center gap-1">
              <Store className="h-3 w-3" /> {companyName}
            </p>
          )}
          {userName && <p>{userName}</p>}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-fornatto-brown/10 bg-white px-4 py-3 md:px-6">
          <h1 className="text-lg font-semibold text-fornatto-brown">Painel administrativo</h1>
          <div className="flex items-center gap-2">
            <Badge variant="demo">Dados demonstrativos</Badge>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-fornatto-brown hover:bg-fornatto-cream"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}