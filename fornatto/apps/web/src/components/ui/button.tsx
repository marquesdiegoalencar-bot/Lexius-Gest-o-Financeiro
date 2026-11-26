import { cn } from '@/lib/utils';

export function Button({
  className,
  children,
  type = 'button',
  disabled,
  variant = 'primary',
}: {
  className?: string;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const styles = {
    primary: 'bg-fornatto-gold text-fornatto-brown hover:bg-fornatto-gold/90',
    ghost: 'bg-transparent border border-fornatto-brown/20 hover:bg-fornatto-cream',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition disabled:opacity-50',
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}