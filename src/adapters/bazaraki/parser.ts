import { load as cheerioLoad, type CheerioAPI } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { INDEX_SELECTORS, DETAIL_SELECTORS, BASE_URL } from './constants.js';
import type { Logger } from 'pino';

/** Data extracted via page.evaluate() in browser context */
export interface BrowserExtracted {
  price?: string | null;
  description?: string | null;
}

export function parseIndexPage(
  html: string,
  listingType: 'rent' | 'sale',
): DiscoveredListing[] {
  const $ = cheerioLoad(html);
  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();

  // Find all listing links pointing to /adv/ pages
  $('a[href*="/adv/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

    // Extract ID from URL: /adv/12345678_slug/
    const idMatch = href.match(/\/adv\/(\d+)/);
    if (!idMatch) return;

    const externalId = idMatch[1];
    if (seen.has(externalId)) return;
    seen.add(externalId);

    // Try to extract partial data from the card
    const card = $(el).closest(INDEX_SELECTORS.listingCard) || $(el).parent().parent();

    const title = $(el).text().trim() ||
                  card.find(INDEX_SELECTORS.title).first().text().trim();

    const priceText = card.find(INDEX_SELECTORS.price).first().text().trim();
    const price = parsePrice(priceText);

    const location = card.find(INDEX_SELECTORS.location).first().text().trim();

    listings.push({
      externalId,
      url: fullUrl,
      listingType,
      partial: {
        title: title || undefined,
        price,
        location: location || undefined,
      },
    });
  });

  return listings;
}

export function parseDetailPage(
  html: string,
  url: string,
  externalId: string,
  source: string,
  browserData?: BrowserExtracted,
  logger?: Logger,
): RawListing {
  const $ = cheerioLoad(html);

  // Title
  const title = $(DETAIL_SELECTORS.title).first().text().trim() || 'Untitled';

  // Listing type from URL
  const listingType: 'rent' | 'sale' = url.includes('real-estate-to-rent') ? 'rent' : 'sale';

  // Price — multi-strategy extraction
  const price = extractPrice($, browserData, logger);

  // Location
  const location = $(DETAIL_SELECTORS.location).first().text().trim() ||
    $(DETAIL_SELECTORS.breadcrumbs)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(t => t && t !== 'Home' && t !== 'Main')
      .join(', ');

  // Description — multi-strategy extraction
  const description = extractDescription($, browserData, logger);

  // Images — check multiple possible selectors
  const images: ListingImage[] = [];
  const imgSelectors = [
    DETAIL_SELECTORS.gallery,
    DETAIL_SELECTORS.images,
    'img[data-src]',
    '.announcement img[src*="static.bazaraki"]',
  ];

  for (const sel of imgSelectors) {
    $(sel).each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src') || $(el).attr('data-lazy');
      if (src && !src.includes('placeholder') && !src.includes('avatar') && !src.includes('logo')) {
        const imgUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        // Avoid duplicates
        if (!images.some(img => img.url === imgUrl)) {
          images.push({ url: imgUrl, order: images.length });
        }
      }
    });
    if (images.length > 0) break;
  }

  // Specs / characteristics
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let areaSqm: number | null = null;
  let furnished: boolean | null = null;
  let propertyType: string | undefined;

  $(DETAIL_SELECTORS.specs).each((_, el) => {
    const text = $(el).text().trim().toLowerCase();

    const bedMatch = text.match(/bedroom[s]?\s*[:\-–]?\s*(\d+)/);
    if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

    const bathMatch = text.match(/bathroom[s]?\s*[:\-–]?\s*(\d+)/);
    if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

    const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:m²|m2|sq\.?\s*m)/);
    if (areaMatch) areaSqm = parseFloat(areaMatch[1]);

    if (text.includes('furnished') && !text.includes('unfurnished')) furnished = true;
    if (text.includes('unfurnished')) furnished = false;

    if (text.includes('apartment') || text.includes('flat')) propertyType = 'apartment';
    else if (text.includes('villa')) propertyType = 'villa';
    else if (text.includes('house')) propertyType = 'house';
    else if (text.includes('studio')) propertyType = 'studio';
  });

  // Also try extracting from spec label-value pairs
  $(DETAIL_SELECTORS.specs).each((_, el) => {
    const label = $(el).find(DETAIL_SELECTORS.specsLabel).text().trim().toLowerCase();
    const value = $(el).find(DETAIL_SELECTORS.specsValue).text().trim();

    if (label.includes('bedroom') && !bedrooms) bedrooms = parseInt(value, 10) || null;
    if (label.includes('bathroom') && !bathrooms) bathrooms = parseInt(value, 10) || null;
    if ((label.includes('area') || label.includes('size')) && !areaSqm) areaSqm = parseFloat(value) || null;
    if (label.includes('type') && !propertyType) propertyType = value.toLowerCase();
  });

  // Infer from title if still missing
  if (!propertyType) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('apartment') || titleLower.includes('flat')) propertyType = 'apartment';
    else if (titleLower.includes('villa')) propertyType = 'villa';
    else if (titleLower.includes('house')) propertyType = 'house';
    else if (titleLower.includes('studio')) propertyType = 'studio';
    else if (titleLower.includes('land') || titleLower.includes('plot')) propertyType = 'land';
  }

  // Bedrooms from title
  if (bedrooms === null) {
    const titleBedMatch = title.match(/(\d+)\s*-?\s*bed/i);
    if (titleBedMatch) bedrooms = parseInt(titleBedMatch[1], 10);
  }

  // Contact info
  const contactName = $(DETAIL_SELECTORS.contact.name).first().text().trim() || undefined;
  const contactPhone = $(DETAIL_SELECTORS.contact.phone).first().text().trim() || undefined;
  const agencyName = $(DETAIL_SELECTORS.contact.agency).first().text().trim() || undefined;

  // Amenities
  const amenities: string[] = [];
  $(DETAIL_SELECTORS.amenities).each((_, el) => {
    const text = $(el).text().trim();
    if (text) amenities.push(text);
  });

  // Listing date
  let listingDate: Date | null = null;
  const dateText = $(DETAIL_SELECTORS.date).first().text().trim();
  if (dateText) {
    const parsed = new Date(dateText);
    if (!isNaN(parsed.getTime())) listingDate = parsed;
  }

  // District
  const districts: Record<string, string> = {
    'limassol': 'limassol', 'lemesos': 'limassol',
    'paphos': 'paphos', 'pafos': 'paphos',
    'nicosia': 'nicosia', 'lefkosia': 'nicosia',
    'larnaca': 'larnaca', 'larnaka': 'larnaca',
    'famagusta': 'famagusta', 'ammochostos': 'famagusta',
  };
  let district: string | undefined;
  const locLower = location.toLowerCase();
  for (const [key, val] of Object.entries(districts)) {
    if (locLower.includes(key)) {
      district = val;
      break;
    }
  }

  return {
    externalId,
    source,
    url,
    title,
    listingType,
    price,
    currency: 'EUR',
    location,
    district,
    propertyType,
    bedrooms,
    bathrooms,
    areaSqm,
    furnished,
    description,
    images,
    contactName,
    contactPhone,
    agencyName,
    listingDate,
    amenities: amenities.length > 0 ? amenities : undefined,
  };
}

