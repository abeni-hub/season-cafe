import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedDatabase } from '@/services/demo/seed';
import { EDITORIAL_MEDIA, GALLERY_MEDIA, PRODUCT_MEDIA, resolveProductMedia } from './media';
import { BRAND } from './brand';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function publicAssetExists(webPath: string): boolean {
  const rel = webPath.replace(/^\/+/, '');
  return fs.existsSync(path.join(PUBLIC_DIR, rel));
}

describe('Seasons Cake media assets', () => {
  it('preserves the official logo asset untouched in public/brand', () => {
    expect(publicAssetExists(BRAND.logoPath)).toBe(true);
  });

  it('assigns a unique local product photograph to each of the seven regular products', () => {
    const db = seedDatabase();
    expect(db.products).toHaveLength(7);

    const seenSrc = new Set<string>();
    const seenSmall = new Set<string>();

    db.products.forEach((product) => {
      const media = resolveProductMedia(product.slug, product.artIndex);
      expect(media.slug).toBe(product.slug);
      expect(media.alt.length).toBeGreaterThan(10);
      expect(media.width).toBeGreaterThan(0);
      expect(media.height).toBeGreaterThan(0);
      expect(publicAssetExists(media.src)).toBe(true);
      expect(publicAssetExists(media.srcSmall)).toBe(true);
      expect(seenSrc.has(media.src)).toBe(false);
      expect(seenSmall.has(media.srcSmall)).toBe(false);
      seenSrc.add(media.src);
      seenSmall.add(media.srcSmall);
    });
  });

  it('ensures all editorial and gallery photographs exist on disk with descriptive alt text', () => {
    expect(PRODUCT_MEDIA).toHaveLength(7);

    Object.values(EDITORIAL_MEDIA).forEach((asset) => {
      expect(asset.alt.length).toBeGreaterThan(10);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(publicAssetExists(asset.src)).toBe(true);
      expect(publicAssetExists(asset.srcSmall)).toBe(true);
    });

    const gallerySrcs = new Set<string>();
    GALLERY_MEDIA.forEach((tile) => {
      expect(tile.asset.alt.length).toBeGreaterThan(10);
      expect(publicAssetExists(tile.asset.src)).toBe(true);
      expect(publicAssetExists(tile.asset.srcSmall)).toBe(true);
      expect(gallerySrcs.has(tile.asset.src)).toBe(false);
      gallerySrcs.add(tile.asset.src);
    });
  });
});
