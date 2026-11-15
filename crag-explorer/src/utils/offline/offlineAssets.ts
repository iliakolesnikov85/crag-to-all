import { getCragApiUrl, getCragGpxUrl } from '../../api/client';
import { CragData } from '../../types';
import { getCragImageUrl } from '../firebaseStorage';

/** Collect unique image filenames from crag data. */
export function collectCragImageFiles(data: CragData): string[] {
  const files = new Set<string>();
  for (const sector of data.sectors) {
    for (const image of sector.images) {
      files.add(image.imageFile);
    }
    for (const route of sector.routes) {
      for (const image of route.images) {
        files.add(image.imageFile);
      }
    }
  }
  return Array.from(files);
}

/** URLs to store for offline use (crag JSON and GPX from the API, plus images). */
export function collectCragOfflineUrls(cragId: string, data: CragData): string[] {
  const urls = [
    getCragApiUrl(cragId),
    getCragGpxUrl(cragId),
  ];
  for (const imageFile of collectCragImageFiles(data)) {
    urls.push(getCragImageUrl(cragId, imageFile));
  }
  return urls;
}

export function getOfflineCacheName(cragId: string): string {
  return `crag-offline-${cragId}`;
}

/** GPX is for external apps; the offline pack still succeeds if this request fails. */
export function isOptionalOfflineUrl(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return /\/api\/crags\/[^/]+\/gpx$/.test(path);
}

export function extractImageFileFromUrl(url: string): string | null {
  try {
    const match = url.match(/images%2F([^?&]+)/);
    if (match) return decodeURIComponent(match[1]);
    const pathMatch = url.match(/\/images\/([^?&]+)/);
    if (pathMatch) return decodeURIComponent(pathMatch[1]);
  } catch (error) {
    console.warn('Failed to extract image file from URL:', url, error);
    return null;
  }
  return null;
}
