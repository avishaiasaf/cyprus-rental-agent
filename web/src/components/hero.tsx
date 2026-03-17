'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function Hero() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Find Your Perfect Property in Cyprus
        </h1>
        <p className="text-blue-100 text-lg mb-8">
          Search across 10+ sources for rentals and sales
        </p>

        <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="hero-search" className="sr-only">
                Search properties
              </label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="hero-search"
                type="text"
                name="q"
                placeholder="Search by location, type, or keyword..."
                className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
