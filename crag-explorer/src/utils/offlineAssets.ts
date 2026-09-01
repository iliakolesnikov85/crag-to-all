import { CragData } from '../types';
import {
  getCragDataUrl,
  getCragImageUrl,
  getCragSectorsGpxUrl,
} from './firebaseStorage';

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

/** All Firebase URLs to store for offline use (JSON, images, GPX). */
export function collectCragOfflineUrls(cragId: string, data: CragData): string[] {
  const urls = [
    getCragDataUrl(cragId),
    getCragSectorsGpxUrl(cragId),
  ];
  for (const imageFile of collectCragImageFiles(data)) {
    urls.push(getCragImageUrl(cragId, imageFile));
  }
  return urls;
}

export function getOfflineCacheName(cragId: string): string {
  return `crag-offline-${cragId}`;
}

/** GPX is for external apps; offline pack succeeds if it is not published yet. */
export function isOptionalOfflineUrl(url: string): boolean {
  return url.includes('-sectors.gpx');
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
