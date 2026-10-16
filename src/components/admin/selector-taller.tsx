import { ESTADO_ETIQUETA, type Taller } from "@/lib/talleres/tipos";
import { botonSecundario, inputClass } from "./ui";

/**
 * Elige el taller de la pantalla. Es un formulario GET sin JavaScript: la URL
 * queda con `?taller=<id>` y se puede guardar o compartir.
 */
export function SelectorTaller({
  talleres,
  actual,
  ruta,
}: {
  talleres: Taller[];
  actual: string;
  ruta: string;
}) {
  return (
    <form action={ruta} method="get" className="flex flex-wrap items-center gap-2">
      <label htmlFor="selector-taller" className="sr-only">
        Taller
      </label>
      <div className="w-[320px] max-w-full">
        <select id="selector-taller" name="taller" defaultValue={actual} className={inputClass}>
          {talleres.map((t) => (
            <option key={t.id} value={t.id}>
              {[t.titulo, t.tituloAcento].filter(Boolean).join(" ")} · {t.fechasTexto} (
              {ESTADO_ETIQUETA[t.estado]})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={botonSecundario}>
        Ver
      </button>
    </form>
  );
}
