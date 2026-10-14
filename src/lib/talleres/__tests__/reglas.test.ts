import { describe, expect, it } from "vitest";
import {
  elegirTallerActivo,
  escasez,
  fechasCortas,
  fechasLargas,
  hoyISO,
  visibilidad,
} from "../reglas";
import { tallerDePrueba } from "./fabrica";

describe("elegirTallerActivo", () => {
  const hoy = "2026-10-13";

  it("elige el publicado que todavía no termina", () => {
    const t = tallerDePrueba({ estado: "publicado" });
    expect(elegirTallerActivo([t], hoy)).toEqual({ taller: t, estadoEfectivo: "publicado" });
  });

  it("un cerrado vigente también es el activo", () => {
    const t = tallerDePrueba({ estado: "cerrado" });
    expect(elegirTallerActivo([t], hoy)?.estadoEfectivo).toBe("cerrado");
  });

  it("el día de fin todavía cuenta como vigente", () => {
    const t = tallerDePrueba({ fechaInicio: "2026-10-12", fechaFin: "2026-10-13" });
    expect(elegirTallerActivo([t], hoy)?.estadoEfectivo).toBe("publicado");
  });

  it("con dos vigentes gana el que empieza antes", () => {
    const tarde = tallerDePrueba({ slug: "b", fechaInicio: "2027-03-01", fechaFin: "2027-03-02" });
    const pronto = tallerDePrueba({ slug: "a", fechaInicio: "2026-11-01", fechaFin: "2026-11-02" });
    expect(elegirTallerActivo([tarde, pronto], hoy)?.taller.slug).toBe("a");
  });

  it("sin vigentes muestra el último finalizado", () => {
    const viejo = tallerDePrueba({ slug: "v", estado: "finalizado", fechaInicio: "2025-01-01", fechaFin: "2025-01-02" });
    const reciente = tallerDePrueba({ slug: "r", estado: "finalizado", fechaInicio: "2026-05-01", fechaFin: "2026-05-02" });
    expect(elegirTallerActivo([viejo, reciente], hoy)?.taller.slug).toBe("r");
  });

  it("un publicado vencido se trata como finalizado", () => {
    const t = tallerDePrueba({ estado: "publicado", fechaInicio: "2026-10-01", fechaFin: "2026-10-02" });
    expect(elegirTallerActivo([t], hoy)).toEqual({ taller: t, estadoEfectivo: "finalizado" });
  });

  it("ignora borradores y archivados", () => {
    const b = tallerDePrueba({ estado: "borrador" });
    const a = tallerDePrueba({ estado: "archivado", fechaFin: "2026-01-02", fechaInicio: "2026-01-01" });
    expect(elegirTallerActivo([b, a], hoy)).toBeNull();
  });

  it("sin talleres devuelve null", () => {
    expect(elegirTallerActivo([], hoy)).toBeNull();
  });
});

describe("visibilidad", () => {
  it("publicado con cupos: reserva y pago", () => {
    expect(visibilidad("publicado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      reserva: true,
      listaEspera: false,
      pago: true,
      certificados: true,
    });
  });

  it("publicado lleno: lista de espera, el pago sigue abierto", () => {
    expect(visibilidad("publicado", { total: 20, ocupados: 20, libres: 0 })).toEqual({
      reserva: false,
      listaEspera: true,
      pago: true,
      certificados: true,
    });
  });

  it("publicado sin datos de cupo: se deja reservar (la base decide al enviar)", () => {
    expect(visibilidad("publicado", null).reserva).toBe(true);
  });

  it("cerrado: lista de espera, sin pago", () => {
    expect(visibilidad("cerrado", null)).toEqual({
      reserva: false,
      listaEspera: true,
      pago: false,
      certificados: true,
    });
  });

  it("finalizado: solo certificados", () => {
    expect(visibilidad("finalizado", null)).toEqual({
      reserva: false,
      listaEspera: false,
      pago: false,
      certificados: true,
    });
  });

  it("borrador: nada", () => {
    expect(visibilidad("borrador", null)).toEqual({
      reserva: false,
      listaEspera: false,
      pago: false,
      certificados: false,
    });
  });
});

describe("escasez", () => {
  it("porcentaje real de cupos vendidos", () => {
    expect(escasez("publicado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      value: "40%",
      label: "de cupos vendidos",
    });
  });

  it("nunca dice 100% si queda al menos un cupo", () => {
    expect(escasez("publicado", { total: 200, ocupados: 199, libres: 1 }).value).toBe("99%");
  });

  it("lleno: 100%", () => {
    expect(escasez("publicado", { total: 20, ocupados: 20, libres: 0 }).value).toBe("100%");
  });

  it("cupos bajados por debajo de los ocupados: 100%, no más", () => {
    expect(escasez("publicado", { total: 5, ocupados: 8, libres: 0 }).value).toBe("100%");
  });

  it("cupo total 0: 100%", () => {
    expect(escasez("publicado", { total: 0, ocupados: 0, libres: 0 }).value).toBe("100%");
  });

  it("sin datos: cupos limitados", () => {
    expect(escasez("publicado", null)).toEqual({ value: "Cupos", label: "limitados" });
  });

  it("cerrado: 100% vendidos aunque queden cupos", () => {
    expect(escasez("cerrado", { total: 20, ocupados: 8, libres: 12 })).toEqual({
      value: "100%",
      label: "de cupos vendidos",
    });
  });

  it("finalizado", () => {
    expect(escasez("finalizado", null)).toEqual({ value: "100%", label: "edición finalizada" });
  });
});

describe("fechas", () => {
  it("cortas, mismo mes", () => {
    expect(fechasCortas("2026-10-24", "2026-10-25")).toBe("24–25 OCT 2026");
  });
  it("cortas, un solo día", () => {
    expect(fechasCortas("2026-10-24", "2026-10-24")).toBe("24 OCT 2026");
  });
  it("cortas, cambia de mes", () => {
    expect(fechasCortas("2026-09-30", "2026-10-02")).toBe("30 SEP – 2 OCT 2026");
  });
  it("cortas, cambia de año", () => {
    expect(fechasCortas("2026-12-30", "2027-01-02")).toBe("30 DIC 2026 – 2 ENE 2027");
  });
  it("largas, dos días seguidos", () => {
    expect(fechasLargas("2026-10-24", "2026-10-25")).toBe("Octubre 24 y 25, 2026");
  });
  it("largas, rango de días", () => {
    expect(fechasLargas("2026-10-24", "2026-10-26")).toBe("Octubre 24 al 26, 2026");
  });
  it("largas, un día", () => {
    expect(fechasLargas("2026-10-24", "2026-10-24")).toBe("Octubre 24, 2026");
  });
  it("largas, cambia de mes", () => {
    expect(fechasLargas("2026-09-30", "2026-10-02")).toBe("Septiembre 30 al Octubre 2, 2026");
  });
  it("largas, cambia de año", () => {
    expect(fechasLargas("2026-12-30", "2027-01-02")).toBe("Diciembre 30, 2026 al Enero 2, 2027");
  });
});

describe("hoyISO", () => {
  it("usa la hora de Caracas, no UTC", () => {
    // 02:00 UTC del 14 son las 22:00 del 13 en Caracas (UTC-4).
    expect(hoyISO(new Date("2026-10-14T02:00:00Z"))).toBe("2026-10-13");
  });
});
