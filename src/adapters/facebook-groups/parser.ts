import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { parsePropertyPost, type ParsedPropertyPost } from '../../utils/property-post-parser.js';
import { buildExternalId, extractPostId } from './constants.js';

/**
 * Represents a raw Facebook post from the Apify actor output.
 */
export interface FacebookPost {
  postId?: string;
  postUrl?: string;
  url?: string;
  text?: string;
  message?: string;
  timestamp?: string;
  time?: string;
  date?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  images?: string[];
  media?: Array<{ photo_image?: { uri?: string }; [key: string]: unknown }>;
  authorName?: string;
  author_name?: string;
  groupName?: string;
  group_name?: string;
  [key: string]: unknown;
}

/**
 * Parse an Apify Facebook post into a DiscoveredListing.
 * Returns null if the post cannot be parsed or is a demand post.
 */
export function parsePostToDiscovered(post: FacebookPost): DiscoveredListing | null {
  const text = post.text || post.message || '';
  if (!text || text.length < 15) return null;

  // Parse the post text
  const parsed = parsePropertyPost(text);

  // Skip demand posts (looking for property)
  if (parsed.isDemandPost) return null;

  // We need at least a price or a property type to consider it a property listing
  if (parsed.price === null && !parsed.propertyType) return null;

  // Get post ID
  const postUrl = post.postUrl || post.url || '';
  const postId = post.postId || extractPostId(postUrl) || String(Date.now());
  const externalId = buildExternalId(postId);

  // Determine listing type
  const listingType = parsed.listingType || (parsed.price && parsed.price > 10000 ? 'sale' : 'rent');

  return {
    externalId,
    url: postUrl || `https://www.facebook.com/groups/post/${postId}`,
    listingType,
    partial: {
      title: text.slice(0, 120).replace(/\n/g, ' ').trim(),
      price: parsed.price,
      location: parsed.location,
      district: parsed.district,
      propertyType: parsed.propertyType,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms,
      areaSqm: parsed.areaSqm,
      furnished: parsed.furnished,
      contactPhone: parsed.contactPhone,
      contactEmail: parsed.contactEmail,
    },
  };
}

/**
 * Convert a Facebook post + parsed data into a full RawListing.
 * Used by the adapter's cache-based scrapeDetail().
 */
export function postToRawListing(
  post: FacebookPost,
  externalId: string,
  source: string,
): RawListing {
  const text = post.text || post.message || '';
  const parsed = parsePropertyPost(text);
  const postUrl = post.postUrl || post.url || '';

  // Extract images
  const images: Array<{ url: string; order: number }> = [];

  // From direct images array
  if (post.images && Array.isArray(post.images)) {
    post.images.forEach((imgUrl, i) => {
      if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
        images.push({ url: imgUrl, order: i });
      }
    });
  }

  // From media array (Apify format)
  if (post.media && Array.isArray(post.media)) {
    post.media.forEach((m, i) => {
      const uri = m?.photo_image?.uri;
      if (uri && typeof uri === 'string') {
        images.push({ url: uri, order: images.length + i });
      }
    });
  }

  // Parse listing date
  let listingDate: Date | null = null;
  const dateStr = post.timestamp || post.time || post.date;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) listingDate = d;
  }

  const listingType = parsed.listingType || (parsed.price && parsed.price > 10000 ? 'sale' : 'rent');

  return {
    externalId,
    source,
    url: postUrl || `https://www.facebook.com/groups/post/${externalId}`,
    title: text.slice(0, 120).replace(/\n/g, ' ').trim() || 'Facebook Post',
    listingType,
    price: parsed.price,
    currency: parsed.currency,
    location: parsed.location || '',
    district: parsed.district,
    propertyType: parsed.propertyType,
    bedrooms: parsed.bedrooms,
    bathrooms: parsed.bathrooms,
    areaSqm: parsed.areaSqm,
    furnished: parsed.furnished,
    description: text,
    images,
    contactName: post.authorName || post.author_name,
    contactPhone: parsed.contactPhone,
    contactEmail: parsed.contactEmail,
    agencyName: post.groupName || post.group_name,
    listingDate,
  };
}
