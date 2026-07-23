import { setRequestLocale } from 'next-intl/server';
import { getGift } from '@/lib/gift-service';
import { saveGiftAction } from '@/server/order-actions';
import { GiftForm } from '@/components/admin/gift-form';
import { piastresToEgp } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';

export default async function GiftEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const giftId = id?.[0];
  const gift = giftId ? await getGift(giftId) : null;
  // Pass only plain strings across the RSC → client boundary (no Date/BigInt).
  const defaults = gift
    ? {
        code: gift.code,
        internalName: gift.internalName,
        nameEn: gift.nameEn ?? '',
        nameAr: gift.nameAr ?? '',
        stock: String(gift.stock),
        expiry: gift.expiry ? gift.expiry.toISOString().slice(0, 10) : '',
        costEgp: gift.costPiastres != null ? String(piastresToEgp(gift.costPiastres)) : '',
      }
    : {};
  const labels = {
    detailsHeading: tb('Gift details', 'تفاصيل الهدية'),
    code: tb('Code (Gx-…)', 'الكود (Gx-…)'),
    internalName: tb('Internal name', 'الاسم الداخلي'),
    nameEn: tb('Customer name (EN)', 'اسم العميل (EN)'),
    nameAr: tb('Customer name (AR)', 'اسم العميل (AR)'),
    nameHint: tb('Shown to the customer on the order confirmation as a free gift. Leave empty to fall back to the internal name.', 'يظهر للعميل في تأكيد الطلب كهدية مجانية. اتركه فارغًا ليعود إلى الاسم الداخلي.'),
    stockHeading: tb('Stock & value', 'المخزون والقيمة'),
    stock: tb('Stock', 'المخزون'),
    cost: tb('Cost (EGP)', 'التكلفة (ج.م)'),
    expiry: tb('Expiry', 'الصلاحية'),
    nonPerishable: tb('Non-perishable — no expiry date', 'غير قابل للتلف — بدون تاريخ صلاحية'),
  };
  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{giftId ? tb('Edit gift', 'تعديل هدية') : tb('New gift', 'هدية جديدة')}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        {tb('Free gifts you can attach to orders. The customer name shows on the order confirmation as a free gift (never billed); most gifts are non-perishable, so expiry is off by default.', 'هدايا مجانية يمكن إرفاقها بالطلبات. يظهر اسم العميل في تأكيد الطلب كهدية مجانية (لا تُحتسب في الفاتورة)؛ معظم الهدايا غير قابلة للتلف، لذا تاريخ الصلاحية معطّل افتراضيًا.')}
      </p>
      <GiftForm action={saveGiftAction} defaults={defaults} id={giftId} locale={locale} listHref="/admin/gifts" labels={labels} />
    </div>
  );
}
