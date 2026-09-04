import React from 'react';
import { Link } from 'react-router';
import type { LatLng } from '../types';
import { setMapCenter } from './mapSetup';

export function createSectorViewLink(
  getUrl: (to: string) => string,
  cragId: string,
  sectorGeo: LatLng | null | undefined,
) {
  return (to: string, children: React.ReactNode) => (
    <Link
      className="link"
      to={getUrl(to)}
      onClick={() => {
        if (to !== '/map') return;
        if (sectorGeo) setMapCenter(cragId, [sectorGeo.lat, sectorGeo.lon], 17);
      }}
    >
      {children}
    </Link>
  );
}
