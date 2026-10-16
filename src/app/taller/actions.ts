"use server";

import { headers } from "next/headers";
import { getPaymentProvider, type CheckoutResult, type Money, type OrderDraft } from "@/lib/payments";
import { guardarComprobante } from "@/lib/inscripciones/comprobantes";
import { respuestaConsulta, type ConsultaPago } from "@/lib/inscripciones/consulta";
import { documentoValido, normalizarDocumento } from "@/lib/inscripciones/documento";
import { MENSAJES_INSCRIPCION } from "@/lib/inscripciones/errores";
import { leerCorrecciones, leerPersonaForm, MAX } from "@/lib/inscripciones/formulario";
import { porcentajeValido } from "@/lib/inscripciones/pagos";
import { consultarInscripcion, crearInscripcion } from "@/lib/inscripciones/repo";
import type { DatosPersona } from "@/lib/inscripciones/tipos";
import { crearLimitador, ipDeCabeceras } from "@/lib/limite";
import { sniffProof, type ProofFile } from "@/lib/reservations/payment-proofs";
import { PROOF_MAX_BYTES } from "@/lib/reservations/types";
import { tallerWaLink } from "@/lib/taller";
import { cargarTallerPublico } from "@/lib/talleres/publico";
import { nombreCurso, tarifaPorDefecto, type TallerVista } from "@/lib/talleres/vista";

export type ReserveState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string }
  /** No quedan plazas (o las reservas están cerradas): se ofrece lista de espera. */
  | { status: "sold_out"; message: string; handoffUrl: string }
  /** Ese documento ya tiene reserva en este taller. */
  | { status: "ya_inscrito"; message: string }
  | { status: "ok"; result: CheckoutResult };

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
async function tallerActivo(): Promise<
  { taller: TallerVista } | { taller: null; mensaje: string }
> {
  const publico = await cargarTallerPublico();
  if (publico.kind === "ok") return { taller: publico.vista };
  return {
    taller: null,
    mensaje:
      publico.kind === "sin_conexion"
        ? "No pudimos conectar con el sistema de reservas. Inténtalo en unos minutos o escríbenos por WhatsApp."
        : "Ahora mismo no hay un taller con inscripciones abiertas. Escríbenos por WhatsApp.",
  };
}

function waitlistMessage(
  t: TallerVista,
  p: Pick<DatosPersona, "nombre" | "email" | "ciudad" | "profesion">,
) {
  return tallerWaLink(
    [
      `Hola, quiero entrar en la lista de espera del ${nombreCurso(t)}.`,
      "",
      `Nombre: ${p.nombre}`,
      `Email: ${p.email ?? ""}`,
      `Ciudad: ${p.ciudad ?? ""}`,
      `Profesión: ${p.profesion ?? ""}`,
    ].join("\n"),
  );
}

/**
 * Consultas por documento (buscar la reserva, registrar el pago, buscar
 * certificados): como mucho 12 cada 10 minutos por IP. Frena a quien prueba
 * documentos para ver quién está inscrito; a una persona real le sobra.
 */
const limitador = crearLimitador({ max: 12, ventanaMs: 10 * 60 * 1000 });

async function dentroDelLimite() {
  return limitador.permitir(ipDeCabeceras(await headers()));
}

/**
 * Crea la inscripción y arranca el cobro.
 *
 * Un server action es un endpoint POST público: cualquiera puede llamarlo sin
 * pasar por el formulario, así que todo se valida aquí y el importe se lee del
 * taller en la base, nunca del `formData`.
 */
