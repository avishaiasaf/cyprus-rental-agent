import { z } from 'zod';

export const FiltersSchema = z.object({
  listing_type: z.enum(['rent', 'buy', 'any']).default('any'),
  locations: z.array(z.string()).default([]),
  property_type: z.enum([
    'apartment', 'house', 'studio', 'villa', 'land', 'commercial', 'any',
  ]).default('any'),
  min_bedrooms: z.number().min(0).optional(),
  max_bedrooms: z.number().min(0).optional(),
  min_price_eur: z.number().min(0).optional(),
  max_price_eur: z.number().min(0).optional(),
  price_interpretation: z.enum(['auto']).default('auto'),
  furnished: z.enum(['true', 'false', 'any']).default('any'),
  pets_allowed: z.enum(['true', 'false', 'any']).default('any'),
  keywords_include: z.array(z.string()).default([]),
  keywords_exclude: z.array(z.string()).default([]),
  max_listing_age_days: z.number().min(1).default(7),
});

export const ProxySchema = z.object({
  enabled: z.boolean().default(false),
  urls: z.array(z.string()).nullable().default([]).transform(v => v ?? []),
  rotate_strategy: z.enum(['round-robin', 'random']).default('round-robin'),
});

export const SourceConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  base_url: z.string().optional(),
  max_pages: z.number().min(1).default(5),
  delay_between_requests_ms: z.number().min(0).default(2000),
  delay_between_pages_ms: z.number().min(0).default(3000),
});

export const TelegramSchema = z.object({
  bot_token: z.string().min(1),
  channel_id: z.string().min(1),
  message_format: z.enum(['detailed', 'compact']).default('detailed'),
  send_images: z.boolean().default(true),
  max_images_per_listing: z.number().min(0).default(4),
  max_messages_per_minute: z.number().default(20),
});

export const DatabaseSchema = z.object({
  type: z.enum(['postgres']).default('postgres'),
  connection_string: z.string().default('postgresql://agent:agent@localhost:5432/cyprus_rental'),
});

export const BrowserSchema = z.object({
  headless: z.boolean().default(true),
  timeout_ms: z.number().default(30000),
});

export const HealthCheckSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(3000),
});

export const ApifyConfigSchema = z.object({
  api_token: z.string().min(1),
  timeout_seconds: z.number().min(30).default(300),
  max_posts_per_group: z.number().min(1).default(100),
});

export const FacebookGroupSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
});

export const FacebookConfigSchema = z.object({
  groups: z.array(FacebookGroupSchema).default([]),
  cookie_file: z.string().optional(),
});

export const TelegramChannelSchema = z.object({
  username: z.string(),
  name: z.string().optional(),
});

export const TelegramChannelsConfigSchema = z.object({
  channels: z.array(TelegramChannelSchema).default([]),
  api_id: z.coerce.number().optional(),
  api_hash: z.string().optional(),
});

export const ConfigSchema = z.object({
  scrape_interval_minutes: z.number().min(1).default(300),
  filters: FiltersSchema.default({}),
  proxies: ProxySchema.default({}),
  telegram: TelegramSchema,
  database: DatabaseSchema.default({}),
  browser: BrowserSchema.default({}),
  health_check: HealthCheckSchema.default({}),
  apify: ApifyConfigSchema.optional(),
  facebook_groups: FacebookConfigSchema.optional(),
  telegram_channels: TelegramChannelsConfigSchema.optional(),
  sources: z.array(SourceConfigSchema).default([]),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type Filters = z.infer<typeof FiltersSchema>;
export type ProxyConfig = z.infer<typeof ProxySchema>;
export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export type TelegramConfig = z.infer<typeof TelegramSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseSchema>;
export type BrowserConfig = z.infer<typeof BrowserSchema>;
export type ApifyConfig = z.infer<typeof ApifyConfigSchema>;
export type FacebookConfig = z.infer<typeof FacebookConfigSchema>;
export type TelegramChannelsConfig = z.infer<typeof TelegramChannelsConfigSchema>;
