"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { SmoothLink } from "@/components/ui/smooth-link";

const EASE = [0.16, 1, 0.3, 1] as const;

const links = [
  { href: "#contenido", label: "Contenido" },
  { href: "#instructor", label: "Instructor" },
  { href: "#faq", label: "Preguntas" },
];

/**
 * Nav propio del taller: el del sitio apunta a anclas de la home que aquí no
 * existen, y esta página no cambia de idioma.
 */
export function TallerNav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  const onDark = !scrolled;
  const ink = onDark ? "text-white" : "text-navy";

  return (
    <motion.nav
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-120 flex items-center justify-between gap-5 px-5 transition-[background,box-shadow,padding,backdrop-filter] duration-400 sm:px-8 lg:px-16 ${scrolled
        ? "bg-white/90 py-2.5 shadow-[0_6px_30px_-16px_rgba(11,25,86,.45)] backdrop-blur-xl"
        : "bg-transparent py-4"
        }`}
    >
      <Link href="/" className="flex flex-none items-center gap-3">
        <Image
          src={onDark ? "/assets/logo-horizontal-white.png" : "/assets/sedacion y tecnicas analgesicas avanzadas Azul  1.png"}
          alt="Sedación y Técnicas Analgésicas Avanzadas"
          width={1140}
          height={362}
          preload
          className={`w-auto object-contain transition-[height] duration-400 ${scrolled ? "h-10 sm:h-16 lg:h-20" : "h-12 sm:h-20 lg:h-24"}`}
        />
      </Link>

      <div className="hidden items-center gap-8 lg:flex">
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

      <SmoothLink
        href="#reservar"
        className={`flex-none rounded-full px-5 py-[11px] text-[13px] font-semibold transition-all duration-300 hover:-translate-y-0.5 ${onDark ? "bg-white text-navy hover:bg-ice" : "bg-navy text-white hover:bg-azure"
          }`}
      >
        Reservar cupo
      </SmoothLink>
    </motion.nav>
  );
}
