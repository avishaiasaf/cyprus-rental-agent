import Link from 'next/link';
import { MapPin, Bed, Bath, Maximize, Building } from 'lucide-react';
import type { Listing } from '@/lib/api';

export function ListingCard({ listing }: { listing: Listing }) {
  const firstImage = listing.images?.[0]?.url;
  const price =
    listing.price != null
      ? `${listing.currency === 'EUR' ? '\u20AC' : listing.currency}${listing.price.toLocaleString()}${listing.listing_type === 'rent' ? '/mo' : ''}`
      : 'Price on request';

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Building className="w-12 h-12" />
          </div>
        )}
        <span
          className={`absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
            listing.listing_type === 'rent'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          For {listing.listing_type}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
          {listing.title}
        </h3>

        <div className="text-lg font-bold text-green-700 mb-2">{price}</div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {listing.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {listing.location}
            </span>
          )}
          {listing.bedrooms != null && (
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3" />
              {listing.bedrooms} bed
            </span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="w-3 h-3" />
              {listing.bathrooms} bath
            </span>
          )}
          {listing.area_sqm != null && (
            <span className="flex items-center gap-1">
              <Maximize className="w-3 h-3" />
              {listing.area_sqm} m&sup2;
            </span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-gray-400">
          {listing.source} &middot;{' '}
          {listing.first_seen_at
            ? new Date(listing.first_seen_at).toLocaleDateString()
            : ''}
        </div>
      </div>
    </Link>
  );
}
