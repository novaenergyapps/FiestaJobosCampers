import { jsPDF } from 'jspdf';
import {
  parseCamperKey,
  formatShortDate,
  getFormattedTodaySpanish,
  sortDepositsByCamperAsc,
  sortExpensesByDate
} from './transactionSorter';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(val) || 0);

/**
 * Loads /logo.png and renders it as a crisp rounded-square PNG dataURL
 * matching the app header icon (center-cropped like object-cover).
 */
async function loadAppLogoDataUrl() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 240;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw rounded rectangle clip
        const radius = 36;
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(size - radius, 0);
        ctx.quadraticCurveTo(size, 0, size, radius);
        ctx.lineTo(size, size - radius);
        ctx.quadraticCurveTo(size, size, size - radius, size);
        ctx.lineTo(radius, size);
        ctx.quadraticCurveTo(0, size, 0, size - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        // Center-crop image (object-cover)
        const imgRatio = img.width / img.height;
        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (imgRatio > 1) {
          sWidth = img.height;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = img.width;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

        // Subtle gold border matching the app header logo
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 8;
        ctx.stroke();

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

function truncateText(doc, text, maxWidth) {
  const str = String(text || '');
  if (doc.getTextWidth(str) <= maxWidth) return str;
  let clipped = str;
  while (clipped.length > 0 && doc.getTextWidth(`${clipped}...`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

/**
 * Generates and downloads the PDF Financial Statement Report:
 * - Logo of the app
 * - Name: "Fiesta de Navidad Jobos Campers Park"
 * - Subtitle: "Informe de Ingresos y Gastos"
 * - Today's date
 * - Financial Statement Summary (Ingresos, Gastos, Balance)
 * - Summarized Deposits sorted by Camper Number ascending
 * - Summarized Expenses sorted by Date
 */
export async function exportFinancialReportPdf(transactions = [], stats = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // 215.9 x 279.4 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const todayFormatted = getFormattedTodaySpanish();
  const logoDataUrl = await loadAppLogoDataUrl();

  const rawDeposits = transactions.filter((tx) => tx.type === 'deposit');
  const rawExpenses = transactions.filter((tx) => tx.type === 'expense');

  const sortedDeposits = sortDepositsByCamperAsc(rawDeposits);
  const sortedExpenses = sortExpensesByDate(rawExpenses, 'asc');

  let y = 14;

  const checkPageBreak = (neededHeight = 14) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 16;
      return true;
    }
    return false;
  };

  // =========================================================================
  // 1. REPORT HEADER (App Logo + "Fiesta de Navidad Jobos Campers Park" + "Informe de Ingresos y Gastos" + Date)
  // =========================================================================
  doc.setFillColor(6, 78, 59); // Emerald-900 (#064e3b)
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

  const textStartX = logoDataUrl ? margin + 27 : margin + 6;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin + 4, y + 3, 22, 22);
  }

  // Main Name ONLY: "Fiesta de Navidad Jobos Campers Park"
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('Fiesta de Navidad Jobos Campers Park', textStartX, y + 10);

  // Report Title underneath: "Informe de Ingresos y Gastos"
  doc.setTextColor(253, 224, 71); // Amber-300
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('Informe de Ingresos y Gastos', textStartX, y + 17);

  // Date of the day underneath
  doc.setTextColor(209, 250, 229); // Emerald-100
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Fecha del reporte: ${todayFormatted}`, textStartX, y + 23.5);

  y += 33;

  // =========================================================================
  // 2. ESTADO FINANCIERO RESUMIDO (Executive Financial Statement Table)
  // =========================================================================
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, contentWidth, 34, 2.5, 2.5, 'FD');

  // Section Header inside Statement Box
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(margin, y, contentWidth, 7.5, 2.5, 2.5, 'F');
  doc.rect(margin, y + 4, contentWidth, 3.5, 'F'); // square bottom corners of header strip
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ESTADO FINANCIERO — RESUMEN GENERAL', margin + 4, y + 5.2);
  doc.text('IMPORTE (USD)', pageWidth - margin - 4, y + 5.2, { align: 'right' });

  // Line 1: Total Ingresos
  const row1Y = y + 13.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70); // Emerald-800
  doc.text(
    `Total de Ingresos (Depósitos Recibidos: ${stats.depositCount || 0} • ${stats.totalCampers || 0} Campers • ${stats.totalPeople || 0} Personas)`,
    margin + 4,
    row1Y
  );
  doc.text(`+${formatCurrency(stats.totalDeposits)}`, pageWidth - margin - 4, row1Y, {
    align: 'right'
  });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin + 4, y + 16, pageWidth - margin - 4, y + 16);

  // Line 2: Menos Total Gastos
  const row2Y = y + 21.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(159, 18, 57); // Rose-800
  doc.text(
    `Menos: Total de Gastos Pagados (${stats.expenseCount || 0} ${
      stats.expenseCount === 1 ? 'registro' : 'registros'
    })`,
    margin + 4,
    row2Y
  );
  doc.text(`-${formatCurrency(stats.totalExpenses)}`, pageWidth - margin - 4, row2Y, {
    align: 'right'
  });

  // Divider before Net Balance
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin + 4, y + 24.2, pageWidth - margin - 4, y + 24.2);

  // Line 3: Balance Neto Disponible
  const row3Y = y + 30.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('BALANCE NETO DISPONIBLE (INGRESOS - GASTOS)', margin + 4, row3Y);
  doc.setTextColor(6, 95, 70);
  doc.text(formatCurrency(stats.balance), pageWidth - margin - 4, row3Y, {
    align: 'right'
  });

  y += 40;

  // =========================================================================
  // 3. DETALLE RESUMIDO DE INGRESOS (Sorted by Camper Number Ascending)
  // =========================================================================
  const drawDepositsTableHeader = () => {
    doc.setFillColor(6, 95, 70); // Emerald-800
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);

    doc.text('# CAMPER', margin + 3, y + 5.1);
    doc.text('RESIDENTE / FAMILIA', margin + 34, y + 5.1);
    doc.text('PERS.', margin + 118, y + 5.1, { align: 'center' });
    doc.text('FECHA', margin + 142, y + 5.1, { align: 'center' });
    doc.text('MONTO', pageWidth - margin - 3, y + 5.1, { align: 'right' });
    y += 7.5;
  };

  checkPageBreak(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 78, 59);
  doc.text(
    `I. DETALLE DE INGRESOS — DEPÓSITOS RECIBIDOS (${sortedDeposits.length})`,
    margin,
    y
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Ordenado por Número de Camper (Ascendente)', pageWidth - margin, y, {
    align: 'right'
  });
  y += 2.5;

  drawDepositsTableHeader();

  if (sortedDeposits.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 8, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No hay depósitos registrados hasta el momento.', margin + 4, y + 5.3);
    y += 8;
  } else {
    sortedDeposits.forEach((tx, idx) => {
      if (checkPageBreak(7.5)) {
        drawDepositsTableHeader();
      }
      const rowHeight = 6.8;
      if (idx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(240, 253, 244); // Emerald-50/60
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      const camperLabel = parseCamperKey(tx.camperNumber).display;
      const residentName = truncateText(doc, tx.name || 'Residente', 76);
      const peopleStr = String(tx.peopleCount || 1);
      const dateStr = formatShortDate(tx.date);
      const amountStr = `+${formatCurrency(tx.amount)}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.setTextColor(6, 78, 59);
      doc.text(truncateText(doc, camperLabel, 28), margin + 3, y + 4.7);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(residentName, margin + 34, y + 4.7);

      doc.text(peopleStr, margin + 118, y + 4.7, { align: 'center' });

      doc.setTextColor(71, 85, 105);
      doc.text(dateStr, margin + 142, y + 4.7, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 95, 70);
      doc.text(amountStr, pageWidth - margin - 3, y + 4.7, { align: 'right' });

      y += rowHeight;
    });

    // Subtotal row for Deposits
    checkPageBreak(8.5);
    doc.setFillColor(209, 250, 229); // Emerald-100
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 7.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(6, 78, 59);
    doc.text(
      `TOTAL DE INGRESOS (${stats.depositCount || 0} depósitos • ${stats.totalCampers || 0} campers)`,
      margin + 3,
      y + 5.1
    );
    doc.text(`${stats.totalPeople || 0} pers.`, margin + 118, y + 5.1, { align: 'center' });
    doc.text(`+${formatCurrency(stats.totalDeposits)}`, pageWidth - margin - 3, y + 5.1, {
      align: 'right'
    });
    y += 7.5;
  }

  y += 8;

  // =========================================================================
  // 4. DETALLE RESUMIDO DE GASTOS (Sorted by Date)
  // =========================================================================
  const drawExpensesTableHeader = () => {
    doc.setFillColor(159, 18, 57); // Rose-800
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);

    doc.text('FECHA', margin + 3, y + 5.1);
    doc.text('PAGADO A (SUPLIDOR / COMERCIO)', margin + 30, y + 5.1);
    doc.text('CONCEPTO RESUMIDO', margin + 92, y + 5.1);
    doc.text('MONTO', pageWidth - margin - 3, y + 5.1, { align: 'right' });
    y += 7.5;
  };

  checkPageBreak(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(136, 19, 55);
  doc.text(
    `II. DETALLE DE GASTOS — DESEMBOLSOS PAGADOS (${sortedExpenses.length})`,
    margin,
    y
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Ordenado por Fecha', pageWidth - margin, y, {
    align: 'right'
  });
  y += 2.5;

  drawExpensesTableHeader();

  if (sortedExpenses.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 8, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No hay gastos registrados hasta el momento.', margin + 4, y + 5.3);
    y += 8;
  } else {
    sortedExpenses.forEach((tx, idx) => {
      if (checkPageBreak(7.5)) {
        drawExpensesTableHeader();
      }
      const rowHeight = 6.8;
      if (idx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(255, 241, 242); // Rose-50
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      const dateStr = formatShortDate(tx.date);
      const paidToStr = truncateText(doc, tx.paidTo || 'Suplidor', 58);
      const summaryConcept = tx.description
        ? tx.category
          ? `${tx.description} (${tx.category})`
          : tx.description
        : tx.category || 'Gasto pagado';
      const conceptStr = truncateText(doc, summaryConcept, 64);
      const amountStr = `-${formatCurrency(tx.amount)}`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.setTextColor(71, 85, 105);
      doc.text(dateStr, margin + 3, y + 4.7);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(paidToStr, margin + 30, y + 4.7);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(conceptStr, margin + 92, y + 4.7);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(159, 18, 57);
      doc.text(amountStr, pageWidth - margin - 3, y + 4.7, { align: 'right' });

      y += rowHeight;
    });

    // Subtotal row for Expenses
    checkPageBreak(8.5);
    doc.setFillColor(255, 228, 230); // Rose-100
    doc.setDrawColor(244, 63, 94);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 7.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(136, 19, 55);
    doc.text(
      `TOTAL DE GASTOS PAGADOS (${stats.expenseCount || 0} ${
        stats.expenseCount === 1 ? 'gasto' : 'gastos'
      })`,
      margin + 3,
      y + 5.1
    );
    doc.text(`-${formatCurrency(stats.totalExpenses)}`, pageWidth - margin - 3, y + 5.1, {
      align: 'right'
    });
    y += 7.5;
  }

  y += 7;

  // =========================================================================
  // 5. FINAL BALANCE SUMMARY BAR AT BOTTOM OF REPORT
  // =========================================================================
  checkPageBreak(20);
  doc.setFillColor(6, 78, 59); // Emerald-900
  doc.roundedRect(margin, y, contentWidth, 14, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `BALANCE FINAL DISPONIBLE  (Ingresos: +${formatCurrency(
      stats.totalDeposits
    )}   |   Gastos: -${formatCurrency(stats.totalExpenses)})`,
    margin + 4,
    y + 8.8
  );
  doc.setFontSize(12.5);
  doc.setTextColor(253, 224, 71); // Amber-300
  doc.text(formatCurrency(stats.balance), pageWidth - margin - 4, y + 9.2, {
    align: 'right'
  });

  // =========================================================================
  // 6. FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Fiesta de Navidad Jobos Campers Park • El detalle completo y fotos de recibos están disponibles en la aplicación.',
      margin,
      pageHeight - 8.5
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 8.5, {
      align: 'right'
    });
  }

  const d = new Date();
  const fileDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  doc.save(`Informe_Ingresos_y_Gastos_Jobos_Campers_${fileDate}.pdf`);
}

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prints the clean Financial Statement Report using a dedicated print iframe
 * so mobile and desktop browsers print the full multi-page report cleanly.
 */
