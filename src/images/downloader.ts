import fs from 'node:fs';
import path from 'node:path';
import type { RawListing, ListingImage } from '../types/listing.js';
import { HttpClient } from '../scraper/http-client.js';

export class ImageDownloader {
  constructor(
    private baseDir: string,
    private httpClient: HttpClient,
    private maxPerListing: number = 10,
  ) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  async downloadAll(listing: RawListing): Promise<void> {
    const images = listing.images.slice(0, this.maxPerListing);
    const dir = path.join(this.baseDir, listing.source, listing.externalId);
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        const ext = this.getExtension(img.url);
        const filename = `${i + 1}${ext}`;
        const localPath = path.join(dir, filename);

        if (fs.existsSync(localPath)) {
          img.localPath = localPath;
          continue;
        }

        const buffer = await this.httpClient.downloadBuffer(img.url);
        fs.writeFileSync(localPath, buffer);
        img.localPath = localPath;
      } catch {
        // Skip failed image downloads silently
      }
    }
  }

  private getExtension(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        return ext;
      }
    } catch {
      // ignore
    }
    return '.jpg';
  }
}
