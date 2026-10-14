import { describe, expect, it } from "vitest";
import { contenidoTaller } from "@/lib/taller";
import { construirTallerVista, nombreCurso, tarifaPorDefecto } from "../vista";
import { tallerDePrueba } from "./fabrica";

const disp = { total: 20, ocupados: 8, libres: 12 };

describe("construirTallerVista", () => {
  it("toma lo operativo de la base", () => {
    const v = construirTallerVista(tallerDePrueba(), "publicado", disp);
    expect(v.slug).toBe("taller-2026-10");
    expect(v.title).toBe("Anestesia Regional Ecoguiada");
    expect(v.titleAccent).toBe("+ Sedación TCI");
    expect(v.venue).toEqual({ name: "Policlínico San Francisco", city: "Maracaibo", region: "Zulia", country: "Venezuela" });
    expect(v.dates).toEqual({
      label: "Octubre 24 y 25, 2026",
      short: "24–25 OCT 2026",
      startIso: "2026-10-24",
      endIso: "2026-10-25",
    });
    expect(v.scarcity).toEqual({ value: "40%", label: "de cupos vendidos" });
    expect(v.soldOut).toBe(false);
    expect(v.mostrar.pago).toBe(true);
  });

  it("usa el estado efectivo, no el guardado", () => {
    const v = construirTallerVista(tallerDePrueba({ estado: "publicado" }), "finalizado", disp);
    expect(v.estado).toBe("finalizado");
    expect(v.mostrar.reserva).toBe(false);
    expect(v.soldOut).toBe(true);
  });

  it("sin foto propia usa la del contenido por defecto", () => {
    const v = construirTallerVista(tallerDePrueba({ fotoPrincipal: null }), "publicado", disp);
    expect(v.heroPhoto).toEqual(contenidoTaller.heroPhoto);
  });

  it("con foto propia usa la de la base", () => {
    const v = construirTallerVista(
      tallerDePrueba({ fotoPrincipal: "/assets/x.webp", fotoPrincipalAlt: "X" }),
      "publicado",
      disp,
    );
    expect(v.heroPhoto).toEqual({ src: "/assets/x.webp", alt: "X" });
  });

  it("el contenido propio del taller reemplaza solo las listas que trae", () => {
    const modules = [{ n: "01", title: "Otro", desc: "Distinto" }];
    const v = construirTallerVista(tallerDePrueba({ contenido: { modules, faq: "no-es-lista" } }), "publicado", disp);
    expect(v.modules).toEqual(modules);
    expect(v.faq).toEqual(contenidoTaller.faq);
  });

  it("aval vacío se muestra como cadena vacía", () => {
    expect(construirTallerVista(tallerDePrueba({ aval: null }), "publicado", disp).endorsement).toBe("");
  });

  it("tarifas pasan a la forma de la página", () => {
    const v = construirTallerVista(tallerDePrueba(), "publicado", disp);
    expect(v.pricing).toEqual({
      published: false,
      currency: "COP",
      tiers: [{ id: "general", name: "Cupo General", desc: "", amount: 0, featured: true }],
    });
  });
});

describe("tarifaPorDefecto", () => {
  it("la destacada", () => {
    const v = construirTallerVista(
      tallerDePrueba({
        tarifas: [
          { id: "a", nombre: "A", descripcion: "", precio: 1, destacada: false },
          { id: "b", nombre: "B", descripcion: "", precio: 2, destacada: true },
        ],
      }),
      "publicado",
      disp,
    );
    expect(tarifaPorDefecto(v).id).toBe("b");
  });

  it("sin tarifas, una general a 0", () => {
    const v = construirTallerVista(tallerDePrueba({ tarifas: [] }), "publicado", disp);
    expect(tarifaPorDefecto(v)).toEqual({ id: "general", name: "Cupo General", desc: "", amount: 0, featured: true });
  });
});

describe("nombreCurso", () => {
  it("con y sin acento", () => {
    expect(nombreCurso({ title: "A", titleAccent: "+ B" })).toBe("Taller de A + B");
    expect(nombreCurso({ title: "A", titleAccent: "" })).toBe("Taller de A");
  });
});
