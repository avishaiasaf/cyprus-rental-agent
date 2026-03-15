import { describe, it, expect } from 'vitest';
import { ConfigSchema, FiltersSchema } from '../../src/config/schema.js';

describe('FiltersSchema', () => {
  it('should apply defaults for empty object', () => {
    const result = FiltersSchema.parse({});
    expect(result.listing_type).toBe('any');
    expect(result.locations).toEqual([]);
    expect(result.property_type).toBe('any');
    expect(result.keywords_include).toEqual([]);
    expect(result.keywords_exclude).toEqual([]);
    expect(result.max_listing_age_days).toBe(7);
    expect(result.furnished).toBe('any');
    expect(result.pets_allowed).toBe('any');
  });

  it('should validate valid filter values', () => {
    const result = FiltersSchema.parse({
      listing_type: 'rent',
      locations: ['Limassol', 'Paphos'],
      min_bedrooms: 1,
      max_bedrooms: 3,
      min_price_eur: 500,
      max_price_eur: 1500,
      furnished: 'true',
    });
    expect(result.listing_type).toBe('rent');
    expect(result.locations).toEqual(['Limassol', 'Paphos']);
    expect(result.min_bedrooms).toBe(1);
    expect(result.max_price_eur).toBe(1500);
  });

  it('should reject invalid listing_type', () => {
    expect(() => FiltersSchema.parse({ listing_type: 'invalid' })).toThrow();
  });

  it('should reject negative min_price_eur', () => {
    expect(() => FiltersSchema.parse({ min_price_eur: -100 })).toThrow();
  });
});

describe('ConfigSchema', () => {
  const minimalConfig = {
    telegram: { bot_token: 'test:token', channel_id: '-1001234' },
  };

  it('should parse minimal valid config', () => {
    const result = ConfigSchema.parse(minimalConfig);
    expect(result.scrape_interval_minutes).toBe(300);
    expect(result.database.type).toBe('postgres');
    expect(result.browser.headless).toBe(true);
    expect(result.health_check.port).toBe(3000);
    expect(result.sources).toEqual([]);
  });

  it('should reject config without telegram', () => {
    expect(() => ConfigSchema.parse({})).toThrow();
  });

  it('should reject empty bot_token', () => {
    expect(() =>
      ConfigSchema.parse({ telegram: { bot_token: '', channel_id: '-1001234' } }),
    ).toThrow();
  });

  it('should parse full config with sources', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      scrape_interval_minutes: 60,
      sources: [
        { name: 'dom-com-cy', enabled: true, max_pages: 3 },
        { name: 'bazaraki', enabled: false },
      ],
    });
    expect(result.scrape_interval_minutes).toBe(60);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].max_pages).toBe(3);
    expect(result.sources[1].enabled).toBe(false);
  });

  it('should parse proxy config', () => {
    const result = ConfigSchema.parse({
      ...minimalConfig,
      proxies: {
        enabled: true,
        urls: ['http://proxy1:8080'],
        rotate_strategy: 'random',
      },
    });
    expect(result.proxies.enabled).toBe(true);
    expect(result.proxies.urls).toHaveLength(1);
    expect(result.proxies.rotate_strategy).toBe('random');
  });
});
