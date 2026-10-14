import Link from "next/link";
import { WhatsAppIcon } from "@/components/ui/icons";
import { contenidoTaller, tallerWaLink } from "@/lib/taller";

/** Lo que muestra `/taller` cuando no hay ningún taller publicado ni pasado. */
export function ProximaEdicion() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-navy px-5 py-16 text-center">
      <div className="max-w-[520px]">
        <p className="eyebrow mb-4 justify-center text-sky">Taller presencial</p>
        <h1 className="text-[clamp(30px,5vw,52px)] leading-[1.1] text-white">
          Próxima edición
          <span className="block text-sky">muy pronto.</span>
        </h1>
        <p className="mt-5 text-[15px] leading-[1.8] text-ice/80">
          Estamos preparando las fechas. Escríbenos y te avisamos en cuanto abramos
          inscripciones.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={tallerWaLink("Hola, quiero que me avisen de la próxima edición del taller.")}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2.5 rounded-full bg-azure px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-navy"
          >
            <WhatsAppIcon className="size-4" />
            Avisarme por WhatsApp
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/30 px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:border-white"
          >
            Volver al inicio
          </Link>
        </div>
        <p className="mt-10 text-[12.5px] text-ice/50">@{contenidoTaller.contact.instagram}</p>
      </div>
    </main>
  );
}
