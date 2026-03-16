# Implementation Plan: UI/UX Overhaul (P0-P3) + Tailwind Migration

## Current State Summary

- **Frontend**: Next.js 15 (App Router) in `web/`, already using Tailwind CSS v4 via `@tailwindcss/postcss` plugin with `@import "tailwindcss"` in globals.css. All existing components already use Tailwind utility classes.
- **Backend**: Express API at `src/api/server.ts` with `/api/listings`, `/api/stats`, `/api/webhooks`, etc.
- **Components**: 5 components (`listing-card`, `listing-filters`, `navbar`, `providers`, plus `lib/api.ts`)
- **Pages**: 4 pages (`/`, `/listings/[id]`, `/dashboard`, `/webhooks`)
- **CSS**: Already Tailwind v4 -- no migration needed, just extend usage
- **Testing**: vitest in root for backend; no frontend test infra yet

## Implementation Order

Work is organized into 7 phases. Each phase lists exact files and changes.

---

## Phase 1: Test Infrastructure + Image Proxy (P0 Critical)

### 1A. Frontend Test Infrastructure

**New file: `web/vitest.config.ts`**
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**New file: `web/src/test/setup.ts`**
```ts
import '@testing-library/jest-dom/vitest';
```

**Modify: `web/package.json`** -- add devDependencies:
- `vitest` `^2.1.0`
- `@vitejs/plugin-react` `^4.3.0`
- `jsdom` `^25.0.0`
- `@testing-library/react` `^16.0.0`
- `@testing-library/jest-dom` `^6.6.0`
- `@testing-library/user-event` `^14.5.0`

Add script: `"test": "vitest run"`, `"test:watch": "vitest"`

### 1B. Image Proxy Route (P0 #1 -- Broken images 70% failure)

Images fail because external sites block hotlinking. Solution: server-side proxy.

**New file: `web/src/app/api/image-proxy/route.ts`** (Next.js Route Handler)

API Contract:
- `GET /api/image-proxy?url=<encoded-url>`
- Query param: `url` (required) -- URL-encoded external image URL
- Validates URL: must be `https://` or `http://`, must not be local/private IP
- Allowed hosts: any (these are scraped property images from various sites)
- Streams the response with original `Content-Type` and `Cache-Control: public, max-age=86400`
- Returns 400 for missing/invalid URL, 502 for upstream fetch failure
- Sets `Referer` header matching the origin domain to avoid hotlink blocks
- Max response size: 10MB (abort if exceeded)

Implementation:
```
1. Parse and validate `url` query param
2. Reject non-http(s) URLs, private/loopback IPs
3. fetch() with timeout (10s), User-Agent spoofing, Referer set to origin
4. Stream response body with Content-Type passthrough
5. Set Cache-Control: public, max-age=86400, immutable
```

**New file: `web/src/lib/image-proxy.ts`** -- helper utilities:
- `getProxiedImageUrl(originalUrl: string): string` -- returns `/api/image-proxy?url=<encoded>`
- `isValidImageUrl(url: string): boolean` -- validates URL format
- Exported for use in components and tests

### 1C. Fix Broken Images in Components

**Modify: `web/src/components/listing-card.tsx`**
- Import `getProxiedImageUrl` from `@/lib/image-proxy`
- Change `src={firstImage}` to `src={getProxiedImageUrl(firstImage)}`
- Add `onError` handler that hides the image and shows fallback Building icon
- Add fallback state using React state

**Modify: `web/src/app/listings/[id]/page.tsx`**
- Import `getProxiedImageUrl`
- Proxy all image URLs: `src={getProxiedImageUrl(img.url)}`
- Add `onError` fallback per image

### 1D. Search Enter Key Fix (P0 #2)

**Current state**: The `listing-filters.tsx` already has `<form onSubmit={handleSubmit}>` with `e.preventDefault()` and the search input is inside it. The Enter key SHOULD work. Investigating: the `<form>` wraps only the search bar, not the filters. This looks correct.

**Verify & Fix**: The form submit handler already calls `e.preventDefault()` and uses `updateParams`. The issue may be that the input uses `name="q"` and `defaultValue` (uncontrolled). On Enter, `handleSubmit` reads from `FormData` which should work. Test to confirm, but likely this is already working in current code. If not, convert to controlled input with `onChange` + state + submit on Enter.

