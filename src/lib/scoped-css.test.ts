import { describe, it, expect } from 'vitest';
import { scopeCss, extractStyleBlocks } from './scoped-css';

describe('scopeCss', () => {
  it('prefixes plain selectors with the scope', () => {
    expect(scopeCss('.box { color: red; } h2, p.note { margin: 0; }')).toBe(
      '.veeey-rich .box { color: red; }\n.veeey-rich h2, .veeey-rich p.note { margin: 0; }',
    );
  });

  it('pins html/body/:root selectors to the scope instead of leaking globally', () => {
    expect(scopeCss('body { background: black; }')).toBe('.veeey-rich { background: black; }');
    expect(scopeCss('html .x { color: red; }')).toBe('.veeey-rich .x { color: red; }');
  });

  it('recurses into @media and keeps @keyframes, drops @font-face', () => {
    const out = scopeCss('@media (max-width: 600px) { .a { display: none; } } @font-face { font-family: X; } @keyframes spin { to { transform: rotate(1turn); } }');
    expect(out).toContain('@media (max-width: 600px) { .veeey-rich .a { display: none; } }');
    expect(out).not.toContain('@font-face');
    expect(out).toContain('@keyframes spin');
  });

  it('refuses css containing forbidden constructs', () => {
    expect(scopeCss('@import url(evil.css); .a { color: red; }')).toBe('');
    expect(scopeCss('.a { behavior: url(x.htc); }')).toBe('');
    expect(scopeCss('.a { background: url(javascript:alert(1)); }')).toBe('');
  });

  it('neutralizes non-http url() targets and strips <', () => {
    const out = scopeCss('.a { background: url(ftp://x/y.png); content: "</style>"; }');
    expect(out).toContain('none');
    expect(out).not.toContain('<');
  });
});

describe('extractStyleBlocks', () => {
  it('pulls style blocks out and leaves the rest', () => {
    const { css, html } = extractStyleBlocks('<style>.a{color:red}</style><p>hi</p><style media="x">.b{}</style>');
    expect(css).toContain('.a{color:red}');
    expect(css).toContain('.b{}');
    expect(html).toBe('<p>hi</p>');
  });

  it('is a no-op without style blocks', () => {
    const { css, html } = extractStyleBlocks('<p>hi</p>');
    expect(css).toBe('');
    expect(html).toBe('<p>hi</p>');
  });
});
