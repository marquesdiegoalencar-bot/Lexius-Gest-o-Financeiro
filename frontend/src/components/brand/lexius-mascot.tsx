import { cn } from '@/lib/utils';

type LexiusMascotProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
};

const maxHeights = {
  sm: 140,
  md: 220,
  lg: 320,
  xl: 380,
} as const;

/** Mascote oficial Lexius Financeiro (asset 3D). */
export function LexiusMascot({ className, size = 'md' }: LexiusMascotProps) {
  const maxH = maxHeights[size];

  const hasCustomSize = className?.includes('max-h-none') || className?.includes('h-[');

  return (
    <img
      src="/brand/lexius-mascot.png"
      alt="Mascote Lexius Financeiro"
      width={maxH}
      height={maxH}
      className={cn(
        'block h-auto w-auto max-w-full select-none bg-transparent object-contain object-bottom',
        'drop-shadow-[0_24px_48px_rgba(0,82,255,0.15)]',
        className,
      )}
      style={hasCustomSize ? undefined : { maxHeight: maxH }}
      draggable={false}
      decoding="async"
    />
  );
}