export function printFinancialReport(transactions = [], stats = {}) {
  const todayFormatted = getFormattedTodaySpanish();
  const rawDeposits = transactions.filter((tx) => tx.type === 'deposit');
  const rawExpenses = transactions.filter((tx) => tx.type === 'expense');

  const sortedDeposits = sortDepositsByCamperAsc(rawDeposits);
  const sortedExpenses = sortExpensesByDate(rawExpenses, 'asc');

  const depositRowsHtml =
    sortedDeposits.length === 0
      ? `<tr><td colspan="5" style="text-align:center; padding:12px; color:#64748b; font-style:italic;">No hay depósitos registrados hasta el momento.</td></tr>`
      : sortedDeposits
          .map((tx, idx) => {
            const bg = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
            const camperLabel = escapeHtml(parseCamperKey(tx.camperNumber).display);
            const name = escapeHtml(tx.name || 'Residente');
            const people = Number(tx.peopleCount) || 1;
            const date = escapeHtml(formatShortDate(tx.date));
            const amount = `+${formatCurrency(tx.amount)}`;
            return `<tr style="background:${bg};">
              <td style="font-weight:700; color:#064e3b;">${camperLabel}</td>
              <td>${name}</td>
              <td style="text-align:center;">${people}</td>
              <td style="text-align:center; color:#475569;">${date}</td>
              <td style="text-align:right; font-weight:700; color:#065f46;">${amount}</td>
            </tr>`;
          })
          .join('');

  const expenseRowsHtml =
    sortedExpenses.length === 0
      ? `<tr><td colspan="4" style="text-align:center; padding:12px; color:#64748b; font-style:italic;">No hay gastos registrados hasta el momento.</td></tr>`
      : sortedExpenses
          .map((tx, idx) => {
            const bg = idx % 2 === 0 ? '#ffffff' : '#fff1f2';
            const date = escapeHtml(formatShortDate(tx.date));
            const paidTo = escapeHtml(tx.paidTo || 'Suplidor');
            const conceptRaw = tx.description
              ? tx.category
                ? `${tx.description} (${tx.category})`
                : tx.description
              : tx.category || 'Gasto pagado';
            const concept = escapeHtml(conceptRaw);
            const amount = `-${formatCurrency(tx.amount)}`;
            return `<tr style="background:${bg};">
              <td style="color:#475569;">${date}</td>
              <td style="font-weight:700; color:#0f172a;">${paidTo}</td>
              <td style="color:#334155;">${concept}</td>
              <td style="text-align:right; font-weight:700; color:#9f1239;">${amount}</td>
            </tr>`;
          })
          .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe de Ingresos y Gastos - Fiesta de Navidad Jobos Campers Park</title>
  <style>
    @page { margin: 12mm; size: letter portrait; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      background: #064e3b;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .header img {
      width: 68px;
      height: 68px;
      border-radius: 14px;
      object-fit: cover;
      border: 2px solid #fbbf24;
      background: #ffffff;
      flex-shrink: 0;
    }
    .header-title {
      font-size: 20px;
      font-weight: 900;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .header-subtitle {
      font-size: 15px;
      font-weight: 800;
      color: #fde047;
      margin: 3px 0 0 0;
    }
    .header-date {
      font-size: 11.5px;
      color: #d1fae5;
      margin: 4px 0 0 0;
    }
    .statement-box {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 18px;
      background: #f8fafc;
    }
    .statement-head {
      background: #0f172a;
      color: #ffffff;
      padding: 7px 14px;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .statement-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 700;
      font-size: 12.5px;
    }
    .statement-total {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      background: #ecfdf5;
      border-top: 2px solid #94a3b8;
      font-weight: 900;
      font-size: 14px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 14px 0 6px 0;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0;
    }
    .section-sort {
      font-size: 10.5px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5.5px 8px;
      text-align: left;
    }
    thead th {
      color: #ffffff;
      font-weight: 800;
      font-size: 10.5px;
      text-transform: uppercase;
    }
    .final-bar {
      background: #064e3b;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      margin-top: 12px;
    }
    .footer-note {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 10.5px;
      color: #64748b;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Logo Fiesta de Navidad Jobos Campers Park" />
    <div>
      <h1 class="header-title">Fiesta de Navidad Jobos Campers Park</h1>
      <h2 class="header-subtitle">Informe de Ingresos y Gastos</h2>
      <p class="header-date">Fecha del reporte: ${escapeHtml(todayFormatted)}</p>
    </div>
  </div>

  <div class="statement-box">
    <div class="statement-head">
      <span>Estado Financiero — Resumen General</span>
      <span>Importe (USD)</span>
    </div>
    <div class="statement-row" style="color:#065f46;">
      <span>Total de Ingresos (Depósitos Recibidos: ${stats.depositCount || 0} • ${stats.totalCampers || 0} Campers • ${stats.totalPeople || 0} Personas)</span>
      <span>+${formatCurrency(stats.totalDeposits)}</span>
    </div>
    <div class="statement-row" style="color:#9f1239;">
      <span>Menos: Total de Gastos Pagados (${stats.expenseCount || 0} ${stats.expenseCount === 1 ? 'registro' : 'registros'})</span>
      <span>-${formatCurrency(stats.totalExpenses)}</span>
    </div>
    <div class="statement-total">
      <span style="color:#0f172a;">BALANCE NETO DISPONIBLE (INGRESOS - GASTOS)</span>
      <span style="color:#065f46;">${formatCurrency(stats.balance)}</span>
    </div>
  </div>

  <div class="section-header">
    <h3 class="section-title" style="color:#064e3b;">I. Detalle de Ingresos — Depósitos Recibidos (${sortedDeposits.length})</h3>
    <span class="section-sort">Ordenado por Número de Camper (Ascendente)</span>
  </div>
  <table>
    <thead>
      <tr style="background:#065f46;">
        <th style="width:18%;"># Camper</th>
        <th style="width:42%;">Residente / Familia</th>
        <th style="width:10%; text-align:center;">Pers.</th>
        <th style="width:14%; text-align:center;">Fecha</th>
        <th style="width:16%; text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${depositRowsHtml}
      <tr style="background:#d1fae5; font-weight:800; color:#064e3b;">
        <td colspan="2">TOTAL DE INGRESOS (${stats.depositCount || 0} depósitos • ${stats.totalCampers || 0} campers)</td>
        <td style="text-align:center;">${stats.totalPeople || 0} pers.</td>
        <td></td>
        <td style="text-align:right;">+${formatCurrency(stats.totalDeposits)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-header">
    <h3 class="section-title" style="color:#881337;">II. Detalle de Gastos — Desembolsos Pagados (${sortedExpenses.length})</h3>
    <span class="section-sort">Ordenado por Fecha</span>
  </div>
  <table>
    <thead>
      <tr style="background:#9f1239;">
        <th style="width:15%;">Fecha</th>
        <th style="width:32%;">Pagado a (Suplidor / Comercio)</th>
        <th style="width:37%;">Concepto Resumido</th>
        <th style="width:16%; text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${expenseRowsHtml}
      <tr style="background:#ffe4e6; font-weight:800; color:#881337;">
        <td colspan="3">TOTAL DE GASTOS PAGADOS (${stats.expenseCount || 0} ${stats.expenseCount === 1 ? 'gasto' : 'gastos'})</td>
        <td style="text-align:right;">-${formatCurrency(stats.totalExpenses)}</td>
      </tr>
    </tbody>
  </table>

  <div class="final-bar">
    <span>BALANCE FINAL DISPONIBLE (Ingresos: +${formatCurrency(stats.totalDeposits)} | Gastos: -${formatCurrency(stats.totalExpenses)})</span>
    <span style="font-size:16px; color:#fde047;">${formatCurrency(stats.balance)}</span>
  </div>

  <div class="footer-note">
    Fiesta de Navidad Jobos Campers Park • Este informe presenta el resumen de cada registro como Estado Financiero. El detalle completo y las imágenes de los recibos están disponibles en la aplicación.
  </div>
</body>
</html>`;

  const existingFrame = document.getElementById('fiesta-jobos-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'fiesta-jobos-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow.document;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  };

  const logoImg = frameDoc.querySelector('img');
  if (logoImg && !logoImg.complete) {
    logoImg.onload = () => setTimeout(triggerPrint, 150);
    logoImg.onerror = () => setTimeout(triggerPrint, 150);
  } else {
    setTimeout(triggerPrint, 200);
  }
}

