/**
 * Telegram Channels adapter constants.
 *
 * Uses the `telegram` MTProto client to read public channel message history.
 * Separate from the grammY notification bot (different libraries, no conflicts).
 */

// How many recent messages to fetch per channel
export const DEFAULT_MESSAGE_LIMIT = 50;

// How we prefix external IDs for Telegram messages
export const EXTERNAL_ID_PREFIX = 'tg';

// Build an external ID from a channel username and message ID
export function buildExternalId(channel: string, messageId: number): string {
  return `${EXTERNAL_ID_PREFIX}-${channel}-${messageId}`;
}

// Build a public link to a Telegram channel message
export function buildMessageUrl(channel: string, messageId: number): string {
  return `https://t.me/${channel}/${messageId}`;
}

// Minimum text length for a message to be considered a property listing
export const MIN_MESSAGE_LENGTH = 20;
