import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PlatformInvoice } from "@/hooks/usePlatformInvoices";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const hasNonLatin = (s: string) => ARABIC_RE.test(s || "");
const isArabicChar = (c: string) => ARABIC_RE.test(c);

// Tokenize text into directional runs. Digit clusters (including internal
// separators like . , : / - and Arabic-Indic digits) are ALWAYS isolated as
// dedicated LTR runs so currency/dates/references never get flipped, even
// when neighboring strong characters are Arabic. Other weak chars (spaces,
// quotes, brackets, etc.) stick to the current strong run.
const ARABIC_DIGIT_RE = /[\u0660-\u0669\u06F0-\u06F9]/; // Arabic-Indic & Extended
const DIGIT_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const NUM_INNER_RE = /[0-9\u0660-\u0669\u06F0-\u06F9.,:/\-\u066B\u066C]/; // 1,234.50 / 01:30 / 2024-01-05
const WEAK_RE = /[\s.,:;!?@()\-\/+_=%$#&'"\[\]{}]/;

function segmentRuns(text: string): { text: string; isRtl: boolean; isNum?: boolean }[] {
  const runs: { text: string; isRtl: boolean; isNum?: boolean }[] = [];
  const chars = Array.from(text);
  let cur = "";
  let curRtl: boolean | null = null;
  const flush = () => {
    if (cur) runs.push({ text: cur, isRtl: curRtl ?? false });
    cur = "";
    curRtl = null;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    // Numeric cluster: greedily consume digits plus inner separators
    // (commas, dots, colons, slashes, dashes) while next char is still
    // numeric. Trailing separators are kept with the preceding strong run.
    if (DIGIT_RE.test(ch)) {
      flush();
      let num = ch;
      let j = i + 1;
      while (j < chars.length) {
        const next = chars[j];
        if (DIGIT_RE.test(next)) {
          num += next;
          j++;
        } else if (NUM_INNER_RE.test(next) && j + 1 < chars.length && DIGIT_RE.test(chars[j + 1])) {
          // separator only counts as part of the number if followed by another digit
          num += next;
          j++;
        } else {
          break;
        }
      }
      // Arabic-Indic digits render correctly with NotoArabic; ASCII digits
      // render with helvetica. Either way the run is LTR (isRtl=false) so
      // the visual order matches the logical order — no reversal.
      const usesArabicDigits = ARABIC_DIGIT_RE.test(num);
      runs.push({ text: num, isRtl: usesArabicDigits, isNum: true });
      i = j - 1;
      continue;
    }

    if (WEAK_RE.test(ch)) {
      cur += ch;
      continue;
    }

    const r = isArabicChar(ch);
    if (curRtl === null) {
      curRtl = r;
      cur += ch;
      continue;
    }
    if (r === curRtl) {
      cur += ch;
    } else {
      flush();
      cur = ch;
      curRtl = r;
    }
  }
  flush();
  return runs;
}

// Base paragraph direction from first strong character (UAX#9 simplified).
function baseDir(text: string): "rtl" | "ltr" {
  for (const ch of Array.from(text)) {
    if (ARABIC_RE.test(ch)) return "rtl";
    if (/[A-Za-z]/.test(ch)) return "ltr";
  }
  return "ltr";
}

// Cache the base64 Arabic font across calls
let arabicFontB64: string | null = null;
const ARABIC_FONT_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-arabic@5.0.13/files/noto-sans-arabic-arabic-400-normal.woff";
const ARABIC_FONT_TTF_URL =
  "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";

async function loadArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!arabicFontB64) {
      const res = await fetch(ARABIC_FONT_TTF_URL);
      if (!res.ok) throw new Error("font fetch failed");
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
      }
      arabicFontB64 = btoa(bin);
    }
    doc.addFileToVFS("NotoNaskhArabic.ttf", arabicFontB64);
    doc.addFont("NotoNaskhArabic.ttf", "NotoArabic", "normal");
    doc.addFont("NotoNaskhArabic.ttf", "NotoArabic", "bold");
    return true;
  } catch (e) {
    console.warn("Arabic font load failed, falling back to helvetica", e);
    return false;
  }
}

