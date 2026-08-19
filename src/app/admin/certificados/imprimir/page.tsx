import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateSheet } from "@/components/certificado/sheet";
import { PrintButton } from "@/components/certificado/print-button";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { listCertificates } from "@/lib/reservations/certificates";
import { taller } from "@/lib/taller";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Imprimir certificados · STA",
  robots: { index: false, follow: false },
};

/**
 * Todos los certificados de la edición, uno por página.
 *
 * Al imprimir sale un único PDF con tantas páginas como asistentes: el salto lo
 * pone la regla `break-after: page` de `sheet.css`.
 */
export default async function ImprimirPage() {
  if (!adminConfigured()) notFound();
  if (!(await isAdmin())) notFound();

  const certificates = await listCertificates(taller.edition);

  if (!certificates?.length) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream px-5">
        <div className="text-center">
          <p className="text-[15px] text-ink">No hay certificados que imprimir.</p>
          <Link
            href="/admin/certificados"
            className="mt-5 inline-block text-[14px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="cert-page min-h-[100svh] bg-cream px-4 py-10">
      <div className="cert-no-print mx-auto mb-8 flex max-w-[297mm] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight text-navy">
            {certificates.length} certificados
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Imprime y elige «Guardar como PDF». Sale una página por asistente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/certificados"
            className="text-[14px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            Volver
          </Link>
          <PrintButton label="Imprimir todos" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto flex w-fit flex-col gap-10">
          {certificates.map((c) => (
            <CertificateSheet key={c.reference} certificate={c} />
          ))}
        </div>
      </div>
    </main>
  );
}
