'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import type { ThemeRecord } from '@/lib/theme-service';
import { AppearanceEditor } from '@/components/admin/appearance-editor';
import {
  createThemeAction,
  duplicateThemeAction,
  renameThemeAction,
  deleteThemeAction,
  setActiveThemeAction,
  assignTierThemeAction,
} from '@/server/theme-actions';

type TierLite = { id: string; key: string; name: string; themeId: string | null };
type Result = { ok: boolean; id?: string; error?: string };

const btn = 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50';
const selCls = 'rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring';

export function AppearanceManager({ themes, tiers, locale }: { themes: ThemeRecord[]; tiers: TierLite[]; locale: string }) {
  const t = pick(useLocale() || locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const active = themes.find((x) => x.isActive) ?? themes[0];
  const [selectedId, setSelectedId] = useState(active?.id ?? '');
  const selected = themes.find((x) => x.id === selectedId) ?? active;

  const run = (p: Promise<Result>, after?: (r: Result) => void) =>
    start(async () => {
      setErr(null);
      const r = await p;
      if (!r.ok) setErr(r.error ?? 'ERROR');
      after?.(r);
      router.refresh();
    });

  const onNew = () => {
    const name = window.prompt(t('New theme name', 'اسم الثيم الجديد'), t('New theme', 'ثيم جديد'));
    if (name && name.trim()) run(createThemeAction(name.trim()), (r) => r.id && setSelectedId(r.id));
  };
  const onDuplicate = () => selected && run(duplicateThemeAction(selected.id), (r) => r.id && setSelectedId(r.id));
  const onRename = () => {
    if (!selected) return;
    const name = window.prompt(t('Rename theme', 'إعادة تسمية الثيم'), selected.name);
    if (name && name.trim()) run(renameThemeAction(selected.id, name.trim()));
  };
  const onDelete = () => {
    if (!selected) return;
    if (!window.confirm(t(`Delete "${selected.name}"?`, `حذف "${selected.name}"؟`))) return;
    run(deleteThemeAction(selected.id), (r) => r.ok && setSelectedId(active?.id ?? ''));
  };
  const onActivate = () => selected && run(setActiveThemeAction(selected.id));

  if (!selected) return null;

  return (
    <div className="space-y-6">
      {/* theme switcher bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <span className="text-sm text-muted-foreground">{t('Theme', 'الثيم')}:</span>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={selCls} aria-label={t('Select theme', 'اختر الثيم')}>
          {themes.map((th) => (
            <option key={th.id} value={th.id}>
              {th.name}
              {th.isActive ? ' ★' : ''}
            </option>
          ))}
        </select>
        {selected.isActive ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{t('Active', 'النشط')}</span>
        ) : (
          <button type="button" onClick={onActivate} disabled={pending} className={btn}>{t('Set as active', 'تعيين كنشط')}</button>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" onClick={onNew} disabled={pending} className={btn}>{t('New', 'جديد')}</button>
        <button type="button" onClick={onDuplicate} disabled={pending} className={btn}>{t('Duplicate', 'تكرار')}</button>
        <button type="button" onClick={onRename} disabled={pending} className={btn}>{t('Rename', 'إعادة تسمية')}</button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending || selected.isDefault || selected.isActive}
          title={selected.isDefault ? t('The default theme cannot be deleted', 'لا يمكن حذف الثيم الافتراضي') : selected.isActive ? t('Switch active theme first', 'بدّل الثيم النشط أولًا') : ''}
          className={`${btn} text-destructive`}
        >
          {t('Delete', 'حذف')}
        </button>
        {err && <span className="text-sm text-destructive">{t('Action failed', 'فشل الإجراء')}</span>}
      </div>

      {/* per-tier assignment */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-1 font-heading text-base font-semibold">{t('Theme per customer tier', 'ثيم لكل فئة عملاء')}</div>
        <p className="mb-3 text-sm text-muted-foreground">
          {t('Assign a theme to each tier. Guests and untiered customers always see the active theme.', 'عيّن ثيمًا لكل فئة. الزوار والعملاء بلا فئة يرون الثيم النشط دائمًا.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <label key={tier.id} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{tier.name}</span>
              <select
                value={tier.themeId ?? ''}
                onChange={(e) => run(assignTierThemeAction(tier.id, e.target.value))}
                disabled={pending}
                className={selCls}
              >
                <option value="">{t('Use active theme', 'استخدم الثيم النشط')}</option>
                {themes.map((th) => (
                  <option key={th.id} value={th.id}>{th.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* editor for the selected theme (remounts on theme switch) */}
      <div>
        <div className="mb-3 text-sm text-muted-foreground">
          {t('Editing', 'تحرير')}: <span className="font-semibold text-foreground">{selected.name}</span>
        </div>
        <AppearanceEditor key={selected.id} themeId={selected.id} initial={selected.tokens} />
      </div>
    </div>
  );
}
