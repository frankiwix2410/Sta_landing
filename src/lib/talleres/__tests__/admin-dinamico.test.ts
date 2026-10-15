import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda página del admin tiene que declarar `dynamic = "force-dynamic"`.
 *
 * El build de CI no tiene `CERTIFICADOS_PASSWORD`: `puertaAdmin()` llama a
 * `notFound()` antes de leer cookies, Next no ve ninguna API dinámica y
 * congela la página como un 404 estático. En producción eso salía como 500.
 */
function paginas(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return paginas(ruta);
    return nombre === "page.tsx" ? [ruta] : [];
  });
}

describe("páginas del admin", () => {
  const raiz = join(process.cwd(), "src/app/admin");

  it.each(paginas(raiz))("%s es dinámica", (ruta) => {
    expect(readFileSync(ruta, "utf8")).toMatch(/export const dynamic = "force-dynamic"/);
  });
});
