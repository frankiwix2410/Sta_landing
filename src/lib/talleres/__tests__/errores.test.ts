import { describe, expect, it } from "vitest";
import { MENSAJES_ERROR, motivoDesdeError } from "../errores";

describe("motivoDesdeError", () => {
  it("23P01 (exclusión) es solapamiento de fechas", () => {
    expect(motivoDesdeError({ code: "23P01" })).toBe("solapamiento");
  });
  it("23505 (único) es slug duplicado", () => {
    expect(motivoDesdeError({ code: "23505" })).toBe("slug_duplicado");
  });
  it("23503 (FK) es que tiene inscripciones", () => {
    expect(motivoDesdeError({ code: "23503" })).toBe("tiene_inscripciones");
  });
  it("cualquier otro código o ninguno es error genérico", () => {
    expect(motivoDesdeError({ code: "XX000" })).toBe("error");
    expect(motivoDesdeError(null)).toBe("error");
  });
  it("todos los motivos tienen mensaje en español", () => {
    expect(MENSAJES_ERROR.solapamiento).toMatch(/fechas/);
  });
});
