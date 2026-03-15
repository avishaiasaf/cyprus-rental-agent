export interface ListingImage {
  url: string;
  localPath?: string;
  order: number;
}

export interface RawListing {
  externalId: string;
  source: string;
  url: string;
  title: string;
  listingType: 'rent' | 'sale';
  price: number | null;
  currency: string;
  pricePerSqm?: number | null;
  location: string;
  district?: string;
  propertyType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  furnished?: boolean | null;
  description?: string;
  images: ListingImage[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  agencyName?: string;
  listingDate?: Date | null;
  amenities?: string[];
  raw?: Record<string, unknown>;
}

export interface StoredListing {
  id: number;
  source: string;
  external_id: string;
  url: string;
  title: string;
  listing_type: 'rent' | 'sale';
  price: number | null;
  currency: string;
  price_per_sqm: number | null;
  location: string | null;
  district: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  furnished: boolean | null;
  description: string | null;
  images: any; // JSONB - parsed by pg driver
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  agency_name: string | null;
  listing_date: string | null;
  amenities: any; // JSONB - parsed by pg driver
  raw_data: any; // JSONB - parsed by pg driver
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  notified_at: string | null;
  telegram_message_id: number | null;
}

export interface PriceChange {
  listingId: number;
  oldPrice: number;
  newPrice: number;
  detectedAt: string;
}
