"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { registerPayment, type PaymentState } from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";
import { WhatsAppIcon } from "@/components/ui/icons";
import { PROOF_ACCEPT, PROOF_MAX_BYTES, type PaymentKind } from "@/lib/reservations/types";
import { taller } from "@/lib/taller";

const initialState: PaymentState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";
const errorClass = "mt-1.5 text-[12px] text-red-600";

const KINDS: { value: PaymentKind; title: string; desc: string }[] = [
  { value: "deposit", title: "Abono del 50%", desc: "Pagué la primera mitad" },
  { value: "full", title: "Pago completo", desc: "Pagué el 100% del taller" },
];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

export function PagoForm() {
  const [state, formAction, pending] = useActionState(registerPayment, initialState);
  const [kind, setKind] = useState<PaymentKind | null>(null);
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

  /**
   * El envío se despacha a mano y no con `<form action>`: React resetea el
   * formulario tras cada acción, y perder el archivo elegido por un error de
   * validación obliga a buscar la captura otra vez.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!kind) next.kind = "Indica si pagaste el abono o el taller completo.";
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
          {state.kind === "deposit"
            ? "Recibimos el comprobante de tu abono del 50%. Lo verificamos y te confirmamos el cupo por WhatsApp."
            : "Recibimos el comprobante de tu pago completo. Lo verificamos y te confirmamos el cupo por WhatsApp."}
        </p>
        <div className="mt-6 rounded-2xl border border-navy/10 bg-ice/40 px-5 py-4">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
            Tu número de reserva
          </p>
          <p className="mt-1 font-mono text-[26px] font-semibold tracking-wider text-navy select-all">
            {state.reference}
          </p>
          <p className="mt-1 text-[12px] text-ink-soft">
            Guárdalo: lo necesitas para el pago restante y para tu certificado.
          </p>
        </div>
        {state.kind === "deposit" && (
          <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-[13.5px] leading-[1.7] text-navy">
            Recuerda: {taller.payment.policy.charAt(0).toLowerCase() + taller.payment.policy.slice(1)}
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
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      encType="multipart/form-data"
      className="flex flex-col gap-4 rounded-3xl bg-white p-6 sm:p-8"
    >
      <fieldset>
        <legend className={labelClass}>¿Qué pagaste?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-200 ${
                kind === k.value ? "border-azure bg-ice/40" : "border-navy/15 hover:border-navy/30"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="mt-1 accent-azure"
              />
              <span>
                <span className="block text-[14px] font-semibold text-navy">{k.title}</span>
                <span className="block text-[12.5px] text-ink-soft">{k.desc}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.kind && <p className={errorClass}>{errors.kind}</p>}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="pago-name" label="Nombre completo" error={errors.name}>
          <input
            id="pago-name"
            name="name"
            required
            type="text"
            autoComplete="name"
            maxLength={120}
            placeholder="Como aparece en tu documento"
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
          />
        </Field>

        <Field id="pago-document" label="Número de documento" error={errors.document}>
          <input
            id="pago-document"
            name="document"
            required
            type="text"
            maxLength={30}
            placeholder="Cédula o pasaporte"
            aria-invalid={Boolean(errors.document)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="pago-email" label="Email" error={errors.email}>
          <input
            id="pago-email"
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

        <Field id="pago-phone" label="WhatsApp" error={errors.phone}>
          <input
            id="pago-phone"
            name="phone"
            required
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="+57 300 000 0000"
            aria-invalid={Boolean(errors.phone)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="pago-city" label="Ciudad" error={errors.city}>
          <input
            id="pago-city"
            name="city"
            required
            type="text"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Maracaibo"
            aria-invalid={Boolean(errors.city)}
            className={inputClass}
          />
        </Field>

        <Field id="pago-profession" label="Profesión o especialidad" error={errors.profession}>
          <input
            id="pago-profession"
            name="profession"
            required
            type="text"
            maxLength={120}
            placeholder="Anestesiólogo"
            aria-invalid={Boolean(errors.profession)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <Field
          id="pago-reference"
          label="¿Ya tenías referencia de reserva? (opcional)"
          error={errors.reference}
        >
          <input
            id="pago-reference"
            name="reference"
            type="text"
            maxLength={20}
            autoCapitalize="characters"
            placeholder="STA-XXXXXXXX"
            aria-invalid={Boolean(errors.reference)}
            className={`${inputClass} font-mono uppercase placeholder:normal-case`}
          />
        </Field>
        {!errors.reference && (
          <p className="mt-1.5 text-[12px] text-ink-soft">
            Si la dejas vacía, te asignamos tu número de reserva al registrar el pago.
          </p>
        )}
      </div>

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

      <Field id="pago-notes" label="Comentario (opcional)" error={errors.notes}>
        <textarea
          id="pago-notes"
          name="notes"
          rows={2}
          maxLength={800}
          placeholder="Banco, fecha de la transferencia, a nombre de quién salió el pago…"
          className={`${inputClass} resize-y`}
        />
      </Field>

      {kind === "deposit" && (
        <div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream px-4 py-3.5 text-[12.5px] leading-relaxed text-navy">
            <input type="checkbox" name="policy" className="mt-0.5 accent-azure" />
            <span>
              Entiendo que si no pago a tiempo el 50% restante{" "}
              <strong>no hay reembolso del abono</strong>, porque ese 50% cubre los gastos
              operativos del taller.
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

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Subiendo comprobante…" : "Registrar mi pago"}
      </button>
    </form>
  );
}

export function PagoSection() {
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
              Si ya hiciste el abono del 50% o pagaste el taller completo, envíanos tus datos
              con la captura o el comprobante de la transferencia. Al registrarlo te
              asignamos tu número de reserva, y te confirmamos el cupo por WhatsApp cuando
              verifiquemos el pago.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-8 max-w-[440px] rounded-2xl border border-white/20 bg-white/[0.06] p-5">
              <p className="flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.06em] text-sky uppercase">
                <span className="block size-1.5 rounded-full bg-sky" />
                Importante sobre el abono
              </p>
              <p className="mt-3 text-[15px] leading-[1.75] text-white">{taller.payment.policy}</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <PagoForm />
        </Reveal>
      </div>
    </section>
  );
}
