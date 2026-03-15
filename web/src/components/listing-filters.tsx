'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Search } from 'lucide-react';

const DISTRICTS = ['limassol', 'paphos', 'nicosia', 'larnaca', 'famagusta'];
const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'villa', 'land', 'commercial'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export function ListingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete('page'); // Reset to page 1
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    updateParams({ q });
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            name="q"
            placeholder="Search listings..."
            defaultValue={searchParams.get('q') ?? ''}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <select
          value={searchParams.get('type') ?? ''}
          onChange={(e) => updateParams({ type: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Types</option>
          <option value="rent">Rent</option>
          <option value="sale">Sale</option>
        </select>

        <select
          value={searchParams.get('district') ?? ''}
          onChange={(e) => updateParams({ district: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Districts</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get('property_type') ?? ''}
          onChange={(e) => updateParams({ property_type: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Property Types</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min price"
          value={searchParams.get('min_price') ?? ''}
          onChange={(e) => updateParams({ min_price: e.target.value })}
          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />

        <input
          type="number"
          placeholder="Max price"
          value={searchParams.get('max_price') ?? ''}
          onChange={(e) => updateParams({ max_price: e.target.value })}
          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />

        <select
          value={searchParams.get('min_bedrooms') ?? ''}
          onChange={(e) => updateParams({ min_bedrooms: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+ beds
            </option>
          ))}
        </select>

        <select
          value={searchParams.get('sort') ?? 'newest'}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
