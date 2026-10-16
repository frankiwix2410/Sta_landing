import { describe, expect, it } from "vitest";
import { ALFABETO_CODIGO, esReferencia, normalizarCodigo } from "../codigo";

describe("ALFABETO_CODIGO", () => {
  it("31 símbolos, sin los que se confunden en papel", () => {
    expect(ALFABETO_CODIGO).toHaveLength(31);
    for (const c of "0O1IL") expect(ALFABETO_CODIGO).not.toContain(c);
  });
});

describe("normalizarCodigo", () => {
  it("acepta lo que alguien teclea", () => {
    expect(normalizarCodigo("C-ABCD-EFGH")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo(" c abcd efgh ")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo("abcdefgh")).toBe("C-ABCD-EFGH");
    expect(normalizarCodigo("CABCDEFGH")).toBe("C-ABCD-EFGH");
  });

  it("rechaza símbolos fuera del alfabeto y longitudes raras", () => {
    expect(normalizarCodigo("C-ABC0-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCI-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCL-EFGH")).toBeNull();
    expect(normalizarCodigo("C-ABCD-EFG")).toBeNull();
    expect(normalizarCodigo("")).toBeNull();
  });
});

describe("esReferencia", () => {
  it("STA-XXXXXXXX con o sin mayúsculas", () => {
    expect(esReferencia("sta-abcd1234")).toBe(true);
    expect(esReferencia(" STA-ABCD1234 ")).toBe(true);
    expect(esReferencia("C-ABCD-EFGH")).toBe(false);
  });
});
