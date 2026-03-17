'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { validatePriceRange } from '@/lib/validation';
import { getActiveFilterChips } from '@/lib/filters';

const DISTRICTS = ['limassol', 'paphos', 'nicosia', 'larnaca', 'famagusta'];
const PROPERTY_TYPES = ['apartment', 'house', 'studio', 'villa', 'land', 'commercial'];
const BATHROOM_OPTIONS = [1, 2, 3, 4];
const PRICE_PRESETS = [
  { label: 'Under \u20AC500', min: '', max: '500' },
  { label: '\u20AC500-1000', min: '500', max: '1000' },
  { label: '\u20AC1000-2000', min: '1000', max: '2000' },
  { label: '\u20AC2000+', min: '2000', max: '' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export function ListingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Local state for debounced price inputs
  const [minPriceLocal, setMinPriceLocal] = useState(searchParams.get('min_price') ?? '');
  const [maxPriceLocal, setMaxPriceLocal] = useState(searchParams.get('max_price') ?? '');
  const [priceError, setPriceError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Refs to avoid stale closures in debounce
  const minPriceRef = useRef(minPriceLocal);
  const maxPriceRef = useRef(maxPriceLocal);

  // Sync local state when URL params change externally
  const urlMin = searchParams.get('min_price') ?? '';
  const urlMax = searchParams.get('max_price') ?? '';
  useEffect(() => {
    setMinPriceLocal(urlMin);
    setMaxPriceLocal(urlMax);
    minPriceRef.current = urlMin;
    maxPriceRef.current = urlMax;
  }, [urlMin, urlMax]);

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

  // Debounced price update with immediate validation
  const handlePriceChange = useCallback(
    (field: 'min_price' | 'max_price', value: string) => {
      let newMin = minPriceRef.current;
      let newMax = maxPriceRef.current;

      if (field === 'min_price') {
        setMinPriceLocal(value);
        minPriceRef.current = value;
        newMin = value;
      } else {
        setMaxPriceLocal(value);
        maxPriceRef.current = value;
        newMax = value;
      }

      // Validate immediately (show error without debounce)
      const min = newMin ? parseFloat(newMin) : undefined;
      const max = newMax ? parseFloat(newMax) : undefined;
      const validation = validatePriceRange(min, max);
      if (!validation.valid) {
        setPriceError(validation.error!);
        // Don't update URL with invalid values
        if (debounceRef.current) clearTimeout(debounceRef.current);
        return;
      }
      setPriceError('');

      // Debounce the URL update
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams({ [field]: value });
      }, 500);
    },
    [updateParams],
  );

  const handlePricePreset = (preset: { min: string; max: string }) => {
    setMinPriceLocal(preset.min);
    setMaxPriceLocal(preset.max);
    setPriceError('');
    updateParams({ min_price: preset.min, max_price: preset.max });
  };

  const clearAllFilters = () => {
    setMinPriceLocal('');
    setMaxPriceLocal('');
    setPriceError('');
    router.push('/');
  };

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete('page');
    if (key === 'min_price') setMinPriceLocal('');
    if (key === 'max_price') setMaxPriceLocal('');
    router.push(`/?${params.toString()}`);
  };

  // Count active filters (excluding sort and page)
  const activeParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (value && key !== 'page' && key !== 'per_page' && key !== 'sort') {
      activeParams[key] = value;
    }
  });
  const activeFilterCount = Object.keys(activeParams).length;
  const chips = getActiveFilterChips(activeParams);

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="search-input" className="sr-only">Search listings</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="search-input"
            type="text"
            name="q"
            placeholder="Search listings..."
            defaultValue={searchParams.get('q') ?? ''}
            key={searchParams.get('q') ?? ''}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Search
        </button>

        {/* Mobile filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="md:hidden flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          aria-expanded={filtersOpen}
          aria-controls="filter-panel"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </form>

      {/* Filter row - hidden on mobile unless toggled */}
      <div
        id="filter-panel"
        className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row flex-wrap gap-2`}
      >
        <label htmlFor="listing-type" className="sr-only">Listing type</label>
        <select
          id="listing-type"
          value={searchParams.get('type') ?? ''}
          onChange={(e) => updateParams({ type: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Types</option>
          <option value="rent">Rent</option>
          <option value="sale">Sale</option>
        </select>

        <label htmlFor="district-filter" className="sr-only">District</label>
        <select
          id="district-filter"
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

        <label htmlFor="property-type-filter" className="sr-only">Property type</label>
        <select
          id="property-type-filter"
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

        <div className="flex items-center gap-1">
          <label htmlFor="min-price" className="sr-only">Minimum price</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">&euro;</span>
            <input
              id="min-price"
              type="number"
              placeholder="Min"
              value={minPriceLocal}
              onChange={(e) => handlePriceChange('min_price', e.target.value)}
              aria-invalid={priceError ? 'true' : undefined}
              className={`w-24 pl-6 pr-2 py-1.5 border rounded-lg text-sm ${
                priceError ? 'border-red-400' : 'border-gray-300'
              }`}
            />
          </div>
          <span className="text-gray-400 text-xs">-</span>
          <label htmlFor="max-price" className="sr-only">Maximum price</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">&euro;</span>
            <input
              id="max-price"
              type="number"
              placeholder="Max"
              value={maxPriceLocal}
              onChange={(e) => handlePriceChange('max_price', e.target.value)}
              aria-invalid={priceError ? 'true' : undefined}
              className={`w-24 pl-6 pr-2 py-1.5 border rounded-lg text-sm ${
                priceError ? 'border-red-400' : 'border-gray-300'
              }`}
            />
          </div>
        </div>

        {/* Price presets */}
        <div className="flex flex-wrap gap-1">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePricePreset(preset)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label htmlFor="bedrooms-filter" className="sr-only">Bedrooms</label>
        <select
          id="bedrooms-filter"
          value={searchParams.get('min_bedrooms') ?? ''}
          onChange={(e) => updateParams({ min_bedrooms: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Any Beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+ beds
            </option>
          ))}
        </select>

        <label htmlFor="bathrooms-filter" className="sr-only">Bathrooms</label>
        <select
          id="bathrooms-filter"
          value={searchParams.get('min_bathrooms') ?? ''}
          onChange={(e) => updateParams({ min_bathrooms: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">Any Baths</option>
          {BATHROOM_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}+ baths
            </option>
          ))}
        </select>

        <label htmlFor="sort-filter" className="sr-only">Sort order</label>
        <select
          id="sort-filter"
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

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Price validation error */}
      {priceError && (
        <p className="text-xs text-red-500" role="alert">{priceError}</p>
      )}

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="hover:text-blue-900"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