/**
 * Multi-strategy price extraction.
 * Tries CSS selectors, data attributes, meta tags, og:title, then browser-extracted data.
 */
function extractPrice($: CheerioAPI, browserData?: BrowserExtracted, logger?: Logger): number | null {
  // Strategy 1: CSS selectors (the combined selector already includes all variants)
  const selectorText = $(DETAIL_SELECTORS.price).first().text().trim();
  const selectorPrice = parsePrice(selectorText);
  if (selectorPrice != null) return selectorPrice;

  // Strategy 2: data-price attribute on any element
  const dataPriceEl = $('[data-price]').first();
  if (dataPriceEl.length) {
    const dp = parsePrice(dataPriceEl.attr('data-price') || '');
    if (dp != null) return dp;
  }

  // Strategy 3: meta itemprop="price"
  const metaPrice = $('meta[itemprop="price"]').attr('content');
  if (metaPrice) {
    const mp = parsePrice(metaPrice);
    if (mp != null) return mp;
  }

  // Strategy 4: og:title often contains price like "... - €1,200/mo"
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogPriceMatch = ogTitle.match(/[€$£]\s*([\d,.]+)/);
  if (ogPriceMatch) {
    const op = parsePrice(ogPriceMatch[1]);
    if (op != null) return op;
  }

  // Strategy 5: Browser-extracted data (from page.evaluate)
  if (browserData?.price) {
    const bp = parsePrice(browserData.price);
    if (bp != null) {
      logger?.info({ source: 'bazaraki', strategy: 'page.evaluate' }, 'Price recovered via page.evaluate()');
      return bp;
    }
  }

  // Strategy 6: Scan all text matching price patterns in the page header area
  let foundPrice: number | null = null;
  $('h1, h2, .announcement-price, [class*="price"]').each((_, el) => {
    if (foundPrice != null) return;
    const text = $(el).text();
    const match = text.match(/[€$£]\s*([\d,.]+)/);
    if (match) {
      foundPrice = parsePrice(match[1]);
    }
  });
  if (foundPrice != null) return foundPrice;

  logger?.warn({ source: 'bazaraki' }, 'Price extraction failed — all strategies exhausted');
  return null;
}

/**
 * Multi-strategy description extraction.
 * Tries CSS selectors, itemprop, meta og:description, then browser-extracted data.
 */
function extractDescription($: CheerioAPI, browserData?: BrowserExtracted, logger?: Logger): string {
  // Strategy 1: CSS selectors (combined selector)
  const selectorDesc = $(DETAIL_SELECTORS.description).first().text().trim();
  if (selectorDesc) return selectorDesc;

  // Strategy 2: itemprop="description" element
  const itemPropDesc = $('[itemprop="description"]').first().text().trim();
  if (itemPropDesc) return itemPropDesc;

  // Strategy 3: meta og:description
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
  if (ogDesc) return ogDesc;

  // Strategy 4: meta name="description"
  const metaDesc = $('meta[name="description"]').attr('content')?.trim();
  if (metaDesc) return metaDesc;

  // Strategy 5: Browser-extracted data
  if (browserData?.description) {
    logger?.info({ source: 'bazaraki', strategy: 'page.evaluate' }, 'Description recovered via page.evaluate()');
    return browserData.description;
  }

  logger?.warn({ source: 'bazaraki' }, 'Description extraction failed — all strategies exhausted');
  return '';
}

function parsePrice(text: string): number | null {
  if (!text) return null;

  // First try to extract a clean price pattern like "€1,200" or "1200.00"
  const pricePattern = text.match(/[€$£]?\s*([\d]{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?)/);
  if (pricePattern) {
    const cleaned = pricePattern[1].replace(/,/g, '');
    const num = parseFloat(cleaned);
    // Sanity check: reject prices above 100 million (likely parsing error)
    if (!isNaN(num) && num > 0 && num < 100_000_000) return num;
  }

  // Fallback: strip everything non-numeric
  const cleaned = text.replace(/[€$£]/g, '').replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  // Sanity check: reject absurd values (phone numbers, reference IDs, etc.)
  if (isNaN(num) || num <= 0 || num >= 100_000_000) return null;
  return num;
}
