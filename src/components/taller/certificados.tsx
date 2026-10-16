"use client";

import { startTransition, useActionState } from "react";
import { buscarCertificados, type CertificadosState } from "@/app/taller/actions";
import { Reveal } from "@/components/ui/motion-primitives";

const inicial: CertificadosState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
const labelClass = "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";

/**
 * «Descarga tu certificado». Con el taller finalizado va destacada y arriba:
 * es lo que viene a buscar quien entra a la página después del taller.
 */
export function CertificadosSection({ destacada }: { destacada: boolean }) {
  const [state, action, pending] = useActionState(buscarCertificados, inicial);

  return (
    <section
      id="certificados"
      className={`${destacada ? "bg-ice" : "bg-white"} px-5 py-24 sm:px-8 lg:px-16 lg:py-32`}
    >
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            Certificados
          </Reveal>
          <Reveal>
            <h2 className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy">
              {destacada ? "¿Asististe?" : "Descarga tu"}
              <span className="block text-azure">
                {destacada ? "Descarga tu certificado." : "certificado."}
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-[420px] text-[15px] leading-[1.8] text-ink">
              Escribe el documento con el que te inscribiste y verás los certificados de todos los
              talleres en los que participaste, listos para guardar en PDF. Se emiten cuando el
              taller termina, con el pago completo y la asistencia registrada.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="rounded-3xl bg-cream p-6 sm:p-8">
            <form
              onSubmit={(e) => {
                // A mano y no con `action`: así el documento no se borra al responder.
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(() => action(formData));
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="cert-documento" className={labelClass}>
                  Número de documento
                </label>
                <input
                  id="cert-documento"
                  name="documento"
                  required
                  maxLength={30}
                  autoComplete="off"
                  placeholder="Cédula o pasaporte"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-navy px-7 py-3.5 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Buscando…" : "Buscar"}
              </button>
            </form>

            {state.status === "error" && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {state.message}
              </p>
            )}

            {state.status === "ok" &&
              (state.certificados.length === 0 ? (
                <p className="mt-5 text-[14px] leading-[1.8] text-ink">
                  No encontramos certificados disponibles con ese documento. Si asististe y pagaste
                  el 100%, puede que todavía no los hayamos emitido: escríbenos por WhatsApp.
                </p>
              ) : (
                <ul className="mt-5 flex flex-col gap-3">
                  {state.certificados.map((c) => (
                    <li
                      key={c.codigo}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-semibold text-navy">{c.curso}</p>
                        <p className="text-[12.5px] text-ink-soft">
                          {c.fechasTexto} · <span className="font-mono">{c.codigo}</span>
                        </p>
                      </div>
                      <a
                        href={`/certificado/${c.codigo}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-azure"
                      >
                        Ver y descargar
                      </a>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
