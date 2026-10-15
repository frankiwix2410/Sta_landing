import type { Inscrito, Persona } from "../tipos";

export function personaDePrueba(p: Partial<Persona> = {}): Persona {
  return {
    id: "00000000-0000-0000-0000-0000000000a1",
    documento: "1136882468",
    tipoDocumento: "CC",
    nombre: "José Pérez",
    email: "jose@example.com",
    telefono: "+57 300 000 0012",
    ciudad: "Maracaibo",
    profesion: "Anestesiólogo",
    ...p,
  };
}

export function inscritoDePrueba(
  p: Partial<Omit<Inscrito, "persona">> & { persona?: Partial<Persona> } = {},
): Inscrito {
  const { persona, ...resto } = p;
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    referencia: "STA-AAAA1111",
    tallerId: "00000000-0000-0000-0000-000000000001",
    persona: personaDePrueba(persona),
    tarifaNombre: "Cupo General",
    monto: null,
    moneda: null,
    porcentajePagado: 0,
    porcentajeManual: false,
    porcentajeEnRevision: 0,
    comprobantesVerificados: 0,
    cancelada: false,
    asistio: false,
    origen: "web",
    notas: "",
    creadoEn: "2026-10-01T10:00:00Z",
    certificado: null,
    ...resto,
  };
}
