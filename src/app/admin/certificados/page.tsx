import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { listCertificates } from "@/lib/reservations/certificates";
import { taller } from "@/lib/taller";
import { logout } from "./actions";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificados · STA",
  robots: { index: false, follow: false },
};

export default async function CertificadosAdminPage() {
  // Sin contraseña configurada la ruta no existe: mejor un 404 que una lista de
  // asistentes accesible a cualquiera que adivine la URL.
  if (!adminConfigured()) notFound();

  if (!(await isAdmin())) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
        <div className="w-full max-w-[360px]">
          <h1 className="text-[28px] leading-tight text-navy">Certificados</h1>
          <p className="mt-2 mb-7 text-[14px] leading-relaxed text-ink-soft">
            Zona privada del taller.
          </p>
          <LoginForm />
        </div>
      </main>
    );
  }

  const certificates = await listCertificates(taller.edition);

  return (
    <main className="min-h-[100svh] bg-cream px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-tight text-navy">Certificados</h1>
            <p className="mt-1.5 text-[14px] text-ink-soft">
              Edición <span className="font-mono text-[13px]">{taller.edition}</span>
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="cursor-pointer rounded-full border border-navy/20 px-5 py-2.5 text-[13px] font-semibold text-navy transition-colors duration-200 hover:border-navy/50"
            >
              Salir
            </button>
          </form>
        </div>

        {certificates === null ? (
          <p className="mt-10 rounded-2xl bg-white p-6 text-[14.5px] leading-relaxed text-ink">
            No se pudo consultar la base de datos. Revisa que{" "}
            <code className="font-mono text-[13px]">SUPABASE_URL</code> y{" "}
            <code className="font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code> estén
            configuradas.
          </p>
        ) : certificates.length === 0 ? (
          <p className="mt-10 rounded-2xl bg-white p-6 text-[14.5px] leading-relaxed text-ink">
            Todavía no hay nadie con certificado. Aparecen aquí las reservas que tengan{" "}
            <strong>status «confirmed»</strong> y la casilla <strong>attended</strong>{" "}
            marcada en Supabase.
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/certificados/imprimir"
                className="inline-flex cursor-pointer items-center rounded-full bg-navy px-6 py-3 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-azure"
              >
                Imprimir los {certificates.length} en un PDF
              </Link>
              <span className="text-[13px] text-ink-soft">
                O copia el enlace de cada uno para enviarlo por WhatsApp.
              </span>
            </div>

            <ul className="mt-7 divide-y divide-navy/10 overflow-hidden rounded-2xl bg-white">
              {certificates.map((c) => (
                <li
                  key={c.reference}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-navy">{c.name}</p>
                    <p className="text-[12.5px] text-ink-soft">
                      {c.profession} · {c.city} · {c.email}
                    </p>
                  </div>
                  <Link
                    href={`/certificado/${c.reference}`}
                    className="shrink-0 font-mono text-[13px] text-azure underline-offset-4 hover:underline"
                  >
                    {c.reference}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
