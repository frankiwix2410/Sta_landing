import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-cream px-5 py-16">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[28px] leading-tight text-navy">Administración</h1>
        <p className="mt-2 mb-7 text-[14px] leading-relaxed text-ink-soft">Zona privada del taller.</p>
        <LoginForm />
      </div>
    </main>
  );
}
