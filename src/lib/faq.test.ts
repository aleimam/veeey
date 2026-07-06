import { describe, it, expect } from 'vitest';
import { parseFaq, faqSearchText } from './faq';

describe('parseFaq', () => {
  it('splits h2 topics with h3 question/answer items', () => {
    const html =
      '<p>Welcome to our FAQ.</p>' +
      '<h2>Orders</h2><h3>How do I order?</h3><p>Add to cart and checkout.</p><h3>Can I cancel?</h3><p>Yes, before shipping.</p>' +
      '<h2>Shipping</h2><h3>How fast?</h3><p>3–6h UltraFast in Cairo.</p>';
    const faq = parseFaq(html);
    expect(faq.intro).toBe('<p>Welcome to our FAQ.</p>');
    expect(faq.count).toBe(3);
    expect(faq.topics.map((t) => t.title)).toEqual(['Orders', 'Shipping']);
    expect(faq.topics[0].items[0]).toEqual({ q: 'How do I order?', a: '<p>Add to cart and checkout.</p>' });
    expect(faq.topics[0].items[1].q).toBe('Can I cancel?');
  });

  it('supports h3 questions before any h2 (untitled topic)', () => {
    const faq = parseFaq('<h3>Is it genuine?</h3><p>Yes.</p>');
    expect(faq.count).toBe(1);
    expect(faq.topics[0].title).toBe('');
    expect(faq.topics[0].items[0].q).toBe('Is it genuine?');
  });

  it('a topic without questions becomes a single collapsible from its own text', () => {
    const faq = parseFaq('<h2>Returns</h2><p>14-day returns on sealed items.</p>');
    expect(faq.count).toBe(1);
    expect(faq.topics[0].items[0]).toEqual({ q: 'Returns', a: '<p>14-day returns on sealed items.</p>' });
  });

  it('unstructured prose yields zero items (caller falls back to plain rendering)', () => {
    const faq = parseFaq('<p>Just a big wall of text with no headings at all.</p>');
    expect(faq.count).toBe(0);
    expect(parseFaq(null).count).toBe(0);
  });

  it('handles heading attributes and strips tags inside questions', () => {
    const faq = parseFaq('<h2 class="x">Topic</h2><h3><strong>Bold q?</strong></h3><p>a</p>');
    expect(faq.topics[0].items[0].q).toBe('Bold q?');
  });
});

describe('faqSearchText', () => {
  it('lowercases and strips tags from q + a', () => {
    expect(faqSearchText({ q: 'How Fast?', a: '<p>UltraFast 3–6h</p>' })).toBe('how fast? ultrafast 3–6h');
  });
});
