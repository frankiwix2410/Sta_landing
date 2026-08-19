"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/components/providers";
import { Reveal, WordsReveal } from "@/components/ui/motion-primitives";
import { site } from "@/lib/site";

export function About() {
  const { t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // La foto se mueve dentro de su marco: recorre un 12% mientras la sección
  // cruza el viewport.
  const imgY = useTransform(scrollYProgress, [0, 1], ["-6%", reduce ? "-6%" : "6%"]);

  return (
    <section id="sobre" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div
        ref={ref}
        className="mx-auto grid max-w-[1140px] grid-cols-1 items-center gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"
      >
        <Reveal className="relative">
          <div className="absolute -inset-4 top-auto -bottom-6 left-6 h-full rounded-3xl bg-cream" />
          <div className="relative aspect-[560/700] overflow-hidden rounded-2xl shadow-[0_30px_70px_-35px_rgba(11,25,86,.55)]">
            <motion.div style={{ y: imgY }} className="relative h-[112%] w-full">
              <Image
                src="/assets/dr-quirofano.webp"
                alt={site.doctor}
                fill
                sizes="(max-width: 1024px) 90vw, 420px"
                // El encuadre original es 9:16 y aquí se recorta a 4:5, así que
                // se ancla algo por encima del centro para no cortar la cara.
                className="object-cover object-[center_22%]"
              />
            </motion.div>
          </div>
        </Reveal>

        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-7 bg-azure" />
            {t.about.eyebrow}
          </Reveal>

          <WordsReveal
            lines={t.about.title}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />

          <Reveal delay={0.15}>
            <p className="mt-6 max-w-[520px] text-[15.5px] leading-[1.85] text-ink">
              {t.about.p1}
            </p>
            <p className="mt-3 max-w-[520px] text-sm leading-[1.8] text-ink-soft italic">
              {t.about.p2}
            </p>
          </Reveal>

          <div className="mt-9 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {t.about.cards.map((c, i) => (
              <Reveal key={c.t} delay={0.1 + i * 0.08}>
                <div className="group border-l-2 border-ice py-1 pl-4 transition-colors duration-300 hover:border-azure">
                  <h4 className="mb-1 text-[15px] text-navy">{c.t}</h4>
                  <p className="text-[13px] leading-relaxed text-ink-soft">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
