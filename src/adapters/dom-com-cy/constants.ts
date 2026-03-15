export const BASE_URL = 'https://dom.com.cy';

export const URLS = {
  rent: '/en/catalog/rent/',
  sale: '/en/catalog/sale/',
} as const;

export function buildIndexUrl(listingType: 'rent' | 'sale', page: number): string {
  const path = listingType === 'rent' ? URLS.rent : URLS.sale;
  return page > 1 ? `${BASE_URL}${path}?page=page-${page}` : `${BASE_URL}${path}`;
}

export function buildFilteredUrl(
  listingType: 'rent' | 'sale',
  page: number,
  opts?: {
    propertyType?: string;
    district?: string;
  },
): string {
  let path = listingType === 'rent' ? URLS.rent : URLS.sale;

  // dom.com.cy uses path segments for property type
  if (opts?.propertyType && opts.propertyType !== 'any') {
    const typeMap: Record<string, string> = {
      apartment: 'type-apartment',
      house: 'type-house',
      villa: 'type-house',
      studio: 'type-apartment',
      land: 'type-land',
      commercial: 'type-commercial',
    };
    if (typeMap[opts.propertyType]) {
      path += `${typeMap[opts.propertyType]}/`;
    }
  }

  const base = `${BASE_URL}${path}`;
  return page > 1 ? `${base}?page=page-${page}` : base;
}

// CSS selectors for listing cards on catalog/index pages
export const INDEX_SELECTORS = {
  listingCard: '.catalog-item',
  title: '.catalog-item__title, .catalog-item__name, h3 a, h2 a',
  price: '.catalog-item__price, .price, .price-main',
  link: 'a[href*="/catalog/"]',
  image: '.catalog-item__photo img, .item-photo-slider img, .swiper-slide img',
  location: '.catalog-item__location, .catalog-item__address',
  specs: '.catalog-item__specs, .catalog-item__params',
  pagination: '.pagination .pagination-item',
  paginationNext: '.pagination .pagination-item.next',
} as const;

// CSS selectors for detail/element pages
export const DETAIL_SELECTORS = {
  title: '.element-info h1, .element-info-content h1, h1',
  price: '.element-price-block .price, .price-main .price',
  currency: '.currency',
  location: '.breadcrumbs a, .element-info .location',
  description: '.description, .element-property-body .description',
  images: '.element-slide img, .element-main-slider img, .swiper-slide img',
  features: '.element-feautres .feautre-item, .feautre-item',
  additional: '.element-additional .addi-item, .addi-item',
  manager: {
    name: '.manager-name',
    contacts: '.manager-contacts',
    block: '.manager-block',
  },
  specs: '.element-info-content',
} as const;
