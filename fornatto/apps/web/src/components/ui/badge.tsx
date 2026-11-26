import { cn } from '@/lib/utils';

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'demo' | 'gold';
  className?: string;
}) {
  const styles = {
    default: 'bg-fornatto-brown/10 text-fornatto-brown',
    demo: 'bg-amber-100 text-amber-900 border border-amber-300',
    gold: 'bg-fornatto-gold/20 text-fornatto-brown',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}