import Image from "next/image";
import QRCode from "qrcode";
import "./sheet.css";
import { numeroDocumento, tallaDocumento, tallaNombre } from "@/lib/certificados/hoja";
import type { Certificado } from "@/lib/certificados/tipos";
import { site } from "@/lib/site";
import { contenidoTaller } from "@/lib/taller";

/**
 * Una hoja de certificado, A4 apaisado.
 *
 * Las medidas van en milímetros y no en píxeles porque esto existe para
 * imprimirse: en mm la hoja mide lo mismo en pantalla que en el PDF, y el
 * navegador no reescala el contenido al pasar por «Guardar como PDF».
 *
 * Lleva impresos el nombre y el documento de la persona, y su código con un
 * QR que abre la página de verificación: quien reciba el papel puede comprobar
 * que es auténtico y que no fue revocado. Curso, fechas, sede, aval y firma
 * salen de la copia fijada al emitir, no del taller tal como esté hoy; la
 * excepción son las horas, que siguen al taller (la base mantiene al día
 * `certificados.horas`).
 */
export async function CertificateSheet({ certificado }: { certificado: Certificado }) {
  // Alias con los nombres de antes: así el resto de la hoja no cambia.
  const { curso, fechasTexto: datesLabel, horas: hours, aval: endorsement } = certificado;
  const course = splitCourse(curso);
  const url = siteUrl();
  const verificacion = url ? `${url}/certificado/verificar/${certificado.codigo}` : null;
  const qr = verificacion ? await qrSvg(verificacion) : null;
  // La firma sale del taller; el contenido por defecto solo cubre talleres que
  // no la tenían.
  const fallback = contenidoTaller.instructor.signature;
  const signature = {
    name: certificado.firmaNombre ?? fallback.name,
    title: certificado.firmaCargo ?? fallback.title,
    document: certificado.firmaDocumento ?? fallback.document,
  };
  const lugar = [certificado.ciudad, certificado.region].filter(Boolean).join(", ");
  const documento = numeroDocumento(certificado.tipoDocumento, certificado.documento);

  return (
    <article className="cert-sheet relative h-[210mm] w-[297mm] overflow-hidden bg-white font-sans text-navy">
      <CornerArt />

      {/* Marca de agua. La opacidad va en línea: a este tamaño cualquier
          redondeo de Tailwind se nota como una mancha gris en el papel. */}
      <Image
        src="/assets/monogram-navy-trim.png"
        alt=""
        aria-hidden
        width={644}
        height={812}
        className="pointer-events-none absolute top-[62mm] left-[16mm] h-[92mm] w-auto select-none"
        style={{ opacity: 0.045 }}
      />

      <div className="relative flex h-full flex-col items-center px-[30mm] pt-[11mm] pb-[15mm] text-center">
        {/* Cabecera: sello de Anesthesia Deorum Ars · monograma · QR de la web */}
        <header className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-[7mm]">
          <Image
            src="/assets/logo-anesthesia-deorum-ars.png"
            alt="Anesthesia Deorum Ars"
            width={232}
            height={217}
            className="h-[22mm] w-auto justify-self-end"
          />
          <div className="flex items-center gap-x-[7mm]">
            <div className="h-[17mm] w-[0.3mm] bg-navy/25" />
            <Image
              src="/assets/monogram-navy-trim.png"
              alt={site.brand}
              width={644}
              height={812}
              className="h-[21mm] w-auto"
            />
            <div className="h-[17mm] w-[0.3mm] bg-navy/25" />
          </div>
          <div className="flex flex-col items-center justify-self-start">
            {qr ? (
              <div
                className="size-[18mm] [&>svg]:size-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : null}
            <p className="mt-[1.5mm] font-mono text-[2.6mm] font-semibold tracking-[0.08em] text-navy">
              {certificado.codigo}
            </p>
            <p className="mt-[0.4mm] text-[2.1mm] tracking-[0.1em] text-ink uppercase">
              {url ? `Verifica en ${url.replace(/^https?:\/\//, "")}` : `@${site.instagram}`}
            </p>
          </div>
        </header>

        {/* Título */}
        <h1 className="mt-[4mm] font-sans text-[19mm] leading-none font-bold tracking-[0.12em] text-navy">
          DIPLOMA
        </h1>
        <div className="mt-[3mm] flex items-center gap-x-[5mm]">
          <span className="h-[0.35mm] w-[42mm] bg-navy/70" />
          <p className="text-[5mm] font-semibold tracking-[0.2em] text-azure uppercase">
            De participación
          </p>
          <span className="h-[0.35mm] w-[42mm] bg-navy/70" />
        </div>
        <Dots className="mt-[2mm]" />

        {/* Nombre */}
        <p className="mt-[4mm] text-[3.3mm] font-medium tracking-[0.22em] text-ink uppercase">
          Se otorga a:
        </p>
        {/* Nombre impreso sobre su línea. La caja tiene alto fijo para que un
            nombre largo (que baja de tamaño) no empuje el resto de la hoja. */}
        <div className="mt-[2mm] flex h-[10mm] w-[175mm] items-end justify-center overflow-hidden">
          <p
            className="line-clamp-2 max-h-full text-center leading-[1] font-bold tracking-[0.04em] text-balance text-navy uppercase"
            style={{ fontSize: `${tallaNombre(certificado.nombre)}mm` }}
          >
            {certificado.nombre}
          </p>
        </div>
        <div className="mt-[1.5mm] h-[0.3mm] w-[175mm] bg-navy/50" />

        {/* Documento sobre su línea; si la persona no lo tiene registrado, la
            línea queda en blanco para escribirlo a mano. */}
        <div className="mt-[4mm] flex items-end gap-x-[3mm]">
          <p className="text-[3.1mm] font-medium tracking-[0.16em] text-ink uppercase">
            Documento de identidad:
          </p>
          <div className="flex min-w-[60mm] flex-col items-center">
            <p
              className="min-h-[4mm] font-semibold tracking-[0.06em] whitespace-nowrap text-navy"
              style={{ fontSize: `${tallaDocumento(documento)}mm` }}
            >
              {documento}
            </p>
            <div className="mt-[0.6mm] h-[0.3mm] w-full bg-navy/50" />
          </div>
        </div>

        {/* Curso */}
        <p className="mt-[5mm] text-[3.1mm] font-medium tracking-[0.16em] text-ink uppercase">
          Por su participación en el curso:
        </p>
        <div className="mt-[2.5mm] flex items-center gap-x-[4mm]">
          <Dots grid />
          <Pulse />
          <div>
            <p className="text-[5.4mm] leading-[1.15] font-bold tracking-[0.04em] text-navy uppercase">
              {course.lead}
            </p>
            {course.accent ? (
              <p className="mt-[0.5mm] text-[8.2mm] leading-[1.1] font-bold text-azure">
                {course.accent}
              </p>
            ) : null}
          </div>
          <Pulse />
          <Dots grid />
        </div>

        {/* Horas, sede y fechas */}
        {hours ? (
          <p className="mt-[5mm] flex items-center gap-x-[2.5mm] text-[3.2mm] font-medium tracking-[0.12em] text-ink uppercase">
            <ClockIcon />
            Con una intensidad horaria de
            <span className="font-bold text-azure">{hours} horas.</span>
          </p>
        ) : null}
        <div className="mt-[4mm] flex items-center rounded-[2.5mm] border-[0.35mm] border-navy/40 px-[6mm] py-[2.2mm] text-[3.1mm] font-medium tracking-[0.1em] text-navy uppercase">
          <span className="flex items-center gap-x-[2.5mm]">
            <PinIcon />
            {lugar}
          </span>
          {datesLabel ? (
            <>
              <span className="mx-[6mm] h-[6mm] w-[0.3mm] bg-navy/30" />
              <span className="flex items-center gap-x-[2.5mm]">
                <CalendarIcon />
                {datesLabel}
              </span>
            </>
          ) : null}
        </div>

        {endorsement ? (
          <p className="mt-[4mm] text-[2.8mm] font-semibold tracking-[0.16em] text-azure uppercase">
            {endorsement}
          </p>
        ) : null}

        {/* Firma */}
        <footer className="mt-auto w-[78mm] pt-[8mm] text-center">
          <div className="h-[0.3mm] w-full bg-navy/50" />
          <p className="mt-[2.5mm] text-[3.4mm] font-bold tracking-[0.06em] text-navy uppercase">
            {signature.name}
          </p>
          <p className="mt-[0.6mm] text-[2.9mm] tracking-[0.12em] text-ink uppercase">
            {signature.title}
          </p>
          <p className="mt-[0.4mm] text-[2.9mm] tracking-[0.06em] text-ink">
            {signature.document}
          </p>
        </footer>
      </div>
    </article>
  );
}

/**
 * Parte el título en dos líneas, como en el diseño: la base en mayúsculas y lo
 * que va tras el «+» en grande y en azul. Un título sin «+» va entero arriba.
 */
function splitCourse(title: string) {
  const withPrefix = /^taller\b/i.test(title) ? title : `Taller de ${title}`;
  const plus = withPrefix.indexOf(" + ");
  if (plus === -1) return { lead: withPrefix, accent: null };
  return {
    lead: withPrefix.slice(0, plus),
    accent: withPrefix.slice(plus + 1),
  };
}

/** Web pública del sitio, la que abre el QR. Sin ella se imprime el Instagram. */
function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  return raw ? raw.replace(/\/$/, "") : null;
}

function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1956", light: "#ffffff" },
  });
}

