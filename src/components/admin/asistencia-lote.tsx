"use client";

import { useActionState } from "react";
import { asistencia, type EstadoAccion } from "@/app/admin/inscritos/actions";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario } from "./ui";

const inicial: EstadoAccion = { status: "idle" };
const SELECTOR = 'input[name="ids"][form="asistencia-lote"]';

/**
 * Asistencia en lote. Las casillas viven en cada fila (que tiene sus propios
 * formularios y no puede anidar este) y se asocian con el atributo
 * `form="asistencia-lote"`.
 */
export function AsistenciaLote() {
  const [state, action, pending] = useActionState(asistencia, inicial);

  function seleccionar(valor: boolean) {
    document.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((c) => {
      c.checked = valor;
    });
  }

  return (
    <form id="asistencia-lote" action={action} className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => seleccionar(true)} className={botonSecundario}>
        Seleccionar todos
      </button>
      <button type="button" onClick={() => seleccionar(false)} className={botonSecundario}>
        Ninguno
      </button>
      <button type="submit" name="accion" value="marcar" disabled={pending} className={botonPrimario}>
        Marcar asistencia
      </button>
      <button type="submit" name="accion" value="quitar" disabled={pending} className={botonSecundario}>
        Quitar asistencia
      </button>
      <Mensaje state={state} />
    </form>
  );
}
