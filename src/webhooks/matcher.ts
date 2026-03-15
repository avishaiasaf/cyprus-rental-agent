import type { StoredListing } from '../types/listing.js';
import type { WebhookFilters } from './types.js';

/**
 * Check if a listing matches the filter criteria of a webhook subscription.
 */
export function matchesWebhookFilters(listing: StoredListing, filters: WebhookFilters): boolean {
  if (filters.listing_type && listing.listing_type !== filters.listing_type) {
    return false;
  }

  if (filters.district && listing.district !== filters.district) {
    return false;
  }

  if (filters.property_type && listing.property_type !== filters.property_type) {
    return false;
  }

  const price = listing.price != null ? Number(listing.price) : null;

  if (filters.min_price != null && (price === null || price < filters.min_price)) {
    return false;
  }

  if (filters.max_price != null && (price === null || price > filters.max_price)) {
    return false;
  }

  if (filters.min_bedrooms != null && (listing.bedrooms == null || listing.bedrooms < filters.min_bedrooms)) {
    return false;
  }

  if (filters.max_bedrooms != null && (listing.bedrooms == null || listing.bedrooms > filters.max_bedrooms)) {
    return false;
  }

  if (filters.furnished != null && listing.furnished !== filters.furnished) {
    return false;
  }

  if (filters.source && listing.source !== filters.source) {
    return false;
  }

  // Keyword filters
  const text = `${listing.title} ${listing.description ?? ''} ${listing.location ?? ''}`.toLowerCase();

  if (filters.keywords_include && filters.keywords_include.length > 0) {
    const hasAny = filters.keywords_include.some(kw => text.includes(kw.toLowerCase()));
    if (!hasAny) return false;
  }

  if (filters.keywords_exclude && filters.keywords_exclude.length > 0) {
    const hasAny = filters.keywords_exclude.some(kw => text.includes(kw.toLowerCase()));
    if (hasAny) return false;
  }

  return true;
}
