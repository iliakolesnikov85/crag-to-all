import React from 'react';
import { MdLocationOn } from 'react-icons/md';
import { getCragGpxUrl } from '../api/client';
import { useCrag } from '../context/CragContext';
import { getOfflineCacheName } from '../utils/offline';
import Button from './Button';

async function fetchGpx(cragId: string): Promise<Response | null> {
  const url = getCragGpxUrl(cragId);
  try {
    const response = await fetch(url);
    if (response.ok) return response;
    console.warn(
      `GPX API returned ${response.status} for crag "${cragId}", trying offline pack`,
    );
  } catch (error) {
    console.warn(`GPX API fetch failed for crag "${cragId}", trying offline pack:`, error);
  }

  try {
    const cache = await caches.open(getOfflineCacheName(cragId));
    const cached = await cache.match(url);
    if (cached?.ok) return cached;
  } catch (error) {
    console.error(`Failed to read cached GPX for crag "${cragId}":`, error);
  }
  return null;
}

const GpxDownloadButton: React.FC = () => {
  const { crag } = useCrag();
  const cragId = crag?.id || '';

  const onDownload = async () => {
    if (!cragId) return;
    try {
      const response = await fetchGpx(cragId);
      if (!response) {
        console.error(`GPX download failed for crag "${cragId}"`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${cragId}-sectors.gpx`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(`GPX download failed for crag "${cragId}":`, error);
    }
  };

  return (
    <Button variant="primary" size="lg" fullWidth onClick={() => void onDownload()}>
      <MdLocationOn size={20} aria-hidden="true" />
      Download GPX
    </Button>
  );
};

export default GpxDownloadButton;
