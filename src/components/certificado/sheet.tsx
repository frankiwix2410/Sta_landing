import Image from "next/image";
import "./sheet.css";
import type { Certificate } from "@/lib/reservations/certificates";
import { site } from "@/lib/site";
import { taller } from "@/lib/taller";

/**
 * Una hoja de certificado, A4 apaisado.
 *
 * Las medidas van en milímetros y no en píxeles porque esto existe para
 * imprimirse: en mm la hoja mide lo mismo en pantalla que en el PDF, y el
 * navegador no reescala el contenido al pasar por «Guardar como PDF».
 *
 * No se imprime el email ni la ciudad: la página del certificado es pública
 * (cualquiera con la referencia puede verificarlo), así que solo lleva lo
 * imprescindible para acreditar la asistencia.
 */
export function CertificateSheet({
  certificate,
}: {
  certificate: Certificate;
}) {
  const { name, courseTitle, datesLabel, hours, endorsement, reference } =
    certificate;

  return (
    <article className="cert-sheet relative flex h-[210mm] w-[297mm] flex-col overflow-hidden bg-white text-navy">
      {/* Marco */}
      <div className="pointer-events-none absolute inset-[8mm] border border-azure/50" />
      <div className="pointer-events-none absolute inset-[9.5mm] border border-azure/20" />
      {/* Banda superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[6mm] bg-navy" />
      {/* Marca de agua. La opacidad va en línea y no como `text-navy/[0.02]`
          porque a este tamaño cualquier redondeo de Tailwind se nota como una
          mancha gris en el papel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[38%] text-center font-serif text-[62mm] leading-none select-none"
        style={{ color: "rgb(11 25 86 / 0.028)" }}
      >
        STA
      </div>

      <div className="relative flex flex-1 flex-col items-center px-[26mm] pt-[15mm] pb-[13mm] text-center">
        <Image
          src="/assets/logo-full-navy-trim.png"
          alt=""
          width={1100}
          height={334}
          className="h-[11mm] w-auto object-contain"
        />

        <p className="mt-[8mm] text-[3.2mm] font-semibold tracking-[0.32em] text-azure uppercase">
          Certificado de asistencia
        </p>

        {/* El bloque central se centra en el espacio que sobra: si se apilara
            arriba, quedaría un hueco muerto justo encima de la firma. */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-[3.6mm] text-ink-soft">Se certifica que</p>

          <h1 className="mt-[3.5mm] font-serif text-[15mm] leading-[1.1] text-navy">
            {name}
          </h1>

          <div className="mt-[5mm] h-px w-[105mm] bg-azure/45" />

          <p className="mt-[9mm] max-w-[190mm] text-[4.2mm] leading-[1.75] text-ink">
            asistió y completó satisfactoriamente el{" "}
            <span className="font-semibold text-navy">
              Taller de {courseTitle}
            </span>
            {datesLabel ? (
              <>
                , realizado el{" "}
                <span className="font-semibold text-navy">{datesLabel}</span>
              </>
            ) : null}
            {" en "}
            {taller.venue.name}, {taller.venue.city}
            {hours ? (
              <>
                , con una intensidad de{" "}
                <span className="font-semibold text-navy">
                  {hours} horas académicas
                </span>
              </>
            ) : null}
            .
          </p>

        </div>

        {/* El aval va aquí abajo y no dentro del bloque centrado: apoyado sobre
            la firma llena el tercio inferior, que si no queda vacío. */}
        {endorsement ? (
          <p className="text-[3.2mm] font-semibold tracking-[0.18em] text-azure uppercase">
            {endorsement}
          </p>
        ) : null}

        {/* Firma */}
        <div className="flex w-full items-end justify-between gap-[16mm] pt-[11mm] text-left">
          <div className="w-[80mm]">
            <div className="h-px w-full bg-navy/35" />
            <p className="mt-[2.5mm] text-[3.4mm] font-semibold text-navy">
              {taller.instructor.name}
            </p>
            <p className="text-[2.9mm] text-ink-soft">
              {taller.instructor.role}
            </p>
            <p className="text-[2.9mm] text-ink-soft">{site.brandFull}</p>
          </div>

          <div className="text-right">
            <p className="text-[2.6mm] tracking-[0.14em] text-ink-soft uppercase">
              Código de verificación
            </p>
            <p className="mt-[1mm] font-mono text-[3.6mm] tracking-[0.06em] text-navy">
              {reference}
            </p>
            <p className="mt-[1.5mm] text-[2.5mm] text-ink-soft">
              Verifícalo en {verificationHost()}/certificado/{reference}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Dominio que se imprime en el pie. `NEXT_PUBLIC_SITE_URL` puede no estar
 * definida todavía, así que se degrada a un texto neutro en vez de imprimir
 * "undefined" en un documento oficial.
 */
function verificationHost() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return "este sitio";
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
