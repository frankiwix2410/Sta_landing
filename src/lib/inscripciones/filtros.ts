import { normalizarDocumento } from "./documento";
import { estadoPago } from "./pagos";
import type { Inscrito } from "./tipos";

export const FILTROS_ESTADO = [
  "todos",
  "pendiente",
  "abonado",
  "pagado",
  "cancelada",
  "sin_documento",
] as const;
export type FiltroEstado = (typeof FILTROS_ESTADO)[number];

export const FILTRO_ETIQUETA: Record<FiltroEstado, string> = {
  todos: "Todos",
  pendiente: "Pendientes",
  abonado: "Abonados",
  pagado: "Pagados",
  cancelada: "Cancelados",
  sin_documento: "Por identificar",
};

export type FiltroInscritos = { q: string; estado: FiltroEstado };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lee el filtro de la URL; cualquier valor raro cae a "todos". */
export function leerFiltro(sp: { q?: string | string[]; estado?: string | string[] }): FiltroInscritos {
  const estado = uno(sp.estado);
  return {
    q: uno(sp.q).trim().slice(0, 80),
    estado: (FILTROS_ESTADO as readonly string[]).includes(estado) ? (estado as FiltroEstado) : "todos",
  };
}

const plano = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Filtra en memoria: un taller tiene decenas de inscritos, no miles, y así el
 * filtro no necesita otra consulta a la base.
 */
export function filtrarInscritos(lista: readonly Inscrito[], f: FiltroInscritos): Inscrito[] {
  const q = plano(f.q);
  const qDocumento = normalizarDocumento(f.q);
  const qReferencia = f.q.trim().toUpperCase();

  return lista.filter((i) => {
    if (f.estado === "sin_documento" && i.persona.documento !== null) return false;
    if (f.estado !== "todos" && f.estado !== "sin_documento" && estadoPago(i) !== f.estado) return false;
    if (!q) return true;
    return (
      plano(i.persona.nombre).includes(q) ||
      plano(i.persona.email ?? "").includes(q) ||
      (qDocumento.length > 0 && (i.persona.documento ?? "").includes(qDocumento)) ||
      i.referencia.includes(qReferencia)
    );
  });
}
