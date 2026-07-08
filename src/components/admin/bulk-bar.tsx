'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Bulk-action toolbar for admin lists. Renders a small <form> (toolbar only); the
 * per-row checkboxes live in the table and associate to it via the HTML `form`
 * attribute (so we avoid invalid nested forms and keep per-row action forms).
 * Selecting an op + value and pressing Apply submits {ids[], op, value} to the
 * entity's bulk server action. "Export selected" navigates to the CSV route with
 * the checked ids instead.
 */
export type BulkOp = {
  value: string;
  label: string;
  values?: { value: string; label: string }[];
  /** Free-form value input instead of a select (e.g. bulk price amount). */
  input?: { placeholder: string; step?: string };
  danger?: boolean;
  /** Stronger guard for danger ops: user must type the selected count to proceed. */
  typedConfirm?: boolean;
  /** Op-specific confirmation text (also applies to non-danger ops like Archive). */
  confirm?: string;
};

const selCls = 'h-9 rounded-md border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring';

function ApplyButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
      {pending ? '…' : label}
    </button>
  );
}

export function BulkBar({
  formId,
  action,
  locale,
  back,
  ops,
  exportHref,
  hidden,
  labels,
}: {
  formId: string;
  action: (fd: FormData) => void | Promise<void>;
  locale: string;
  back: string;
  ops: BulkOp[];
  exportHref?: string;
  hidden?: Record<string, string>;
  labels: { selectAllPage: string; selected: string; apply: string; exportSel: string; confirmDanger: string; needValue: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [allChecked, setAllChecked] = useState(false);
  const [op, setOp] = useState(ops[0]?.value ?? '');

  const boxes = useCallback((): HTMLInputElement[] => {
    const f = formRef.current;
    if (!f) return [];
    return Array.from(f.elements).filter((e): e is HTMLInputElement => e instanceof HTMLInputElement && e.name === 'ids');
  }, []);
  const recount = useCallback(() => {
    const bs = boxes();
    const checked = bs.filter((b) => b.checked).length;
    setCount(checked);
    setAllChecked(bs.length > 0 && checked === bs.length);
  }, [boxes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.name === 'ids') recount();
    };
    document.addEventListener('change', handler);
    return () => document.removeEventListener('change', handler);
  }, [recount]);

  const toggleAll = (checked: boolean) => {
    boxes().forEach((b) => { b.checked = checked; });
    recount();
  };

  const current = ops.find((o) => o.value === op);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (count === 0) { e.preventDefault(); return; }
    if (current?.values || current?.input) {
      const sel = e.currentTarget.elements.namedItem('value');
      if ((sel instanceof HTMLSelectElement || sel instanceof HTMLInputElement) && !sel.value) { e.preventDefault(); alert(labels.needValue); return; }
    }
    if (current?.danger && current.typedConfirm) {
      // Catalog-size guard: the user must type the selected count to proceed.
      const typed = prompt(`${current.confirm ?? labels.confirmDanger}\n\n→ ${count}`);
      if (typed !== String(count)) { e.preventDefault(); return; }
      return;
    }
    const msg = current?.confirm ?? (current?.danger ? labels.confirmDanger : undefined);
    if (msg && !confirm(msg)) e.preventDefault();
  };

  const exportSelected = () => {
    if (!exportHref) return;
    const ids = boxes().filter((b) => b.checked).map((b) => b.value);
    if (!ids.length) return;
    const sep = exportHref.includes('?') ? '&' : '?';
    window.location.href = `${exportHref}${sep}${ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&')}`;
  };

  return (
    <form id={formId} ref={formRef} action={action} onSubmit={onSubmit} className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value={back} />
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="flex items-center gap-1.5 px-1 text-sm">
        <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="size-4" />
        {labels.selectAllPage}
      </label>
      <span className="text-sm text-muted-foreground">{count} {labels.selected}</span>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <select name="op" value={op} onChange={(e) => setOp(e.target.value)} className={selCls} aria-label="action">
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {current?.values && (
        <select key={op} name="value" defaultValue="" className={selCls} aria-label="value">
          <option value="" disabled>—</option>
          {current.values.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      )}
      {current?.input && (
        <input key={`${op}-in`} name="value" type="number" step={current.input.step ?? 'any'} placeholder={current.input.placeholder} className={`${selCls} w-40`} aria-label="value" />
      )}
      <ApplyButton disabled={count === 0} label={labels.apply} />
      {exportHref && (
        <button type="button" onClick={exportSelected} disabled={count === 0} className="h-9 rounded-md border border-border px-3 text-sm hover:bg-surface disabled:opacity-50">
          {labels.exportSel}
        </button>
      )}
    </form>
  );
}
