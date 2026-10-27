import { describe, expect, it } from "vitest";
import { esUuid, leerCorrecciones, leerPersonaForm } from "../formulario";

function fd(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

const completo = {
  documento: "1.136.882.468",
  tipo_documento: "CC",
  nombre: "  Ana   María  ",
  email: "ana@example.com",
  telefono: "+57 300 111 2233",
  ciudad: "Maracaibo",
  profesion: "Anestesióloga",
  notas: "Factura a la clínica",
};

describe("leerPersonaForm", () => {
  it("público completo: normaliza documento y espacios del nombre", () => {
    expect(leerPersonaForm(fd(completo), "publico")).toEqual({
      ok: true,
      notas: "Factura a la clínica",
      datos: {
        documento: "1136882468",
        tipoDocumento: "CC",
        nombre: "Ana María",
        email: "ana@example.com",
        telefono: "+57 300 111 2233",
        ciudad: "Maracaibo",
        profesion: "Anestesióloga",
      },
    });
  });

  it("público exige email, teléfono, ciudad y profesión", () => {
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez" }), "publico");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["ciudad", "email", "profesion", "telefono"]);
  });

  it("admin acepta solo documento y nombre (reservas por WhatsApp)", () => {
    const r = leerPersonaForm(fd({ documento: "V-20.111.222", tipo_documento: "CI", nombre: "Ana Pérez" }), "admin");
    expect(r).toEqual({
      ok: true,
      notas: "",
      datos: {
        documento: "20111222",
        tipoDocumento: "CI",
        nombre: "Ana Pérez",
        email: null,
        telefono: null,
        ciudad: null,
        profesion: null,
      },
    });
  });

  it("admin valida el email si lo trae", () => {
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez", email: "no-es-email" }), "admin");
    expect(r.ok === false && r.errores.email).toBeTruthy();
  });

  it("documento demasiado corto", () => {
    const r = leerPersonaForm(fd({ ...completo, documento: "1.2" }), "publico");
    expect(r.ok === false && r.errores.documento).toBeTruthy();
  });

  it("tipo de documento desconocido cae a CC", () => {
    const r = leerPersonaForm(fd({ ...completo, tipo_documento: "XX" }), "publico");
    expect(r.ok && r.datos.tipoDocumento).toBe("CC");
  });
});

describe("entradas hostiles", () => {
  it("un email enorme se rechaza sin ejecutar la regex sobre él", () => {
    const hostil = "a@" + ".".repeat(40000) + "@";
    const inicio = performance.now();
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez", email: hostil }), "admin");
    const tardo = performance.now() - inicio;
    expect(r.ok === false && r.errores.email).toBe("Escribe un email válido.");
    expect(tardo).toBeLessThan(50);
  });

  it("cualquier campo se recorta a 2000 caracteres", () => {
    const r = leerPersonaForm(fd({ documento: "12345", nombre: "Ana Pérez", notas: "x".repeat(5000) }), "admin");
    expect(r.ok === false && r.errores.notas).toBeTruthy();
  });
});

describe("leerCorrecciones", () => {
  it("vacío = sin cambios", () => {
    const errores: Record<string, string> = {};
    expect(leerCorrecciones(fd({}), errores)).toEqual({ nombre: null, email: null, telefono: null });
    expect(errores).toEqual({});
  });

  it("valida lo que se reescribe", () => {
    const errores: Record<string, string> = {};
    const r = leerCorrecciones(fd({ nombre: "Lu", email: "luis@example.com" }), errores);
    expect(r.email).toBe("luis@example.com");
    expect(Object.keys(errores)).toEqual(["nombre"]);
  });
});

describe("esUuid", () => {
  it("solo uuids", () => {
    expect(esUuid("10000000-0000-0000-0000-000000000001")).toBe(true);
    expect(esUuid("x")).toBe(false);
    expect(esUuid("10000000-0000-0000-0000-00000000000Z")).toBe(false);
  });
});
