"use client";

import { useActionState } from "react";
import { revocarAccion } from "@/app/admin/certificados/actions";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { documentoImpreso } from "@/lib/certificados/hoja";
import type { Certificado } from "@/lib/certificados/tipos";
import { Mensaje } from "./mensaje";
import { botonSecundario } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

/** `emitido` llega formateado del servidor: así no hay diferencias de hidratación. */
export function CertificadoFila({ certificado: c, emitido }: { certificado: Certificado; emitido: string }) {
  const [state, action, pending] = useActionState(revocarAccion, inicial);
  const vigente = !c.revocadoEn;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-navy">{c.nombre}</p>
        <p className="text-[12.5px] text-ink-soft">
          {documentoImpreso(c.tipoDocumento, c.documento) || "Sin documento"} ·{" "}
          <span className="font-mono">{c.codigo}</span> · emitido el {emitido}
        </p>
        <p className={`mt-1 text-[12.5px] font-semibold ${vigente ? "text-emerald-700" : "text-red-700"}`}>
          {vigente
            ? "Vigente"
            : c.revocadoManual
              ? "Revocado a mano"
              : "Revocado: ya no cumple (pago, asistencia o estado del taller)"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/certificado/${c.codigo}`} target="_blank" rel="noopener" className={botonSecundario}>
          Ver / descargar
        </a>
        <a
          href={`/certificado/verificar/${c.codigo}`}
          target="_blank"
          rel="noopener"
          className="text-[13px] font-semibold text-azure hover:underline"
        >
          Verificación
        </a>
        {/* Uno revocado porque ya no cumple se arregla en Inscritos (pago o
            asistencia), no aquí. */}
        {(vigente || c.revocadoManual) && (
          <form
            action={action}
            onSubmit={(e) => {
              if (vigente && !confirm(`¿Revocar el certificado de ${c.nombre}? Dejará de acreditar la participación.`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="revocar" value={vigente ? "si" : "no"} />
            <button
              type="submit"
              disabled={pending}
              className={vigente ? `${botonSecundario} border-red-300 text-red-700 hover:border-red-500` : botonSecundario}
            >
              {vigente ? "Revocar" : "Reactivar"}
            </button>
          </form>
        )}
        <Mensaje state={state} />
      </div>
    </li>
  );
}
