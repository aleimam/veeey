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

export type InvoiceLocale = 'en' | 'ar';
export type InvoiceOptions = { letterheadPng?: Buffer | null; locale?: InvoiceLocale };

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

type Align = 'left' | 'right' | 'center';
type Col = { x: number; w: number; a: Align };

// Per-language copy. The invoice renders in ONE language (FR-ORD-08): a customer
// browsing in Arabic gets a fully Arabic (RTL) invoice, English browsers get English.
const COPY: Record<InvoiceLocale, Record<string, string>> = {
  en: {
    tagline: 'Health Inside — premium supplements & devices',
    invoice: 'Invoice', date: 'Date', pharmacist: 'Pharmacist', payment: 'Payment', deliverTo: 'Deliver to',
    product: 'Product', expiry: 'Expiry', weight: 'Weight', qty: 'Qty', line: 'Line',
    subtotal: 'Subtotal', discount: 'Discount', shipping: 'Shipping', free: 'Free', total: 'Total',
    thanks: 'Thank you for shopping with Veeey. No VAT. info@veeey.com',
  },
  ar: {
    tagline: 'فيي — صحة من الداخل · مكمّلات وأجهزة صحية فاخرة',
    invoice: 'فاتورة رقم', date: 'التاريخ', pharmacist: 'الصيدلي', payment: 'طريقة الدفع', deliverTo: 'التسليم إلى',
    product: 'المنتج', expiry: 'الصلاحية', weight: 'الوزن', qty: 'الكمية', line: 'القيمة',
    subtotal: 'المجموع الفرعي', discount: 'الخصم', shipping: 'الشحن', free: 'مجاني', total: 'الإجمالي',
    thanks: 'شكراً لتسوقك مع فيي · لا تُطبَّق ضريبة قيمة مضافة · info@veeey.com',
  },
};

/**
 * Single-language PDF invoice (FR-ORD-08). Renders in the viewer's language only —
 * Arabic browsers get a right-to-left Arabic invoice (labels, product names and
 * table mirrored), English browsers get the English one. Draws the owner's uploaded
 * letterhead full-page behind every page when supplied (else a plain branded header),
 * and includes the pharmacist, per-line exact expiry + weight, and the manual discount.
 */
