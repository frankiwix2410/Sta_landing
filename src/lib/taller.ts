/**
 * Datos del taller. Todo lo editable de la landing `/taller` vive aquí:
 * fechas, sede, contenido, contactos y precios.
 *
 * Los datos provienen de los flyers oficiales del evento (julio 2026).
 */

export const taller = {
  /**
   * Identifica esta convocatoria en la base de datos: es la fila de
   * `taller_editions` contra la que se cuentan los cupos. Al programar una
   * edición nueva, crea la fila en Supabase y cambia este valor — así las
   * reservas viejas no consumen plazas de la nueva.
   */
  edition: "taller-2026-10",

  title: "Anestesia Regional Ecoguiada",
  titleAccent: "+ Sedación TCI",
  kind: "Taller presencial",

  instructor: {
    name: "Stevan J. Camelo Castañeda",
    role: "Anestesiólogo intervencionista",
    photo: "/assets/dr-quirofano.webp",
    credentials: [
      "Anestesiólogo intervencionista",
      "Entrenamiento avanzado en anestesia regional y accesos vasculares ecoguiados",
      "Manejo avanzado del dolor",
      "Docencia universitaria",
      "Miembro de la junta directiva SARG – SCARE",
    ],
  },

  venue: {
    name: "Policlínico San Francisco",
    city: "Maracaibo",
    country: "Venezuela",
  },

  /** Fechas del taller. `iso` alimenta el JSON-LD; `label` es lo que se lee en pantalla. */
  dates: {
    label: "Octubre 23 y 24, 2026",
    short: "23–24 OCT 2026",
    startIso: "2026-10-23T08:00:00-04:00",
    endIso: "2026-10-24T17:00:00-04:00",
  },

  endorsement: "Avalado por SCARE – SARG",
  scarcity: "80% de cupos vendidos",

  contact: {
    /** Número principal: recibe las reservas del formulario. */
    whatsapp: "573014750515",
    whatsappLabel: "+57 301 475 0515",
    phoneAlt: "+57 301 475 0515",
    instagram: "sta_sedacion",
    instagramUrl: "https://instagram.com/sta_sedacion",
  },

  modules: [
    { n: "01", title: "Generalidades del Ultrasonido", desc: "Física, artefactos, manejo del equipo y optimización de la imagen." },
    { n: "02", title: "Taller de Accesos Vasculares y Phantoms", desc: "Práctica guiada sobre phantoms: punción en plano y fuera de plano." },
    { n: "03", title: "Bloqueos de Miembro Superior", desc: "Interescalénico, supraclavicular, infraclavicular y axilar." },
    { n: "04", title: "Bloqueos de Miembro Inferior", desc: "Femoral, canal aductor, ciático y bloqueos de tobillo." },
    { n: "05", title: "Bloqueos de Tórax y Abdomen", desc: "PECS, serrato, erector espinal, TAP y bloqueos de pared." },
    { n: "06", title: "Taller Sedación TCI", desc: "Modelos farmacocinéticos, programación de bombas y titulación segura." },
    { n: "07", title: "Taller Analgesia Multimodal + Bombas Elastoméricas", desc: "Esquemas multimodales y analgesia continua ambulatoria." },
  ],

  highlights: [
    "Práctica hands-on con equipos de ultrasonido",
    "Phantoms y modelos anatómicos para cada bloqueo",
    "Grupos reducidos por estación de trabajo",
    "Certificado de asistencia avalado SCARE – SARG",
  ],

  /**
   * PRECIOS — TODO: confirmar antes de publicar.
   *
   * `published: false` hace que la página NO muestre ninguna cifra y que el
   * formulario funcione como reserva (el precio se informa al confirmar).
   * Cuando tengas los valores reales: corrige cada `amount`, ajusta
   * `currency` y pon `published: true`.
   */
  pricing: {
    published: false,
    currency: "COP" as const,
    /** Importes en la unidad menor de la moneda (COP no usa decimales: 1 = $1). */
    tiers: [
      {
        id: "general",
        name: "Cupo General",
        desc: "Acceso completo a los 7 módulos, prácticas y certificado.",
        amount: 0, // TODO: precio real
        featured: true,
      },
      {
        id: "residente",
        name: "Residente / Estudiante",
        desc: "Tarifa especial. Requiere certificado de residencia vigente.",
        amount: 0, // TODO: precio real
        featured: false,
      },
    ],
  },

  faq: [
    {
      q: "¿A quién está dirigido el taller?",
      a: "A anestesiólogos, residentes de anestesiología y médicos con interés en anestesia regional ecoguiada, accesos vasculares y sedación TCI.",
    },
    {
      q: "¿Necesito experiencia previa con ultrasonido?",
      a: "No. El módulo 01 arranca desde generalidades del ultrasonido, y la práctica está organizada en grupos reducidos para acompañar cada nivel.",
    },
    {
      q: "¿El taller entrega certificado?",
      a: "Sí. Al completar las dos jornadas recibes certificado de asistencia, avalado por SCARE – SARG.",
    },
    {
      q: "¿Cómo se confirma mi cupo?",
      a: "Al enviar el formulario generamos tu reserva con un número de referencia y te contactamos por WhatsApp para cerrar el pago. El cupo queda confirmado cuando se registra el pago.",
    },
  ],
} as const;

export type TallerTier = (typeof taller.pricing.tiers)[number];

/**
 * Modalidad con la que se registra toda reserva.
 *
 * El formulario ya no pregunta la modalidad, así que `tiers` queda solo como
 * catálogo interno: la tarifa de residente sigue existiendo para acordarla a
 * mano al confirmar, pero nadie la elige desde la web.
 */
export const defaultTier: TallerTier = taller.pricing.tiers[0];

/** Formatea un importe de `pricing.tiers` para mostrarlo en pantalla. */
export function formatPrice(amount: number, currency: string = taller.pricing.currency) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function tallerWaLink(text: string) {
  return `https://wa.me/${taller.contact.whatsapp}?text=${encodeURIComponent(text)}`;
}
