import { describe, it, expect } from 'vitest';
import { validatePriceRange } from '../validation';

describe('validatePriceRange', () => {
  it('both undefined returns valid', () => {
    expect(validatePriceRange(undefined, undefined)).toEqual({ valid: true });
  });

  it('min only returns valid', () => {
    expect(validatePriceRange(500, undefined)).toEqual({ valid: true });
  });

  it('max only returns valid', () => {
    expect(validatePriceRange(undefined, 1000)).toEqual({ valid: true });
  });

  it('min < max returns valid', () => {
    expect(validatePriceRange(500, 1000)).toEqual({ valid: true });
  });

  it('min > max returns invalid with error message', () => {
    const result = validatePriceRange(1000, 500);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Min must be less than max');
  });

  it('negative value returns invalid', () => {
    const result = validatePriceRange(-100, 500);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/negative/i);
  });
});
