"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/providers";
import { WordsReveal } from "@/components/ui/motion-primitives";
import { SmoothLink } from "@/components/ui/smooth-link";
import { PauseIcon, PlayIcon, WhatsAppIcon } from "@/components/ui/icons";
import { gsap, STA_EASE } from "@/lib/gsap";
import { site, waLink } from "@/lib/site";

export function Hero() {
  const { t } = useLang();
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // Distingue «lo pausó el usuario» de «lo pausamos al salir del viewport»:
  // solo lo primero debe sobrevivir a que el hero vuelva a entrar en pantalla.
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = root.current;
    const vid = video.current;
    if (!el || !vid) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ------------------------------------------------------ Reproducción
       Sin atributo `autoPlay`: arrancarlo desde JS deja el póster visible hasta
       que haya buffer y permite no arrancar nada si se pide menos movimiento. */
    const tryPlay = () => {
      if (reduce || userPaused.current) return;
      vid.play().catch(() => {
        /* iOS en bajo consumo rechaza el autoplay: se queda el póster */
      });
    };
    tryPlay();

    // Un bucle fuera de pantalla solo gasta batería.
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? tryPlay() : vid.pause()),
      { threshold: 0.05 },
    );
    io.observe(el);

    /* ------------------------------------------------------------- GSAP */
    const ctx = gsap.context(() => {
      if (reduce) {
        // Sin animación hay que deshacer a mano los estados iniciales del CSS.
        gsap.set(".hero-panel", { clipPath: "none" });
        gsap.set([".hero-in", ".hero-cue"], { opacity: 1, y: 0 });
        gsap.set(".hero-rule", { scaleX: 1 });
        return;
      }

      // Entrada: el panel de video se revela con un barrido vertical mientras
      // la imagen sale de un zoom, y el texto entra escalonado por detrás.
      gsap
        .timeline({ defaults: { ease: STA_EASE } })
        .to(".hero-panel", { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5 }, 0)
        .fromTo(".hero-zoom", { scale: 1.28 }, { scale: 1, duration: 2.4 }, 0)
        .fromTo(
          ".hero-sweep",
          { yPercent: -110, opacity: 0.9 },
          { yPercent: 110, opacity: 0, duration: 1.8, ease: "power2.inOut" },
          0.35,
        )
        .to(".hero-rule", { scaleX: 1, duration: 0.9 }, 0.2)
        .to(".hero-in", { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, 0.4)
        .to(".hero-cue", { opacity: 1, duration: 0.8 }, 1.35);

      // El punto del indicador recorre su riel en bucle.
      gsap.fromTo(
        ".hero-cue-dot",
        { yPercent: -100 },
        { yPercent: 200, duration: 1.9, repeat: -1, ease: "power1.inOut" },
      );

      // Scroll: el texto se va antes que la imagen, y el video se hunde y se
      // oscurece — así el hero entrega la página en vez de cortarse en seco.
      gsap
        .timeline({
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
        })
        .to(".hero-text", { yPercent: -26, ease: "none", duration: 1 }, 0)
        .to(".hero-text", { opacity: 0, ease: "none", duration: 0.72 }, 0)
        .to(".hero-parallax", { yPercent: 8, scale: 1.12, ease: "none", duration: 1 }, 0)
        .to(".hero-dim", { opacity: 0.62, ease: "none", duration: 1 }, 0)
        .to(".hero-mark", { yPercent: 16, ease: "none", duration: 1 }, 0)
        .to(".hero-cue", { opacity: 0, ease: "none", duration: 0.35 }, 0);

      // Con puntero fino el video acompaña al cursor muy ligeramente. quickTo
      // reutiliza un mismo tween, que es lo que lo hace viable en pointermove.
      if (window.matchMedia("(pointer: fine)").matches) {
        const xTo = gsap.quickTo(".hero-tilt", "xPercent", { duration: 0.9, ease: "power3.out" });
        const yTo = gsap.quickTo(".hero-tilt", "yPercent", { duration: 0.9, ease: "power3.out" });

        const onMove = (e: PointerEvent) => {
          xTo((e.clientX / window.innerWidth - 0.5) * -3);
          yTo((e.clientY / window.innerHeight - 0.5) * -3);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        return () => window.removeEventListener("pointermove", onMove);
      }
    }, el);

    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, []);

  const toggle = () => {
    const vid = video.current;
    if (!vid) return;
    if (vid.paused) {
      userPaused.current = false;
      vid.play().catch(() => { });
    } else {
      userPaused.current = true;
      vid.pause();
    }
  };

  return (
    <header
      ref={root}
      id="top"
      className="grain relative grid min-h-[100svh] grid-cols-1 overflow-hidden bg-navy lg:grid-cols-[1fr_.82fr]"
    >
      {/* Monograma tipográfico de fondo, del lado del texto */}
      <div
        aria-hidden
        className="hero-mark pointer-events-none absolute bottom-[-12%] left-[-10%] font-serif leading-[0.7] text-white/[0.04] select-none"
      >
        <span className="text-[min(62vh,620px)]">STA</span>
      </div>

      {/* ---------------------------------------------------------- Texto
          El texto va primero en el DOM para lectores de pantalla; en móvil el
          panel de video queda por detrás como fondo a sangre. */}
      <div className="hero-text relative z-10 flex flex-col justify-center px-5 pt-28 pb-24 sm:px-8 lg:pt-32 lg:pr-12 lg:pb-24 lg:pl-[max(4rem,calc((100vw-1240px)/2))]">
        <div className="max-w-[560px]">
          <div className="eyebrow anim-in hero-in mb-6 text-sky">
            <span className="anim-rule hero-rule block h-px w-9 origin-left bg-azure" />
            {t.hero.eyebrow}
          </div>

          <WordsReveal
            as="h1"
            lines={t.hero.title}
            accent={t.hero.titleAccent}
            once={false}
            className="text-[clamp(40px,5.4vw,78px)] leading-[1] text-white"
          />

          <div className="anim-in hero-in">
            <p className="mt-6 font-serif text-[clamp(18px,2vw,22px)] text-ice">{site.doctor}</p>
            <p className="mt-1.5 max-w-md text-sm font-medium tracking-[0.03em] text-ice/70">
              {t.hero.spec}
            </p>
            <p className="mt-5 max-w-[460px] text-[15px] leading-[1.8] text-ice/65">{t.hero.sub}</p>
          </div>

          <div className="anim-in hero-in mt-8 flex flex-wrap gap-3.5">
            <a
              href={waLink(t.wa.book)}
              target="_blank"
              rel="noopener"
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-azure px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sky"
            >
              <WhatsAppIcon className="size-[18px]" />
              {t.hero.cta1}
            </a>
            <SmoothLink
              href="#sobre"
              className="inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-white/35 px-7 py-4 text-[14.5px] font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sky"
            >
              {t.hero.cta2}
            </SmoothLink>
          </div>

          <div className="anim-in hero-in mt-8 inline-flex items-center gap-3.5 rounded-2xl bg-white/95 px-5 py-3.5 shadow-[0_24px_50px_-24px_rgba(0,0,0,.6)]">
            <span className="font-serif text-3xl leading-none text-navy">
              +{site.yearsExperience}
            </span>
            <span className="max-w-[120px] text-[11.5px] leading-tight text-ink-soft">
              {t.hero.badge}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- Panel de video
          Móvil: fondo a sangre de todo el hero. lg: columna derecha. */}
      <div className="anim-panel hero-panel absolute inset-0 overflow-hidden lg:relative lg:inset-auto lg:h-full">
        <div className="hero-parallax absolute -top-[14%] -bottom-[14%] left-0 w-full">
          <div className="hero-zoom size-full">
            <div className="hero-tilt absolute inset-[-3%]">
              <video
                ref={video}
                className="size-full object-cover"
                poster="/assets/hero-pov-poster.webp"
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={t.hero.videoAlt}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              >
                <source src="/assets/hero-pov.webm" type="video/webm" />
                <source src="/assets/hero-pov.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>

        {/* Barrido de luz de la entrada */}
        <div
          aria-hidden
          className="hero-sweep pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-sky/25 to-transparent opacity-0"
        />

        {/* Legibilidad: en móvil el texto va encima del video, así que el velo
            es fuerte; en lg solo funde la costura con el navy de la izquierda. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy via-navy/88 to-navy/50 lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[42%] bg-gradient-to-r from-navy via-navy/55 to-transparent lg:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-navy/10 lg:block"
        />

        {/* Oscurecido progresivo que conduce el scroll */}
        <div
          aria-hidden
          className="hero-dim pointer-events-none absolute inset-0 bg-navy-deep opacity-0"
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t.hero.videoPause : t.hero.videoPlay}
          className="absolute right-4 bottom-4 z-10 grid size-11 cursor-pointer place-items-center rounded-full border border-white/25 bg-navy/45 text-white backdrop-blur-sm transition-colors duration-200 hover:border-white/60 hover:bg-navy/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky sm:right-6 sm:bottom-6"
        >
          {playing ? <PauseIcon className="size-3.5" /> : <PlayIcon className="size-3.5" />}
        </button>
      </div>

      {/* Indicador de scroll */}
      <div className="anim-in hero-cue absolute bottom-7 z-10 hidden flex-col items-center gap-2.5 lg:flex lg:left-[max(4rem,calc((100vw-1240px)/2))]">
        <span className="text-[10px] font-semibold tracking-[0.25em] text-ice/50 uppercase">
          {t.hero.scroll}
        </span>
        <span className="relative block h-9 w-px overflow-hidden bg-white/15">
          <span className="hero-cue-dot absolute inset-x-0 block h-1/2 bg-sky" />
        </span>
      </div>
    </header>
  );
}
