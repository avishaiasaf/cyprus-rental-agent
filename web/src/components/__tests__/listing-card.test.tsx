import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListingCard } from '../listing-card';
import type { Listing } from '@/lib/api';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

vi.mock('@/lib/image-proxy', () => ({
  getProxiedImageUrl: (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`,
}));

vi.mock('@/hooks/use-favorites', () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
    favorites: [],
  }),
}));

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    source: 'bazaraki',
    external_id: 'ext-1',
    url: 'https://example.com/listing/1',
    title: 'Test Apt',
    listing_type: 'rent',
    price: 800,
    currency: 'EUR',
    price_per_sqm: null,
    location: 'Limassol',
    district: 'limassol',
    property_type: 'apartment',
    bedrooms: null,
    bathrooms: null,
    area_sqm: null,
    furnished: null,
    description: null,
    contact_name: null,
    contact_phone: null,
    contact_email: null,
    agency_name: null,
    listing_date: null,
    amenities: [],
    images: [],
    is_active: true,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    notified_at: null,
    ...overrides,
  };
}

describe('ListingCard', () => {
  it('renders image through proxy URL when image present', () => {
    const listing = makeListing({
      images: [{ url: 'https://example.com/photo.jpg', order: 0 }],
    });
    render(<ListingCard listing={listing} />);
    const img = screen.getByAltText('Test Apt');
    expect(img.getAttribute('src')).toBe(
      '/api/image-proxy?url=' + encodeURIComponent('https://example.com/photo.jpg'),
    );
  });

  it('renders Building fallback icon when no images', () => {
    const listing = makeListing({ images: [] });
    render(<ListingCard listing={listing} />);
    expect(screen.getByTestId('image-fallback')).toBeInTheDocument();
  });

  it('onError on img triggers fallback state', () => {
    const listing = makeListing({
      images: [{ url: 'https://example.com/broken.jpg', order: 0 }],
    });
    render(<ListingCard listing={listing} />);
    const img = screen.getByAltText('Test Apt');
    fireEvent.error(img);
    expect(screen.getByTestId('image-fallback')).toBeInTheDocument();
  });

  it('shows NEW badge for listing seen within 48 hours', () => {
    const listing = makeListing({
      first_seen_at: new Date().toISOString(),
    });
    render(<ListingCard listing={listing} />);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('does not show NEW badge for listing seen 72 hours ago', () => {
    const listing = makeListing({
      first_seen_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    });
    render(<ListingCard listing={listing} />);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('formats EUR rent price with /mo suffix', () => {
    const listing = makeListing({ price: 800, currency: 'EUR', listing_type: 'rent' });
    render(<ListingCard listing={listing} />);
    expect(screen.getByText(/€800\/mo/)).toBeInTheDocument();
  });

  it('shows bed/bath/area when present', () => {
    const listing = makeListing({ bedrooms: 2, bathrooms: 1, area_sqm: 75 });
    render(<ListingCard listing={listing} />);
    expect(screen.getByText('2 bed')).toBeInTheDocument();
    expect(screen.getByText('1 bath')).toBeInTheDocument();
    expect(screen.getByText(/75 m/)).toBeInTheDocument();
  });

  it('hides bed/bath/area when null', () => {
    const listing = makeListing({ bedrooms: null, bathrooms: null, area_sqm: null });
    render(<ListingCard listing={listing} />);
    expect(screen.queryByText(/bed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bath/)).not.toBeInTheDocument();
    expect(screen.queryByText(/m²/)).not.toBeInTheDocument();
  });

  it('source badge displays source name', () => {
    const listing = makeListing({ source: 'bazaraki' });
    render(<ListingCard listing={listing} />);
    expect(screen.getByText('bazaraki')).toBeInTheDocument();
  });
});
