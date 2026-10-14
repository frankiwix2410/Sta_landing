import type { Metadata } from "next";
import { CertificateSheet } from "@/components/certificado/sheet";
import { PrintButton } from "@/components/certificado/print-button";
import { getCertificate } from "@/lib/reservations/certificates";
import { tallerWaLink } from "@/lib/taller";

// El certificado se comprueba contra la base en cada visita: si se revoca una
// asistencia, el enlace tiene que dejar de acreditar nada de inmediato.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificado de asistencia · STA",
  // Lleva el nombre de una persona: no debe acabar en un buscador.
  robots: { index: false, follow: false },
};

/** Aviso a pantalla completa para los casos en que no hay certificado que mostrar. */
function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="max-w-[520px] text-center">
        <h1 className="text-[clamp(26px,4vw,38px)] leading-[1.15] text-navy">{title}</h1>
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

export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const lookup = await getCertificate(decodeURIComponent(code));

  if (lookup.kind === "unavailable") {
    return (
      <Notice title="No podemos verificarlo ahora mismo">
        <p>
          Hubo un problema al consultar los certificados. Vuelve a intentarlo en unos
          minutos y, si sigue igual, escríbenos y lo resolvemos.
        </p>
      </Notice>
    );
  }

  if (lookup.kind === "not_found") {
    return (
      <Notice title="Certificado no disponible">
        <p>
          No encontramos un certificado con ese código. Puede que la referencia esté mal
          escrita, que el pago aún no esté confirmado o que todavía no hayamos registrado
          la asistencia al taller.
        </p>
      </Notice>
    );
  }

  return (
    <main className="cert-page min-h-[100svh] bg-cream px-4 py-10">
      <div className="cert-no-print mx-auto mb-8 flex max-w-[297mm] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight text-navy">Tu certificado</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Guárdalo como PDF desde el botón. El enlace sigue siendo válido para
            verificarlo cuando quieras.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* La hoja mide 297 mm fijos. En móvil se desplaza dentro de su propio
          contenedor: escalarla con transform dejaría el hueco original y sacaría
          barra horizontal a toda la página. */}
      <div className="overflow-x-auto">
        <div className="mx-auto w-fit">
          <CertificateSheet certificate={lookup.certificate} />
        </div>
      </div>
    </main>
  );
}
