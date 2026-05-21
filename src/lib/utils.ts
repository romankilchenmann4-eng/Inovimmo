// ── Shared Utilities ──────────────────────────────────────────

export { formatCHF, roundCHF } from "./nebenkostenabrechnung/calc";

/**
 * Safe CHF formatter that handles undefined/null/0 correctly.
 * Returns "0.00" for falsy values instead of empty string.
 */
export function chf(n?: number | null): string {
  if (n === undefined || n === null) return "0.00";
  return n.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip control characters from strings intended for PDF rendering.
 */
export function sanitizePdfText(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}