"use client";

import { startTransition, useActionState } from "react";
import { createReservation, type ReserveState } from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";
import { WhatsAppIcon } from "@/components/ui/icons";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_ETIQUETA } from "@/lib/inscripciones/tipos";
import { tallerWaLink } from "@/lib/taller";
import { useTaller } from "@/lib/talleres/contexto";
import { nombreCurso, type TallerVista } from "@/lib/talleres/vista";

const initialState: ReserveState = { status: "idle" };

/**
 * A partir de aquí se muestra el número exacto de plazas en vez de "cupos
 * limitados". Anunciar "quedan 31" no aprieta a nadie; "quedan 4", sí.
 */
const LOW_SEATS = 8;

function waitlistLink(taller: TallerVista) {
  return tallerWaLink(`Hola, quiero entrar en la lista de espera del ${nombreCurso(taller)}.`);
}

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Panel de cierre: mismo marco que la confirmación, sin formulario debajo. */
function SoldOutPanel({ message, handoffUrl }: { message: string; handoffUrl: string }) {
  return (
    <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-navy/10 text-2xl">
        ⏳
      </span>
      <h3 className="mt-5 text-[26px] text-navy">Cupos agotados</h3>
      <p className="mt-3 text-[15px] leading-[1.8] text-ink">{message}</p>
      <p className="mt-2 text-[15px] leading-[1.8] text-ink">
        Escríbenos y te anotamos en la lista de espera: si se libera una plaza, eres
        el primero en saberlo.
      </p>
      <a
        href={handoffUrl}
        target="_blank"
        rel="noopener"
        className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
      >
        <WhatsAppIcon className="size-[18px]" />
        Entrar en la lista de espera
      </a>
    </div>
  );
}

/** La reserva se guardó, pero nombre y documento no cambiaron: ya hay certificado. */
function AvisoNombreBloqueado() {
  return (
    <p className="mt-4 rounded-xl bg-white px-4 py-3 text-[13.5px] leading-[1.7] text-navy">
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
  );
}

