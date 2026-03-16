# Test Plan: UI/UX Overhaul (P0-P3)

## Overview

This plan covers ~37 tests across 6 test files for the frontend portion of the implementation.
All frontend tests live under `web/` and use **vitest + @testing-library/react + jsdom**.

Audit items covered:
- **P0 #1** – Broken images (70% failure) → image proxy
- **P0 #2** – Search Enter key does not trigger search
- **P0 #3** – Price filter validation (min > max silently accepted)
- **P1 #4** – Mobile responsiveness
- **P1 #5** – Filter bar UX (clear, chips, presets)
- **P1 #7** – Property card redesign (proxy URL, fallback, NEW badge, favorites)

---

## Test Infrastructure

### Setup files to create (Phase 1A)

| File | Purpose |
|------|---------|
| `web/vitest.config.ts` | Vitest config with jsdom environment, React plugin, `@` alias |
| `web/src/test/setup.ts` | `import '@testing-library/jest-dom/vitest'` |

### Dependencies to add to `web/package.json`

```json
"devDependencies": {
  "vitest": "^2.1.0",
  "@vitejs/plugin-react": "^4.3.0",
  "jsdom": "^25.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/jest-dom": "^6.6.0",
  "@testing-library/user-event": "^14.5.0"
}
```

Add scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Run commands

```bash
# From the web/ directory
cd web && npm test

# Or from the repo root
cd web && npm run test

# Watch mode
cd web && npm run test:watch

# Run a single file
cd web && npx vitest run src/lib/__tests__/validation.test.ts
```

---

## Test Files

### 1. `web/src/lib/__tests__/validation.test.ts`

**Audit items**: P0 #3 (price filter validation)

**Source under test**: `web/src/lib/validation.ts` (new file)

**Mocks**: None (pure functions)

**Setup/teardown**: None

#### Test cases (~6 tests)

| # | Test name | What it verifies |
|---|-----------|-----------------|
| 1 | `validatePriceRange: both undefined returns valid` | `validatePriceRange(undefined, undefined)` → `{ valid: true }` |
| 2 | `validatePriceRange: min only returns valid` | `validatePriceRange(500, undefined)` → `{ valid: true }` |
| 3 | `validatePriceRange: max only returns valid` | `validatePriceRange(undefined, 1000)` → `{ valid: true }` |
| 4 | `validatePriceRange: min < max returns valid` | `validatePriceRange(500, 1000)` → `{ valid: true }` |
| 5 | `validatePriceRange: min > max returns invalid with error message` | `validatePriceRange(1000, 500)` → `{ valid: false, error: 'Min must be less than max' }` |
| 6 | `validatePriceRange: negative value returns invalid` | `validatePriceRange(-100, 500)` → `{ valid: false, error: /negative/i }` |

---

### 2. `web/src/lib/__tests__/image-proxy.test.ts`

**Audit items**: P0 #1 (broken images)

**Source under test**: `web/src/lib/image-proxy.ts` (new file)

**Mocks**: None (pure functions)

**Setup/teardown**: None

#### Test cases (~6 tests)

| # | Test name | What it verifies |
|---|-----------|-----------------|
| 1 | `getProxiedImageUrl: returns correct proxy path` | `getProxiedImageUrl('https://example.com/img.jpg')` → `/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimg.jpg` |
| 2 | `getProxiedImageUrl: encodes special characters in URL` | Input with `&`, `?`, `=` in original URL are percent-encoded in query param |
| 3 | `isValidImageUrl: accepts https URL` | `isValidImageUrl('https://example.com/img.jpg')` → `true` |
| 4 | `isValidImageUrl: accepts http URL` | `isValidImageUrl('http://example.com/img.jpg')` → `true` |
| 5 | `isValidImageUrl: rejects non-http scheme` | `isValidImageUrl('ftp://example.com/img.jpg')` → `false` |
| 6 | `isValidImageUrl: rejects empty string` | `isValidImageUrl('')` → `false` |

---

### 3. `web/src/app/api/image-proxy/__tests__/route.test.ts`

**Audit items**: P0 #1 (broken images – proxy API correctness)

**Source under test**: `web/src/app/api/image-proxy/route.ts` (new file, Next.js Route Handler)

**Mocks**:
- Mock global `fetch` using `vi.stubGlobal('fetch', mockFetch)` or `vi.fn()`
- Each test configures `mockFetch` to return different responses
- Reset mocks in `afterEach` with `vi.restoreAllMocks()`

**Setup/teardown**:
```ts
import { vi, describe, it, expect, afterEach } from 'vitest';
afterEach(() => vi.restoreAllMocks());
```

**Import pattern**: Import the `GET` handler directly from the route module and call it with a `Request` object.

#### Test cases (~5 tests)

