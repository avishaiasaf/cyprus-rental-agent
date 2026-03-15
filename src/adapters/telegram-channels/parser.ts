import type { DiscoveredListing } from '../../types/adapter.js';
import type { RawListing } from '../../types/listing.js';
import { parsePropertyPost } from '../../utils/property-post-parser.js';
import { buildExternalId, buildMessageUrl, MIN_MESSAGE_LENGTH } from './constants.js';

/**
 * Represents a raw Telegram channel message.
 */
export interface TelegramMessage {
  id: number;
  message?: string;
  text?: string;
  date?: number; // Unix timestamp
  media?: {
    photo?: {
      sizes?: Array<{
        type?: string;
        url?: string;
        w?: number;
        h?: number;
      }>;
    };
    document?: {
      mimeType?: string;
    };
  };
  fromId?: { channelId?: bigint };
  peerId?: { channelId?: bigint };
  [key: string]: unknown;
}

/**
 * Parse a Telegram message into a DiscoveredListing.
 * Returns null if the message cannot be parsed or is a demand post.
 */
export function parseMessageToDiscovered(
  msg: TelegramMessage,
  channelUsername: string,
): DiscoveredListing | null {
  const text = msg.message || msg.text || '';
  if (!text || text.length < MIN_MESSAGE_LENGTH) return null;

  const parsed = parsePropertyPost(text);

  // Skip demand posts
  if (parsed.isDemandPost) return null;

  // Need at least a price or property type
  if (parsed.price === null && !parsed.propertyType) return null;

  const externalId = buildExternalId(channelUsername, msg.id);
  const url = buildMessageUrl(channelUsername, msg.id);
  const listingType = parsed.listingType || (parsed.price && parsed.price > 10000 ? 'sale' : 'rent');

  return {
    externalId,
    url,
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
 * Convert a Telegram message into a full RawListing.
 * Used by the adapter's cache-based scrapeDetail().
 */
export function messageToRawListing(
  msg: TelegramMessage,
  channelUsername: string,
  channelName: string | undefined,
  externalId: string,
  source: string,
): RawListing {
  const text = msg.message || msg.text || '';
  const parsed = parsePropertyPost(text);
  const url = buildMessageUrl(channelUsername, msg.id);

  // Extract images from media
  const images: Array<{ url: string; order: number }> = [];
  if (msg.media?.photo?.sizes) {
    // Get the largest photo size
    const sizes = [...msg.media.photo.sizes].sort((a, b) => (b.w || 0) - (a.w || 0));
    const largest = sizes[0];
    if (largest?.url) {
      images.push({ url: largest.url, order: 0 });
    }
  }

  // Parse listing date from Unix timestamp
  let listingDate: Date | null = null;
  if (msg.date) {
    listingDate = new Date(msg.date * 1000);
  }

  const listingType = parsed.listingType || (parsed.price && parsed.price > 10000 ? 'sale' : 'rent');

  return {
    externalId,
    source,
    url,
    title: text.slice(0, 120).replace(/\n/g, ' ').trim() || 'Telegram Post',
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
    contactPhone: parsed.contactPhone,
    contactEmail: parsed.contactEmail,
    agencyName: channelName || channelUsername,
    listingDate,
  };
}
