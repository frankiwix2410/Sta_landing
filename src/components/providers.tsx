"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { content, type Content, type Lang } from "@/lib/content";
import { gsap, ScrollTrigger } from "@/lib/gsap";

type Ctx = { lang: Lang; t: Content; toggle: () => void };

const LangContext = createContext<Ctx | null>(null);

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang debe usarse dentro de <Providers>");
  return ctx;
}

/**
 * Lenis y ScrollTrigger tienen que compartir un único bucle de animación: si
 * cada uno corre su propio rAF, los `scrub` de GSAP van un frame por detrás del
 * scroll suave y se nota como tirones. Por eso Lenis va con `autoRaf: false` y
 * lo mueve el ticker de GSAP.
 */
function GsapLenisBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const update = () => ScrollTrigger.update();
    const raf = (time: number) => lenis.raf(time * 1000); // GSAP da segundos
    lenis.on("scroll", update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", update);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // valores por defecto de GSAP
    };
  }, [lenis]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === "es" ? "en" : "es";
      document.documentElement.lang = next;
      return next;
    });
  }, []);

  // Las dos variantes son estructuralmente idénticas; `as const` las vuelve
  // tuplas readonly distintas, de ahí el cast.
  const t = content[lang] as unknown as Content;

  return (
    <LangContext.Provider value={{ lang, t, toggle }}>
      <ReactLenis
        root
        options={{ lerp: 0.09, wheelMultiplier: 1, touchMultiplier: 1.6, autoRaf: false }}
      >
        <GsapLenisBridge />
        {children}
      </ReactLenis>
    </LangContext.Provider>
  );
}
