import type { Money } from "@/lib/payments";
import { taller } from "@/lib/taller";
import { getSupabase } from "./supabase";
import type { PaymentKind } from "./types";

/** Bucket privado de Supabase Storage (ver `supabase/schema.sql`). */
export const PROOF_BUCKET = "comprobantes";

export type ProofFile = { bytes: Uint8Array; type: string; ext: string };

export type PaymentProofDraft = {
  kind: PaymentKind;
  /** Referencia de una reserva hecha antes. `null` = crear la reserva ahora. */
  existingReference: string | null;
  /** Referencia que se asigna si hay que crear la reserva. */
  newReference: string;
  tierId: string;
  tierName: string;
  price: Money | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
    profession: string;
  };
  notes: string;
  file: ProofFile;
};

/**
 * - `saved`:             comprobante guardado; `reference` es el número de
 *                        reserva (el existente o el recién asignado).
 * - `unknown_reference`: la referencia escrita no corresponde a una reserva
 *                        activa de esta edición.
 * - `sold_out`/`closed`: no se pudo crear la reserva. Nada quedó guardado.
 * - `unstored`:          sin Supabase configurado.
 * - `error`:             fallo de Storage o de la base.
 */
export type SaveProofResult =
  | { kind: "saved"; reference: string }
  | { kind: "unknown_reference" }
  | { kind: "sold_out" }
  | { kind: "closed" }
  | { kind: "unstored" }
  | { kind: "error" };

/** Fila que devuelve `public.register_payment_proof`. */
type RegisterProofRow = {
  ok: boolean;
  reason: string | null;
  reservation_reference: string | null;
};

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

/**
 * Sube el comprobante y registra el pago, asignando el número de reserva.
 *
 * Primero el archivo y después la base: una reserva con comprobante que no
 * existe sería un pago que nadie puede verificar. La reserva y la fila del
 * comprobante las inserta `register_payment_proof` en una sola transacción; si
 * la función no las guarda, se borra el archivo para no dejar huérfanos.
 */
export async function savePaymentProof(draft: PaymentProofDraft): Promise<SaveProofResult> {
  const supabase = getSupabase();

  if (!supabase) {
    const { file, ...rest } = draft;
    console.info(
      "[taller] comprobante (sin Supabase)",
      JSON.stringify({ ...rest, size: file.bytes.length }),
    );
    return { kind: "unstored" };
  }

  const proofId = crypto.randomUUID();
  const path = `${taller.edition}/${proofId}.${draft.file.ext}`;
  const bucket = supabase.storage.from(PROOF_BUCKET);

  const upload = await bucket.upload(path, draft.file.bytes, {
    contentType: draft.file.type,
    upsert: false,
  });

  if (upload.error) {
    console.error("[taller] no se pudo subir el comprobante", { path, error: upload.error });
    return { kind: "error" };
  }

  const { data, error } = await supabase.rpc("register_payment_proof", {
    p_edition: taller.edition,
    p_proof_id: proofId,
    p_existing_reference: draft.existingReference,
    p_new_reference: draft.newReference,
    p_tier_id: draft.tierId,
    p_tier_name: draft.tierName,
    p_amount: draft.price?.amount ?? null,
    p_currency: draft.price?.currency ?? null,
    p_kind: draft.kind,
    p_name: draft.customer.name,
    p_email: draft.customer.email,
    p_phone: draft.customer.phone,
    p_city: draft.customer.city,
    p_profession: draft.customer.profession,
    p_notes: draft.notes,
    p_file_path: path,
    p_file_type: draft.file.type,
    p_file_size: draft.file.bytes.length,
  });

  const row = (data as RegisterProofRow[] | null)?.[0];

  if (row?.ok && row.reservation_reference) {
    return { kind: "saved", reference: row.reservation_reference };
  }

  await bucket.remove([path]);

  if (row?.reason === "unknown_reference") return { kind: "unknown_reference" };
  if (row?.reason === "sold_out") return { kind: "sold_out" };
  if (row?.reason === "closed") return { kind: "closed" };

  console.error("[taller] no se pudo registrar el comprobante", {
    path,
    reason: row?.reason,
    error,
  });
  return { kind: "error" };
}
