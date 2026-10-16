import { describe, expect, it } from "vitest";
import { documentoImpreso, fechaLarga, tallaDocumento, tallaNombre } from "../hoja";

describe("documentoImpreso", () => {
  it("cédulas numéricas con puntos de miles, como la firma", () => {
    expect(documentoImpreso("CC", "1136882468")).toBe("C.C. 1.136.882.468");
    expect(documentoImpreso("CI", "20111222")).toBe("C.I. 20.111.222");
  });

  it("con letras, pasaportes y otros, tal cual", () => {
    expect(documentoImpreso("CI", "V20111222")).toBe("C.I. V20111222");
    expect(documentoImpreso("PAS", "123456789")).toBe("Pasaporte 123456789");
    expect(documentoImpreso("OTRO", "AB123")).toBe("AB123");
  });

  it("sin documento, vacío (queda la línea para escribirlo)", () => {
    expect(documentoImpreso("CC", null)).toBe("");
  });
});

describe("tallaNombre", () => {
  it("baja con los nombres largos para no salirse de la línea", () => {
    expect(tallaNombre("A".repeat(22))).toBe(9);
    expect(tallaNombre("A".repeat(23))).toBe(7.5);
    expect(tallaNombre("A".repeat(30))).toBe(7.5);
    expect(tallaNombre("A".repeat(31))).toBe(6);
    expect(tallaNombre("A".repeat(40))).toBe(6);
    expect(tallaNombre("A".repeat(41))).toBe(5);
    expect(tallaNombre("A".repeat(56))).toBe(4.2);
    expect(tallaNombre("A".repeat(76))).toBe(3.6);
    expect(tallaNombre("A".repeat(96))).toBe(3.2);
    expect(tallaNombre("A".repeat(300))).toBe(3.2);
  });
});

describe("tallaDocumento", () => {
  it("baja con los documentos largos", () => {
    expect(tallaDocumento("C.C. 1.136.882.468")).toBe(3.6);
    expect(tallaDocumento("Pasaporte ABCDEFGHIJ")).toBe(3);
    expect(tallaDocumento("Pasaporte ABCDEFGHIJKLMNOPQRST")).toBe(2.5);
  });
});

describe("fechaLarga", () => {
  it("en español y en hora de Caracas", () => {
    expect(fechaLarga("2026-10-26T15:00:00Z")).toBe("26 de octubre de 2026");
    // 02:00 UTC del 26 son las 22:00 del 25 en Caracas.
    expect(fechaLarga("2026-10-26T02:00:00Z")).toBe("25 de octubre de 2026");
  });
});
