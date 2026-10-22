import type { Metadata } from "next";
import { ScrollProgress } from "@/components/scroll-progress";
import { CertificadosSection } from "@/components/taller/certificados";
import { TallerFooter } from "@/components/taller/footer";
import { TallerHero } from "@/components/taller/hero";
import { TallerNav } from "@/components/taller/nav";
import { PagoSection } from "@/components/taller/pago-form";
import { ProximaEdicion } from "@/components/taller/proxima-edicion";
import { ReservaSection } from "@/components/taller/reserva-form";
import { Contenido, Faq, Galeria, Instructor, Terminos } from "@/components/taller/sections";
import { supabaseConfigured } from "@/lib/reservations/supabase";
import { TallerProvider } from "@/lib/talleres/contexto";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, type TallerVista } from "@/lib/talleres/vista";

/**
 * Se renderiza en cada petición: los cambios del admin se ven al instante y no
 * queda nada cacheado del build (CI compila sin Supabase y dejaría fijada la
 * página "Próxima edición").
 */
export const dynamic = "force-dynamic";

function descripcion(t: TallerVista) {
  return `${t.dates.label} · ${t.venue.name}, ${t.venue.city}. ${t.kind} con ${t.instructor.name}: anestesia regional ecoguiada, accesos vasculares y sedación TCI.${t.endorsement ? ` ${t.endorsement}.` : ""}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const publico = await cargarTallerPublico();
  if (publico.kind === "sin_conexion" && supabaseConfigured) {
    return { title: "Taller · STA", robots: { index: false, follow: false } };
  }
  if (publico.kind !== "ok") {
    return { title: "Taller · Próxima edición", robots: { index: true, follow: true } };
  }
  const t = publico.vista;
  const name = nombreCurso(t);
  const description = descripcion(t);
  return {
    title: `${name} · ${t.dates.label}`,
    description,
    keywords: [
      "taller anestesia regional",
      "anestesia regional ecoguiada",
      "sedación TCI",
      "bloqueos ecoguiados",
      "accesos vasculares ecoguiados",
      `curso anestesiología ${t.venue.city}`,
    ],
    openGraph: { title: name, description, type: "website", locale: "es_CO" },
    robots: { index: true, follow: true },
  };
}

/** Ficha de evento para que el taller pueda aparecer como tal en buscadores. */
function jsonLd(t: TallerVista) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationEvent",
    name: nombreCurso(t),
    description: descripcion(t),
    startDate: t.dates.startIso,
    endDate: t.dates.endIso,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: t.venue.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: t.venue.city,
        addressRegion: t.venue.region || undefined,
        addressCountry: t.venue.country,
      },
    },
    performer: { "@type": "Person", name: t.instructor.name },
    organizer: { "@type": "Organization", name: "STA", url: t.contact.instagramUrl },
  };
}

export default async function TallerPage() {
  const publico = await cargarTallerPublico();
  if (publico.kind === "sin_conexion" && supabaseConfigured)
    return <ProximaEdicion motivo="sin_conexion" />;
  if (publico.kind !== "ok") return <ProximaEdicion />;

  const t = publico.vista;

  return (
    <TallerProvider value={t}>
      <ScrollProgress />
      <TallerNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(t)).replace(/</g, "\\u003c") }}
      />
      <main>
        <TallerHero />
        {/* Con el taller terminado lo que se busca es el certificado: va arriba. */}
        {t.mostrar.certificados && t.estado === "finalizado" && <CertificadosSection destacada />}
        <Contenido />
        <Galeria />
        <Instructor />
        {(t.mostrar.reserva || t.mostrar.listaEspera) && <ReservaSection />}
        {t.mostrar.pago && <PagoSection />}
        {t.mostrar.certificados && t.estado !== "finalizado" && <CertificadosSection destacada={false} />}
        <Faq />
        <Terminos />
      </main>
      <TallerFooter taller={t} />
    </TallerProvider>
  );
}