export async function createReservation(
  _prev: ReserveState,
  formData: FormData,
): Promise<ReserveState> {
  const lectura = leerPersonaForm(formData, "publico");
  const errors: Record<string, string> = lectura.ok ? {} : { ...lectura.errores };
  if (formData.get("consent") !== "on")
    errors.consent = "Necesitamos tu autorización para contactarte.";
  if (!lectura.ok || Object.keys(errors).length > 0) return { status: "error", errors };
  const { datos, notas } = lectura;

  // «Ya tienes una reserva» se responde por documento: sin límite sería otra
  // forma de averiguar quién está inscrito.
  if (!(await dentroDelLimite()))
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION.limite };

  const activo = await tallerActivo();
  if (!activo.taller) return { status: "error", errors: {}, message: activo.mensaje };
  const t = activo.taller;

  // La página puede estar cacheada: se vuelve a comprobar aquí.
  if (t.estado === "finalizado") {
    return { status: "error", errors: {}, message: "Esta edición ya finalizó." };
  }

  if (!t.mostrar.reserva) {
    return {
      status: "sold_out",
      message:
        t.estado === "publicado"
          ? "Los cupos de esta edición se agotaron."
          : "Se vendieron todos los cupos de esta edición.",
      handoffUrl: waitlistMessage(t, datos),
    };
  }

  const tier = tarifaPorDefecto(t);
  const price = currentPrice(t);
  const referencia = newReference();

  // Guardar es también reclamar el cupo: la base rechaza si se llenó o se cerró.
  const creada = await crearInscripcion({
    tallerId: t.id,
    referencia,
    persona: datos,
    tarifa: { id: tier.id, nombre: tier.name },
    monto: price?.amount ?? null,
    moneda: price?.currency ?? null,
    notas,
    origen: "web",
    forzarCupo: false,
  });

  if (!creada.ok) {
    switch (creada.motivo) {
      case "ya_inscrito":
        return {
          status: "ya_inscrito",
          message:
            "Ya tienes una reserva en este taller con ese documento: no hace falta reservar otra vez. Si ya pagaste, registra tu comprobante.",
        };
      case "sin_cupos":
      case "cerrado":
        return {
          status: "sold_out",
          message:
            creada.motivo === "cerrado"
              ? "Las reservas de esta edición están cerradas."
              : "Los cupos de esta edición se agotaron mientras completabas el formulario.",
          handoffUrl: waitlistMessage(t, datos),
        };
      case "documento_invalido":
        return { status: "error", errors: { documento: MENSAJES_INSCRIPCION.documento_invalido } };
      default:
        // Sin conexión o fallo de la base: la reserva no quedó guardada (repo.ts
        // la deja en los logs), pero la persona sigue por WhatsApp con su
        // referencia, como siempre.
        console.error("[taller] la reserva no quedó en la base; sigue por WhatsApp", {
          motivo: creada.motivo,
          referencia,
          persona: datos,
          notas,
        });
    }
  }

  const order: OrderDraft = {
    reference: creada.ok ? creada.valor.referencia : referencia,
    courseName: nombreCurso(t),
    tierId: tier.id,
    tierName: tier.name,
    price,
    customer: {
      name: datos.nombre,
      document: `${datos.tipoDocumento} ${datos.documento}`,
      email: datos.email ?? "",
      phone: datos.telefono ?? "",
      city: datos.ciudad ?? "",
      profession: datos.profesion ?? "",
    },
    notes: notas,
  };

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

export type ConsultaState =
  | { status: "idle" }
  | { status: "error"; message: string; sinReserva?: boolean }
  | { status: "ok"; documento: string; consulta: ConsultaPago };

/**
 * Paso 1 del pago: ¿hay una reserva activa con este documento?
 *
 * Devuelve los datos enmascarados y los porcentajes que se pueden pagar. No
 * entrega ningún token: el paso 2 vuelve a comprobarlo todo.
 */
export async function buscarInscripcion(
  _prev: ConsultaState,
  formData: FormData,
): Promise<ConsultaState> {
  const documento = normalizarDocumento(str(formData, "documento"));
  if (!documentoValido(documento))
    return { status: "error", message: "Escribe tu número de documento (cédula o pasaporte)." };
  if (!(await dentroDelLimite())) return { status: "error", message: MENSAJES_INSCRIPCION.limite };

  const activo = await tallerActivo();
  if (!activo.taller) return { status: "error", message: activo.mensaje };
  const t = activo.taller;
  if (!t.mostrar.pago) {
    return {
      status: "error",
      message: "El registro de pagos de esta edición está cerrado. Escríbenos por WhatsApp.",
    };
  }

  const r = await consultarInscripcion(t.id, documento);
  if (!r.ok) return { status: "error", message: MENSAJES_INSCRIPCION[r.motivo] };
  if (!r.valor) {
    return {
      status: "error",
      message:
        "No encontramos una reserva con ese documento en esta edición. Revisa el número o reserva tu cupo primero.",
      sinReserva: true,
    };
  }

  return {
    status: "ok",
    documento,
    consulta: respuestaConsulta(r.valor, t.porcentajesPago, t.pricing.published),
  };
}

