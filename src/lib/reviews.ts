/**
 * Reseñas del perfil de Google del consultorio.
 *
 * Se leen con Places API (New). Dos cosas condicionan todo el diseño de este
 * módulo y conviene tenerlas presentes antes de tocarlo:
 *
 * 1. Google devuelve **como mucho 5** reseñas y las elige él. No hay paginación
 *    ni forma de filtrar: si hay una mala y Google la considera relevante, sale.
 * 2. Sus términos **prohíben cachear** el contenido de las reseñas, así que cada
 *    lectura es una llamada de pago (`reviews` es del nivel Enterprise). Por eso
 *    el componente solo la dispara cuando la sección entra en pantalla, y no en
 *    cada carga de la página.
 *
 * https://developers.google.com/maps/documentation/places/web-service/policies
 */

/** Campos pedidos. Basta con incluir `reviews` para que toda la petición pase
 *  a tarifa Enterprise, así que el resto no añade coste. */
const FIELD_MASK = "displayName,rating,userRatingCount,googleMapsUri,reviews";

type LocalizedText = { text?: string; languageCode?: string };

type ApiReview = {
  name?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  text?: LocalizedText;
  originalText?: LocalizedText;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
};

type ApiPlace = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: ApiReview[];
};

export type Review = {
  id: string;
  author: string;
  /** Enlace al perfil del autor. Mostrarlo es requisito de atribución. */
  authorUri: string | null;
  photoUri: string | null;
  rating: number;
  text: string;
  /** "hace 2 meses", ya localizado por Google. */
  when: string;
  /** Enlace a la reseña completa en Google. */
  uri: string | null;
};

export type Reviews = {
  /** Nota media del perfil. */
  rating: number | null;
  /** Total de reseñas del perfil, no de las 5 que devuelve. */
  count: number | null;
  mapsUri: string | null;
  items: Review[];
};

/** Estados que el cliente sabe distinguir para caer al texto curado. */
export type ReviewsResult =
  | { status: "ok"; reviews: Reviews }
  | { status: "not_configured" }
  | { status: "error" };

export function reviewsConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_PLACE_ID);
}

export async function fetchReviews(lang: "es" | "en"): Promise<ReviewsResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return { status: "not_configured" };

  const url =
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
    `?languageCode=${lang}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      // Obligatorio por los términos de Google: las reseñas se piden en vivo.
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
  } catch (error) {
    console.error("[resenas] la petición a Google falló", error);
    return { status: "error" };
  }

  if (!res.ok) {
    console.error("[resenas] Google respondió", res.status, await res.text().catch(() => ""));
    return { status: "error" };
  }

  const place = (await res.json()) as ApiPlace;

  const items: Review[] = (place.reviews ?? [])
    // `languageCode=es` hace que `text` venga traducido; si Google no puede,
    // se cae al original en vez de dejar la tarjeta vacía.
    .map((r, i) => ({
      id: r.name ?? `review-${i}`,
      author: r.authorAttribution?.displayName ?? "",
      authorUri: r.authorAttribution?.uri ?? null,
      photoUri: r.authorAttribution?.photoUri ?? null,
      rating: typeof r.rating === "number" ? r.rating : 0,
      text: (r.text?.text ?? r.originalText?.text ?? "").trim(),
      when: r.relativePublishTimeDescription ?? "",
      uri: r.googleMapsUri ?? null,
    }))
    .filter((r) => r.text.length > 0 && r.author.length > 0);

  return {
    status: "ok",
    reviews: {
      rating: typeof place.rating === "number" ? place.rating : null,
      count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      mapsUri: place.googleMapsUri ?? null,
      items,
    },
  };
}
