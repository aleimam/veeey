'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bulk toolbar for the To-buy list. Renders a small <form> (toolbar only); the
 * per-row checkboxes live in the table and associate to it via the HTML `form`
 * attribute. The two buttons route to distinct server actions via `formAction`
 * (Request selected at their suggested qty, or Ignore selected).
 */
export function ReorderBulkBar({
  formId,
  locale,
  back,
  tab,
  requestAction,
  ignoreAction,
  labels,
}: {
  formId: string;
  locale: string;
  back: string;
  /** Active reorder tab — sets the type of the Requests the bulk button creates (A5). */
  tab: string;
  requestAction: (fd: FormData) => void | Promise<void>;
  ignoreAction: (fd: FormData) => void | Promise<void>;
  labels: { selectAll: string; selected: string; request: string; ignore: string; requestConfirm: string; ignoreConfirm: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [allChecked, setAllChecked] = useState(false);

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

  const guard = (confirmMsg: string) => (e: React.MouseEvent) => {
    if (count === 0 || !confirm(confirmMsg)) e.preventDefault();
  };

  const btn = 'h-9 rounded-md px-4 text-sm font-medium disabled:opacity-50';
  return (
    <form id={formId} ref={formRef} className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="tab" value={tab} />
      <label className="flex items-center gap-1.5 px-1 text-sm">
        <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="size-4" />
        {labels.selectAll}
      </label>
      <span className="text-sm text-muted-foreground">{count} {labels.selected}</span>
      <div className="ms-auto flex gap-2">
        <button type="submit" formAction={requestAction} onClick={guard(labels.requestConfirm)} disabled={count === 0} className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}>
          {labels.request}
        </button>
        <button type="submit" formAction={ignoreAction} onClick={guard(labels.ignoreConfirm)} disabled={count === 0} className={`${btn} border border-border bg-card text-foreground hover:bg-muted`}>
          {labels.ignore}
        </button>
      </div>
    </form>
  );
}
