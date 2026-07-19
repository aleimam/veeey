import { describe, it, expect } from 'vitest';
import { attributeNameFor } from './taxonomy-enrich';

describe('attributeNameFor', () => {
  it('humanizes pa_ taxonomies', () => {
    expect(attributeNameFor('pa_ingredients')).toBe('Ingredients');
    expect(attributeNameFor('pa_primary-concern')).toBe('Primary Concern');
    expect(attributeNameFor('pa_imported-from')).toBe('Imported From');
  });
  it('special-cases the cryptic ones', () => {
    expect(attributeNameFor('pa_conc')).toBe('Concentration');
    expect(attributeNameFor('pa_unit')).toBe('Unit');
    expect(attributeNameFor('pa_age-gender')).toBe('Age / Gender');
  });
});
