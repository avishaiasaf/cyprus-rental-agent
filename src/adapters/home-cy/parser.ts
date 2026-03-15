import { load as cheerioLoad, type CheerioAPI } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { BASE_URL, INDEX_SELECTORS, DETAIL_SELECTORS } from './constants.js';

export function parseIndexPage(html: string, listingType: 'rent' | 'sale'): DiscoveredListing[] {
  const $ = cheerioLoad(html);
  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();

  // Find all property links
  $('a[href*="real-estate"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Extract listing ID from URL slug
    const idMatch = href.match(/[-_](\d+)(?:\/)?$/);
    if (!idMatch) return;

    const externalId = idMatch[1];
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const title = $(el).text().trim();

    listings.push({
      externalId,
      url: fullUrl,
      listingType,
      partial: { title: title || undefined },
    });
  });

  return listings;
}

export function parseDetailPage(
  html: string,
  url: string,
  externalId: string,
  source: string,
): RawListing {
  const $ = cheerioLoad(html);

  const title = $(DETAIL_SELECTORS.title).first().text().trim() || 'Untitled';
  const listingType: 'rent' | 'sale' = url.includes('to-rent') ? 'rent' : 'sale';

  const priceText = $(DETAIL_SELECTORS.price).first().text().trim();
  const price = parsePrice(priceText);

  const location = $(DETAIL_SELECTORS.location).first().text().trim();
  const description = $(DETAIL_SELECTORS.description).first().text().trim();

  const images: ListingImage[] = [];
  $(DETAIL_SELECTORS.images).each((i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (src && !src.includes('placeholder')) {
      const imgUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
      if (!images.some(img => img.url === imgUrl)) {
        images.push({ url: imgUrl, order: images.length });
      }
    }
  });

  // Parse specs
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let areaSqm: number | null = null;
  let furnished: boolean | null = null;
  let propertyType: string | undefined;

  $(DETAIL_SELECTORS.specs).each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const bedMatch = text.match(/(\d+)\s*bed/);
    if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
    const bathMatch = text.match(/(\d+)\s*bath/);
    if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
    const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm)/);
    if (areaMatch) areaSqm = parseFloat(areaMatch[1]);
    if (text.includes('furnished') && !text.includes('unfurnished')) furnished = true;
    if (text.includes('unfurnished')) furnished = false;
  });

  if (!propertyType) {
    const t = title.toLowerCase();
    if (t.includes('apartment')) propertyType = 'apartment';
    else if (t.includes('villa')) propertyType = 'villa';
    else if (t.includes('house')) propertyType = 'house';
    else if (t.includes('studio')) propertyType = 'studio';
  }

  const contactName = $(DETAIL_SELECTORS.contact.name).first().text().trim() || undefined;
  const contactPhone = $(DETAIL_SELECTORS.contact.phone).first().text().trim() || undefined;

  const district = normalizeDistrict(location);

  return {
    externalId, source, url, title, listingType, price, currency: 'EUR',
    location, district, propertyType, bedrooms, bathrooms, areaSqm, furnished,
    description, images, contactName, contactPhone,
  };
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[€$£]/g, '').replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeDistrict(location: string): string | undefined {
  const lower = location.toLowerCase();
  const map: Record<string, string> = {
    limassol: 'limassol', lemesos: 'limassol',
    paphos: 'paphos', pafos: 'paphos',
    nicosia: 'nicosia', lefkosia: 'nicosia',
    larnaca: 'larnaca', larnaka: 'larnaca',
    famagusta: 'famagusta', ammochostos: 'famagusta',
  };
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}