**Modify: `web/src/components/listing-filters.tsx`**
- Add explicit `onKeyDown` handler on the search input as a safety net: if `e.key === 'Enter'`, submit the form programmatically
- This ensures Enter works even if there's a subtle form submission issue

### 1E. Price Filter Validation (P0 #3)

**Modify: `web/src/components/listing-filters.tsx`**
- Add validation: when `min_price` changes, if `min_price > max_price` and both are set, show inline error text "Min must be less than max" and do NOT update URL params
- Add validation: when `max_price` changes, same check
- Use local state for price inputs (convert from uncontrolled `value` to debounced controlled)
- Add `aria-invalid` attribute when validation fails
- Prices must be non-negative

**Modify: `src/api/server.ts`** (backend validation)
- In `/api/listings` handler, after parsing `min_price` and `max_price`:
  - If both provided and `min_price > max_price`, return 400: `{ error: "min_price must be <= max_price" }`
  - If either is negative, return 400

**New file: `web/src/lib/validation.ts`**
- `validatePriceRange(min?: number, max?: number): { valid: boolean; error?: string }`
- `formatPrice(price: number, currency: string, listingType: string): string`
- These are pure functions, easily unit-testable

### 1F. Phase 1 Tests

**New file: `web/src/lib/__tests__/validation.test.ts`** (~6 tests)
- `validatePriceRange`: both empty = valid, min only = valid, max only = valid, min < max = valid, min > max = invalid, negative = invalid

**New file: `web/src/lib/__tests__/image-proxy.test.ts`** (~6 tests)
- `getProxiedImageUrl`: returns correct proxy URL, handles special chars
- `isValidImageUrl`: rejects non-http, rejects empty, accepts valid URLs, rejects private IPs

**New file: `web/src/app/api/image-proxy/__tests__/route.test.ts`** (~5 tests)
- Missing URL param returns 400
- Invalid URL returns 400
- Private IP URL returns 400
- Successful proxy returns 200 with correct headers (mock fetch)
- Upstream failure returns 502

---

## Phase 2: Mobile Responsiveness + Filter Bar UX (P1 #4, #5)

### 2A. Mobile Responsive Layout

