"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import {
  buscarInscripcion,
  registrarPago,
  type ConsultaState,
  type PaymentState,
} from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";
import { WhatsAppIcon } from "@/components/ui/icons";
import type { ConsultaPago } from "@/lib/inscripciones/consulta";
import { montoDePorcentaje } from "@/lib/inscripciones/pagos";
import { PROOF_ACCEPT, PROOF_MAX_BYTES } from "@/lib/reservations/types";
import { formatPrice, tallerWaLink } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";

const consultaInicial: ConsultaState = { status: "idle" };
const pagoInicial: PaymentState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";
const errorClass = "mt-1.5 text-[12px] text-red-600";
const botonClass =
  "mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60";

type Campo = "nombre" | "email" | "telefono";
const CAMPOS: { campo: Campo; etiqueta: string; tipo: string; max: number; ayuda: string }[] = [
  { campo: "nombre", etiqueta: "Nombre", tipo: "text", max: 120, ayuda: "Nombre completo, tal como debe salir en el certificado" },
  { campo: "email", etiqueta: "Email", tipo: "email", max: 160, ayuda: "Email completo" },
  { campo: "telefono", etiqueta: "WhatsApp", tipo: "tel", max: 40, ayuda: "WhatsApp completo, con indicativo" },
];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Paso 1: solo el documento. Hasta saber que hay una reserva activa no se pide
 * nada más, y lo que vuelve del servidor llega enmascarado.
 */
export function PagoForm({ onReiniciar }: { onReiniciar: () => void }) {
  const [consulta, buscar, buscando] = useActionState(buscarInscripcion, consultaInicial);

  if (consulta.status === "ok") {
    return <PasoPago documento={consulta.documento} consulta={consulta.consulta} onReiniciar={onReiniciar} />;
  }

  return (
    <form
      onSubmit={(e) => {
        // A mano y no con `action`: así un «no encontramos tu reserva» no
        // borra el documento que la persona acaba de escribir.
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => buscar(formData));
      }}
      className="flex flex-col gap-4 rounded-3xl bg-white p-6 sm:p-8"
    >
      <div>
        <label htmlFor="pago-documento" className={labelClass}>
          Número de documento con el que reservaste
        </label>
        <input
          id="pago-documento"
          name="documento"
          required
          type="text"
          autoComplete="off"
          maxLength={30}
          placeholder="Cédula o pasaporte"
          className={inputClass}
        />
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Buscamos tu reserva en esta edición y te mostramos tus datos ocultos en parte para que
        confirmes que eres tú.
      </p>

      {consulta.status === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {consulta.message}
          {consulta.sinReserva && (
            <a href="#reservar" className="mt-1.5 block font-semibold underline underline-offset-4">
              Reservar mi cupo
            </a>
          )}
        </div>
      )}

      <button type="submit" disabled={buscando} className={botonClass}>
        {buscando ? "Buscando…" : "Continuar"}
      </button>
    </form>
  );
}

