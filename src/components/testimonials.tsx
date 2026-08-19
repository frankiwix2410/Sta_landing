"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLang } from "@/components/providers";
import { Reveal } from "@/components/ui/motion-primitives";
import { Stars } from "@/components/ui/stars";
import type { Reviews } from "@/lib/reviews";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Una reseña larga en cuerpo de display se come la sección: el tamaño baja
 *  conforme crece el texto, en vez de recortarlo. */
function quoteSize(length: number) {
  if (length < 130) return "text-[clamp(21px,3vw,33px)]";
  if (length < 300) return "text-[clamp(18px,2.2vw,25px)]";
  return "text-[clamp(16px,1.7vw,20px)]";
}

export function Testimonials() {
  const { lang, t } = useLang();
  const section = useRef<HTMLElement>(null);
  const [reviews, setReviews] = useState<Reviews | null>(null);

  /* --------------------------------------------------------------- carga
     Google cobra por lectura y prohíbe cachearlas, así que la petición se
     dispara cuando la sección entra en pantalla y no en cada carga de la
     página: quien nunca baja hasta aquí no genera coste. */
  useEffect(() => {
    const el = section.current;
    if (!el) return;

    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        fetch(`/api/resenas?lang=${lang}`)
          .then((r) => r.json())
          .then((data) => {
            if (!cancelled && data?.status === "ok" && data.reviews?.items?.length) {
              setReviews(data.reviews);
            }
          })
          .catch(() => {
            /* Sin reseñas de Google se queda el texto curado. */
          });
      },
      { rootMargin: "200px" },
    );

    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [lang]);

  /* ------------------------------------------------------------ carrusel */
  const items = reviews?.items ?? null;
  const total = items ? items.length : t.testimonials.items.length;
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);

  const move = useCallback(
    (d: number) => setState(([i]) => [(i + d + total) % total, d]),
    [total],
  );

  // Cuando llegan las de Google cambia el número de slides. No hace falta
  // reiniciar el índice: se acota al leer, y así no se da un salto brusco a
  // quien esté mirando una cita justo en ese momento.
  useEffect(() => {
    const id = setInterval(() => move(1), 8000);
    return () => clearInterval(id);
  }, [move, index]);

  const live = items?.[Math.min(index, total - 1)] ?? null;
  const curated = t.testimonials.items[Math.min(index, t.testimonials.items.length - 1)];
  const text = live ? live.text : curated.q;

  return (
    <section
      ref={section}
      className="overflow-hidden bg-cream px-5 py-24 sm:px-8 lg:px-16 lg:py-28"
    >
      <div className="mx-auto max-w-[860px] text-center">
        <Reveal className="eyebrow mb-6 justify-center text-azure">
          <span className="block h-px w-6 bg-azure" />
          {reviews ? t.testimonials.source : t.testimonials.eyebrow}
          <span className="block h-px w-6 bg-azure" />
        </Reveal>

        {/* Nota media del perfil: da contexto a las 5 reseñas que Google deja leer */}
        {reviews?.rating != null && (
          <Reveal delay={0.04}>
            <a
              href={reviews.mapsUri ?? undefined}
              target="_blank"
              rel="noopener nofollow"
              className="mb-7 inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-navy/12 bg-white px-4 py-2 text-[13px] text-ink transition-colors duration-200 hover:border-navy/35"
            >
              <span className="font-semibold text-navy">{reviews.rating.toFixed(1)}</span>
              <Stars value={reviews.rating} className="text-[13px] text-[#f5a623]" />
              {reviews.count != null && (
                <span className="text-ink-soft">
                  {reviews.count} {t.testimonials.reviewsWord} {t.testimonials.ratingSuffix}
                </span>
              )}
            </a>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <span className="block font-serif text-[80px] leading-[0.6] text-azure/20 select-none">
            &ldquo;
          </span>

          <div className="relative mt-4 min-h-[250px] sm:min-h-[230px]">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.blockquote
                key={`${live ? "g" : "c"}-${index}`}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="absolute inset-x-0"
              >
                <p className={`font-serif leading-[1.4] text-navy ${quoteSize(text.length)}`}>
                  {text}
                </p>

                {live ? (
                  <footer className="mt-7 flex flex-col items-center gap-2.5">
                    <Stars value={live.rating} className="text-[15px] text-[#f5a623]" />
                    <div className="flex items-center gap-2.5">
                      {live.photoUri && (
                        // Avatar de Google servido desde su CDN. No pasa por
                        // next/image a propósito: optimizar un thumbnail de 32px
                        // de terceros gasta cuota sin mejorar nada.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={live.photoUri}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="size-8 rounded-full object-cover"
                        />
                      )}
                      <span className="text-[13.5px] font-semibold text-navy">{live.author}</span>
                      {live.when && (
                        <span className="text-[12.5px] text-ink-soft">· {live.when}</span>
                      )}
                    </div>
                    {live.uri && (
                      <a
                        href={live.uri}
                        target="_blank"
                        rel="noopener nofollow"
                        className="cursor-pointer text-[12.5px] font-semibold text-azure underline-offset-4 hover:underline"
                      >
                        {t.testimonials.viewOnGoogle}
                      </a>
                    )}
                  </footer>
                ) : (
                  <footer className="mt-6 text-[13px] font-semibold tracking-[0.04em] text-azure">
                    — {curated.a}
                  </footer>
                )}
              </motion.blockquote>
            </AnimatePresence>
          </div>
        </Reveal>

        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            onClick={() => move(-1)}
            aria-label="Anterior"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-navy/25 bg-white text-navy transition-colors duration-300 hover:border-navy hover:bg-navy hover:text-white"
          >
            ‹
          </button>

          <div className="flex gap-2">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => setState([i, i > index ? 1 : -1])}
                aria-label={`Testimonio ${i + 1}`}
                className="cursor-pointer py-2"
              >
                <span
                  className={`block h-px transition-all duration-500 ${
                    i === index ? "w-8 bg-navy" : "w-4 bg-navy/25"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => move(1)}
            aria-label="Siguiente"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-navy/25 bg-white text-navy transition-colors duration-300 hover:border-navy hover:bg-navy hover:text-white"
          >
            ›
          </button>
        </div>

        {/* Atribución obligatoria mientras se muestre contenido de Places */}
        {reviews && (
          <p className="mt-8 text-[11.5px] text-ink-soft">
            {t.testimonials.source} ·{" "}
            <a
              href={reviews.mapsUri ?? undefined}
              target="_blank"
              rel="noopener nofollow"
              className="cursor-pointer underline underline-offset-4"
            >
              Google Maps
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
