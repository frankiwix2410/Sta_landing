import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta en `.next/standalone` solo lo necesario para producción:
  // el Dockerfile copia esa carpeta y arranca `node server.js`.
  output: "standalone",
};

export default nextConfig;
