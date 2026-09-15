"use client";

import Image from "next/image";
import { useLang } from "@/components/providers";
import { Counter, LineDraw, Reveal, WordsReveal } from "@/components/ui/motion-primitives";

export function Stats() {
  const { lang, t } = useLang();

  return (
    <section
      id="diferenciales"
      className="grain relative overflow-hidden bg-navy px-5 py-24 text-white sm:px-8 lg:px-16 lg:py-32"
    >
      {/* Fondo de quirófano muy atenuado: da profundidad al bloque navy sin
          tocar el contraste del texto, que sigue sobre navy casi opaco. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/assets/dr-guantes-maquina.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[78%_38%] opacity-[0.28]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-navy/45" />
      </div>

      <div className="pointer-events-none absolute -top-[30%] -left-[10%] font-serif leading-[0.7] text-white/[0.03] select-none">
        <span className="text-[min(60vw,700px)]">S</span>
      </div>

      <div className="relative mx-auto max-w-[1120px]">
        <div className="mx-auto mb-16 max-w-[620px] text-center">
          <Reveal className="eyebrow mb-4 justify-center text-sky">
            <span className="block h-px w-6 bg-sky" />
            {t.stats.eyebrow}
            <span className="block h-px w-6 bg-sky" />
          </Reveal>

          <WordsReveal
            lines={t.stats.title}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {t.stats.items.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1} className="text-center">
              <div className="font-serif text-[clamp(44px,6vw,72px)] leading-none text-white">
                <Counter to={s.n} locale={lang} />
                <span className="text-sky">{s.suffix}</span>
              </div>
              <LineDraw className="mx-auto mt-5 w-10 bg-white/25" />
              <p className="mt-4 text-[13.5px] text-ice/70">{s.label}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <p className="mt-14 text-center text-xs text-ice/40">{t.stats.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