**Modify: `web/src/app/page.tsx`**
- Grid is already responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` -- this is fine
- Ensure padding adjusts: `px-4 sm:px-6 lg:px-8`
- Pagination: stack vertically on mobile: `flex-col sm:flex-row`

**Modify: `web/src/components/navbar.tsx`**
- Add hamburger menu for mobile: hidden on `md:` and above
- Mobile menu slides down with nav links
- Use React state for open/close
- Add `aria-expanded`, `aria-controls` for accessibility

**Modify: `web/src/components/listing-filters.tsx`**
- On mobile (`< md`), collapse filters into an expandable panel with "Filters" toggle button
- Show active filter count badge on the toggle
- Responsive: `flex-col md:flex-row` for filter row

### 2B. Filter Bar UX Redesign (P1 #5)

**Modify: `web/src/components/listing-filters.tsx`** (major rework)

Add these features:
1. **Clear all filters button**: Appears when any filter is active. Resets all params to defaults.
2. **Active filter chips**: Below filter bar, show removable chips for each active filter (e.g., "Rent x", "Limassol x", "Min: EUR500 x")
3. **Euro prefix on price inputs**: Use Tailwind `relative` + `absolute` positioned euro sign, or input group with prefix span
4. **"Any Beds" label**: Change default option from "Beds" to "Any Beds"
5. **Bathroom filter**: Add new `<select>` for `min_bathrooms` (1-4+)
6. **Area filter**: Add min/max area inputs with "m2" suffix
7. **Price range presets**: Dropdown or quick buttons: "Under EUR500", "EUR500-1000", "EUR1000-2000", "EUR2000+"

New constants to add:
```ts
const BATHROOM_OPTIONS = [1, 2, 3, 4];
const PRICE_PRESETS = [
  { label: 'Under EUR500', min: '', max: '500' },
  { label: 'EUR500-1000', min: '500', max: '1000' },
  { label: 'EUR1000-2000', min: '1000', max: '2000' },
  { label: 'EUR2000+', min: '2000', max: '' },
];
```

**Modify: `src/api/server.ts`** -- add support for new filter params:
- `min_bathrooms`, `max_bathrooms` -- pass to DB queries
- `min_area`, `max_area` -- pass to DB queries

**Modify: `src/db/queries.ts`** -- extend `searchListings` and `getListings`:
- Add `minBathrooms`, `maxBathrooms`, `minArea`, `maxArea` filter params
- Add WHERE clauses: `bathrooms >= $N`, `area_sqm >= $N`, etc.

### 2C. Phase 2 Tests

**New file: `web/src/components/__tests__/listing-filters.test.tsx`** (~10 tests)
- Renders all filter elements
- Enter key triggers search
- Price validation shows error when min > max
- Clear filters resets all params
- Filter chips appear for active filters
- Removing a chip updates URL
- Price presets apply correct values
- Bathroom filter renders options
- Area filter renders with suffix

**New file: `web/src/lib/__tests__/filters.test.ts`** (~3 tests)
- Filter serialization to/from URL params
- Filter chip generation from active params

---

## Phase 3: Property Card Redesign (P1 #7)

**Modify: `web/src/components/listing-card.tsx`** (significant rework)

Changes:
1. **Image proxy**: Already done in Phase 1
2. **Bed/bath/sqm icons**: Already present (Bed, Bath, Maximize from lucide). Enhance with consistent icon+text pairs in a horizontal bar
3. **Clean location text**: Strip raw HTML tags if present. Parse location to show "District, City" format. Add `sanitizeLocation(location: string): string` to `lib/format.ts`
4. **Hover states**: Already has `group-hover:scale-105` on image and `group-hover:text-blue-600` on title. Add subtle `hover:shadow-lg` transition, `hover:border-blue-200`
5. **NEW badge**: Show "NEW" badge if `first_seen_at` is within last 48 hours. Position: top-right corner with `absolute` positioning. Green/teal background.
6. **Favorite icon (heart)**: Add a heart icon button (top-right, below NEW badge). On click, toggle favorite in localStorage. Use `Heart` from lucide-react. This is purely client-side for now.
7. **Source badge**: Small badge at bottom showing source name with color coding

**New file: `web/src/lib/format.ts`**
- `formatPrice(price: number | null, currency: string, listingType: string): string`
- `sanitizeLocation(location: string): string` -- strip HTML, normalize
- `isNewListing(firstSeenAt: string, hoursThreshold?: number): boolean`
- `getSourceColor(source: string): string` -- returns Tailwind color class per source

**New file: `web/src/hooks/use-favorites.ts`**
- `useFavorites()` hook -- reads/writes `localStorage` key `favorites` (array of listing IDs)
- Returns `{ isFavorite(id), toggleFavorite(id), favorites }`

### 3B. Phase 3 Tests

**New file: `web/src/components/__tests__/listing-card.test.tsx`** (~9 tests)
- Renders with proxy URL for images
- Shows fallback when no image
- Shows NEW badge for recent listings
- Does not show NEW badge for old listings
- Formats price correctly (EUR, rent/sale)
- Shows bed/bath/area when present
- Hides bed/bath/area when null
- Favorite toggle works
- Source badge displays

---

## Phase 4: Detail Page Rebuild (P1 #6)

### 4A. Image Carousel/Lightbox

**New file: `web/src/components/image-carousel.tsx`**
- Props: `images: Array<{ url: string; order: number }>`, `title: string`
- Main image display with left/right navigation arrows
- Thumbnail strip below (scrollable horizontally)
- Click main image opens lightbox (full-screen overlay)
- Keyboard navigation: left/right arrows, Escape to close
- Image counter: "3 / 12"
- All images through proxy URL
- Touch swipe support for mobile (use pointer events)

**New file: `web/src/components/lightbox.tsx`**
- Full-screen overlay with close button
- Left/right navigation
- Keyboard: Escape, ArrowLeft, ArrowRight
- Click outside image to close
- `aria-modal="true"`, focus trap

### 4B. Detail Page Layout

**Modify: `web/src/app/listings/[id]/page.tsx`** (major rework)

New layout structure:
```
Navbar
Breadcrumbs: Home > Listings > [Title]
ImageCarousel (full width or 2/3)
PropertySpecsGrid (sidebar or below on mobile)
  - Price (large)
  - Type badge
  - Beds, Baths, Area, Furnished, Property type, District
  - Listed date
  - Source
