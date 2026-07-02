import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BranchData {
  name: string;
  transfers: number;
  revenue: number;
}

interface ReportExportData {
  organizationName: string;
  periodLabel: string;
  dateRangeText: string;
  totalRevenue: number;
  totalTransfers: number;
  confirmedTransfers: number;
  pendingTransfers: number;
  branches: BranchData[];
}

export function exportToExcel(data: ReportExportData) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["تقرير الإيرادات - " + data.organizationName],
    ["الفترة: " + data.periodLabel],
    ["التاريخ: " + data.dateRangeText],
    [],
    ["إجمالي الإيرادات", data.totalRevenue],
    ["إجمالي التحويلات", data.totalTransfers],
    ["تحويلات مؤكدة", data.confirmedTransfers],
    ["قيد المراجعة", data.pendingTransfers],
    ["عدد الفروع", data.branches.length],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "ملخص");

  // Branches sheet
  const branchHeaders = ["#", "الفرع", "عدد التحويلات", "الإيرادات (ج.س)"];
  const branchRows = data.branches.map((b, i) => [i + 1, b.name, b.transfers, b.revenue]);
  branchRows.push([null, "الإجمالي", data.totalTransfers, data.totalRevenue]);

  const branchSheet = XLSX.utils.aoa_to_sheet([branchHeaders, ...branchRows]);
  branchSheet["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, branchSheet, "تفاصيل الفروع");

  XLSX.writeFile(wb, `تقرير_${data.periodLabel}_${Date.now()}.xlsx`);
}

export function exportToPDF(data: ReportExportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Use Helvetica (built-in, works for numbers/English)
  // For Arabic we use the doc's built-in text with simple rendering
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Revenue Report", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.organizationName, pageWidth / 2, 30, { align: "center" });
  doc.text(`Period: ${data.periodLabel} | ${data.dateRangeText}`, pageWidth / 2, 38, { align: "center" });

  // Summary box
  doc.setDrawColor(200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(15, 45, pageWidth - 30, 40, 3, 3, "FD");

  doc.setFontSize(10);
  const summaryY = 55;
  const col1 = 25;
  const col2 = 75;
  const col3 = 125;
  const col4 = 165;

  doc.setFont("helvetica", "bold");
  doc.text("Total Revenue", col1, summaryY);
  doc.text("Total Transfers", col2, summaryY);
  doc.text("Confirmed", col3, summaryY);
  doc.text("Pending", col4, summaryY);

  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235);
  doc.text(`${data.totalRevenue.toLocaleString()} SDG`, col1, summaryY + 12);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`${data.totalTransfers}`, col2, summaryY + 12);
  doc.setTextColor(22, 163, 74);
  doc.text(`${data.confirmedTransfers}`, col3, summaryY + 12);
  doc.setTextColor(234, 179, 8);
  doc.text(`${data.pendingTransfers}`, col4, summaryY + 12);

  doc.setTextColor(0);

  // Branch table
  if (data.branches.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Branch Details", 15, 100);

    autoTable(doc, {
      startY: 105,
      head: [["#", "Branch", "Transfers", "Revenue (SDG)"]],
      body: [
        ...data.branches.map((b, i) => [
          i + 1,
          b.name,
          b.transfers,
          b.revenue.toLocaleString(),
        ]),
        ["", "TOTAL", data.totalTransfers, data.totalRevenue.toLocaleString()],
      ],
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [240, 245, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 60 },
        2: { cellWidth: 35, halign: "center" },
        3: { cellWidth: 45, halign: "right" },
      },
    });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} | Powered by Suda-Technologies.com`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  doc.save(`Report_${data.periodLabel}_${Date.now()}.pdf`);
}
