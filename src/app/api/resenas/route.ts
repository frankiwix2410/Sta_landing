import { fetchReviews } from "@/lib/reviews";

/**
 * Proxy de las reseñas de Google.
 *
 * Existe para que la clave de Places no salga del servidor y para que la home
 * siga siendo estática: si la página pidiera las reseñas al renderizar, toda la
 * landing pasaría a dinámica y cada visita costaría una llamada. Así solo se
 * paga cuando alguien llega de verdad a la sección de testimonios.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "es";
  const result = await fetchReviews(lang);

  return Response.json(result, {
    // Los términos de Google prohíben almacenar el contenido de las reseñas:
    // ni el navegador ni la CDN deben guardarse esta respuesta.
    headers: { "Cache-Control": "no-store" },
  });
}
