import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta en `.next/standalone` solo lo necesario para producción:
  // el Dockerfile copia esa carpeta y arranca `node server.js`.
  output: "standalone",
  experimental: {
    serverActions: {
      // El registro de pago sube el comprobante por un server action, cuyo
      // límite por defecto es 1 MB. Los comprobantes admiten hasta 5 MB
      // (`PROOF_MAX_BYTES`); el resto es margen para los campos del formulario.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
