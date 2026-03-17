import { describe, it, expect } from 'vitest';
import { getProxiedImageUrl, isValidImageUrl, isPrivateHost } from '../image-proxy';

describe('getProxiedImageUrl', () => {
  it('returns correct proxy path', () => {
    const result = getProxiedImageUrl('https://example.com/img.jpg');
    expect(result).toBe('/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.jpg');
  });

  it('encodes special characters in URL', () => {
    const result = getProxiedImageUrl('https://example.com/img.jpg?width=100&height=200');
    expect(result).toContain(encodeURIComponent('https://example.com/img.jpg?width=100&height=200'));
  });

  it('returns empty string for empty input', () => {
    expect(getProxiedImageUrl('')).toBe('');
  });
});

describe('isValidImageUrl', () => {
  it('accepts https URL', () => {
    expect(isValidImageUrl('https://example.com/img.jpg')).toBe(true);
  });

  it('accepts http URL', () => {
    expect(isValidImageUrl('http://example.com/img.jpg')).toBe(true);
  });

  it('rejects non-http scheme', () => {
    expect(isValidImageUrl('ftp://example.com/img.jpg')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidImageUrl('')).toBe(false);
  });
});

describe('isPrivateHost', () => {
  it('detects localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
  });

  it('detects loopback IP', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true);
  });

  it('allows public hostname', () => {
    expect(isPrivateHost('example.com')).toBe(false);
  });
});
