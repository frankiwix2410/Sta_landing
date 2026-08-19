"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Igual que el `useReducedMotion` de motion, pero seguro para hidratar.
 *
 * El de motion ya devuelve el valor real en el **primer** render del cliente,
 * mientras que el servidor siempre renderiza `false`. Si un componente decide
 * su estructura o sus estilos iniciales con ese valor, el HTML del servidor y
 * el del cliente no coinciden y React descarta el árbol entero: justo quien
 * pide menos movimiento acaba con la peor experiencia.
 *
 * `useSyncExternalStore` usa `getServerSnapshot` tanto en SSR como al hidratar,
 * así que el primer render siempre concuerda y el valor real llega en el
 * segundo, ya en cliente.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
