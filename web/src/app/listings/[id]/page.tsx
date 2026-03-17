'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getListing } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { ImageCarousel } from '@/components/image-carousel';
import { PropertySpecs } from '@/components/property-specs';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ShareButtons } from '@/components/share-buttons';
import { SimilarProperties } from '@/components/similar-properties';
import { Footer } from '@/components/footer';
import { SkeletonDetail } from '@/components/skeleton';
import { formatPrice } from '@/lib/format';
import {
  Phone,
  Mail,
  Building,
  ChevronDown,
  ChevronUp,
  Heart,
} from 'lucide-react';
import { useFavorites } from '@/hooks/use-favorites';

export default function ListingDetail() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [descExpanded, setDescExpanded] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListing(id),
    enabled: !isNaN(id),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && <SkeletonDetail />}

        {error && (
          <div className="text-center py-20 text-red-500">
            Failed to load listing.
          </div>
        )}

        {listing && (
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: 'Listings', href: '/' },
                { label: listing.title },
              ]}
            />

            {/* Image Carousel */}
            {listing.images.length > 0 ? (
              <ImageCarousel images={listing.images} title={listing.title} />
            ) : (
              <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 mb-4">
                <Building className="w-16 h-16" />
              </div>
            )}

            {/* Main content */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          listing.listing_type === 'rent'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        For {listing.listing_type}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold">{listing.title}</h1>
                  </div>
                  <button
                    onClick={() => toggleFavorite(listing.id)}
                    className={`p-2 rounded-full border transition-colors ${
                      isFavorite(listing.id)
                        ? 'border-red-300 text-red-500 bg-red-50'
                        : 'border-gray-300 text-gray-400 hover:text-red-400'
                    }`}
                    aria-label={isFavorite(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Price */}
                <div className="text-3xl font-bold text-green-700 mb-6">
                  {formatPrice(listing.price, listing.currency, listing.listing_type)}
                </div>

                {/* Property specs grid */}
                <div className="mb-6">
                  <PropertySpecs listing={listing} />
                </div>

                {/* Description */}
                {listing.description && (
                  <div className="mb-6">
                    <h2 className="font-semibold mb-2">Description</h2>
                    <div
                      className={`text-sm text-gray-600 whitespace-pre-line ${
                        !descExpanded && listing.description.length > 500
                          ? 'line-clamp-6'
                          : ''
                      }`}
                    >
                      {listing.description}
                    </div>
                    {listing.description.length > 500 && (
                      <button
                        onClick={() => setDescExpanded(!descExpanded)}
                        className="flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        {descExpanded ? (
                          <>
                            Show less <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Show more <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Contact */}
                {(listing.contact_name || listing.contact_phone || listing.contact_email) && (
                  <div className="border-t pt-4 mb-6">
                    <h2 className="font-semibold mb-2">Contact</h2>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {listing.contact_name && (
                        <span className="font-medium">{listing.contact_name}</span>
                      )}
                      {listing.contact_phone && (
                        <a
                          href={`tel:${listing.contact_phone}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Phone className="w-3 h-3" /> {listing.contact_phone}
                        </a>
                      )}
                      {listing.contact_email && (
                        <a
                          href={`mailto:${listing.contact_email}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <Mail className="w-3 h-3" /> {listing.contact_email}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Share + Actions */}
                <div className="border-t pt-4 mb-4">
                  <ShareButtons
                    url={`/listings/${listing.id}`}
                    title={listing.title}
                    originalUrl={listing.url}
                  />
                </div>

                {/* Metadata */}
                <div className="border-t pt-4 text-xs text-gray-500 flex flex-wrap gap-4">
                  <span>Source: {listing.source}</span>
                  <span>
                    First seen: {new Date(listing.first_seen_at).toLocaleDateString()}
                  </span>
                  <span>
                    Last seen: {new Date(listing.last_seen_at).toLocaleDateString()}
                  </span>
                  {listing.agency_name && <span>Agency: {listing.agency_name}</span>}
                </div>
              </div>
            </div>

            {/* Similar Properties */}
            <SimilarProperties
              currentListingId={listing.id}
              district={listing.district}
              listingType={listing.listing_type}
            />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
