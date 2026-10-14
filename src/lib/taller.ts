/**
 * Contenido por defecto de la página del taller: lo que no cambia entre
 * ediciones (instructor, módulos, galería, FAQ, contactos).
 *
 * Lo operativo —título, fechas, sede, cupos, precios, estado— vive en la
 * tabla `talleres` y se edita desde /admin. Si un taller trae su propio
 * `contenido` en la base, este queda como respaldo.
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

  /**
   * Foto grande del hero. Es distinta a la del instructor a propósito: la
   * misma imagen dos veces en la misma página se lee como plantilla.
   */
  heroPhoto: {
    src: "/assets/taller-bomba-tci.webp",
    alt: "Stevan J. Camelo junto a una bomba de infusión para sedación TCI",
  },

  instructor: {
    name: "Stevan J. Camelo Castañeda",
    role: "Anestesiólogo intervencionista",
    /** Así firma en los certificados (nombre corto y documento). */
    signature: {
      name: "MD. Stevan J. Camelo C.",
      title: "Anestesiólogo",
      document: "C.C. 1.136.882.468",
    },
    photo: "/assets/dr-oficina-sonrisa.webp",
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
    region: "Zulia",
    country: "Venezuela",
  },

  /** Fechas del taller. `iso` alimenta el JSON-LD; `label` es lo que se lee en pantalla. */
  dates: {
    label: "Octubre 24 y 25, 2026",
    short: "24–25 OCT 2026",
    startIso: "2026-10-24T08:00:00-04:00",
    endIso: "2026-10-25T17:00:00-04:00",
  },

  endorsement: "Avalado por SCARE – SARG",

  /**
   * Escasez que se anuncia en el hero y encima del formulario. `value` va en
   * grande y `label` debajo; juntos forman la frase "100% de cupos vendidos".
   */
  scarcity: {
    value: "100%",
    label: "de cupos vendidos",
  },

  /**
   * Edición llena: en vez del formulario de reserva se muestra el panel de
   * cupos agotados con el botón de lista de espera, y el servidor rechaza
   * cualquier reserva nueva. El registro de pago sigue abierto, porque quien
   * ya reservó todavía tiene que subir su comprobante.
   *
   * Cuando abras cupos otra vez (o programes una edición nueva), pon `false`
   * y ajusta `scarcity`.
   */
  soldOut: true,

  /**
   * Galería de la página del taller. Fotos propias del equipo: si se
   * reemplazan, conviene que sigan siendo verticales para la retícula.
   */
  gallery: [
    {
      src: "/assets/taller-docencia-sta.webp",
      alt: "Stevan J. Camelo exponiendo frente a la pantalla con el logo de STA",
      caption: "Fundamento teórico antes de cada estación",
    },
    {
      src: "/assets/taller-quirofano-perfil.webp",
      alt: "Anestesiólogo con gorro y mascarilla en quirófano",
      caption: "Técnica y asepsia como se hacen en quirófano",
    },
    {
      src: "/assets/taller-equipo-mesa.webp",
      alt: "Preparación de material e insumos sobre la mesa de trabajo",
      caption: "Equipos y material listos antes de empezar",
    },
    {
      src: "/assets/taller-quirofano-paciente.webp",
      alt: "Monitorización y preparación del paciente antes del procedimiento",
      caption: "Monitorización y preparación del paciente",
    },
    {
      src: "/assets/taller-explicacion.webp",
      alt: "Stevan J. Camelo explicando durante una sesión de formación",
      caption: "Acompañamiento en grupos reducidos",
    },
    {
      src: "/assets/dr-consultorio-azul.webp",
      alt: "Stevan J. Camelo en su consultorio",
      caption: "Quien dirige el taller, en su día a día",
    },
  ],

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

  /**
   * Condición del abono. Se muestra junto al registro de pago y en el
   * formulario, donde hay que aceptarla para registrar un abono.
   */
  payment: {
    policy:
      "Si no pagas a tiempo el 50% restante, no hay reembolso del abono: ese primer 50% cubre los gastos operativos del taller.",
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
      a: "Al enviar el formulario generamos tu reserva con un número de referencia y te contactamos por WhatsApp para cerrar el pago. Cuando pagues —abono del 50% o pago completo— sube tu comprobante en «Registrar pago»: ahí te asignamos tu número de reserva si aún no lo tenías. El cupo queda confirmado cuando verificamos el pago.",
    },
    {
      q: "¿Me devuelven el abono si no completo el pago?",
      a: "No. Si no pagas a tiempo el 50% restante, no hay reembolso del abono, porque ese 50% cubre los gastos operativos del taller.",
    },
  ],
} as const;

/** Lo que comparten todas las ediciones. Ver comentario de cabecera. */
export const contenidoTaller = {
  heroPhoto: taller.heroPhoto,
  instructor: taller.instructor,
  gallery: taller.gallery,
  contact: taller.contact,
  modules: taller.modules,
  highlights: taller.highlights,
  payment: taller.payment,
  faq: taller.faq,
} as const;

export type ContenidoTaller = typeof contenidoTaller;

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
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function tallerWaLink(text: string) {
  return `https://wa.me/${taller.contact.whatsapp}?text=${encodeURIComponent(text)}`;
}
