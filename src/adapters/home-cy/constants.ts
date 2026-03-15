export const BASE_URL = 'https://home.cy';

export const URLS = {
  rent: '/real-estate-to-rent/',
  sale: '/real-estate-for-sale/',
} as const;

export function buildIndexUrl(
  listingType: 'rent' | 'sale',
  page: number,
  opts?: { district?: string },
): string {
  let path = listingType === 'rent' ? URLS.rent : URLS.sale;

  if (opts?.district) {
    const districtMap: Record<string, string> = {
      limassol: 'limassol',
      paphos: 'paphos',
      nicosia: 'nicosia',
      larnaca: 'larnaca',
      famagusta: 'famagusta',
    };
    const slug = districtMap[opts.district.toLowerCase()];
    if (slug) path += `${slug}/`;
  }

  return page > 1 ? `${BASE_URL}${path}?page=${page}` : `${BASE_URL}${path}`;
}

export const INDEX_SELECTORS = {
  listingCard: '.property-card, .listing-card, [class*="property"], [class*="listing"]',
  title: 'h2 a, h3 a, .title a, .property-title a',
  price: '.price, .property-price, [class*="price"]',
  link: 'a[href*="real-estate"]',
  location: '.location, .address, [class*="location"]',
} as const;

export const DETAIL_SELECTORS = {
  title: 'h1',
  price: '.price, [class*="price"]',
  location: '.location, .address, [class*="location"], .breadcrumb a',
  description: '.description, [class*="description"]',
  images: '.gallery img, .slider img, [class*="gallery"] img',
  specs: '.specs li, .details li, .features li, [class*="spec"] li, [class*="detail"] li',
  contact: {
    name: '.agent-name, .contact-name, [class*="agent"] .name',
    phone: '.phone, [class*="phone"] a, [href^="tel:"]',
  },
} as const;