| # | Test name | What it verifies |
|---|-----------|-----------------|
| 1 | `GET: missing url param returns 400` | `GET(new Request('http://localhost/api/image-proxy'))` → `response.status === 400` |
| 2 | `GET: invalid URL (non-http scheme) returns 400` | `url=ftp://...` → 400 |
| 3 | `GET: private/loopback IP URL returns 400` | `url=http://127.0.0.1/img.jpg` → 400 |
| 4 | `GET: successful upstream returns 200 with proxied body and headers` | Mock fetch returns `{ ok: true, body: stream, headers: { 'content-type': 'image/jpeg' } }` → response status 200, `Content-Type: image/jpeg`, `Cache-Control` header set |
| 5 | `GET: upstream fetch failure returns 502` | Mock fetch throws or returns `{ ok: false, status: 503 }` → response status 502 |

---

### 4. `web/src/lib/__tests__/filters.test.ts`

**Audit items**: P1 #5 (filter bar UX – serialization and chip generation)

**Source under test**: `web/src/lib/validation.ts` and/or a new `web/src/lib/filters.ts` utility (to be created in Phase 2)

**Mocks**: None (pure functions)

**Setup/teardown**: None

#### Test cases (~3 tests)

| # | Test name | What it verifies |
|---|-----------|-----------------|
| 1 | `serializeFilters: converts filter object to URLSearchParams string` | `{ type: 'rent', district: 'limassol' }` → `'type=rent&district=limassol'` (or equivalent) |
| 2 | `getActiveFilterChips: returns chip descriptors for each active param` | `{ type: 'rent', min_price: '500' }` → `[{ label: 'Rent', key: 'type' }, { label: 'Min: €500', key: 'min_price' }]` |
| 3 | `getActiveFilterChips: returns empty array when no filters active` | `{}` or `{ sort: 'newest' }` → `[]` |

---

### 5. `web/src/components/__tests__/listing-filters.test.tsx`

**Audit items**: P0 #2 (Enter key), P0 #3 (price validation), P1 #5 (clear filters, chips, presets)

**Source under test**: `web/src/components/listing-filters.tsx` (existing, modified in Phase 1D/1E/2A/2B)

**Mocks**:
- Mock `next/navigation`: `useRouter` and `useSearchParams`
  ```ts
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => new URLSearchParams(currentParams),
  }));
  ```
- `mockPush` is a `vi.fn()` reset in `beforeEach`

**Setup/teardown**:
```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
let mockPush: ReturnType<typeof vi.fn>;
beforeEach(() => { mockPush = vi.fn(); });
```

**Wrapper**: No special provider needed; the component uses `useRouter`/`useSearchParams` which are mocked.

#### Test cases (~10 tests)

| # | Test name | Audit item | What it verifies |
|---|-----------|-----------|-----------------|
| 1 | `renders search input and submit button` | – | `screen.getByRole('textbox')` and `screen.getByRole('button', { name: /search/i })` present |
| 2 | `pressing Enter in search input triggers search` | P0 #2 | Type text, press Enter, `mockPush` called with `?q=<text>` |
| 3 | `clicking Search button triggers search` | P0 #2 | Type text, click button, `mockPush` called |
| 4 | `price validation: shows error when min > max` | P0 #3 | Enter min=1000, max=500 → error message visible (`aria-invalid` on input or visible text) |
| 5 | `price validation: no error when min < max` | P0 #3 | Enter min=500, max=1000 → no error |
| 6 | `price validation: no error when only min is set` | P0 #3 | Enter min=500, no max → no error |
| 7 | `clear all filters button resets URL params` | P1 #5 | With active filters, click "Clear all" → `mockPush` called with empty/default params |
| 8 | `active filter chip appears for type filter` | P1 #5 | With `type=rent` in params, chip labeled "Rent" renders |
| 9 | `removing a chip calls router with param deleted` | P1 #5 | Click remove on "Rent" chip → `mockPush` called without `type` param |
| 10 | `price preset applies correct min/max values` | P1 #5 | Click "Under €500" preset → `mockPush` called with `max_price=500` and no `min_price` |

---

### 6. `web/src/components/__tests__/listing-card.test.tsx`

**Audit items**: P0 #1 (proxy URL in card image), P1 #7 (NEW badge, favorites, source badge, fallback)

**Source under test**: `web/src/components/listing-card.tsx` (existing, modified in Phase 1C/3)

**Mocks**:
- Mock `next/link` to render a plain `<a>`:
  ```ts
  vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
  ```
