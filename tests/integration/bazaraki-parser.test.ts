import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseIndexPage, parseDetailPage } from '../../src/adapters/bazaraki/parser.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('bazaraki parseIndexPage', () => {
  const html = fs.readFileSync(path.join(fixturesDir, 'bazaraki-index.html'), 'utf-8');

  it('should discover listings from index page', () => {
    const listings = parseIndexPage(html, 'rent');
    expect(listings.length).toBe(2);
  });

  it('should extract external IDs from /adv/ URLs', () => {
    const listings = parseIndexPage(html, 'rent');
    const ids = listings.map(l => l.externalId);
    expect(ids).toContain('90001');
    expect(ids).toContain('90002');
  });

  it('should build full bazaraki URLs', () => {
    const listings = parseIndexPage(html, 'rent');
    expect(listings[0].url).toContain('bazaraki.com');
    expect(listings[0].url).toContain('/adv/');
  });

  it('should set listing type from parameter', () => {
    const listings = parseIndexPage(html, 'sale');
    expect(listings.every(l => l.listingType === 'sale')).toBe(true);
  });

  it('should extract partial data', () => {
    const listings = parseIndexPage(html, 'rent');
    const first = listings.find(l => l.externalId === '90001');
    expect(first?.partial?.title).toContain('Furnished');
    expect(first?.partial?.price).toBe(900);
  });
});

describe('bazaraki parseDetailPage', () => {
  const html = fs.readFileSync(path.join(fixturesDir, 'bazaraki-detail.html'), 'utf-8');
  // URL must contain 'real-estate-to-rent' for the parser to identify it as rental
  const url = 'https://www.bazaraki.com/real-estate-to-rent/adv/90001_furnished-1-bedroom-apartment-in-limassol/';

  it('should extract title', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.title).toContain('Furnished 1 Bedroom Apartment');
  });

  it('should extract price', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.price).toBe(900);
  });

  it('should determine listing type from URL', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.listingType).toBe('rent');
  });

  it('should extract location', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.location).toContain('Limassol');
  });

  it('should extract images', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.images.length).toBe(2);
    expect(result.images[0].url).toContain('bazaraki.com');
  });

  it('should extract description', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.description).toContain('Cozy 1 bedroom');
  });

  it('should extract bedrooms from specs', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.bedrooms).toBe(1);
  });

  it('should extract bathrooms from specs', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.bathrooms).toBe(1);
  });

  it('should extract property type from specs', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.propertyType).toBe('apartment');
  });

  it('should extract contact info', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.contactName).toContain('Maria');
    expect(result.contactPhone).toContain('357');
    expect(result.agencyName).toContain('Maria Real Estate');
  });

  it('should extract amenities', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.amenities).toBeDefined();
    expect(result.amenities!.length).toBeGreaterThanOrEqual(3);
  });

  it('should extract listing date', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.listingDate).toBeDefined();
    expect(result.listingDate).toBeInstanceOf(Date);
  });

  it('should normalize district', () => {
    const result = parseDetailPage(html, url, '90001', 'bazaraki');
    expect(result.district).toBe('limassol');
  });
});
