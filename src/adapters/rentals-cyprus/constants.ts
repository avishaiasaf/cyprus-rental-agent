export const BASE_URL = 'https://www.rentalscyprus.com';

export const URLS = {
  rent: '/rentals/',
  sale: '/sales/',
} as const;

export function buildFilteredUrl(
  listingType: 'rent' | 'sale',
  page: number,
  opts?: {
    propertyType?: string;
    district?: string;
  },
): string {
  let path = listingType === 'rent' ? URLS.rent : URLS.sale;

  const params = new URLSearchParams();

  if (opts?.propertyType && opts.propertyType !== 'any') {
    const typeMap: Record<string, string> = {
      apartment: 'apartment',
      house: 'house',
      villa: 'villa',
      studio: 'studio',
      land: 'land',
      commercial: 'commercial',
    };
    if (typeMap[opts.propertyType]) {
      params.set('type', typeMap[opts.propertyType]);
    }
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const qs = params.toString();
  return qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`;
}

// CSS selectors for listing cards
export const INDEX_SELECTORS = {
  listingCard: '.property-listing, .listing-card, .property-item, .rental-item, article.listing',
  title: '.property-title, .listing-title, h3 a, h2 a, .rental-title a',
  price: '.property-price, .listing-price, .price, .rental-price',
  link: 'a[href*="/rental/"], a[href*="/property/"], a[href*="/listing/"]',
  image: '.property-image img, .listing-image img, .rental-image img, .thumb img',
  location: '.property-location, .listing-location, .rental-location, .location',
  specs: '.property-details, .listing-details, .rental-details, .specs',
  pagination: '.pagination a, .pager a, nav.pagination a',
} as const;

// CSS selectors for detail pages
export const DETAIL_SELECTORS = {
  title: 'h1, .property-title, .listing-title, .rental-title',
  price: '.property-price, .price, .rental-price, [class*="price"]',
  location: '.property-location, .location, .breadcrumb, .rental-location',
  description: '.property-description, .description, .rental-description',
  images: '.gallery img, .property-gallery img, .slider img, .swiper-slide img',
  features: '.property-features li, .features li, .amenities li, .rental-features li',
  specs: '.property-details, .details-table, .specs, .key-details',
  contact: {
    name: '.agent-name, .contact-name, .owner-name',
    phone: '.agent-phone, .contact-phone, a[href^="tel:"]',
    email: '.agent-email, .contact-email, a[href^="mailto:"]',
  },
} as const;
