/**
 * Límite de frecuencia en la memoria del proceso.
 *
 * Frena a quien prueba documentos uno tras otro para ver quién está inscrito.
 * No es un sistema distribuido: el sitio corre en un solo contenedor y, si se
 * reinicia, el contador vuelve a cero — para este riesgo basta.
 */

export type Limitador = {
  permitir(clave: string, ahora?: number): boolean;
  /** Claves vivas en memoria (para pruebas y diagnóstico). */
  tamano(): number;
};

const MAX_CLAVES_POR_DEFECTO = 10000;

export function crearLimitador({
  max,
  ventanaMs,
  maxClaves = MAX_CLAVES_POR_DEFECTO,
}: {
  max: number;
  ventanaMs: number;
  maxClaves?: number;
}): Limitador {
  // Un Map conserva el orden de inserción: cada uso reinserta la clave al final,
  // así que las primeras son las menos recientes y son las que se expulsan.
  const golpes = new Map<string, number[]>();

  function guardar(clave: string, marcas: number[]) {
    golpes.delete(clave);
    golpes.set(clave, marcas);
    // Tope duro: la memoria no crece con cada IP que pase. Solo se recorre
    // lo que sobra, nunca el mapa entero.
    while (golpes.size > maxClaves) {
      const masAntigua = golpes.keys().next().value as string;
      golpes.delete(masAntigua);
    }
  }

  return {
    permitir(clave, ahora = Date.now()) {
      const recientes = (golpes.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      if (recientes.length >= max) {
        // Una llamada bloqueada no se apunta: no alarga la ventana.
        guardar(clave, recientes);
        return false;
      }
      recientes.push(ahora);
      guardar(clave, recientes);
      return true;
    },
    tamano: () => golpes.size,
  };
}

const MAX_LONGITUD_CLAVE = 64;

/**
 * IP del visitante. Confiamos en dos cabeceras que pone nuestro proxy
 * (Traefik de Dokploy), no en las que manda el navegador:
 *  1. `x-real-ip`: el proxy la fija desde la conexión TCP, el cliente no la controla.
 *  2. Si no está, la ÚLTIMA entrada de `x-forwarded-for`: el proxy añade la IP
 *     real al final; lo que el cliente haya puesto al principio es falsificable.
 * Nunca usamos la primera de `x-forwarded-for`: un atacante la elige y rota
 * esa IP para saltarse el límite.
 */
export function ipDeCabeceras(h: Pick<Headers, "get">): string {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real.slice(0, MAX_LONGITUD_CLAVE);

  const xff = h.get("x-forwarded-for");
  const ultima = xff?.split(",").pop()?.trim();
  if (ultima) return ultima.slice(0, MAX_LONGITUD_CLAVE);

  return "anon";
}
