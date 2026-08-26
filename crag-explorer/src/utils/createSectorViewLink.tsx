import React from 'react';
import { Link } from 'react-router';
import { parseGeo } from './mapUtils';
import { setMapCenter } from './mapSetup';

export function createSectorViewLink(
  getUrl: (to: string) => string,
  cragId: string,
  sectorGeo: string | null | undefined,
) {
  return (to: string, children: React.ReactNode) => (
    <Link
      className="link"
      to={getUrl(to)}
      onClick={() => {
        if (to !== '/map') return;
        const coords = parseGeo(sectorGeo);
        if (coords) setMapCenter(cragId, coords, 17);
      }}
    >
      {children}
    </Link>
  );
}
