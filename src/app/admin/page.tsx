import type { Metadata } from "next";
import Link from "next/link";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/shell";
import { botonPrimario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { resumenInicio } from "@/lib/inscripciones/repo";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA, ESTADOS_TALLER } from "@/lib/talleres/tipos";
import { nombreCurso } from "@/lib/talleres/vista";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administración · STA",
  robots: { index: false, follow: false },
};

function Cifra({ href, valor, texto }: { href: string; valor: number; texto: string }) {
  return (
    <Link href={href} className={`${tarjeta} block transition-colors duration-200 hover:bg-ice/40`}>
      <p className="text-[32px] leading-none text-navy">{valor}</p>
      <p className="mt-2 text-[13px] text-ink">{texto}</p>
    </Link>
  );
}

export default async function AdminPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const [publico, talleres] = await Promise.all([cargarTallerPublico(), listarTalleres()]);

  if (talleres === null || publico.kind === "sin_conexion") {
    return (
      <AdminShell titulo="Inicio">
        <p className={tarjeta}>
          No se pudo consultar la base de datos. Revisa que SUPABASE_URL y
          SUPABASE_SERVICE_ROLE_KEY estén configuradas.
        </p>
      </AdminShell>
    );
  }

  const tallerId = publico.kind === "ok" ? publico.vista.id : null;
  const resumen = await resumenInicio(tallerId);
  const seats = publico.kind === "ok" ? publico.vista.seats : null;
  const pct = seats && seats.total > 0 ? Math.min(100, Math.round((seats.ocupados / seats.total) * 100)) : 0;

  const conteo = ESTADOS_TALLER.map((e) => ({
    estado: e,
    n: talleres.filter((t) => t.estado === e).length,
  })).filter((c) => c.n > 0);

  return (
    <AdminShell
      titulo="Inicio"
      acciones={
        <Link href="/admin/talleres/nuevo" className={botonPrimario}>
          Nuevo taller
        </Link>
      }
    >
      <section className={tarjeta}>
        <p className="text-[12.5px] font-semibold tracking-[0.08em] text-azure uppercase">
          Taller en la página
        </p>
        {publico.kind === "ok" ? (
          <>
            <h2 className="mt-2 text-[22px] text-navy">{nombreCurso(publico.vista)}</h2>
            <p className="mt-1 text-[14px] text-ink">
              {publico.vista.dates.label} · {publico.vista.venue.name}, {publico.vista.venue.city} ·{" "}
              <strong>{ESTADO_ETIQUETA[publico.vista.estado]}</strong>
            </p>
            {seats && (
              <p className="mt-3 text-[14px] text-ink">
                Cupos: {seats.ocupados}/{seats.total} ocupados ({pct}%) · {seats.libres} libres
              </p>
            )}
            <p className="mt-3 flex flex-wrap gap-4 text-[14px] font-semibold">
              <Link href={`/admin/inscritos?taller=${publico.vista.id}`} className="text-azure hover:underline">
                Inscritos
              </Link>
              <Link href={`/admin/pagos?taller=${publico.vista.id}`} className="text-azure hover:underline">
                Pagos
              </Link>
            </p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-ink">
            Ningún taller visible: la página muestra «Próxima edición pronto».
          </p>
        )}
      </section>

      {resumen && (
        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <Cifra href="/admin/pagos" valor={resumen.comprobantesPorRevisar} texto="comprobantes por revisar" />
          {resumen.pagoIncompleto !== null && tallerId && (
            <Cifra
              href={`/admin/inscritos?taller=${tallerId}`}
              valor={resumen.pagoIncompleto}
              texto="inscritos con pago incompleto en este taller"
            />
          )}
          <Cifra
            href={tallerId ? `/admin/inscritos?taller=${tallerId}&estado=sin_documento` : "/admin/inscritos?estado=sin_documento"}
            valor={resumen.porIdentificar}
            texto="personas por identificar (sin documento)"
          />
        </section>
      )}

      <section className={`${tarjeta} mt-5`}>
        <p className="text-[12.5px] font-semibold tracking-[0.08em] text-azure uppercase">Talleres</p>
        <p className="mt-2 text-[14px] text-ink">
          {conteo.length === 0
            ? "Todavía no hay talleres."
            : conteo.map((c) => `${c.n} ${ESTADO_ETIQUETA[c.estado].toLowerCase()}`).join(" · ")}
        </p>
        <Link href="/admin/talleres" className="mt-3 inline-block text-[14px] font-semibold text-azure hover:underline">
          Ver todos
        </Link>
      </section>
    </AdminShell>
  );
}
