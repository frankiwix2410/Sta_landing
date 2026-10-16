import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/certificado/aviso";
import { PrintButton } from "@/components/certificado/print-button";
import { CertificateSheet } from "@/components/certificado/sheet";
import { esReferencia, normalizarCodigo } from "@/lib/certificados/codigo";
import { codigoPorReferencia, obtenerCertificado } from "@/lib/certificados/repo";

// Se comprueba contra la base en cada visita: si se revoca, el enlace deja de
// acreditar nada de inmediato.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificado de asistencia · STA",
  // Lleva el nombre y el documento de una persona: no debe acabar en un buscador.
  robots: { index: false, follow: false },
};

function SinConexion() {
  return (
    <Aviso titulo="No podemos mostrarlo ahora mismo">
      <p>
        Hubo un problema al consultar los certificados. Vuelve a intentarlo en unos minutos y, si
        sigue igual, escríbenos y lo resolvemos.
      </p>
    </Aviso>
  );
}

function NoEncontrado() {
  return (
    <Aviso titulo="Certificado no disponible">
      <p>
        No encontramos un certificado con ese código. Puede que esté mal escrito o que todavía no se
        haya emitido: se emite cuando el taller termina, con el pago completo y la asistencia
        registrada.
      </p>
    </Aviso>
  );
}

export default async function CertificadoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let texto = code;
  try {
    texto = decodeURIComponent(code).trim();
  } catch {
    // Un `%` suelto no es un código; se trata como no encontrado más abajo.
  }

  // Enlaces antiguos por referencia de la reserva: llevan al código si existe.
  if (esReferencia(texto)) {
    const codigo = await codigoPorReferencia(texto.toUpperCase());
    if (codigo === "unavailable") return <SinConexion />;
    if (codigo) redirect(`/certificado/${codigo}`);
    return <NoEncontrado />;
  }

  const codigo = normalizarCodigo(texto);
  if (!codigo) return <NoEncontrado />;
  if (codigo !== texto) redirect(`/certificado/${codigo}`);

  const r = await obtenerCertificado(codigo);
  if (r.kind === "unavailable") return <SinConexion />;
  if (r.kind === "not_found") return <NoEncontrado />;

  if (r.certificado.revocadoEn) {
    return (
      <Aviso titulo="Certificado revocado">
        <p>
          El certificado {codigo} fue revocado y ya no acredita la participación. Si crees que es un
          error, escríbenos.
        </p>
      </Aviso>
    );
  }

  return (
    <main className="cert-page min-h-[100svh] bg-cream px-4 py-10">
      <div className="cert-no-print mx-auto mb-8 flex max-w-[297mm] flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight text-navy">Tu certificado</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Guárdalo como PDF desde el botón. Cualquiera puede comprobarlo con el QR o en{" "}
            <Link href={`/certificado/verificar/${codigo}`} className="text-azure underline-offset-4 hover:underline">
              la página de verificación
            </Link>
            .
          </p>
        </div>
        <PrintButton />
      </div>

      {/* La hoja mide 297 mm fijos. En móvil se desplaza dentro de su propio
          contenedor: escalarla con transform dejaría el hueco original y sacaría
          barra horizontal a toda la página. */}
      <div className="overflow-x-auto">
        <div className="mx-auto w-fit">
          <CertificateSheet certificado={r.certificado} />
        </div>
      </div>
    </main>
  );
}
