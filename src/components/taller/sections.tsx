"use client";

import Image from "next/image";
import { LineDraw, Reveal, WordsReveal } from "@/components/ui/motion-primitives";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/icons";
import { tallerWaLink } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";
import { nombreCurso } from "@/lib/talleres/vista";

/* -------------------------------------------------------------- Contenido */
export function Contenido() {
  const taller = useTaller();
  return (
    <section id="contenido" className="bg-cream px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1120px]">
        <Reveal className="eyebrow mb-4 text-azure">
          <span className="block h-px w-6 bg-azure" />
          Contenido
        </Reveal>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <WordsReveal
            lines={["Siete módulos,"]}
            accent="dos jornadas."
            accentClassName="text-azure"
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />
          <Reveal delay={0.1}>
            <p className="max-w-[360px] text-[14.5px] leading-[1.8] text-ink">
              Cada módulo combina fundamento teórico y práctica guiada sobre phantoms y
              modelos anatómicos.
            </p>
          </Reveal>
        </div>

        <LineDraw className="mt-10 bg-navy/15" />

        <ol className="mt-2">
          {taller.modules.map((m, i) => (
            <Reveal as="li" key={m.n} delay={i * 0.05}>
              <div className="group grid grid-cols-[auto_1fr] items-baseline gap-x-5 border-b border-navy/10 py-6 transition-colors duration-300 hover:border-azure/40 sm:grid-cols-[auto_1fr_1.1fr] sm:gap-x-8">
                <span className="font-serif text-[15px] text-azure">{m.n}</span>
                <h3 className="text-[clamp(18px,2.2vw,24px)] leading-snug text-navy transition-colors duration-300 group-hover:text-azure">
                  {m.title}
                </h3>
                <p className="col-start-2 mt-2 text-[13.5px] leading-[1.75] text-ink-soft sm:col-start-3 sm:mt-0">
                  {m.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Galería */

/**
 * Fotos propias del taller. La retícula alterna alturas para que no se lea
 * como un catálogo: en móvil queda en dos columnas y en escritorio en tres.
 */
export function Galeria() {
  const taller = useTaller();
  return (
    <section id="galeria" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal className="eyebrow mb-4 text-azure">
              <span className="block h-px w-6 bg-azure" />
              El taller por dentro
            </Reveal>
            <WordsReveal
              lines={["Práctica real,"]}
              accent="no diapositivas."
              accentClassName="text-azure"
              className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
            />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[360px] text-[14.5px] leading-[1.8] text-ink">
              Ultrasonido, phantoms y bombas de infusión en la mano desde el primer
              módulo, con acompañamiento en cada estación.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {taller.gallery.map((photo, i) => (
            <Reveal key={photo.src} delay={(i % 3) * 0.08}>
              <figure className="group relative overflow-hidden rounded-2xl bg-ice">
                <div
                  className={
                    // La segunda de cada fila es más alta: rompe la cuadrícula
                    // sin sacar ninguna foto de su proporción vertical.
                    i % 3 === 1 ? "aspect-[3/4.4]" : "aspect-[3/4]"
                  }
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={720}
                    height={1280}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 45vw, 350px"
                    className="size-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 via-navy/25 to-transparent p-4 pt-12">
                  <figcaption className="text-[12.5px] leading-snug font-medium text-white sm:text-[13.5px]">
                    {photo.caption}
                  </figcaption>
                </div>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Instructor */
export function Instructor() {
  const taller = useTaller();
  return (
    <section id="instructor" className="grain relative overflow-hidden bg-navy px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="pointer-events-none absolute top-1/2 -left-[8%] size-[38vw] max-h-[520px] max-w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(88,134,232,.22),transparent_65%)] blur-2xl" />

      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <Reveal>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-3xl bg-ice">
            <Image
              src={taller.instructor.photo}
              alt={taller.instructor.name}
              width={900}
              height={1600}
              sizes="(max-width: 1024px) 70vw, 320px"
              className="size-full object-cover object-[center_18%]"
            />
          </div>
        </Reveal>

        <div>
          <Reveal className="eyebrow mb-4 text-sky">
            <span className="block h-px w-6 bg-azure" />
            Nuestro instructor
          </Reveal>

          <WordsReveal
            lines={[taller.instructor.name]}
            className="text-[clamp(28px,3.6vw,44px)] leading-[1.1] text-white"
          />

          <Reveal delay={0.12}>
            <p className="mt-4 text-[14px] font-medium tracking-[0.03em] text-ice/65">
              {taller.instructor.role}
            </p>
          </Reveal>

          <ul className="mt-8 flex flex-col gap-3.5">
            {taller.instructor.credentials.map((c, i) => (
              <Reveal as="li" key={c} delay={0.16 + i * 0.05}>
                <span className="flex items-start gap-3.5 text-[14.5px] leading-relaxed text-ice/80">
                  <span className="mt-[9px] block size-1.5 flex-none rounded-full bg-azure" />
                  {c}
                </span>
              </Reveal>
            ))}
          </ul>

          {taller.endorsement && (
            <Reveal delay={0.45}>
              <p className="mt-9 inline-flex items-center gap-2.5 rounded-full border border-white/25 px-5 py-2.5 text-[13px] font-semibold text-white">
                <span className="block size-1.5 rounded-full bg-sky" />
                {taller.endorsement}
              </p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ TÉRMINOS */
/** Fondo y texto de cada tramo de reembolso: más intenso cuanto más se devuelve. */
function tonoReembolso(percent: number) {
  if (percent >= 100) return { card: "bg-navy text-white", soft: "text-ice/70", bar: "bg-sky" };
  if (percent > 0) return { card: "bg-azure text-white", soft: "text-white/75", bar: "bg-white/70" };
  return { card: "bg-cream text-navy", soft: "text-ink-soft", bar: "bg-navy/15" };
}

export function Terminos() {
  const taller = useTaller();
  return (
    <section id="terminos" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1120px]">
        <Reveal className="eyebrow mb-4 text-azure">
          <span className="block h-px w-6 bg-azure" />
          Términos y condiciones
        </Reveal>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <WordsReveal
            lines={["Si cancelas,"]}
            accent="esto se devuelve."
            accentClassName="text-azure"
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />
          <Reveal delay={0.1}>
            <p className="max-w-[360px] text-[14.5px] leading-[1.8] text-ink">
              Los plazos se cuentan hasta el inicio del taller. Al reservar o registrar un
              pago aceptas estas condiciones, iguales para todos.
            </p>
          </Reveal>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {taller.refunds.map((r, i) => {
            const tono = tonoReembolso(r.percent);
            return (
              <Reveal as="li" key={r.when} delay={i * 0.08}>
                <div className={`flex h-full flex-col rounded-3xl p-6 sm:p-7 ${tono.card}`}>
                  <p className={`text-[12px] font-semibold tracking-[0.08em] uppercase ${tono.soft}`}>
                    {r.when}
                  </p>
                  <p className="mt-6 font-serif text-[clamp(52px,6vw,72px)] leading-none">
                    {r.percent}%
                  </p>
                  <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-current/10">
                    <div
                      className={`h-full rounded-full ${tono.bar}`}
                      style={{ width: `${r.percent}%` }}
                    />
                  </div>
                  <p className={`mt-5 text-[14px] leading-[1.7] ${tono.soft}`}>{r.text}</p>
                </div>
              </Reveal>
            );
          })}
        </ol>

        {taller.terms.length > 0 && (
          <ul className="mt-14 grid grid-cols-1 gap-x-12 sm:grid-cols-2">
            {taller.terms.map((t, i) => (
              <Reveal as="li" key={t.title} delay={i * 0.05}>
                <div className="flex h-full gap-4 border-t border-navy/10 py-6">
                  <span className="mt-[9px] block size-1.5 flex-none rounded-full bg-azure" />
                  <div>
                    <p className="text-[16px] font-medium text-navy">{t.title}</p>
                    <p className="mt-1.5 text-[14px] leading-[1.8] text-ink">{t.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */
export function Faq() {
  const taller = useTaller();
  return (
    <section id="faq" className="bg-cream px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            Preguntas
          </Reveal>
          <WordsReveal
            lines={["Antes de", "reservar."]}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />
          <Reveal delay={0.12}>
            <div className="mt-7 flex flex-col gap-2.5">
              <a
                href={tallerWaLink(
                  `Hola, tengo una pregunta sobre el ${nombreCurso(taller)}.`,
                )}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 transition-all duration-300 hover:translate-x-1 hover:bg-ice"
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-[#25D366] text-white">
                  <WhatsAppIcon />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    {taller.contact.whatsappLabel}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    También: {taller.contact.phoneAlt}
                  </span>
                </span>
              </a>
              <a
                href={taller.contact.instagramUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 transition-all duration-300 hover:translate-x-1 hover:bg-ice"
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-navy text-white">
                  <InstagramIcon />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    @{taller.contact.instagram}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    Novedades y cupos disponibles
                  </span>
                </span>
              </a>
            </div>
          </Reveal>
        </div>

        <div className="flex flex-col">
          {taller.faq.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.06}>
              <details className="group border-b border-navy/10 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[16px] font-medium text-navy transition-colors duration-200 group-open:text-azure [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="relative block size-4 flex-none">
                    <span className="absolute top-1/2 left-0 block h-px w-4 -translate-y-1/2 bg-current" />
                    <span className="absolute top-1/2 left-0 block h-px w-4 -translate-y-1/2 rotate-90 bg-current transition-transform duration-300 group-open:rotate-0" />
                  </span>
                </summary>
                <p className="mt-3 max-w-[560px] text-[14px] leading-[1.8] text-ink">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
