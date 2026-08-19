"use client";

import { useState } from "react";
import { useLang } from "@/components/providers";
import { Reveal, WordsReveal } from "@/components/ui/motion-primitives";
import { ClockIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/icons";
import { site, waLink } from "@/lib/site";

export function Contact() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", phone: "", msg: "" });

  const inputClass =
    "w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-sm text-navy outline-none transition-colors duration-200 placeholder:text-ink-soft/60 focus:border-azure";
  const labelClass =
    "mb-2 block text-[12.5px] font-semibold tracking-[0.04em] text-navy";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = t.wa.form(form.name, form.phone, form.msg);
    window.open(waLink(body), "_blank", "noopener");
  }

  return (
    <section id="contacto" className="bg-white px-5 py-24 sm:px-8 lg:px-16 lg:py-32">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal className="eyebrow mb-4 text-azure">
            <span className="block h-px w-6 bg-azure" />
            {t.contact.eyebrow}
          </Reveal>

          <WordsReveal
            lines={t.contact.title}
            className="text-[clamp(30px,4vw,48px)] leading-[1.1] text-navy"
          />

          <Reveal delay={0.12}>
            <p className="mt-5 mb-8 max-w-[420px] text-[15px] leading-[1.8] text-ink">
              {t.contact.sub}
            </p>
          </Reveal>

          <div className="flex flex-col gap-3.5">
            <Reveal delay={0.18}>
              <a
                href={waLink(t.wa.book)}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 rounded-2xl bg-cream px-5 py-4 transition-all duration-300 hover:translate-x-1 hover:bg-ice"
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-[#25D366] text-white">
                  <WhatsAppIcon />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    {t.contact.waTitle}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {t.contact.waDesc}
                  </span>
                </span>
              </a>
            </Reveal>

            <Reveal delay={0.24}>
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 rounded-2xl bg-cream px-5 py-4 transition-all duration-300 hover:translate-x-1 hover:bg-ice"
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-navy text-white">
                  <InstagramIcon />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    @{site.instagram}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {t.contact.igDesc}
                  </span>
                </span>
              </a>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="flex items-center gap-4 rounded-2xl bg-cream px-5 py-4">
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-azure text-white">
                  <ClockIcon />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-navy">
                    {t.contact.hoursTitle}
                  </span>
                  <span className="block text-[13px] text-ink-soft">
                    {t.contact.hoursDesc}
                  </span>
                </span>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.15}>
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-3xl bg-cream p-6 sm:p-8"
          >
            <div>
              <label htmlFor="name" className={labelClass}>
                {t.contact.form.name}
              </label>
              <input
                id="name"
                required
                type="text"
                autoComplete="name"
                placeholder={t.contact.form.namePh}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                {t.contact.form.phone}
              </label>
              <input
                id="phone"
                required
                type="tel"
                autoComplete="tel"
                placeholder={t.contact.form.phonePh}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="msg" className={labelClass}>
                {t.contact.form.msg}
              </label>
              <textarea
                id="msg"
                rows={4}
                placeholder={t.contact.form.msgPh}
                value={form.msg}
                onChange={(e) => setForm({ ...form, msg: e.target.value })}
                className={`${inputClass} resize-y`}
              />
            </div>

            <button
              type="submit"
              className="mt-1 inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-navy py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-azure"
            >
              <WhatsAppIcon className="size-[18px]" />
              {t.contact.form.send}
            </button>

            <p className="text-center text-[11.5px] text-ink-soft">
              {t.contact.form.note}
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
