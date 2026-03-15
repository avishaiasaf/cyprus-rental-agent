import { load as cheerioLoad } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { BASE_URL } from './constants.js';

export function parseIndexPage(html: string, listingType: 'rent' | 'sale'): DiscoveredListing[] {
  const $ = cheerioLoad(html);
  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();

  // Find property links
  $('a[href*="/for-sale/"], a[href*="/for-rent/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const idMatch = href.match(/[-_](\d+)(?:\/)?$/);
    if (!idMatch) return;

    const externalId = idMatch[1];
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

    listings.push({
      externalId,
      url: fullUrl,
      listingType,
      partial: { title: $(el).text().trim() || undefined },
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

  const title = $('h1').first().text().trim() || 'Untitled';
  const listingType: 'rent' | 'sale' = url.includes('/for-rent/') ? 'rent' : 'sale';

  const priceText = $('[class*="price"], .price').first().text().trim();
  const price = parsePrice(priceText);

  const location = $('[class*="location"], .location, .address').first().text().trim();
  const description = $('[class*="description"], .description').first().text().trim();

  const images: ListingImage[] = [];
  $('[class*="gallery"] img, .slider img, .swiper img').each((i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (src && !src.includes('placeholder')) {
      const imgUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
      if (!images.some(img => img.url === imgUrl)) {
        images.push({ url: imgUrl, order: images.length });
      }
    }
  });

  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let areaSqm: number | null = null;

  const pageText = $('body').text().toLowerCase();
  const bedMatch = pageText.match(/(\d+)\s*bed/);
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
  const bathMatch = pageText.match(/(\d+)\s*bath/);
  if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
  const areaMatch = pageText.match(/(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm)/);
  if (areaMatch) areaSqm = parseFloat(areaMatch[1]);

  let propertyType: string | undefined;
  const t = title.toLowerCase();
  if (t.includes('apartment')) propertyType = 'apartment';
  else if (t.includes('villa')) propertyType = 'villa';
  else if (t.includes('house')) propertyType = 'house';
  else if (t.includes('studio')) propertyType = 'studio';

  const contactName = $('[class*="agent"] .name, .agent-name').first().text().trim() || undefined;
  const contactPhone = $('[href^="tel:"]').first().text().trim() || undefined;

  const lower = location.toLowerCase();
  const districts: Record<string, string> = {
    limassol: 'limassol', lemesos: 'limassol',
    paphos: 'paphos', pafos: 'paphos',
    nicosia: 'nicosia', lefkosia: 'nicosia',
    larnaca: 'larnaca', larnaka: 'larnaca',
    famagusta: 'famagusta',
  };
  let district: string | undefined;
  for (const [key, val] of Object.entries(districts)) {
    if (lower.includes(key)) { district = val; break; }
  }

  return {
    externalId, source, url, title, listingType, price, currency: 'EUR',
    location, district, propertyType, bedrooms, bathrooms, areaSqm,
    description, images, contactName, contactPhone,
  };
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[€$£]/g, '').replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
