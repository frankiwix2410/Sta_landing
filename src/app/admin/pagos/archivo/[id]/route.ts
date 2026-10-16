import { isAdmin } from "@/lib/admin-auth";
import { esUuid } from "@/lib/inscripciones/formulario";
import { urlFirmadaComprobante } from "@/lib/inscripciones/repo";

// Lee la cookie de sesión en cada petición: nada que cachear.
export const dynamic = "force-dynamic";

/**
 * Abre el comprobante. El bucket es privado: se firma una URL de dos minutos
 * en el momento del clic, así un enlace copiado de la pantalla caduca solo.
 * La cookie del admin tiene `path=/admin`, por eso la ruta vive aquí.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("No encontrado", { status: 404 });

  const { id } = await ctx.params;
  if (!esUuid(id)) return new Response("No encontrado", { status: 404 });

  const url = await urlFirmadaComprobante(id);
  if (!url) return new Response("No encontrado", { status: 404 });

  return Response.redirect(url, 302);
}
