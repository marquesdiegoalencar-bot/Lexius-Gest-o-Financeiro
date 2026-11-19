import { ChevronDown, LogOut } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

type HeaderProps = {
  title: string;
  subtitle?: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  const { usuario, empresaAtiva, logout, setEmpresaId } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {usuario && usuario.empresas.length > 1 ? (
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={empresaAtiva?.empresa_id ?? ''}
              onChange={(e) => setEmpresaId(e.target.value)}
            >
              {usuario.empresas.map((e) => (
                <option key={e.empresa_id} value={e.empresa_id}>
                  {e.razao_social ?? e.empresa_id.slice(0, 8)}
                </option>
              ))}
            </select>
          ) : (
            <span className="hidden text-sm text-slate-600 sm:inline">
              {empresaAtiva?.razao_social ?? 'Empresa'}
            </span>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span className="max-w-[140px] truncate">{usuario?.nome}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[200px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                sideOffset={8}
                align="end"
              >
                <div className="px-2 py-1.5 text-xs text-slate-500">{usuario?.email}</div>
                {empresaAtiva ? (
                  <div className="px-2 pb-2 text-xs font-medium text-slate-700">
                    Papel: {empresaAtiva.papel}
                  </div>
                ) : null}
                <Separator className="my-1" />
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
                  onSelect={() => logout()}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}