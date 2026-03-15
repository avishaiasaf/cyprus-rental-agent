'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getListing } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Phone,
  Mail,
  ExternalLink,
  Loader2,
  Building,
} from 'lucide-react';

export default function ListingDetail() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListing(id),
    enabled: !isNaN(id),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to listings
        </button>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-500">
            Failed to load listing.
          </div>
        )}

        {listing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Image Gallery */}
            {listing.images.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-96 overflow-hidden">
                {listing.images.slice(0, 4).map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt={`${listing.title} - ${i + 1}`}
                    className={`w-full object-cover ${
                      i === 0 && listing.images.length > 1
                        ? 'md:row-span-2 h-96'
                        : 'h-48'
                    }`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
            ) : (
              <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                <Building className="w-16 h-16" />
              </div>
            )}

            {/* Details */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase mb-2 ${
                      listing.listing_type === 'rent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    For {listing.listing_type}
                  </span>
                  <h1 className="text-2xl font-bold">{listing.title}</h1>
                </div>
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" /> View original
                </a>
              </div>

              <div className="text-3xl font-bold text-green-700 mb-4">
                {listing.price != null
                  ? `${listing.currency === 'EUR' ? '\u20AC' : listing.currency}${listing.price.toLocaleString()}${
                      listing.listing_type === 'rent' ? '/mo' : ''
                    }`
                  : 'Price on request'}
              </div>

              {/* Property details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {listing.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{listing.location}</span>
                  </div>
                )}
                {listing.bedrooms != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bed className="w-4 h-4 text-gray-400" />
                    <span>{listing.bedrooms} bedrooms</span>
                  </div>
                )}
                {listing.bathrooms != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bath className="w-4 h-4 text-gray-400" />
                    <span>{listing.bathrooms} bathrooms</span>
                  </div>
                )}
                {listing.area_sqm != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Maximize className="w-4 h-4 text-gray-400" />
                    <span>{listing.area_sqm} m&sup2;</span>
                  </div>
                )}
                {listing.property_type && (
                  <div className="text-sm">
                    <span className="text-gray-400">Type:</span>{' '}
                    {listing.property_type}
                  </div>
                )}
                {listing.furnished != null && (
                  <div className="text-sm">
                    <span className="text-gray-400">Furnished:</span>{' '}
                    {listing.furnished ? 'Yes' : 'No'}
                  </div>
                )}
                {listing.district && (
                  <div className="text-sm">
                    <span className="text-gray-400">District:</span>{' '}
                    {listing.district.charAt(0).toUpperCase() + listing.district.slice(1)}
                  </div>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <div className="mb-6">
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Contact */}
              {(listing.contact_name || listing.contact_phone || listing.contact_email) && (
                <div className="border-t pt-4">
                  <h2 className="font-semibold mb-2">Contact</h2>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {listing.contact_name && (
                      <span>{listing.contact_name}</span>
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

              {/* Metadata */}
              <div className="border-t pt-4 mt-4 text-xs text-gray-400 flex flex-wrap gap-4">
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
        )}
      </main>
    </div>
  );
}
