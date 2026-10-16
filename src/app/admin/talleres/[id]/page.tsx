import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { TallerAcciones } from "@/components/admin/taller-acciones";
import { TallerForm } from "@/components/admin/taller-form";
import { tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { MENSAJES_ERROR } from "@/lib/talleres/errores";
import { contarInscripciones, obtenerDisponibilidad, obtenerTaller } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar taller · STA",
  robots: { index: false, follow: false },
};

export default async function EditarTallerPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const { id } = await params;
  const r = await obtenerTaller(id);
  if (!r.ok && r.motivo === "no_encontrado") notFound();
  if (!r.ok) {
    return (
      <AdminShell titulo="Taller">
        <p className={tarjeta}>{MENSAJES_ERROR[r.motivo]}</p>
      </AdminShell>
    );
  }

  const taller = r.valor;
  const [reservas, disp] = await Promise.all([
    contarInscripciones(taller.id),
    obtenerDisponibilidad(taller.slug),
  ]);

  return (
    <AdminShell
      titulo={[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")}
      subtitulo={
        <>
          {ESTADO_ETIQUETA[taller.estado]} · {taller.fechasTexto}
          {disp && ` · ${disp.ocupados}/${disp.total} cupos ocupados`} ·{" "}
          <Link href={`/admin/certificados?taller=${taller.slug}`} className="text-azure hover:underline">
            Certificados
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <TallerAcciones taller={taller} reservas={reservas} />
        <TallerForm key={taller.id} taller={taller} slugEditable={reservas === 0} />
      </div>
    </AdminShell>
  );
}