export function ReservaForm() {
  const taller = useTaller();
  const seats = taller.seats;
  const [state, formAction, pending] = useActionState(createReservation, initialState);

  const errors = state.status === "error" ? state.errors : {};

  /**
   * Se despacha a mano y no con `<form action>`: React 19 vacía el formulario
   * tras cada acción, y un error de validación borraría todo lo escrito.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.status === "sold_out") {
    return <SoldOutPanel message={state.message} handoffUrl={state.handoffUrl} />;
  }

  if (state.status === "ya_inscrito") {
    return (
      <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Ya tienes una reserva</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">{state.message}</p>
        {taller.mostrar.pago && (
          <a
            href="#registro-pago"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
          >
            Registrar mi pago
          </a>
        )}
      </div>
    );
  }

  // Edición llena declarada en el catálogo: manda sobre el conteo de la base,
  // porque los últimos cupos se cerraron por WhatsApp y no dejaron fila.
  if (taller.soldOut) {
    return (
      <SoldOutPanel
        message="Se vendieron todos los cupos de esta edición."
        handoffUrl={waitlistLink(taller)}
      />
    );
  }

  // `seats` puede venir de una página cacheada, así que este cierre es solo
  // cosmético: quien llegue con la página vieja igual recibe el panel de
  // agotados al enviar, porque el conteo real se hace en la base de datos.
  if (seats && seats.libres <= 0) {
    return (
      <SoldOutPanel
        message="Se agotaron las plazas de esta edición."
        handoffUrl={waitlistLink(taller)}
      />
    );
  }

  if (state.status === "ok") {
    const { result } = state;
    return (
      <div className="rounded-3xl bg-cream p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-azure/15 text-3xl">
          ✓
        </span>
        <h3 className="mt-5 text-[26px] text-navy">Reserva registrada</h3>
        <p className="mt-3 text-[15px] leading-[1.8] text-ink">
          {result.kind === "pending"
            ? result.message
            : "Te llevamos a la pasarela para completar el pago."}
        </p>
        <p className="mt-5 inline-block rounded-full bg-white px-5 py-2 font-mono text-[13px] tracking-wider text-navy">
          Referencia: <strong>{result.reference}</strong>
        </p>
        {state.nombreBloqueado && <AvisoNombreBloqueado />}
        <a
          href={result.kind === "pending" ? result.handoffUrl : result.url}
          target="_blank"
          rel="noopener"
          className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
        >
          {result.kind === "pending" ? (
            <>
              <WhatsAppIcon className="size-[18px]" />
              Continuar en WhatsApp
            </>
          ) : (
            "Ir a pagar"
          )}
        </a>
        <p className="mt-4 text-[11.5px] text-ink-soft">
          Para registrar tu pago y descargar tu certificado solo necesitas tu número de documento.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-3xl bg-cream p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
        <Field id="tipo_documento" label="Tipo de documento">
          <select id="tipo_documento" name="tipo_documento" defaultValue="CC" className={inputClass}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DOCUMENTO_ETIQUETA[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="documento" label="Número de documento" error={errors.documento}>
          <input
            id="documento"
            name="documento"
            required
            type="text"
            autoComplete="off"
            maxLength={30}
            placeholder="Cédula o pasaporte"
            aria-invalid={Boolean(errors.documento)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <Field id="nombre" label="Nombre completo" error={errors.nombre}>
          <input
            id="nombre"
            name="nombre"
            required
            type="text"
            autoComplete="name"
            maxLength={120}
            placeholder="Tu nombre y apellido"
            aria-invalid={Boolean(errors.nombre)}
            className={inputClass}
          />
        </Field>
        {!errors.nombre && (
          <p className="mt-1.5 text-[12px] text-ink-soft">
            Así aparecerá en tu certificado: escríbelo completo y con tildes.
          </p>
        )}
      </div>

      <Field id="email" label="Email" error={errors.email}>
        <input
          id="email"
          name="email"
          required
          type="email"
          autoComplete="email"
          maxLength={160}
          placeholder="nombre@correo.com"
          aria-invalid={Boolean(errors.email)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="telefono" label="WhatsApp" error={errors.telefono}>
          <input
            id="telefono"
            name="telefono"
            required
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="+57 300 000 0000"
            aria-invalid={Boolean(errors.telefono)}
            className={inputClass}
          />
        </Field>

        <Field id="ciudad" label="Ciudad" error={errors.ciudad}>
          <input
            id="ciudad"
            name="ciudad"
            required
            type="text"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Maracaibo"
            aria-invalid={Boolean(errors.ciudad)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="profesion" label="Profesión o especialidad" error={errors.profesion}>
        <input
          id="profesion"
          name="profesion"
          required
          type="text"
          maxLength={120}
          placeholder="Anestesiólogo · Residente de anestesiología · Médico general"
          aria-invalid={Boolean(errors.profesion)}
          className={inputClass}
        />
      </Field>

      <Field id="notas" label="¿Algo que debamos saber? (opcional)" error={errors.notas}>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          maxLength={800}
          placeholder="Facturación, alimentación, nivel de experiencia con ultrasonido…"
          className={`${inputClass} resize-y`}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-ink">
        <input type="checkbox" name="consent" className="mt-0.5 accent-azure" />
        <span>
          Autorizo el tratamiento de mis datos para gestionar la reserva y recibir
          información del taller.
        </span>
      </label>
      {errors.consent && <p className="-mt-2 text-[12px] text-red-600">{errors.consent}</p>}

      <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-ink">
        <input type="checkbox" name="terms" className="mt-0.5 accent-azure" />
        <span>
          Acepto los{" "}
          <a href="#terminos" className="font-semibold text-azure underline-offset-4 hover:underline">
            términos y condiciones
          </a>
          : sin asistencia no hay certificado ni reembolso, y con menos de 20 días de
          anticipación no hay reembolso.
        </span>
      </label>
      {errors.terms && <p className="-mt-2 text-[12px] text-red-600">{errors.terms}</p>}

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Reservar mi cupo"}
      </button>

      <p className="text-center text-[11.5px] text-ink-soft">
        {seats && seats.libres <= LOW_SEATS
          ? `Quedan ${seats.libres} ${seats.libres === 1 ? "cupo" : "cupos"}. `
          : "Cupos limitados. "}
        {taller.pricing.published
          ? "Recibirás tu referencia de pago al enviar."
          : "Te confirmamos el valor y el medio de pago al contactarte."}
      </p>
    </form>
  );
}

export function ReservaSection() {
  const taller = useTaller();
  const seats = taller.seats;
  // Con Supabase conectado el dato es real; sin él se cae al texto de escasez.
  const scarcity =
    !taller.soldOut && seats && seats.libres > 0 && seats.libres <= LOW_SEATS
      ? `Quedan ${seats.libres} de ${seats.total} cupos`
      : `${taller.scarcity.value} ${taller.scarcity.label}`;

  return (
    <section id="reservar" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            Reserva
          </Reveal>

          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy">
              {taller.soldOut ? "Esta edición" : "Asegura tu cupo"}
              <span className="block text-azure">
                {taller.soldOut ? "ya está completa." : "antes de que se agote."}
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ink">
              {taller.soldOut ? (
                <>
                  {scarcity}. El taller trabaja con grupos reducidos por estación, así que
                  el número de plazas es fijo y no se amplía. Déjanos tus datos por
                  WhatsApp: si se libera una plaza o abrimos una edición nueva, te
                  avisamos primero.
                </>
              ) : (
                <>
                  {scarcity}. El taller trabaja con grupos reducidos por estación, así que
                  el número de plazas es fijo. Completa el formulario y te confirmamos por
                  WhatsApp.
                </>
              )}
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <ul className="mt-8 flex flex-col gap-3">
              {taller.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[14px] text-ink">
                  <span className="mt-[7px] block size-1.5 flex-none rounded-full bg-azure" />
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <ReservaForm />
        </Reveal>
      </div>
    </section>
  );
}
