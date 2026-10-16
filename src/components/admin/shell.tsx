import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/admin/actions";
import { botonSecundario } from "./ui";

const enlaces = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/talleres", label: "Talleres" },
  { href: "/admin/inscritos", label: "Inscritos" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/certificados", label: "Certificados" },
];

export function AdminShell({
  titulo,
  subtitulo,
  acciones,
  children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[100svh] bg-cream px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[1000px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-navy/10 pb-5">
          <nav className="flex flex-wrap gap-5">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="text-[14px] font-semibold text-navy underline-offset-4 hover:text-azure hover:underline"
              >
                {e.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button type="submit" className={botonSecundario}>
              Salir
            </button>
          </form>
        </header>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-tight text-navy">{titulo}</h1>
            {subtitulo && <div className="mt-1.5 text-[14px] text-ink-soft">{subtitulo}</div>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
