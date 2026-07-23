import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';

type InvoiceOrder = {
  number: string;
  placedAt: Date;
  paymentLabel: string; // precomputed (system method, else customer-facing) by the caller
  shippingPiastres: bigint;
  subtotalPiastres: bigint;
  discountPiastres: bigint;
  manualDiscountTitle: string | null;
  manualDiscountPct: number | null;
  manualDiscountPiastres: bigint;
  totalPiastres: bigint;
  shippingAddressJson: unknown;
  pharmacist: { name: string | null } | null;
  items: { qty: number; unitPricePiastres: bigint; lineExpiry: Date | null; condition: string | null; product: { nameEn: string; nameAr: string | null; sku: string; weightG: number | null } }[];
};

export type InvoiceOptions = { letterheadPng?: Buffer | null };

// Arabic-capable font (repo asset). pdfkit renders Arabic correctly through fontkit
// once the OTF is registered — letters join and reorder RTL with NO reshaping libs.
// Read once from disk (the app runs from the repo root; no standalone tracing).
let arFont: Buffer | null | undefined;
function arabicFont(): Buffer | null {
  if (arFont !== undefined) return arFont;
  try {
    arFont = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'fonts', 'GE-Dinar-Two-Medium.otf'));
  } catch {
    arFont = null; // Arabic simply won't render; the English invoice still works.
  }
  return arFont;
}

const GREEN = '#48884d';
const INK = '#2a3640';
const MUTE = '#6a7b72';
const RULE = '#e6eae6';

/**
 * Bilingual (EN + AR) PDF invoice (FR-ORD-08). Draws the owner's uploaded
 * letterhead full-page behind every page when supplied (else a plain branded
 * header). Includes the pharmacist, per-line exact expiry + weight, the staff
 * manual discount line, and Arabic labels/translations alongside the English.
 */
