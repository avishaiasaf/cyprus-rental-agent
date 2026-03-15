/**
 * Parses unstructured property listing text (Facebook posts, Telegram messages)
 * and extracts structured property data using regex heuristics.
 */

export interface ParsedPropertyPost {
  price: number | null;
  currency: string;
  priceType: 'monthly' | 'total' | 'unknown';
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  propertyType: string | undefined;
  location: string | undefined;
  district: string | undefined;
  furnished: boolean | null;
  contactPhone: string | undefined;
  contactEmail: string | undefined;
  listingType: 'rent' | 'sale' | undefined;
  isDemandPost: boolean;
}

// Cyprus districts and common area names
const DISTRICT_ALIASES: Record<string, string> = {
  limassol: 'limassol', lemesos: 'limassol', λεμεσός: 'limassol',
  paphos: 'paphos', pafos: 'paphos', πάφος: 'paphos',
  nicosia: 'nicosia', lefkosia: 'nicosia', λευκωσία: 'nicosia',
  larnaca: 'larnaca', larnaka: 'larnaca', λάρνακα: 'larnaca',
  famagusta: 'famagusta', ammochostos: 'famagusta', αμμόχωστος: 'famagusta',
  kyrenia: 'kyrenia', keryneia: 'kyrenia', girne: 'kyrenia',
};

// Common neighborhood/area names mapped to districts
const AREA_TO_DISTRICT: Record<string, string> = {
  germasogeia: 'limassol', mesa_geitonia: 'limassol', agios_tychonas: 'limassol',
  potamos_germasogeias: 'limassol', mouttagiaka: 'limassol', zakaki: 'limassol',
  columbia: 'limassol', neapoli: 'limassol', omonia: 'limassol',
  'tourist area': 'limassol', polemidia: 'limassol', erimi: 'limassol',
  kato_paphos: 'paphos', 'kato paphos': 'paphos', chloraka: 'paphos',
  'universal area': 'paphos', emba: 'paphos', tala: 'paphos', yeroskipou: 'paphos',
  strovolos: 'nicosia', engomi: 'nicosia', lakatamia: 'nicosia',
  aglantzia: 'nicosia', latsia: 'nicosia', geri: 'nicosia',
  livadia: 'larnaca', oroklini: 'larnaca', aradippou: 'larnaca',
  dhekelia: 'larnaca', pervolia: 'larnaca', kiti: 'larnaca',
  paralimni: 'famagusta', protaras: 'famagusta', ayia_napa: 'famagusta',
  'ayia napa': 'famagusta', deryneia: 'famagusta',
};

// Demand keywords — posts asking for property (not offering)
const DEMAND_KEYWORDS = [
  'looking for', 'searching for', 'need a', 'need an', 'wanted',
  'anyone know', 'can anyone', 'does anyone', 'recommend',
  'ψάχνω', 'ζητώ', 'χρειάζομαι',
];

