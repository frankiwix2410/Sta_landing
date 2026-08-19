import type { Metadata } from "next";
import { Anton, Archivo, Montserrat } from "next/font/google";
import { Providers } from "@/components/providers";
import { site } from "@/lib/site";
import "./globals.css";

/** Anton solo publica un peso (400): los títulos no deben pedir bold. */
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const archivo = Archivo({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const montserrat = Montserrat({
  weight: ["300", "400", "500", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.doctor} · Sedación y Técnicas Analgésicas Avanzadas`,
  description:
    "Especialista en sedación y técnicas analgésicas avanzadas. Procedimientos seguros, confortables y sin dolor, con acompañamiento clínico cercano.",
  keywords: [
    "sedación",
    "anestesiología",
    "analgesia avanzada",
    "bloqueos regionales",
    "manejo del dolor",
  ],
  openGraph: {
    title: `${site.doctor} · ${site.brandFull}`,
    description:
      "Procedimientos seguros, confortables y sin dolor. Sedación consciente, sedación profunda y técnicas analgésicas avanzadas.",
    type: "website",
    locale: "es_CO",
  },
  robots: { index: true, follow: true },
};

/** Datos estructurados para que los buscadores reconozcan la ficha del médico. */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Physician",
  name: site.doctor,
  medicalSpecialty: "Anesthesia",
  description:
    "Especialista en sedación y técnicas analgésicas avanzadas. Procedimientos seguros, confortables y sin dolor.",
  sameAs: [site.instagramUrl],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${anton.variable} ${archivo.variable} ${montserrat.variable} antialiased`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
