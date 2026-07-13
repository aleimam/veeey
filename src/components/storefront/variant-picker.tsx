import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';
import type { AxisRow } from '@/lib/variant-groups';

/**
 * PDP variant selector (audit P1 §5.4): one chip-row per axis (Size, Flavor…).
 * Chips are plain links to the sibling product's own PDP — every variant keeps
 * its URL, lots and expiry pricing. Styled to match the expiry & price chips.
 */
export function VariantPicker({ rows, locale }: { rows: AxisRow[]; locale: string }) {
  const ar = locale === 'ar';
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row.axis.key}>
          <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-slate">
            <Icon name="layers" size={15} color="var(--green-mid)" /> {ar ? row.axis.nameAr : row.axis.nameEn}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {row.chips.map((chip) => {
              const label = ar ? chip.labelAr : chip.labelEn;
              const slug = ar ? chip.slugAr : chip.slugEn;
              const base = 'min-w-[84px] rounded-[12px] px-3.5 py-2.5 text-start text-[14px] font-bold';
              if (chip.current) {
                return (
                  <span key={chip.labelEn} aria-current="true" className={`${base} border-[1.5px] border-green-dark bg-green-wash text-green-dark`}>
                    {label}
                  </span>
                );
              }
              if (!slug) {
                return (
                  <span key={chip.labelEn} className={`${base} cursor-not-allowed border border-[color:var(--slate-border)] bg-surface text-[color:var(--text-subtle)] opacity-60`}>
                    {label}
                  </span>
                );
              }
              return (
                <Link key={chip.labelEn} href={`/products/${slug}`} className={`${base} border border-[color:var(--slate-border)] bg-white text-ink transition-colors hover:border-green-dark`}>
                  {label}
                  {!chip.inStock && <span className="block text-[10.5px] font-semibold text-[color:var(--text-subtle)]">{ar ? 'غير متوفر' : 'Out of stock'}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
