import { describe, it, expect } from 'vitest';
import { buildListingMessage, buildPriceChangeMessage } from '../../src/telegram/message-builder.js';
import type { RawListing, PriceChange } from '../../src/types/listing.js';

function makeListing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    externalId: '123',
    source: 'dom-com-cy',
    url: 'https://dom.com.cy/en/catalog/rent/123/',
    title: '2 Bedroom Apartment in Limassol',
    listingType: 'rent',
    price: 1200,
    currency: 'EUR',
    location: 'Limassol, Germasogeia',
    images: [],
    ...overrides,
  };
}

describe('buildListingMessage', () => {
  it('should include rent badge for rental listings', () => {
    const msg = buildListingMessage(makeListing({ listingType: 'rent' }));
    expect(msg).toContain('FOR RENT');
  });

  it('should include sale badge for sale listings', () => {
    const msg = buildListingMessage(makeListing({ listingType: 'sale' }));
    expect(msg).toContain('FOR SALE');
  });

  it('should format price with /mo suffix for rentals', () => {
    const msg = buildListingMessage(makeListing({ price: 1200, listingType: 'rent' }));
    expect(msg).toContain('1,200');
    expect(msg).toContain('/mo');
  });

  it('should not add /mo suffix for sale listings', () => {
    const msg = buildListingMessage(makeListing({ price: 250000, listingType: 'sale' }));
    expect(msg).toContain('250,000');
    expect(msg).not.toContain('/mo');
  });

  it('should show "Price on request" when price is null', () => {
    const msg = buildListingMessage(makeListing({ price: null }));
    expect(msg).toContain('Price on request');
  });

  it('should include location', () => {
    const msg = buildListingMessage(makeListing({ location: 'Paphos, Kato Paphos' }));
    expect(msg).toContain('Paphos, Kato Paphos');
  });

  it('should include property details', () => {
    const msg = buildListingMessage(makeListing({
      propertyType: 'apartment',
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 120,
      furnished: true,
    }));
    expect(msg).toContain('Apartment');
    expect(msg).toContain('3 bed');
    expect(msg).toContain('2 bath');
    expect(msg).toContain('120 m');
    expect(msg).toContain('Furnished');
  });

  it('should truncate long descriptions', () => {
    const longDesc = 'A'.repeat(600);
    const msg = buildListingMessage(makeListing({ description: longDesc }));
    expect(msg).toContain('...');
    // Should not contain the full 600 chars
    expect(msg.length).toBeLessThan(600 + 200); // message overhead
  });

  it('should include contact info', () => {
    const msg = buildListingMessage(makeListing({
      contactName: 'John Doe',
      contactPhone: '+357 99123456',
    }));
    expect(msg).toContain('John Doe');
    expect(msg).toContain('+357 99123456');
  });

  it('should include source', () => {
    const msg = buildListingMessage(makeListing({ source: 'bazaraki' }));
    expect(msg).toContain('bazaraki');
  });

  it('should escape HTML in title', () => {
    const msg = buildListingMessage(makeListing({ title: '<script>alert("xss")</script>' }));
    expect(msg).not.toContain('<script>');
    expect(msg).toContain('&lt;script&gt;');
  });

  it('should show amenities', () => {
    const msg = buildListingMessage(makeListing({
      amenities: ['Pool', 'Parking', 'Air Conditioning'],
    }));
    expect(msg).toContain('Pool');
    expect(msg).toContain('Parking');
  });
});

describe('buildPriceChangeMessage', () => {
  it('should show price drop for decreased price', () => {
    const listing = makeListing({ price: 1000 });
    const change: PriceChange = {
      listingId: 1,
      oldPrice: 1200,
      newPrice: 1000,
      detectedAt: new Date().toISOString(),
    };
    const msg = buildPriceChangeMessage(listing, change);
    expect(msg).toContain('PRICE DROP');
    expect(msg).toContain('1,200');
    expect(msg).toContain('1,000');
  });

  it('should show price increase for increased price', () => {
    const listing = makeListing({ price: 1500 });
    const change: PriceChange = {
      listingId: 1,
      oldPrice: 1200,
      newPrice: 1500,
      detectedAt: new Date().toISOString(),
    };
    const msg = buildPriceChangeMessage(listing, change);
    expect(msg).toContain('PRICE INCREASE');
  });

  it('should show percentage change', () => {
    const listing = makeListing({ price: 900 });
    const change: PriceChange = {
      listingId: 1,
      oldPrice: 1000,
      newPrice: 900,
      detectedAt: new Date().toISOString(),
    };
    const msg = buildPriceChangeMessage(listing, change);
    expect(msg).toContain('-10.0%');
  });
});
