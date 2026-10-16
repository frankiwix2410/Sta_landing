import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/certificado/print-button";
import { CertificateSheet } from "@/components/certificado/sheet";
import { puertaAdmin } from "@/lib/admin-auth";
import { listarCertificadosTaller } from "@/lib/certificados/repo";
import { esUuid } from "@/lib/inscripciones/formulario";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Imprimir certificados · STA",
  robots: { index: false, follow: false },
};

/**
 * Todos los certificados vigentes del taller, uno por página.
 *
 * Al imprimir sale un único PDF con tantas páginas como certificados: el salto
 * lo pone la regla `break-after: page` de `sheet.css`.
 */
export default async function ImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) notFound();

  const tallerId = await tallerIdParaAdmin((await searchParams).taller);
  const certificados = tallerId && esUuid(tallerId) ? await listarCertificadosTaller(tallerId) : null;
  const vigentes = (certificados ?? []).filter((c) => !c.revocadoEn);
  const volver = tallerId ? `/admin/certificados?taller=${tallerId}` : "/admin/certificados";

  if (tallerId && certificados === null) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream px-5">
        <div className="text-center">
          <p className="text-[15px] text-ink">
            No se pudieron cargar los certificados. Revisa la conexión e inténtalo de nuevo.
          </p>
          <Link
            href={volver}
            className="mt-5 inline-block text-[14px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  if (vigentes.length === 0) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream px-5">
        <div className="text-center">
          <p className="text-[15px] text-ink">No hay certificados vigentes que imprimir.</p>
          <Link
            href={volver}
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
          <h1 className="text-[22px] leading-tight text-navy">{vigentes.length} certificados</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Imprime y elige «Guardar como PDF». Sale una página por certificado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={volver} className="text-[14px] font-semibold text-azure underline-offset-4 hover:underline">
            Volver
          </Link>
          <PrintButton label="Imprimir todos" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto flex w-fit flex-col gap-10">
          {vigentes.map((c) => (
            <CertificateSheet key={c.id} certificado={c} />
          ))}
        </div>
      </div>
    </main>
  );
}
