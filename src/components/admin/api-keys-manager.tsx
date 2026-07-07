'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { inputCls } from '@/components/admin/ui';
import { MCP_SCOPES } from '@/lib/mcp-scopes';
import { createApiKeyAction, setApiKeyScopesAction, setApiKeyActiveAction, deleteApiKeyAction } from '@/server/ai-access-actions';

type KeyRow = { id: string; name: string; keyPrefix: string | null; scopesJson: unknown; active: boolean; lastUsedAt: Date | null; createdAt: Date };

const card = 'rounded-xl border border-border bg-card p-4';
const asScopes = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function ApiKeysManager({ keys, locale, baseUrl }: { keys: KeyRow[]; locale: string; baseUrl: string }) {
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Set<string>>(new Set(['catalog:read']));
  const [newToken, setNewToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const toggle = (set: Set<string>, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  };

  const create = () =>
    start(async () => {
      const { token } = await createApiKeyAction(name || 'AI key', [...scopes]);
      setNewToken(token);
      setName('');
      setScopes(new Set(['catalog:read']));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {/* Connect instructions */}
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-foreground">{t('Connect Claude / ChatGPT', 'اربط Claude / ChatGPT')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t(
            'Create a key below, then give your AI assistant these endpoints and send the key as a Bearer token. Writes are never applied automatically — they wait for your approval.',
            'أنشئ مفتاحًا بالأسفل، ثم زوّد مساعد الذكاء الاصطناعي بهذه النقاط وأرسل المفتاح كـ Bearer. لا تُطبَّق أي تعديلات تلقائيًا — تنتظر موافقتك.',
          )}
        </p>
        <div className="space-y-1 rounded-lg bg-surface p-3 font-mono text-xs text-foreground">
          <div>GET&nbsp;&nbsp;{baseUrl}/api/mcp/catalog</div>
          <div>POST&nbsp;{baseUrl}/api/mcp/write</div>
          <div className="text-muted-foreground">Authorization: Bearer &lt;your-key&gt;</div>
        </div>
      </section>

      {/* Create */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t('New API key', 'مفتاح API جديد')}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('Name (which model / integration)', 'الاسم (أي نموذج / تكامل)')}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude, ChatGPT…" className={inputCls} />
          </label>
          <button type="button" onClick={create} disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {t('Create key', 'إنشاء مفتاح')}
          </button>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('Scopes (what this key may do)', 'الصلاحيات (ما يمكن لهذا المفتاح فعله)')}</div>
          <div className="flex flex-wrap gap-2">
            {MCP_SCOPES.map((s) => (
              <label key={s.value} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${scopes.has(s.value) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
                <input type="checkbox" checked={scopes.has(s.value)} onChange={() => setScopes((p) => toggle(p, s.value))} />
                {t(s.labelEn, s.labelAr)}{s.write && <span className="text-[10px] text-gold">{t('approval', 'موافقة')}</span>}
              </label>
            ))}
          </div>
        </div>
        {newToken && (
          <div className="mt-4 rounded-lg border border-[color:var(--gold)] bg-gold/10 p-3">
            <div className="mb-1 text-xs font-bold text-foreground">{t('Copy this key now — it is shown only once:', 'انسخ هذا المفتاح الآن — يظهر مرة واحدة فقط:')}</div>
            <code className="block break-all rounded bg-card p-2 font-mono text-xs text-foreground">{newToken}</code>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(newToken); }} className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{t('Copy', 'نسخ')}</button>
          </div>
        )}
      </section>

      {/* List */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{t('Keys', 'المفاتيح')} ({keys.length})</h2>
        {keys.length === 0 && <p className="text-sm text-muted-foreground">{t('No keys yet.', 'لا توجد مفاتيح بعد.')}</p>}
        {keys.map((k) => {
          const kScopes = asScopes(k.scopesJson);
          const open = editing === k.id;
          return (
            <div key={k.id} className={`${card} ${!k.active ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{k.name} {!k.active && <span className="text-[11px] text-destructive">({t('revoked', 'ملغى')})</span>}</div>
                  <div className="font-mono text-xs text-muted-foreground">{k.keyPrefix ?? '—'}…</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {kScopes.length ? kScopes.map((s) => <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{s}</span>) : <span className="text-[11px] text-muted-foreground">{t('no scopes', 'بلا صلاحيات')}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">{k.lastUsedAt ? t('used', 'استُخدم') + ' ' + new Date(k.lastUsedAt).toISOString().slice(0, 10) : t('never used', 'لم يُستخدم')}</div>
                <button type="button" onClick={() => setEditing(open ? null : k.id)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">{t('Scopes', 'الصلاحيات')}</button>
                <button type="button" onClick={() => start(async () => { await setApiKeyActiveAction(k.id, !k.active); router.refresh(); })} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface">
                  {k.active ? t('Revoke', 'إلغاء') : t('Enable', 'تفعيل')}
                </button>
                <button type="button" onClick={() => { if (confirm(t('Delete this key permanently?', 'حذف هذا المفتاح نهائيًا؟'))) start(async () => { await deleteApiKeyAction(k.id); router.refresh(); }); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-destructive hover:bg-surface">
                  {t('Delete', 'حذف')}
                </button>
              </div>
              {open && (
                <ScopeEditor
                  initial={kScopes}
                  locale={locale}
                  onSave={(next) => start(async () => { await setApiKeyScopesAction(k.id, next); setEditing(null); router.refresh(); })}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ScopeEditor({ initial, locale, onSave }: { initial: string[]; locale: string; onSave: (scopes: string[]) => void }) {
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        {MCP_SCOPES.map((s) => (
          <label key={s.value} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${sel.has(s.value) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
            <input type="checkbox" checked={sel.has(s.value)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(s.value)) n.delete(s.value); else n.add(s.value); return n; })} />
            {t(s.labelEn, s.labelAr)}
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onSave([...sel])} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{t('Save scopes', 'حفظ الصلاحيات')}</button>
    </div>
  );
}
