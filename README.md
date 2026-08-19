This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Reservas del taller (Supabase)

Las reservas de `/taller` se guardan en Supabase y el cupo se cuenta contra la
edición activa.

1. **Esquema**: en Supabase, SQL Editor → pegar `supabase/schema.sql` → Run.
   Ajusta `total_seats` en el `insert` final al cupo real.
2. **Credenciales**: copia `.env.example` a `.env.local` y rellena
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. En Vercel, las mismas dos
   variables en Project Settings → Environment Variables.
3. **Edición activa**: `taller.edition` en `src/lib/taller.ts` debe coincidir con
   el `slug` de la fila en `taller_editions`.

Sin esas variables la landing sigue funcionando: las reservas quedan solo en los
logs del servidor y no se cuentan cupos.

**Operación diaria** (Supabase → Table Editor → `reservations`):

- Confirmar un pago: `status` → `confirmed`. Es un ENUM, así que sale como
  desplegable: no hay que escribirlo.
- Liberar un cupo: `status` → `cancelled` (es el único estado que no ocupa plaza).
- Cerrar las ventas sin tocar código: `taller_editions.is_open` → `false`.
- Ampliar el aforo: subir `taller_editions.total_seats`.

## Certificados

Una reserva da derecho a certificado cuando cumple **las dos** condiciones:
`status = confirmed` (pagó) y `attended = true` (se presentó). Son casillas
distintas a propósito: quien paga y no va no debe certificarse.

**Al terminar el taller:**

1. En `reservations`, marca `attended` a quien asistió.
2. Entra en `/admin/certificados` con la contraseña de `CERTIFICADOS_PASSWORD`.
3. Desde ahí: «Imprimir los N en un PDF» genera un PDF con una página por
   asistente, o copia el enlace de cada uno para mandarlo por WhatsApp.

Cada certificado vive en `/certificado/STA-XXXXXXXX` (la misma referencia de la
reserva). El enlace es público y sirve como verificación: se comprueba contra la
base en cada visita, así que si desmarcas `attended` deja de acreditar al
instante. La página no muestra email ni ciudad.

**Datos del certificado** — salen de `taller_editions`, no del código, para que
un certificado emitido hoy siga siendo correcto cuando programes otra edición:

| Columna        | Qué imprime                                        |
| -------------- | -------------------------------------------------- |
| `course_title` | El nombre del taller                               |
| `dates_label`  | Las fechas                                         |
| `hours`        | Horas académicas. **Pendiente**: mientras sea `NULL` el certificado no las menciona |
| `endorsement`  | El aval                                            |
