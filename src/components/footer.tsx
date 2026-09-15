"use client";

import Image from "next/image";
import { useLang } from "@/components/providers";
import { SmoothLink } from "@/components/ui/smooth-link";
import { site, waLink } from "@/lib/site";

export function Footer() {
  const { t } = useLang();

  const links = [
    { href: "#sobre", label: t.nav.about },
    { href: "#servicios", label: t.nav.services },
    { href: "#galeria", label: t.nav.gallery },
    { href: "#contacto", label: t.nav.contact },
  ];

  return (
    <footer className="grain relative bg-navy px-5 pt-16 pb-8 text-white sm:px-8 lg:px-16 lg:pt-20">
      <div className="relative mx-auto flex max-w-[1120px] flex-wrap items-start justify-between gap-9">
        <div className="max-w-[320px]">
          <Image
            // Versión recortada: la "full" trae tanto margen transparente que
            // a esta altura el logo visible quedaba en ~21px.
            src="/assets/logo-horizontal-white-trim.png"
            alt={site.brandFull}
            width={1100}
            height={334}
            sizes="290px"
            className="h-[72px] w-auto sm:h-[88px]"
          />
          <p className="mt-3.5 text-[13px] leading-[1.7] text-ice/55">{t.footer.tag}</p>
        </div>

        <div className="flex flex-wrap gap-12">
          <div>
            <h4 className="mb-4 text-[13px] tracking-[0.1em] text-sky uppercase">
              {t.footer.nav}
            </h4>
            <div className="flex flex-col gap-2.5">
              {links.map((l) => (
                <SmoothLink
                  key={l.href}
                  href={l.href}
                  className="text-[13.5px] text-white/80 transition-colors hover:text-white"
                >
                  {l.label}
                </SmoothLink>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-[13px] tracking-[0.1em] text-sky uppercase">
              {t.footer.social}
            </h4>
            <div className="flex flex-col gap-2.5">
              <a
                href={site.instagramUrl}
                target="_blank"
                rel="noopener"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                Instagram @{site.instagram}
              </a>
              <a
                href={waLink(t.wa.book)}
                target="_blank"
                rel="noopener"
                className="text-[13.5px] text-white/80 transition-colors hover:text-white"
              >
                {t.footer.wa}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-12 flex max-w-[1120px] flex-wrap items-center justify-between gap-3.5 border-t border-white/12 pt-6">
        <span className="text-xs text-ice/45">
          © {new Date().getFullYear()} {site.doctor} · {site.brand}
        </span>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-ice/45 transition-colors hover:text-white">
            {t.footer.privacy}
          </a>
          <a href="#" className="text-xs text-ice/45 transition-colors hover:text-white">
            {t.footer.legal}
          </a>
        </div>
      </div>
    </footer>
  );
}
