import { describe, expect, it } from "vitest";
import { filaACertificado, type FilaCertificado } from "../mapeo";

const fila: FilaCertificado = {
  id: "c1",
  codigo: "C-ABCD-EFGH",
  inscripcion_id: "i1",
  taller_id: "t1",
  referencia: "STA-AAAA1111",
  nombre: "Ana Pérez",
  tipo_documento: "CC",
  documento: "1136882468",
  curso: "Anestesia Regional Ecoguiada + Sedación TCI",
  fechas_texto: "Octubre 24 y 25, 2026",
  sede: "Policlínico San Francisco",
  ciudad: "Maracaibo",
  region: "Zulia",
  horas: null,
  aval: "Avalado por SCARE – SARG",
  firma_nombre: "MD. Stevan J. Camelo C.",
  firma_cargo: "Anestesiólogo",
  firma_documento: "C.C. 1.136.882.468",
  emitido_en: "2026-10-26T15:00:00Z",
  revocado_en: null,
  revocado_manual: false,
};

describe("filaACertificado", () => {
  it("pasa a camelCase", () => {
    expect(filaACertificado(fila)).toEqual({
      id: "c1",
      codigo: "C-ABCD-EFGH",
      inscripcionId: "i1",
      tallerId: "t1",
      referencia: "STA-AAAA1111",
      nombre: "Ana Pérez",
      tipoDocumento: "CC",
      documento: "1136882468",
      curso: "Anestesia Regional Ecoguiada + Sedación TCI",
      fechasTexto: "Octubre 24 y 25, 2026",
      sede: "Policlínico San Francisco",
      ciudad: "Maracaibo",
      region: "Zulia",
      horas: null,
      aval: "Avalado por SCARE – SARG",
      firmaNombre: "MD. Stevan J. Camelo C.",
      firmaCargo: "Anestesiólogo",
      firmaDocumento: "C.C. 1.136.882.468",
      emitidoEn: "2026-10-26T15:00:00Z",
      revocadoEn: null,
      revocadoManual: false,
    });
  });
});
