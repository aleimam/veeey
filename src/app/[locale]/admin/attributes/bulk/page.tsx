import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { getAiConfig } from '@/lib/provider-config';
import { listBulkAttributes, productsForBulk } from '@/lib/attribute-bulk-service';
import { AttributeBulkEditor } from '@/components/admin/attribute-bulk-editor';

export const dynamic = 'force-dynamic';

export default async function AttributeBulkPage({ params }: { params: Promise<{ locale: string }> }) {
  await requirePermission('catalog.write');
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const [attributes, cats, brands, aiCfg] = await Promise.all([
    listBulkAttributes(),
    prisma.category.findMany({ orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
    prisma.brand.findMany({ where: { archivedAt: null }, orderBy: { nameEn: 'asc' }, select: { id: true, nameEn: true, nameAr: true } }),
    getAiConfig().catch(() => null),
  ]);
  const first = attributes[0];
  const initial = first ? await productsForBulk({ attributeId: first.id }) : { items: [], total: 0 };

  return (
    <div className="p-4 sm:p-6">
      <Link href="/admin/attributes" className="text-sm text-primary hover:underline">← {tb('Attributes', 'الخصائص')}</Link>
      <h1 className="mb-1 mt-1 font-heading text-xl font-semibold text-foreground">{tb('Bulk attribute editor', 'محرّر الخصائص بالجملة')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Fill product attributes fast so the shop filter sidebar has values. Pick an attribute, filter and select products, then assign a value to all of them — or let AI suggest a value per product for you to review.',
          'املأ خصائص المنتجات بسرعة كي تمتلئ قائمة تصفية المتجر. اختر خاصية، صفِّ واختر المنتجات، ثم عيّن قيمة لها جميعًا — أو دع الذكاء الاصطناعي يقترح قيمة لكل منتج لمراجعتها.',
        )}
      </p>

      {attributes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tb('No attributes yet — create some first.', 'لا خصائص بعد — أنشئ بعضها أولًا.')} <Link href="/admin/attributes" className="text-primary hover:underline">{tb('Attributes', 'الخصائص')}</Link></p>
      ) : (
        <AttributeBulkEditor
          attributes={attributes}
          categories={cats.map((c) => ({ id: c.id, name: ar ? c.nameAr ?? c.nameEn : c.nameEn }))}
          brands={brands.map((b) => ({ id: b.id, name: ar ? b.nameAr ?? b.nameEn : b.nameEn }))}
          aiEnabled={!!aiCfg}
          locale={locale}
          initialItems={initial.items}
          initialTotal={initial.total}
        />
      )}
    </div>
  );
}
