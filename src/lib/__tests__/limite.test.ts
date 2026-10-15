import { describe, expect, it } from "vitest";
import { crearLimitador, ipDeCabeceras } from "../limite";

describe("crearLimitador", () => {
  it("deja pasar max por ventana y por clave", () => {
    const l = crearLimitador({ max: 2, ventanaMs: 1000 });
    expect(l.permitir("a", 0)).toBe(true);
    expect(l.permitir("a", 1)).toBe(true);
    expect(l.permitir("a", 2)).toBe(false);
    expect(l.permitir("b", 2)).toBe(true);
  });

  it("al pasar la ventana vuelve a dejar pasar", () => {
    const l = crearLimitador({ max: 2, ventanaMs: 1000 });
    l.permitir("a", 0);
    l.permitir("a", 1);
    expect(l.permitir("a", 999)).toBe(false);
    expect(l.permitir("a", 1001)).toBe(true);
  });
});

describe("ipDeCabeceras", () => {
  it("primera IP de x-forwarded-for, luego x-real-ip", () => {
    expect(ipDeCabeceras(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(ipDeCabeceras(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipDeCabeceras(new Headers())).toBe("desconocida");
  });
});