export type PaymentState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string; handoffUrl?: string }
  | { status: "ok"; porcentaje: number; referencia: string; completo: boolean; handoffUrl: string };

/**
 * Paso 2: registra el comprobante.
 *
 * Todo se valida otra vez (taller abierto, reserva activa, porcentaje
 * permitido y dentro del saldo) y la base lo repite dentro de su transacción.
 * Los datos que la persona reescribió se corrigen en su ficha.
 */
export async function registrarPago(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const errors: Record<string, string> = {};

  const documento = normalizarDocumento(str(formData, "documento"));
  if (!documentoValido(documento)) errors.documento = "Vuelve al paso anterior y escribe tu documento.";

  const correcciones = leerCorrecciones(formData, errors);

  const porcentaje = Number(str(formData, "porcentaje"));
  if (!Number.isInteger(porcentaje) || porcentaje <= 0 || porcentaje > 100)
    errors.porcentaje = "Elige cuánto pagaste.";

  const notas = str(formData, "notas");
  if (notas.length > MAX.notas) errors.notas = "El comentario supera los 800 caracteres.";

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

  if (Object.keys(errors).length > 0 || !file) return { status: "error", errors };
  if (!(await dentroDelLimite()))
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION.limite };

  const activo = await tallerActivo();
  if (!activo.taller) {
    return {
      status: "error",
      errors: {},
      message: activo.mensaje,
      handoffUrl: tallerWaLink(`Hola, quiero registrar un pago. Documento: ${documento}.`),
    };
  }
  const t = activo.taller;

  const handoff = (referencia: string | null) =>
    tallerWaLink(
      [
        `Hola, registré un pago del ${porcentaje}% del ${nombreCurso(t)}.`,
        "",
        ...(referencia ? [`Número de reserva: ${referencia}`] : []),
        `Documento: ${documento}`,
      ].join("\n"),
    );

  if (!t.mostrar.pago) {
    return {
      status: "error",
      errors: {},
      message:
        "El registro de pagos de esta edición está cerrado. Envíanos tu comprobante por WhatsApp y lo resolvemos.",
      handoffUrl: handoff(null),
    };
  }

  // Se consulta de nuevo: entre un paso y otro pudo subirse otro comprobante
  // (otra pestaña) y el paso 1 no deja ningún token de confianza.
  const consulta = await consultarInscripcion(t.id, documento);
  if (!consulta.ok) {
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION[consulta.motivo], handoffUrl: handoff(null) };
  }
  if (!consulta.valor) {
    return { status: "error", errors: {}, message: MENSAJES_INSCRIPCION.sin_inscripcion };
  }

  const pagado = consulta.valor.porcentaje_pagado;
  const enRevision = consulta.valor.porcentaje_en_revision;
  if (!porcentajeValido(porcentaje, t.porcentajesPago, pagado, enRevision)) {
    return { status: "error", errors: { porcentaje: MENSAJES_INSCRIPCION.porcentaje_no_permitido } };
  }
  if (pagado + enRevision + porcentaje < 100 && formData.get("policy") !== "on") {
    return { status: "error", errors: { policy: "Debes aceptar la condición del abono para registrarlo." } };
  }

  const guardado = await guardarComprobante({
    tallerId: t.id,
    tallerSlug: t.slug,
    documento,
    porcentaje,
    correcciones,
    notas,
    archivo: file,
  });

  if (guardado.ok) {
    return {
      status: "ok",
      porcentaje,
      referencia: guardado.valor.referencia,
      completo: pagado + guardado.valor.enRevision >= 100,
      handoffUrl: handoff(guardado.valor.referencia),
    };
  }

  const motivo = guardado.motivo;
  if (motivo === "porcentaje_no_permitido" || motivo === "sin_saldo") {
    return { status: "error", errors: { porcentaje: MENSAJES_INSCRIPCION[motivo] } };
  }
  return {
    status: "error",
    errors: {},
    message:
      motivo === "error" || motivo === "sin_conexion"
        ? "No pudimos recibir tu comprobante. Envíanoslo por WhatsApp y lo registramos a mano."
        : MENSAJES_INSCRIPCION[motivo],
    handoffUrl: handoff(null),
  };
}
