/** Bucket privado de Supabase Storage (ver `supabase/schema.sql`). */
export const PROOF_BUCKET = "comprobantes";

export type ProofFile = { bytes: Uint8Array; type: string; ext: string };

const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/**
 * Identifica el formato por sus primeros bytes.
 *
 * El `type` que manda el navegador lo decide quien envía la petición, así que
 * no se usa: un `.html` renombrado a `.jpg` se rechaza aquí y nunca llega al
 * bucket. Además los HEIC del iPhone suelen llegar con `type` vacío.
 */
export function sniffProof(bytes: Uint8Array): Omit<ProofFile, "bytes"> | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return { type: "image/png", ext: "png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return { type: "image/webp", ext: "webp" };
  if (ascii(bytes, 0, 5) === "%PDF-") return { type: "application/pdf", ext: "pdf" };

  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (HEIC_BRANDS.has(brand)) return { type: "image/heic", ext: "heic" };
    if (HEIF_BRANDS.has(brand)) return { type: "image/heif", ext: "heif" };
  }

  return null;
}
