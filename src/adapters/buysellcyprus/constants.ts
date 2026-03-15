export const BASE_URL = 'https://www.buysellcyprus.com';

export const URLS = {
  rent: '/real-estate/for-rent/',
  sale: '/real-estate/for-sale/',
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

  // BuySellCyprus uses query params for property type
  const params = new URLSearchParams();

  if (opts?.propertyType && opts.propertyType !== 'any') {
    const typeMap: Record<string, string> = {
      apartment: 'apartments',
      house: 'houses',
      villa: 'villas',
      studio: 'apartments',
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

// CSS selectors for listing cards on index/catalog pages
export const INDEX_SELECTORS = {
  listingCard: '.listing-card, .property-card, .ad-item, .classified-item, article.listing',
  title: '.listing-title, .property-title, h3 a, h2 a, .ad-title a',
  price: '.listing-price, .property-price, .price, .ad-price',
  link: 'a[href*="/real-estate/"], a[href*="/property/"], a[href*="/listing/"]',
  image: '.listing-img img, .property-img img, .ad-image img',
  location: '.listing-location, .property-location, .ad-location',
  specs: '.listing-specs, .property-specs, .ad-specs',
  pagination: '.pagination a, .pager a, nav.pagination a',
} as const;

// CSS selectors for detail pages
export const DETAIL_SELECTORS = {
  title: 'h1.listing-title, h1.property-title, h1, .detail-title h1',
  price: '.detail-price, .listing-detail-price, .price-main, .property-price',
  location: '.detail-location, .listing-location, .breadcrumb, .property-location',
  description: '.detail-description, .listing-description, .property-description, .ad-description',
  images: '.detail-gallery img, .listing-gallery img, .property-gallery img, .swiper-slide img, .fotorama img',
  features: '.detail-features li, .listing-features li, .property-features li, .amenities li',
  specs: '.detail-specs, .listing-specs, .property-specs, .specs-table',
  contact: {
    name: '.contact-name, .agent-name, .seller-name',
    phone: '.contact-phone, .agent-phone, .seller-phone, a[href^="tel:"]',
    email: '.contact-email, .agent-email, a[href^="mailto:"]',
  },
} as const;
