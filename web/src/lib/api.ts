// SSR (server-side) uses Docker-internal URL; client-side uses relative paths through reverse proxy
const API_BASE = typeof window === 'undefined'
  ? (process.env.INTERNAL_API_URL || 'http://localhost:3000')
  : (process.env.NEXT_PUBLIC_API_URL || '');

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface Listing {
  id: number;
  source: string;
  external_id: string;
  url: string;
  title: string;
  listing_type: 'rent' | 'sale';
  price: number | null;
  currency: string;
  price_per_sqm: number | null;
  location: string;
  district: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  furnished: boolean | null;
  description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  agency_name: string | null;
  listing_date: string | null;
  amenities: string[];
  images: Array<{ url: string; order: number }>;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  notified_at: string | null;
}

export interface ListingsResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  listings: Listing[];
}

export interface StatsResponse {
  total: number;
  active: number;
  bySource: Record<string, number>;
}

export interface ScrapeRun {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  source: string | null;
  new_listings: number;
  updated_listings: number;
  errors: number;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  name: string;
  filters: Record<string, unknown>;
  is_active: boolean;
  signing_secret: string | null;
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getListings(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetchApi<ListingsResponse>(`/api/listings?${qs}`);
}

export function getListing(id: number) {
  return fetchApi<Listing>(`/api/listings/${id}`);
}

export function getStats() {
  return fetchApi<StatsResponse>('/api/stats');
}

export function getScrapeRuns(limit = 20) {
  return fetchApi<ScrapeRun[]>(`/api/scrape-runs?limit=${limit}`);
}

export function getSources() {
  return fetchApi<Array<{ name: string; active_listings: number }>>('/api/sources');
}

export function getWebhooks() {
  return fetchApi<WebhookSubscription[]>('/api/webhooks');
}

export function createWebhook(data: { url: string; name?: string; filters?: Record<string, unknown> }) {
  return fetchApi<WebhookSubscription>('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateWebhook(id: string, data: Partial<{ url: string; name: string; filters: Record<string, unknown>; is_active: boolean }>) {
  return fetchApi<WebhookSubscription>(`/api/webhooks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteWebhook(id: string) {
  return fetchApi<{ ok: boolean }>(`/api/webhooks/${id}`, { method: 'DELETE' });
}