export async function generateInvoicePdf(order: InvoiceOrder, opts: InvoiceOptions = {}): Promise<Buffer> {
  const font = arabicFont();
  const hasAr = !!font;
  const letterhead = opts.letterheadPng ?? null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (font) doc.registerFont('ar', font);

    // Letterhead paper: fill each page behind the content. `pageAdded` covers
    // multi-page invoices; call once for the first page too.
    const paintBg = () => { if (letterhead) { try { doc.image(letterhead, 0, 0, { width: doc.page.width, height: doc.page.height }); } catch { /* bad image → skip */ } } };
    doc.on('pageAdded', paintBg);
    paintBg();

    // Right-aligned Arabic helper — switches to the AR font, draws, restores.
    const ar = (s: string, x: number, y: number, width: number, size = 9, color = MUTE) => {
      if (!hasAr) return;
      doc.font('ar').fontSize(size).fillColor(color).text(s, x, y, { width, align: 'right' });
      doc.font('Helvetica');
    };

    // Header — skip the text brand when a letterhead already carries it.
    if (!letterhead) {
      doc.font('Helvetica-Bold').fontSize(22).fillColor(GREEN).text('Veeey', 50, 50);
      doc.font('Helvetica').fontSize(9).fillColor(MUTE).text('Health Inside — premium supplements & devices', 50, doc.y);
      ar('فيي — صحة من الداخل · مكمّلات وأجهزة صحية فاخرة', 300, 52, 245, 9, MUTE);
      doc.moveDown();
    } else {
      doc.y = 120; // clear the letterhead's header band
    }

    doc.font('Helvetica-Bold').fillColor(INK).fontSize(15).text(`Invoice ${order.number}`, 50, doc.y);
    ar(`فاتورة رقم ${order.number}`, 300, doc.y - 15, 245, 12, INK);
    doc.font('Helvetica').fontSize(9).fillColor(MUTE);
    doc.text(`Date: ${order.placedAt.toISOString().slice(0, 10)}`);
    doc.text(`Pharmacist: ${order.pharmacist?.name ?? '—'}`);
    doc.text(`Payment: ${order.paymentLabel}`);

    const addr = order.shippingAddressJson as { name?: string; phone?: string; governorate?: string; city?: string; area?: string; street?: string } | null;
    if (addr) {
      doc.moveDown(0.5);
      doc.fillColor(INK).text(`Deliver to: ${addr.name ?? ''} · ${addr.phone ?? ''}`);
      doc.fillColor(MUTE).text([addr.street, addr.area, addr.city, addr.governorate].filter(Boolean).join(', '));
    }

    // Table header (bilingual: EN then a small AR label beneath).
    doc.moveDown();
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    doc.text('Product', 50, top);
    doc.text('Expiry', 280, top);
    doc.text('Weight', 340, top);
    doc.text('Qty', 410, top);
    doc.text('Line', 460, top, { width: 85, align: 'right' });
    if (hasAr) {
      const arY = top + 10;
      ar('المنتج', 50, arY, 90, 8);
      ar('الصلاحية', 250, arY, 55, 8);
      ar('الوزن', 320, arY, 45, 8);
      ar('الكمية', 385, arY, 45, 8);
      ar('القيمة', 460, arY, 85, 8);
    }
    doc.font('Helvetica');
    const headBottom = top + (hasAr ? 22 : 12);
    doc.moveTo(50, headBottom).lineTo(545, headBottom).strokeColor(RULE).stroke();
    doc.y = headBottom + 4;

    for (const it of order.items) {
      const y = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(`${it.product.nameEn}${isConditionVariant(it.condition) ? ` — ${conditionLabel(it.condition, 'en')}` : ''}`, 50, y, { width: 220 });
      let nameBottom = doc.y;
      if (hasAr && it.product.nameAr) {
        doc.font('ar').fontSize(8).fillColor(MUTE).text(it.product.nameAr, 50, nameBottom, { width: 220, align: 'right' });
        doc.font('Helvetica');
        nameBottom = doc.y;
      }
      const lineY = y; // numeric columns align to the row top
      doc.fontSize(9).fillColor(MUTE);
      doc.text(it.lineExpiry ? it.lineExpiry.toISOString().slice(0, 7) : '—', 280, lineY);
      doc.text(it.product.weightG != null ? `${it.product.weightG} g` : '—', 340, lineY);
      doc.text(String(it.qty), 410, lineY);
      doc.fillColor(INK).text(formatEGP(Number(it.unitPricePiastres) * it.qty), 460, lineY, { width: 85, align: 'right' });
      doc.y = Math.max(nameBottom, lineY + 12);
      doc.moveDown(0.3);
    }

    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(RULE).stroke();
    doc.moveDown(0.5);
    const totalsRow = (en: string, arLabel: string, value: string, bold = false) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? INK : MUTE).fontSize(bold ? 11 : 9).text(en, 320, y, { width: 140 });
      doc.fillColor(INK).text(value, 460, y, { width: 85, align: 'right' });
      if (hasAr) ar(arLabel, 200, y + 1, 110, 8, bold ? INK : MUTE);
      doc.font('Helvetica').moveDown(0.4);
    };
    totalsRow('Subtotal', 'المجموع الفرعي', formatEGP(Number(order.subtotalPiastres)));
    if (Number(order.discountPiastres) > 0) totalsRow('Discount', 'الخصم', `- ${formatEGP(Number(order.discountPiastres))}`);
    if (Number(order.manualDiscountPiastres) > 0) {
      const label = order.manualDiscountTitle || 'Discount';
      totalsRow(`${label}${order.manualDiscountPct ? ` (${order.manualDiscountPct}%)` : ''}`, order.manualDiscountTitle || 'خصم', `- ${formatEGP(Number(order.manualDiscountPiastres))}`);
    }
    totalsRow('Shipping', 'الشحن', Number(order.shippingPiastres) === 0 ? 'Free' : formatEGP(Number(order.shippingPiastres)));
    totalsRow('Total', 'الإجمالي', formatEGP(Number(order.totalPiastres)), true);

    doc.moveDown(2).font('Helvetica').fontSize(8).fillColor(MUTE).text('Thank you for shopping with Veeey. No VAT. info@veeey.com', 50, doc.y, { align: 'center', width: 495 });
    if (hasAr) { doc.font('ar').fontSize(9).fillColor(MUTE).text('شكراً لتسوقك مع فيي · لا تُطبَّق ضريبة قيمة مضافة', 50, doc.y + 2, { align: 'center', width: 495 }); doc.font('Helvetica'); }

    doc.end();
  });
}
