'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { THEME_TOKENS, THEME_GROUPS, LOCAL_FONTS, evaluateContrast, type ThemeGroup, type ThemeToken, type ThemeOverrides } from '@/lib/theme';
import { saveThemeAction, resetThemeTokensAction } from '@/server/theme-actions';

const GROUP_AR: Record<ThemeGroup, string> = {
  Colors: 'الألوان',
  Typography: 'الخطوط',
  Spacing: 'المسافات',
  Radii: 'الزوايا',
  Shadows: 'الظلال',
  Motion: 'الحركة',
};

const sizeNum = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(n) : '';
};

const inputCls = 'rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring';

export function AppearanceEditor({ themeId, initial }: { themeId: string; initial: ThemeOverrides }) {
  const locale = useLocale();
  const tb = pick(locale);
  const [vals, setVals] = useState<ThemeOverrides>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean } | null>(null);

  const set = (tok: ThemeToken, raw: string) => {
    setMsg(null);
    setVals((prev) => {
      const next = { ...prev };
      const v = raw.trim();
      let stored = v;
      if (tok.control === 'size' && v !== '') stored = /[a-z%]/i.test(v) ? v : `${v}px`;
      if (v === '' || stored === tok.def) delete next[tok.v];
      else next[tok.v] = stored;
      return next;
    });
  };

  // Inline CSS-var overrides for the preview container (defaults come from .veeey-shop).
  const previewVars = useMemo(() => {
    const style: Record<string, string> = {};
    for (const tok of THEME_TOKENS) {
      const v = vals[tok.v];
      if (!v) continue;
      style[tok.v] = tok.control === 'font' ? `'${v.replace(/['"\\;]/g, '')}', ${tok.fallback ?? 'sans-serif'}` : v;
    }
    return style as React.CSSProperties;
  }, [vals]);

  // Load any chosen Google fonts so the preview reflects them.
  const fontFams = useMemo(
    () => THEME_TOKENS.filter((t) => t.control === 'font').map((t) => vals[t.v]).filter((f): f is string => !!f && !LOCAL_FONTS.has(f)),
    [vals],
  );
  const fontKey = fontFams.join(',');
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    for (const fam of fontKey ? fontKey.split(',') : []) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
      document.head.appendChild(l);
      links.push(l);
    }
    return () => links.forEach((l) => l.remove());
  }, [fontKey]);

  const save = () => start(async () => setMsg(await saveThemeAction(themeId, vals)));
  const reset = () =>
    start(async () => {
      const r = await resetThemeTokensAction(themeId);
      if (r.ok) setVals({});
      setMsg(r);
    });

  const warnings = useMemo(() => evaluateContrast(vals).filter((w) => !w.ok), [vals]);

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(vals, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veeey-theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importTheme = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object') return;
        const next: ThemeOverrides = {};
        for (const t of THEME_TOKENS) {
          const v = (parsed as Record<string, unknown>)[t.v];
          if (typeof v === 'string' && v.trim()) next[t.v] = v.trim();
        }
        setVals(next);
        setMsg(null);
      } catch {
        setMsg({ ok: false });
      }
    };
    reader.readAsText(file);
  };

  const grouped = THEME_GROUPS.map((g) => {
    const items = THEME_TOKENS.filter((t) => t.group === g);
    const subs = Array.from(new Set(items.map((t) => t.sub ?? '')));
    return { g, subs: subs.map((s) => ({ s, items: items.filter((t) => (t.sub ?? '') === s) })) };
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(340px,400px)]">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportTheme} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
            {tb('Export JSON', 'تصدير JSON')}
          </button>
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">
            {tb('Import JSON', 'استيراد JSON')}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importTheme(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {grouped.map(({ g, subs }) => (
          <section key={g}>
            <h2 className="mb-3 font-heading text-lg font-semibold">{tb(g, GROUP_AR[g])}</h2>
            <div className="space-y-5 rounded-lg border border-border p-4">
              {subs.map(({ s, items }) => (
                <div key={s || g}>
                  {s && <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s}</div>}
                  <div className="space-y-2.5">
                    {items.map((tok) => (
                      <Control key={tok.v} tok={tok} value={vals[tok.v] ?? ''} onChange={(v) => set(tok, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {pending ? tb('Saving…', 'جارٍ الحفظ…') : tb('Save theme', 'حفظ الثيم')}
          </button>
          <button onClick={reset} disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface disabled:opacity-60">
            {tb('Reset to defaults', 'استعادة الافتراضي')}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.ok ? tb('Saved.', 'تم الحفظ.') : tb('Save failed.', 'تعذّر الحفظ.')}</span>}
        </div>
      </div>

      <div className="h-fit lg:sticky lg:top-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tb('Live preview', 'معاينة حية')}</div>
        <ThemePreview style={previewVars} dir={locale === 'ar' ? 'rtl' : 'ltr'} tb={tb} />

        {warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-gold/50 bg-gold/10 p-3 text-xs">
            <div className="mb-1 font-semibold text-foreground">{tb('Contrast warnings', 'تنبيهات التباين')}</div>
            <ul className="space-y-1 text-muted-foreground">
              {warnings.map((w, i) => (
                <li key={i}>⚠ {tb(w.label[0], w.label[1])} — {w.ratio}:1 ({tb('needs', 'يتطلب')} {w.min}:1)</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Control({ tok, value, onChange }: { tok: ThemeToken; value: string; onChange: (v: string) => void }) {
  if (tok.control === 'color') {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground">{tok.label}</span>
        <span className="flex items-center gap-2">
          <input type="color" value={value || tok.def} onChange={(e) => onChange(e.target.value)} className="size-8 cursor-pointer rounded border border-border bg-transparent p-0" aria-label={tok.label} />
          <input type="text" value={value} placeholder={tok.def} onChange={(e) => onChange(e.target.value)} className={`w-24 font-mono text-xs ${inputCls}`} />
        </span>
      </label>
    );
  }
  if (tok.control === 'size') {
    return (
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground">{tok.label}</span>
        <span className="flex items-center gap-1">
          <input type="number" value={sizeNum(value)} placeholder={sizeNum(tok.def)} onChange={(e) => onChange(e.target.value)} className={`w-20 ${inputCls}`} />
          <span className="text-xs text-muted-foreground">px</span>
        </span>
      </label>
    );
  }
  const wide = tok.control === 'shadow';
  return (
    <label className={wide ? 'block text-sm' : 'flex items-center justify-between gap-3 text-sm'}>
      <span className="text-foreground">{tok.label}</span>
      <input
        type="text"
        value={value}
        placeholder={tok.def}
        onChange={(e) => onChange(e.target.value)}
        className={wide ? `mt-1 w-full font-mono text-xs ${inputCls}` : `w-44 ${inputCls}`}
      />
    </label>
  );
}

function ThemePreview({ style, dir, tb }: { style: React.CSSProperties; dir: 'ltr' | 'rtl'; tb: (en: string, ar: string) => string }) {
  return (
    <div className="veeey-shop overflow-hidden rounded-xl border border-border bg-white" style={style} dir={dir}>
      <div className="space-y-5 p-5">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--green-dark)', fontWeight: 700, fontSize: 24, margin: 0 }}>
            {tb('You Deserve More', 'تستحق المزيد')}
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: 14, marginTop: 4 }}>
            {tb('Premium wellness, imported with care.', 'صحة فاخرة، مستوردة بعناية.')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="v-btn v-btn--primary v-btn--sm">{tb('Add to Cart', 'أضف للسلة')}</button>
          <button type="button" className="v-btn v-btn--secondary v-btn--sm">{tb('Secondary', 'ثانوي')}</button>
          <button type="button" className="v-btn v-btn--dark v-btn--sm">{tb('Dark', 'داكن')}</button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="v-chip v-chip--sale">−15%</span>
          <span className="v-chip v-chip--soft">Exp 08/26</span>
          <span className="v-tier v-tier--select"><span className="v-tier__mark" aria-hidden="true">◆</span>Veeey Select</span>
        </div>

        <div className="v-card v-card--hover v-product" style={{ maxWidth: 200 }}>
          <div className="v-product__media"><span className="v-product__media-ph">Veeey</span></div>
          <div className="v-product__body">
            <span className="v-product__brand">Vital Nutrients</span>
            <h3 className="v-product__name">Marine Collagen Peptides</h3>
            <div className="v-product__meta"><span className="v-product__price">EGP 780</span></div>
          </div>
          <div className="v-product__foot">
            <button type="button" className="v-btn v-btn--primary v-btn--sm v-btn--block">{tb('Add to Cart', 'أضف للسلة')}</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['--green-dark', '--green-mid', '--green-emerald', '--lime', '--gold', '--slate', '--surface-sunk'].map((c) => (
            <span key={c} title={c} className="size-6 rounded-md border border-border" style={{ background: `var(${c})` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
