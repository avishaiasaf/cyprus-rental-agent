'use client';

import { useQuery } from '@tanstack/react-query';
import { getListings } from '@/lib/api';
import { ListingCard } from './listing-card';

interface SimilarPropertiesProps {
  currentListingId: number;
  district: string | null;
  listingType: string;
}

export function SimilarProperties({
  currentListingId,
  district,
  listingType,
}: SimilarPropertiesProps) {
  const params: Record<string, string> = {
    per_page: '4',
    type: listingType,
    exclude: String(currentListingId),
  };
  if (district) params.district = district;

  const { data } = useQuery({
    queryKey: ['similar', currentListingId, district, listingType],
    queryFn: () => getListings(params),
  });

  if (!data || data.listings.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-4">Similar Properties</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
