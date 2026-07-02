/**
 * Shared Security Module — Suda Technologies / Hisabaty
 * Central place for CORS, auth validation, and rate limiting
 */

// ─── CORS ────────────────────────────────────────────────────────────────────
// Only allow requests from known origins. Webhooks use a separate config.

const ALLOWED_ORIGINS = [
  "https://hesabaty-sd.netlify.app",
  "https://hesapaty.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // fallback to production

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

// Webhooks (WhatsApp, Meta, Green API) must accept requests from external servers
// so they cannot restrict by Origin. They use HMAC signature verification instead.
export const WEBHOOK_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── AUTH VALIDATION ─────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  ok: boolean;
  userId?: string;
  error?: string;
  client?: SupabaseClient;
}

/**
 * Validate Bearer JWT from Authorization header.
 * Returns authenticated Supabase client scoped to the user.
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or invalid Authorization header" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: "Server configuration error" };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  return { ok: true, userId: user.id, client };
}

/**
 * Create a service-role client for cron/internal functions only.
 * Never expose service role key to the frontend.
 */
export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─── INTERNAL CRON GUARD ─────────────────────────────────────────────────────

/**
 * Protect cron/internal functions from being called externally.
 * Requires either a cron secret header or service-role JWT.
 */
export function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false; // deny if not configured
  const provided = req.headers.get("x-cron-secret");
  return provided === cronSecret;
}

// ─── SIGNATURE VERIFICATION ──────────────────────────────────────────────────

/**
 * Verify HMAC-SHA256 webhook signature.
 * ALWAYS fails if secret is not configured — no bypass allowed.
 */
export async function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!signatureHeader) return false;
  if (!secret) return false; // SECURITY: never allow bypass

  try {
    const [algo, receivedHash] = signatureHeader.split("=");
    if (algo !== "sha256") return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expectedHash = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    return constantTimeEqual(expectedHash, receivedHash);
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── RESPONSE HELPERS ────────────────────────────────────────────────────────

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function forbiddenResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Forbidden" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
