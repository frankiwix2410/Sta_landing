"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useLang } from "@/components/providers";
import { Reveal, WordsReveal } from "@/components/ui/motion-primitives";

const EASE = [0.16, 1, 0.3, 1] as const;

function Row({
  index,
  title,
  desc,
  active,
  onEnter,
}: {
  index: number;
  title: string;
  desc: string;
  active: boolean;
  onEnter: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // El margen simétrico hace que la fila se marque activa justo al cruzar la
  // franja central del viewport.
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });

  useEffect(() => {
    if (inView) onEnter();
    // `onEnter` es estable por fila; solo reaccionamos al cruce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, ease: EASE }}
      className="group relative border-t border-navy/12 py-8 lg:py-10"
    >
      {/* Barra que se llena en la fila activa */}
      <motion.span
        className="absolute top-0 left-0 h-px origin-left bg-azure"
        animate={{ scaleX: active ? 1 : 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ width: "100%" }}
      />

      <div className="flex items-start gap-5 sm:gap-8">
        <span
          className={`font-serif text-sm transition-colors duration-500 ${
            active ? "text-azure" : "text-navy/30"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex-1">
          <motion.h3
            animate={{ x: active ? 8 : 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className={`text-[clamp(21px,2.6vw,30px)] leading-tight transition-colors duration-500 ${
              active ? "text-navy" : "text-navy/45"
            }`}
          >
            {title}
          </motion.h3>

          <motion.p
            animate={{
              opacity: active ? 1 : 0.45,
              x: active ? 8 : 0,
            }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mt-2.5 max-w-[520px] text-[14.5px] leading-[1.75] text-ink"
          >
            {desc}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

export function Services() {
  const { t } = useLang();
  const [active, setActive] = useState(0);

  return (
    <section id="servicios" className="bg-cream px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        {/* Columna fija */}
        <div className="lg:sticky lg:top-32 lg:h-fit">
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-7 bg-azure" />
            {t.services.eyebrow}
          </Reveal>

          <WordsReveal
            lines={t.services.title}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />

          <Reveal delay={0.15}>
            <p className="mt-6 max-w-[380px] text-[15px] leading-[1.8] text-ink">
              {t.services.lead}
            </p>
          </Reveal>

          {/* Número gigante de la técnica activa */}
          <div className="mt-10 hidden items-end gap-4 lg:flex">
            <div className="relative h-[92px] w-[120px] overflow-hidden">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={active}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="absolute inset-0 font-serif text-[88px] leading-none text-navy"
                >
                  {String(active + 1).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="pb-3 font-serif text-2xl text-navy/25">
              / {String(t.services.items.length).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Listado */}
        <div className="border-b border-navy/12">
          {t.services.items.map((s, i) => (
            <Row
              key={s.t}
              index={i}
              title={s.t}
              desc={s.d}
              active={active === i}
              onEnter={() => setActive(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
