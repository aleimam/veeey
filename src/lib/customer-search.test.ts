import { describe, expect, it } from 'vitest';
import { phoneSearchTerms } from '@/lib/phone';

/**
 * Phone numbers live in the database in two shapes: as the customer typed them
 * ("01012345678") and normalized for SMS ("201012345678"). A staffer searching
 * one shape must find the other, or roughly half the customers become
 * unfindable by phone — which is how most of them are looked up on the counter.
 */
describe('phoneSearchTerms', () => {
  it('finds a normalized number when the local form is typed', () => {
    expect(phoneSearchTerms('01012345678')).toEqual(['01012345678', '201012345678']);
  });

  it('finds a local number when the normalized form is typed', () => {
    expect(phoneSearchTerms('201012345678')).toEqual(['201012345678', '01012345678']);
  });

  it('handles partial numbers — staff rarely type all eleven digits', () => {
    expect(phoneSearchTerms('010123')).toEqual(['010123', '2010123']);
  });

  it('ignores spaces, dashes and a leading +', () => {
    expect(phoneSearchTerms('+20 101 234 5678')).toEqual(['201012345678', '01012345678']);
    expect(phoneSearchTerms('010-123-4567')).toEqual(['0101234567', '20101234567']);
  });

  it('treats a bare number with no country prefix as local too', () => {
    expect(phoneSearchTerms('1012345678')).toEqual(['1012345678', '201012345678']);
  });

  it('returns nothing for input too short to be a phone fragment', () => {
    // Otherwise every two-letter name search would also run three phone LIKEs.
    expect(phoneSearchTerms('ali')).toEqual([]);
    expect(phoneSearchTerms('12')).toEqual([]);
  });
});
