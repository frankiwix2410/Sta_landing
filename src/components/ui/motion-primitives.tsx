"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { animate, motion, useInView, type Variants } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Transición instantánea: mismo DOM, sin movimiento. */
const NONE = { duration: 0 } as const;

/* ---------------------------------------------------------------- Reveal
   Fade + subida al entrar en viewport. `delay` en segundos.

   El estado inicial no depende de `reduce`: si lo hiciera, el HTML del
   servidor y el del cliente diferirían para quien pide menos movimiento. Lo
   que cambia es la transición, que solo se evalúa al animar (ya en cliente). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "span" | "li" | "p";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={reduce ? NONE : { duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------ WordsReveal
   Titular animado palabra por palabra tras una máscara. `lines` es un array
   de líneas; se conserva el salto de línea del diseño.                    */
type WordCustom = { i: number; reduce: boolean };

const wordVariants: Variants = {
  hidden: { y: "110%" },
  show: ({ i, reduce }: WordCustom) => ({
    y: "0%",
    transition: reduce ? NONE : { duration: 1, delay: i * 0.055, ease: EASE },
  }),
};

export function WordsReveal({
  lines,
  className,
  accent,
  accentClassName = "text-sky",
  as: Tag = "h2",
  once = true,
}: {
  lines: readonly string[];
  className?: string;
  accent?: string;
  accentClassName?: string;
  as?: "h1" | "h2";
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -10% 0px" });

  const all = accent ? [...lines, accent] : [...lines];
  let index = 0;

  return (
    <Tag className={className}>
      <span ref={ref} className="block">
        {all.map((line, li) => {
          const isAccent = Boolean(accent) && li === all.length - 1;
          return (
            <span key={li} className="block overflow-hidden pb-[0.08em]">
              {line.split(" ").map((word, wi) => {
                const i = index++;
                return (
                  // El espacio va como nodo de texto entre palabras, no como un
                  // span de ancho fijo: así el titular se lee y se copia con
                  // los espacios de verdad («sin miedo», no «sinmiedo»).
                  <Fragment key={`${li}-${i}`}>
                    {wi > 0 ? " " : null}
                    <motion.span
                      custom={{ i, reduce } satisfies WordCustom}
                      variants={wordVariants}
                      initial="hidden"
                      animate={inView ? "show" : "hidden"}
                      className={`inline-block ${isAccent ? accentClassName : ""}`}
                    >
                      {word}
                    </motion.span>
                  </Fragment>
                );
              })}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}

/* --------------------------------------------------------------- Counter
   Cuenta hasta `to` cuando entra en pantalla.                          */
export function Counter({ to, locale = "es" }: { to: number; locale?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return <span ref={ref}>{value.toLocaleString(locale)}</span>;
}

/* -------------------------------------------------------------- LineDraw
   Regla horizontal que se dibuja al entrar en viewport.                 */
export function LineDraw({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`h-px origin-left ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={reduce ? NONE : { duration: 1.2, ease: EASE }}
    />
  );
}
