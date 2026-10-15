import { describe, expect, it } from "vitest";
import { filtrarInscritos, leerFiltro } from "../filtros";
import { inscritoDePrueba } from "./fabrica";

const jose = inscritoDePrueba();
const ana = inscritoDePrueba({
  id: "b2",
  referencia: "STA-BBBB2222",
  porcentajePagado: 100,
  persona: { id: "a2", nombre: "Ana Gómez", documento: "V20111222", email: "ana@example.com" },
});
const sinDoc = inscritoDePrueba({
  id: "b3",
  referencia: "STA-CCCC3333",
  porcentajePagado: 50,
  persona: { id: "a3", nombre: "Luis Díaz", documento: null, email: null },
});
const cancelada = inscritoDePrueba({
  id: "b4",
  referencia: "STA-DDDD4444",
  cancelada: true,
  persona: { id: "a4", nombre: "Carla Ruiz", documento: "987654", email: "carla@example.com" },
});
const todos = [jose, ana, sinDoc, cancelada];

describe("filtrarInscritos", () => {
  it("busca por nombre sin importar tildes ni mayúsculas", () => {
    expect(filtrarInscritos(todos, { q: "jose", estado: "todos" })).toEqual([jose]);
    expect(filtrarInscritos(todos, { q: "DÍAZ", estado: "todos" })).toEqual([sinDoc]);
  });

  it("busca por documento aunque lo escriban con puntos", () => {
    expect(filtrarInscritos(todos, { q: "1.136.882", estado: "todos" })).toEqual([jose]);
  });

  it("busca por referencia y por email", () => {
    expect(filtrarInscritos(todos, { q: "sta-bbbb2222", estado: "todos" })).toEqual([ana]);
    expect(filtrarInscritos(todos, { q: "ana@", estado: "todos" })).toEqual([ana]);
  });

  it("filtra por estado de pago y por identificar", () => {
    expect(filtrarInscritos(todos, { q: "", estado: "pagado" })).toEqual([ana]);
    expect(filtrarInscritos(todos, { q: "", estado: "abonado" })).toEqual([sinDoc]);
    expect(filtrarInscritos(todos, { q: "", estado: "cancelada" })).toEqual([cancelada]);
    expect(filtrarInscritos(todos, { q: "", estado: "sin_documento" })).toEqual([sinDoc]);
  });
});

describe("leerFiltro", () => {
  it("estado desconocido = todos; arrays toman el primero", () => {
    expect(leerFiltro({ q: ["  ana ", "x"], estado: "raro" })).toEqual({ q: "ana", estado: "todos" });
    expect(leerFiltro({})).toEqual({ q: "", estado: "todos" });
  });
});
