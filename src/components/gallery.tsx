"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/components/providers";
import { Reveal, WordsReveal } from "@/components/ui/motion-primitives";

/** Cada celda flota a distinta velocidad; `speed` 0 la deja quieta. */
function Tile({
  children,
  className = "",
  speed = 0,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // El rango se aplana en lugar de quitar `style`: cambiar la forma del estilo
  // según `reduce` haría que el HTML del cliente no cuadrara con el del servidor.
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [speed, -speed]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-2xl bg-ice ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* Las celdas van en el orden de `t.gallery.photos`. Todas las fotos son
   verticales, así que solo se usan celdas 1×2 (misma proporción que el origen)
   y 2×2 (recorte a banda horizontal, donde `pos` elige qué banda se ve).
   `sizes`: a 4 columnas dentro de 1180px, una columna son ~283px y dos ~582px. */
const PHOTOS = [
  {
    src: "/assets/dr-guantes.webp",
    span: "row-span-2",
    pos: "object-center",
    speed: 26,
    sizes: "(max-width:1024px) 50vw, 283px",
  },
  {
    src: "/assets/taller-eco.webp",
    span: "col-span-2 row-span-2",
    pos: "object-[center_58%]",
    speed: 12,
    sizes: "(max-width:1024px) 100vw, 582px",
  },
  {
    src: "/assets/dr-jeringa.webp",
    span: "row-span-2",
    pos: "object-center",
    speed: 30,
    sizes: "(max-width:1024px) 50vw, 283px",
  },
  {
    src: "/assets/dr-circuito.webp",
    span: "col-span-2 row-span-2",
    pos: "object-[center_62%]",
    speed: 18,
    sizes: "(max-width:1024px) 100vw, 582px",
  },
  {
    src: "/assets/taller-detalle.webp",
    span: "row-span-2",
    pos: "object-center",
    speed: 8,
    sizes: "(max-width:1024px) 50vw, 283px",
  },
  {
    src: "/assets/taller-practica.webp",
    span: "row-span-2",
    pos: "object-[center_40%]",
    speed: 22,
    sizes: "(max-width:1024px) 50vw, 283px",
  },
] as const;

export function Gallery() {
  const { t } = useLang();

  return (
    <section id="galeria" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto mb-14 max-w-[620px] text-center">
          <Reveal className="eyebrow mb-4 justify-center text-azure">
            <span className="block h-px w-6 bg-azure" />
            {t.gallery.eyebrow}
            <span className="block h-px w-6 bg-azure" />
          </Reveal>
          <WordsReveal
            lines={t.gallery.title}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />
        </div>

        {/* `dense` rellena los huecos que dejan las celdas grandes al pasar de
            4 columnas a 2, sin necesidad de retocar los spans por breakpoint. */}
        <div className="grid auto-rows-[150px] grid-flow-row-dense grid-cols-2 gap-4 sm:auto-rows-[180px] lg:grid-cols-4">
          {PHOTOS.map((photo, i) => (
            <Tile key={photo.src} speed={photo.speed} className={photo.span}>
              <Image
                src={photo.src}
                alt={t.gallery.photos[i]}
                fill
                sizes={photo.sizes}
                className={`object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-105 ${photo.pos}`}
              />
            </Tile>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-7 text-center text-xs text-ink-soft">{t.gallery.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
