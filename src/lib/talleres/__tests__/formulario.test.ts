import { describe, expect, it } from "vitest";
import { leerTallerForm, slugify } from "../formulario";

function form(campos: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

const valido = {
  titulo: "Anestesia Regional Ecoguiada",
  titulo_acento: "+ Sedación TCI",
  fecha_inicio: "2027-03-06",
  fecha_fin: "2027-03-07",
  sede_nombre: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  pais: "Venezuela",
  cupos_total: "20",
  horas: "",
  porcentajes_pago: ["50"],
  moneda: "cop",
  tarifa_id: ["general", ""],
  tarifa_nombre: ["Cupo General", "Residente / Estudiante"],
  tarifa_descripcion: ["Acceso completo", "Tarifa especial"],
  tarifa_precio: ["1200000", "900000"],
  tarifa_destacada: "0",
};

describe("slugify", () => {
  it("quita tildes, espacios y símbolos", () => {
    expect(slugify("Residente / Estudiante")).toBe("residente-estudiante");
    expect(slugify("  Sedación TCI  ")).toBe("sedacion-tci");
  });
});

describe("leerTallerForm", () => {
  it("lee un formulario válido", () => {
    const r = leerTallerForm(form(valido));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.slug).toBe("taller-2027-03");
    expect(r.datos.fechasTexto).toBe("Marzo 6 y 7, 2027");
    expect(r.datos.cuposTotal).toBe(20);
    expect(r.datos.horas).toBeNull();
    expect(r.datos.moneda).toBe("COP");
    expect(r.datos.modalidad).toBe("Taller presencial");
    expect(r.datos.porcentajesPago).toEqual([50, 100]);
    expect(r.datos.preciosPublicados).toBe(false);
    expect(r.datos.tarifas).toEqual([
      { id: "general", nombre: "Cupo General", descripcion: "Acceso completo", precio: 1200000, destacada: true },
      { id: "residente-estudiante", nombre: "Residente / Estudiante", descripcion: "Tarifa especial", precio: 900000, destacada: false },
    ]);
  });

  it("respeta el slug y el texto de fechas escritos a mano", () => {
    const r = leerTallerForm(form({ ...valido, slug: "taller-marzo", fechas_texto: "6 y 7 de marzo" }));
    expect(r.ok && r.datos.slug).toBe("taller-marzo");
    expect(r.ok && r.datos.fechasTexto).toBe("6 y 7 de marzo");
  });

  it("el 100% siempre está y se ignoran porcentajes inventados", () => {
    const r = leerTallerForm(form({ ...valido, porcentajes_pago: ["33", "25"] }));
    expect(r.ok && r.datos.porcentajesPago).toEqual([25, 100]);
  });

  it("fin antes que inicio es error", () => {
    const r = leerTallerForm(form({ ...valido, fecha_fin: "2027-03-01" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.fecha_fin).toMatch(/anterior/);
  });

  it("fecha imposible es error", () => {
    const r = leerTallerForm(form({ ...valido, fecha_inicio: "2027-02-30" }));
    expect(!r.ok && r.errores.fecha_inicio).toBeTruthy();
  });

  it("cupos no numéricos es error", () => {
    const r = leerTallerForm(form({ ...valido, cupos_total: "veinte" }));
    expect(!r.ok && r.errores.cupos_total).toBeTruthy();
  });

  it("horas fuera de rango es error", () => {
    const r = leerTallerForm(form({ ...valido, horas: "0" }));
    expect(!r.ok && r.errores.horas).toBeTruthy();
  });

  it("slug inválido es error", () => {
    const r = leerTallerForm(form({ ...valido, slug: "Taller Marzo!" }));
    expect(!r.ok && r.errores.slug).toBeTruthy();
  });

  it("sin tarifas es error", () => {
    const r = leerTallerForm(
      form({ ...valido, tarifa_id: [""], tarifa_nombre: [""], tarifa_descripcion: [""], tarifa_precio: [""] }),
    );
    expect(!r.ok && r.errores.tarifas).toBeTruthy();
  });

  it("precio negativo es error", () => {
    const r = leerTallerForm(form({ ...valido, tarifa_precio: ["-5", "900000"] }));
    expect(!r.ok && r.errores.tarifa_precio_0).toBeTruthy();
  });

  it("si ninguna tarifa queda destacada, se destaca la primera", () => {
    const r = leerTallerForm(form({ ...valido, tarifa_destacada: "9" }));
    expect(r.ok && r.datos.tarifas[0].destacada).toBe(true);
  });

  it("título, sede, ciudad y país son obligatorios", () => {
    const r = leerTallerForm(form({ ...valido, titulo: "", sede_nombre: "", ciudad: "", pais: "" }));
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["ciudad", "pais", "sede_nombre", "titulo"]);
  });
});