/* ------------------------------------------------------------------------ */
/* Ornamentos                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Triángulos navy de las cuatro esquinas con sus filetes azules. Un único SVG
 * en el sistema de coordenadas de la hoja (1 unidad = 1 mm), para que todo
 * quede alineado igual en pantalla que en el PDF.
 *
 * Cada filete es paralelo a la hipotenusa de su triángulo; el factor `k` lo
 * separa de ella (k = 1 es la hipotenusa misma).
 */
function CornerArt() {
  // Esquina superior izquierda: catetos 92 × 62.
  const tl = (k: number) => `${92 * k},0 0,${62 * k}`;
  // Superior derecha: 42 × 30.
  const tr = (k: number) => `${297 - 42 * k},0 297,${30 * k}`;
  // Inferior derecha: 60 × 45. Las de abajo son más pequeñas que las de
  // arriba porque el pie (aval, firma y código) llega casi hasta el borde.
  const br = (k: number) => `${297 - 60 * k},210 297,${210 - 45 * k}`;
  // Inferior izquierda: 44 × 36.
  const bl = (k: number) => `0,${210 - 36 * k} ${44 * k},210`;

  return (
    <svg
      aria-hidden
      viewBox="0 0 297 210"
      className="pointer-events-none absolute inset-0 size-full"
    >
      {/* Superior izquierda */}
      <polygon points={`0,0 ${tl(1)}`} fill="#0b1956" />
      <polygon points="0,0 58,0 0,34" fill="#060f36" />
      <polyline points={tl(1.07)} stroke="#5886e8" strokeWidth="0.8" fill="none" />
      <polyline points={tl(1.13)} stroke="#0b1956" strokeWidth="0.3" fill="none" />

      {/* Superior derecha */}
      <polygon points={`297,0 ${tr(1)}`} fill="#0b1956" />
      <polyline points={tr(1.12)} stroke="#5886e8" strokeWidth="0.6" fill="none" />
      <DotField x={282} y={3} cols={4} rows={3} />

      {/* Inferior derecha */}
      <polygon points={`297,210 ${br(1)}`} fill="#0b1956" />
      <polygon points="297,210 268,210 297,188" fill="#060f36" />
      <polyline points={br(1.07)} stroke="#5886e8" strokeWidth="0.8" fill="none" />
      <polyline points={br(1.14)} stroke="#0b1956" strokeWidth="0.3" fill="none" />
      <DotField x={282} y={196} cols={4} rows={4} />

      {/* Inferior izquierda: con la banda azul ancha del diseño */}
      <polygon points={`0,210 ${bl(1)}`} fill="#0b1956" />
      <polygon points={`${bl(1.06)} ${bl(1.16).split(" ").reverse().join(" ")}`} fill="#5886e8" />
      <polyline points={bl(1.23)} stroke="#0b1956" strokeWidth="0.3" fill="none" />
      <DotField x={3} y={196} cols={4} rows={4} />
    </svg>
  );
}

