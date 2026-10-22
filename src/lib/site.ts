export const site = {
  doctor: "Dr. Stevan J. Camelo C.",
  brand: "STA",
  brandFull: "Sedación y Técnicas Analgésicas Avanzadas",
  // Lo leen el badge del hero y la cifra de stats: cambiarlo aquí basta.
  yearsExperience: 12,
  // TODO: reemplazar por el número real del consultorio
  whatsapp: "573014750515",
  instagram: "sta_sedacion",
  instagramUrl: "https://instagram.com/sta_sedacion",
  /**
   * Dirección pública del sitio, la que abre el QR del certificado. Va fija:
   * `NEXT_PUBLIC_SITE_URL` se graba al compilar y la imagen se compila en
   * GitHub Actions, no en Dokploy, así que la variable del servidor no llega.
   */
  url: "https://www.stasedacion.com",
} as const;

export function waLink(text: string) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
