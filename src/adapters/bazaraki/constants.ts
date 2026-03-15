export const BASE_URL = 'https://www.bazaraki.com';

export const URLS = {
  rent: '/real-estate-to-rent/',
  sale: '/real-estate/',
} as const;

// Property type URL segments
const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartment: 'apartments-flats',
  house: 'houses',
  villa: 'houses-and-villas-rent',
  studio: 'apartments-flats',
  land: 'land',
  commercial: 'commercial',
};

// District URL segments
const DISTRICT_MAP: Record<string, string> = {
  limassol: 'lemesos-district-limassol',
  paphos: 'pafos-district-paphos',
  nicosia: 'lefkosia-district-nicosia',
  larnaca: 'larnaka-district-larnaca',
  famagusta: 'ammochostos-district-famagusta',
};

export function buildIndexUrl(
  listingType: 'rent' | 'sale',
  page: number,
  opts?: {
    propertyType?: string;
    district?: string;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
  },
): string {
  let path = listingType === 'rent' ? URLS.rent : URLS.sale;

  // Add property type segment
  if (opts?.propertyType && opts.propertyType !== 'any' && PROPERTY_TYPE_MAP[opts.propertyType]) {
    path += `${PROPERTY_TYPE_MAP[opts.propertyType]}/`;
  }

  // Add district segment
  if (opts?.district && DISTRICT_MAP[opts.district.toLowerCase()]) {
    path += `${DISTRICT_MAP[opts.district.toLowerCase()]}/`;
  }

  // Build query parameters
  const params = new URLSearchParams();

  if (opts?.minPrice) params.set('price_from', opts.minPrice.toString());
  if (opts?.maxPrice) params.set('price_to', opts.maxPrice.toString());
  if (opts?.minBedrooms) params.set('attrs__number-of-bedrooms---from', opts.minBedrooms.toString());
  if (opts?.maxBedrooms) params.set('attrs__number-of-bedrooms---to', opts.maxBedrooms.toString());

  if (page > 1) params.set('page', page.toString());

  const queryString = params.toString();
  return `${BASE_URL}${path}${queryString ? '?' + queryString : ''}`;
}

// Bazaraki uses class-based CSS selectors
export const INDEX_SELECTORS = {
  // Listing cards on the search results page
  listingCard: '.announcement-container, .list-simple__output .announcement-block, [data-adid]',
  title: '.announcement-block__title a, h2.announcement-block__title a, .announcement-content a',
  price: '.announcement-block__price .actual-price, .announcement-block__price, .price',
  link: '.announcement-block__title a, .announcement-content a[href*="/adv/"]',
  image: '.announcement-block__image img, .announcement-block__photo img, img[data-src]',
  location: '.announcement-block__location, .announcement-block__city',
  specs: '.announcement-block__specs, .announcement-block__description',
  pagination: '.pagination a, .js-pagination-item',
  paginationNext: '.pagination .next, .js-pagination-next',
} as const;

// Detail page selectors
export const DETAIL_SELECTORS = {
  title: 'h1.announcement__title, h1',
  price: '.announcement__price .actual-price, .announcement__price',
  location: '.announcement__location, .announcement-meta__location, .js-map-link',
  description: '.announcement__description .js-description, .announcement__description',
  images: '.gallery__item img, .announcement-gallery__item img, .js-gallery-item img',
  gallery: '.announcement-gallery img, .gallery img, [data-fancybox] img',
  specs: '.announcement-characteristics li, .announcement__character li',
  specsLabel: 'span:first-child, .key, dt',
  specsValue: 'span:last-child, .value, dd',
  contact: {
    name: '.announcement-author__name, .author-name',
    phone: '.announcement-author__phone a, .js-phone-number',
    agency: '.announcement-author__agency, .author-agency',
  },
  date: '.announcement-meta__date, .announcement-meta time, .date-meta',
  amenities: '.announcement-amenities li, .announcement-features li',
  breadcrumbs: '.breadcrumbs a, .breadcrumb a',
} as const;
