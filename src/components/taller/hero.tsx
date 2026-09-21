"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { WordsReveal } from "@/components/ui/motion-primitives";
import { SmoothLink } from "@/components/ui/smooth-link";
import { taller } from "@/lib/taller";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Transición instantánea: mismo DOM inicial, sin movimiento. */
const NONE = { duration: 0 } as const;

/** Datos que el flyer pone en grande: fecha, sede y aval. */
const facts = [
  { k: "Fecha", v: taller.dates.label },
  { k: "Sede", v: `${taller.venue.name} · ${taller.venue.city}` },
  { k: "Aval", v: "SCARE – SARG" },
];

export function TallerHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-30%"]);
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-10%"]);

  return (
    <header
      ref={ref}
      id="top"
      className="grain relative flex min-h-screen items-center overflow-hidden bg-navy"
    >
      <div className="pointer-events-none absolute top-1/4 right-[8%] size-[44vw] max-h-[600px] max-w-[600px] rounded-full bg-[radial-gradient(circle,rgba(88,134,232,.3),transparent_65%)] blur-2xl" />

      <div className="relative mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-12 px-5 pt-32 pb-24 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:px-16 lg:pt-36 lg:pb-28">
        <motion.div style={{ y: textY }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? NONE : { duration: 0.8, delay: 0.1 }}
            className="eyebrow mb-6 text-sky"
          >
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={reduce ? NONE : { duration: 0.9, delay: 0.2, ease: EASE }}
              className="block h-px w-9 origin-left bg-azure"
            />
            {taller.kind} · {taller.dates.short}
          </motion.div>

          <WordsReveal
            as="h1"
            lines={["Taller de", taller.title]}
            accent={taller.titleAccent}
            once={false}
            className="text-[clamp(36px,5.4vw,72px)] leading-[1.02] text-white"
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? NONE : { duration: 0.9, delay: 0.55, ease: EASE }}
          >
            <p className="mt-7 font-serif text-[clamp(17px,2vw,21px)] text-ice">
              Instructor: {taller.instructor.name}
            </p>
            <p className="mt-6 max-w-[480px] text-[15px] leading-[1.8] text-ice/55">
              Dos jornadas prácticas sobre anestesia regional ecoguiada, accesos vasculares
              y sedación TCI. Siete módulos, equipos de ultrasonido y phantoms para cada
              estación.
            </p>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? NONE : { duration: 0.9, delay: 0.65, ease: EASE }}
            className="mt-9 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/12 pt-7"
          >
            {facts.map((f) => (
              <div key={f.k}>
                <dt className="text-[10.5px] font-semibold tracking-[0.2em] text-sky uppercase">
                  {f.k}
                </dt>
                <dd className="mt-1.5 text-[14.5px] font-medium text-white">{f.v}</dd>
              </div>
            ))}
          </motion.dl>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? NONE : { duration: 0.9, delay: 0.75, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-3.5"
          >
            <SmoothLink
              href="#reservar"
              className="inline-flex items-center gap-2.5 rounded-full bg-azure px-7 py-4 text-[14.5px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-navy"
            >
              {taller.soldOut ? "Entrar en lista de espera" : "Reservar mi cupo"}
            </SmoothLink>
            <SmoothLink
              href="#contenido"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/35 px-7 py-4 text-[14.5px] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/10"
            >
              Ver contenido
            </SmoothLink>
          </motion.div>
        </motion.div>

        <motion.div
          style={{ y: photoY }}
          className="relative mx-auto w-full max-w-[360px] lg:mx-0 lg:justify-self-end"
        >
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduce ? NONE : { duration: 1, delay: 0.5, ease: EASE }}
            className="pointer-events-none absolute inset-0 translate-x-5 translate-y-5 rounded-t-[180px] rounded-b-3xl border border-azure/60"
          />
          <motion.div
            initial={{ clipPath: "inset(100% 0 0 0)" }}
            animate={{ clipPath: "inset(0% 0 0 0)" }}
            transition={reduce ? NONE : { duration: 1.3, delay: 0.35, ease: EASE }}
            className="relative aspect-[1100/1550] overflow-hidden rounded-t-[180px] rounded-b-3xl bg-ice shadow-[0_40px_90px_-40px_rgba(0,0,0,.7)]"
          >
            <Image
              src={taller.heroPhoto.src}
              alt={taller.heroPhoto.alt}
              width={720}
              height={1280}
              preload
              sizes="(max-width: 1024px) 80vw, 360px"
              className="size-full object-cover object-[center_22%]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/45 via-transparent to-transparent" />
          </motion.div>

          {/* Escasez: es el argumento que el flyer usa para empujar la reserva. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? NONE : { duration: 0.9, delay: 1.05, ease: EASE }}
            className="absolute bottom-6 -left-3 rounded-2xl bg-white px-5 py-3.5 shadow-[0_24px_50px_-20px_rgba(0,0,0,.6)] sm:-left-7"
          >
            <span className="block font-serif text-2xl leading-none text-navy">
              {taller.scarcity.value}
            </span>
            <span className="mt-1 block max-w-[110px] text-[11.5px] leading-tight text-ink-soft">
              {taller.scarcity.label}
            </span>
          </motion.div>
        </motion.div>
      </div>
    </header>
  );
}
