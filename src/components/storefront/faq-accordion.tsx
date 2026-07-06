'use client';

import { useMemo, useState } from 'react';
import { pick } from '@/lib/admin-i18n';
import { Icon } from '@/components/storefront/ui/icon';
import { faqSearchText, type FaqTopic } from '@/lib/faq';

/**
 * Searchable FAQ accordion (audit P2 6.2): topics of <details> Q&As with a
 * live filter box. Answers arrive pre-sanitized from the server.
 */
export function FaqAccordion({ topics, locale }: { topics: FaqTopic[]; locale: string }) {
  const t = pick(locale);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return topics;
    return topics
      .map((topic) => ({ ...topic, items: topic.items.filter((it) => faqSearchText(it).includes(needle)) }))
      .filter((topic) => topic.items.length > 0);
  }, [topics, q]);

  const open = q.trim().length > 0; // searching → expand matches
  const total = filtered.reduce((s, topic) => s + topic.items.length, 0);

  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-full border border-[color:var(--slate-border)] bg-white px-4 py-2.5">
        <Icon name="search" size={18} color="var(--slate-45)" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Search the FAQ…', 'ابحث في الأسئلة الشائعة…')}
          aria-label={t('Search the FAQ', 'ابحث في الأسئلة الشائعة')}
          className="w-full border-none bg-transparent text-sm text-ink outline-none"
        />
      </div>
      {q.trim() && (
        <p className="mt-2 text-xs text-[color:var(--text-subtle)]">
          {t(`${total} matching questions`, `${total} سؤالًا مطابقًا`)}
        </p>
      )}

      {filtered.map((topic, i) => (
        <section key={`${topic.title}-${i}`} className="mt-7">
          {topic.title && <h2 className="mb-3 text-lg font-bold text-green-dark">{topic.title}</h2>}
          <div className="overflow-hidden rounded-[14px] border border-[color:var(--slate-border)] bg-white">
            {topic.items.map((item, j) => (
              <details key={j} open={open} className="group border-t border-[color:var(--slate-border)] first:border-t-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14.5px] font-semibold text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="shrink-0 transition-transform group-open:rotate-180">
                    <Icon name="chevron-down" size={16} color="var(--green-dark)" />
                  </span>
                </summary>
                <div className="veeey-rich px-4 pb-4 text-sm leading-relaxed text-[color:var(--text-body)]" dangerouslySetInnerHTML={{ __html: item.a }} />
              </details>
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="mt-7 text-sm text-[color:var(--text-muted)]">{t('No questions match your search.', 'لا توجد أسئلة مطابقة لبحثك.')}</p>
      )}
    </div>
  );
}
