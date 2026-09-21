import type { Metadata } from "next";
import { ScrollProgress } from "@/components/scroll-progress";
import { TallerFooter } from "@/components/taller/footer";
import { TallerHero } from "@/components/taller/hero";
import { TallerNav } from "@/components/taller/nav";
import { PagoSection } from "@/components/taller/pago-form";
import { ReservaSection } from "@/components/taller/reserva-form";
import { Contenido, Faq, Galeria, Instructor } from "@/components/taller/sections";
import { getSeats } from "@/lib/reservations";
import { taller } from "@/lib/taller";

/**
 * La página sigue siendo estática, pero se regenera cada 5 minutos para
 * refrescar el conteo de cupos. No se hace dinámica a propósito: el número en
 * pantalla es solo informativo y el cupo real se comprueba dentro de la
 * transacción al enviar el formulario, así que unos minutos de desfase no
 * pueden vender una plaza de más.
 */
export const revalidate = 300;

const name = `Taller de ${taller.title} ${taller.titleAccent}`;
const description = `${taller.dates.label} · ${taller.venue.name}, ${taller.venue.city}. Taller presencial con ${taller.instructor.name}: 7 módulos prácticos de anestesia regional ecoguiada, accesos vasculares y sedación TCI. ${taller.endorsement}.`;

export const metadata: Metadata = {
  title: `${name} · ${taller.dates.label}`,
  description,
  keywords: [
    "taller anestesia regional",
    "anestesia regional ecoguiada",
    "sedación TCI",
    "bloqueos ecoguiados",
    "accesos vasculares ecoguiados",
    "curso anestesiología Maracaibo",
  ],
  openGraph: { title: name, description, type: "website", locale: "es_CO" },
  robots: { index: true, follow: true },
};

/** Ficha de evento para que el taller pueda aparecer como tal en buscadores. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationEvent",
  name,
  description,
  startDate: taller.dates.startIso,
  endDate: taller.dates.endIso,
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  eventStatus: "https://schema.org/EventScheduled",
  location: {
    "@type": "Place",
    name: taller.venue.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: taller.venue.city,
      addressCountry: "VE",
    },
  },
  performer: { "@type": "Person", name: taller.instructor.name },
  organizer: { "@type": "Organization", name: "STA", url: taller.contact.instagramUrl },
};

export default async function TallerPage() {
  const seats = await getSeats();

  return (
    <>
      <ScrollProgress />
      <TallerNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <TallerHero />
        <Contenido />
        <Galeria />
        <Instructor />
        <ReservaSection seats={seats} />
        <PagoSection />
        <Faq />
      </main>
      <TallerFooter />
    </>
  );
}
