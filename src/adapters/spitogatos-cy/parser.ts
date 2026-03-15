import type { CheerioAPI } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { INDEX_SELECTORS, DETAIL_SELECTORS, BASE_URL } from './constants.js';

export function parseIndexPage(
  $: CheerioAPI,
  listingType: 'rent' | 'sale',
): DiscoveredListing[] {
  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();

  // Try structured cards
  const cardSelectors = INDEX_SELECTORS.listingCard.split(', ');
  let cards = $(cardSelectors[0]);
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length > 0) { cards = found; break; }
  }

  if (cards.length > 0) {
    cards.each((_, el) => {
      const card = $(el);

      // Get data-id if available
      const dataId = card.attr('data-id');

      const linkEl = card.find('a[href]').first();
      const href = linkEl.attr('href');
      if (!href) return;

      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const idMatch = href.match(/\/(\d+)\/?$/) || href.match(/[-/](\d{4,})/);
      const externalId = dataId || idMatch?.[1];
      if (!externalId || seen.has(externalId)) return;
      seen.add(externalId);

      const title = card.find(INDEX_SELECTORS.title.split(', ').join(', ')).first().text().trim();
      const priceText = card.find(INDEX_SELECTORS.price.split(', ').join(', ')).first().text().trim();
      const price = parseCardPrice(priceText);
      const location = card.find(INDEX_SELECTORS.location.split(', ').join(', ')).first().text().trim();

      listings.push({
        externalId,
        url,
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

  // Fallback: find listing links
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.match(/\/(property|listing|en\/(rent|sale))\//)) return;
    if (!href.match(/\d/)) return;

    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const idMatch = href.match(/\/(\d+)\/?$/);
    if (!idMatch) return;

    const externalId = idMatch[1];
    if (seen.has(externalId)) return;
    seen.add(externalId);

    listings.push({ externalId, url, listingType });
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
  const titleSels = DETAIL_SELECTORS.title.split(', ');
  let title = '';
  for (const sel of titleSels) {
    title = $(sel).first().text().trim();
    if (title) break;
  }
  title = title || 'Untitled';

  // Price
  const priceSels = DETAIL_SELECTORS.price.split(', ');
  let priceText = '';
  for (const sel of priceSels) {
    priceText = $(sel).first().text().trim();
    if (priceText) break;
  }
  const price = parseCardPrice(priceText);

  // Listing type
  const listingType: 'rent' | 'sale' = url.includes('/rent') || url.includes('/rental')
    ? 'rent' : 'sale';

  // Location
  const locSels = DETAIL_SELECTORS.location.split(', ');
  let location = '';
  for (const sel of locSels) {
    const text = $(sel).last().text().trim();
    if (text) { location = text; break; }
  }

  // Description
  const descSels = DETAIL_SELECTORS.description.split(', ');
  let description = '';
  for (const sel of descSels) {
    description = $(sel).first().text().trim();
    if (description) break;
  }

  // Images
  const images: ListingImage[] = [];
  $(DETAIL_SELECTORS.images.split(', ').join(', ')).each((i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || $(el).attr('data-lazy');
    if (src && !src.includes('placeholder') && !src.includes('no-photo')) {
      const imgUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
      images.push({ url: imgUrl, order: i });
    }
  });

  // Amenities
  const amenities: string[] = [];
  $(DETAIL_SELECTORS.features.split(', ').join(', ')).each((_, el) => {
    const text = $(el).text().trim();
    if (text) amenities.push(text);
  });

  // Extract specs
  const specsText = $(DETAIL_SELECTORS.specs.split(', ').join(', ')).text().toLowerCase();
  const fullText = (title + ' ' + specsText + ' ' + description).toLowerCase();

  // Bedrooms
  let bedrooms: number | null = null;
  const bedMatch = fullText.match(/(\d+)\s*(?:bed(?:room)?s?|br)/i);
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

  // Bathrooms
  let bathrooms: number | null = null;
  const bathMatch = fullText.match(/(\d+)\s*(?:bath(?:room)?s?|wc)/i);
  if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

  // Area
  let areaSqm: number | null = null;
  const areaMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:m²|m2|sqm|sq\.?\s*m)/i);
  if (areaMatch) areaSqm = parseFloat(areaMatch[1]);

  // Furnished
  let furnished: boolean | null = null;
  if (fullText.includes('unfurnished')) furnished = false;
  else if (fullText.includes('furnished')) furnished = true;

  // Property type
  let propertyType: string | undefined;
  const titleLower = title.toLowerCase();
  if (titleLower.includes('studio')) propertyType = 'studio';
  else if (titleLower.includes('apartment') || titleLower.includes('flat')) propertyType = 'apartment';
  else if (titleLower.includes('villa')) propertyType = 'villa';
  else if (titleLower.includes('house') || titleLower.includes('townhouse') || titleLower.includes('maisonette')) propertyType = 'house';
  else if (titleLower.includes('land') || titleLower.includes('plot')) propertyType = 'land';
  else if (titleLower.includes('office') || titleLower.includes('shop') || titleLower.includes('commercial')) propertyType = 'commercial';

  // District
  let district: string | undefined;
  const districts: Record<string, string> = {
    'limassol': 'limassol', 'lemesos': 'limassol',
    'paphos': 'paphos', 'pafos': 'paphos',
    'nicosia': 'nicosia', 'lefkosia': 'nicosia',
    'larnaca': 'larnaca', 'larnaka': 'larnaca',
    'famagusta': 'famagusta', 'ammochostos': 'famagusta',
  };
  const locationLower = (location + ' ' + url).toLowerCase();
  for (const [key, val] of Object.entries(districts)) {
    if (locationLower.includes(key)) { district = val; break; }
  }

  // Contact
  const contactName = $(DETAIL_SELECTORS.contact.name.split(', ').join(', ')).first().text().trim() || undefined;
  const phoneEl = $(DETAIL_SELECTORS.contact.phone.split(', ').join(', ')).first();
  const contactPhone = phoneEl.attr('href')?.replace('tel:', '').trim() || phoneEl.text().trim() || undefined;
  const emailEl = $(DETAIL_SELECTORS.contact.email.split(', ').join(', ')).first();
  const contactEmail = emailEl.attr('href')?.replace('mailto:', '').trim() || undefined;

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
    contactEmail,
    amenities: amenities.length > 0 ? amenities : undefined,
  };
}

function parseCardPrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
