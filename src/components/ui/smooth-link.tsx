"use client";

import { useLenis } from "lenis/react";

/** Ancla interna que delega el desplazamiento a Lenis en vez del scroll nativo. */
export function SmoothLink({
  href,
  children,
  className,
  onClick,
  ...rest
}: React.ComponentProps<"a"> & { href: string }) {
  const lenis = useLenis();

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!href.startsWith("#") || !lenis) return;
        e.preventDefault();
        lenis.scrollTo(href, { offset: -8, duration: 1.4 });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
