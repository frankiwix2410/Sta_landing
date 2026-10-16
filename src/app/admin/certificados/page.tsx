import type { Metadata } from "next";
import Link from "next/link";
import { CertificadoFila } from "@/components/admin/certificado-fila";
import { LoginScreen } from "@/components/admin/login-screen";
import { SelectorTaller } from "@/components/admin/selector-taller";
import { AdminShell } from "@/components/admin/shell";
import { botonPrimario, botonSecundario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { fechaLarga } from "@/lib/certificados/hoja";
import { listarCertificadosTaller } from "@/lib/certificados/repo";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";
import { listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificados · STA",
  robots: { index: false, follow: false },
};

export default async function CertificadosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  const [talleres, preferido] = await Promise.all([listarTalleres(), tallerIdParaAdmin(sp.taller)]);

  if (talleres === null) {
    return (
      <AdminShell titulo="Certificados">
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      </AdminShell>
    );
  }

  const taller = talleres.find((t) => t.id === preferido) ?? talleres[0];
  if (!taller) {
    return (
      <AdminShell titulo="Certificados">
        <p className={tarjeta}>Todavía no hay talleres.</p>
      </AdminShell>
    );
  }

  const certificados = await listarCertificadosTaller(taller.id);
  const vigentes = (certificados ?? []).filter((c) => !c.revocadoEn).length;

  return (
    <AdminShell
      titulo="Certificados"
      subtitulo={
        <>
          {[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")} · {taller.fechasTexto} ·{" "}
          {ESTADO_ETIQUETA[taller.estado]}
        </>
      }
      acciones={<SelectorTaller talleres={talleres} actual={taller.id} ruta="/admin/certificados" />}
    >
      {certificados === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : certificados.length === 0 ? (
        <p className={`${tarjeta} text-[14.5px] leading-relaxed text-ink`}>
          Todavía no hay certificados en este taller. Se emiten solos cuando el taller está{" "}
          <strong>Finalizado</strong> y la inscripción tiene <strong>100% pagado</strong> y{" "}
          <strong>asistencia</strong> marcada, en{" "}
          <Link href={`/admin/inscritos?taller=${taller.id}`} className="font-semibold text-azure hover:underline">
            Inscritos
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {vigentes > 0 && (
              <Link href={`/admin/certificados/imprimir?taller=${taller.id}`} className={botonPrimario}>
                Imprimir los {vigentes} vigentes en un PDF
              </Link>
            )}
            <Link href={`/admin/inscritos?taller=${taller.id}`} className={botonSecundario}>
              Ir a inscritos
            </Link>
          </div>
          <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
            {certificados.map((c) => (
              <CertificadoFila key={c.id} certificado={c} emitido={fechaLarga(c.emitidoEn)} />
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
