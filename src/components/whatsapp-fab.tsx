"use client";

import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useLang } from "@/components/providers";
import { WhatsAppIcon } from "@/components/ui/icons";
import { waLink } from "@/lib/site";

export function WhatsAppFab() {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  const { scrollY } = useScroll();

  // Solo aparece pasado el hero: allí el CTA principal ya está visible.
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > 500));

  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={waLink(t.wa.book)}
          target="_blank"
          rel="noopener"
          aria-label="WhatsApp"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-5 bottom-5 z-130 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_14px_34px_-10px_rgba(37,211,102,.7)] sm:right-6 sm:bottom-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-25 [animation-duration:2.4s]" />
          <WhatsAppIcon className="relative size-7" />
        </motion.a>
      )}
    </AnimatePresence>
  );
}
