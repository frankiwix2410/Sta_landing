import type { Metadata } from "next";
import { Aviso } from "@/components/certificado/aviso";
import { normalizarCodigo } from "@/lib/certificados/codigo";
import { fechaLarga } from "@/lib/certificados/hoja";
import { obtenerCertificado } from "@/lib/certificados/repo";
import { enmascararDocumento } from "@/lib/inscripciones/documento";

// La respuesta cambia en cuanto se revoca: nada de caché.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificar certificado · STA",
  robots: { index: false, follow: false },
};

/**
 * Lo que abre el QR del certificado. Muestra lo justo para comprobar que el
 * papel es auténtico; el documento va enmascarado y no hay enlace a la hoja.
 */
export default async function VerificarPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  let texto = crudo;
  try {
    texto = decodeURIComponent(crudo);
  } catch {
    // Se deja tal cual: no será un código válido.
  }
  const codigo = normalizarCodigo(texto);
  const r = codigo ? await obtenerCertificado(codigo) : ({ kind: "not_found" } as const);

  if (r.kind === "unavailable") {
    return (
      <Aviso titulo="No podemos verificarlo ahora mismo">
        <p>Hubo un problema al consultar los certificados. Vuelve a intentarlo en unos minutos.</p>
      </Aviso>
    );
  }

  if (r.kind === "not_found") {
    return (
      <Aviso titulo="Certificado no encontrado">
        <p>No existe ningún certificado con el código {codigo ?? texto}. Revisa que esté bien escrito.</p>
      </Aviso>
    );
  }

  const c = r.certificado;
  const vigente = !c.revocadoEn;
  const dato = "text-[14.5px] text-navy";
  const etiqueta = "text-[13px] text-ink-soft";

  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="w-full max-w-[560px] rounded-3xl bg-white p-7 sm:p-10">
        <p
          className={`inline-flex rounded-full px-4 py-1.5 text-[13px] font-semibold ${
            vigente ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {vigente ? "Certificado válido" : "Certificado revocado"}
        </p>
        <h1 className="mt-5 text-[clamp(24px,4vw,34px)] leading-[1.15] text-navy">{c.nombre}</h1>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3">
          <dt className={etiqueta}>Documento</dt>
          <dd className={dato}>{enmascararDocumento(c.tipoDocumento, c.documento)}</dd>
          <dt className={etiqueta}>Curso</dt>
          <dd className={dato}>{c.curso}</dd>
          <dt className={etiqueta}>Fechas</dt>
          <dd className={dato}>{c.fechasTexto}</dd>
          <dt className={etiqueta}>Sede</dt>
          <dd className={dato}>{[c.sede, c.ciudad, c.region].filter(Boolean).join(", ")}</dd>
          <dt className={etiqueta}>Emitido</dt>
          <dd className={dato}>{fechaLarga(c.emitidoEn)}</dd>
          {c.revocadoEn && (
            <>
              <dt className={etiqueta}>Revocado</dt>
              <dd className={dato}>{fechaLarga(c.revocadoEn)}</dd>
            </>
          )}
          <dt className={etiqueta}>Código</dt>
          <dd className={`${dato} font-mono`}>{c.codigo}</dd>
        </dl>
      </div>
    </main>
  );
}
