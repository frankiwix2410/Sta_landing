import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { puertaAdmin } from "@/lib/admin-auth";
import { listCertificates } from "@/lib/reservations/certificates";
import { slugParaAdmin } from "@/lib/talleres/publico";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificados · STA",
  robots: { index: false, follow: false },
};

export default async function CertificadosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  if (!(await puertaAdmin())) return <LoginScreen />;

  const slug = await slugParaAdmin((await searchParams).taller);
  if (!slug) {
    return (
      <AdminShell titulo="Certificados">
        <p className="rounded-2xl bg-white p-6 text-[14.5px] text-ink">
          No hay ningún taller visible. Elige uno desde Talleres.
        </p>
      </AdminShell>
    );
  }

  const certificates = await listCertificates(slug);

  return (
    <AdminShell
      titulo="Certificados"
      subtitulo={
        <>
          Edición <span className="font-mono text-[13px]">{slug}</span>
        </>
      }
    >
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
                href={`/admin/certificados/imprimir?taller=${slug}`}
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
    </AdminShell>
  );
}