export function parsePropertyPost(text: string): ParsedPropertyPost {
  const result: ParsedPropertyPost = {
    price: null,
    currency: 'EUR',
    priceType: 'unknown',
    bedrooms: null,
    bathrooms: null,
    areaSqm: null,
    propertyType: undefined,
    location: undefined,
    district: undefined,
    furnished: null,
    contactPhone: undefined,
    contactEmail: undefined,
    listingType: undefined,
    isDemandPost: false,
  };

  if (!text || text.length < 10) return result;

  const lower = text.toLowerCase();

  // Check if demand post
  result.isDemandPost = DEMAND_KEYWORDS.some(kw => lower.includes(kw));

  // === Listing type ===
  const rentKeywords = ['for rent', 'to rent', 'to let', 'rental', '/month', '/mo', 'per month',
    'pcm', 'p.m.', 'monthly', 'ενοικίαση', 'ενοικιάζεται'];
  const saleKeywords = ['for sale', 'selling', 'asking price', 'πωλείται', 'πώληση'];

  if (rentKeywords.some(kw => lower.includes(kw))) {
    result.listingType = 'rent';
    result.priceType = 'monthly';
  }
  if (saleKeywords.some(kw => lower.includes(kw))) {
    result.listingType = 'sale';
    result.priceType = 'total';
  }

  // === Price ===
  // Pattern: €1,200 or EUR 1200 or 1200€ or 1,200 EUR or 1200 euros
  const pricePatterns = [
    /(?:€|EUR|eur)\s*(\d{1,3}(?:[.,]\d{3})*(?:\.\d{1,2})?)/i,
    /(\d{1,3}(?:[.,]\d{3})*(?:\.\d{1,2})?)\s*(?:€|EUR|euros?)/i,
    /(?:price|rent|cost)[:\s]*(?:€|EUR)?\s*(\d{1,3}(?:[.,]\d{3})*)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/,/g, '');
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) {
        result.price = num;
        break;
      }
    }
  }

  // Infer listing type from price if not set
  if (result.price && !result.listingType) {
    result.listingType = result.price > 10000 ? 'sale' : 'rent';
    result.priceType = result.price > 10000 ? 'total' : 'monthly';
  }

  // === Bedrooms ===
  const bedPatterns = [
    /(\d+)\s*(?:\+\s*\d+\s*)?(?:bed(?:room)?s?|br|bdr)/i,
    /(?:bed(?:room)?s?|br)\s*[:\-–]?\s*(\d+)/i,
    /(\d+)\s*(?:υπν|υπνοδωμάτι)/i,
  ];
  for (const pattern of bedPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.bedrooms = parseInt(match[1], 10);
      break;
    }
  }

  // === Bathrooms ===
  const bathPatterns = [
    /(\d+)\s*(?:bath(?:room)?s?|wc|toilet|shower)/i,
    /(?:bath(?:room)?s?|wc)\s*[:\-–]?\s*(\d+)/i,
    /(\d+)\s*(?:μπάνι|λουτρ)/i,
  ];
  for (const pattern of bathPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.bathrooms = parseInt(match[1], 10);
      break;
    }
  }

  // === Area ===
  const areaPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:m²|m2|sq\.?\s*m|sqm|square\s*met)/i,
    /(?:area|size|covered)\s*[:\-–]?\s*(\d+(?:\.\d+)?)\s*(?:m|sq)/i,
    /(\d+(?:\.\d+)?)\s*(?:τ\.?μ\.?|τετραγωνικ)/i,
  ];
  for (const pattern of areaPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.areaSqm = parseFloat(match[1]);
      break;
    }
  }

  // === Property type ===
  const typeMap: [RegExp, string][] = [
    [/\b(?:studio|στούντιο|γκαρσονιέρα)\b/i, 'studio'],
    [/\b(?:apartment|flat|διαμέρισμα)\b/i, 'apartment'],
    [/\b(?:penthouse|ρετιρέ)\b/i, 'apartment'],
    [/\b(?:villa|βίλα|βίλλα)\b/i, 'villa'],
    [/\b(?:house|σπίτι|κατοικία)\b/i, 'house'],
    [/\b(?:townhouse|maisonette|μεζονέτα)\b/i, 'house'],
    [/\b(?:bungalow)\b/i, 'house'],
    [/\b(?:land|plot|οικόπεδο)\b/i, 'land'],
    [/\b(?:office|shop|commercial|γραφείο|κατάστημα)\b/i, 'commercial'],
  ];
  for (const [pattern, type] of typeMap) {
    if (pattern.test(text)) {
      result.propertyType = type;
      break;
    }
  }

  // === Furnished ===
  if (/\bunfurnished\b/i.test(text) || /\bχωρίς\s+έπιπλα\b/i.test(text)) {
    result.furnished = false;
  } else if (/\b(?:fully\s+)?furnished\b/i.test(text) || /\bεπιπλωμέν/i.test(text)) {
    result.furnished = true;
  }

  // === Location / District ===
  // Check district names first
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower.includes(alias)) {
      result.district = canonical;
      result.location = alias.charAt(0).toUpperCase() + alias.slice(1);
      break;
    }
  }

  // Check neighborhood names if no district found
  if (!result.district) {
    for (const [area, district] of Object.entries(AREA_TO_DISTRICT)) {
      if (lower.includes(area.toLowerCase())) {
        result.district = district;
        result.location = area.charAt(0).toUpperCase() + area.slice(1);
        break;
      }
    }
  }

  // === Contact phone ===
  const phonePatterns = [
    /(?:\+357|00357|357)[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{3}/,
    /(?:\+357|00357)[\s\-]?\d{8}/,
    /\b(?:9[0-9]|7[0-9]|2[0-9])\d{6}\b/,  // Cyprus mobile/landline without prefix
  ];
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.contactPhone = match[0].trim();
      break;
    }
  }

  // === Contact email ===
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.contactEmail = emailMatch[0];
  }

  return result;
}
