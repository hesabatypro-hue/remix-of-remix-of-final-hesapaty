import { describe, it, expect } from "vitest";
import {
  INTENT_WORDS,
  TODAY_WORDS,
  MONTHS,
  SUDAN_OFFSET_HOURS,
  isValidPhone,
  isValidMsgId,
  isValidInstanceId,
  normalizeArabic,
  detectMonth,
  parseSenderPhone,
  phonesMatch,
  hasReportIntent,
  hasTodayIntent,
  fmtDate,
  fmtNum,
  sudanDayBounds,
  sudanNow,
  resolveReportRange,
  isAdminInGroupData,
} from "../../supabase/functions/_shared/whatsapp-command";

describe("webhook payload validation", () => {
  it("accepts realistic WhatsApp phone numbers", () => {
    expect(isValidPhone("249906346148")).toBe(true);
    expect(isValidPhone("+249 90 634 6148")).toBe(true);
  });

  it("rejects short, empty and non-string phones", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone(undefined as unknown as string)).toBe(false);
    expect(isValidPhone("1".repeat(21))).toBe(false);
  });

  it("accepts Green API message ids and rejects injection-ish ids", () => {
    expect(isValidMsgId("BAE5F4A1_9C.20-x")).toBe(true);
    expect(isValidMsgId("id with space")).toBe(false);
    expect(isValidMsgId("a';drop table--")).toBe(false);
    expect(isValidMsgId("a".repeat(201))).toBe(false);
    expect(isValidMsgId("")).toBe(false);
  });

  it("validates instance ids by charset and length", () => {
    expect(isValidInstanceId("1103123456")).toBe(true);
    expect(isValidInstanceId("abc12")).toBe(true);
    expect(isValidInstanceId("abc1")).toBe(false);
    expect(isValidInstanceId("11031-2345")).toBe(false);
    expect(isValidInstanceId("")).toBe(false);
    expect(isValidInstanceId("x".repeat(51))).toBe(false);
  });
});

describe("Arabic normalization", () => {
  it("folds alef/ya/ta-marbuta variants and diacritics", () => {
    expect(normalizeArabic("إيرادات")).toBe("ايرادات");
    expect(normalizeArabic("أغسطس")).toBe("اغسطس");
    expect(normalizeArabic("مؤسسة")).toBe("مؤسسه");
    expect(normalizeArabic("مُلَخَّص")).toBe("ملخص");
  });

  it("strips punctuation, lowercases and collapses whitespace", () => {
    expect(normalizeArabic("  Revenue,,  REPORT!  ")).toBe("revenue report");
  });

  it("handles null-ish input safely", () => {
    expect(normalizeArabic(undefined as unknown as string)).toBe("");
  });
});

describe("admin command intent detection", () => {
  it("detects every configured intent word", () => {
    for (const w of INTENT_WORDS) expect(hasReportIntent(w)).toBe(true);
  });

  it("detects intent inside a natural sentence", () => {
    expect(hasReportIntent("من فضلك ابعت لي ملخص اليوم")).toBe(true);
    expect(hasReportIntent("please send the revenue report")).toBe(true);
  });

  it("ignores unrelated chatter", () => {
    expect(hasReportIntent("تمام شكرا")).toBe(false);
    expect(hasReportIntent("")).toBe(false);
  });

  it("detects every configured today word", () => {
    for (const w of TODAY_WORDS) expect(hasTodayIntent(w)).toBe(true);
    expect(hasTodayIntent("تقرير يونيو")).toBe(false);
  });

  it("resolves months from digits, Arabic and English names", () => {
    expect(detectMonth(normalizeArabic("تقرير يونيو"))).toBe(6);
    expect(detectMonth(normalizeArabic("report june"))).toBe(6);
    expect(detectMonth(normalizeArabic("ملخص 12"))).toBe(12);
    expect(detectMonth(normalizeArabic("summary for dec"))).toBe(12);
    expect(detectMonth(normalizeArabic("ملخص"))).toBe(null);
  });

  it("covers all twelve month tables", () => {
    for (const [num, variants] of Object.entries(MONTHS)) {
      for (const v of variants) {
        expect(detectMonth(normalizeArabic(`تقرير ${v}`))).toBe(parseInt(num, 10));
      }
    }
  });
});

