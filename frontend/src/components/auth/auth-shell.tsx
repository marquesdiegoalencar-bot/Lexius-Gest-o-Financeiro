import { LexiusLogo } from '@/components/brand/lexius-logo';
import { LexiusMascot } from '@/components/brand/lexius-mascot';

type AuthShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export function AuthShell({
  children,
  title = 'Acesse sua conta',
  subtitle = 'Bem-vindo ao Lexius Financeiro.',
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_30%_20%,#e8f1ff_0%,#f6f9ff_45%,#ffffff_100%)]">
      <header className="flex items-center justify-between px-6 py-5 lg:px-10">
        <LexiusLogo />
        <span className="text-sm font-medium text-slate-500">Ecossistema Lexius</span>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-12 pt-4 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:pt-8">
        <div className="hidden flex-col lg:flex">
          <p className="text-xs font-semibold tracking-[0.2em] text-lexius-600">LEXIUS FINANCEIRO</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-lexius-navy">Bom ter você por aqui.</h1>
          <p className="mt-3 text-lg text-slate-500">Suas finanças, em boas mãos.</p>
          <div className="mt-8 flex justify-center bg-transparent lg:justify-start">
            <LexiusMascot size="xl" className="max-h-[min(52vh,380px)]" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex justify-center bg-transparent lg:hidden">
            <LexiusMascot size="md" className="max-h-44" />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.06)]">
            <div className="mb-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-lexius-100 bg-lexius-50 text-lexius-600">
                <LockIcon />
              </div>
              <h2 className="text-xl font-bold text-lexius-navy">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}