"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/components/providers";

export function Marquee() {
  const { t } = useLang();
  const reduce = useReducedMotion();

  // Dos copias idénticas en fila: al desplazar la primera un -50% exacto el
  // bucle es continuo sin salto.
  const items = [...t.marquee, ...t.marquee];

  return (
    <div className="overflow-hidden border-y border-navy/10 bg-cream py-4">
      <motion.div
        className="flex w-max gap-10"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-[12.5px] font-semibold tracking-[0.22em] whitespace-nowrap text-navy/55 uppercase"
          >
            {item}
            <span className="size-1 rounded-full bg-azure" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
