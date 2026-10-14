"use client";

import { startTransition, useActionState, useState, type InputHTMLAttributes } from "react";
import { guardarTaller, type AccionState } from "@/app/admin/talleres/actions";
import { PORCENTAJES_PAGO, type Taller, type Tarifa } from "@/lib/talleres/tipos";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass, tarjeta } from "./ui";

const inicial: AccionState = { status: "idle" };

type FilaTarifa = Tarifa & { clave: string };

const TARIFA_VACIA: Tarifa = { id: "", nombre: "", descripcion: "", precio: 0, destacada: false };

/**
 * Alta y edición de un taller.
 *
 * Se envía con `onSubmit` + `startTransition` y no con `<form action>`: React
 * 19 vacía los campos no controlados después de cada envío por `action`, y un
 * error de validación borraría todo lo escrito.
 */
export function TallerForm({ taller }: { taller?: Taller }) {
  const [state, action, pending] = useActionState(guardarTaller, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const [tarifas, setTarifas] = useState<FilaTarifa[]>(() =>
    (taller?.tarifas.length
      ? taller.tarifas
      : [{ ...TARIFA_VACIA, nombre: "Cupo General", destacada: true }]
    ).map((t, i) => ({ ...t, clave: `t${i}` })),
  );

  function campo(
    name: string,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> & { ayuda?: string } = {},
  ) {
    const { ayuda, ...rest } = props;
    return (
      <div>
        <label htmlFor={name} className={labelClass}>
          {label}
        </label>
        <input
          id={name}
          name={name}
          className={inputClass}
          aria-invalid={Boolean(errores[name])}
          {...rest}
        />
        {ayuda && !errores[name] && <p className="mt-1.5 text-[12px] text-ink-soft">{ayuda}</p>}
        {errores[name] && <p className={errorClass}>{errores[name]}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-5"
    >
      {taller && <input type="hidden" name="id" value={taller.id} />}

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Curso</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Curso</h2>
        {campo("titulo", "Título", { defaultValue: taller?.titulo, required: true })}
        {campo("titulo_acento", "Acento del título (opcional)", {
          defaultValue: taller?.tituloAcento ?? "",
          ayuda: "Se pinta en azul: «+ Sedación TCI».",
        })}
        {campo("modalidad", "Modalidad", { defaultValue: taller?.modalidad ?? "Taller presencial" })}
        {campo("slug", "Identificador (slug)", {
          defaultValue: taller?.slug ?? "",
          readOnly: Boolean(taller),
          ayuda: taller
            ? "No se cambia: las reservas apuntan a este identificador."
            : "Vacío = taller-AAAA-MM según la fecha de inicio.",
        })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-3`}>
        <legend className="sr-only">Fechas</legend>
        <h2 className="text-[18px] text-navy sm:col-span-3">Fechas</h2>
        {campo("fecha_inicio", "Inicio", { type: "date", defaultValue: taller?.fechaInicio, required: true })}
        {campo("fecha_fin", "Fin", { type: "date", defaultValue: taller?.fechaFin, required: true })}
        {campo("fechas_texto", "Texto de fechas (opcional)", {
          defaultValue: taller?.fechasTexto ?? "",
          ayuda: "Vacío = se genera: «Octubre 24 y 25, 2026».",
        })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Sede</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Sede</h2>
        {campo("sede_nombre", "Sede", { defaultValue: taller?.sedeNombre, required: true })}
        {campo("ciudad", "Ciudad", { defaultValue: taller?.ciudad, required: true })}
        {campo("region", "Estado / departamento (opcional)", { defaultValue: taller?.region ?? "" })}
        {campo("pais", "País", { defaultValue: taller?.pais, required: true })}
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-3`}>
        <legend className="sr-only">Cupos y certificado</legend>
        <h2 className="text-[18px] text-navy sm:col-span-3">Cupos y certificado</h2>
        {campo("cupos_total", "Cupos", {
          type: "number",
          min: 0,
          max: 1000,
          defaultValue: taller?.cuposTotal ?? 20,
          required: true,
        })}
        {campo("horas", "Horas académicas (opcional)", {
          type: "number",
          min: 1,
          max: 500,
          defaultValue: taller?.horas ?? "",
        })}
        {campo("aval", "Aval (opcional)", { defaultValue: taller?.aval ?? "" })}
      </fieldset>

      <fieldset className={`${tarjeta} flex flex-col gap-4`}>
        <legend className="sr-only">Pagos</legend>
        <h2 className="text-[18px] text-navy">Pagos</h2>

        <div>
          <p className={labelClass}>Porcentajes que se aceptan</p>
          <div className="flex flex-wrap gap-4">
            {PORCENTAJES_PAGO.map((p) => (
              <label key={p} className="flex items-center gap-2 text-[14px] text-navy">
                <input
                  type="checkbox"
                  name="porcentajes_pago"
                  value={p}
                  defaultChecked={p === 100 || (taller?.porcentajesPago ?? [50, 100]).includes(p)}
                  disabled={p === 100}
                />
                {p}%
              </label>
            ))}
            {/* Un checkbox deshabilitado no se envía: el 100 va oculto. */}
            <input type="hidden" name="porcentajes_pago" value="100" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {campo("moneda", "Moneda", { defaultValue: taller?.moneda ?? "COP", maxLength: 3 })}
          <label className="flex items-center gap-2 self-end pb-3 text-[14px] text-navy">
            <input type="checkbox" name="precios_publicados" defaultChecked={taller?.preciosPublicados} />
            Mostrar precios en la página
          </label>
        </div>

        <div>
          <p className={labelClass}>Tarifas (la marcada es la que se aplica a las reservas web)</p>
          {errores.tarifas && <p className={errorClass}>{errores.tarifas}</p>}
          <div className="flex flex-col gap-3">
            {tarifas.map((t, i) => (
              <div key={t.clave} className="grid items-start gap-2 sm:grid-cols-[auto_1fr_1.4fr_9rem_auto]">
                <input type="hidden" name="tarifa_id" value={t.id} />
                <input
                  type="radio"
                  name="tarifa_destacada"
                  value={i}
                  defaultChecked={t.destacada}
                  aria-label="Tarifa por defecto"
                  className="mt-4"
                />
                <input name="tarifa_nombre" defaultValue={t.nombre} placeholder="Nombre" className={inputClass} />
                <input
                  name="tarifa_descripcion"
                  defaultValue={t.descripcion}
                  placeholder="Descripción"
                  className={inputClass}
                />
                <div>
                  <input
                    name="tarifa_precio"
                    type="number"
                    min={0}
                    defaultValue={t.precio}
                    placeholder="Precio"
                    aria-invalid={Boolean(errores[`tarifa_precio_${i}`])}
                    className={inputClass}
                  />
                  {errores[`tarifa_precio_${i}`] && (
                    <p className={errorClass}>{errores[`tarifa_precio_${i}`]}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTarifas((ts) => ts.filter((x) => x.clave !== t.clave))}
                  className={botonSecundario}
                  disabled={tarifas.length === 1}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setTarifas((ts) => [...ts, { ...TARIFA_VACIA, clave: `t${Date.now()}` }])
            }
            className={`${botonSecundario} mt-3`}
          >
            Añadir tarifa
          </button>
        </div>
      </fieldset>

      <fieldset className={`${tarjeta} grid gap-4 sm:grid-cols-2`}>
        <legend className="sr-only">Imagen y firma</legend>
        <h2 className="text-[18px] text-navy sm:col-span-2">Imagen y firma del certificado</h2>
        {campo("foto_principal", "Foto principal (opcional)", {
          defaultValue: taller?.fotoPrincipal ?? "",
          ayuda: "Ruta en /public, p. ej. /assets/taller-bomba-tci.webp. Vacío = la de siempre.",
        })}
        {campo("foto_principal_alt", "Descripción de la foto", { defaultValue: taller?.fotoPrincipalAlt ?? "" })}
        {campo("firma_nombre", "Firma: nombre", { defaultValue: taller?.firmaNombre ?? "" })}
        {campo("firma_cargo", "Firma: cargo", { defaultValue: taller?.firmaCargo ?? "" })}
        {campo("firma_documento", "Firma: documento", { defaultValue: taller?.firmaDocumento ?? "" })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={botonPrimario}>
          {pending ? "Guardando…" : taller ? "Guardar cambios" : "Crear taller"}
        </button>
        {state.status === "error" && state.message && (
          <p role="alert" className="text-[13.5px] text-red-600">
            {state.message}
          </p>
        )}
        {state.status === "ok" && (
          <p role="status" className="text-[13.5px] text-emerald-700">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
