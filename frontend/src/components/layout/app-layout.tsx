import { Outlet, useMatches } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';

type RouteHandle = {
  title?: string;
  subtitle?: string;
};

export function AppLayout() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle)?.title)?.handle as
    | RouteHandle
    | undefined;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={handle?.title ?? 'Lexius Financeiro'} subtitle={handle?.subtitle} />
        <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}