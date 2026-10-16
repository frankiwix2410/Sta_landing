"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import {
  buscarPersonaAdmin,
  inscribirManual,
  type BusquedaPersona,
  type EstadoAccion,
} from "@/app/admin/inscritos/actions";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_ETIQUETA } from "@/lib/inscripciones/tipos";
import type { Tarifa } from "@/lib/talleres/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass } from "./ui";

const busquedaInicial: BusquedaPersona = { status: "idle" };
const inicial: EstadoAccion = { status: "idle" };

/** Envía sin que React vacíe el formulario, que es lo que hace tras cada `action`. */
function enviarCon(accion: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => accion(fd));
  };
}

/**
 * Inscribir a mano: cupos apartados por WhatsApp. Primero el documento; si la
 * persona ya existe, su ficha se rellena sola y aquí se puede corregir.
 */
export function InscribirForm({
  tallerId,
  tarifas,
  lleno,
}: {
  tallerId: string;
  tarifas: Tarifa[];
  lleno: boolean;
}) {
  const [busqueda, buscar, buscando] = useActionState(buscarPersonaAdmin, busquedaInicial);
  const [state, inscribir, inscribiendo] = useActionState(inscribirManual, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const persona = busqueda.status === "listo" ? busqueda.persona : null;
  const tarifaPorDefecto = tarifas.find((t) => t.destacada)?.id ?? tarifas[0]?.id ?? "";

  const campo = (name: string, label: string, valor: string | null | undefined, tipo = "text", requerido = false) => (
    <div>
      <label htmlFor={`inscribir-${name}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`inscribir-${name}`}
        name={name}
        type={tipo}
        required={requerido}
        defaultValue={valor ?? ""}
        aria-invalid={Boolean(errores[name])}
        className={inputClass}
      />
      {errores[name] && <p className={errorClass}>{errores[name]}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={enviarCon(buscar)} className="flex flex-wrap items-end gap-3">
        <div className="w-[13rem]">
          <label htmlFor="buscar-tipo" className={labelClass}>
            Tipo
          </label>
          <select id="buscar-tipo" name="tipo_documento" defaultValue="CC" className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[14rem]">
          <label htmlFor="buscar-documento" className={labelClass}>
            Documento
          </label>
          <input id="buscar-documento" name="documento" required maxLength={30} className={inputClass} />
        </div>
        <button type="submit" disabled={buscando} className={botonSecundario}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {busqueda.status === "error" && (
          <p role="alert" className="text-[13px] text-red-600">
            {busqueda.message}
          </p>
        )}
      </form>

      {busqueda.status === "listo" && (
        <form
          key={`${busqueda.documento}-${persona?.id ?? "nueva"}`}
          onSubmit={enviarCon(inscribir)}
          className="flex flex-col gap-4 border-t border-navy/10 pt-5"
        >
          <input type="hidden" name="taller_id" value={tallerId} />
          <input type="hidden" name="documento" value={busqueda.documento} />
          <input type="hidden" name="tipo_documento" value={busqueda.tipoDocumento} />
          <p className="text-[13.5px] text-ink">
            <strong>
              {busqueda.tipoDocumento} {busqueda.documento}
            </strong>{" "}
            · {persona ? "ya existe: se usa su ficha (puedes corregirla aquí)." : "persona nueva."}
          </p>
          {errores.documento && <p className={errorClass}>{errores.documento}</p>}

          {campo("nombre", "Nombre (sale en el certificado)", persona?.nombre, "text", true)}
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("telefono", "WhatsApp (opcional)", persona?.telefono, "tel")}
            {campo("email", "Email (opcional)", persona?.email, "email")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {campo("ciudad", "Ciudad (opcional)", persona?.ciudad)}
            {campo("profesion", "Profesión (opcional)", persona?.profesion)}
          </div>

          {tarifas.length > 1 ? (
            <div>
              <label htmlFor="inscribir-tarifa" className={labelClass}>
                Tarifa
              </label>
              <select id="inscribir-tarifa" name="tarifa_id" defaultValue={tarifaPorDefecto} className={inputClass}>
                {tarifas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="tarifa_id" value={tarifaPorDefecto} />
          )}

          <div>
            <label htmlFor="inscribir-notas" className={labelClass}>
              Notas (opcional)
            </label>
            <textarea
              id="inscribir-notas"
              name="notas"
              rows={2}
              maxLength={800}
              placeholder="Apartó cupo por WhatsApp el…"
              className={inputClass}
            />
          </div>

          {(lleno || errores.forzar) && (
            <div>
              <label className="flex items-center gap-2 text-[13.5px] text-navy">
                <input type="checkbox" name="forzar" />
                Inscribir aunque supere el cupo
              </label>
              {errores.forzar && <p className={errorClass}>{errores.forzar}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={inscribiendo} className={botonPrimario}>
              {inscribiendo ? "Inscribiendo…" : "Inscribir"}
            </button>
            <Mensaje state={state} />
          </div>
        </form>
      )}
    </div>
  );
}
