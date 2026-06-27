import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize admin/migration-authored rich HTML (product descriptions) before it's
 * rendered with dangerouslySetInnerHTML. Allows common formatting + images +
 * inline class/style (migrated WooCommerce content uses styled boxes), but strips
 * scripts, event handlers, iframes/forms, and javascript: URLs. Plain text passes
 * through unchanged, so manually-typed descriptions are unaffected.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'span', 'div', 'a', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'hr',
      'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'dir'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}

/** True if there's renderable content after sanitizing (ignores empty tags/whitespace). */
export function hasRichContent(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0 || /<img\b/i.test(html);
}

/**
 * Flatten rich HTML to a single plain-text line — for contexts that must NOT
 * contain markup: meta descriptions, product/feed descriptions, list-card
 * excerpts. Strips every tag and collapses whitespace.
 */
export function richToText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
