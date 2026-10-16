import type { Metadata } from "next";
import Link from "next/link";
import { AsistenciaLote } from "@/components/admin/asistencia-lote";
import { InscribirForm } from "@/components/admin/inscribir-form";
import { InscritoFila, type OpcionPersona } from "@/components/admin/inscrito-fila";
import { LoginScreen } from "@/components/admin/login-screen";
import { SelectorTaller } from "@/components/admin/selector-taller";
import { AdminShell } from "@/components/admin/shell";
import { botonSecundario, inputClass, labelClass, tarjeta } from "@/components/admin/ui";
import { puertaAdmin } from "@/lib/admin-auth";
import { FILTRO_ETIQUETA, FILTROS_ESTADO, filtrarInscritos, leerFiltro } from "@/lib/inscripciones/filtros";
import { estadoPago } from "@/lib/inscripciones/pagos";
import { listarInscritos } from "@/lib/inscripciones/repo";
import { tallerIdParaAdmin } from "@/lib/talleres/publico";
import { listarTalleres, obtenerDisponibilidad } from "@/lib/talleres/repo";
import { ESTADO_ETIQUETA } from "@/lib/talleres/tipos";

// Sin esto el build (que no tiene CERTIFICADOS_PASSWORD) la congela como 404.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inscritos · STA",
  robots: { index: false, follow: false },
};

type Busqueda = { taller?: string; q?: string; estado?: string };

export default async function InscritosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const sp = await searchParams;
  const [talleres, preferido] = await Promise.all([listarTalleres(), tallerIdParaAdmin(sp.taller)]);

  if (talleres === null) {
    return (
      <AdminShell titulo="Inscritos">
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      </AdminShell>
    );
  }

  const taller = talleres.find((t) => t.id === preferido) ?? talleres[0];
  if (!taller) {
    return (
      <AdminShell titulo="Inscritos">
        <p className={tarjeta}>Todavía no hay talleres.</p>
      </AdminShell>
    );
  }

  const [inscritos, disp] = await Promise.all([listarInscritos(taller.id), obtenerDisponibilidad(taller.slug)]);
  const filtro = leerFiltro(sp);
  const lista = inscritos ?? [];
  const visibles = filtrarInscritos(lista, filtro);
  const otros: OpcionPersona[] = lista.map((i) => ({
    personaId: i.persona.id,
    etiqueta: `${i.persona.nombre} · ${i.persona.documento ?? "por identificar"} · ${i.referencia}`,
  }));
  const activos = lista.filter((i) => !i.cancelada);
  const pagados = activos.filter((i) => estadoPago(i) === "pagado").length;
  const asistieron = activos.filter((i) => i.asistio).length;

  return (
    <AdminShell
      titulo="Inscritos"
      subtitulo={
        <>
          {[taller.titulo, taller.tituloAcento].filter(Boolean).join(" ")} · {taller.fechasTexto} ·{" "}
          {ESTADO_ETIQUETA[taller.estado]}
          {disp && ` · ${disp.ocupados}/${disp.total} cupos`}
        </>
      }
      acciones={<SelectorTaller talleres={talleres} actual={taller.id} ruta="/admin/inscritos" />}
    >
      <details className={`${tarjeta} mb-5`}>
        <summary className="cursor-pointer text-[15px] font-semibold text-navy">Inscribir a mano</summary>
        <div className="mt-4">
          <InscribirForm tallerId={taller.id} tarifas={taller.tarifas} lleno={disp ? disp.libres <= 0 : false} />
        </div>
      </details>

      <form action="/admin/inscritos" method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="taller" value={taller.id} />
        <div className="w-[18rem] max-w-full">
          <label htmlFor="q" className={labelClass}>
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filtro.q}
            placeholder="Nombre, documento, email o referencia"
            className={inputClass}
          />
        </div>
        <div className="w-[12rem]">
          <label htmlFor="estado" className={labelClass}>
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={filtro.estado} className={inputClass}>
            {FILTROS_ESTADO.map((e) => (
              <option key={e} value={e}>
                {FILTRO_ETIQUETA[e]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={botonSecundario}>
          Filtrar
        </button>
        {(filtro.q || filtro.estado !== "todos") && (
          <Link
            href={`/admin/inscritos?taller=${taller.id}`}
            className="text-[13px] font-semibold text-azure hover:underline"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {inscritos === null ? (
        <p className={tarjeta}>No se pudo consultar la base de datos.</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-soft">
            {activos.length} activos · {pagados} con el 100% · {asistieron} con asistencia
            {lista.length > activos.length && ` · ${lista.length - activos.length} canceladas`}
          </p>
          <div className="mb-3">
            <AsistenciaLote tallerId={taller.id} />
          </div>
          {visibles.length === 0 ? (
            <p className={tarjeta}>
              {lista.length === 0 ? "Nadie inscrito todavía." : "Nadie coincide con el filtro."}
            </p>
          ) : (
            <ul className="divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
              {visibles.map((i) => (
                <InscritoFila key={i.id} inscrito={i} otros={otros} />
              ))}
            </ul>
          )}
        </>
      )}
    </AdminShell>
  );
}
