import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ConfigSchema, type AppConfig } from './schema.js';

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath ?? path.resolve(process.cwd(), 'config.yaml');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  let rawYaml = fs.readFileSync(filePath, 'utf-8');

  // Interpolate environment variables: ${VAR} and ${VAR:-default}
  rawYaml = rawYaml.replace(/\$\{(\w+)(?::-(.*?))?\}/g, (_, envVar, defaultVal) => {
    const value = process.env[envVar];
    if (value !== undefined) return value;
    if (defaultVal !== undefined) return defaultVal;
    throw new Error(`Environment variable ${envVar} is not set and has no default`);
  });

  const parsed = yaml.load(rawYaml) as Record<string, unknown>;

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid config:\n${errors}`);
  }

  return result.data;
}
