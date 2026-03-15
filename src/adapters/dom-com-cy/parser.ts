import type { CheerioAPI } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { INDEX_SELECTORS, DETAIL_SELECTORS, BASE_URL } from './constants.js';

export function parseIndexPage(
  $: CheerioAPI,
  listingType: 'rent' | 'sale',
): DiscoveredListing[] {
  const listings: DiscoveredListing[] = [];

  // Try multiple possible card selectors
  const cardSelectors = [
    '.catalog-item',
    '.catalog-section .item',
    '[data-id]',
    '.catalog-list .item',
  ];

  let cards = $(cardSelectors[0]);
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length > 0) { cards = found; break; }
  }

  // If no structured cards found, look for links to individual listings
  if (cards.length === 0) {
    $('a[href*="/catalog/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || !href.match(/\/catalog\/(rent|sale)\/\d+/)) return;

      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const idMatch = href.match(/\/(\d+)\/?$/);
      if (!idMatch) return;

      listings.push({
        externalId: idMatch[1],
        url,
        listingType,
      });
    });

    // Deduplicate by externalId
    const seen = new Set<string>();
    return listings.filter(l => {
      if (seen.has(l.externalId)) return false;
      seen.add(l.externalId);
      return true;
    });
  }

  cards.each((_, el) => {
    const card = $(el);

    // Extract link
    const linkEl = card.find('a[href*="/catalog/"]').first();
    let href = linkEl.attr('href') || card.find('a').first().attr('href');
    if (!href) return;

    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;

    // Extract external ID from URL
    const idMatch = href.match(/\/(\d+)\/?$/);
    const dataId = card.attr('data-id');
    const externalId = idMatch?.[1] ?? dataId;
    if (!externalId) return;

    // Extract partial data from card
    const title = card.find(INDEX_SELECTORS.title).first().text().trim() ||
                  linkEl.text().trim();

    const priceText = card.find(INDEX_SELECTORS.price).first().text().trim();
    const price = parseCardPrice(priceText);

    const locationText = card.find(INDEX_SELECTORS.location).first().text().trim();

    listings.push({
      externalId,
      url,
      listingType,
      partial: {
        title: title || undefined,
        price,
        location: locationText || undefined,
      },
    });
  });

  return listings;
}

export function parseDetailPage(
  $: CheerioAPI,
  url: string,
  externalId: string,
  source: string,
): RawListing {
  // Title
  const title = $(DETAIL_SELECTORS.title).first().text().trim() || 'Untitled';

  // Price
  const priceText = $(DETAIL_SELECTORS.price).first().text().trim();
  const price = parseCardPrice(priceText);

  // Determine listing type from URL
  const listingType: 'rent' | 'sale' = url.includes('/rent/') ? 'rent' : 'sale';

  // Location from breadcrumbs or info section
  const breadcrumbs = $('li.breadcrumbs a, .breadcrumbs a')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(t => t && t !== 'Main' && t !== 'Catalog');
  const location = breadcrumbs.join(', ') || '';

  // Description
  const description = $(DETAIL_SELECTORS.description).first().text().trim();

  // Images
  const images: ListingImage[] = [];
  $(DETAIL_SELECTORS.images).each((i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || $(el).attr('data-lazy');
    if (src && !src.includes('placeholder') && !src.includes('no-photo')) {
      const imgUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
      images.push({ url: imgUrl, order: i });
    }
  });

  // Features / amenities
  const amenities: string[] = [];
  $(DETAIL_SELECTORS.features).each((_, el) => {
    const text = $(el).text().trim();
    if (text) amenities.push(text);
  });

  // Additional info (may contain bedrooms, bathrooms, area)
  const additional: Record<string, string> = {};
  $(DETAIL_SELECTORS.additional).each((_, el) => {
    const label = $(el).find('span, .label, dt').first().text().trim().toLowerCase();
    const value = $(el).find('strong, .value, dd, b').first().text().trim() ||
                  $(el).text().replace($(el).find('span, .label, dt').first().text(), '').trim();
    if (label && value) {
      additional[label] = value;
    }
  });

  // Parse specs from the info content area
  const specsText = $(DETAIL_SELECTORS.specs).text().toLowerCase();

  // Bedrooms
  let bedrooms: number | null = null;
  const bedMatch = specsText.match(/(\d+)\s*(?:bed|bedroom|спален)/);
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);
  if (!bedrooms && additional['bedrooms']) bedrooms = parseInt(additional['bedrooms'], 10);

  // Bathrooms
  let bathrooms: number | null = null;
  const bathMatch = specsText.match(/(\d+)\s*(?:bath|bathroom|ванн)/);
  if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);
  if (!bathrooms && additional['bathrooms']) bathrooms = parseInt(additional['bathrooms'], 10);

  // Area
  let areaSqm: number | null = null;
  const areaMatch = specsText.match(/(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm|кв\.?\s*м)/);
  if (areaMatch) areaSqm = parseFloat(areaMatch[1]);
  if (!areaSqm && additional['area']) areaSqm = parseFloat(additional['area']);

  // Furnished
  let furnished: boolean | null = null;
  if (specsText.includes('furnished') && !specsText.includes('unfurnished')) furnished = true;
  if (specsText.includes('unfurnished')) furnished = false;

  // Contact info
  const contactName = $(DETAIL_SELECTORS.manager.name).first().text().trim() || undefined;
  const contactBlock = $(DETAIL_SELECTORS.manager.contacts).first().text().trim();
  const phoneMatch = contactBlock?.match(/[\+]?\d[\d\s\-]{6,}/);
  const contactPhone = phoneMatch?.[0]?.trim() || undefined;

  // Property type from breadcrumbs or title
  let propertyType: string | undefined;
  const titleLower = title.toLowerCase();
  if (titleLower.includes('apartment') || titleLower.includes('flat')) propertyType = 'apartment';
  else if (titleLower.includes('villa')) propertyType = 'villa';
  else if (titleLower.includes('house')) propertyType = 'house';
  else if (titleLower.includes('studio')) propertyType = 'studio';
  else if (titleLower.includes('land') || titleLower.includes('plot')) propertyType = 'land';
  else if (titleLower.includes('office') || titleLower.includes('shop') || titleLower.includes('commercial')) propertyType = 'commercial';

  // District normalization
  const districts: Record<string, string> = {
    'limassol': 'limassol', 'lemesos': 'limassol',
    'paphos': 'paphos', 'pafos': 'paphos',
    'nicosia': 'nicosia', 'lefkosia': 'nicosia',
    'larnaca': 'larnaca', 'larnaka': 'larnaca',
    'famagusta': 'famagusta', 'ammochostos': 'famagusta',
  };
  let district: string | undefined;
  const locationLower = location.toLowerCase();
  for (const [key, val] of Object.entries(districts)) {
    if (locationLower.includes(key)) {
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
    amenities: amenities.length > 0 ? amenities : undefined,
    raw: Object.keys(additional).length > 0 ? additional : undefined,
  };
}

function parseCardPrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
