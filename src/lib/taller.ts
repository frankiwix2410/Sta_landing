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

const contenido = {
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
      q: "¿Cómo descargo mi certificado?",
      a: "Cuando el taller termina, si tienes el pago completo y la asistencia registrada, tu certificado queda listo con tu nombre y tu documento. Búscalo en la sección «Certificados» de esta página con tu número de documento y guárdalo en PDF. Lleva un código y un QR para que cualquiera pueda verificarlo.",
    },
    {
      q: "¿Cómo se confirma mi cupo?",
      a: "Al enviar el formulario con tu número de documento generamos tu reserva y te contactamos por WhatsApp para cerrar el pago. Cuando pagues, entra en «Registrar pago», escribe el mismo documento y sube el comprobante. El cupo queda confirmado cuando verificamos el pago.",
    },
    {
      q: "¿Me devuelven el abono si no completo el pago?",
      a: "No. Si no pagas a tiempo el 50% restante, no hay reembolso del abono, porque ese 50% cubre los gastos operativos del taller.",
    },
  ],
} as const;

export const contenidoTaller = contenido;

export type ContenidoTaller = typeof contenidoTaller;

/** Formatea un importe en la moneda indicada para mostrarlo en pantalla. */
export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function tallerWaLink(text: string) {
  return `https://wa.me/${contenido.contact.whatsapp}?text=${encodeURIComponent(text)}`;
}
