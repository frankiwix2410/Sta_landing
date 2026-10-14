import type { Taller } from "../tipos";

export function tallerDePrueba(p: Partial<Taller> = {}): Taller {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "taller-2026-10",
    nombre: "Taller de prueba",
    titulo: "Anestesia Regional Ecoguiada",
    tituloAcento: "+ Sedación TCI",
    modalidad: "Taller presencial",
    estado: "publicado",
    fechaInicio: "2026-10-24",
    fechaFin: "2026-10-25",
    fechasTexto: "Octubre 24 y 25, 2026",
    sedeNombre: "Policlínico San Francisco",
    ciudad: "Maracaibo",
    region: "Zulia",
    pais: "Venezuela",
    cuposTotal: 20,
    horas: null,
    aval: "Avalado por SCARE – SARG",
    porcentajesPago: [50, 100],
    moneda: "COP",
    preciosPublicados: false,
    tarifas: [
      { id: "general", nombre: "Cupo General", descripcion: "", precio: 0, destacada: true },
    ],
    fotoPrincipal: null,
    fotoPrincipalAlt: null,
    firmaNombre: null,
    firmaCargo: null,
    firmaDocumento: null,
    contenido: null,
    creadoEn: "2026-09-17T15:24:23Z",
    ...p,
  };
}
