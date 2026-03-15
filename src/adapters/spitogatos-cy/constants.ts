export const BASE_URL = 'https://www.spitogatos.com.cy';

export const URLS = {
  rent: '/en/rentals/',
  sale: '/en/sale/',
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

  // Spitogatos uses path segments for property type
  if (opts?.propertyType && opts.propertyType !== 'any') {
    const typeMap: Record<string, string> = {
      apartment: 'apartments',
      house: 'houses',
      villa: 'villas',
      studio: 'studios',
      land: 'land',
      commercial: 'commercial-properties',
    };
    if (typeMap[opts.propertyType]) {
      path += `${typeMap[opts.propertyType]}/`;
    }
  }

  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', String(page));
  }

  const qs = params.toString();
  return qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`;
}

// CSS selectors — Spitogatos uses React SPA with data-loaded cards
export const INDEX_SELECTORS = {
  listingCard: '.property-card, .listing-item, article[data-id], .search-result-item, .result-card',
  title: '.property-card__title, .listing-title, h3 a, h2 a',
  price: '.property-card__price, .listing-price, .price',
  link: 'a[href*="/property/"], a[href*="/listing/"], a[href*="/en/"]',
  image: '.property-card__image img, .listing-image img',
  location: '.property-card__location, .listing-location, .location',
  specs: '.property-card__specs, .listing-specs',
  pagination: '.pagination a, .pager a, [class*="pagination"] a',
} as const;

export const DETAIL_SELECTORS = {
  title: 'h1, .property-title, .listing-title',
  price: '.property-price, .listing-price, .price-main, [class*="price"]',
  location: '.property-location, .breadcrumb, .listing-location',
  description: '.property-description, .listing-description, .description',
  images: '.gallery img, .property-gallery img, .swiper-slide img, [class*="gallery"] img',
  features: '.property-features li, .listing-features li, .amenities li',
  specs: '.property-specs, .listing-specs, .specs-table, [class*="detail"]',
  contact: {
    name: '.agent-name, .contact-name, .owner-name',
    phone: '.agent-phone, .contact-phone, a[href^="tel:"]',
    email: '.agent-email, a[href^="mailto:"]',
  },
} as const;
