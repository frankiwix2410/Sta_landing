"use client";

import { useActionState } from "react";
import { cambiarEstado, duplicar, eliminar, type AccionState } from "@/app/admin/talleres/actions";
import { ESTADO_ETIQUETA, ESTADOS_TALLER, type Taller } from "@/lib/talleres/tipos";
import { botonPrimario, botonSecundario, inputClass, tarjeta } from "./ui";
import { Mensaje } from "./mensaje";

const inicial: AccionState = { status: "idle" };

export function TallerAcciones({ taller, reservas }: { taller: Taller; reservas: number | null }) {
  const [estadoState, estadoAction, estadoPending] = useActionState(cambiarEstado, inicial);
  const [dupState, dupAction, dupPending] = useActionState(duplicar, inicial);
  const [delState, delAction, delPending] = useActionState(eliminar, inicial);

  return (
    <section className={`${tarjeta} flex flex-col gap-5`}>
      <form action={estadoAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={taller.id} />
        <div>
          <label htmlFor="estado" className="mb-1.5 block text-[12.5px] font-semibold text-navy">
            Estado
          </label>
          {/* `key` resetea el select cuando el estado cambia en el servidor. */}
          <select key={taller.estado} id="estado" name="estado" defaultValue={taller.estado} className={inputClass}>
            {ESTADOS_TALLER.map((e) => (
              <option key={e} value={e}>
                {ESTADO_ETIQUETA[e]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={estadoPending} className={botonPrimario}>
          {estadoPending ? "Cambiando…" : "Cambiar estado"}
        </button>
        <Mensaje state={estadoState} />
      </form>

      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Borrador: no se ve. Publicado: abierto a reservas y pagos. Cerrado: visible como
        agotado, sin pagos. Finalizado: ya ocurrió. Archivado: oculto, conserva el historial.
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-5">
        <form action={dupAction}>
          <input type="hidden" name="id" value={taller.id} />
          <button type="submit" disabled={dupPending} className={botonSecundario}>
            {dupPending ? "Duplicando…" : "Duplicar para nueva edición"}
          </button>
        </form>
        <Mensaje state={dupState} />

        {reservas === 0 ? (
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm("¿Eliminar este taller? No se puede deshacer.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={taller.id} />
            <button
              type="submit"
              disabled={delPending}
              className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
            >
              {delPending ? "Eliminando…" : "Eliminar"}
            </button>
          </form>
        ) : (
          <p className="text-[12.5px] text-ink-soft">
            {reservas === null
              ? "No se pudo comprobar si tiene reservas."
              : `Tiene ${reservas} ${reservas === 1 ? "reserva" : "reservas"}: archívalo en lugar de eliminarlo.`}
          </p>
        )}
        <Mensaje state={delState} />
      </div>
    </section>
  );
}
