import { load as cheerioLoad, type CheerioAPI } from 'cheerio';
import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing, ListingImage } from '../../types/listing.js';
import { INDEX_SELECTORS, DETAIL_SELECTORS, BASE_URL } from './constants.js';

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
): RawListing {
  const $ = cheerioLoad(html);

  // Title
  const title = $(DETAIL_SELECTORS.title).first().text().trim() || 'Untitled';

  // Listing type from URL
  const listingType: 'rent' | 'sale' = url.includes('real-estate-to-rent') ? 'rent' : 'sale';

  // Price
  const priceText = $(DETAIL_SELECTORS.price).first().text().trim();
  const price = parsePrice(priceText);

  // Location
  const location = $(DETAIL_SELECTORS.location).first().text().trim() ||
    $(DETAIL_SELECTORS.breadcrumbs)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(t => t && t !== 'Home' && t !== 'Main')
      .join(', ');

  // Description
  const description = $(DETAIL_SELECTORS.description).first().text().trim();

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

function parsePrice(text: string): number | null {
  if (!text) return null;
  // Remove currency symbols, spaces, "EUR", "/month" etc
  const cleaned = text.replace(/[€$£]/g, '').replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
