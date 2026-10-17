/**
 * Maps technical Supabase/Postgres/network errors to friendly Arabic messages.
 * Falls back to a generic message if the error shape is unrecognized.
 */

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
}

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  const err = error as ErrorLike;
  const message = err?.message || "";
  const code = err?.code || "";

  // Network / connectivity
  if (!navigator.onLine) {
    return "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مجدداً.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.";
  }

  // RLS / permissions
  if (code === "42501" || message.toLowerCase().includes("permission denied") || message.toLowerCase().includes("row-level security")) {
    return "ليس لديك صلاحية لتنفيذ هذا الإجراء.";
  }

  // Auth
  if (message.includes("JWT") || message.includes("not authenticated") || code === "401") {
    return "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.";
  }

  // Unique constraint violation
  if (code === "23505") {
    return "هذا السجل موجود بالفعل.";
  }

  // Foreign key violation
  if (code === "23503") {
    return "لا يمكن إتمام العملية بسبب ارتباط هذا السجل ببيانات أخرى.";
  }

  // Not null violation
  if (code === "23502") {
    return "يرجى تعبئة جميع الحقول المطلوبة.";
  }

  // Rate limiting
  if (code === "429" || message.includes("rate limit")) {
    return "محاولات كثيرة جداً. يرجى الانتظار قليلاً والمحاولة مجدداً.";
  }

  // Timeout
  if (message.includes("timeout") || code === "57014") {
    return "استغرقت العملية وقتاً طويلاً. حاول مجدداً.";
  }

  // If the error has a specific, somewhat readable message from a custom
  // RPC/function (e.g. "لا توجد مؤسسة محددة"), prefer it over generic fallback.
  if (message && message.length < 120 && /[\u0600-\u06FF]/.test(message)) {
    return message;
  }

  return fallback;
}
