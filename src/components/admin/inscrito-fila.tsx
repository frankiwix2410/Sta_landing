"use client";

import { startTransition, useActionState, type InputHTMLAttributes } from "react";
import {
  ajustarPorcentajeAccion,
  asistencia,
  cancelarAccion,
  eliminarAccion,
  fusionarAccion,
  guardarPersona,
  type EstadoAccion,
} from "@/app/admin/inscritos/actions";
import { estadoPago } from "@/lib/inscripciones/pagos";
import {
  ESTADO_PAGO_ETIQUETA,
  ORIGEN_ETIQUETA,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_ETIQUETA,
  type EstadoPago,
  type Inscrito,
} from "@/lib/inscripciones/tipos";
import { Mensaje } from "./mensaje";
import { botonPrimario, botonSecundario, errorClass, inputClass, labelClass } from "./ui";

const inicial: EstadoAccion = { status: "idle" };

export type OpcionPersona = { personaId: string; etiqueta: string };

const COLOR_ESTADO: Record<EstadoPago, string> = {
  pendiente: "bg-sand text-navy",
  abonado: "bg-ice text-navy",
  pagado: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-red-50 text-red-700",
};

export function InscritoFila({ inscrito: i, otros }: { inscrito: Inscrito; otros: OpcionPersona[] }) {
  const estado = estadoPago(i);
  const [asisState, asisAction, asisPending] = useActionState(asistencia, inicial);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <input
          type="checkbox"
          name="ids"
          value={i.id}
          form="asistencia-lote"
          aria-label={`Seleccionar a ${i.persona.nombre}`}
          className="mt-1.5 accent-azure"
        />
        <div className="min-w-[220px] flex-1">
          <p className="text-[15px] font-semibold text-navy">{i.persona.nombre}</p>
          <p className="text-[12.5px] text-ink-soft">
            {i.persona.documento ? (
              `${i.persona.tipoDocumento} ${i.persona.documento}`
            ) : (
              <span className="font-semibold text-red-700">Por identificar</span>
            )}
            {[i.persona.telefono, i.persona.email]
              .filter(Boolean)
              .map((c) => ` · ${c}`)
              .join("")}
          </p>
          <p className="text-[12px] text-ink-soft">
            <span className="font-mono">{i.referencia}</span> · {i.tarifaNombre} · {ORIGEN_ETIQUETA[i.origen]}
          </p>
          {i.certificado && (
            <p className="text-[12px]">
              Certificado{" "}
              <a
                href={`/certificado/${i.certificado.codigo}`}
                target="_blank"
                rel="noopener"
                className="font-mono text-azure hover:underline"
              >
                {i.certificado.codigo}
              </a>
              {i.certificado.revocado && <span className="ml-1 text-red-700">(revocado)</span>}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${COLOR_ESTADO[estado]}`}>
            {ESTADO_PAGO_ETIQUETA[estado]} · {i.porcentajePagado}%
          </span>
          {i.porcentajeEnRevision > 0 && (
            <p className="mt-1 text-[11.5px] text-ink-soft">{i.porcentajeEnRevision}% por revisar</p>
          )}
          {i.porcentajeManual && <p className="mt-1 text-[11.5px] text-ink-soft">fijado a mano</p>}
        </div>
        <form action={asisAction}>
          <input type="hidden" name="taller_id" value={i.tallerId} />
          <input type="hidden" name="ids" value={i.id} />
          <input type="hidden" name="accion" value={i.asistio ? "quitar" : "marcar"} />
          <button
            type="submit"
            disabled={asisPending}
            className={i.asistio ? `${botonSecundario} border-emerald-400 text-emerald-800` : botonSecundario}
          >
            {i.asistio ? "✓ Asistió" : "Marcar asistencia"}
          </button>
        </form>
      </div>
      <Mensaje state={asisState} />
      {i.notas && <p className="mt-2 text-[12.5px] whitespace-pre-line text-ink">{i.notas}</p>}

      <details className="mt-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-azure">Gestionar</summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <FichaForm inscrito={i} />
          <div className="flex flex-col gap-5">
            <PorcentajeForm inscrito={i} />
            <CancelarForm inscrito={i} />
            <FusionarForm inscrito={i} otros={otros} />
            <EliminarForm inscrito={i} />
          </div>
        </div>
      </details>
    </li>
  );
}

function FichaForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(guardarPersona, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const p = i.persona;

  const campo = (
    name: string,
    label: string,
    valor: string | null,
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={`${name}-${i.id}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`${name}-${i.id}`}
        name={name}
        defaultValue={valor ?? ""}
        aria-invalid={Boolean(errores[name])}
        className={inputClass}
        {...extra}
      />
      {errores[name] && <p className={errorClass}>{errores[name]}</p>}
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        // A mano: React vaciaría el formulario tras la acción y un error
        // borraría lo corregido.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-[15px] text-navy">Ficha de la persona</h3>
      <input type="hidden" name="persona_id" value={p.id} />
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <div>
          <label htmlFor={`tipo-${i.id}`} className={labelClass}>
            Tipo
          </label>
          <select id={`tipo-${i.id}`} name="tipo_documento" defaultValue={p.tipoDocumento} className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </div>
        {campo("documento", "Documento", p.documento, { required: true, maxLength: 30 })}
      </div>
      {campo("nombre", "Nombre (sale en el certificado)", p.nombre, { required: true, maxLength: 120 })}
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("telefono", "WhatsApp", p.telefono, { type: "tel", maxLength: 40 })}
        {campo("email", "Email", p.email, { type: "email", maxLength: 160 })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("ciudad", "Ciudad", p.ciudad, { maxLength: 80 })}
        {campo("profesion", "Profesión", p.profesion, { maxLength: 120 })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={botonPrimario}>
          {pending ? "Guardando…" : "Guardar ficha"}
        </button>
        <Mensaje state={state} />
      </div>
    </form>
  );
}

function PorcentajeForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(ajustarPorcentajeAccion, inicial);
  return (
    // La `key` remonta el select cuando el valor cambia en el servidor:
    // `defaultValue` solo se lee al montar.
    <form key={`${i.porcentajePagado}-${i.porcentajeManual}`} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={i.id} />
      <div className="w-[17rem]">
        <label htmlFor={`pct-${i.id}`} className={labelClass}>
          % pagado
        </label>
        <select
          id={`pct-${i.id}`}
          name="porcentaje"
          defaultValue={i.porcentajeManual ? String(i.porcentajePagado) : "auto"}
          className={inputClass}
        >
          <option value="auto">Según comprobantes verificados</option>
          {[0, 25, 50, 75, 100].map((p) => (
            <option key={p} value={p}>
              {p}% (fijado a mano)
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={botonSecundario}>
        Aplicar
      </button>
      <Mensaje state={state} />
    </form>
  );
}

function CancelarForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(cancelarAccion, inicial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!i.cancelada && !confirm("¿Cancelar esta inscripción? Libera su cupo.")) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={i.id} />
      <input type="hidden" name="cancelada" value={i.cancelada ? "no" : "si"} />
      <button type="submit" disabled={pending} className={botonSecundario}>
        {i.cancelada ? "Reactivar inscripción" : "Cancelar inscripción"}
      </button>
      <Mensaje state={state} />
    </form>
  );
}

function FusionarForm({ inscrito: i, otros }: { inscrito: Inscrito; otros: OpcionPersona[] }) {
  const [state, action, pending] = useActionState(fusionarAccion, inicial);
  const errores = state.status === "error" ? state.errores : {};
  const candidatos = otros.filter((o) => o.personaId !== i.persona.id);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `¿Fusionar la ficha de ${i.persona.nombre} en la persona elegida? Sus inscripciones y comprobantes pasan a ella y esta ficha desaparece.`,
          )
        )
          e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <p className={labelClass}>Fusionar esta ficha en otra (duplicados)</p>
      <input type="hidden" name="origen_id" value={i.persona.id} />
      <select name="destino_id" defaultValue="" aria-label="Persona destino" className={inputClass}>
        <option value="">Elige una persona de este taller…</option>
        {candidatos.map((o) => (
          <option key={o.personaId} value={o.personaId}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <input
        name="destino_documento"
        placeholder="…o escribe el documento de la persona destino"
        aria-label="Documento de la persona destino"
        aria-invalid={Boolean(errores.destino_documento)}
        className={inputClass}
      />
      {errores.destino_documento && <p className={errorClass}>{errores.destino_documento}</p>}
      <p className="text-[12px] text-ink-soft">
        Se conservan los datos de la persona elegida; de esta solo se toma lo que a aquella le falte
        (documento, email…). Si las dos están en el mismo taller, sus inscripciones se unen en una.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={botonSecundario}>
          Fusionar
        </button>
        <Mensaje state={state} />
      </div>
    </form>
  );
}

function EliminarForm({ inscrito: i }: { inscrito: Inscrito }) {
  const [state, action, pending] = useActionState(eliminarAccion, inicial);

  if (i.comprobantesVerificados > 0) {
    return (
      <p className="text-[12.5px] text-ink-soft">
        Tiene pagos verificados: no se puede eliminar (cancélala si ya no viene).
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta inscripción y sus comprobantes sin verificar? No se puede deshacer."))
          e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="id" value={i.id} />
      <button
        type="submit"
        disabled={pending}
        className={`${botonSecundario} border-red-300 text-red-700 hover:border-red-500`}
      >
        Eliminar inscripción
      </button>
      <Mensaje state={state} />
    </form>
  );
}
