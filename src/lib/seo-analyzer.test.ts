import { describe, it, expect } from 'vitest';
import { analyzeSeo, normalizeText, htmlToText, titlePixels, type SeoInput } from './seo-analyzer';

const GOOD: SeoInput = {
  keyword: 'vitamin d3',
  title: 'Vitamin D3 5000 IU — Premium Imported Supplement',
  metaDesc: 'Buy Vitamin D3 5000 IU imported from the USA. Supports bones, immunity and mood. Genuine, expiry-shown supplements delivered fast across Egypt by Veeey.',
  slug: 'vitamin-d3-5000-iu',
  contentHtml: `
    <p>Vitamin D3 is the sunshine vitamin your body needs. It supports bones and immunity.</p>
    <h2>Why choose our Vitamin D3</h2>
    <p>${'Great quality product with proven benefits. '.repeat(40)}</p>
    <p>See our <a href="/en/products">other products</a> and this <a href="https://pubmed.gov/x">study</a>.</p>
    <img src="/x.jpg" alt="Vitamin D3 bottle" />
  `,
  imageAlts: [],
};

describe('analyzeSeo', () => {
  it('scores a well-optimized product high with all keyword checks passing', () => {
    const r = analyzeSeo(GOOD);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.grade).toBe('good');
    for (const id of ['kw_title', 'kw_meta', 'kw_slug', 'kw_first_para', 'kw_subheading', 'kw_alt', 'links']) {
      expect(r.checks.find((c) => c.id === id)?.status, id).toBe('pass');
    }
  });

  it('fails keyword checks when no focus keyword is set', () => {
    const r = analyzeSeo({ ...GOOD, keyword: '' });
    expect(r.checks.find((c) => c.id === 'kw_title')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'kw_title')?.detail).toContain('focus keyword');
    expect(r.score).toBeLessThan(50);
  });

  it('flags empty title/meta as fail and short content as fail', () => {
    const r = analyzeSeo({ keyword: 'x', title: '', metaDesc: '', slug: 'x', contentHtml: '<p>tiny</p>' });
    expect(r.checks.find((c) => c.id === 'title_len')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'meta_len')?.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'content_len')?.status).toBe('fail');
    expect(r.grade).toBe('poor');
  });

  it('detects keyword stuffing', () => {
    const stuffed = `<p>${'omega 3 '.repeat(60)}</p>`;
    const r = analyzeSeo({ keyword: 'omega 3', title: 'Omega 3', metaDesc: 'Omega 3', slug: 'omega-3', contentHtml: stuffed });
    expect(r.checks.find((c) => c.id === 'density')?.status).toBe('fail');
  });

  it('handles Arabic keywords with normalization (alef forms + tashkeel)', () => {
    const r = analyzeSeo({
      keyword: 'فيتامين أ',
      title: 'فيتامين ا للمناعة — منتج أصلي',
      metaDesc: 'اشترِ فِيتامِين ا الأصلي من فيي.',
      slug: encodeURIComponent('فيتامين-ا'),
      contentHtml: '<p>فيتامين ا مفيد جدًا للجسم والمناعة.</p><h2>فوائد فيتامين ا</h2>',
    });
    expect(r.checks.find((c) => c.id === 'kw_title')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'kw_meta')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'kw_slug')?.status).toBe('pass');
    expect(r.checks.find((c) => c.id === 'kw_subheading')?.status).toBe('pass');
  });

  it('weights sum to 100 and score never exceeds it', () => {
    const r = analyzeSeo(GOOD);
    expect(r.checks.reduce((n, c) => n + c.weight, 0)).toBe(100);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('helpers', () => {
  it('normalizeText unifies Arabic forms', () => {
    expect(normalizeText('أَحْمَد')).toBe('احمد');
    expect(normalizeText('مصطفى')).toBe('مصطفي');
  });
  it('htmlToText strips tags and style blocks', () => {
    expect(htmlToText('<style>.a{}</style><p>Hi <b>there</b></p>')).toBe('Hi there');
  });
  it('titlePixels grows with text and counts wide chars more', () => {
    expect(titlePixels('WWW')).toBeGreaterThan(titlePixels('iii'));
    expect(titlePixels('')).toBe(0);
  });
});
