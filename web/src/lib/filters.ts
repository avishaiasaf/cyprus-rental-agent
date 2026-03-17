export interface FilterChip {
  label: string;
  key: string;
}

const FILTER_LABELS: Record<string, (value: string) => string> = {
  type: (v) => v === 'rent' ? 'Rent' : v === 'sale' ? 'Sale' : v,
  district: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  property_type: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  min_price: (v) => `Min: \u20AC${v}`,
  max_price: (v) => `Max: \u20AC${v}`,
  min_bedrooms: (v) => `${v}+ beds`,
  min_bathrooms: (v) => `${v}+ baths`,
  min_area: (v) => `${v}+ m\u00B2`,
  max_area: (v) => `${v} m\u00B2 max`,
  source: (v) => `Source: ${v}`,
  furnished: (v) => v === 'true' ? 'Furnished' : 'Unfurnished',
  q: (v) => `"${v}"`,
};

// These params are not shown as filter chips
const EXCLUDED_PARAMS = new Set(['page', 'per_page', 'sort']);

export function getActiveFilterChips(
  params: Record<string, string>,
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!value || EXCLUDED_PARAMS.has(key)) continue;
    const labelFn = FILTER_LABELS[key];
    if (labelFn) {
      chips.push({ label: labelFn(value), key });
    }
  }
  return chips;
}

export function serializeFilters(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}
