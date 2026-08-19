export const site = {
  doctor: "Dr. Stevan J. Camelo C.",
  brand: "STA",
  brandFull: "Sedación y Técnicas Analgésicas Avanzadas",
  // TODO: reemplazar por el número real del consultorio
  whatsapp: "573014750515",
  instagram: "sta_sedacion",
  instagramUrl: "https://instagram.com/sta_sedacion",
} as const;

export function waLink(text: string) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
