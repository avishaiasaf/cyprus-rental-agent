'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, X, Trash2 } from 'lucide-react';
import { useSavedSearches } from '@/hooks/use-saved-searches';

export function SaveSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searches, addSearch, removeSearch } = useSavedSearches();
  const [showPanel, setShowPanel] = useState(false);
  const [name, setName] = useState('');

  const currentFilters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (value && key !== 'page') currentFilters[key] = value;
  });

  const hasFilters = Object.keys(currentFilters).length > 0;

  const handleSave = () => {
    if (!name.trim()) return;
    addSearch(name.trim(), currentFilters);
    setName('');
  };

  const handleLoad = (filters: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    router.push(`/?${params.toString()}`);
    setShowPanel(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        aria-label="Saved searches"
      >
        <Bookmark className="w-4 h-4" />
        <span className="hidden sm:inline">Saved</span>
        {searches.length > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {searches.length}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Saved Searches</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Close saved searches"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Save current */}
          {hasFilters && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this search..."
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-2 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}

          {/* List */}
          {searches.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              No saved searches yet
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searches.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 group"
                >
                  <button
                    onClick={() => handleLoad(s.filters)}
                    className="flex-1 text-left text-sm text-blue-600 hover:underline truncate"
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => removeSearch(s.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