export async function generateInvoicePdf(order: InvoiceOrder, opts: InvoiceOptions = {}): Promise<Buffer> {
  const font = arabicFont();
  const hasAr = !!font;
  const letterhead = opts.letterheadPng ?? null;
  // Fall back to English if the Arabic font is missing — never emit a broken invoice.
  const lang: InvoiceLocale = opts.locale === 'ar' && hasAr ? 'ar' : 'en';
  const rtl = lang === 'ar';
  const t = COPY[lang];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (font) doc.registerFont('ar', font);

    // One font family for the whole document (Arabic OTF has Latin glyphs too, so
    // numbers/SKUs still render). GE-Dinar-Two-Medium is the only weight we ship,
    // so bold Arabic reuses it.
    const F = rtl ? 'ar' : 'Helvetica';
    const FB = rtl ? 'ar' : 'Helvetica-Bold';
    const blockAlign: Align = rtl ? 'right' : 'left';
    const CW = 495; // content width (50 → 545)

    // Letterhead paper: fill each page behind the content. `pageAdded` covers
    // multi-page invoices; call once for the first page too.
    const paintBg = () => { if (letterhead) { try { doc.image(letterhead, 0, 0, { width: doc.page.width, height: doc.page.height }); } catch { /* bad image → skip */ } } };
    doc.on('pageAdded', paintBg);
    paintBg();

    const block = (s: string, size: number, color: string, bold = false) =>
      doc.font(bold ? FB : F).fontSize(size).fillColor(color).text(s, 50, doc.y, { width: CW, align: blockAlign });

    // Header — skip the text brand when a letterhead already carries it.
    if (!letterhead) {
      doc.font(FB).fontSize(22).fillColor(GREEN).text('Veeey', 50, 50, { width: CW, align: blockAlign });
      block(t.tagline, 9, MUTE);
      doc.moveDown();
    } else {
      doc.y = 120; // clear the letterhead's header band
    }

    doc.font(FB).fillColor(INK).fontSize(15).text(`${t.invoice} ${order.number}`, 50, doc.y, { width: CW, align: blockAlign });
    block(`${t.date}: ${order.placedAt.toISOString().slice(0, 10)}`, 9, MUTE);
    block(`${t.pharmacist}: ${order.pharmacist?.name ?? '—'}`, 9, MUTE);
    block(`${t.payment}: ${order.paymentLabel}`, 9, MUTE);

    const addr = order.shippingAddressJson as { name?: string; phone?: string; governorate?: string; city?: string; area?: string; street?: string } | null;
    if (addr) {
      doc.moveDown(0.5);
      block(`${t.deliverTo}: ${addr.name ?? ''} · ${addr.phone ?? ''}`, 9, INK);
      block([addr.street, addr.area, addr.city, addr.governorate].filter(Boolean).join(rtl ? '، ' : ', '), 9, MUTE);
    }

    // Item table. Columns are mirrored for Arabic so the invoice reads right-to-left
    // (product on the right, amount on the far left) — a genuine RTL layout, not just
    // right-aligned text in a left-to-right grid.
    const cols: Record<'product' | 'expiry' | 'weight' | 'qty' | 'line', Col> = rtl
      ? { line: { x: 50, w: 85, a: 'left' }, qty: { x: 145, w: 40, a: 'right' }, weight: { x: 195, w: 60, a: 'right' }, expiry: { x: 260, w: 55, a: 'right' }, product: { x: 325, w: 220, a: 'right' } }
      : { product: { x: 50, w: 220, a: 'left' }, expiry: { x: 280, w: 55, a: 'left' }, weight: { x: 340, w: 60, a: 'left' }, qty: { x: 410, w: 40, a: 'left' }, line: { x: 460, w: 85, a: 'right' } };

    doc.moveDown();
    const top = doc.y;
    doc.font(FB).fontSize(9).fillColor(INK);
    (Object.keys(cols) as (keyof typeof cols)[]).forEach((k) => doc.text(t[k], cols[k].x, top, { width: cols[k].w, align: cols[k].a }));
    const headBottom = top + 12;
    doc.moveTo(50, headBottom).lineTo(545, headBottom).strokeColor(RULE).stroke();
    doc.y = headBottom + 4;

    for (const it of order.items) {
      const y = doc.y;
      const name = (rtl ? it.product.nameAr || it.product.nameEn : it.product.nameEn) + (isConditionVariant(it.condition) ? ` — ${conditionLabel(it.condition, lang)}` : '');
      doc.font(F).fontSize(9).fillColor(INK).text(name, cols.product.x, y, { width: cols.product.w, align: cols.product.a });
      const nameBottom = doc.y;
      doc.fontSize(9).fillColor(MUTE);
      doc.text(it.lineExpiry ? it.lineExpiry.toISOString().slice(0, 7) : '—', cols.expiry.x, y, { width: cols.expiry.w, align: cols.expiry.a });
      doc.text(it.product.weightG != null ? `${it.product.weightG} g` : '—', cols.weight.x, y, { width: cols.weight.w, align: cols.weight.a });
      doc.text(String(it.qty), cols.qty.x, y, { width: cols.qty.w, align: cols.qty.a });
      doc.fillColor(INK).text(formatEGP(Number(it.unitPricePiastres) * it.qty), cols.line.x, y, { width: cols.line.w, align: cols.line.a });
      doc.y = Math.max(nameBottom, y + 12);
      doc.moveDown(0.3);
    }

    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(RULE).stroke();
    doc.moveDown(0.5);
    const labelCol: Col = rtl ? { x: 135, w: 140, a: 'right' } : { x: 320, w: 140, a: 'left' };
    const valueCol: Col = rtl ? { x: 50, w: 85, a: 'left' } : { x: 460, w: 85, a: 'right' };
    const totalsRow = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc.font(bold ? FB : F).fillColor(bold ? INK : MUTE).fontSize(bold ? 11 : 9).text(label, labelCol.x, y, { width: labelCol.w, align: labelCol.a });
      doc.font(bold ? FB : F).fillColor(INK).text(value, valueCol.x, y, { width: valueCol.w, align: valueCol.a });
      doc.moveDown(0.4);
    };
    totalsRow(t.subtotal, formatEGP(Number(order.subtotalPiastres)));
    if (Number(order.discountPiastres) > 0) totalsRow(t.discount, `- ${formatEGP(Number(order.discountPiastres))}`);
    if (Number(order.manualDiscountPiastres) > 0) {
      const label = order.manualDiscountTitle || t.discount;
      totalsRow(`${label}${order.manualDiscountPct ? ` (${order.manualDiscountPct}%)` : ''}`, `- ${formatEGP(Number(order.manualDiscountPiastres))}`);
    }
    totalsRow(t.shipping, Number(order.shippingPiastres) === 0 ? t.free : formatEGP(Number(order.shippingPiastres)));
    totalsRow(t.total, formatEGP(Number(order.totalPiastres)), true);

    doc.moveDown(2).font(F).fontSize(8).fillColor(MUTE).text(t.thanks, 50, doc.y, { align: 'center', width: CW });

    doc.end();
  });
}