FullDescription (expandable if long, "Show more" toggle)
Map (Leaflet/OpenStreetMap) -- if lat/lng available, or geocode from location
ContactSection
ShareButtons (copy link, open in new tab to original)
SimilarProperties (3-4 cards, same district + type)
```

**New file: `web/src/components/property-specs.tsx`**
- Grid of spec items with icons
- Responsive: 2 cols on mobile, 4 cols on desktop

**New file: `web/src/components/breadcrumbs.tsx`**
- Generic breadcrumb component
- Props: `items: Array<{ label: string; href?: string }>`
- Last item is not a link (current page)
- `aria-label="Breadcrumb"` on nav, `aria-current="page"` on last

**New file: `web/src/components/share-buttons.tsx`**
- Copy link to clipboard (with toast feedback)
- Open original listing URL
- Native share API on mobile (`navigator.share` if available)

**New file: `web/src/components/similar-properties.tsx`**
- Props: `currentListingId: number`, `district: string`, `listingType: string`
- Fetches from API: `/api/listings?district=X&type=Y&per_page=4&exclude=ID`
- Renders as horizontal scroll of ListingCard components

**Modify: `web/src/lib/api.ts`**
- No new endpoint needed; reuse `getListings` with appropriate params
- Optionally add `exclude` param support

**Modify: `src/api/server.ts`**
- Add `exclude` query param to `/api/listings` -- excludes listing by ID from results

### 4C. Map Component (Optional/Deferred)

**New file: `web/src/components/listing-map.tsx`**
- Uses `leaflet` + `react-leaflet` (add to web/package.json dependencies)
- Only render if listing has geocodable location
- Lazy-loaded with `dynamic(() => import(...), { ssr: false })` to avoid SSR issues
- Fallback: show location text if map can't render
- Note: Geocoding from text address requires a service; for MVP, skip map if no coords. Can be enhanced later with Nominatim (free OSM geocoder).

**Modify: `web/package.json`** -- add dependencies:
- `leaflet` `^1.9.0`
- `react-leaflet` `^4.2.0`
- `@types/leaflet` (devDep)

---

## Phase 5: Visual Hierarchy, SEO, Accessibility (P2 #8-10)

### 5A. Hero Section + Footer

**New file: `web/src/components/hero.tsx`**
- Shown only on home page (not on detail/dashboard/webhooks)
- Background gradient or subtle pattern
- H1: "Find Your Perfect Property in Cyprus"
- Subtitle: "Search across 10+ sources for rentals and sales"
- Integrates search bar (can reuse or duplicate from filters)
- Responsive: tall on desktop, compact on mobile

**New file: `web/src/components/footer.tsx`**
- Simple footer with copyright, link to dashboard, link to webhooks
- Consistent across all pages

**Modify: `web/src/app/layout.tsx`**
- Add `<Footer />` inside body, after `{children}`
- Add Google Fonts link for Inter (or use Tailwind's default font stack)

**Modify: `web/src/app/page.tsx`**
- Add `<Hero />` component above filters
- The hero contains the search, so on home page the filter bar search is hidden (or the hero IS the search)

### 5B. Skeleton Loading States

**New file: `web/src/components/skeleton.tsx`**
- `SkeletonCard`: mimics ListingCard shape with animated pulse
- `SkeletonGrid`: renders 8 SkeletonCards in the grid
- `SkeletonDetail`: mimics detail page layout with pulse

**Modify: `web/src/app/page.tsx`**
- Replace `<Loader2>` spinner with `<SkeletonGrid />` when `isLoading`

**Modify: `web/src/app/listings/[id]/page.tsx`**
- Replace spinner with `<SkeletonDetail />`

### 5C. SEO: H1 Tags

**Modify: `web/src/app/page.tsx`**
- H1 is in the Hero component: "Find Your Perfect Property in Cyprus"

**Modify: `web/src/app/listings/[id]/page.tsx`**
- Already has `<h1>` for listing title -- good

**Modify: `web/src/app/dashboard/page.tsx`**
- Already has `<h1>Dashboard</h1>` -- good

**Modify: `web/src/app/webhooks/page.tsx`**
- Already has `<h1>Webhooks</h1>` -- good

### 5D. Accessibility

**Modify: all components and pages:**

1. **Skip-to-content link**: Add to `web/src/app/layout.tsx`
   ```tsx
   <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600">
     Skip to content
   </a>
   ```
   Add `id="main-content"` to each page's `<main>` tag.

2. **Form labels**: In `listing-filters.tsx`, add `<label>` elements (visually hidden with `sr-only` class) for every input/select:
   - `<label htmlFor="search-input" className="sr-only">Search listings</label>`
   - `<label htmlFor="listing-type" className="sr-only">Listing type</label>`
   - etc.

3. **aria-labels**:
   - Navbar: `<nav aria-label="Main navigation">`
   - Pagination: `<nav aria-label="Pagination">`
   - Cards: `aria-label` on the Link
   - Modals/lightbox: `aria-modal="true"`, `role="dialog"`

4. **Focus indicators**: Add to `web/src/app/globals.css`:
   ```css
   @layer base {
     *:focus-visible {
       outline: 2px solid #2563eb;
       outline-offset: 2px;
     }
   }
   ```

5. **Color contrast**: Ensure all text meets WCAG AA (4.5:1 for normal text). Audit:
   - `text-gray-400` on white may fail -- change to `text-gray-500` where needed
   - `text-gray-300` for disabled pagination -- change to `text-gray-400` with `aria-disabled`

### 5E. Badge Refinement + Shadows

**Modify: `web/src/components/listing-card.tsx`**
- Add `shadow-sm hover:shadow-md` transition (already present, verify)
- Refine badge styles: slightly rounded, consistent padding

**Modify: `web/src/app/globals.css`**
- Add custom Tailwind theme extensions if needed (colors, fonts)
- Add base layer styles for consistent typography

---

## Phase 6: Dashboard Improvements (P2 #11)

**Modify: `web/src/app/dashboard/page.tsx`**

1. **Confirmation dialog for Run Scrapers**: Replace direct `handleRunScrape()` call with a confirmation modal
   - "Are you sure you want to run all scrapers? This may take several minutes."
   - Confirm / Cancel buttons

**New file: `web/src/components/confirm-dialog.tsx`**
- Generic confirmation dialog component
- Props: `open`, `title`, `message`, `onConfirm`, `onCancel`
- Uses `<dialog>` element or portal overlay
- `aria-modal`, focus trap, Escape to close

2. **Source filter on scrape runs table**: Add a `<select>` to filter the runs table by source

3. **Clarify stats**: Add labels/tooltips explaining what "Total" vs "Active" means. Add "Inactive" count derived from total - active.

4. **Line chart** (stretch): Add a simple scrape activity chart showing new listings over time
   - Use lightweight library or SVG-based inline chart
   - Data: last 7 days of scrape runs, aggregate new_listings by day
   - This is optional and can be deferred if complex

---

## Phase 7: P3 Nice-to-Have Features

### 7A. URL-Shareable Filter State

**Current state**: Filters already use URL search params via `useSearchParams()`. This should already be shareable. Verify and fix any issues.

**Modify: `web/src/components/listing-filters.tsx`**
- Ensure all filter state is fully serialized to URL
- On page load, all filters are correctly initialized from URL params
- Sort persistence: already uses URL param `sort`

### 7B. Infinite Scroll

**Modify: `web/src/app/page.tsx`**
- Replace pagination with infinite scroll using `IntersectionObserver`
- Use `useInfiniteQuery` from `@tanstack/react-query` instead of `useQuery`
- Keep "Load more" button as fallback
- Show skeleton cards while loading next page
- Retain pagination as an option (toggle or just remove pagination UI)

### 7C. Saved Searches with Alerts

**New file: `web/src/components/save-search.tsx`**
- Button to save current filter state to localStorage
- Name the saved search
- List saved searches in a dropdown/panel

**New file: `web/src/hooks/use-saved-searches.ts`**
- CRUD operations on `localStorage` key `saved-searches`
- Each saved search: `{ id, name, filters: Record<string,string>, createdAt }`

### 7D. Dark Mode

**Modify: `web/src/app/globals.css`**
- Add `@media (prefers-color-scheme: dark)` overrides OR use Tailwind `dark:` variants
- Add a toggle in navbar

**Modify: `web/src/app/layout.tsx`**
- Add `class="dark"` toggle support on `<html>` element

**Modify: all components**
- Add `dark:` variant classes (e.g., `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`)

### 7E. Sort Persistence

Already handled by URL params. Verify it persists across page navigation.

### 7F. Comparison View, Multi-language, Price History

These are larger features that require more infrastructure:
- **Comparison view**: Side-by-side property comparison. New page `/compare?ids=1,2,3`. Fetch multiple listings, render in table.
- **Multi-language**: i18n framework (next-intl or similar). Significant effort -- defer.
- **Price history**: Already tracked in `price_history` table. Add API endpoint `/api/listings/:id/price-history`. Show chart on detail page.

---

## File Summary

### New Files (23)
| File | Phase | Purpose |
|------|-------|---------|
| `web/vitest.config.ts` | 1A | Frontend test config |
| `web/src/test/setup.ts` | 1A | Test setup with jest-dom |
| `web/src/app/api/image-proxy/route.ts` | 1B | Image proxy API route |
| `web/src/lib/image-proxy.ts` | 1B | Image proxy URL helpers |
| `web/src/lib/validation.ts` | 1E | Price validation utilities |
| `web/src/lib/format.ts` | 3 | Formatting helpers |
| `web/src/hooks/use-favorites.ts` | 3 | Favorites localStorage hook |
| `web/src/components/image-carousel.tsx` | 4A | Image carousel with nav |
| `web/src/components/lightbox.tsx` | 4A | Fullscreen image viewer |
| `web/src/components/property-specs.tsx` | 4B | Property specs grid |
| `web/src/components/breadcrumbs.tsx` | 4B | Breadcrumb navigation |
| `web/src/components/share-buttons.tsx` | 4B | Share/copy link buttons |
| `web/src/components/similar-properties.tsx` | 4B | Similar listings section |
| `web/src/components/listing-map.tsx` | 4C | Leaflet map (lazy) |
| `web/src/components/hero.tsx` | 5A | Hero section for home |
| `web/src/components/footer.tsx` | 5A | Site footer |
| `web/src/components/skeleton.tsx` | 5B | Skeleton loading states |
| `web/src/components/confirm-dialog.tsx` | 6 | Confirmation dialog |
| `web/src/components/save-search.tsx` | 7C | Saved searches UI |
| `web/src/hooks/use-saved-searches.ts` | 7C | Saved searches hook |
| `web/src/lib/__tests__/validation.test.ts` | 1F | Validation unit tests |
| `web/src/lib/__tests__/image-proxy.test.ts` | 1F | Image proxy unit tests |
| `web/src/app/api/image-proxy/__tests__/route.test.ts` | 1F | Image proxy API tests |

### New Test Files (5)
| File | Phase | Test Count |
|------|-------|------------|
| `web/src/lib/__tests__/validation.test.ts` | 1F | ~6 |
| `web/src/lib/__tests__/image-proxy.test.ts` | 1F | ~6 |
| `web/src/app/api/image-proxy/__tests__/route.test.ts` | 1F | ~5 |
| `web/src/components/__tests__/listing-filters.test.tsx` | 2C | ~10 |
| `web/src/components/__tests__/listing-card.test.tsx` | 3B | ~9 |

**Total: ~36 tests**

### Modified Files (10)
| File | Phases | Changes |
|------|--------|---------|
| `web/package.json` | 1A, 4C | Add test deps, leaflet |
| `web/src/app/globals.css` | 5D, 7D | Focus indicators, dark mode |
| `web/src/app/layout.tsx` | 5A, 5D, 7D | Footer, skip-link, dark mode |
| `web/src/app/page.tsx` | 2A, 5A, 5B, 7B | Hero, skeleton, infinite scroll |
| `web/src/app/listings/[id]/page.tsx` | 1C, 4B, 5B | Proxy images, full rebuild |
| `web/src/app/dashboard/page.tsx` | 6 | Confirm dialog, source filter |
| `web/src/components/listing-card.tsx` | 1C, 3 | Proxy, NEW badge, favorites, source |
| `web/src/components/listing-filters.tsx` | 1D, 1E, 2A, 2B | Enter fix, validation, mobile, UX |
| `web/src/components/navbar.tsx` | 2A | Mobile hamburger menu |
| `web/src/lib/api.ts` | 4B | Exclude param support |
| `src/api/server.ts` | 1E, 2B, 4B | Price validation, new filters, exclude |
| `src/db/queries.ts` | 2B | Bathroom/area filter support |

---

## Dependency Graph

```
Phase 1 (P0 Critical) -- no dependencies
  1A: Test infra
  1B: Image proxy route (depends on nothing)
  1C: Fix images in components (depends on 1B)
  1D: Search Enter key (independent)
  1E: Price validation (independent)
  1F: Tests (depends on 1A-1E)

