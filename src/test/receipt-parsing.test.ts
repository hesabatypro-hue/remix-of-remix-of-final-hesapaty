import { describe, it, expect } from "vitest";
import {
  validateAndParseAmount,
  isValidDate,
  detectMimeType,
  bufferToBase64DataUrl,
  buildClientMemo,
} from "../../supabase/functions/_shared/receipt";

describe("receipt amount validation", () => {
  it("parses numeric and string amounts", () => {
    expect(validateAndParseAmount(1500)).toBe(1500);
    expect(validateAndParseAmount("1500.75")).toBe(1500.75);
  });

  it("rejects negatives, NaN, nullish and absurd values", () => {
    expect(validateAndParseAmount(-1)).toBe(0);
    expect(validateAndParseAmount("abc")).toBe(0);
    expect(validateAndParseAmount(null)).toBe(0);
    expect(validateAndParseAmount(undefined)).toBe(0);
    expect(validateAndParseAmount(1_000_000_001)).toBe(0);
  });

  it("accepts the exact upper bound", () => {
    expect(validateAndParseAmount(1_000_000_000)).toBe(1_000_000_000);
  });
});

describe("receipt date validation", () => {
  it("accepts ISO calendar dates only", () => {
    expect(isValidDate("2026-08-06")).toBe(true);
    expect(isValidDate("06-08-2026")).toBe(false);
    expect(isValidDate("2026-8-6")).toBe(false);
    expect(isValidDate("2026-13-45")).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate(20260806)).toBe(false);
  });
});

describe("image handling", () => {
  it("detects mime types from magic bytes", () => {
    expect(detectMimeType(new Uint8Array([0x89, 0x50]))).toBe("image/png");
    expect(detectMimeType(new Uint8Array([0x47, 0x49]))).toBe("image/gif");
    expect(detectMimeType(new Uint8Array([0x52, 0x49]))).toBe("image/webp");
    expect(detectMimeType(new Uint8Array([0xff, 0xd8]))).toBe("image/jpeg");
    expect(detectMimeType(new Uint8Array())).toBe("image/jpeg");
  });

  it("builds a base64 data url", () => {
    const url = bufferToBase64DataUrl(new Uint8Array([72, 105]), "image/png");
    expect(url).toBe("data:image/png;base64,SGk=");
  });

  it("chunks large buffers without blowing the call stack", () => {
    const big = new Uint8Array(70000).fill(65);
    const url = bufferToBase64DataUrl(big, "image/jpeg");
    expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(atob(url.split(",")[1]).length).toBe(70000);
  });
});

describe("client memo fusion", () => {
  it("merges WhatsApp caption and bank comment", () => {
    expect(buildClientMemo("دفعة إيجار", "من أحمد")).toBe("دفعة إيجار | من أحمد");
  });

  it("keeps whichever side exists", () => {
    expect(buildClientMemo("دفعة إيجار", null)).toBe("دفعة إيجار");
    expect(buildClientMemo(null, "من أحمد")).toBe("من أحمد");
  });

  it("returns null when nothing is available", () => {
    expect(buildClientMemo(null, null)).toBe(null);
    expect(buildClientMemo("", "")).toBe(null);
  });
});
