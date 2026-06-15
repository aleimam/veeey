'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';

/**
 * Drag / drop / paste / pick image uploader (FR-CAT-06). Posts each file to
 * /api/admin/upload (server converts to WebP) and keeps the returned URLs as
 * hidden `imageUrls` inputs so they submit with the product form.
 */
export function ImageUploader({ initial = [] }: { initial?: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tb = pick(useLocale());

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        setUrls((u) => [...u, url]);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => f.type.startsWith('image/') && upload(f));
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onPaste={(e) => handleFiles(e.clipboardData.files)}
        className="flex h-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground"
      >
        {busy ? tb('Uploading…', 'جارٍ الرفع…') : tb('Drag, paste, or click to add images', 'اسحب أو الصق أو انقر لإضافة صور')}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {urls.map((u) => (
            <div key={u} className="relative">
              <Image
                src={u}
                alt=""
                width={72}
                height={72}
                unoptimized
                className="size-18 rounded-md border border-border object-cover"
              />
              <input type="hidden" name="imageUrls" value={u} />
              <button
                type="button"
                onClick={() => setUrls((list) => list.filter((x) => x !== u))}
                className="absolute -end-2 -top-2 size-5 rounded-full bg-destructive text-xs text-white"
                aria-label={tb('Remove image', 'إزالة الصورة')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single-image uploader for one named field (e.g. brand logo / banner). Posts to
 * /api/admin/upload and keeps the chosen URL in a hidden input `name`.
 */
export function SingleImageUploader({ name, initial = '' }: { name: string; initial?: string }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tb = pick(useLocale());

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        setUrl(data.url);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith('image/')) upload(f); }}
          onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f?.type.startsWith('image/')) upload(f); }}
          className="flex h-20 flex-1 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-muted-foreground"
        >
          {busy ? tb('Uploading…', 'جارٍ الرفع…') : url ? tb('Click to replace', 'انقر للاستبدال') : tb('Drag, paste, or click to upload', 'اسحب أو الصق أو انقر للرفع')}
        </div>
        {url && (
          <div className="relative">
            <Image src={url} alt="" width={80} height={80} unoptimized className="size-20 rounded-md border border-border object-cover" />
            <button type="button" onClick={() => setUrl('')} className="absolute -end-2 -top-2 size-5 rounded-full bg-destructive text-xs text-white" aria-label={tb('Remove image', 'إزالة الصورة')}>×</button>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}
