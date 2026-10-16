import { describe, expect, it } from "vitest";
import { filaAComprobante, filaAInscrito, type FilaComprobante, type FilaInscrito } from "../mapeo";

const fila: FilaInscrito = {
  id: "i1",
  referencia: "STA-AAAA1111",
  taller_id: "t1",
  persona_id: "p1",
  documento: "1136882468",
  tipo_documento: "CC",
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "3001112233",
  ciudad: null,
  profesion: null,
  tarifa_nombre: "Cupo General",
  monto: 350000,
  moneda: "COP",
  porcentaje_pagado: 50,
  porcentaje_manual: false,
  porcentaje_en_revision: 50,
  comprobantes_verificados: 1,
  cancelada: false,
  asistio: true,
  origen: "web",
  notas: "",
  creado_en: "2026-10-01T10:00:00Z",
};

describe("filaAInscrito", () => {
  it("arma la persona; sin columnas de la etapa 3 no hay certificado", () => {
    const i = filaAInscrito(fila);
    expect(i.persona).toEqual({
      id: "p1",
      documento: "1136882468",
      tipoDocumento: "CC",
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "3001112233",
      ciudad: null,
      profesion: null,
    });
    expect(i.porcentajeEnRevision).toBe(50);
    expect(i.certificado).toBeNull();
  });

  it("con certificado", () => {
    const i = filaAInscrito({ ...fila, certificado_codigo: "C-ABCD-EFGH", certificado_revocado: true });
    expect(i.certificado).toEqual({ codigo: "C-ABCD-EFGH", revocado: true });
  });

  it("tipo de documento desconocido = OTRO", () => {
    expect(filaAInscrito({ ...fila, tipo_documento: "XX" }).persona.tipoDocumento).toBe("OTRO");
  });
});

describe("filaAComprobante", () => {
  it("pasa a camelCase", () => {
    const f: FilaComprobante = {
      id: "c1",
      inscripcion_id: "i1",
      referencia: "STA-AAAA1111",
      taller_id: "t1",
      taller_nombre: "Taller · Octubre",
      persona_nombre: "Ana Pérez",
      persona_documento: null,
      persona_tipo_documento: "CC",
      porcentaje: 50,
      estado: "pending",
      notas: "Banco X",
      nota_admin: null,
      file_type: "image/jpeg",
      file_size: 1000,
      creado_en: "2026-10-01T10:00:00Z",
      revisado_en: null,
      porcentaje_pagado: 0,
      porcentaje_manual: false,
    };
    expect(filaAComprobante(f)).toEqual({
      id: "c1",
      inscripcionId: "i1",
      referencia: "STA-AAAA1111",
      tallerId: "t1",
      tallerNombre: "Taller · Octubre",
      personaNombre: "Ana Pérez",
      personaDocumento: null,
      personaTipoDocumento: "CC",
      porcentaje: 50,
      estado: "pending",
      notas: "Banco X",
      notaAdmin: null,
      fileType: "image/jpeg",
      fileSize: 1000,
      creadoEn: "2026-10-01T10:00:00Z",
      revisadoEn: null,
      porcentajePagado: 0,
      porcentajeManual: false,
    });
  });
});
