/**
 * Fila de estrellas. `value` admite decimales (4.7) y rellena la última
 * parcialmente con un degradado, en vez de redondear y mentir sobre la nota.
 */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const rounded = Math.round(value * 10) / 10;

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${rounded} de 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(Math.max(value - i, 0), 1);
        return (
          <svg key={i} viewBox="0 0 20 20" aria-hidden className="size-[1em]">
            <defs>
              <linearGradient id={`s${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#s${i}-${Math.round(fill * 100)})`}
              d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.22l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
            />
          </svg>
        );
      })}
    </span>
  );
}