describe("sender phone matching", () => {
  it("strips WhatsApp suffixes to raw digits", () => {
    expect(parseSenderPhone("249906346148@c.us")).toBe("249906346148");
    expect(parseSenderPhone("")).toBe("");
  });

  it("matches numbers written with and without country code", () => {
    expect(phonesMatch("249906346148@c.us", "0906346148")).toBe(true);
    expect(phonesMatch("249906346148", "249906346148")).toBe(true);
  });

  it("does not match different numbers or blanks", () => {
    expect(phonesMatch("249906346148", "249900000000")).toBe(false);
    expect(phonesMatch("", "249906346148")).toBe(false);
  });
});

describe("group admin authorization", () => {
  const groupData = {
    participants: [
      { id: "249900000001@c.us", isAdmin: false },
      { id: "249906346148@c.us", isAdmin: true },
      { id: "249900000002@c.us", isSuperAdmin: true },
    ],
  };

  it("authorizes admins and super-admins", () => {
    expect(isAdminInGroupData(groupData, "249906346148")).toBe(true);
    expect(isAdminInGroupData(groupData, "249900000002")).toBe(true);
  });

  it("rejects ordinary members and malformed payloads", () => {
    expect(isAdminInGroupData(groupData, "249900000001")).toBe(false);
    expect(isAdminInGroupData(null, "249906346148")).toBe(false);
    expect(isAdminInGroupData({}, "249906346148")).toBe(false);
    expect(isAdminInGroupData({ participants: "nope" }, "1")).toBe(false);
  });
});

describe("Sudan timezone reporting windows", () => {
  it("uses a fixed UTC+2 offset", () => {
    expect(SUDAN_OFFSET_HOURS).toBe(2);
  });

  it("starts a Sudan day at 22:00 UTC the previous day", () => {
    const b = sudanDayBounds(2026, 7, 6); // 6 Aug 2026
    expect(b.startUTC.toISOString()).toBe("2026-08-05T22:00:00.000Z");
    expect(b.endUTC.toISOString()).toBe("2026-08-06T22:00:00.000Z");
    expect(b.dateStr).toBe("06-08-2026");
  });

  it("shifts 'now' into Sudan local time across midnight", () => {
    const beforeMidnightUTC = Date.UTC(2026, 7, 5, 23, 30); // already 6 Aug in Sudan
    expect(sudanNow(beforeMidnightUTC)).toEqual({ year: 2026, monthIdx: 7, day: 6 });
  });

  it("resolves a daily range for 'ملخص اليوم'", () => {
    const now = Date.UTC(2026, 7, 6, 10, 0);
    const r = resolveReportRange("ملخص اليوم", now);
    expect(r.isMonthly).toBe(false);
    expect(r.displayDate).toBe("06-08-2026");
    expect(r.endUTC.getTime() - r.startUTC.getTime()).toBe(24 * 3600 * 1000);
  });

  it("resolves a full-month range for 'تقرير يونيو'", () => {
    const now = Date.UTC(2026, 7, 6, 10, 0);
    const r = resolveReportRange("تقرير يونيو", now);
    expect(r.isMonthly).toBe(true);
    expect(r.monthLabel).toBe("06");
    expect(r.lastDayLabel).toBe("30");
    expect(r.startUTC.toISOString()).toBe("2026-05-31T22:00:00.000Z");
    expect(r.endUTC.toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("handles February in a leap year", () => {
    const r = resolveReportRange("تقرير فبراير", Date.UTC(2024, 5, 1));
    expect(r.lastDayLabel).toBe("29");
  });

  it("falls back to today when no period is mentioned", () => {
    const r = resolveReportRange("ملخص", Date.UTC(2026, 7, 6, 10, 0));
    expect(r.isMonthly).toBe(false);
    expect(r.displayDate).toBe("06-08-2026");
  });
});

describe("report formatting", () => {
  it("formats dates as DD-MM-YYYY", () => {
    expect(fmtDate(new Date(2026, 7, 6))).toBe("06-08-2026");
  });

  it("formats amounts with thousands separators", () => {
    expect(fmtNum(1234567.5)).toBe("1,234,567.5");
    expect(fmtNum(0)).toBe("0");
    expect(fmtNum(NaN as unknown as number)).toBe("0");
  });
});
