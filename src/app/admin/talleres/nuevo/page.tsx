import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";
import { LoginScreen } from "@/components/admin/login-screen";
import { TallerForm } from "@/components/admin/taller-form";
import { puertaAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Nuevo taller · STA",
  robots: { index: false, follow: false },
};

export default async function NuevoTallerPage() {
  if (!(await puertaAdmin())) return <LoginScreen />;

  return (
    <AdminShell
      titulo="Nuevo taller"
      subtitulo="Se crea como borrador: no aparece en la página hasta que lo publiques."
    >
      <TallerForm />
    </AdminShell>
  );
}