Phase 2 (P1 Filters) -- depends on Phase 1
  2A: Mobile responsive (independent)
  2B: Filter bar UX (depends on 1E for validation)
  2C: Tests (depends on 2A, 2B)

Phase 3 (P1 Cards) -- depends on Phase 1C
  Listing card redesign + tests

Phase 4 (P1 Detail) -- depends on Phase 1C, 3
  4A: Carousel/lightbox (independent)
  4B: Detail page rebuild (depends on 4A, uses components from Phase 3)
  4C: Map (independent, optional)

Phase 5 (P2 Polish) -- depends on Phase 2, 3
  5A: Hero/footer (independent)
  5B: Skeletons (independent)
  5C: SEO (independent)
  5D: Accessibility (applies across all components)

Phase 6 (P2 Dashboard) -- independent of other P2 work
  Dashboard improvements

Phase 7 (P3 Nice-to-have) -- depends on Phase 2-5
  7A: URL state (verify existing)
  7B: Infinite scroll (depends on Phase 2)
  7C: Saved searches
  7D: Dark mode
  7E-F: Stretch goals
```

---

## CSS/Tailwind Notes

The project already uses Tailwind CSS v4 (via `@tailwindcss/postcss` with `@import "tailwindcss"` in globals.css). All existing components already use Tailwind utility classes exclusively. There is NO legacy CSS file to migrate.

The globals.css file is currently just `@import "tailwindcss"`. We will add:
- Focus indicator base styles
- Dark mode CSS variables (if using CSS-based approach)
- Any custom `@layer` rules for typography or reusable patterns

No Tailwind config file is needed for v4 (it uses CSS-first configuration). Custom theme values can be added via `@theme` directive in globals.css if needed.

---

## Backend Changes Summary

The backend (`src/api/server.ts` + `src/db/queries.ts`) needs minimal changes:

1. **Price validation** (Phase 1E): Add 400 response for invalid price ranges in `/api/listings`
2. **New filter params** (Phase 2B): Forward `min_bathrooms`, `max_bathrooms`, `min_area`, `max_area` to DB queries
3. **Exclude param** (Phase 4B): Add `exclude` query param to `/api/listings` to exclude a listing by ID
4. **DB query extensions** (Phase 2B): Add WHERE clauses for bathrooms and area filters in `searchListings` and `getListings`

No new backend routes except the image proxy (which is a Next.js API route in `web/`, not in the Express backend).

---

## Estimated Effort per Phase

| Phase | Complexity | Est. Lines Changed/Added |
|-------|-----------|------------------------|
| Phase 1 (P0) | Medium | ~600 lines |
| Phase 2 (P1 Filters) | High | ~800 lines |
| Phase 3 (P1 Cards) | Medium | ~400 lines |
| Phase 4 (P1 Detail) | High | ~900 lines |
| Phase 5 (P2 Polish) | Medium | ~500 lines |
| Phase 6 (P2 Dashboard) | Low | ~200 lines |
| Phase 7 (P3) | High | ~600 lines |
| **Total** | | **~4000 lines** |
