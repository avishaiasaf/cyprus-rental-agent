import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { load as cheerioLoad } from 'cheerio';
import { parseIndexPage, parseDetailPage } from '../../src/adapters/dom-com-cy/parser.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('dom-com-cy parseIndexPage', () => {
  const html = fs.readFileSync(path.join(fixturesDir, 'dom-com-cy-index.html'), 'utf-8');
  const $ = cheerioLoad(html);

  it('should discover listings from index page', () => {
    const listings = parseIndexPage($, 'rent');
    expect(listings.length).toBeGreaterThanOrEqual(3);
  });

  it('should extract external IDs', () => {
    const listings = parseIndexPage($, 'rent');
    const ids = listings.map(l => l.externalId);
    expect(ids).toContain('1001');
    expect(ids).toContain('1002');
    expect(ids).toContain('1003');
  });

  it('should set listing type from parameter', () => {
    const listings = parseIndexPage($, 'rent');
    expect(listings.every(l => l.listingType === 'rent')).toBe(true);
  });

  it('should build full URLs', () => {
    const listings = parseIndexPage($, 'rent');
    expect(listings[0].url).toContain('https://dom.com.cy');
  });

  it('should extract partial title and price', () => {
    const listings = parseIndexPage($, 'rent');
    const first = listings.find(l => l.externalId === '1001');
    expect(first?.partial?.title).toContain('Bedroom');
    expect(first?.partial?.price).toBe(1200);
  });
});

describe('dom-com-cy parseDetailPage', () => {
  const html = fs.readFileSync(path.join(fixturesDir, 'dom-com-cy-detail.html'), 'utf-8');
  const $ = cheerioLoad(html);

  it('should extract title', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.title).toContain('Modern 2 Bedroom Apartment');
  });

  it('should extract price', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.price).toBe(1200);
  });

  it('should determine listing type from URL', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.listingType).toBe('rent');
  });

  it('should extract images', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.images.length).toBeGreaterThanOrEqual(2);
    expect(result.images[0].url).toContain('photo');
  });

  it('should extract description', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.description).toContain('modern apartment');
  });

  it('should extract contact info', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.contactName).toContain('Cyprus Estate');
    expect(result.contactPhone).toContain('357');
  });

  it('should extract amenities', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.amenities).toBeDefined();
    expect(result.amenities).toContain('Air Conditioning');
    expect(result.amenities).toContain('Pool');
  });

  it('should extract bedrooms from additional info', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.bedrooms).toBe(2);
  });

  it('should normalize district from location', () => {
    const result = parseDetailPage($, 'https://dom.com.cy/en/catalog/rent/1001/', '1001', 'dom-com-cy');
    expect(result.district).toBe('limassol');
  });
});
