import { fechasLargas } from "./reglas";
import { PORCENTAJES_PAGO, type Tarifa, type TallerInput } from "./tipos";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tildes y diacríticos separados por NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rechaza también fechas imposibles como 2027-02-30, que `Date` corregiría en silencio. */
function fechaValida(s: string) {
  if (!FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type LecturaTaller =
  | { ok: true; datos: TallerInput }
  | { ok: false; errores: Record<string, string> };

/**
 * Lee y valida el formulario de taller del admin. Las mismas reglas están en
 * la base como restricciones; aquí se repiten para dar el mensaje junto al
 * campo en lugar de un error genérico.
 */
export function leerTallerForm(fd: FormData): LecturaTaller {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const opcional = (k: string) => s(k) || null;
  const errores: Record<string, string> = {};

  const titulo = s("titulo");
  if (titulo.length < 3) errores.titulo = "Escribe el título del taller.";

  const fechaInicio = s("fecha_inicio");
  const fechaFin = s("fecha_fin");
  const inicioOk = fechaValida(fechaInicio);
  if (!inicioOk) errores.fecha_inicio = "Fecha de inicio no válida.";
  if (!fechaValida(fechaFin)) errores.fecha_fin = "Fecha de fin no válida.";
  else if (inicioOk && fechaFin < fechaInicio)
    errores.fecha_fin = "La fecha de fin no puede ser anterior a la de inicio.";

  const slug = s("slug") || (inicioOk ? `taller-${fechaInicio.slice(0, 7)}` : "");
  if (!SLUG.test(slug)) errores.slug = "Solo minúsculas, números y guiones (ej. taller-2027-03).";

  const sedeNombre = s("sede_nombre");
  const ciudad = s("ciudad");
  const pais = s("pais");
  if (!sedeNombre) errores.sede_nombre = "Indica la sede.";
  if (!ciudad) errores.ciudad = "Indica la ciudad.";
  if (!pais) errores.pais = "Indica el país.";

  const cuposTotal = Number(s("cupos_total"));
  if (!s("cupos_total") || !Number.isInteger(cuposTotal) || cuposTotal < 0 || cuposTotal > 1000)
    errores.cupos_total = "Cupos: número entero entre 0 y 1000.";

  const horasTexto = s("horas");
  const horas = horasTexto ? Number(horasTexto) : null;
  if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 500))
    errores.horas = "Horas: número entero entre 1 y 500, o vacío.";

  const elegidos = fd.getAll("porcentajes_pago").map(Number);
  const porcentajesPago = PORCENTAJES_PAGO.filter((p) => p === 100 || elegidos.includes(p));

  const moneda = (s("moneda") || "COP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) errores.moneda = "Código de moneda de 3 letras (COP, USD…).";

  const tarifas = leerTarifas(fd, errores);

  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      slug,
      titulo,
      tituloAcento: opcional("titulo_acento"),
      modalidad: s("modalidad") || "Taller presencial",
      fechaInicio,
      fechaFin,
      fechasTexto: s("fechas_texto") || fechasLargas(fechaInicio, fechaFin),
      sedeNombre,
      ciudad,
      region: opcional("region"),
      pais,
      cuposTotal,
      horas,
      aval: opcional("aval"),
      porcentajesPago: [...porcentajesPago],
      moneda,
      preciosPublicados: fd.get("precios_publicados") === "on",
      tarifas,
      fotoPrincipal: opcional("foto_principal"),
      fotoPrincipalAlt: opcional("foto_principal_alt"),
      firmaNombre: opcional("firma_nombre"),
      firmaCargo: opcional("firma_cargo"),
      firmaDocumento: opcional("firma_documento"),
    },
  };
}

/**
 * Las tarifas llegan como columnas paralelas (`tarifa_nombre[]`, …). Una fila
 * sin nombre se ignora: es la fila vacía que el formulario ofrece para añadir.
 */
function leerTarifas(fd: FormData, errores: Record<string, string>): Tarifa[] {
  const col = (k: string) => fd.getAll(k).map((v) => String(v).trim());
  const ids = col("tarifa_id");
  const nombres = col("tarifa_nombre");
  const descripciones = col("tarifa_descripcion");
  const precios = col("tarifa_precio");
  const destacada = String(fd.get("tarifa_destacada") ?? "0");

  const tarifas: Tarifa[] = [];
  nombres.forEach((nombre, i) => {
    if (!nombre) return;
    const precio = Number(precios[i] || "0");
    if (!Number.isInteger(precio) || precio < 0) {
      errores[`tarifa_precio_${i}`] = `Precio no válido en «${nombre}».`;
      return;
    }
    // El id se conserva al editar: las reservas guardan `tier_id`.
    let id = ids[i] || slugify(nombre) || `tarifa-${i + 1}`;
    while (tarifas.some((t) => t.id === id)) id = `${id}-${i + 1}`;
    tarifas.push({ id, nombre, descripcion: descripciones[i] ?? "", precio, destacada: String(i) === destacada });
  });

  if (tarifas.length === 0) errores.tarifas = "Añade al menos una tarifa.";
  else if (!tarifas.some((t) => t.destacada)) tarifas[0].destacada = true;

  return tarifas;
}
