import type { StoredListing } from '../types/listing.js';

export interface WebhookFilters {
  listing_type?: 'rent' | 'sale';
  district?: string;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  furnished?: boolean;
  source?: string;
  keywords_include?: string[];
  keywords_exclude?: string[];
}

export interface WebhookPayload {
  event: 'listing.new' | 'listing.price_changed';
  timestamp: string;
  listing: StoredListing;
  price_change?: {
    old_price: number;
    new_price: number;
  };
}
