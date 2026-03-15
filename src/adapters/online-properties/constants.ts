export const BASE_URL = 'https://www.onlineproperties.com.cy';

export const URLS = {
  rent: '/properties-for-rent/',
  sale: '/properties-for-sale/',
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

// CSS selectors for listing cards on index pages
export const INDEX_SELECTORS = {
  listingCard: '.property-listing, .listing-card, .property-item, .search-result, article.property',
  title: '.property-title, .listing-title, h3 a, h2 a, .title a',
  price: '.property-price, .listing-price, .price, .amount',
  link: 'a[href*="/property/"], a[href*="/properties/"], a[href*="/listing/"]',
  image: '.property-image img, .listing-image img, .thumb img',
  location: '.property-location, .listing-location, .location, .area',
  specs: '.property-details, .listing-details, .specs',
  pagination: '.pagination a, .pager a, nav.pagination a',
} as const;

// CSS selectors for detail pages
export const DETAIL_SELECTORS = {
  title: 'h1, .property-title, .listing-title',
  price: '.property-price, .price, .amount, [class*="price"]',
  location: '.property-location, .location, .breadcrumb, .area',
  description: '.property-description, .description, .listing-description',
  images: '.gallery img, .property-gallery img, .slider img, .swiper-slide img',
  features: '.property-features li, .features li, .amenities li',
  specs: '.property-details, .details-table, .specs, .key-details',
  contact: {
    name: '.agent-name, .contact-name, .realtor-name',
    phone: '.agent-phone, .contact-phone, a[href^="tel:"]',
    email: '.agent-email, .contact-email, a[href^="mailto:"]',
  },
} as const;
