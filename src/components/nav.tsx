"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useLang } from "@/components/providers";
import { SmoothLink } from "@/components/ui/smooth-link";
import { waLink } from "@/lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Nav() {
  const { lang, t, toggle } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  const links = [
    { href: "#sobre", label: t.nav.about },
    { href: "#servicios", label: t.nav.services },
    { href: "#diferenciales", label: t.nav.why },
    { href: "#galeria", label: t.nav.gallery },
    { href: "#contacto", label: t.nav.contact },
  ];

  // Sobre el hero navy el nav va en blanco; al hacer scroll pasa a cristal claro.
  const onDark = !scrolled;
  const ink = onDark ? "text-white" : "text-navy";

  return (
    <>
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        className={`fixed inset-x-0 top-0 z-120 flex items-center justify-between gap-5 px-5 transition-[background,box-shadow,padding,backdrop-filter] duration-400 sm:px-8 lg:px-16 ${
          scrolled
            ? "bg-white/90 py-2.5 shadow-[0_6px_30px_-16px_rgba(11,25,86,.45)] backdrop-blur-xl"
            : "bg-transparent py-4"
        }`}
      >
        <SmoothLink href="#top" className="flex flex-none items-center gap-3">
          <Image
            src={onDark ? "/assets/monogram-white.png" : "/assets/monogram-navy.png"}
            alt="STA"
            width={1410}
            height={1182}
            // `priority` está deprecado desde Next 16; el logo no es el LCP, así
            // que basta con cargarlo sin esperar al viewport.
            loading="eager"
            className="h-10 w-auto object-contain"
          />
          <span className={`font-serif text-[15px] leading-none tracking-[0.14em] ${ink}`}>
            STA
          </span>
        </SmoothLink>

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

        <div className="flex flex-none items-center gap-3">
          <button
            onClick={toggle}
            aria-label={lang === "es" ? "Switch to English" : "Cambiar a español"}
            className={`cursor-pointer rounded-full border px-3 py-[7px] text-xs font-semibold tracking-[0.08em] transition-colors ${
              onDark
                ? "border-white/40 text-white hover:bg-white/10"
                : "border-navy/30 text-navy hover:bg-navy/5"
            }`}
          >
            {lang === "es" ? "EN" : "ES"}
          </button>

          <a
            href={waLink(t.wa.book)}
            target="_blank"
            rel="noopener"
            className={`hidden rounded-full px-5 py-[11px] text-[13px] font-semibold transition-all duration-300 hover:-translate-y-0.5 sm:inline-flex ${
              onDark
                ? "bg-white text-navy hover:bg-ice"
                : "bg-navy text-white hover:bg-azure"
            }`}
          >
            {t.nav.cta}
          </a>

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
            className="grain fixed inset-0 z-119 flex flex-col items-center justify-center gap-6 bg-navy lg:hidden"
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
                  className="font-serif text-[28px] text-white transition-colors hover:text-sky"
                >
                  {l.label}
                </SmoothLink>
              </motion.div>
            ))}
            <motion.a
              href={waLink(t.wa.book)}
              target="_blank"
              rel="noopener"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
              className="mt-4 rounded-full bg-azure px-7 py-3.5 text-sm font-semibold text-white"
            >
              {t.nav.cta}
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
