"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Los módulos ES se evalúan una sola vez por bundle, así que registrar aquí
// evita repetir `registerPlugin` en cada componente.
gsap.registerPlugin(ScrollTrigger, CustomEase);

/**
 * Misma curva que el `EASE` de motion-primitives — cubic-bezier(.16,1,.3,1) —
 * para que las entradas de GSAP y las de motion se sientan idénticas.
 */
export const STA_EASE = "sta";
CustomEase.create(STA_EASE, "M0,0 C0.16,1 0.3,1 1,1");

export { gsap, ScrollTrigger };
