import Image from "next/image";
import Link from "next/link";
import { taller, tallerWaLink } from "@/lib/taller";
import { site } from "@/lib/site";

export function TallerFooter() {
  return (
    <footer className="grain relative bg-navy px-5 pt-16 pb-8 text-white sm:px-8 lg:px-16 lg:pt-20">
      <div className="relative mx-auto flex max-w-[1120px] flex-wrap items-start justify-between gap-9">
        <div className="max-w-[320px]">
          <Image
            // Versión recortada: la "full" trae tanto margen transparente que
            // a esta altura el logo visible quedaba en ~21px.
            src="/assets/logo-horizontal-white-trim.png"
            alt={site.brandFull}
            width={1100}
            height={334}
            sizes="290px"
            className="h-[72px] w-auto sm:h-[88px]"
          />
          <p className="mt-3.5 text-[13px] leading-[1.7] text-ice/55">
            Taller de {taller.title} {taller.titleAccent} · {taller.dates.label} ·{" "}
            {taller.venue.name}, {taller.venue.city}.
          </p>
        </div>

        <div className="flex flex-wrap gap-12">
          <div>
            <h4 className="mb-4 text-[13px] tracking-[0.1em] text-sky uppercase">Taller</h4>
            <div className="flex flex-col gap-2.5">
              <a
                href="#contenido"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Contenido
              </a>
              <a
                href="#instructor"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Instructor
              </a>
              <a
                href="#reservar"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Reservar cupo
              </a>
              <a
                href="#registro-pago"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Registrar pago
              </a>
              <Link
                href="/"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Ir al sitio principal
              </Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-[13px] tracking-[0.1em] text-sky uppercase">Informes</h4>
            <div className="flex flex-col gap-2.5">
              <a
                href={tallerWaLink(`Hola, quiero información del Taller de ${taller.title}.`)}
                target="_blank"
                rel="noopener"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                WhatsApp {taller.contact.whatsappLabel}
              </a>
              <a
                href={`tel:${taller.contact.phoneAlt.replace(/\s/g, "")}`}
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                {taller.contact.phoneAlt}
              </a>
              <a
                href={taller.contact.instagramUrl}
                target="_blank"
                rel="noopener"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Instagram @{taller.contact.instagram}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-12 flex max-w-[1120px] flex-wrap items-center justify-between gap-3.5 border-t border-white/12 pt-6">
        <span className="text-xs text-ice/45">
          © {new Date().getFullYear()} {site.doctor} · {site.brand}
        </span>
        <span className="text-xs text-ice/45">{taller.endorsement}</span>
      </div>
    </footer>
  );
}
