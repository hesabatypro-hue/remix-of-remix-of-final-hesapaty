/**
 * Lightweight logger for auth → app navigation events.
 * Helps detect mis-routing (e.g. existing user being sent to /onboarding).
 *
 * Logs to the browser console with a recognizable tag and stores
 * the last 50 events in sessionStorage under `auth_nav_log` for inspection.
 */

export type AuthNavEvent =
  | "signin_success"
  | "signup_success"
  | "redirect_to_dashboard"
  | "redirect_to_onboarding"
  | "redirect_from_protected"
  | "auth_already_logged_in"
  | "signin_error"
  | "signup_error"
  | "google_signin_success"
  | "google_signin_error"
  | "signin_mfa_required";

interface LogEntry {
  ts: string;
  event: AuthNavEvent;
  from?: string;
  to?: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
}

const STORAGE_KEY = "auth_nav_log";
const MAX_ENTRIES = 50;

export function logAuthNav(event: AuthNavEvent, data: Omit<LogEntry, "ts" | "event"> = {}) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    event,
    ...data,
  };

  // Console log with a clear tag
  // eslint-disable-next-line no-console
  console.info("[AUTH_NAV]", entry);

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: LogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function getAuthNavLog(): LogEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
