import { describe, expect, it } from "vitest";
import {
  documentoValido,
  enmascararDocumento,
  enmascararEmail,
  enmascararNombre,
  enmascararTelefono,
  normalizarDocumento,
} from "../documento";

describe("normalizarDocumento", () => {
  it("quita puntos, espacios y guiones y pasa a mayúsculas", () => {
    expect(normalizarDocumento(" 1.136.882.468 ")).toBe("1136882468");
    expect(normalizarDocumento("AB 12-34")).toBe("AB1234");
  });

  it("la V o la E de las cédulas venezolanas no cuenta: con o sin ella es la misma persona", () => {
    expect(normalizarDocumento("V-20.111.222")).toBe("20111222");
    expect(normalizarDocumento("v-20.111.222")).toBe("20111222");
    expect(normalizarDocumento("E-81.234.567")).toBe("81234567");
    expect(normalizarDocumento("20.111.222")).toBe("20111222");
  });

  it("documentos con letras que no son una cédula con V/E quedan igual", () => {
    expect(normalizarDocumento("VE123456")).toBe("VE123456");
    expect(normalizarDocumento("V1234")).toBe("V1234");
    expect(normalizarDocumento("AB123456")).toBe("AB123456");
  });

  it("quita tildes igual que public.normalizar_documento", () => {
    expect(normalizarDocumento("ñá-123")).toBe("NA123");
  });

  it("sin letras ni números queda vacío", () => {
    expect(normalizarDocumento("  ..  ")).toBe("");
  });
});

describe("documentoValido", () => {
  it("de 4 a 20 letras o números, ya normalizado", () => {
    expect(documentoValido("1234")).toBe(true);
    expect(documentoValido("V20111222")).toBe(true);
    expect(documentoValido("123")).toBe(false);
    expect(documentoValido("A".repeat(21))).toBe(false);
    expect(documentoValido("12.34")).toBe(false);
  });
});

describe("enmascar", () => {
  it("nombre: deja ver el principio de cada palabra", () => {
    expect(enmascararNombre("Luis Fernando")).toBe("Lu** Fer*****");
    expect(enmascararNombre("  Ana   Li ")).toBe("A** L*");
  });

  it("email: una o dos letras y el dominio", () => {
    expect(enmascararEmail("luis.fer@gmail.com")).toBe("lu***@gmail.com");
    expect(enmascararEmail("a@x.co")).toBe("a***@x.co");
    expect(enmascararEmail(null)).toBe("");
  });

  it("teléfono: solo los dos últimos dígitos", () => {
    expect(enmascararTelefono("+57 300 123 4512")).toBe("*** *** **12");
    expect(enmascararTelefono(null)).toBe("");
  });

  it("documento: tipo y los tres últimos", () => {
    expect(enmascararDocumento("CC", "1136882468")).toBe("CC ****468");
    expect(enmascararDocumento("CC", null)).toBe("Por identificar");
  });

  it("documento corto: muestra menos o nada, nunca el dato completo", () => {
    expect(enmascararDocumento("CC", "1234")).toBe("CC ****34");
    expect(enmascararDocumento("CC", "123")).toBe("CC ****");
    expect(enmascararDocumento("CC", "12")).toBe("CC ****");
  });
});
