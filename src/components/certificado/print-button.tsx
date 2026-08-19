"use client";

export function PrintButton({ label = "Descargar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cert-no-print inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy px-6 py-3 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-azure focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure"
    >
      {label}
    </button>
  );
}
