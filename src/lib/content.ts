export type Lang = "es" | "en";

export const content = {
  es: {
    nav: {
      about: "Sobre el médico",
      services: "Servicios",
      why: "Diferenciales",
      gallery: "Galería",
      contact: "Contacto",
      cta: "Agendar cita",
    },
    hero: {
      eyebrow: "Sedación · Analgesia avanzada",
      // Cada string es una línea; el título se anima palabra por palabra.
      title: ["Sedación", "sin miedo,"],
      titleAccent: "sin dolor.",
      spec: "Especialista en Sedación y Técnicas Analgésicas Avanzadas",
      sub: "Procedimientos seguros, confortables y sin dolor. Acompañamiento clínico cercano con la más alta especialización técnica.",
      cta1: "Agendar por WhatsApp",
      cta2: "Conocer al médico",
      badge: "años de experiencia clínica",
      scroll: "Desliza",
      videoAlt:
        "El Dr. Camelo acerca la mascarilla de sedación, visto desde la posición del paciente.",
      videoPause: "Pausar el video de portada",
      videoPlay: "Reproducir el video de portada",
    },
    marquee: [
      "Sedación consciente",
      "Bloqueos regionales",
      "Analgesia multimodal",
      "Monitorización avanzada",
      "Valoración preanestésica",
      "Dolor agudo",
    ],
    about: {
      eyebrow: "Sobre el médico",
      title: ["Ciencia y calidez", "en cada procedimiento"],
      p1: "Dr. Stevan J. Camelo C. es un profesional dedicado al manejo seguro de la sedación y el dolor. Su práctica combina rigor técnico con un trato humano que busca que cada paciente viva su procedimiento con tranquilidad y confianza.",
      p2: "[Texto placeholder — reemplazar por la biografía real.]",
      cards: [
        { t: "Formación", d: "Universidad · Especialidad [placeholder]" },
        { t: "Certificaciones", d: "Avales y membresías [placeholder]" },
        { t: "Trayectoria", d: "Años de práctica clínica [placeholder]" },
        { t: "Enfoque", d: "Seguridad y confort del paciente" },
      ],
    },
    services: {
      eyebrow: "Servicios y técnicas",
      title: ["Técnicas avanzadas,", "procedimientos serenos"],
      lead: "Cada técnica se elige después de valorar tu historia clínica y el procedimiento que vas a recibir. Nunca al revés.",
      items: [
        {
          t: "Sedación consciente",
          d: "Relajación controlada manteniendo la respuesta del paciente, ideal para procedimientos ambulatorios cortos.",
        },
        {
          t: "Sedación profunda",
          d: "Monitorización avanzada para procedimientos que requieren mayor profundidad, con máxima seguridad.",
        },
        {
          t: "Técnicas analgésicas avanzadas",
          d: "Estrategias multimodales para el control del dolor, personalizadas a cada procedimiento y paciente.",
        },
        {
          t: "Bloqueos regionales",
          d: "Analgesia dirigida guiada por ecografía para un alivio preciso y una recuperación más rápida.",
        },
        {
          t: "Manejo del dolor agudo",
          d: "Protocolos para el control del dolor postoperatorio, priorizando el confort y la pronta recuperación.",
        },
        {
          t: "Valoración preanestésica",
          d: "Evaluación integral previa para planificar la técnica más segura según tu historia clínica.",
        },
      ],
    },
    stats: {
      eyebrow: "Por qué elegirme",
      title: ["Confianza respaldada", "por resultados"],
      items: [
        { n: 12, suffix: "+", label: "Años de experiencia" },
        { n: 8000, suffix: "+", label: "Procedimientos realizados" },
        { n: 99, suffix: "%", label: "Satisfacción del paciente" },
        { n: 24, suffix: "/7", label: "Acompañamiento y respuesta" },
      ],
      note: "* Cifras de referencia — reemplazar por datos reales.",
    },
    gallery: {
      eyebrow: "Galería",
      title: ["Quirófano y formación"],
      note: "Quirófano, monitorización avanzada y talleres de bloqueos guiados por ecografía.",
      // El orden coincide con las celdas de <Gallery>.
      photos: [
        "El Dr. Camelo se enguanta junto a la máquina de anestesia antes de un procedimiento.",
        "Dos participantes del taller practican una punción guiada por ecografía sobre modelo.",
        "El Dr. Camelo carga la medicación bajo la lámpara del quirófano.",
        "El Dr. Camelo revisa el circuito y la mascarilla con el monitor de constantes al fondo.",
        "Vista superior del taller: la pantalla del ecógrafo y las manos guiando la aguja sobre el modelo.",
        "Un participante dirige la aguja con la sonda del ecógrafo durante el taller.",
      ],
    },
    testimonials: {
      eyebrow: "Testimonios",
      // Atribución exigida por los términos de Places API.
      source: "Reseñas de Google",
      ratingSuffix: "en Google",
      reviewsWord: "reseñas",
      viewOnGoogle: "Ver en Google",
      readFull: "Leer completa en Google",
      // Se muestran mientras cargan las de Google, y si no hay o fallan.
      items: [
        {
          q: "Nunca me sentí tan tranquilo antes de un procedimiento. Todo fue claro, humano y sin dolor.",
          a: "Paciente [placeholder]",
        },
        {
          q: "Profesionalismo absoluto. Me explicó cada paso y me sentí en las mejores manos.",
          a: "Paciente [placeholder]",
        },
        {
          q: "La sedación fue impecable y la recuperación rapidísima. Lo recomiendo con total confianza.",
          a: "Paciente [placeholder]",
        },
      ],
    },
    contact: {
      eyebrow: "Contacto",
      title: ["Agenda tu valoración"],
      sub: "Escríbeme para resolver tus dudas o programar tu procedimiento con total tranquilidad.",
      waTitle: "WhatsApp",
      waDesc: "Chatea directamente conmigo",
      igDesc: "Síguenos en Instagram",
      hoursTitle: "Horario de atención",
      hoursDesc: "Lun – Vie · 8:00 a.m. – 6:00 p.m. [placeholder]",
      form: {
        name: "Nombre completo",
        namePh: "Tu nombre",
        phone: "Teléfono / WhatsApp",
        phonePh: "+57 ___ ___ ____",
        msg: "Mensaje",
        msgPh: "Cuéntame sobre tu procedimiento",
        send: "Enviar por WhatsApp",
        note: "Ubicación y mapa embebido — pendiente de la dirección del consultorio.",
      },
    },
    footer: {
      tag: "Sedación y Técnicas Analgésicas Avanzadas. Procedimientos seguros, confortables y sin dolor.",
      nav: "Navegación",
      social: "Redes",
      wa: "WhatsApp",
      privacy: "Aviso de privacidad",
      legal: "Aviso legal",
    },
    wa: {
      book: "Hola, quisiera agendar una valoración para un procedimiento con sedación.",
      form: (name: string, phone: string, msg: string) =>
        `Hola, soy ${name} (${phone}). ${msg}`,
    },
  },

  en: {
    nav: {
      about: "About",
      services: "Services",
      why: "Why me",
      gallery: "Gallery",
      contact: "Contact",
      cta: "Book now",
    },
    hero: {
      eyebrow: "Sedation · Advanced analgesia",
      title: ["Sedation", "without fear,"],
      titleAccent: "without pain.",
      spec: "Specialist in Sedation & Advanced Analgesic Techniques",
      sub: "Safe, comfortable and pain-free procedures. Close clinical care with the highest technical expertise in sedation.",
      cta1: "Book on WhatsApp",
      cta2: "Meet the doctor",
      badge: "years of clinical experience",
      scroll: "Scroll",
      videoAlt:
        "Dr. Camelo lowering the sedation mask, seen from the patient's point of view.",
      videoPause: "Pause cover video",
      videoPlay: "Play cover video",
    },
    marquee: [
      "Conscious sedation",
      "Regional blocks",
      "Multimodal analgesia",
      "Advanced monitoring",
      "Pre-anesthetic assessment",
      "Acute pain",
    ],
    about: {
      eyebrow: "About the doctor",
      title: ["Science and warmth", "in every procedure"],
      p1: "Dr. Stevan J. Camelo C. is a professional devoted to the safe management of sedation and pain. His practice blends technical rigor with a human touch so every patient goes through their procedure calmly and confidently.",
      p2: "[Placeholder text — replace with the real bio.]",
      cards: [
        { t: "Education", d: "University · Specialty [placeholder]" },
        { t: "Certifications", d: "Endorsements & memberships [placeholder]" },
        { t: "Track record", d: "Years of clinical practice [placeholder]" },
        { t: "Approach", d: "Patient safety and comfort" },
      ],
    },
    services: {
      eyebrow: "Services & techniques",
      title: ["Advanced techniques,", "serene procedures"],
      lead: "Every technique is chosen after assessing your medical history and the procedure you are about to receive. Never the other way around.",
      items: [
        {
          t: "Conscious sedation",
          d: "Controlled relaxation while keeping the patient responsive — ideal for short outpatient procedures.",
        },
        {
          t: "Deep sedation",
          d: "Advanced monitoring for procedures that need greater depth, with maximum safety.",
        },
        {
          t: "Advanced analgesic techniques",
          d: "Multimodal strategies for pain control, tailored to each procedure and patient.",
        },
        {
          t: "Regional blocks",
          d: "Ultrasound-guided targeted analgesia for precise relief and faster recovery.",
        },
        {
          t: "Acute pain management",
          d: "Protocols for postoperative pain control, prioritizing comfort and swift recovery.",
        },
        {
          t: "Pre-anesthetic assessment",
          d: "A thorough prior evaluation to plan the safest technique for your medical history.",
        },
      ],
    },
    stats: {
      eyebrow: "Why choose me",
      title: ["Trust backed", "by results"],
      items: [
        { n: 12, suffix: "+", label: "Years of experience" },
        { n: 8000, suffix: "+", label: "Procedures performed" },
        { n: 99, suffix: "%", label: "Patient satisfaction" },
        { n: 24, suffix: "/7", label: "Care and response" },
      ],
      note: "* Reference figures — replace with real data.",
    },
    gallery: {
      eyebrow: "Gallery",
      title: ["Theatre and training"],
      note: "Operating theatre, advanced monitoring and ultrasound-guided block workshops.",
      // The order matches the cells in <Gallery>.
      photos: [
        "Dr. Camelo gloving up next to the anesthesia machine before a procedure.",
        "Two workshop participants practising an ultrasound-guided puncture on a model.",
        "Dr. Camelo drawing up medication under the theatre light.",
        "Dr. Camelo checking the circuit and mask with the vitals monitor behind him.",
        "Overhead view of the workshop: the ultrasound screen and hands guiding the needle on the model.",
        "A participant guiding the needle with the ultrasound probe during the workshop.",
      ],
    },
    testimonials: {
      eyebrow: "Testimonials",
      // Attribution required by the Places API terms.
      source: "Google reviews",
      ratingSuffix: "on Google",
      reviewsWord: "reviews",
      viewOnGoogle: "View on Google",
      readFull: "Read in full on Google",
      // Shown while the Google ones load, and if there are none or they fail.
      items: [
        {
          q: "I have never felt so calm before a procedure. Everything was clear, human and pain-free.",
          a: "Patient [placeholder]",
        },
        {
          q: "Absolute professionalism. He explained every step and I felt in the best hands.",
          a: "Patient [placeholder]",
        },
        {
          q: "The sedation was flawless and recovery was incredibly fast. I recommend him with complete confidence.",
          a: "Patient [placeholder]",
        },
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: ["Book your assessment"],
      sub: "Write to me to clear up any questions or schedule your procedure with complete peace of mind.",
      waTitle: "WhatsApp",
      waDesc: "Chat directly with me",
      igDesc: "Follow us on Instagram",
      hoursTitle: "Opening hours",
      hoursDesc: "Mon – Fri · 8:00 a.m. – 6:00 p.m. [placeholder]",
      form: {
        name: "Full name",
        namePh: "Your name",
        phone: "Phone / WhatsApp",
        phonePh: "+57 ___ ___ ____",
        msg: "Message",
        msgPh: "Tell me about your procedure",
        send: "Send via WhatsApp",
        note: "Location and embedded map — pending the clinic address.",
      },
    },
    footer: {
      tag: "Sedation & Advanced Analgesic Techniques. Safe, comfortable and pain-free procedures.",
      nav: "Navigation",
      social: "Social",
      wa: "WhatsApp",
      privacy: "Privacy notice",
      legal: "Legal notice",
    },
    wa: {
      book: "Hello, I would like to schedule an assessment for a procedure under sedation.",
      form: (name: string, phone: string, msg: string) =>
        `Hello, I am ${name} (${phone}). ${msg}`,
    },
  },
} as const;

export type Content = (typeof content)["es"];
