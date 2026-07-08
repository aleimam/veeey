'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle, Color, FontSize, FontFamily } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Quote,
  Link2, ImagePlus, Table as TableIcon, Undo2, Redo2, RemoveFormatting,
  Highlighter, Baseline, Plus, Minus, Trash2, Code2,
} from 'lucide-react';

/**
 * Shared Veeey rich-text editor (Tiptap v3). Takes an HTML string and emits HTML
 * via onChange; the host wraps it with a hidden field so it submits with the form
 * (see RichTextField). Output is sanitized server-side before render. The full
 * toolbar (headings, font family + size, alignment, colour + highlight, lists,
 * quote, link, image upload, tables) shows on EVERY field; `compact` only makes
 * the editing box shorter for naturally-short fields.
 */
export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Shorter editing box for short fields. The toolbar is the same (full) either way. */
  compact?: boolean;
  dir?: 'ltr' | 'rtl';
  /** Field name; lets external actions (e.g. AI translate) push content via a `veeey:rich-set` event. */
  name?: string;
  uploadImage?: (file: File) => Promise<string>;
}

const ICON = 15;

function Btn({ active, disabled, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm disabled:opacity-40 ${active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface'}`}
    >
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;
const FONT_SIZES = ['13px', '16px', '20px', '26px', '34px'];
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Font', value: '' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Playfair Display', value: '"Playfair Display", serif' },
  { label: 'Cairo (Arabic)', value: 'Cairo, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

function Toolbar({ editor, uploadImage, extra }: { editor: Editor; uploadImage?: (f: File) => Promise<string>; extra?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const inTable = editor.isActive('table');
  const textColor = (editor.getAttributes('textStyle').color as string) || '#33424f';
  const hlColor = (editor.getAttributes('highlight').color as string) || '#fff3a3';
  const fontSize = (editor.getAttributes('textStyle').fontSize as string) || '';
  const fontFamily = (editor.getAttributes('textStyle').fontFamily as string) || '';

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().toggleLink({ href: url }).run();
  };
  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadImage) return;
    setBusy(true);
    try {
      const src = await uploadImage(file);
      if (src) editor.chain().focus().setImage({ src }).run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-card p-1.5">
      <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={ICON} /></Btn>
      <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={ICON} /></Btn>
      <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={ICON} /></Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={ICON} /></Btn>

      <Sep />
      <Btn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={ICON} /></Btn>
      <Btn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={ICON} /></Btn>
      <Btn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={ICON} /></Btn>
      <select
        title="Font family"
        value={fontFamily}
        className="h-8 max-w-[8.5rem] rounded bg-transparent px-1 text-sm text-foreground hover:bg-surface"
        onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontFamily(v).run(); else editor.chain().focus().unsetFontFamily().run(); }}
      >
        {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select
        title="Font size"
        value={fontSize}
        className="h-8 rounded bg-transparent px-1 text-sm text-foreground hover:bg-surface"
        onChange={(e) => { const v = e.target.value; if (v) editor.chain().focus().setFontSize(v).run(); else editor.chain().focus().unsetFontSize().run(); }}
      >
        <option value="">Size</option>{FONT_SIZES.map((s) => <option key={s} value={s}>{parseInt(s, 10)}</option>)}
      </select>
      <Sep />
      <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={ICON} /></Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={ICON} /></Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={ICON} /></Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify size={ICON} /></Btn>
      <Sep />
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded hover:bg-surface" title="Text colour">
        <Baseline size={ICON} style={{ color: textColor }} />
        <input type="color" value={textColor} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded hover:bg-surface" title="Highlight">
        <Highlighter size={ICON} style={{ color: hlColor }} />
        <input type="color" value={hlColor} onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
      </label>
      <Btn title="Clear highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}>H×</Btn>

      <Sep />
      <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={ICON} /></Btn>
      <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={ICON} /></Btn>
      <Btn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={ICON} /></Btn>
      <Btn title="Link" active={editor.isActive('link')} onClick={setLink}><Link2 size={ICON} /></Btn>

      {uploadImage && (
        <label className="relative inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded text-sm hover:bg-surface" title="Insert image">
          {busy ? '…' : <ImagePlus size={ICON} />}
          <input type="file" accept="image/*" disabled={busy} onChange={onImage} className="absolute inset-0 cursor-pointer opacity-0" tabIndex={-1} />
        </label>
      )}
      <Btn title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={ICON} /></Btn>
      {inTable && (<>
        <Sep />
        <Btn title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}><Plus size={12} />|</Btn>
        <Btn title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}><Minus size={12} />|</Btn>
        <Btn title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}><Plus size={12} />—</Btn>
        <Btn title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}><Minus size={12} />—</Btn>
        <Btn title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>⤒</Btn>
        <Btn title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 size={ICON} /></Btn>
      </>)}

      <Sep />
      <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={ICON} /></Btn>
      <Btn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={ICON} /></Btn>
      <Btn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={ICON} /></Btn>
      {extra}
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder = 'Start writing…', compact, dir = 'ltr', name, uploadImage }: RichTextEditorProps) {
  // </> Code mode: raw HTML source editing. The raw text is the source of truth
  // while active — it is NOT round-tripped through Tiptap, so hand-written HTML
  // (inline CSS, <style> blocks) survives saving as long as you stay in code
  // mode. Switching back to Visual parses it (Tiptap may simplify custom markup).
  const [codeMode, setCodeMode] = useState(false);
  const [raw, setRaw] = useState(value || '');

  const extensions = useMemo(() => [
    StarterKit,
    TableKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle, Color, FontSize, FontFamily,
    Highlight.configure({ multicolor: true }),
    Image.configure({ inline: false }),
    Placeholder.configure({ placeholder }),
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        dir,
        class: `veeey-rich ${compact ? 'min-h-[120px]' : 'min-h-[300px]'} px-4 py-3 focus:outline-none`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Let external actions (e.g. AI "Translate to Arabic") push content in.
  useEffect(() => {
    if (!editor || !name) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string; html: string }>).detail;
      if (!detail || detail.name !== name) return;
      setRaw(detail.html || '');
      editor.commands.setContent(detail.html || '');
      onChange(codeMode ? detail.html || '' : editor.getHTML());
    };
    window.addEventListener('veeey:rich-set', handler);
    return () => window.removeEventListener('veeey:rich-set', handler);
  }, [editor, name, onChange, codeMode]);

  const toggleCode = () => {
    if (!editor) return;
    if (!codeMode) {
      setRaw(editor.getHTML());
      setCodeMode(true);
    } else {
      if (/<style\b/i.test(raw) && !confirm('Visual mode may simplify custom HTML and removes <style> blocks from the visual view. Your code is kept only if you save from Code mode. Switch to Visual?')) return;
      editor.commands.setContent(raw);
      setCodeMode(false);
      onChange(editor.getHTML());
    }
  };

  if (!editor) return <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {codeMode ? (
        <div className="flex items-center justify-between border-b border-border bg-card p-1.5">
          <span className="px-2 text-xs text-muted-foreground">HTML source — inline CSS + scoped &lt;style&gt; allowed (sanitized on render)</span>
          <Btn title="Back to visual editor" active onClick={toggleCode}><Code2 size={ICON} /></Btn>
        </div>
      ) : (
        <Toolbar editor={editor} uploadImage={uploadImage} extra={<><Sep /><Btn title="Edit HTML source" onClick={toggleCode}><Code2 size={ICON} /></Btn></>} />
      )}
      {codeMode ? (
        <textarea
          value={raw}
          onChange={(e) => { setRaw(e.target.value); onChange(e.target.value); }}
          dir="ltr"
          spellCheck={false}
          className={`${compact ? 'min-h-[160px]' : 'min-h-[340px]'} w-full resize-y bg-[#0f172a] p-4 font-mono text-[13px] leading-relaxed text-emerald-100 outline-none`}
          aria-label="HTML source"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
