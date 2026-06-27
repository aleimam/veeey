import PDFDocument from 'pdfkit';
import { formatEGP } from '@/lib/format';

type InvoiceOrder = {
  number: string;
  placedAt: Date;
  paymentLabel: string; // precomputed (system method, else customer-facing) by the caller
  shippingPiastres: bigint;
  subtotalPiastres: bigint;
  discountPiastres: bigint;
  totalPiastres: bigint;
  shippingAddressJson: unknown;
  pharmacist: { name: string | null } | null;
  items: { qty: number; unitPricePiastres: bigint; lineExpiry: Date | null; product: { nameEn: string; sku: string; weightG: number | null } }[];
};

/**
 * PDF invoice (FR-ORD-08). Includes the pharmacist name and, per line, the exact
 * bound-lot expiry and product weight. (Arabic glyphs need an embedded font —
 * added when the bilingual template lands; English invoice for now.)
 */
export function generateInvoicePdf(order: InvoiceOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).fillColor('#48884d').text('Veeey');
    doc.fontSize(9).fillColor('#6a7b72').text('Health Inside — premium supplements & devices');
    doc.moveDown();

    doc.fillColor('#2a3640').fontSize(15).text(`Invoice ${order.number}`);
    doc.fontSize(9).fillColor('#6a7b72');
    doc.text(`Date: ${order.placedAt.toISOString().slice(0, 10)}`);
    doc.text(`Pharmacist: ${order.pharmacist?.name ?? '—'}`);
    doc.text(`Payment: ${order.paymentLabel}`);
    const addr = order.shippingAddressJson as { name?: string; phone?: string; governorate?: string; city?: string; area?: string; street?: string } | null;
    if (addr) {
      doc.moveDown(0.5);
      doc.fillColor('#2a3640').text(`Deliver to: ${addr.name ?? ''} · ${addr.phone ?? ''}`);
      doc.fillColor('#6a7b72').text([addr.street, addr.area, addr.city, addr.governorate].filter(Boolean).join(', '));
    }

    doc.moveDown();
    const top = doc.y;
    doc.fontSize(9).fillColor('#2a3640');
    doc.text('Product', 50, top);
    doc.text('Expiry', 280, top);
    doc.text('Weight', 340, top);
    doc.text('Qty', 410, top);
    doc.text('Line', 460, top, { width: 90, align: 'right' });
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#e6eae6').stroke();
    doc.moveDown(0.5);

    for (const it of order.items) {
      const y = doc.y;
      doc.fillColor('#2a3640').text(`${it.product.nameEn}`, 50, y, { width: 220 });
      const lineY = Math.max(y, doc.y - 12);
      doc.fillColor('#6a7b72');
      doc.text(it.lineExpiry ? it.lineExpiry.toISOString().slice(0, 7) : '—', 280, lineY);
      doc.text(it.product.weightG != null ? `${it.product.weightG} g` : '—', 340, lineY);
      doc.text(String(it.qty), 410, lineY);
      doc.fillColor('#2a3640').text(formatEGP(Number(it.unitPricePiastres) * it.qty), 460, lineY, { width: 90, align: 'right' });
      doc.moveDown(0.5);
    }

    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#e6eae6').stroke();
    doc.moveDown(0.5);
    const totalsRow = (label: string, value: string) => {
      const y = doc.y;
      doc.fillColor('#6a7b72').fontSize(9).text(label, 360, y);
      doc.fillColor('#2a3640').text(value, 460, y, { width: 90, align: 'right' });
      doc.moveDown(0.4);
    };
    totalsRow('Subtotal', formatEGP(Number(order.subtotalPiastres)));
    totalsRow('Shipping', Number(order.shippingPiastres) === 0 ? 'Free' : formatEGP(Number(order.shippingPiastres)));
    if (Number(order.discountPiastres) > 0) totalsRow('Discount', `- ${formatEGP(Number(order.discountPiastres))}`);
    doc.fontSize(11);
    totalsRow('Total', formatEGP(Number(order.totalPiastres)));

    doc.moveDown(2).fontSize(8).fillColor('#6a7b72').text('Thank you for shopping with Veeey. No VAT. info@veeey.com', { align: 'center' });
    doc.end();
  });
}
