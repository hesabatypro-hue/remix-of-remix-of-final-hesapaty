/**
 * Pure parsing / validation helpers shared by the WhatsApp webhooks.
 *
 * Deliberately free of Deno APIs, network calls and database access so the
 * same code runs inside the edge functions AND inside the vitest suite.
 */

export const SUDAN_OFFSET_HOURS = 2;

export const INTENT_WORDS = [
  "ملخص", "إيراد", "ايراد", "إيرادات", "ايرادات", "دخل", "تقرير", "حسابات",
  "revenue", "summary", "report",
];

export const TODAY_WORDS = ["اليوم", "النهارده", "النهاردة", "today"];

export const MONTHS: Record<number, string[]> = {
  1: ["1", "01", "يناير", "january", "jan", "واحد"],
  2: ["2", "02", "فبراير", "february", "feb", "اثنين", "اتنين"],
  3: ["3", "03", "مارس", "march", "mar", "ثلاثة", "تلاته"],
  4: ["4", "04", "أبريل", "ابريل", "april", "apr", "اربعة", "أربعة"],
  5: ["5", "05", "مايو", "may", "خمسة", "خمسه"],
  6: ["6", "06", "يونيو", "يونيه", "june", "jun", "ستة", "سته"],
  7: ["7", "07", "يوليو", "يوليه", "july", "jul", "سبعة", "سبعه"],
  8: ["8", "08", "أغسطس", "اغسطس", "august", "aug", "ثمانية", "تمانية"],
  9: ["9", "09", "سبتمبر", "september", "sep", "sept", "تسعة", "تسعه"],
  10: ["10", "أكتوبر", "اكتوبر", "october", "oct", "عشرة", "عشره"],
  11: ["11", "نوفمبر", "november", "nov", "احد عشر", "إحدى عشر"],
  12: ["12", "ديسمبر", "december", "dec", "اثنا عشر", "اثنى عشر"],
};

export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const c = phone.replace(/[^\d]/g, "");
  return c.length >= 7 && c.length <= 20;
}

export function isValidMsgId(id: string): boolean {
  return !!id && typeof id === "string" && /^[a-zA-Z0-9_\-\.]+$/.test(id) && id.length <= 200;
}

export function isValidInstanceId(id: string): boolean {
  if (!id) return false;
  const s = String(id);
  return /^[a-zA-Z0-9]+$/.test(s) && s.length >= 5 && s.length <= 50;
}

export function normalizeArabic(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectMonth(norm: string): number | null {
  const tokens = norm.split(/\s+/);
  for (const [num, variants] of Object.entries(MONTHS)) {
    for (const v of variants) {
      const vn = normalizeArabic(v);
      if (
        tokens.includes(vn) || norm.includes(` ${vn} `) ||
        norm.startsWith(vn + " ") || norm.endsWith(" " + vn) || norm === vn
      ) {
        return parseInt(num, 10);
      }
    }
  }
  return null;
}

export function parseSenderPhone(sender: string): string {
  return String(sender || "").replace(/[^\d]/g, "");
}

/** Loose phone comparison: exact digits, or matching last 9 digits. */
export function phonesMatch(a: string, b: string): boolean {
  const x = parseSenderPhone(a);
  const y = parseSenderPhone(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y.slice(-9)) || y.endsWith(x.slice(-9));
}

/** True when the message text looks like a financial summary command. */
export function hasReportIntent(text: string): boolean {
  const norm = normalizeArabic(text);
  if (!norm) return false;
  return INTENT_WORDS.some((w) => norm.includes(normalizeArabic(w)));
}

export function hasTodayIntent(text: string): boolean {
  const norm = normalizeArabic(text);
  return TODAY_WORDS.some((w) => norm.includes(normalizeArabic(w)));
}

export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n || 0);
}

/** Sudan is UTC+2 (no DST). Returns the UTC bounds of one Sudan day. */
export function sudanDayBounds(
  year: number,
  monthIdx: number,
  day: number,
): { startUTC: Date; endUTC: Date; dateStr: string } {
  const startUTC = new Date(Date.UTC(year, monthIdx, day, 0 - SUDAN_OFFSET_HOURS, 0, 0));
  const endUTC = new Date(Date.UTC(year, monthIdx, day + 1, 0 - SUDAN_OFFSET_HOURS, 0, 0));
  const dateStr = `${String(day).padStart(2, "0")}-${String(monthIdx + 1).padStart(2, "0")}-${year}`;
  return { startUTC, endUTC, dateStr };
}

export function sudanNow(nowMs: number = Date.now()): { year: number; monthIdx: number; day: number } {
  const now = new Date(nowMs + SUDAN_OFFSET_HOURS * 3600 * 1000);
  return { year: now.getUTCFullYear(), monthIdx: now.getUTCMonth(), day: now.getUTCDate() };
}

export interface ReportRange {
  startUTC: Date;
  endUTC: Date;
  isMonthly: boolean;
  displayDate: string;
  monthLabel: string;
  lastDayLabel: string;
}

/** Resolves "today" vs "month N" from a command, in Sudan local time. */
export function resolveReportRange(text: string, nowMs: number = Date.now()): ReportRange {
  const norm = normalizeArabic(text);
  const isToday = hasTodayIntent(text);
  const month = isToday ? null : detectMonth(norm);
  const sn = sudanNow(nowMs);

  if (isToday || !month) {
    const b = sudanDayBounds(sn.year, sn.monthIdx, sn.day);
    return {
      startUTC: b.startUTC, endUTC: b.endUTC, isMonthly: false,
      displayDate: b.dateStr, monthLabel: "", lastDayLabel: "",
    };
  }

  const lastDay = new Date(Date.UTC(sn.year, month, 0)).getUTCDate();
  const s = sudanDayBounds(sn.year, month - 1, 1);
  const e = sudanDayBounds(sn.year, month - 1, lastDay);
  return {
    startUTC: s.startUTC,
    endUTC: e.endUTC,
    isMonthly: true,
    displayDate: "",
    monthLabel: String(month).padStart(2, "0"),
    lastDayLabel: String(lastDay).padStart(2, "0"),
  };
}

/** Green API group payload → is this sender an admin of the group? */
export function isAdminInGroupData(data: unknown, senderDigits: string): boolean {
  const participants = (data as { participants?: unknown[] } | null)?.participants;
  if (!Array.isArray(participants)) return false;
  for (const p of participants) {
    const row = p as { id?: unknown; isAdmin?: unknown; isSuperAdmin?: unknown };
    const isAdmin = row?.isAdmin === true || row?.isSuperAdmin === true;
    if (isAdmin && phonesMatch(String(row?.id ?? ""), senderDigits)) return true;
  }
  return false;
}
