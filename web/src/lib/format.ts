/**
 * Formats a price for display.
 */
export function formatPrice(
  price: number | null,
  currency: string,
  listingType: string,
): string {
  if (price == null) return 'Price on request';
  const symbol = currency === 'EUR' ? '\u20AC' : currency;
  const suffix = listingType === 'rent' ? '/mo' : '';
  return `${symbol}${price.toLocaleString()}${suffix}`;
}

/**
 * Strips HTML tags from location and normalizes whitespace.
 */
export function sanitizeLocation(location: string): string {
  if (!location) return '';
  return location
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a listing is "new" based on first_seen_at timestamp.
 */
export function isNewListing(firstSeenAt: string, hoursThreshold = 48): boolean {
  if (!firstSeenAt) return false;
  const seen = new Date(firstSeenAt).getTime();
  const now = Date.now();
  const diffHours = (now - seen) / (1000 * 60 * 60);
  return diffHours <= hoursThreshold;
}

/**
 * Returns Tailwind color classes for a source badge.
 */
export function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    bazaraki: 'bg-orange-100 text-orange-700',
    'facebook-groups': 'bg-blue-100 text-blue-700',
    telegram: 'bg-sky-100 text-sky-700',
    propertycloud: 'bg-emerald-100 text-emerald-700',
    altamira: 'bg-violet-100 text-violet-700',
    rightmove: 'bg-green-100 text-green-700',
    buyincy: 'bg-rose-100 text-rose-700',
    cyprusproperties: 'bg-amber-100 text-amber-700',
  };
  return colors[source] ?? 'bg-gray-100 text-gray-600';
}
