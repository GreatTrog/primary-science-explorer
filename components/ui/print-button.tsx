"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[var(--foreground)] px-5 py-3 font-semibold text-white"
    >
      Print / save as PDF
    </button>
  );
}
