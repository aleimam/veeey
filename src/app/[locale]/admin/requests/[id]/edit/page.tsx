import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getRequest } from '@/lib/request-service';
import { getNumberSetting } from '@/lib/settings-service';
import { requestEditable } from '@/lib/request-logic';
import { RequestForm, type RequestFormInitial } from '@/components/admin/request-form';
import { piastresToEgp } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function EditRequestPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await requirePermission('requests.manage');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const r = await getRequest(id);
  if (!r) notFound();
  // Lines are frozen once a request leaves PENDING — bounce back to the detail.
  if (!requestEditable(r.status)) redirect(`/${locale}/admin/requests/${id}`);

  const depositPercent = await getNumberSetting('specialOrder.depositPercent');
  const initial: RequestFormInitial = {
    id: r.id,
    type: r.type,
    customer: r.customer ? { id: r.customer.id, name: `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim() } : null,
    notes: r.notes ?? '',
    depositEgp: r.depositPiastres != null ? String(piastresToEgp(r.depositPiastres)) : '',
    lines: r.lines.map((l) => ({
      product: { id: l.product.id, name: l.product.nameEn, sku: l.product.sku, brand: null, thumb: null, basePriceEgp: 0 },
      count: String(l.count),
      sellingPriceEgp: l.sellingPricePiastres != null ? String(piastresToEgp(l.sellingPricePiastres)) : '',
      notes: l.notes ?? '',
    })),
    photoUrls: r.photos.map((p) => p.url),
  };

  return (
    <div className="p-6">
      <Link href={`/admin/requests/${r.id}`} className="text-sm text-primary hover:underline">← {r.uid ?? tb('Request', 'الطلب')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{tb('Edit request', 'تعديل الطلب')}</h1>
      <RequestForm depositPercent={depositPercent} initial={initial} />
    </div>
  );
}