/** Paso 2: datos enmascarados, cuánto pagó y el comprobante. */
function PasoPago({
  documento,
  consulta,
  onReiniciar,
}: {
  documento: string;
  consulta: ConsultaPago;
  onReiniciar: () => void;
}) {
  const [state, formAction, pending] = useActionState(registrarPago, pagoInicial);
  const [porcentaje, setPorcentaje] = useState<number | null>(
    consulta.opciones.length === 1 ? consulta.opciones[0].porcentaje : null,
  );
  const [corregir, setCorregir] = useState<Record<Campo, boolean>>({
    nombre: false,
    email: false,
    telefono: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Vista previa solo para formatos que el navegador sabe pintar; HEIC y PDF
  // se muestran por nombre.
  const preview = useMemo(
    () => (file && /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const errors = { ...(state.status === "error" ? state.errors : {}), ...clientErrors };
  const parcial = porcentaje !== null && consulta.pagado + consulta.enRevision + porcentaje < 100;

  /**
   * Se despacha a mano y no con `<form action>`: React resetea el formulario
   * tras cada acción, y perder el archivo elegido por un error de validación
   * obliga a buscar la captura otra vez.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (porcentaje === null) next.porcentaje = "Elige cuánto pagaste.";
    if (!file) next.proof = "Sube la captura o el comprobante de pago.";
    // Por encima del límite el server action rechaza la petición antes de
    // ejecutarse, así que el aviso tiene que salir de aquí.
    else if (file.size > PROOF_MAX_BYTES)
      next.proof = "El archivo supera 5 MB. Sube una captura de pantalla o un PDF más liviano.";
    setClientErrors(next);
    if (Object.keys(next).length > 0) return;

    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.status === "ok") {
    return (
      <div className="rounded-3xl bg-white p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl text-navy">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Pago registrado</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          Recibimos el comprobante de tu pago del {state.porcentaje}%. Lo verificamos y te
          avisamos por WhatsApp.
        </p>
        <div className="mt-6 rounded-2xl border border-navy/10 bg-ice/40 px-5 py-4">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
            Tu número de reserva
          </p>
          <p className="mt-1 font-mono text-[26px] font-semibold tracking-wider text-navy select-all">
            {state.referencia}
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">
            Para el próximo pago y para tu certificado basta con tu documento.
          </p>
        </div>
        {state.nombreBloqueado && (
          <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[13.5px] leading-[1.7] text-navy">
            Tu nombre ya figura en un certificado; para corregirlo{" "}
            <a
              href={tallerWaLink("Hola, quiero corregir mi nombre en un certificado.")}
              target="_blank"
              rel="noopener"
              className="font-semibold text-azure underline-offset-4 hover:underline"
            >
              escríbenos por WhatsApp
            </a>
            .
          </p>
        )}
        {!state.completo && (
          <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[13.5px] leading-[1.7] text-navy">
            Recuerda: si no completas el pago a tiempo, no hay reembolso de lo abonado.
          </p>
        )}
        <a
          href={state.handoffUrl}
          target="_blank"
          rel="noopener"
          className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
        >
          <WhatsAppIcon className="size-[18px]" />
          Avisar por WhatsApp
        </a>
        <button
          type="button"
          onClick={onReiniciar}
          className="mt-4 text-[13px] font-semibold text-azure underline-offset-4 hover:underline"
        >
          Registrar otro pago
        </button>
      </div>
    );
  }

  if (consulta.opciones.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 text-center sm:p-10">
        <h3 className="text-[24px] text-navy">Ya registraste el 100%</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          Llevas {consulta.pagado}% verificado
          {consulta.enRevision > 0 ? ` y ${consulta.enRevision}% en revisión` : ""}. Si necesitas
          corregir un comprobante, escríbenos por WhatsApp.
        </p>
        <button
          type="button"
          onClick={onReiniciar}
          className="mt-6 text-[13px] font-semibold text-azure underline-offset-4 hover:underline"
        >
          Usar otro documento
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      encType="multipart/form-data"
      className="flex flex-col gap-5 rounded-3xl bg-white p-6 sm:p-8"
    >
      <input type="hidden" name="documento" value={documento} />

      <div className="rounded-2xl border border-navy/10 bg-ice/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
            Tu reserva
          </p>
          <button
            type="button"
            onClick={onReiniciar}
            className="text-[12.5px] font-semibold text-azure underline-offset-4 hover:underline"
          >
            No soy yo · otro documento
          </button>
        </div>
        {errors.documento && <p className={errorClass}>{errors.documento}</p>}

        <dl className="mt-3 flex flex-col gap-3">
          {CAMPOS.map(({ campo, etiqueta, tipo, max, ayuda }) => (
            <div key={campo}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-[12.5px] text-ink-soft">{etiqueta}</dt>
                <button
                  type="button"
                  onClick={() => setCorregir((c) => ({ ...c, [campo]: !c[campo] }))}
                  className="text-[12px] font-semibold text-azure"
                >
                  {corregir[campo] ? "Dejarlo así" : "Corregir"}
                </button>
              </div>
              <dd className="font-mono text-[14px] text-navy">{consulta[campo] || "—"}</dd>
              {corregir[campo] && (
                <>
                  <input
                    name={campo}
                    type={tipo}
                    required
                    maxLength={max}
                    placeholder={ayuda}
                    aria-label={ayuda}
                    aria-invalid={Boolean(errors[campo])}
                    className={`${inputClass} mt-2`}
                  />
                  {errors[campo] && <p className={errorClass}>{errors[campo]}</p>}
                </>
              )}
            </div>
          ))}
        </dl>

        <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[12.5px] leading-relaxed text-navy">
          El nombre es el que se imprime en tu certificado. Si ves un error, toca «Corregir» y
          escríbelo completo, tal como debe salir.
        </p>
        <p className="mt-3 text-[13px] text-ink">
          Llevas pagado <strong>{consulta.pagado}%</strong>
          {consulta.enRevision > 0 && (
            <>
              {" "}
              · <strong>{consulta.enRevision}%</strong> en revisión
            </>
          )}
          .
        </p>
      </div>

      <fieldset>
        <legend className={labelClass}>¿Cuánto pagaste ahora?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {consulta.opciones.map((o) => (
            <label
              key={o.porcentaje}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-200 ${
                porcentaje === o.porcentaje ? "border-azure bg-ice/40" : "border-navy/15 hover:border-navy/30"
              }`}
            >
              <input
                type="radio"
                name="porcentaje"
                value={o.porcentaje}
                checked={porcentaje === o.porcentaje}
                onChange={() => setPorcentaje(o.porcentaje)}
                className="mt-1 accent-azure"
              />
              <span>
                <span className="block text-[14px] font-semibold text-navy">{o.etiqueta}</span>
                {consulta.monto !== null && consulta.moneda && (
                  <span className="block text-[12.5px] text-ink-soft">
                    {formatPrice(montoDePorcentaje(consulta.monto, o.porcentaje), consulta.moneda)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        {errors.porcentaje && <p className={errorClass}>{errors.porcentaje}</p>}
      </fieldset>

      <div>
        <span className={labelClass}>Captura o comprobante de pago</span>
        <label
          htmlFor="pago-proof"
          className={`flex cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 py-4 transition-colors duration-200 focus-within:border-azure ${
            errors.proof ? "border-red-400" : "border-navy/25 hover:border-azure"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob local, next/image no aplica
            <img src={preview} alt="" className="size-14 flex-none rounded-lg object-cover" />
          ) : (
            <span className="flex size-14 flex-none items-center justify-center rounded-lg bg-cream text-[11px] font-semibold tracking-wider text-navy">
              {file ? (file.type === "application/pdf" ? "PDF" : "IMG") : "+"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-navy">
              {file ? file.name : "Elegir archivo"}
            </span>
            <span className="block text-[12.5px] text-ink-soft">
              {file
                ? `${formatSize(file.size)} · toca para cambiarlo`
                : "JPG, PNG, HEIC o PDF · máximo 5 MB"}
            </span>
          </span>
          <input
            id="pago-proof"
            name="proof"
            type="file"
            accept={PROOF_ACCEPT}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
        {errors.proof && <p className={errorClass}>{errors.proof}</p>}
      </div>

      <div>
        <label htmlFor="pago-notas" className={labelClass}>
          Comentario (opcional)
        </label>
        <textarea
          id="pago-notas"
          name="notas"
          rows={2}
          maxLength={800}
          placeholder="Banco, fecha de la transferencia, a nombre de quién salió el pago…"
          className={`${inputClass} resize-y`}
        />
        {errors.notas && <p className={errorClass}>{errors.notas}</p>}
      </div>

      {(parcial || errors.policy) && (
        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream px-4 py-3.5 text-[12.5px] leading-relaxed text-navy">
            <input type="checkbox" name="policy" className="mt-0.5 accent-azure" />
            <span>
              Entiendo que si no completo el pago a tiempo{" "}
              <strong>no hay reembolso de lo abonado</strong>, porque cubre los gastos operativos
              del taller.
            </span>
          </label>
          {errors.policy && <p className={errorClass}>{errors.policy}</p>}
        </div>
      )}

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-ink">
          <input type="checkbox" name="consent" className="mt-0.5 accent-azure" />
          <span>
            Autorizo el tratamiento de mis datos y del comprobante para verificar mi pago.
          </span>
        </label>
        {errors.consent && <p className={errorClass}>{errors.consent}</p>}
      </div>

      {state.status === "error" && state.message && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.message}
          {state.handoffUrl && (
            <a
              href={state.handoffUrl}
              target="_blank"
              rel="noopener"
              className="mt-1.5 flex items-center gap-2 font-semibold underline underline-offset-4"
            >
              <WhatsAppIcon className="size-4" />
              Enviar por WhatsApp
            </a>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className={botonClass}>
        {pending ? "Subiendo comprobante…" : "Registrar mi pago"}
      </button>
    </form>
  );
}

export function PagoSection() {
  const taller = useTaller();
  const aceptaParcial = taller.porcentajesPago.some((p) => p < 100);
  // Cambiar la `key` remonta el formulario: es la forma de volver al paso 1
  // (useActionState no tiene un «reset»).
  const [vuelta, setVuelta] = useState(0);

  return (
    <section
      id="registro-pago"
      className="grain relative overflow-hidden bg-navy px-5 py-24 sm:px-8 lg:px-16 lg:py-32"
    >
      <div className="pointer-events-none absolute top-1/3 -right-[10%] size-[38vw] max-h-[520px] max-w-[520px] rounded-full bg-[radial-gradient(circle,rgba(88,134,232,.2),transparent_65%)] blur-2xl" />

      <div className="relative mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-sky">
            <span className="block h-px w-6 bg-azure" />
            Registro de pago
          </Reveal>

          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-white">
              ¿Ya pagaste?
              <span className="block text-sky">Registra tu comprobante.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ice/80">
              Escribe el documento con el que reservaste, confirma tus datos y sube la captura o
              el comprobante de la transferencia. Te avisamos por WhatsApp cuando verifiquemos
              el pago.
            </p>
          </Reveal>

          {aceptaParcial && (
            <Reveal delay={0.18}>
              <div className="mt-8 max-w-[440px] rounded-2xl border border-white/20 bg-white/[0.06] p-5">
                <p className="flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.06em] text-sky uppercase">
                  <span className="block size-1.5 rounded-full bg-sky" />
                  Importante sobre el abono
                </p>
                <p className="mt-3 text-[15px] leading-[1.75] text-white">{taller.payment.policy}</p>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={0.15}>
          <PagoForm key={vuelta} onReiniciar={() => setVuelta((v) => v + 1)} />
        </Reveal>
      </div>
    </section>
  );
}
