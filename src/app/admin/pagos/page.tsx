import type { Metadata } from "next";
import { ComprobanteRevision } from "@/components/admin/comprobante-revision";
import { LoginScreen } from "@/components/admin/login-screen";
import { AdminShell } from "@/components/admin/shell";
import { botonSecundario, inputClass, labelClass, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { esUuid } from "@/lib/inscripciones/formulario";
import { listarComprobantes } from "@/lib/inscripciones/repo";
import { ZONA_HORARIA } from "@/lib/talleres/reglas";
import { listarTalleres } from "@/lib/talleres/repo";

// Sin esto el build (que no tiene CERTIFICADOS_PASSWORD) la congela como 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagos · STA",
  robots: { index: false, follow: false },
};

const FILTRO_ESTADO = [
  { valor: "pending", etiqueta: "Por revisar" },
  { valor: "verified", etiqueta: "Verificados" },
  { valor: "rejected", etiqueta: "Rechazados" },
  { valor: "todos", etiqueta: "Todos" },
] as const;

type Busqueda = { estado?: string; taller?: string; inscripcion?: string };

export default async function PagosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  // Desde Inscritos se llega con una inscripción: ahí interesan todos sus
  // comprobantes (también los ya verificados o rechazados).
  const inscripcionId = typeof sp.inscripcion === "string" && esUuid(sp.inscripcion) ? sp.inscripcion : null;
  const estado =
    FILTRO_ESTADO.find((e) => e.valor === sp.estado)?.valor ?? (inscripcionId ? "todos" : "pending");
  const tallerId = typeof sp.taller === "string" && esUuid(sp.taller) ? sp.taller : null;
  const [talleres, comprobantes] = await Promise.all([
    listarTalleres(),
    listarComprobantes({ estado, tallerId, inscripcionId }),
  ]);
  const formato = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONA_HORARIA,
  });

  return (
    <AdminShell
      titulo="Pagos"
      subtitulo="Comprobantes subidos desde la página. Verificar suma su porcentaje a la inscripción."
    >
      <form action="/admin/pagos" method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-[12rem]">
          <label htmlFor="estado" className={labelClass}>
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={estado} className={inputClass}>
            {FILTRO_ESTADO.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[22rem] max-w-full">
          <label htmlFor="taller" className={labelClass}>
            Taller
          </label>
          <select id="taller" name="taller" defaultValue={tallerId ?? ""} className={inputClass}>
            <option value="">Todos los talleres</option>
            {(talleres ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")} · {t.fechasTexto}
              </option>
            ))}
          </select>
        </div>
        {inscripcionId && <input type="hidden" name="inscripcion" value={inscripcionId} />}
        <button type="submit" className={botonSecundario}>
          Filtrar
        </button>
      </form>

      {inscripcionId && (
        <p className="mb-5 text-[13.5px] text-ink">
          Mostrando los comprobantes de{" "}
          {comprobantes?.[0] ? (
            <>
              <strong>{comprobantes[0].personaNombre}</strong> ·{" "}
              <span className="font-mono">{comprobantes[0].referencia}</span>
            </>
          ) : (
            "una inscripción"
          )}
          .{" "}
          <a href="/admin/pagos" className="font-semibold text-azure hover:underline">
            Ver todos los pagos
          </a>
        </p>
      )}

      {comprobantes === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : comprobantes.length === 0 ? (
        <p className={tarjeta}>No hay comprobantes con ese filtro.</p>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
          {comprobantes.map((c) => (
            <ComprobanteRevision key={c.id} c={c} fecha={formato.format(new Date(c.creadoEn))} />
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
