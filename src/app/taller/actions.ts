"use server";

import { getPaymentProvider, type CheckoutResult, type Money, type OrderDraft } from "@/lib/payments";
import { saveReservation } from "@/lib/reservations";
import { savePaymentProof, sniffProof, type ProofFile } from "@/lib/reservations/payment-proofs";
import { PROOF_MAX_BYTES, type PaymentKind } from "@/lib/reservations/types";
import { tallerWaLink } from "@/lib/taller";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, tarifaPorDefecto, type TallerVista } from "@/lib/talleres/vista";

export type ReserveState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string }
  /** No quedan plazas (o las reservas están cerradas): se ofrece lista de espera. */
  | { status: "sold_out"; message: string; handoffUrl: string }
  | { status: "ok"; result: CheckoutResult };

const MAX = { name: 120, document: 30, email: 160, phone: 40, city: 80, profession: 120, notes: 800 };

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function newReference() {
  return `STA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Importe de la tarifa por defecto del taller; `null` mientras no haya precios publicados. */
function currentPrice(t: TallerVista): Money | null {
  return t.pricing.published
    ? { amount: tarifaPorDefecto(t).amount, currency: t.pricing.currency }
    : null;
}

/**
 * Taller activo leído de la base en el momento del envío. Nunca se confía en lo
 * que la página tenía cacheado: el estado pudo cambiar desde el admin.
 */
async function tallerActivo(): Promise<TallerVista | null> {
  const publico = await cargarTallerPublico();
  return publico.kind === "ok" ? publico.vista : null;
}

function waitlistMessage(t: TallerVista, customer: { name: string; email: string; city: string; profession: string }) {
  return tallerWaLink(
    [
      `Hola, quiero entrar en la lista de espera del ${nombreCurso(t)}.`,
      "",
      `Nombre: ${customer.name}`,
      `Email: ${customer.email}`,
      `Ciudad: ${customer.city}`,
      `Profesión: ${customer.profession}`,
    ].join("\n"),
  );
}

/**
 * Lee y valida los datos de contacto que comparten la reserva y el registro de
 * pago. Los errores se escriben en `errors` con el nombre del campo.
 */
function readCustomer(formData: FormData, errors: Record<string, string>) {
  const name = str(formData, "name");
  const email = str(formData, "email");
  const phone = str(formData, "phone");
  const city = str(formData, "city");
  const profession = str(formData, "profession");
  const notes = str(formData, "notes");

  if (name.length < 3) errors.name = "Escribe tu nombre completo.";
  else if (name.length > MAX.name) errors.name = "Nombre demasiado largo.";

  // Validación deliberadamente laxa: rechazar direcciones raras pero válidas es
  // peor que dejar pasar una errata, porque cada reserva se confirma a mano.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > MAX.email)
    errors.email = "Escribe un email válido.";

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15 || phone.length > MAX.phone)
    errors.phone = "Escribe un teléfono válido con indicativo.";

  if (city.length < 2) errors.city = "Indica tu ciudad.";
  else if (city.length > MAX.city) errors.city = "Ciudad demasiado larga.";

  if (profession.length < 2) errors.profession = "Indica tu profesión o especialidad.";
  else if (profession.length > MAX.profession) errors.profession = "Texto demasiado largo.";

  if (notes.length > MAX.notes) errors.notes = "El mensaje supera los 800 caracteres.";

  return { customer: { name, email, phone, city, profession }, notes };
}

/**
 * Crea la reserva y arranca el cobro.
 *
 * Un server action es un endpoint POST público: cualquiera puede llamarlo sin
 * pasar por el formulario, así que todo se valida aquí y el importe se lee del
 * catálogo del servidor, nunca del `formData`.
 */
export async function createReservation(
  _prev: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const errors: Record<string, string> = {};
  const { customer, notes } = readCustomer(formData, errors);

  if (formData.get("consent") !== "on")
    errors.consent = "Necesitamos tu autorización para contactarte.";

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors };
  }

  const t = await tallerActivo();
  if (!t) {
    return {
      status: "error",
      errors: {},
      message: "Ahora mismo no hay un taller con inscripciones abiertas. Escríbenos por WhatsApp.",
    };
  }

  // La página puede estar cacheada: se vuelve a comprobar aquí porque un
  // server action es un endpoint público.
  if (!t.mostrar.reserva) {
    return {
      status: "sold_out",
      message:
        t.estado === "publicado"
          ? "Los cupos de esta edición se agotaron."
          : "Se vendieron todos los cupos de esta edición.",
      handoffUrl: waitlistMessage(t, customer),
    };
  }

  const tier = tarifaPorDefecto(t);
  const order: OrderDraft = {
    reference: newReference(),
    courseName: nombreCurso(t),
    tierId: tier.id,
    tierName: tier.name,
    // El precio sale del taller en la base, nunca del formulario.
    price: currentPrice(t),
    customer,
    notes,
  };

  // Guardar es también reclamar el cupo: la base rechaza si se llenó o se cerró.
  const saved = await saveReservation(t.slug, order);

  if (saved.kind === "sold_out" || saved.kind === "closed") {
    return {
      status: "sold_out",
      message:
        saved.kind === "closed"
          ? "Las reservas de esta edición están cerradas."
          : "Los cupos de esta edición se agotaron mientras completabas el formulario.",
      handoffUrl: waitlistMessage(t, customer),
    };
  }

  try {
    const result = await getPaymentProvider().createCheckout(order);
    return { status: "ok", result };
  } catch (err) {
    console.error("[taller] createCheckout falló", { reference: order.reference, err });
    return {
      status: "error",
      errors: {},
      message:
        "No pudimos iniciar el pago. Escríbenos por WhatsApp y confirmamos tu cupo a mano.",
    };
  }
}

/* ------------------------------------------------------- Registro de pago */

export type PaymentState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string; handoffUrl?: string }
  /** `reference` es el número de reserva: el que ya tenía o el recién asignado. */
  | { status: "ok"; kind: PaymentKind; reference: string; handoffUrl: string };

const KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "abono del 50%",
  full: "pago completo",
};

/**
 * Registra el comprobante de quien ya pagó el abono o el taller completo y le
 * asigna su número de reserva.
 *
 * Si la persona escribe la referencia de una reserva previa, el pago se cuelga
 * de esa; si no, se crea la reserva en el mismo paso. En ambos casos queda
 * `pending`: el cupo se confirma a mano al revisar el comprobante.
 */
export async function registerPayment(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const errors: Record<string, string> = {};
  const { customer, notes } = readCustomer(formData, errors);

  // El documento solo se pide aquí: la reserva sin pago se cierra por WhatsApp,
  // pero un comprobante hay que poder cruzarlo con quien hizo la transferencia.
  const document = str(formData, "document").replace(/\s+/g, " ");
  // Validación laxa a propósito: conviven cédulas, pasaportes y documentos de
  // otros países, con o sin puntos, guiones o prefijo de nacionalidad.
  const documentChars = document.replace(/[^\p{L}\p{N}]/gu, "");
  if (documentChars.length < 5 || document.length > MAX.document)
    errors.document = "Escribe tu número de documento (cédula o pasaporte).";

  const rawKind = str(formData, "kind");
  const kind: PaymentKind | null = rawKind === "deposit" || rawKind === "full" ? rawKind : null;

  let reference = str(formData, "reference").toUpperCase().replace(/\s/g, "");
  if (/^[A-Z0-9]{8}$/.test(reference)) reference = `STA-${reference}`;

  if (reference && !/^STA-[A-Z0-9]{8}$/.test(reference))
    errors.reference = "La referencia tiene el formato STA-XXXXXXXX. Si no la tienes, déjala vacía.";

  if (!kind) errors.kind = "Indica si pagaste el abono o el taller completo.";
  if (kind === "deposit" && formData.get("policy") !== "on")
    errors.policy = "Debes aceptar la condición del abono para registrarlo.";

  if (formData.get("consent") !== "on")
    errors.consent = "Necesitamos tu autorización para verificar el pago.";

  const upload = formData.get("proof");
  let file: ProofFile | null = null;

  if (!(upload instanceof File) || upload.size === 0) {
    errors.proof = "Sube la captura o el comprobante de pago.";
  } else if (upload.size > PROOF_MAX_BYTES) {
    errors.proof = "El archivo supera 5 MB. Sube una captura de pantalla o un PDF más liviano.";
  } else {
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const sniffed = sniffProof(bytes);
    if (sniffed) file = { bytes, ...sniffed };
    else errors.proof = "Formato no válido. Sube una imagen (JPG, PNG, HEIC) o un PDF.";
  }

  if (Object.keys(errors).length > 0 || !kind || !file) {
    return { status: "error", errors };
  }

  const t = await tallerActivo();
  if (!t || !t.mostrar.pago) {
    return {
      status: "error",
      errors: {},
      message:
        "El registro de pagos de esta edición está cerrado. Envíanos tu comprobante por WhatsApp y lo resolvemos.",
      handoffUrl: tallerWaLink(
        `Hola, quiero registrar un pago. Nombre: ${customer.name}. Documento: ${document}.`,
      ),
    };
  }
  const tier = tarifaPorDefecto(t);

  const handoff = (assigned: string | null) =>
    tallerWaLink(
      [
        `Hola, registré mi ${KIND_LABEL[kind]} del ${nombreCurso(t)}.`,
        "",
        ...(assigned ? [`Número de reserva: ${assigned}`] : []),
        `Nombre: ${customer.name}`,
        `Documento: ${document}`,
        `Email: ${customer.email}`,
        `Teléfono: ${customer.phone}`,
      ].join("\n"),
    );

  const saved = await savePaymentProof({
    edition: t.slug,
    kind,
    existingReference: reference || null,
    newReference: newReference(),
    tierId: tier.id,
    tierName: tier.name,
    price: currentPrice(t),
    customer: { ...customer, document },
    notes,
    file,
  });

  switch (saved.kind) {
    case "saved":
      return {
        status: "ok",
        kind,
        reference: saved.reference,
        handoffUrl: handoff(saved.reference),
      };

    case "unknown_reference":
      return {
        status: "error",
        errors: {
          reference:
            "No encontramos una reserva activa con esa referencia. Revísala o déjala vacía y te asignamos un número nuevo.",
        },
      };

    case "sold_out":
    case "closed":
      return {
        status: "error",
        errors: {},
        message:
          saved.kind === "sold_out"
            ? "Los cupos de esta edición se agotaron y no pudimos asignarte un número de reserva. Escríbenos por WhatsApp con tu comprobante y lo resolvemos."
            : "Las reservas de esta edición están cerradas. Escríbenos por WhatsApp con tu comprobante y lo resolvemos.",
        handoffUrl: handoff(null),
      };

    default:
      return {
        status: "error",
        errors: {},
        message:
          "No pudimos recibir tu comprobante. Envíanoslo por WhatsApp y lo registramos a mano.",
        handoffUrl: handoff(reference || null),
      };
  }
}
