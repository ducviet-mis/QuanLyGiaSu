import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicRoot = resolve(process.cwd(), 'public');
const manifest = JSON.parse(readFileSync(resolve(publicRoot, 'manifest.webmanifest'), 'utf8'));
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

function pngDimensions(path: string) {
  const bytes = readFileSync(resolve(publicRoot, path.replace(/^\//, '')));
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('public branding assets', () => {
  it('provides correctly sized PNGs for standard, maskable and Apple launch icons', () => {
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>;
    expect(icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any')).toBe(true);
    expect(icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(true);
    expect(icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(pngDimensions(icon.src)).toBe(icon.sizes);
    }
    const appleLink = html.match(/<link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/);
    expect(appleLink).not.toBeNull();
    expect(pngDimensions(appleLink![1])).toBe('180x180');
    expect(pngDimensions('/brand/favicon-32.png')).toBe('32x32');
  });

  it('serves branding files without the SPA HTML rewrite while retaining page routes', () => {
    const pageRewrite = vercel.rewrites.find((rule: { destination: string }) => rule.destination === '/index.html');
    const rewritePattern = new RegExp(`^${pageRewrite.source}$`);
    const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g), match => match[1]);
    const paths = [...hrefs, ...manifest.icons.map((icon: { src: string }) => icon.src), '/brand/tutorspace-app-icon.svg', '/brand/tutorspace-symbol.svg'];
    for (const url of paths) {
      const path = url.split('?')[0];
      expect(existsSync(resolve(publicRoot, path.replace(/^\//, '')))).toBe(true);
      expect(rewritePattern.test(path), path).toBe(false);
    }
    expect(rewritePattern.test('/invoices')).toBe(true);
    expect(rewritePattern.test('/students/student-id')).toBe(true);
  });
});
