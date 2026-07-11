import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listGifts, listGiftMovements } from '@/lib/gift-service';
import { getNumberSetting } from '@/lib/settings-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';
import { bulkSoftDeleteAction } from '@/server/bulk-actions';
import { parseListParams, listQs, clientPage, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import type { BulkOp } from '@/components/admin/bulk-bar';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const MOVE_LABELS: Record<string, [en: string, ar: string]> = {
  GRANT: ['Added to order', 'أُضيفت لطلب'],
  RETURN: ['Restocked', 'أُعيدت للمخزون'],
  ADJUST: ['Manual adjust', 'تعديل يدوي'],
};
const REF_LABELS: Record<string, [en: string, ar: string]> = {
  order: ['order', 'طلب'],
  order_edit: ['order edit', 'تعديل طلب'],
  status_restock: ['cancel/refund restock', 'إرجاع إلغاء/استرداد'],
  manual: ['gift form', 'نموذج الهدية'],
};

export default async function GiftsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const showingArchived = one(sp.archived) === '1';
  const lp = parseListParams(sp, { sortable: ['code', 'name', 'stock'], defaultSort: 'code', defaultDir: 'asc' });
  const [allRaw, lowThreshold] = await Promise.all([listGifts(), getNumberSetting('gifts.lowStockThreshold')]);
  const all = allRaw.filter((g) => (showingArchived ? g.archivedAt : !g.archivedAt));
  const { rows: gifts, total } = clientPage(all, lp, { code: (g) => g.code, name: (g) => g.internalName, stock: (g) => g.stock });
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');

  // Movements panel for one gift (?gift=<id>)
  const movementGiftId = one(sp.gift);
  const movementGift = movementGiftId ? allRaw.find((g) => g.id === movementGiftId) ?? null : null;
  const movements = movementGift ? await listGiftMovements(movementGift.id) : [];

  const basePath = `/${locale}/admin/gifts`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined })}`;
  const done = one(sp.done);
  const ops: BulkOp[] = [
    showingArchived ? { value: 'restore', label: tb('Restore', 'استعادة') } : { value: 'archive', label: tb('Archive', 'أرشفة') },
    { value: 'delete', label: tb('Delete', 'حذف'), danger: true },
  ];

  const stockCell = (stock: number) => (
    <span className="inline-flex items-center gap-2">
      {stock}
      {stock <= 0 ? (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">{tb('Out', 'نفدت')}</span>
      ) : stock <= lowThreshold ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{tb('Low', 'منخفض')}</span>
      ) : null}
    </span>
  );

  return (
    <>
      <AdminList
        title={showingArchived ? `${tl('gifts')} ${tc('archivedSuffix')}` : tl('gifts')}
        newHref="/admin/gifts/edit"
        count={total}
        head={[{ label: tf('code'), col: 'code' }, { label: tf('internalName'), col: 'name' }, { label: tf('stock'), col: 'stock' }, tf('expiry')]}
        sortCtx={{ sort: lp.sort, dir: lp.dir, sp, basePath }}
        toolbar={
          <span className="inline-flex items-center gap-2">
            <a href={`/${locale}/admin/gifts/rules`} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface">
              🎁 {tb('Gift rules', 'قواعد الهدايا')}
            </a>
            <ArchivedToggle path="gifts" showingArchived={showingArchived} />
          </span>
        }
        notice={<>
          <InUseNotice show={one(sp.error) === 'in_use'} />
          {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} updated`, `تم — ${done}`)}{Number(one(sp.skip)) > 0 ? tb(`, ${one(sp.skip)} skipped (in use)`, `، ${one(sp.skip)} متخطّى`) : ''}.</p>}
        </>}
        bulk={{ formId: 'bulk-gifts', action: bulkSoftDeleteAction, locale, back, ops, hidden: { entity: 'gift', path: 'gifts' } }}
        pagination={{ page: lp.page, perPage: lp.perPage, total, sp, basePath, locale }}
        rows={gifts.map((g) => ({
          key: g.id,
          cells: [g.code, g.internalName, stockCell(g.stock), g.expiry ? g.expiry.toISOString().slice(0, 10) : '—'],
          editHref: `/admin/gifts/edit/${g.id}`,
          actions: (
            <span className="inline-flex items-center gap-3">
              <a href={`${basePath}${listQs(sp, { gift: g.id })}`} className="text-xs text-primary hover:underline">{tb('Movements', 'الحركات')}</a>
              <RowActions entity="gift" id={g.id} path="gifts" locale={locale} archived={!!g.archivedAt} />
            </span>
          ),
        }))}
      />

      {movementGift && (
        <section className="mx-6 mb-6 rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {tb('Stock movements', 'حركات المخزون')} — {movementGift.code} · {movementGift.internalName}
              <span className="ms-2 text-xs font-normal text-muted-foreground">{tb(`current stock ${movementGift.stock}`, `المخزون الحالي ${movementGift.stock}`)}</span>
            </h2>
            <a href={`${basePath}${listQs(sp, { gift: undefined })}`} className="text-xs text-muted-foreground hover:underline">{tb('Close', 'إغلاق')} ✕</a>
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tb('No movements recorded yet — movements are logged from now on (orders, restocks, manual edits).', 'لا توجد حركات مسجلة بعد — تُسجَّل الحركات من الآن فصاعدًا (طلبات، إرجاع، تعديلات يدوية).')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">{tb('Date', 'التاريخ')}</th>
                    <th className="p-2 text-start">{tb('Type', 'النوع')}</th>
                    <th className="p-2 text-center">{tb('Qty', 'الكمية')}</th>
                    <th className="p-2 text-start">{tb('Source', 'المصدر')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const [ten, tar] = MOVE_LABELS[m.type] ?? [m.type, m.type];
                    const ref = m.refType ? (REF_LABELS[m.refType] ?? [m.refType, m.refType]) : null;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="p-2">{m.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                        <td className="p-2">{tb(ten, tar)}</td>
                        <td className={`p-2 text-center font-medium ${m.qtyDelta < 0 ? 'text-destructive' : 'text-primary'}`}>{m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}</td>
                        <td className="p-2 text-muted-foreground">{ref ? tb(ref[0], ref[1]) : '—'}{m.note ? ` · ${m.note}` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