/**
 * Retícula de puntos sobre los triángulos. Círculos sueltos y no un
 * `<pattern>`: algunos motores de PDF reescalan el patrón y lo imprimen como
 * tres o cuatro manchas.
 */
function DotField({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) {
  return (
    <g fill="#8fb2ff" opacity="0.6">
      {Array.from({ length: cols * rows }, (_, i) => (
        <circle key={i} cx={x + (i % cols) * 3 + 1.5} cy={y + Math.floor(i / cols) * 3 + 1.5} r="0.35" />
      ))}
    </g>
  );
}

/** Los tres puntos bajo «de participación», o la retícula junto al curso. */
function Dots({ grid = false, className = "" }: { grid?: boolean; className?: string }) {
  const cols = grid ? 4 : 3;
  const rows = grid ? 3 : 1;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols * 3} ${rows * 3}`}
      className={`shrink-0 ${className}`}
      style={{ width: `${cols * 2.4}mm`, height: `${rows * 2.4}mm` }}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <circle
          key={i}
          cx={(i % cols) * 3 + 1.5}
          cy={Math.floor(i / cols) * 3 + 1.5}
          r={grid ? 0.45 : 0.6}
          fill="#0b1956"
          opacity={grid ? 0.7 : 0.85}
        />
      ))}
    </svg>
  );
}

/** Trazo de electrocardiograma que enmarca el nombre del curso. */
function Pulse() {
  return (
    <svg aria-hidden viewBox="0 0 40 12" className="h-[5mm] w-[16mm] shrink-0" fill="none">
      <path
        d="M0 6 H13 L15 3 L17.5 10 L20.5 1 L23 9 L25 6 H40"
        stroke="#5886e8"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "size-[4.4mm] shrink-0 text-azure",
} as const;

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
