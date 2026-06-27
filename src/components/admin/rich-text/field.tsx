'use client';

import { useState } from 'react';
import { RichTextEditor } from './editor';

/** POST a file to the admin uploader and return the served URL (WebP). */
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('upload failed');
  const data = (await res.json()) as { url: string };
  return data.url;
}

/**
 * Form-ready rich-text field: the Tiptap editor plus a hidden <textarea name>
 * that always carries the current HTML, so it submits with the surrounding
 * FormData server action unchanged. Arabic fields (name ending "Ar") render RTL.
 * `compact` selects the slim toolbar and hides image upload.
 */
export function RichTextField({
  name,
  initial = '',
  placeholder,
  compact,
  dir,
}: {
  name: string;
  initial?: string;
  placeholder?: string;
  compact?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  const [html, setHtml] = useState(initial);
  const resolvedDir = dir ?? (name.endsWith('Ar') ? 'rtl' : 'ltr');
  return (
    <>
      <textarea name={name} value={html} readOnly hidden />
      <RichTextEditor
        value={initial}
        onChange={setHtml}
        placeholder={placeholder}
        compact={compact}
        dir={resolvedDir}
        name={name}
        uploadImage={compact ? undefined : uploadImage}
      />
    </>
  );
}
