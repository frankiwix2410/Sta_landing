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

  it("una llamada bloqueada no alarga la ventana", () => {
    const l = crearLimitador({ max: 2, ventanaMs: 1000 });
    l.permitir("a", 0);
    l.permitir("a", 1);
    expect(l.permitir("a", 500)).toBe(false);
    expect(l.permitir("a", 1001)).toBe(true);
  });

  it("nunca guarda más claves vivas que el tope; expulsa las más antiguas", () => {
    const l = crearLimitador({ max: 1, ventanaMs: 1000, maxClaves: 100 });
    for (let i = 0; i < 150; i++) l.permitir(`ip${i}`, 0);
    expect(l.tamano()).toBeLessThanOrEqual(100);
    // ip0 fue expulsada (la más antigua): vuelve a pasar; ip149 sigue bloqueada.
    expect(l.permitir("ip0", 0)).toBe(true);
    expect(l.permitir("ip149", 0)).toBe(false);
  });
});

describe("ipDeCabeceras", () => {
  it("x-real-ip gana a x-forwarded-for", () => {
    expect(ipDeCabeceras(new Headers({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.1.1.1" }))).toBe("5.6.7.8");
  });

  it("sin x-real-ip usa la ÚLTIMA de x-forwarded-for, no la que el cliente puede falsear", () => {
    expect(ipDeCabeceras(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
  });

  it("sin cabeceras es anon", () => {
    expect(ipDeCabeceras(new Headers())).toBe("anon");
  });

  it("recorta la clave a 64 caracteres", () => {
    expect(ipDeCabeceras(new Headers({ "x-real-ip": "9".repeat(500) }))).toHaveLength(64);
  });
});
