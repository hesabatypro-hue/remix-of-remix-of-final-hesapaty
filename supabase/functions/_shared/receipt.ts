/** Pure receipt-parsing helpers shared by process-receipt (and its tests). */

export function validateAndParseAmount(amount: unknown): number {
  if (amount === null || amount === undefined) return 0;
  const parsed = parseFloat(String(amount));
  if (isNaN(parsed) || parsed < 0 || parsed > 1000000000) return 0;
  return parsed;
}

export function isValidDate(dateStr: unknown): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return !isNaN(new Date(dateStr).getTime());
}

export function detectMimeType(buffer: Uint8Array): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

export function bufferToBase64DataUrl(buffer: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/** Merges the WhatsApp caption with the bank comment into one memo. */
export function buildClientMemo(
  whatsappText: string | null,
  bankComment: string | null,
): string | null {
  const parts = [whatsappText, bankComment].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" | ");
}
