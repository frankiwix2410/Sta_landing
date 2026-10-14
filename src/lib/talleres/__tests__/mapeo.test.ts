import { describe, expect, it } from "vitest";
import { filaATaller, nombreInterno, tallerAFila, type FilaTaller } from "../mapeo";

const fila: FilaTaller = {
  id: "abc",
  slug: "taller-2026-10",
  nombre: "x",
  titulo: "Anestesia Regional Ecoguiada",
  titulo_acento: "+ Sedación TCI",
  modalidad: "Taller presencial",
  estado: "finalizado",
  fecha_inicio: "2026-10-24",
  fecha_fin: "2026-10-25",
  fechas_texto: "Octubre 24 y 25, 2026",
  sede_nombre: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  pais: "Venezuela",
  cupos_total: 20,
  horas: null,
  aval: "Avalado por SCARE – SARG",
  porcentajes_pago: [50, 100],
  moneda: "COP",
  precios_publicados: false,
  tarifas: [{ id: "general", nombre: "Cupo General", descripcion: "", precio: 0, destacada: true }],
  foto_principal: null,
  foto_principal_alt: null,
  firma_nombre: "MD. Stevan J. Camelo C.",
  firma_cargo: "Anestesiólogo",
  firma_documento: "C.C. 1.136.882.468",
  contenido: null,
  creado_en: "2026-09-17T15:24:23Z",
};

describe("mapeo", () => {
  it("fila → Taller en camelCase", () => {
    const t = filaATaller(fila);
    expect(t.tituloAcento).toBe("+ Sedación TCI");
    expect(t.cuposTotal).toBe(20);
    expect(t.estado).toBe("finalizado");
    expect(t.firmaDocumento).toBe("C.C. 1.136.882.468");
  });

  it("tarifas nulas llegan como lista vacía", () => {
    expect(filaATaller({ ...fila, tarifas: null }).tarifas).toEqual([]);
  });

  it("Taller → fila calcula el nombre interno", () => {
    const { id, nombre, estado, contenido, creadoEn, ...input } = filaATaller(fila);
    void id; void nombre; void estado; void contenido; void creadoEn;
    const out = tallerAFila(input);
    expect(out.nombre).toBe("Anestesia Regional Ecoguiada + Sedación TCI · Octubre 24 y 25, 2026");
    expect(out.titulo_acento).toBe("+ Sedación TCI");
    expect(out).not.toHaveProperty("estado");
  });

  it("nombre interno sin acento", () => {
    expect(nombreInterno({ titulo: "Curso", tituloAcento: null, fechasTexto: "Marzo 3, 2027" })).toBe(
      "Curso · Marzo 3, 2027",
    );
  });
});
