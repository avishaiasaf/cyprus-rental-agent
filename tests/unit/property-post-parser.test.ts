import { describe, it, expect } from 'vitest';
import { parsePropertyPost } from '../../src/utils/property-post-parser.js';

describe('parsePropertyPost', () => {
  describe('price extraction', () => {
    it('should extract price with € prefix', () => {
      const result = parsePropertyPost('Nice apartment for rent €1,200/month');
      expect(result.price).toBe(1200);
    });

    it('should extract price with EUR suffix', () => {
      const result = parsePropertyPost('2 bed flat, 950 EUR per month, Limassol');
      expect(result.price).toBe(950);
    });

    it('should extract price with euro symbol suffix', () => {
      const result = parsePropertyPost('Apartment available 800€ monthly');
      expect(result.price).toBe(800);
    });

    it('should handle large sale prices', () => {
      const result = parsePropertyPost('Villa for sale in Paphos, €250,000');
      expect(result.price).toBe(250000);
    });

    it('should return null for no price', () => {
      const result = parsePropertyPost('Beautiful apartment in Limassol');
      expect(result.price).toBeNull();
    });
  });

  describe('listing type detection', () => {
    it('should detect rental from "for rent"', () => {
      const result = parsePropertyPost('Apartment for rent in Limassol €900');
      expect(result.listingType).toBe('rent');
    });

    it('should detect sale from "for sale"', () => {
      const result = parsePropertyPost('House for sale in Paphos €350,000');
      expect(result.listingType).toBe('sale');
    });

    it('should detect rental from "per month"', () => {
      const result = parsePropertyPost('Studio €650 per month Larnaca');
      expect(result.listingType).toBe('rent');
    });

    it('should infer sale from high price', () => {
      const result = parsePropertyPost('3 bed house Limassol €185,000');
      expect(result.listingType).toBe('sale');
    });

    it('should infer rent from low price', () => {
      const result = parsePropertyPost('1 bed flat Paphos €750');
      expect(result.listingType).toBe('rent');
    });
  });

  describe('bedrooms extraction', () => {
    it('should extract bedrooms from "3 bed"', () => {
      const result = parsePropertyPost('3 bed apartment for rent');
      expect(result.bedrooms).toBe(3);
    });

    it('should extract bedrooms from "2 bedrooms"', () => {
      const result = parsePropertyPost('Beautiful 2 bedrooms flat');
      expect(result.bedrooms).toBe(2);
    });

    it('should extract bedrooms from "1br"', () => {
      const result = parsePropertyPost('1br studio in Limassol');
      expect(result.bedrooms).toBe(1);
    });
  });

  describe('bathrooms extraction', () => {
    it('should extract bathrooms from "2 bath"', () => {
      const result = parsePropertyPost('3 bed 2 bath villa');
      expect(result.bathrooms).toBe(2);
    });

    it('should extract from "1 bathroom"', () => {
      const result = parsePropertyPost('Apartment with 1 bathroom');
      expect(result.bathrooms).toBe(1);
    });
  });

  describe('area extraction', () => {
    it('should extract area in m²', () => {
      const result = parsePropertyPost('Spacious 120m² apartment');
      expect(result.areaSqm).toBe(120);
    });

    it('should extract area in sqm', () => {
      const result = parsePropertyPost('Area: 85 sqm, 2 bedrooms');
      expect(result.areaSqm).toBe(85);
    });

    it('should extract area with "sq m"', () => {
      const result = parsePropertyPost('Villa 300 sq m with pool');
      expect(result.areaSqm).toBe(300);
    });
  });

  describe('property type', () => {
    it('should detect apartment', () => {
      const result = parsePropertyPost('Apartment for rent');
      expect(result.propertyType).toBe('apartment');
    });

    it('should detect villa', () => {
      const result = parsePropertyPost('Luxury villa in Paphos');
      expect(result.propertyType).toBe('villa');
    });

    it('should detect studio', () => {
      const result = parsePropertyPost('Studio flat near the sea');
      expect(result.propertyType).toBe('studio');
    });

    it('should detect house', () => {
      const result = parsePropertyPost('House for rent, 3 bedrooms');
      expect(result.propertyType).toBe('house');
    });
  });

  describe('furnished detection', () => {
    it('should detect furnished', () => {
      const result = parsePropertyPost('Fully furnished apartment');
      expect(result.furnished).toBe(true);
    });

    it('should detect unfurnished', () => {
      const result = parsePropertyPost('Unfurnished 2 bed flat');
      expect(result.furnished).toBe(false);
    });
  });

  describe('location / district', () => {
    it('should detect Limassol', () => {
      const result = parsePropertyPost('Apartment in Limassol for rent');
      expect(result.district).toBe('limassol');
    });

    it('should detect Paphos', () => {
      const result = parsePropertyPost('Villa Paphos area €2,000/month');
      expect(result.district).toBe('paphos');
    });

    it('should detect from Greek name (Lemesos)', () => {
      const result = parsePropertyPost('Flat in Lemesos, 2 bed');
      expect(result.district).toBe('limassol');
    });

    it('should detect neighborhood Germasogeia', () => {
      const result = parsePropertyPost('Modern flat in Germasogeia');
      expect(result.district).toBe('limassol');
    });

    it('should detect neighborhood Kato Paphos', () => {
      const result = parsePropertyPost('Studio near Kato Paphos beach');
      expect(result.district).toBe('paphos');
    });
  });

  describe('contact info', () => {
    it('should extract Cyprus phone number with +357', () => {
      const result = parsePropertyPost('Call +357 99 123 456 for details');
      expect(result.contactPhone).toContain('357');
    });

    it('should extract email', () => {
      const result = parsePropertyPost('Contact agent@realestate.cy for viewing');
      expect(result.contactEmail).toBe('agent@realestate.cy');
    });
  });

  describe('demand post detection', () => {
    it('should detect "looking for" as demand', () => {
      const result = parsePropertyPost('Looking for 2 bed apartment in Limassol');
      expect(result.isDemandPost).toBe(true);
    });

    it('should not flag supply posts', () => {
      const result = parsePropertyPost('2 bed apartment for rent in Limassol €900');
      expect(result.isDemandPost).toBe(false);
    });
  });

  describe('complex real-world posts', () => {
    it('should parse a detailed English listing', () => {
      const text = 'Luxury 4 bedroom villa, 300m², sea view, fully furnished, Germasogeia, asking €3,200 per month. Call +357 99 123 456';
      const result = parsePropertyPost(text);
      expect(result.price).toBe(3200);
      expect(result.bedrooms).toBe(4);
      expect(result.areaSqm).toBe(300);
      expect(result.propertyType).toBe('villa');
      expect(result.furnished).toBe(true);
      expect(result.district).toBe('limassol');
      expect(result.listingType).toBe('rent');
      expect(result.contactPhone).toBeDefined();
    });

    it('should parse minimal post', () => {
      const text = 'Apartment Paphos 800 euros';
      const result = parsePropertyPost(text);
      expect(result.price).toBe(800);
      expect(result.propertyType).toBe('apartment');
      expect(result.district).toBe('paphos');
    });

    it('should handle empty/short text', () => {
      const result = parsePropertyPost('Hi');
      expect(result.price).toBeNull();
      expect(result.bedrooms).toBeNull();
      expect(result.isDemandPost).toBe(false);
    });
  });
});
