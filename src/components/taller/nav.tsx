"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { SmoothLink } from "@/components/ui/smooth-link";

const EASE = [0.16, 1, 0.3, 1] as const;

const links = [
  { href: "#contenido", label: "Contenido" },
  { href: "#galeria", label: "Galería" },
  { href: "#instructor", label: "Instructor" },
  { href: "#registro-pago", label: "Registrar pago" },
  { href: "#faq", label: "Preguntas" },
];

/**
 * Nav propio del taller: el del sitio apunta a anclas de la home que aquí no
 * existen, y esta página no cambia de idioma.
 *
 * Por debajo de `lg` los enlaces no caben en una fila, así que pasan al menú a
 * pantalla completa, igual que en el nav del sitio.
 */
export function TallerNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  // Con el menú abierto el fondo es navy, así que el nav se pinta como sobre
  // oscuro aunque la página esté scrolleada.
  const onDark = !scrolled || open;
  const ink = onDark ? "text-white" : "text-navy";

  return (
    <>
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        className={`fixed inset-x-0 top-0 z-120 flex items-center justify-between gap-3 px-5 transition-[background,box-shadow,padding,backdrop-filter] duration-400 sm:gap-5 sm:px-8 lg:px-16 ${
          scrolled && !open
            ? "bg-white/90 py-2.5 shadow-[0_6px_30px_-16px_rgba(11,25,86,.45)] backdrop-blur-xl"
            : "bg-transparent py-4"
        }`}
      >
        <Link href="/" className="flex min-w-0 flex-none items-center gap-3">
          <Image
            src={onDark ? "/assets/logo-horizontal-white.png" : "/assets/sedacion y tecnicas analgesicas avanzadas Azul  1.png"}
            alt="Sedación y Técnicas Analgésicas Avanzadas"
            width={1140}
            height={362}
            preload
            className={`w-auto max-w-[52vw] object-contain object-left transition-[height] duration-400 ${scrolled && !open ? "h-10 sm:h-16 lg:h-20" : "h-12 sm:h-20 lg:h-24"}`}
          />
        </Link>

        <div className="hidden items-center gap-6 lg:flex xl:gap-8">
          {links.map((l) => (
            <SmoothLink
              key={l.href}
              href={l.href}
              className={`group relative text-[13.5px] font-medium transition-colors ${ink}`}
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-azure transition-[width] duration-400 ease-out group-hover:w-full" />
            </SmoothLink>
          ))}
        </div>

        <div className="flex flex-none items-center gap-2 sm:gap-3">
          <SmoothLink
            href="#reservar"
            onClick={() => setOpen(false)}
            // Oculto en móvil: junto al logo y al botón de menú no cabe. Abajo
            // de `sm` la reserva se alcanza desde el menú.
            className={`hidden rounded-full px-5 py-[11px] text-[13px] font-semibold transition-all duration-300 hover:-translate-y-0.5 sm:inline-flex ${
              onDark ? "bg-white text-navy hover:bg-ice" : "bg-navy text-white hover:bg-azure"
            }`}
          >
            Reservar cupo
          </SmoothLink>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menú"
            aria-expanded={open}
            className={`flex size-9 cursor-pointer flex-col items-center justify-center gap-[5px] lg:hidden ${ink}`}
          >
            <span
              className={`block h-px w-5 bg-current transition-transform duration-300 ${
                open ? "translate-y-[3px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px w-5 bg-current transition-transform duration-300 ${
                open ? "-translate-y-[3px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="grain fixed inset-0 z-119 flex flex-col items-center justify-center gap-5 bg-navy px-6 lg:hidden"
          >
            {links.map((l, i) => (
              <motion.div
                key={l.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: EASE }}
              >
                <SmoothLink
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-serif text-[26px] text-white transition-colors hover:text-sky sm:text-[28px]"
                >
                  {l.label}
                </SmoothLink>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
            >
              <SmoothLink
                href="#reservar"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex rounded-full bg-azure px-7 py-3.5 text-sm font-semibold text-white"
              >
                Reservar cupo
              </SmoothLink>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
