import { describe, it, expect } from 'vitest';
import { serializeFilters, getActiveFilterChips } from '../filters';

describe('serializeFilters', () => {
  it('converts filter object to URLSearchParams string', () => {
    const result = serializeFilters({ type: 'rent', district: 'limassol' });
    expect(result).toContain('type=rent');
    expect(result).toContain('district=limassol');
  });
});

describe('getActiveFilterChips', () => {
  it('returns chip descriptors for each active param', () => {
    const chips = getActiveFilterChips({ type: 'rent', min_price: '500' });
    expect(chips).toEqual([
      { label: 'Rent', key: 'type' },
      { label: 'Min: \u20AC500', key: 'min_price' },
    ]);
  });

  it('returns empty array when no filters active', () => {
    expect(getActiveFilterChips({})).toEqual([]);
    expect(getActiveFilterChips({ sort: 'newest' })).toEqual([]);
  });
});
