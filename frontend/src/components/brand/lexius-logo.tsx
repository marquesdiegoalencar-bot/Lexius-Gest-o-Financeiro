import { cn } from '@/lib/utils';

type LexiusLogoProps = {
  className?: string;
  variant?: 'default' | 'invert';
  showFinBadge?: boolean;
};

export function LexiusLogo({ className, variant = 'default', showFinBadge = true }: LexiusLogoProps) {
  const text = variant === 'invert' ? 'text-white' : 'text-lexius-navy';
  return (
    <div className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', text, className)}>
      <span className="text-lg">Lexius</span>
      {showFinBadge ? (
        <span className="rounded-md bg-lexius-600 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm">FIN</span>
      ) : null}
    </div>
  );
}