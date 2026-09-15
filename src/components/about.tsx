"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useLang } from "@/components/providers";
import { CheckIcon } from "@/components/ui/icons";
import { Reveal, WordsReveal } from "@/components/ui/motion-primitives";
import { site } from "@/lib/site";

// Mismo rótulo para los tres grupos de credenciales.
const groupTitle = "mb-4 text-[13px] tracking-[0.12em] text-navy uppercase";

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
                src="/assets/dr-brazos-cruzados.webp"
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
            <p className="mt-6 max-w-[540px] text-[15.5px] leading-[1.85] text-ink">
              {t.about.p1}
            </p>
          </Reveal>

          {/* Experiencia + formación: la cifra ancla la fila */}
          <Reveal
            delay={0.1}
            className="mt-10 grid grid-cols-1 gap-8 border-t border-navy/10 pt-8 sm:grid-cols-[auto_1fr] sm:gap-12"
          >
            <div className="flex items-center gap-4 sm:block">
              <span className="font-serif text-[56px] leading-none text-navy">
                +{site.yearsExperience}
              </span>
              <p className="max-w-[120px] text-[12px] leading-snug font-semibold tracking-[0.08em] text-ink-soft uppercase sm:mt-3">
                {t.about.experience}
              </p>
            </div>

            <div className="sm:border-l sm:border-navy/10 sm:pl-12">
              <h3 className={groupTitle}>{t.about.education.t}</h3>
              <ul className="space-y-3.5">
                {t.about.education.items.map((e) => (
                  <li key={e.title}>
                    <p className="text-[15px] font-medium text-navy">{e.title}</p>
                    <p className="text-[13.5px] text-ink-soft">{e.place}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 border-t border-navy/10 pt-8">
            <h3 className={groupTitle}>{t.about.certifications.t}</h3>
            <ul className="flex flex-wrap gap-2">
              {t.about.certifications.items.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-navy/10 bg-cream px-3.5 py-1.5 text-[13px] text-navy"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 border-t border-navy/10 pt-8">
            <h3 className={groupTitle}>{t.about.focus.t}</h3>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {t.about.focus.items.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-azure" />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
