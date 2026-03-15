'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import Link from 'next/link';
import { getListings } from '@/lib/api';
import { ListingCard } from '@/components/listing-card';
import { ListingFilters } from '@/components/listing-filters';
import { Navbar } from '@/components/navbar';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

function SearchPage() {
  const searchParams = useSearchParams();

  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (value) params[key] = value;
  });
  if (!params.page) params.page = '1';

  const { data, isLoading, error } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => getListings(params),
  });

  const page = parseInt(params.page, 10);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <ListingFilters />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-500">
            Failed to load listings. Is the API server running?
          </div>
        )}

        {data && (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                {data.total} listing{data.total !== 1 ? 's' : ''} found
              </p>
            </div>

            {data.listings.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                No listings match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                {page > 1 ? (
                  <Link
                    href={`/?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 text-sm text-gray-300">
                    <ChevronLeft className="w-4 h-4 inline" /> Previous
                  </span>
                )}

                <span className="text-sm text-gray-500">
                  Page {page} of {data.total_pages}
                </span>

                {page < data.total_pages ? (
                  <Link
                    href={`/?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 text-sm text-gray-300">
                    Next <ChevronRight className="w-4 h-4 inline" />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
