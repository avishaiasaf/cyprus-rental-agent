/**
 * Returns a proxied image URL that routes through our API to avoid hotlinking blocks.
 */
export function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Validates whether a URL is a valid image URL (http or https scheme).
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks if a hostname resolves to a private/loopback IP range.
 */
export function isPrivateHost(hostname: string): boolean {
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^::1$/,
    /^\[::1\]$/,
  ];
  return privatePatterns.some((p) => p.test(hostname));
}
