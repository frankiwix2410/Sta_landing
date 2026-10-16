"use client";

import { useActionState } from "react";
import type { EstadoAccion } from "@/app/admin/inscritos/actions";
import { revisarAccion } from "@/app/admin/pagos/actions";
import { ESTADO_COMPROBANTE_ETIQUETA, type ComprobanteAdmin } from "@/lib/inscripciones/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, inputClass } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

const COLOR: Record<ComprobanteAdmin["estado"], string> = {
  pending: "bg-sand text-navy",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-50 text-red-700",
};

/** `fecha` llega formateada del servidor: así no hay diferencias de hidratación. */
export function ComprobanteRevision({ c, fecha }: { c: ComprobanteAdmin; fecha: string }) {
  const [state, action, pending] = useActionState(revisarAccion, inicial);
  const archivo = `/admin/pagos/archivo/${c.id}`;
  const esImagen = /^image\/(jpeg|png|webp)$/.test(c.fileType);

  return (
    <li className="grid gap-4 px-5 py-5 sm:grid-cols-[8rem_1fr]">
      <a href={archivo} target="_blank" rel="noopener" className="block" title="Abrir el comprobante">
        {esImagen ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada y privada; next/image la cachearía
          <img src={archivo} alt={`Comprobante de ${c.personaNombre}`} className="size-32 rounded-lg object-cover" />
        ) : (
          <span className="flex size-32 items-center justify-center rounded-lg bg-cream text-[12px] font-semibold text-navy">
            {c.fileType === "application/pdf" ? "PDF" : "HEIC"} · abrir
          </span>
        )}
      </a>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[15px] font-semibold text-navy">{c.personaNombre}</p>
          <span className={`rounded-full px-3 py-0.5 text-[12px] font-semibold ${COLOR[c.estado]}`}>
            {ESTADO_COMPROBANTE_ETIQUETA[c.estado]}
          </span>
        </div>
        <p className="text-[12.5px] text-ink-soft">
          {c.personaDocumento ? `${c.personaTipoDocumento} ${c.personaDocumento}` : "Por identificar"} ·{" "}
          <span className="font-mono">{c.referencia}</span> · {c.tallerNombre}
        </p>
        <p className="mt-1 text-[13.5px] text-ink">
          Cubre <strong>{c.porcentaje}%</strong> · subido el {fecha} · la inscripción lleva{" "}
          {c.porcentajePagado}%
          {c.porcentajeManual && " (fijado a mano: verificar no lo cambia)"}
        </p>
        {c.notas && <p className="mt-1 text-[13px] text-ink">«{c.notas}»</p>}

        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="id" value={c.id} />
          <textarea
            name="nota"
            defaultValue={c.notaAdmin ?? ""}
            rows={2}
            maxLength={500}
            placeholder="Nota (opcional): motivo del rechazo, banco, fecha…"
            aria-label="Nota del admin"
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-3">
            {c.estado !== "verified" && (
              <button type="submit" name="estado" value="verified" disabled={pending} className={botonPrimario}>
                Verificar
              </button>
            )}
            {c.estado !== "rejected" && (
              <button
                type="submit"
                name="estado"
                value="rejected"
                disabled={pending}
                className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
              >
                Rechazar
              </button>
            )}
            {c.estado !== "pending" && (
              <button type="submit" name="estado" value="pending" disabled={pending} className={botonSecundario}>
                Volver a por revisar
              </button>
            )}
            <Mensaje state={state} />
          </div>
        </form>
      </div>
    </li>
  );
}