export async function generatePlatformInvoicePdf(invoice: PlatformInvoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  const needsArabic = [invoice.to_organization_name, invoice.description, invoice.from_address]
    .some((v) => hasNonLatin(String(v || "")));
  const arabicReady = needsArabic ? await loadArabicFont(doc) : false;

  // Helper: pick the right font for a value
  const setSmartFont = (value: string, style: "normal" | "bold" = "normal") => {
    if (arabicReady && hasNonLatin(value)) {
      doc.setFont("NotoArabic", style);
    } else {
      doc.setFont("helvetica", style);
    }
  };

  // Bidi-aware text drawer: segments mixed Arabic/Latin text into runs and
  // renders each run with the proper font in correct visual order based on
  // the paragraph's base direction. Prevents reversed words, broken numbers,
  // and box glyphs from font/script mismatch.
  const drawBidi = (
    text: string,
    x: number,
    y: number,
    opts: { align?: "left" | "right" | "center"; style?: "normal" | "bold" } = {}
  ) => {
    const value = String(text ?? "");
    const style = opts.style ?? "normal";
    const align = opts.align ?? "left";

    // Pure Latin: fast path
    if (!hasNonLatin(value)) {
      doc.setFont("helvetica", style);
      doc.text(value, x, y, { align });
      return;
    }

    // Arabic font unavailable: fall back to single-font render with RTL hint
    if (!arabicReady) {
      doc.setFont("helvetica", style);
      doc.text(value, x, y, { align, isInputRtl: true } as any);
      return;
    }

    const dir = baseDir(value);
    const runs = segmentRuns(value);
    const widths = runs.map((r) => {
      // Numeric runs always render with a font that supports their digits,
      // but never with the RTL input flag — digits stay left-to-right.
      const font = r.isNum
        ? (ARABIC_DIGIT_RE.test(r.text) ? "NotoArabic" : "helvetica")
        : (r.isRtl ? "NotoArabic" : "helvetica");
      doc.setFont(font, style);
      return doc.getTextWidth(r.text);
    });
    const total = widths.reduce((a, b) => a + b, 0);

    let startX = x;
    if (align === "right") startX = x - total;
    else if (align === "center") startX = x - total / 2;

    // RTL base: lay runs in reverse visual order (logical-first run sits at the right).
    // Numeric runs themselves are NOT internally reversed — only their slot
    // position swaps, matching UAX#9 behavior for numbers in RTL paragraphs.
    const order = dir === "rtl" ? runs.map((_, i) => runs.length - 1 - i) : runs.map((_, i) => i);
    let cursor = startX;
    for (const i of order) {
      const r = runs[i];
      const font = r.isNum
        ? (ARABIC_DIGIT_RE.test(r.text) ? "NotoArabic" : "helvetica")
        : (r.isRtl ? "NotoArabic" : "helvetica");
      doc.setFont(font, style);
      // Apply isInputRtl ONLY for Arabic letter runs, never for numeric runs.
      const useRtlHint = r.isRtl && !r.isNum;
      doc.text(r.text, cursor, y, useRtlHint ? ({ isInputRtl: true } as any) : undefined);
      cursor += widths[i];
    }
  };

  // Top dark header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 100, "F");

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SUDA-TECHNOLOGIES LLC", margin, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.from_address, margin, 66);
  doc.text(invoice.from_email, margin, 80);

  // Invoice block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", pageWidth - margin, 48, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`No. ${invoice.invoice_number}`, pageWidth - margin, 70, { align: "right" });
  doc.text(`Issued: ${formatDate(invoice.issue_date)}`, pageWidth - margin, 84, { align: "right" });

  // Reset color
  doc.setTextColor(15, 23, 42);

  // Bill To
  let y = 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  y += 18;
  const orgIsRtl = baseDir(invoice.to_organization_name) === "rtl";
  drawBidi(invoice.to_organization_name, orgIsRtl ? pageWidth - margin : margin, y, {
    align: orgIsRtl ? "right" : "left",
    style: "bold",
  });
  if (invoice.to_email) {
    y += 14;
    doc.setFontSize(10);
    // email is always Latin; align to match the org-name side for visual cohesion
    drawBidi(invoice.to_email, orgIsRtl ? pageWidth - margin : margin, y, {
      align: orgIsRtl ? "right" : "left",
    });
  }



  // Right side: invoice meta block
  let metaY = 140;
  const metaX = pageWidth - margin - 200;
  const drawMeta = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(label, metaX, metaY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(value, pageWidth - margin, metaY, { align: "right" });
    metaY += 16;
  };
  if (invoice.due_date) drawMeta("DUE DATE", formatDate(invoice.due_date));
  drawMeta("STATUS", invoice.status.toUpperCase());
  drawMeta("CURRENCY", "USD");

  // Items table
  const tableStart = Math.max(y, metaY) + 30;
  const periodLabel =
    invoice.period_start && invoice.period_end
      ? `${formatDate(invoice.period_start)}  —  ${formatDate(invoice.period_end)}`
      : "";

  const descText = invoice.description || "Hisabaty Subscription";
  const descHasArabic = arabicReady && hasNonLatin(descText);
  const descHasLatin = /[A-Za-z]/.test(descText);
  const descIsMixed = descHasArabic && descHasLatin;
  const descIsRtl = descHasArabic; // RTL base whenever Arabic is present
  const descColIndex = descIsRtl ? 4 : 0;

  autoTable(doc, {
    startY: tableStart,
    // Reverse columns when description is RTL so reading flows right-to-left
    head: [
      descIsRtl
        ? ["Amount", "Unit Price", "Qty", "Period", "Description"]
        : ["Description", "Period", "Qty", "Unit Price", "Amount"],
    ],
    body: [
      descIsRtl
        ? [fmt(invoice.amount_usd), fmt(invoice.amount_usd), "1", periodLabel, descText]
        : [descText, periodLabel, "1", fmt(invoice.amount_usd), fmt(invoice.amount_usd)],
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      font: "helvetica",
      halign: descIsRtl ? "right" : "left",
    },
    styles: { fontSize: 10, cellPadding: 10, font: "helvetica" },
    columnStyles: descIsRtl
      ? {
          0: { halign: "right", cellWidth: 80 },
          1: { halign: "right", cellWidth: 80 },
          2: { halign: "center", cellWidth: 40 },
          3: { halign: "right" },
          4: { font: "NotoArabic", halign: "right" },
        }
      : {
          0: { font: descHasArabic ? "NotoArabic" : "helvetica" },
          2: { halign: "center", cellWidth: 40 },
          3: { halign: "right", cellWidth: 80 },
          4: { halign: "right", cellWidth: 80 },
        },
    margin: { left: margin, right: margin },
    // Bidi-aware rendering for EVERY body cell (not just description).
    // autoTable cannot multi-font a single string, so we blank the default
    // text and repaint each cell with the bidi drawer using the column's
    // configured horizontal alignment.
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const raw = Array.isArray(data.cell.text)
        ? data.cell.text.join(" ")
        : String(data.cell.text ?? "");
      (data.cell as any)._bidiText = raw;
      (data.cell as any)._bidiHalign =
        (data.cell.styles?.halign as "left" | "right" | "center") || "left";
      data.cell.text = [""];
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const bidiText = (data.cell as any)._bidiText;
      if (!bidiText) return;
      const halign = (data.cell as any)._bidiHalign as "left" | "right" | "center";
      const padding = 10;
      let x = data.cell.x + padding;
      if (halign === "right") x = data.cell.x + data.cell.width - padding;
      else if (halign === "center") x = data.cell.x + data.cell.width / 2;
      const textY = data.cell.y + data.cell.height / 2 + 3;
      drawBidi(bidiText, x, textY, { align: halign });
    },
  });



  // @ts-expect-error lastAutoTable from autoTable plugin
  let endY = doc.lastAutoTable.finalY + 24;
  const labelX = pageWidth - margin - 180;
  const valueX = pageWidth - margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", labelX, endY);
  doc.text(fmt(invoice.amount_usd), valueX, endY, { align: "right" });
  endY += 16;
  doc.text("Tax", labelX, endY);
  doc.text(fmt(invoice.tax_usd), valueX, endY, { align: "right" });

  endY += 22;
  doc.setDrawColor(220);
  doc.line(labelX, endY - 14, valueX, endY - 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL DUE", labelX, endY);
  doc.text(`${fmt(invoice.total_usd)} USD`, valueX, endY, { align: "right" });

  // Payment block
  endY += 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("PAYMENT METHODS", margin, endY);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  endY += 14;
  doc.text("Bank Transfer (Mercury) • Stripe • Wire Transfer", margin, endY);
  endY += 14;
  doc.text(`Bank Statement Reference: ${invoice.invoice_number}`, margin, endY);

  if (invoice.status === "paid" && invoice.paid_at) {
    endY += 30;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 139, 34);
    doc.setFontSize(14);
    doc.text(`PAID  •  ${formatDate(invoice.paid_at.slice(0, 10))}`, margin, endY);
    if (invoice.payment_reference) {
      endY += 16;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Reference: ${invoice.payment_reference}`, margin, endY);
    }
  }

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "Thank you for your business. This invoice is issued by Suda-Technologies LLC, a registered company in the United States.",
    pageWidth / 2,
    pageHeight - 40,
    { align: "center", maxWidth: pageWidth - margin * 2 }
  );
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US")} • billing@suda-technologies.com`,
    pageWidth / 2,
    pageHeight - 22,
    { align: "center" }
  );

  doc.save(`${invoice.invoice_number}.pdf`);
}
