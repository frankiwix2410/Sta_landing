"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TallerVista } from "./vista";

/**
 * Reparte el taller activo a los componentes cliente de `/taller`. La página
 * (servidor) lo lee de la base una vez y lo pasa aquí; así ningún componente
 * importa datos operativos fijos del código.
 */
const TallerContext = createContext<TallerVista | null>(null);

export function TallerProvider({ value, children }: { value: TallerVista; children: ReactNode }) {
  return <TallerContext value={value}>{children}</TallerContext>;
}

export function useTaller(): TallerVista {
  const taller = useContext(TallerContext);
  if (!taller) throw new Error("useTaller() se usó fuera de <TallerProvider>.");
  return taller;
}
