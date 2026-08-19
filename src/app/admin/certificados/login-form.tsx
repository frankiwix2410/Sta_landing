"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="w-full max-w-[360px]">
      <label htmlFor="password" className="block text-[13px] font-semibold text-navy">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        aria-invalid={Boolean(state.error)}
        className="mt-2 w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-[15px] text-navy outline-none transition-colors duration-200 focus:border-azure"
      />
      {state.error && (
        <p role="alert" className="mt-2 text-[12.5px] text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full cursor-pointer rounded-xl bg-navy py-3.5 text-[14.5px] font-semibold text-white transition-colors duration-200 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
