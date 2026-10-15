/**
 * Límite de frecuencia en la memoria del proceso.
 *
 * Frena a quien prueba documentos uno tras otro para ver quién está inscrito.
 * No es un sistema distribuido: el sitio corre en un solo contenedor y, si se
 * reinicia, el contador vuelve a cero — para este riesgo basta.
 */

export type Limitador = { permitir(clave: string, ahora?: number): boolean };

export function crearLimitador({ max, ventanaMs }: { max: number; ventanaMs: number }): Limitador {
  const golpes = new Map<string, number[]>();

  return {
    permitir(clave, ahora = Date.now()) {
      const recientes = (golpes.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      if (recientes.length >= max) {
        golpes.set(clave, recientes);
        return false;
      }
      recientes.push(ahora);
      golpes.set(clave, recientes);

      // Barrido ocasional: sin él, el mapa crece con cada IP que pasa.
      if (golpes.size > 5000) {
        for (const [k, v] of golpes) if (v.every((t) => ahora - t >= ventanaMs)) golpes.delete(k);
      }
      return true;
    },
  };
}

/**
 * IP del visitante tras el proxy de Dokploy, que añade `x-forwarded-for`. La
 * primera de la lista es la del navegador.
 */
export function ipDeCabeceras(h: Pick<Headers, "get">): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "desconocida";
  return h.get("x-real-ip")?.trim() || "desconocida";
}
