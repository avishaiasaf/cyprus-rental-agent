export const BASE_URL = 'https://index.cy';

export const URLS = {
  rent: '/for-rent/',
  sale: '/for-sale/',
} as const;

export function buildIndexUrl(
  listingType: 'rent' | 'sale',
  page: number,
  opts?: { district?: string; propertyType?: string },
): string {
  let path = listingType === 'rent' ? URLS.rent : URLS.sale;

  if (opts?.propertyType && opts.propertyType !== 'any') {
    const typeMap: Record<string, string> = {
      apartment: 'apartments-flats',
      house: 'houses',
      villa: 'villas',
      studio: 'studios',
      land: 'land',
      commercial: 'commercial',
    };
    if (typeMap[opts.propertyType]) path += `${typeMap[opts.propertyType]}/`;
  }

  if (opts?.district) {
    path += `${opts.district.toLowerCase()}/`;
  }

  return page > 1 ? `${BASE_URL}${path}?page=${page}` : `${BASE_URL}${path}`;
}