- Mock `@/lib/image-proxy` to make `getProxiedImageUrl` deterministic:
  ```ts
  vi.mock('@/lib/image-proxy', () => ({
    getProxiedImageUrl: (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`,
  }));
  ```
- Mock `localStorage` via jsdom (available by default in jsdom environment)

**Setup/teardown**:
```ts
import { render, screen, fireEvent } from '@testing-library/react';
// Helper: create a base listing fixture
function makeListing(overrides = {}): Listing { ... }
```

**Base listing fixture**:
```ts
{
  id: 1, source: 'bazaraki', title: 'Test Apt', listing_type: 'rent',
  price: 800, currency: 'EUR', location: 'Limassol', images: [],
  first_seen_at: new Date().toISOString(),  // "now" — considered new
  is_active: true, ...rest null
}
```

#### Test cases (~9 tests)

| # | Test name | Audit item | What it verifies |
|---|-----------|-----------|-----------------|
| 1 | `renders image through proxy URL when image present` | P0 #1 | `<img src>` attribute equals `/api/image-proxy?url=<encoded>` |
| 2 | `renders Building fallback icon when no images` | P0 #1 | No `<img>` rendered; fallback icon/container present |
| 3 | `onError on img triggers fallback state (hides image, shows icon)` | P0 #1 | `fireEvent.error(img)` → image hidden or Building icon appears |
| 4 | `shows NEW badge for listing seen within 48 hours` | P1 #7 | `first_seen_at` = now → badge with text "NEW" visible |
| 5 | `does not show NEW badge for listing seen 72 hours ago` | P1 #7 | `first_seen_at` = 3 days ago → no "NEW" badge |
| 6 | `formats EUR rent price with /mo suffix` | P1 #7 | price=800, currency=EUR, listing_type=rent → "€800/mo" visible |
| 7 | `shows bed/bath/area when present` | P1 #7 | bedrooms=2, bathrooms=1, area_sqm=75 → "2 bed", "1 bath", "75 m²" visible |
| 8 | `hides bed/bath/area when null` | P1 #7 | All three null → none of those labels visible |
| 9 | `source badge displays source name` | P1 #7 | `source='bazaraki'` → "bazaraki" text visible in card footer |

---

## Mock Strategy Summary

| Mock target | How | Used in |
|-------------|-----|---------|
| `global fetch` | `vi.stubGlobal('fetch', vi.fn())` | route.test.ts |
| `next/navigation` (useRouter, useSearchParams) | `vi.mock('next/navigation', ...)` | listing-filters.test.tsx |
| `next/link` | `vi.mock('next/link', ...)` | listing-card.test.tsx |
| `@/lib/image-proxy` | `vi.mock('@/lib/image-proxy', ...)` | listing-card.test.tsx |
| `localStorage` | jsdom built-in (no extra mock) | listing-card.test.tsx (favorites) |

---

## Audit Item Coverage Matrix

| Audit Item | Priority | Test file(s) | Test # |
|-----------|----------|-------------|--------|
| P0 #1: Broken images | P0 | image-proxy.test.ts, route.test.ts, listing-card.test.tsx | img-proxy 1-6, route 1-5, card 1-3 |
| P0 #2: Enter key search | P0 | listing-filters.test.tsx | filters 2-3 |
| P0 #3: Price filter validation | P0 | validation.test.ts, listing-filters.test.tsx | validation 1-6, filters 4-6 |
| P1 #5: Filter UX (clear, chips, presets) | P1 | listing-filters.test.tsx, filters.test.ts | filters 7-10, serialization 1-3 |
| P1 #7: Card redesign | P1 | listing-card.test.tsx | card 4-9 |

**P1 #4 (mobile responsiveness)**, **P1 #6 (detail page)**, **P2 #8-11**, **P3**: No automated tests in this plan (visual/layout changes, E2E deferred per approved strategy).

---

## Total Test Count

| File | Tests |
|------|-------|
| `web/src/lib/__tests__/validation.test.ts` | 6 |
| `web/src/lib/__tests__/image-proxy.test.ts` | 6 |
| `web/src/app/api/image-proxy/__tests__/route.test.ts` | 5 |
| `web/src/lib/__tests__/filters.test.ts` | 3 |
| `web/src/components/__tests__/listing-filters.test.tsx` | 10 |
| `web/src/components/__tests__/listing-card.test.tsx` | 9 |
| **Total** | **39** |

---

## Notes for Implementor

1. The `listing-filters.test.tsx` tests for chips, clear, and presets (tests 7-10) depend on Phase 2B features not yet built. These tests should be written alongside those features and will fail until the implementation lands.

2. The `route.test.ts` tests import the Next.js Route Handler (`GET` export) directly. The handler must be importable in vitest without the full Next.js runtime. Any `NextResponse` usage should be compatible with the node/jsdom environment or wrapped in a try-import.

3. For `listing-card.test.tsx` test #3 (onError fallback), the exact assertion depends on the implementation detail — either checking that the `<img>` has `display:none` / is removed from DOM, or that the Building icon container becomes visible. Adjust assertion to match what the implementation does.

4. The `filters.test.ts` tests for `getActiveFilterChips` and `serializeFilters` depend on a utility to be created in Phase 2. The exact function signatures should match what `listing-filters.tsx` exports or imports from `@/lib/filters`.

5. Run the backend vitest suite (from repo root: `npm test`) separately. The ~99 existing backend tests are unaffected by this plan.
