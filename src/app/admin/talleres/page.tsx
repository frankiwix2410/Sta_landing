import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { botonPrimario, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { listarDisponibilidades, listarTalleres } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talleres · STA",
  robots: { index: false, follow: false },
};

export default async function TalleresPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const [talleres, disponibilidad] = await Promise.all([listarTalleres(), listarDisponibilidades()]);

  return (
    <AdminShell
      titulo="Talleres"
      acciones={
        <Link href="/admin/talleres/nuevo" className={botonPrimario}>
          Nuevo taller
        </Link>
      }
    >
      {talleres === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : talleres.length === 0 ? (
        <p className={tarjeta}>Todavía no hay talleres. Crea el primero.</p>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
          {talleres.map((t) => {
            const d = disponibilidad.get(t.slug);
            const pct = d && d.total > 0 ? Math.min(100, Math.round((d.ocupados / d.total) * 100)) : 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/talleres/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 hover:bg-cream/60"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-navy">
                      {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-[12.5px] text-ink-soft">
                      {t.fechasTexto} · {t.ciudad} · <span className="font-mono">{t.slug}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {d && (
                      <div className="w-[140px]">
                        <div className="h-1.5 overflow-hidden rounded-full bg-navy/10">
                          <div className="h-full bg-azure" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[11.5px] text-ink-soft">
                          {d.ocupados}/{d.total} · {pct}%
                        </p>
                      </div>
                    )}
                    <span className="rounded-full bg-ice px-3 py-1 text-[12px] font-semibold text-navy">
                      {ESTADO_ETIQUETA[t.estado]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
