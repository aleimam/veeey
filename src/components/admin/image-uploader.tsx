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
