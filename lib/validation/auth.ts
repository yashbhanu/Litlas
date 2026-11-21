/**
 * Only allow same-site relative redirect targets (prevents open redirects via ?next=).
 * Returns the fallback for anything else.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/me"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  return value;
}
