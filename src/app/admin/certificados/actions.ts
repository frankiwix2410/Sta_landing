"use server";

import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/lib/admin-auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const ok = typeof password === "string" && (await signIn(password));

  if (!ok) return { error: "Contraseña incorrecta." };

  revalidatePath("/admin/certificados");
  return {};
}

export async function logout() {
  await signOut();
  revalidatePath("/admin/certificados");
}
