import type { ReactNode } from "react";
import { tallerWaLink } from "@/lib/taller";

/** Aviso a pantalla completa cuando no hay certificado que mostrar. */
export function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="max-w-[520px] text-center">
        <h1 className="text-[clamp(26px,4vw,38px)] leading-[1.15] text-navy">{titulo}</h1>
        <div className="mt-5 text-[15px] leading-[1.8] text-ink">{children}</div>
        <a
          href={tallerWaLink("Hola, tengo una duda con mi certificado del taller.")}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-flex cursor-pointer items-center rounded-full bg-navy px-6 py-3.5 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-azure"
        >
          Escribir por WhatsApp
        </a>
      </div>
    </main>
  );
}
