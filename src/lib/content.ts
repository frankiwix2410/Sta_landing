import { site } from "@/lib/site";

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
      experience: "años de experiencia",
      education: {
        t: "Formación",
        items: [
          { title: "Médico", place: "Universidad de Pamplona" },
          { title: "Especialista en Anestesiología", place: "Universidad del Zulia" },
        ],
      },
      certifications: {
        t: "Certificaciones",
        items: [
          "Anestesia fuera del quirófano",
          "Instructor de anestesia regional ecoguiada",
          "Manejo intervencionista del dolor",
          "Docencia universitaria",
          // Espacios duros: la sigla no debe partirse en dos líneas.
          "Junta directiva SARG – SCARE",
        ],
      },
      focus: {
        t: "Enfoque",
        items: [
          "Sedación fuera de quirófano",
          "Manejo avanzado del dolor",
          "Optimización preoperatoria",
          "Educación médica avanzada",
        ],
      },
    },
    services: {
      eyebrow: "Servicios y técnicas",
      title: ["Técnicas avanzadas,", "procedimientos serenos"],
      lead: "Cada técnica se elige después de valorar tu historia clínica y el procedimiento que vas a recibir. Nunca al revés.",
      items: [
        {
          t: "Sedación en procedimientos médicos y odontológicos",
          d: "Sedación consciente o profunda con monitorización continua, para vivir tu procedimiento con tranquilidad y sin dolor.",
        },
        {
          t: "Optimización preoperatoria",
          d: "Evaluación integral antes del procedimiento para preparar tu condición clínica y planificar la técnica más segura.",
        },
        {
          t: "Manejo avanzado del dolor agudo y crónico",
          d: "Analgesia multimodal, bloqueos guiados por ecografía y técnicas intervencionistas, personalizadas a cada paciente.",
        },
        {
          t: "Educación médica especializada",
          d: "Talleres y docencia en anestesia regional ecoguiada y sedación para anestesiólogos, residentes y médicos.",
        },
      ],
    },
    stats: {
      eyebrow: "Por qué elegirme",
      title: ["Confianza respaldada", "por resultados"],
      items: [
        { n: site.yearsExperience, suffix: "+", label: "Años de experiencia" },
        { n: 1100, suffix: "+", label: "Procedimientos realizados" },
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
        "El Dr. Camelo sonríe de brazos cruzados en el quirófano, bajo las lámparas encendidas.",
        "Dos participantes del taller practican una punción guiada por ecografía sobre modelo.",
        "El Dr. Camelo carga la medicación bajo la lámpara del quirófano.",
        "El Dr. Camelo prepara una jeringa frente a la máquina de anestesia y el monitor de constantes.",
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
      // Reseñas reales del perfil de Google (5★), con ortografía corregida,
      // sin emojis y con el apellido abreviado.
      items: [
        {
          q: "Del doctor tengo mucho agradecimiento: desde el día uno que nos pusimos en contacto fue atento, amable y responsable. Para mí, el mejor anestesiólogo. Muy empático, todo muy positivo. ¡Recomendadísimo!",
          a: "Angie R.",
        },
        {
          q: "¡Excelente servicio! Amé la bomba del dolor. Pude ir a trabajar sin problema. ¡Gracias! Recomendado.",
          a: "Maritza M.",
        },
        {
          q: "La atención por parte del Dr. Camelo es excelente. Es un doctor que te acompaña en todo tu proceso y está pendiente de tu salud. Si quieres un anestesiólogo con atención humana, te lo recomiendo.",
          a: "Elis Ana P.",
        },
        {
          q: "Excelente atención y explicación sobre el tratamiento de la bomba del dolor. Muy amable y atento a mis inquietudes.",
          a: "Alejandra S.",
        },
        {
          q: "¡Excelente servicio! El mejor: amabilidad, humanidad, empatía. 10/10.",
          a: "María Mónica M.",
        },
        {
          q: "Excelente atención, amabilidad y calidad en el servicio. Gracias por tanto, los súper recomiendo.",
          a: "Sandra S.",
        },
        {
          q: "El servicio es excelente, te brindan la ayuda que necesitas para tu situación. Gracias por su apoyo, doc.",
          a: "Ana C.",
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
      experience: "years of experience",
      education: {
        t: "Education",
        items: [
          { title: "Physician", place: "Universidad de Pamplona" },
          { title: "Anesthesiology specialist", place: "Universidad del Zulia" },
        ],
      },
      certifications: {
        t: "Certifications",
        items: [
          "Non-operating room anesthesia",
          "Ultrasound-guided regional anesthesia instructor",
          "Interventional pain management",
          "University teaching",
          "Board member, SARG – SCARE",
        ],
      },
      focus: {
        t: "Approach",
        items: [
          "Sedation outside the operating room",
          "Advanced pain management",
          "Preoperative optimization",
          "Advanced medical education",
        ],
      },
    },
    services: {
      eyebrow: "Services & techniques",
      title: ["Advanced techniques,", "serene procedures"],
      lead: "Every technique is chosen after assessing your medical history and the procedure you are about to receive. Never the other way around.",
      items: [
        {
          t: "Sedation for medical and dental procedures",
          d: "Conscious or deep sedation with continuous monitoring, so you go through your procedure calmly and pain-free.",
        },
        {
          t: "Preoperative optimization",
          d: "A thorough assessment before your procedure to prepare your clinical condition and plan the safest technique.",
        },
        {
          t: "Advanced acute and chronic pain management",
          d: "Multimodal analgesia, ultrasound-guided blocks and interventional techniques, tailored to each patient.",
        },
        {
          t: "Specialized medical education",
          d: "Workshops and teaching in ultrasound-guided regional anesthesia and sedation for anesthesiologists, residents and physicians.",
        },
      ],
    },
    stats: {
      eyebrow: "Why choose me",
      title: ["Trust backed", "by results"],
      items: [
        { n: site.yearsExperience, suffix: "+", label: "Years of experience" },
        { n: 1100, suffix: "+", label: "Procedures performed" },
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
        "Dr. Camelo smiling with arms crossed in the operating theatre, under the surgical lights.",
        "Two workshop participants practising an ultrasound-guided puncture on a model.",
        "Dr. Camelo drawing up medication under the theatre light.",
        "Dr. Camelo preparing a syringe in front of the anesthesia machine and vitals monitor.",
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
      // Real 5★ Google reviews, translated from Spanish.
      items: [
        {
          q: "I am deeply grateful to the doctor: from the very first day we got in touch he was attentive, kind and responsible. To me, the best anesthesiologist. Very empathetic, everything was positive. Highly recommended!",
          a: "Angie R.",
        },
        {
          q: "Excellent service! I loved the pain pump. I was able to go to work with no problem. Thank you! Recommended.",
          a: "Maritza M.",
        },
        {
          q: "The care from Dr. Camelo is excellent. He is a doctor who stays with you throughout your whole process and looks after your health. If you want an anesthesiologist with a human touch, I recommend him.",
          a: "Elis Ana P.",
        },
        {
          q: "Excellent care and a clear explanation of the pain pump treatment. Very kind and attentive to my concerns.",
          a: "Alejandra S.",
        },
        {
          q: "Excellent service! The best: kindness, humanity, empathy. 10/10.",
          a: "María Mónica M.",
        },
        {
          q: "Excellent care, kindness and quality of service. Thank you for everything, I highly recommend them.",
          a: "Sandra S.",
        },
        {
          q: "The service is excellent, they give you the help you need for your situation. Thank you for your support, doc.",
          a: "Ana C.",
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
