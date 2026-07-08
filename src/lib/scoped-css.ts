/**
 * Scope + sanitize author-supplied CSS from description <style> blocks so it
 * only applies inside the rich-content container (default `.veeey-rich`) and
 * can't leak to the rest of the page or smuggle active content. Pure — unit
 * tested. Conservative by design: unknown at-rules are dropped.
 */

const FORBIDDEN = /(@import|@charset|@namespace|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:)/i;

/** Strip comments + dangerous constructs; drop url() with non-safe schemes. */
function cleanCss(css: string): string {
  let out = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // '<' is never valid in CSS outside strings — stripping it prevents breaking
  // out of the <style> element ('>' stays: it's the child combinator).
  out = out.replace(/</g, '');
  // Neutralize url(...) unless http(s) or an inline image.
  out = out.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (_m, _q, target: string) => {
    const t = target.trim().toLowerCase();
    return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:image/') || t.startsWith('/') ? `url("${target.trim()}")` : 'none';
  });
  return out;
}

/** Prefix every selector of `rule` ("a, .b:hover") with the scope. */
function scopeSelectors(selectors: string, scope: string): string {
  return selectors
    .split(',')
    .map((s) => {
      const sel = s.trim();
      if (!sel) return '';
      // Author writing the scope themselves (or :root/html/body) → pin to scope.
      if (sel === scope || /^(:root|html|body)$/i.test(sel)) return scope;
      return `${scope} ${sel.replace(/^(html|body)\s+/i, '')}`;
    })
    .filter(Boolean)
    .join(', ');
}

/** Split a css block into top-level chunks: rules and at-rule blocks. */
function scopeBlock(css: string, scope: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf('{', i);
    if (brace === -1) break;
    const head = css.slice(i, brace).trim();
    // Find the matching closing brace for this block.
    let depth = 1;
    let j = brace + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(brace + 1, j - 1).trim();
    if (head.startsWith('@')) {
      if (/^@(media|supports|container)\b/i.test(head)) {
        const inner = scopeBlock(body, scope);
        if (inner.trim()) out.push(`${head} { ${inner} }`);
      } else if (/^@keyframes\b/i.test(head)) {
        out.push(`${head} { ${body} }`); // keyframe steps have no selectors to scope
      }
      // other at-rules (@font-face, @page, …) are dropped
    } else if (head) {
      const scoped = scopeSelectors(head, scope);
      if (scoped) out.push(`${scoped} { ${body} }`);
    }
    i = j;
  }
  return out.join('\n');
}

/** Sanitize + scope a CSS string. Returns '' if anything forbidden is present. */
export function scopeCss(css: string, scope = '.veeey-rich'): string {
  if (!css || !css.trim()) return '';
  if (FORBIDDEN.test(css)) return ''; // refuse wholesale rather than guess
  return scopeBlock(cleanCss(css), scope).trim();
}

/** Pull <style> blocks out of an HTML string. Returns the css + remaining html. */
export function extractStyleBlocks(html: string): { css: string; html: string } {
  let css = '';
  const rest = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_m, inner: string) => {
    css += `${inner}\n`;
    return '';
  });
  return { css, html: rest };
}
