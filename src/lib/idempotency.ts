/**
 * Idempotency helpers for financial mutations.
 *
 * Generate a stable client-side key per submit attempt. If the request is
 * retried (network blip, double-click), the database UNIQUE index on
 * (organization_id, idempotency_key) rejects the duplicate with Postgres
 * error code 23505 — we treat that as success.
 */

export function newIdempotencyKey(): string {
  // Browsers and Deno expose crypto.randomUUID(); fall back just in case.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Returns true if the error is a Postgres unique_violation on idempotency_key. */
export function isIdempotencyReplay(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code !== "23505") return false;
  return (e.message || "").includes("idempotency_key");
}
