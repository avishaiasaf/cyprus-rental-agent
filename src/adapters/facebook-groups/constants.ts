/**
 * Facebook Groups adapter constants.
 *
 * Uses Apify cloud API to scrape Facebook group posts.
 * No direct Facebook scraping — all data comes through Apify actors.
 */

// The Apify actor for scraping Facebook group posts
export const APIFY_ACTOR_ID = 'apify/facebook-groups-scraper';

// Alternative actors to try if the primary one is unavailable
export const FALLBACK_ACTOR_IDS = [
  'curious_coder/facebook-group-posts-scraper',
  'apify/facebook-posts-scraper',
];

// Default configuration for the Apify actor
export const DEFAULT_ACTOR_INPUT = {
  resultsLimit: 100,
  maxPostDate: '', // Will be set dynamically based on max_listing_age_days
  viewOption: 'RECENT_ACTIVITY',
} as const;

// How we prefix external IDs for Facebook posts
export const EXTERNAL_ID_PREFIX = 'fb';

// Build an external ID from a Facebook post ID
export function buildExternalId(postId: string): string {
  return `${EXTERNAL_ID_PREFIX}-${postId}`;
}

// Extract post ID from Facebook URL
export function extractPostId(url: string): string | null {
  // Pattern: /groups/groupId/posts/postId or /groups/groupId/permalink/postId
  const match = url.match(/\/(?:posts|permalink)\/(\d+)/);
  if (match) return match[1];

  // Pattern: story_fbid=...
  const storyMatch = url.match(/story_fbid=(\d+)/);
  if (storyMatch) return storyMatch[1];

  return null;
}
